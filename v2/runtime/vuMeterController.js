// The "vuMeter" behavior (spec 054): volumeMeter's own controller, the
// port's seventh specialized-component leaf after patternGrid ("grid"),
// fileBrowser ("rowList"), waveformView ("waveform"), loopCreatorView
// ("loopCreator"), nibblesGrid ("nibbles") and multitrackView ("multitrack").
//
// Unlike every specialized leaf before it, v1's own VUMeter has no gesture
// vocabulary at all - no click, no drag, no keyboard. A controller still
// has to exist so `ticks: true` takes effect (behaviorOf() returns null,
// and no controller is ever created, for a non-interactive type - see
// requirements.md's Decisions), so this is the smallest shape short of not
// existing: hover/focused/disabled only, nothing else.

export const VU_METER_STATE_FIELDS = ["hover", "focused", "disabled"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createVuMeterController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function handle(input) {
        const transitions = [];
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
            default:
                break;
        }
        return { transitions, activated: false, blocked: null, handled: false, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
