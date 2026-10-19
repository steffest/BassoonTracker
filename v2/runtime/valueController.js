// The "value" behavior (spec 014 INT-006): a control holding one bounded
// number, moved by dragging and by the wheel. One controller serves both the
// `slider` and the `spinBox`; the difference is the `mode` and `axis` those
// types declare in runtime/componentTypes.js.
//
// The controller is NOT the source of truth for the value. The bound state
// field is, so every input carries the current `value` and the controller
// returns a new one. It keeps only what a gesture needs: the interaction
// flags, and the value the drag started from.

/** Width of a spin box's stepper column, shared with the draw kind. */
export const STEPPER_WIDTH = 12;
/** Logical pixels of movement per step in relative mode. */
export const PIXELS_PER_STEP = 4;

export const VALUE_STATE_FIELDS = ["hover", "hoverPart", "pressed", "focused", "disabled", "dragging", "cursorVisible"];

const DEFAULT_BOUNDS = { min: 0, max: 100, step: 1 };

/**
 * The bounds a value control was authored with, with the documented defaults.
 * Shared by the renderer, the draw kinds and the emitter so all three agree.
 */
export function boundsOf(node) {
    const read = (key, fallback) => {
        const value = Number(node && node[key]);
        return node && node[key] !== null && node[key] !== undefined && Number.isFinite(value) ? value : fallback;
    };
    return { min: read("min", DEFAULT_BOUNDS.min), max: read("max", DEFAULT_BOUNDS.max), step: read("step", DEFAULT_BOUNDS.step) };
}

/**
 * Which state field holds this control's value. Resolution order:
 *
 *  1. the authored `field:`;
 *  2. the mock field of a `change` action bound to it, so a control and the
 *    action that reacts to it agree on one field without the author naming it
 *    twice - the same bridge the highlighted/toggle recipes already use;
 *  3. a field derived from the node id, so a control with neither still works
 *    and is still visible in the State gallery.
 *
 * The emitter and the renderer both call this, so the field a generated
 * application declares is the field the renderer writes.
 */
export function valueFieldOf(node) {
    if (node && node.field) return node.field;
    const bindings = (node && node.bindings) || [];
    const change = bindings.find(b => b.origin === "action" && b.kind === "command" && b.event === "change" && b.mockField);
    if (change) return change.mockField;
    return node && node.id ? `value.${node.id}` : null;
}

/** Clamped to the range and snapped to the step, so no path yields a bad value. */
export function quantize(value, bounds) {
    const { min, max, step } = { ...DEFAULT_BOUNDS, ...(bounds || {}) };
    if (!Number.isFinite(value)) return min;
    const clamped = Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
    if (!step || step <= 0) return clamped;
    const snapped = min + Math.round((clamped - min) / step) * step;
    // Rounding can land one step outside when the span is not a multiple of it.
    const bounded = Math.min(Math.max(snapped, Math.min(min, max)), Math.max(min, max));
    // Keep the same number of decimals the step implies, so 0.1 steps do not
    // accumulate float noise into the state field.
    const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
    return decimals > 0 ? Number(bounded.toFixed(decimals)) : bounded;
}

/** The value a position along the control maps to, in absolute mode. */
export function valueAtPosition(local, rect, bounds, axis) {
    const { min, max } = { ...DEFAULT_BOUNDS, ...(bounds || {}) };
    if (!local || !rect) return min;
    const length = axis === "y" ? rect.height : rect.width;
    if (length <= 0) return min;
    const along = axis === "y" ? local.y : local.x;
    // A vertical control reads bottom-to-top, which is how every mixer looks.
    const fraction = axis === "y" ? 1 - along / length : along / length;
    return min + Math.min(Math.max(fraction, 0), 1) * (max - min);
}

/**
 * @param {{ mode?: "absolute"|"relative", axis?: "x"|"y", stepper?: boolean,
 *   pixelsPerStep?: number, disabled?: boolean }} [options] from the type's `behaviorOptions`
 */
export function createValueController(options = {}) {
    const mode = options.mode === "relative" ? "relative" : "absolute";
    const axis = options.axis === "y" ? "y" : "x";
    const stepper = Boolean(options.stepper);
    const pixelsPerStep = options.pixelsPerStep || PIXELS_PER_STEP;

    const state = { hover: false, hoverPart: null, pressed: false, focused: false, disabled: Boolean(options.disabled), dragging: false, cursorVisible: false };
    let cursorElapsed = 0;
    let dragFrom = null; // the value the current drag started from

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /** Which stepper button a point is in, or null if it is not in one. */
    function stepperHit(input) {
        if (!stepper || !input.local || !input.rect) return null;
        const width = Number.isFinite(Number(input.stepperWidth)) ? Number(input.stepperWidth) : STEPPER_WIDTH;
        if (input.stepperDirection === "horizontal") {
            if (input.local.x < input.rect.width - width * 2) return null;
            return input.local.x < input.rect.width - width ? 1 : -1;
        }
        if (input.local.x < input.rect.width - width) return null;
        return input.local.y < input.rect.height / 2 ? 1 : -1;
    }

    /**
     * @param {{ type: string, value?: number, bounds?: {min?:number,max?:number,step?:number},
     *   local?: {x:number,y:number}|null, rect?: object|null, delta?: {x:number,y:number},
     *   deltaY?: number }} input
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, value: number }}
     */
    function handle(input) {
        const transitions = [];
        const bounds = { ...DEFAULT_BOUNDS, ...(input.bounds || {}) };
        const current = quantize(Number(input.value), bounds);
        let next = current;
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                set("hoverPart", stepperHit(input) === 1 ? "up" : stepperHit(input) === -1 ? "down" : null, transitions);
                break;
            case "pointermove":
                set("hoverPart", stepperHit(input) === 1 ? "up" : stepperHit(input) === -1 ? "down" : null, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("hoverPart", null, transitions);
                set("pressed", false, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                set("cursorVisible", true, transitions);
                cursorElapsed = 0;
                break;
            case "blur":
                set("focused", false, transitions);
                set("cursorVisible", false, transitions);
                set("pressed", false, transitions);
                set("dragging", false, transitions);
                break;
            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                const direction = stepperHit(input);
                if (direction !== null) {
                    next = current + direction * bounds.step;
                } else if (mode === "absolute") {
                    // A press jumps to where it landed, as v1's sliders do.
                    next = valueAtPosition(input.local, input.rect, bounds, axis);
                }
                dragFrom = mode === "absolute" ? null : current;
                break;
            }
            case "dragstart":
                if (state.disabled) { blocked = "disabled"; break; }
                set("dragging", true, transitions);
                handled = true;
                break;
            case "drag": {
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                if (mode === "absolute") {
                    next = valueAtPosition(input.local, input.rect, bounds, axis);
                } else {
                    const moved = axis === "y" ? -(input.delta ? input.delta.y : 0) : (input.delta ? input.delta.x : 0);
                    const from = dragFrom === null ? current : dragFrom;
                    next = from + Math.round(moved / pixelsPerStep) * bounds.step;
                }
                break;
            }
            case "dragend":
                set("dragging", false, transitions);
                set("pressed", false, transitions);
                dragFrom = null;
                handled = true;
                break;
            case "pointerup":
                set("pressed", false, transitions);
                set("dragging", false, transitions);
                dragFrom = null;
                handled = true;
                break;
            case "wheel": {
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                const notches = Math.sign(input.deltaY || 0);
                next = current - notches * bounds.step; // wheel up increases
                break;
            }
            default:
                break;
        }

        const value = quantize(next, bounds);
        return { transitions, activated: false, blocked, handled, changed: value !== current, value };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            set("dragging", false, transitions);
        }
        return transitions;
    }

    function onFrame(deltaMs) {
        if (!state.focused) return;
        cursorElapsed += deltaMs;
        if (cursorElapsed < 300) return;
        cursorElapsed %= 300;
        state.cursorVisible = !state.cursorVisible;
    }

    return {
        handle,
        onFrame,
        setDisabled,
        get state() { return { ...state }; }
    };
}
