// The "loopCreator" behavior (spec 044): loopCreatorView's own controller,
// the port's fourth specialized-component leaf after patternGrid ("grid"),
// fileBrowser ("rowList") and waveformView ("waveform"). Mirrors
// waveformController.js's own contract exactly: reads/writes
// domain/sampleEditor/loopCreator.js directly as a side effect of handle(),
// returns no value/scrollTo for the generic write-back to act on.
//
// Owns its own independent zoom window, not synced with waveformView's -
// see requirements.md's Decisions and assumptions for why. Reuses
// renderers/canvas/waveformGeometry.js's own pixel<->sample-index math
// directly rather than duplicating it.

import * as loopCreator from "../domain/sampleEditor/loopCreator.js";
import { clampZoom, pixelToSampleIndex } from "../renderers/canvas/waveformGeometry.js";
import { hitLoopTarget } from "../renderers/canvas/loopCreatorGeometry.js";

export const LOOP_CREATOR_STATE_FIELDS = ["hover", "focused", "disabled", "zoomStart", "zoomLength", "dragging"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createLoopCreatorController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), zoomStart: 0, zoomLength: 0, dragging: null };
    let lastDataLen; // identity-free (a number), but the same "reset on switch" purpose waveformController.js's lastInstrument serves
    // { mode: one of the eleven target names, startX, startY, snapshot: the full getLoopCreatorState() at pointerdown }
    let dragAnchor = null;

    /** Re-clamps the zoom window against the current session - the first call, and every new session since (dataLen changing means a new open()), seeds it to "the whole sample". */
    function ensureZoom() {
        const s = loopCreator.getLoopCreatorState();
        const length = s.dataLen || 0;
        if (!state.zoomLength || length !== lastDataLen) state.zoomLength = length;
        lastDataLen = length;
        const clamped = clampZoom(state.zoomStart, state.zoomLength, length);
        state.zoomStart = clamped.zoomStart;
        state.zoomLength = clamped.zoomLength;
        return s;
    }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /** Ported from loopCreator.js#onDrag (214-254) - one branch per target, each just the delta-adjusted candidate value handed to the exact domain setter spec 043 already clamps against. */
    function applyDrag(input, s) {
        const startIndex = pixelToSampleIndex(input.rect, dragAnchor.startX, state.zoomStart, state.zoomLength);
        const currentIndex = pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength);
        const dx = currentIndex - startIndex;
        const dy = input.local ? input.local.y - dragAnchor.startY : 0;
        const waveH = input.rect.height;
        const denom = Math.max(1, waveH - 20); // BLEND_MARGIN*2 (loopCreatorGeometry.js), guarded against a near-zero rect
        const snapshot = dragAnchor.snapshot;
        const snap = value => (snapshot.snapToZero ? loopCreator.nearestZeroCrossing(value) : value);

        switch (dragAnchor.mode) {
            case "markerStart":
                loopCreator.setLoopStart(snap(snapshot.loopStart + dx));
                break;
            case "markerEnd":
                loopCreator.setLoopLength(snap(snapshot.loopEnd + dx) - snapshot.loopStart);
                break;
            case "tail":
                loopCreator.setTailSize(snapshot.tailSize + dx);
                break;
            case "head":
                loopCreator.setHeadSize(snapshot.headSize - dx);
                break;
            case "loopEnd":
                loopCreator.setLoopEndSize(snapshot.loopEndSize - dx);
                break;
            case "blendTail":
                loopCreator.setBlendTail(snapshot.blendTail - dy / denom);
                break;
            case "blendHead":
                loopCreator.setBlendHead(snapshot.blendHead - dy / denom);
                break;
            case "blendLoopEnd":
                loopCreator.setBlendLoopEnd(snapshot.blendLoopEnd - dy / denom);
                break;
            case "origTail":
                loopCreator.setOrigBlendTail(snapshot.origBlendTail - dy / denom);
                break;
            case "origHead":
                loopCreator.setOrigBlendHead(snapshot.origBlendHead - dy / denom);
                break;
            case "origLoopEnd":
                loopCreator.setOrigBlendLoopEnd(snapshot.origBlendLoopEnd - dy / denom);
                break;
            default:
                break;
        }
    }

    /**
     * @param {{ type: string, rect?: object|null, point?: object|null,
     *   local?: object|null, deltaY?: number, ctrlKey?: boolean }} input
     */
    function handle(input) {
        const transitions = [];
        const s = ensureZoom();
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
                set("dragging", null, transitions);
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.point || !input.local || input.local.y < 0) break;
                const hit = hitLoopTarget(input.rect, { x: input.point.x, y: input.local.y }, { ...s, zoomStart: state.zoomStart, zoomLength: state.zoomLength });
                if (!hit) break;
                dragAnchor = { mode: hit, startX: input.point.x, startY: input.local.y, snapshot: s };
                set("dragging", hit, transitions);
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.point) break;
                applyDrag(input, s);
                handled = true;
                break;
            }

            case "pointerup":
                if (dragAnchor) handled = true;
                dragAnchor = null;
                set("dragging", null, transitions);
                break;

            case "wheel": {
                if (state.disabled || !(s.dataLen > 0)) break;
                const direction = Math.sign(input.deltaY || 0);
                if (direction === 0) break;
                if (input.ctrlKey) {
                    const factor = direction > 0 ? 1.25 : 0.8;
                    const center = state.zoomStart + state.zoomLength / 2;
                    const nextLength = state.zoomLength * factor;
                    const clamped = clampZoom(center - nextLength / 2, nextLength, s.dataLen);
                    if (clamped.zoomStart === state.zoomStart && clamped.zoomLength === state.zoomLength) break;
                    state.zoomStart = clamped.zoomStart;
                    state.zoomLength = clamped.zoomLength;
                } else {
                    const step = Math.max(1, Math.round(state.zoomLength * 0.1));
                    const clamped = clampZoom(state.zoomStart + direction * step, state.zoomLength, s.dataLen);
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
        if (disabled) {
            dragAnchor = null;
            set("dragging", null, transitions);
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
