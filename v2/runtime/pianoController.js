// The "piano" behavior (spec 061): pianoView's own controller, the port's
// tenth specialized-component leaf. Gives spec 060's own headless
// note-preview engine its interactive front end.
//
// Ported from script/src/ui/app/pianoView.js's onDown/onDrag/onTouchUp
// (125-173) - both onDown and onDrag have identical bodies in v1, so this
// controller's own pointerdown/drag cases share the same helper.

import * as song from "../domain/song/index.js";
import * as playback from "../domain/playback/index.js";
import { keyAtPoint } from "../renderers/canvas/pianoGeometry.js";

export const PIANO_STATE_FIELDS = ["hover", "focused", "disabled"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createPianoController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };
    let heldKey = 0; // the widget-relative key (0 = none), mirrors v1's own prevDown

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /** Resolves input to a combined index (widget-relative key + current octave), or 0 for a miss. */
    function combinedIndexAt(input) {
        if (!input.rect || !input.local) return 0;
        const key = keyAtPoint(input.local, input.rect);
        return key === 0 ? 0 : key + song.getCurrentOctave() * 12;
    }

    /** Shared by pointerdown and drag - v1's own onDown/onDrag are identical bodies. */
    function pressAt(input, transitions) {
        const index = combinedIndexAt(input);
        if (index === 0) return false;
        if (index === heldKey) return false; // PIANO-003: already the held key, no re-trigger
        if (heldKey !== 0) playback.previewNoteOff(heldKey);
        playback.previewNoteOn(index);
        heldKey = index;
        return true;
    }

    function release() {
        if (heldKey !== 0) playback.previewNoteOff(heldKey);
        heldKey = 0;
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
                release();
                break;

            case "pointerdown":
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                handled = pressAt(input, transitions);
                break;

            case "drag":
                if (state.disabled) break;
                handled = pressAt(input, transitions);
                break;

            case "pointerup":
                if (state.disabled) break;
                if (heldKey !== 0) handled = true;
                release();
                break;

            default:
                break;
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        if (disabled) release();
        set("disabled", Boolean(disabled), transitions);
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
