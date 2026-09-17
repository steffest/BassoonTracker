// The "flyout" behavior (spec 020): a submenu's own controller. Shaped like
// runtime/listController.js - click-to-act on whatever item a point landed
// inside - but simpler in every other way: no scrolling (a flyout's item
// count is small, matching v1's own assumption), and it activates an item by
// running its command rather than merely selecting it, so a hover that
// previews the item is worth tracking separately from a press.
//
// `disabled` here is the *controller's* own disabled flag (spec 015's command
// enablement can drive it, exactly like every other controller); whether one
// *item* is disabled is a per-item fact the caller resolves (an item's own
// `disabledWhen`, exactly as `isHighlighted()` already resolves one generically)
// and passes in as `input.itemDisabled`, so this module stays state-shape-only
// and never evaluates an authored predicate itself.

export const SUBMENU_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "hoverIndex"];

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createSubmenuController(options = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), hoverIndex: null };

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, itemIndex?: number|null, itemDisabled?: boolean }} input
     * @returns {{ transitions: Array, activated: boolean, itemIndex: number|null,
     *   blocked: null|string, handled: boolean, changed: boolean }}
     */
    function handle(input) {
        const transitions = [];
        let activated = false;
        let itemIndex = null;
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("pressed", false, transitions);
                set("hoverIndex", null, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                set("pressed", false, transitions);
                set("hoverIndex", null, transitions);
                break;
            case "pointermove":
                if (!state.disabled) set("hoverIndex", input.itemIndex === undefined ? null : input.itemIndex, transitions);
                break;
            case "pointerdown":
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                break;
            case "pointerup":
                set("pressed", false, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                if (input.itemIndex !== undefined && input.itemIndex !== null) {
                    if (input.itemDisabled) { blocked = "item-disabled"; break; }
                    activated = true;
                    itemIndex = input.itemIndex;
                }
                break;
            default:
                break;
        }

        return { transitions, activated, itemIndex, blocked, handled, changed: false };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            set("hoverIndex", null, transitions);
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
