// The "rowList" behavior (spec 035): fileBrowser's own controller,
// the second one after patternGrid's "grid" - see componentTypes.js's own
// entry and design.md for why this is not a reuse of "list"'s controller.
//
// Structurally a smaller sibling of listController.js (the same pointer/
// wheel/hover/focus cases, ending in the same result shape), but computing
// its own itemIndex/scroll extent from a bound row array via
// renderers/canvas/fileBrowserGeometry.js, since there are no child nodes
// for a rect-based hit test the way listbox's items are.

import { rowIndexAt, clampOffset, contentHeight, ROW_HEIGHT } from "../renderers/canvas/fileBrowserGeometry.js";
import { WHEEL_STEP } from "./scrollbar.js";

export const FILE_BROWSER_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "dragging", "hoverIndex", "hoverPart"];

/** Where a fileBrowser's own row array lives - this type's equivalent of listController.js's scrollFieldOf, which it reuses unchanged for the scroll offset itself. */
export function rowsFieldOf(node) {
    return node && node.id ? `rows.${node.id}` : null;
}

/**
 * @param {{ disabled?: boolean }} [options]
 */
export function createFileBrowserController(options = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), dragging: false, hoverIndex: null, hoverPart: null };
    // Captured at pointerdown: the offset a drag started from, and which row
    // (if any) the press landed on, for a plain click's eventual pointerup to
    // select without needing the geometry again.
    let anchor = null; // { offset, rowIndex }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /**
     * @param {{ type: string, rect?: object|null, point?: object|null, offset?: number,
     *   rows?: Array, delta?: {x:number,y:number}, deltaY?: number, dragged?: boolean,
     *   rowHeight?: number }} input rowHeight (spec 080) defaults to the plain-row
     *   constant - a richRows fileBrowser's own mountGeneric.js context passes its
     *   own taller value so hit-testing/scrolling can never disagree with drawing.
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string,
     *   handled: boolean, changed: boolean, value: number|null, scrollTo: number|null }}
     */
    function handle(input) {
        const transitions = [];
        const rows = input.rows || [];
        const rectHeight = input.rect ? input.rect.height : 0;
        const rowHeight = input.rowHeight || ROW_HEIGHT;
        const offset = clampOffset(input.offset || 0, rows.length, rectHeight, rowHeight);
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
                set("hoverIndex", null, transitions);
                set("hoverPart", null, transitions);
                break;
            case "pointermove": {
                if (!input.rect || !input.point) break;
                const localX = input.point.x - input.rect.x;
                const localY = input.point.y - input.rect.y;
                const buttonSize = 16;
                const buttonX = input.rect.width - 18;
                const part = localX >= buttonX && localX < buttonX + buttonSize
                    ? (localY >= 2 && localY < 2 + buttonSize ? "up" : localY >= input.rect.height - 19 && localY < input.rect.height - 3 ? "down" : null)
                    : null;
                set("hoverPart", part, transitions);
                set("hoverIndex", part ? null : rowIndexAt(input.rect, input.point, offset, rows.length, rowHeight), transitions);
                break;
            }
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
                anchor = { offset, rowIndex: rowIndexAt(input.rect, input.point, offset, rows.length, rowHeight) };
                break;
            case "dragstart":
                if (state.disabled) { blocked = "disabled"; break; }
                set("dragging", true, transitions);
                handled = true;
                break;
            case "drag":
                if (state.disabled) { blocked = "disabled"; break; }
                if (!anchor) break;
                handled = true;
                scrollTo = anchor.offset - (input.delta ? input.delta.y : 0);
                break;
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
                // A press-and-release in place selects the row it landed on;
                // a drag never selects, matching listController.js's own rule.
                if (!input.dragged && anchor && anchor.rowIndex !== null) value = anchor.rowIndex;
                anchor = null;
                break;
            case "wheel": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (rows.length === 0) break;
                const direction = Math.sign(input.deltaY || 0);
                const atEnd = (direction < 0 && offset <= 0) || (direction > 0 && offset >= contentHeight(rows.length, rowHeight) - rectHeight);
                if (direction === 0 || atEnd) break;
                handled = true;
                scrollTo = offset + direction * WHEEL_STEP;
                break;
            }
            default:
                break;
        }

        if (scrollTo !== null) scrollTo = clampOffset(scrollTo, rows.length, rectHeight, rowHeight);

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
