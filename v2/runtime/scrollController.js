// The "scroll" behavior (spec 014 INT-004): the controller a `viewport`
// gets, so the box spec 013 built can be scrolled by the wheel, by dragging
// its background and by dragging its thumb.
//
// It returns a *requested* offset and never a clamped one. The clamp lives in
// runtime/genericLayout.js, which spec 013 made responsible for it, so every
// path - an author writing the bound field, a wheel, a drag, a thumb - is
// bounded by the same code and none of them can lose the content.

import { thumbMetrics, isOnScrollbar, WHEEL_STEP } from "./scrollbar.js";

export const SCROLL_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "dragging"];

/**
 * @param {{ wheelStep?: number, disabled?: boolean }} [options]
 */
export function createScrollController(options = {}) {
    const wheelStep = options.wheelStep || WHEEL_STEP;
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), dragging: false };
    // Where the drag started from, and whether it started on the thumb.
    let anchor = null; // { offset, onThumb, ratio }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, offset?: number, extent?: object|null, rect?: object|null,
     *   point?: object|null, delta?: {x:number,y:number}, deltaY?: number, scrollable?: boolean }} input
     *   `scrollable` is false for a viewport with no bound field: it cannot
     *   scroll, so it must not swallow the wheel from an ancestor that can.
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, scrollTo: number|null }}
     */
    function handle(input) {
        const transitions = [];
        const offset = Number.isFinite(input.offset) ? input.offset : 0;
        const scrollable = input.scrollable !== false;
        const metrics = thumbMetrics(input.rect, input.extent, offset);
        let scrollTo = null;
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
                break;
            case "blur":
                set("focused", false, transitions);
                set("pressed", false, transitions);
                set("dragging", false, transitions);
                anchor = null;
                break;
            case "pointerdown":
                if (state.disabled) { blocked = "disabled"; break; }
                if (!scrollable) break;
                set("pressed", true, transitions);
                anchor = {
                    offset,
                    onThumb: Boolean(metrics) && isOnScrollbar(input.rect, input.point),
                    ratio: metrics ? metrics.ratio : 0
                };
                handled = true;
                break;
            case "dragstart":
                if (state.disabled) { blocked = "disabled"; break; }
                if (!scrollable) break;
                set("dragging", true, transitions);
                handled = true;
                break;
            case "drag": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (!scrollable || !anchor) break;
                handled = true;
                const moved = input.delta ? input.delta.y : 0;
                // On the thumb the pointer drives the thumb, so the content
                // moves the other way and faster; on the background the
                // content follows the pointer one-for-one.
                scrollTo = anchor.onThumb ? anchor.offset + moved * anchor.ratio : anchor.offset - moved;
                break;
            }
            case "dragend":
            case "pointerup":
                set("dragging", false, transitions);
                set("pressed", false, transitions);
                anchor = null;
                handled = state.disabled ? false : scrollable;
                break;
            case "wheel": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (!scrollable || !metrics) break;
                // At an end the wheel belongs to whatever is behind this box,
                // so it is not consumed. That is what makes a list inside a
                // scrolling page feel right.
                const direction = Math.sign(input.deltaY || 0);
                const atEnd = (direction < 0 && offset <= 0) || (direction > 0 && offset >= metrics.overflow);
                if (direction === 0 || atEnd) break;
                handled = true;
                scrollTo = offset + direction * wheelStep;
                break;
            }
            default:
                break;
        }

        return {
            transitions,
            activated: false,
            blocked,
            handled,
            changed: scrollTo !== null && scrollTo !== offset,
            scrollTo
        };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            set("dragging", false, transitions);
            anchor = null;
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
