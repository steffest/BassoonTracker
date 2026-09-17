// The "grid" behavior (spec 030): patternGrid's own controller. Unlike
// every other controller in this folder, it does not return a `value`/
// `scrollTo` for the caller to write into a bound field - it reads and
// writes `domain/song`'s live cursor/selection state directly, as a side
// effect of `handle()`, because a pattern's notes and cursor are not state
// the generic field-binding mechanism was ever meant to hold (see
// requirements.md GRID-001, design.md's "one door" note).
//
// Ported from script/src/ui/app/components/patternView.js's onDown/
// onDragStart/onDrag/onTouchUp/onMouseWheel (patternView.js:502-568), minus
// the horizontal-scrollbar-drag and record-mode branches v1 has (no v2
// equivalent yet - see requirements.md's scope decision).
//
// Spec 031 adds keyboard note entry on top: typing notes/hex values while
// recording (script/src/ui/input.js's handleNoteOn, 734-830), Backspace/
// Delete/Ctrl+Enter row and column edits (input.js:329-368,424-434), a
// Ctrl+Arrow track jump replacing v1's Tab (mountGeneric.js already claims
// Tab for focus movement), keyboard-driven selection growth, Escape-clears-
// selection, and F1-F7 octave selection - and corrects ArrowUp/ArrowDown
// (v1 wraps, script/src/tracker.js:230-236) and PageUp/PageDown (v1 jumps by
// a quarter pattern, input.js:390-403), both of which spec 030 had ported
// from patternView.js's own mouse-wheel guard instead.

import * as song from "../domain/song/index.js";
import { trackIndexAt, trackStep, LINE_HEIGHT, visibleTrackCount } from "../renderers/canvas/patternGridGeometry.js";

export const GRID_STATE_FIELDS = ["hover", "focused", "disabled", "startTrack"];

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * @param {{ disabled?: boolean }} [initial]
 */
export function createGridController(initial = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(initial.disabled), startTrack: 0 };
    // { mode: "select"|"pan", row, track, startTrack } - the drag/selection
    // anchor captured at pointerdown; null when nothing is held.
    let dragAnchor = null;

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function maxStartTrack(rect) {
        const trackCount = song.getTrackCount();
        const visible = visibleTrackCount(rect.width, song.inFTMode());
        return Math.max(0, trackCount - visible);
    }

    function handlePointerDown(input, transitions) {
        set("focused", true, transitions);
        if (state.disabled) return { transitions, handled: false, blocked: "disabled" };
        const trackCount = song.getTrackCount();
        const track = input.rect && input.local
            ? trackIndexAt(input.rect, input.local, trackCount, state.startTrack, song.inFTMode())
            : null;
        if (track === null) { dragAnchor = null; return { transitions, handled: false }; }

        const selecting = Boolean(input.metaKey || input.ctrlKey);
        const row = song.getCurrentPatternPos();
        if (selecting) {
            song.beginSelection(row, track);
            dragAnchor = { mode: "select", row, track, startTrack: state.startTrack };
        } else {
            song.setCurrentTrack(track);
            dragAnchor = { mode: "pan", row, track, startTrack: state.startTrack };
        }
        return { transitions, handled: true };
    }

    function handleDrag(input, transitions) {
        if (!dragAnchor || !input.rect) return { transitions, handled: false };
        const step = trackStep(song.inFTMode());
        const dTracks = Math.floor(input.delta.x / step);
        const dRows = Math.round(input.delta.y / LINE_HEIGHT);

        if (dragAnchor.mode === "select") {
            song.extendSelection(dragAnchor.row + dRows, dragAnchor.track + dTracks);
            return { transitions, handled: true };
        }
        if (song.isPlaying()) return { transitions, handled: true }; // v1: position/window pan both no-op while playing
        const targetPos = clamp(dragAnchor.row - dRows, 0, Math.max(0, song.getPatternLength() - 1));
        song.setCurrentPatternPos(targetPos);
        const newStartTrack = clamp(dragAnchor.startTrack - dTracks, 0, maxStartTrack(input.rect));
        set("startTrack", newStartTrack, transitions);
        return { transitions, handled: true };
    }

    function handlePointerUp(transitions) {
        const wasSelecting = Boolean(dragAnchor && dragAnchor.mode === "select");
        dragAnchor = null;
        return { transitions, handled: true, openSelectionMenu: wasSelecting && song.hasSelection() };
    }

    function handleWheel(input, transitions) {
        if (song.isPlaying()) return { transitions, handled: false };
        const pos = song.getCurrentPatternPos();
        if (input.deltaY > 0) {
            if (pos >= song.getPatternLength() - 1) return { transitions, handled: false };
            song.setCurrentPatternPos(pos + 1);
        } else {
            if (pos <= 0) return { transitions, handled: false };
            song.setCurrentPatternPos(pos - 1);
        }
        return { transitions, handled: true };
    }

    /** Ported from script/src/tracker.js:230-236 - wraps, not clamps (spec 031 NOTE-010). */
    function wrapPatternPos(delta) {
        const max = Math.max(0, song.getPatternLength() - 1);
        let next = song.getCurrentPatternPos() + delta;
        if (next < 0) next = max;
        if (next > max) next = 0;
        song.setCurrentPatternPos(next);
    }

    /** Ported from script/src/ui/input.js:390-403 - a quarter-pattern jump, clamped at either end (spec 031 NOTE-010). */
    function quarterPageJump(direction) {
        const length = song.getPatternLength();
        let step = Math.floor(length / 4);
        if (step === 0) step = 1;
        const pos = song.getCurrentPatternPos();
        let target = direction < 0 ? Math.floor(pos / step) * step : Math.ceil(pos / step) * step;
        if (target === pos) target += direction * step;
        song.setCurrentPatternPos(clamp(target, 0, Math.max(0, length - 1)));
    }

    /**
     * NOTE-007: holding Ctrl/Cmd while navigating grows a selection exactly
     * as a mouse drag does (ported from patternView.js's event-driven
     * _initRange, expressed directly here since there is no separate event
     * to subscribe to). `move` is any of the position-changing helpers
     * below; the selection is read *after* it runs.
     */
    function withSelectionGrowth(input, transitions, move) {
        const before = { row: song.getCurrentPatternPos(), track: song.getCurrentTrack() };
        move();
        if (input.ctrlKey || input.metaKey) {
            if (!song.hasSelection()) song.beginSelection(before.row, before.track);
            song.extendSelection(song.getCurrentPatternPos(), song.getCurrentTrack());
        }
        return { transitions, handled: true };
    }

    /** Ported from input.js:329-354,424-434. `withModifier` selects Backspace's Ctrl/Cmd (remove-row) branch. */
    function handleBackspace(transitions, withModifier) {
        if (!song.isRecording()) return { transitions, handled: false };
        if (withModifier) {
            song.removeNote();
            wrapPatternPos(-1);
        } else {
            clearCurrentColumn(-1); // FT volume columns clear to "empty" via putNoteParam's own <16 rule, matching v1's putNoteParam(pos,-1)
            wrapPatternPos(1);
        }
        return { transitions, handled: true };
    }

    function handleDelete(transitions) {
        if (!song.isRecording()) return { transitions, handled: false };
        clearCurrentColumn(0);
        wrapPatternPos(1);
        return { transitions, handled: true };
    }

    function clearCurrentColumn(ftVolumeClearValue) {
        const column = song.getCurrentTrackPosition();
        // song.putNote's ported signature takes an options object, unlike
        // v1's own positional Editor.putNote(instrument, period, ...) -
        // period must be passed explicitly as 0 (not omitted), or putNote's
        // own `typeof period === "number"` guard would leave the existing
        // period untouched instead of clearing it.
        if (column === 0) { song.putNote({ instrument: 0, period: 0 }); return; }
        const ftMode = song.inFTMode();
        const value = (ftMode && (column === 3 || column === 4)) ? ftVolumeClearValue : 0;
        song.putNoteParam(column, value);
    }

    /** NOTE-003/004: the note-key/hex-entry fallthrough, ported from handleNoteOn (input.js:734-808). */
    function handleCharacterKey(input, transitions) {
        // A Ctrl/Cmd-held letter is reserved for a shortcut (undo, select-
        // all, cut/copy/paste - input.js:499-521 checks this before ever
        // reaching its own keyboard-table lookup, for the same reason):
        // never treat it as a note or hex digit, recording or not.
        if (input.ctrlKey || input.metaKey) return { transitions, handled: false };
        if (!song.isRecording()) return { transitions, handled: false };
        if (song.getCurrentTrackPosition() === 0) {
            if (input.repeat) return { transitions, handled: true }; // v1's keyDown[index] guard, via the browser's own repeat flag
            const note = song.getNoteForKeyCode(input.code);
            if (!note) return { transitions, handled: false };
            song.putNote({ instrument: song.getCurrentInstrumentIndex(), period: note.period, noteIndex: note.index });
            wrapPatternPos(1);
            return { transitions, handled: true };
        }
        const value = song.getColumnValue(input.key);
        if (value === null) return { transitions, handled: false };
        song.putNoteParam(song.getCurrentTrackPosition(), value);
        wrapPatternPos(1);
        return { transitions, handled: true };
    }

    function handleKeydown(input, transitions) {
        switch (input.key) {
            case "ArrowUp":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => wrapPatternPos(-1));
            case "ArrowDown":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => wrapPatternPos(1));
            case "ArrowLeft":
                return withSelectionGrowth(input, transitions, () =>
                    (input.ctrlKey || input.metaKey) ? song.moveCursorPosition(-song.getStepsPerTrack()) : song.moveCursorPosition(-1));
            case "ArrowRight":
                return withSelectionGrowth(input, transitions, () =>
                    (input.ctrlKey || input.metaKey) ? song.moveCursorPosition(song.getStepsPerTrack()) : song.moveCursorPosition(1));
            case "PageUp":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => quarterPageJump(-1));
            case "PageDown":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => quarterPageJump(1));
            case "Home":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => song.setCurrentPatternPos(0));
            case "End":
                if (song.isPlaying()) return { transitions, handled: true };
                return withSelectionGrowth(input, transitions, () => song.setCurrentPatternPos(Math.max(0, song.getPatternLength() - 1)));
            case "Escape":
                if (song.hasSelection()) { song.resetSelection(); return { transitions, handled: true }; }
                return { transitions, handled: false };
            case "Backspace":
                return handleBackspace(transitions, Boolean(input.ctrlKey || input.metaKey));
            case "Delete":
                return handleDelete(transitions);
            case "Enter":
                if ((input.ctrlKey || input.metaKey) && song.isRecording()) {
                    song.insertNote();
                    wrapPatternPos(1);
                    return { transitions, handled: true };
                }
                return { transitions, handled: false };
            case "F1": case "F2": case "F3": case "F4": case "F5": case "F6": case "F7":
                song.setCurrentOctave(Number(input.key.slice(1)));
                return { transitions, handled: true };
            default:
                return handleCharacterKey(input, transitions);
        }
    }

    function handle(input) {
        const transitions = [];
        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); return { transitions, handled: false };
            case "pointerleave": set("hover", false, transitions); return { transitions, handled: false };
            case "pointerdown": return handlePointerDown(input, transitions);
            case "drag": return handleDrag(input, transitions);
            case "pointerup": return handlePointerUp(transitions);
            case "wheel": return handleWheel(input, transitions);
            case "keydown":
                if (!state.focused) return { transitions, handled: false, blocked: "unfocused" };
                return handleKeydown(input, transitions);
            case "focus": set("focused", true, transitions); return { transitions, handled: true };
            case "blur": set("focused", false, transitions); dragAnchor = null; return { transitions, handled: true };
            default: return { transitions, handled: false };
        }
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) dragAnchor = null;
        return transitions;
    }

    /**
     * The synthesized selection menu's own four commands (spec 030 GRID-007),
     * called by renderers/canvas/mountGeneric.js when one of its items
     * activates - not part of `handle()`'s input vocabulary, since nothing
     * about it is a pointer/keyboard/focus event.
     */
    function runSelectionCommand(command) {
        if (command === "clear") song.selectionClear();
        else if (command === "cut") song.selectionCut();
        else if (command === "copy") song.selectionCopy();
        else if (command === "paste") song.selectionPaste();
    }

    return {
        handle,
        setDisabled,
        runSelectionCommand,
        get state() { return { ...state }; }
    };
}
