// The "scopes" behavior (spec 058): scopesView's own controller, the port's
// ninth specialized-component leaf after patternGrid ("grid"), fileBrowser
// ("rowList"), waveformView ("waveform"), loopCreatorView ("loopCreator"),
// nibblesGrid ("nibbles"), multitrackView ("multitrack"), volumeMeter
// ("vuMeter") and envelopeView ("envelope").
//
// No new domain work at all - domain/arrangement/index.js#toggleTrackMute
// (spec 051) already is the mute mechanism a click here needs; this
// controller only finds which cell was clicked.
//
// Ported from visualiser.js's own onClick (96-108).

import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import { hitTest } from "../renderers/canvas/scopesGeometry.js";

export const SCOPES_STATE_FIELDS = ["hover", "focused", "disabled"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createScopesController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
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
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.local) break;
                const index = hitTest(input.local, song.getTrackCount(), input.rect);
                if (index >= 0) {
                    arrangement.toggleTrackMute(index);
                    handled = true;
                }
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
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
