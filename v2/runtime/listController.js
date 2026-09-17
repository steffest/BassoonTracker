// The "list" behavior (spec 019): a listbox's own controller, combining
// click-to-select with wheel/drag-to-scroll. v1's listbox owns both itself
// rather than delegating to a child's own controller, and v2 must too: a
// listbox's `items` are plain child nodes of any type (spec 016 left the
// child shape unconstrained), most with no controller of their own, so the
// listbox is the only thing guaranteed to be interactive.
//
// The selected index lives in the bound `field`, exactly as a value
// control's number does (valueFieldOf falls back to a derived name the same
// way). The scroll offset does NOT: v1's own `_visibleIndex` was never
// authored state either, and reusing `field` for both would let scrolling
// silently disturb the selection, so it lives at scrollFieldOf(node) - a
// name derived from the node's id, never authored, so it can't collide.

import { thumbMetrics, isOnScrollbar, WHEEL_STEP } from "./scrollbar.js";

export const LIST_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "dragging"];

/** Where a listbox's scroll offset lives - see the module comment for why this is not `field`. */
export function scrollFieldOf(node) {
    return node && node.id ? `scroll.${node.id}` : null;
}

/**
 * @param {{ wheelStep?: number, disabled?: boolean }} [options]
 */
export function createListController(options = {}) {
    const wheelStep = options.wheelStep || WHEEL_STEP;
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), dragging: false };
    // Captured at pointerdown: the offset/thumb geometry a drag started from,
    // and which item (if any) the press landed on, for a plain click's
    // eventual pointerup to select without needing the geometry again.
    let anchor = null; // { offset, onThumb, ratio, itemIndex }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, offset?: number, extent?: object|null, rect?: object|null,
     *   point?: object|null, itemIndex?: number|null, dragged?: boolean,
     *   delta?: {x:number,y:number}, deltaY?: number, scrollable?: boolean }} input
     *   `itemIndex` (renderers/canvas/mountGeneric.js) is which authored item,
     *   if any, the point landed inside.
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, value: number|null, scrollTo: number|null }}
     */
    function handle(input) {
        const transitions = [];
        const offset = Number.isFinite(input.offset) ? input.offset : 0;
        const scrollable = input.scrollable !== false;
        const metrics = thumbMetrics(input.rect, input.extent, offset);
        let scrollTo = null;
        let value = null;
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
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                anchor = {
                    offset,
                    onThumb: Boolean(metrics) && isOnScrollbar(input.rect, input.point),
                    ratio: metrics ? metrics.ratio : 0,
                    itemIndex: input.itemIndex === undefined ? null : input.itemIndex
                };
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
                // moves the other way and faster; on the background (or an
                // item) the content follows the pointer one-for-one.
                scrollTo = anchor.onThumb ? anchor.offset + moved * anchor.ratio : anchor.offset - moved;
                break;
            }
            case "dragend":
                set("dragging", false, transitions);
                set("pressed", false, transitions);
                anchor = null;
                handled = true;
                break;
            case "pointerup":
                set("pressed", false, transitions);
                set("dragging", false, transitions);
                handled = true;
                // A press-and-release in place selects the item it landed on,
                // exactly as v1's mouse-down-then-up-without-moving did; a
                // drag never selects, matching a native list's own behaviour.
                if (!input.dragged && anchor && anchor.itemIndex !== null) value = anchor.itemIndex;
                anchor = null;
                break;
            case "wheel": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (!scrollable || !metrics) break;
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
            changed: value !== null || (scrollTo !== null && scrollTo !== offset),
            value,
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
