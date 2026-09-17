// The "digitEntry" behavior (spec 027): numberDisplay's own controller.
// Neither `runtime/valueController.js` nor `runtime/textController.js` fit
// this shape alone. v1 (`script/src/ui/components/numberdisplay.js`) treats
// the control as a fixed-width, left-padded digit string with a caret: every
// edit (a typed digit, Backspace, Delete) splices that *string*, then
// re-parses the whole thing as an integer and clamps it to bounds - it is
// never snapped to a step grid the way a slider's drag or a spin box's wheel
// is, only clamped. ArrowUp/Down always move the value by exactly 1,
// regardless of the authored `step`, which only governs the wheel. This
// controller borrows `valueController`'s bounds shape and
// `textController`'s caret shape without being either.
//
// The bound state field is authoritative for the *value* (a number), exactly
// as it is for a value control; the caret has nowhere else to live, so the
// controller keeps it, the same way textController keeps its own.

export const NUMBER_DISPLAY_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "caret"];

const DEFAULT_BOUNDS = { min: 0, max: 100, step: 1 };
const DEFAULT_PAD_LENGTH = 4;

/** v1's own `_padValue()`: left-padded with spaces to `padLength`, never truncated. */
export function paddedValue(value, padLength) {
    const text = String(Number.isFinite(value) ? value : 0);
    return text.length >= padLength ? text : " ".repeat(padLength - text.length) + text;
}

/** Clamped, but never snapped to a step grid - v1 only ever clamps a typed/spliced value. */
export function clampOnly(value, bounds) {
    if (!Number.isFinite(value)) return bounds.min;
    return Math.min(Math.max(value, Math.min(bounds.min, bounds.max)), Math.max(bounds.min, bounds.max));
}

/** A caret may not move left of where the digits actually start - v1's own `_setCursorPos` clamp. */
function clampCaret(caret, text, value) {
    const digits = String(Math.trunc(Number.isFinite(value) ? value : 0)).length;
    const min = Math.max(text.length - digits, 0);
    return Math.min(Math.max(Math.round(caret), min), text.length);
}

function parseSpliced(chars) {
    const parsed = parseInt(chars.join("").trim(), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createNumberDisplayController(options = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), caret: 0 };

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, value?: number, bounds?: {min?:number,max?:number,step?:number},
     *   padLength?: number, charIndex?: number, key?: string }} input
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, value: number }}
     */
    function handle(input) {
        const transitions = [];
        const bounds = { ...DEFAULT_BOUNDS, ...(input.bounds || {}) };
        const padLength = input.padLength || DEFAULT_PAD_LENGTH;
        const value = clampOnly(Number(input.value), bounds);
        const text = paddedValue(value, padLength);
        let next = value;
        let changed = false;
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("pressed", false, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                set("caret", clampCaret(input.charIndex ?? text.length, text, value), transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                set("pressed", false, transitions);
                break;
            case "pointerdown":
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                set("caret", clampCaret(input.charIndex ?? text.length, text, value), transitions);
                break;
            case "pointerup":
                set("pressed", false, transitions);
                handled = true;
                break;
            case "wheel": {
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                const notches = Math.sign(input.deltaY || 0);
                next = value - notches * bounds.step; // wheel up increases, matching valueController's own convention
                changed = true;
                break;
            }
            case "keydown": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (!state.focused) { blocked = "unfocused"; break; }
                switch (input.key) {
                    case "ArrowLeft":
                        handled = true;
                        set("caret", clampCaret(state.caret - 1, text, value), transitions);
                        break;
                    case "ArrowRight":
                        handled = true;
                        set("caret", clampCaret(state.caret + 1, text, value), transitions);
                        break;
                    case "ArrowUp":
                        handled = true;
                        next = value + 1; // always by 1, never by `step` - matches v1 exactly
                        changed = true;
                        break;
                    case "ArrowDown":
                        handled = true;
                        next = value - 1;
                        changed = true;
                        break;
                    case "Backspace": {
                        handled = true;
                        const chars = text.split("");
                        chars.splice(state.caret - 1, 1);
                        next = parseSpliced(chars);
                        changed = true;
                        set("caret", clampCaret(state.caret - 1, text, value), transitions);
                        break;
                    }
                    case "Delete": {
                        handled = true;
                        const chars = text.split("");
                        chars.splice(state.caret, 1);
                        next = parseSpliced(chars);
                        changed = true;
                        break;
                    }
                    case "Enter":
                        // v1 only ever blurs on Enter - no revert, no distinct
                        // submit outcome, unlike an inputbox's own Enter/Escape.
                        handled = true;
                        set("focused", false, transitions);
                        break;
                    default:
                        if (typeof input.key === "string" && /^[0-9-]$/.test(input.key)) {
                            handled = true;
                            const chars = text.split("");
                            chars.splice(state.caret, 0, input.key);
                            next = parseSpliced(chars);
                            changed = true;
                            // v1's own _inject() never advances the caret.
                        }
                        break;
                }
                break;
            }
            default:
                break;
        }

        const clamped = clampOnly(next, bounds);
        return { transitions, activated: false, blocked, handled, changed: changed && clamped !== value, value: clamped };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            set("focused", false, transitions);
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
