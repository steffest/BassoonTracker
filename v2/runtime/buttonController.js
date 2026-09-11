// Pure button behavior controller (spec 005 Phase 4 / spec 002 COMP-002).
// No DOM: a renderer feeds it normalized inputs and reads back the state
// transitions and whether an activation happened, so pointer/keyboard/
// disabled semantics are unit-testable and identical across renderers.
//
// State fields: hover, pressed, focused, disabled. Activation rules:
//  - pointer: down (not disabled) presses; up while pressed activates;
//    leaving while pressed releases without activating.
//  - keyboard (only while focused): Enter activates on keydown; Space
//    presses on keydown and activates on keyup (browser button convention).
//  - disabled: hover/focus are still tracked so the visual can show them,
//    but nothing presses and nothing activates; the attempt is reported as
//    `blocked: "disabled"` so an interaction log can show "no command".
//  - drag (spec 014): a press that turned into a drag releases without
//    activating, so dragging across a row of buttons cannot fire one. The
//    controller tracks it itself rather than making the renderer remember,
//    because "did this press become a drag" is press state.
//
// `handled` says the controller consumed the input, which is how the renderer
// decides whether to suppress the browser default for a wheel.

export const BUTTON_STATE_FIELDS = ["hover", "pressed", "focused", "disabled"];

/**
 * @param {{ disabled?: boolean }} [initial]
 */
export function createButtonController(initial = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(initial.disabled) };
    let dragged = false; // this press moved past the drag threshold

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: "pointerenter"|"pointerleave"|"pointerdown"|"pointerup"|"keydown"|"keyup"|"focus"|"blur"|"dragstart"|"drag"|"dragend"|"wheel", key?: string }} input
     * @returns {{ transitions: Array<{field: string, from: boolean, to: boolean}>, activated: boolean, blocked: null|"disabled"|"unfocused", handled: boolean }}
     */
    function handle(input) {
        const transitions = [];
        let activated = false;
        let blocked = null;
        let handled = false;
        const activationAttempt = () => {
            if (state.disabled) { blocked = "disabled"; return; }
            activated = true;
        };

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("pressed", false, transitions);
                break;
            case "pointerdown":
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                break;
            case "pointerup":
                handled = state.pressed;
                if (dragged) {
                    // The press became a drag, so this release completes the
                    // drag rather than the click.
                    set("pressed", false, transitions);
                    dragged = false;
                } else if (state.pressed) {
                    set("pressed", false, transitions);
                    activationAttempt();
                } else if (state.disabled && state.hover) {
                    blocked = "disabled";
                }
                break;
            case "dragstart":
                if (state.disabled) { blocked = "disabled"; break; }
                dragged = true;
                break;
            case "drag":
            case "dragend":
                // A plain button has nothing to do with the motion itself; it
                // only needs to know the press was a drag, which dragstart
                // already recorded.
                break;
            case "focus":
                set("focused", true, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                set("pressed", false, transitions);
                dragged = false;
                break;
            case "keydown":
                if (!state.focused) { blocked = "unfocused"; break; }
                if (input.key === "Enter") { handled = true; activationAttempt(); }
                else if (input.key === " " || input.key === "Space" || input.key === "Spacebar") {
                    handled = true;
                    if (state.disabled) blocked = "disabled";
                    else set("pressed", true, transitions);
                }
                break;
            case "keyup":
                if (!state.focused) { blocked = "unfocused"; break; }
                if ((input.key === " " || input.key === "Space" || input.key === "Spacebar") && state.pressed) {
                    handled = true;
                    set("pressed", false, transitions);
                    activationAttempt();
                }
                break;
            default:
                break;
        }
        return { transitions, activated, blocked, handled };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            dragged = false;
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
