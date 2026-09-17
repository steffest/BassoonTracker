// The "waveform" behavior (spec 041): waveformView's own controller, the
// port's third specialized-component leaf after patternGrid ("grid") and
// fileBrowser ("rowList"). Mirrors gridController.js's own contract exactly:
// reads and writes domain/song and domain/sampleEditor directly as a side
// effect of handle(), returns no `value`/`scrollTo` for the generic
// applyValue()/applyScroll() write-back to act on - a waveform view is tied
// to exactly one thing (the current instrument's sample), not a generic,
// data-source-agnostic container the way fileBrowser deliberately is.
//
// Spec 042's own screen is this controller's first real tenant, and gave it
// one small, additive hook the mechanism-only spec had no way to exercise:
// `ensureZoom` now resets the zoom window to "the whole sample" whenever the
// current instrument itself changes, not only on the very first call -
// matching v1's own `waveform.js#setInstrument` (593-620), which resets its
// own zoom and range together on every instrument switch. Not a divergence;
// nothing about the gesture handling below changed.

import * as song from "../domain/song/index.js";
import * as sampleEditor from "../domain/sampleEditor/index.js";
import { clampZoom, pixelToSampleIndex, edgeAt } from "../renderers/canvas/waveformGeometry.js";

export const WAVEFORM_STATE_FIELDS = ["hover", "focused", "disabled", "zoomStart", "zoomLength"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createWaveformController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), zoomStart: 0, zoomLength: 0 };
    // { mode: "new", anchor: number } | { mode: "resize-start"|"resize-end", otherEdge: number }
    let dragAnchor = null;
    let lastInstrument; // identity, not a value - detects a switch, spec 042

    /**
     * Re-clamps the zoom window against the current sample - the first call
     * ever, and every instrument switch since (spec 042), seeds it to "the
     * whole sample", matching v1's own zoom === 1 reset.
     */
    function ensureZoom() {
        const instrument = song.getCurrentInstrument();
        const length = instrument && instrument.sample ? instrument.sample.length : 0;
        if (!state.zoomLength || instrument !== lastInstrument) state.zoomLength = length;
        lastInstrument = instrument;
        const clamped = clampZoom(state.zoomStart, state.zoomLength, length);
        state.zoomStart = clamped.zoomStart;
        state.zoomLength = clamped.zoomLength;
        return length;
    }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, rect?: object|null, point?: object|null,
     *   deltaY?: number, ctrlKey?: boolean }} input
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, value: null, scrollTo: null }}
     */
    function handle(input) {
        const transitions = [];
        const length = ensureZoom();
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                dragAnchor = null;
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.point || length <= 0) break;
                const selection = sampleEditor.getSampleSelection();
                const edge = edgeAt(input.rect, input.point.x, selection, state.zoomStart, state.zoomLength);
                const index = pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength);
                if (edge === "start") dragAnchor = { mode: "resize-start", otherEdge: selection.start + selection.length };
                else if (edge === "end") dragAnchor = { mode: "resize-end", otherEdge: selection.start };
                else dragAnchor = { mode: "new", anchor: Math.max(0, Math.min(length - 1, index)) };
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.point) break;
                const index = Math.max(0, Math.min(length, pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength)));
                if (dragAnchor.mode === "new") {
                    const start = Math.min(dragAnchor.anchor, index);
                    const end = Math.max(dragAnchor.anchor, index);
                    sampleEditor.setSampleSelection(start, Math.max(0, end - start));
                } else if (dragAnchor.mode === "resize-start") {
                    const start = Math.min(Math.max(0, index), dragAnchor.otherEdge - 2);
                    const clampedStart = Math.max(0, start);
                    sampleEditor.setSampleSelection(clampedStart, dragAnchor.otherEdge - clampedStart);
                } else if (dragAnchor.mode === "resize-end") {
                    const end = Math.max(Math.min(length, index), dragAnchor.otherEdge + 2);
                    const clampedEnd = Math.min(length, end);
                    sampleEditor.setSampleSelection(dragAnchor.otherEdge, clampedEnd - dragAnchor.otherEdge);
                }
                handled = true;
                break;
            }

            case "pointerup":
                if (dragAnchor) handled = true;
                dragAnchor = null;
                break;

            case "wheel": {
                if (state.disabled || length <= 0) break;
                const direction = Math.sign(input.deltaY || 0);
                if (direction === 0) break;
                if (input.ctrlKey) {
                    const factor = direction > 0 ? 1.25 : 0.8;
                    const center = state.zoomStart + state.zoomLength / 2;
                    const nextLength = state.zoomLength * factor;
                    const clamped = clampZoom(center - nextLength / 2, nextLength, length);
                    if (clamped.zoomStart === state.zoomStart && clamped.zoomLength === state.zoomLength) break;
                    state.zoomStart = clamped.zoomStart;
                    state.zoomLength = clamped.zoomLength;
                } else {
                    const step = Math.max(1, Math.round(state.zoomLength * 0.1));
                    const clamped = clampZoom(state.zoomStart + direction * step, state.zoomLength, length);
                    if (clamped.zoomStart === state.zoomStart) break;
                    state.zoomStart = clamped.zoomStart;
                }
                handled = true;
                break;
            }

            default:
                break;
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) dragAnchor = null;
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
