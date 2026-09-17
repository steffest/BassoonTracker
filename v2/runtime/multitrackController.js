// The "multitrack" behavior (spec 052): multitrackView's own controller,
// the port's sixth specialized-component leaf after patternGrid ("grid"),
// fileBrowser ("rowList"), waveformView ("waveform"), loopCreatorView
// ("loopCreator") and nibblesGrid ("nibbles"). Mirrors gridController.js's
// own contract: reads and writes domain/song and domain/arrangement
// directly as a side effect of handle(), returns no value/scrollTo for the
// generic write-back to act on.
//
// Owns its own scroll/zoom state, not shared with any other leaf - the same
// "every specialized leaf owns its own window" precedent loopCreatorView's
// own requirements.md already recorded.
//
// Ported from multitrack.js's own onMouseWheel/onDragStart/onDrag/
// onTouchUp/onClick (189-324), against renderers/canvas/multitrackGeometry.js's
// own pure math so drawing and hit-testing can never disagree.

import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import * as geo from "../renderers/canvas/multitrackGeometry.js";

export const MULTITRACK_STATE_FIELDS = ["hover", "focused", "disabled", "scrollX", "scrollY", "pixelsPerStep", "dragMode", "dragNote"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createMultitrackController(options = {}) {
    const state = {
        hover: false, focused: false, disabled: Boolean(options.disabled),
        scrollX: 0, scrollY: 0, pixelsPerStep: 14,
        dragMode: null, dragNote: null
    };
    let dragStart = { scrollX: 0, scrollY: 0, localX: 0, localY: 0 };
    let recordHandler = null;

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function seekTo(localX) {
        const patternLength = song.getPatternLength();
        if (!(patternLength > 0)) return;
        let step = geo.xToStep(localX, state.pixelsPerStep, state.scrollX);
        step = Math.max(0, Math.min(patternLength - 1, step));
        song.setCurrentPatternPos(step);
    }

    function handle(input) {
        const transitions = [];
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
                set("dragMode", null, transitions);
                state.dragNote = null;
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.local) break;

                const region = geo.hitRegion(input.local, input.rect);
                const th = geo.trackHeightFor(input.rect);
                const trackCount = song.getTrackCount();
                const patternLength = song.getPatternLength();

                if (region === "vscrollbar") {
                    dragStart = { ...dragStart, scrollY: state.scrollY, localY: input.local.y };
                    set("dragMode", "vscrollbar", transitions);
                } else if (region === "hscrollbar") {
                    dragStart = { ...dragStart, scrollX: state.scrollX, localX: input.local.x };
                    set("dragMode", "hscrollbar", transitions);
                } else if (region === "ruler") {
                    seekTo(input.local.x);
                    set("dragMode", "seek", transitions);
                } else if (region === "controls") {
                    const track = geo.trackAtY(input.local.y, state.scrollY, th);
                    if (track >= 0 && track < trackCount) {
                        const localY = geo.localTrackY(input.local.y, state.scrollY, track, th);
                        const button = geo.controlButtonAt(input.local.x, localY, th);
                        if (button === "solo") arrangement.toggleTrackSolo(track);
                        else if (button === "mute") arrangement.toggleTrackMute(track);
                        else if (button === "record" && recordHandler) recordHandler(track);
                    }
                } else if (region === "lane") {
                    const track = geo.trackAtY(input.local.y, state.scrollY, th);
                    const step = geo.xToStep(input.local.x, state.pixelsPerStep, state.scrollX);
                    const blocks = (track >= 0 && track < trackCount && patternLength > 0)
                        ? arrangement.getPerTrackBlocks(song.getCurrentPattern())[track]
                        : null;
                    const block = (step >= 0 && step < patternLength) ? geo.findBlockAt(blocks, step) : null;
                    if (block) {
                        state.dragNote = {
                            sourceTrack: track, sourceStep: block.startStep,
                            targetTrack: track, targetStep: block.startStep,
                            offsetStep: step - block.startStep
                        };
                        set("dragMode", "note", transitions);
                    } else {
                        dragStart = { ...dragStart, scrollX: state.scrollX, localX: input.local.x };
                        set("dragMode", "timeline", transitions);
                    }
                }
                handled = region !== null;
                break;
            }

            case "drag": {
                if (state.disabled || !state.dragMode || !input.rect || !input.local) break;
                const th = geo.trackHeightFor(input.rect);
                const trackCount = song.getTrackCount();
                const patternLength = song.getPatternLength();

                if (state.dragMode === "seek") {
                    seekTo(input.local.x);
                } else if (state.dragMode === "timeline") {
                    state.scrollX = geo.clampScrollX(dragStart.scrollX - (input.local.x - dragStart.localX), input.rect, patternLength, state.pixelsPerStep);
                } else if (state.dragMode === "hscrollbar") {
                    state.scrollX = geo.applyHorizontalThumbDelta(input.local.x - dragStart.localX, dragStart.scrollX, input.rect, patternLength, state.pixelsPerStep);
                } else if (state.dragMode === "vscrollbar") {
                    state.scrollY = geo.applyVerticalThumbDelta(input.local.y - dragStart.localY, dragStart.scrollY, input.rect, trackCount, th);
                } else if (state.dragMode === "note" && state.dragNote) {
                    let targetTrack = geo.trackAtY(input.local.y, state.scrollY, th);
                    targetTrack = Math.max(0, Math.min(Math.max(0, trackCount - 1), targetTrack));
                    let targetStep = geo.xToStep(input.local.x, state.pixelsPerStep, state.scrollX) - state.dragNote.offsetStep;
                    targetStep = Math.max(0, Math.min(Math.max(0, patternLength - 1), targetStep));
                    state.dragNote = { ...state.dragNote, targetTrack, targetStep };
                }
                handled = true;
                break;
            }

            case "pointerup": {
                if (state.dragMode === "note" && state.dragNote) {
                    const n = state.dragNote;
                    if (n.sourceTrack !== n.targetTrack || n.sourceStep !== n.targetStep) {
                        arrangement.moveNote(n.sourceTrack, n.sourceStep, n.targetTrack, n.targetStep);
                    }
                }
                handled = state.dragMode !== null;
                set("dragMode", null, transitions);
                state.dragNote = null;
                break;
            }

            case "wheel": {
                if (state.disabled || !input.rect) break;
                const patternLength = song.getPatternLength();
                const trackCount = song.getTrackCount();
                const th = geo.trackHeightFor(input.rect);
                const deltaX = input.deltaX || 0;
                const deltaY = input.deltaY || 0;
                if (deltaX === 0 && deltaY === 0) break;

                if (input.ctrlKey && input.local) {
                    const localX = input.local.x;
                    const mouseStep = (state.scrollX + localX - geo.CTRL_WIDTH) / state.pixelsPerStep;
                    const factor = deltaY > 0 ? 1.1 : 1 / 1.1;
                    state.pixelsPerStep = Math.max(geo.MIN_PPS, Math.min(geo.MAX_PPS, state.pixelsPerStep * factor));
                    state.scrollX = geo.clampScrollX(mouseStep * state.pixelsPerStep - (localX - geo.CTRL_WIDTH), input.rect, patternLength, state.pixelsPerStep);
                } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    state.scrollX = geo.clampScrollX(state.scrollX - deltaX * 0.5, input.rect, patternLength, state.pixelsPerStep);
                } else {
                    state.scrollY = geo.clampScrollY(state.scrollY - deltaY * 0.5, input.rect, trackCount, th);
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
            set("dragMode", null, transitions);
            state.dragNote = null;
        }
        return transitions;
    }

    /**
     * Not part of handle()'s own input vocabulary - a later screen spec's
     * own seam, mirroring nibblesController's separation of input handling
     * from screen wiring. Defaults to a no-op: no FX panel exists anywhere
     * in this port to wire the record button to yet (see requirements.md's
     * Decisions).
     */
    function setRecordHandler(fn) {
        recordHandler = typeof fn === "function" ? fn : null;
    }

    return {
        handle,
        setDisabled,
        setRecordHandler,
        get state() { return { ...state, dragNote: state.dragNote ? { ...state.dragNote } : null }; }
    };
}
