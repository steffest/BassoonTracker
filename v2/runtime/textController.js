// The "text" behavior (spec 015 INT-013): one line of editable text with a
// caret and a selection. Pure and DOM-free, like every other controller in
// runtime/ — no font, so it never resolves pixels to characters itself; the
// renderer resolves a pointer position to a character index (it has the
// loaded font) and passes that index in as `input.charIndex`.
//
// The bound state field is authoritative for the *committed* string, exactly
// as it is for runtime/valueController.js's number: every input carries the
// current `value` and the controller returns a new one rather than holding
// its own copy. What only the controller holds is the caret and the
// selection anchor, because neither has anywhere else to live.

export const TEXT_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "caret", "selectionStart"];

function clampIndex(index, length) {
    if (!Number.isFinite(index)) return 0;
    return Math.min(Math.max(Math.round(index), 0), length);
}

/** The selection as an ordered `[start, end]`, or null when caret === anchor. */
function selectionRange(caret, selectionStart) {
    if (selectionStart === null || selectionStart === undefined || selectionStart === caret) return null;
    return caret < selectionStart ? [caret, selectionStart] : [selectionStart, caret];
}

function deleteRange(value, range) {
    const [start, end] = range;
    return { value: value.slice(0, start) + value.slice(end), caret: start };
}

function isPrintable(input) {
    return typeof input.key === "string" && input.key.length === 1 && !input.ctrlKey && !input.metaKey;
}

/**
 * @param {{ disabled?: boolean }} [initial]
 */
export function createTextController(initial = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(initial.disabled), caret: 0, selectionStart: null };
    let revertTo = null;   // the value at the moment focus arrived (Escape restores it)
    let dragAnchor = null; // the character index a drag-to-select started from

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function setCaret(caret, selectionStart, transitions) {
        set("caret", caret, transitions);
        set("selectionStart", selectionStart, transitions);
    }

    /**
     * @param {{ type: string, value?: string, caret?: number, selectionStart?: number|null,
     *   charIndex?: number, key?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean,
     *   clipboardText?: string }} input
     * @returns {{ transitions: Array, activated: boolean, blocked: null|string, handled: boolean,
     *   changed: boolean, value?: string, submitted?: boolean, reverted?: boolean, revertTo?: string,
     *   clipboardWrite?: string }}
     */
    function handle(input) {
        const transitions = [];
        const value = typeof input.value === "string" ? input.value : "";
        let handled = false;
        let blocked = null;
        let changed = false;
        let next = value;
        let caret = state.caret;
        let selectionStart = state.selectionStart;
        let submitted = false;
        let reverted = false;
        let clipboardWrite;

        const replaceSelectionOr = (start, end, text) => {
            const range = selectionRange(caret, selectionStart) || [start, end];
            next = value.slice(0, range[0]) + text + value.slice(range[1]);
            caret = range[0] + text.length;
            selectionStart = null;
        };

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
                revertTo = value;
                setCaret(clampIndex(input.charIndex ?? value.length, value.length), null, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                set("pressed", false, transitions);
                set("selectionStart", null, transitions);
                dragAnchor = null;
                break;
            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                const index = clampIndex(input.charIndex ?? value.length, value.length);
                dragAnchor = index;
                setCaret(index, null, transitions);
                break;
            }
            case "dragstart":
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                break;
            case "drag": {
                if (state.disabled) { blocked = "disabled"; break; }
                handled = true;
                const index = clampIndex(input.charIndex ?? state.caret, value.length);
                const anchor = dragAnchor === null ? state.caret : dragAnchor;
                setCaret(index, anchor === index ? null : anchor, transitions);
                break;
            }
            case "pointerup":
            case "dragend":
                set("pressed", false, transitions);
                handled = true;
                break;
            case "keydown": {
                if (state.disabled) { blocked = "disabled"; break; }
                if (!state.focused) { blocked = "unfocused"; break; }
                const shift = Boolean(input.shiftKey);
                const meta = Boolean(input.ctrlKey || input.metaKey);
                switch (input.key) {
                    case "ArrowLeft":
                        handled = true;
                        // An unshifted arrow with a selection collapses to that
                        // edge rather than moving one further past it.
                        caret = selectionStart !== null && !shift ? Math.min(caret, selectionStart) : clampIndex(caret - 1, value.length);
                        selectionStart = shift ? (selectionStart === null ? state.caret : selectionStart) : null;
                        setCaret(caret, selectionStart, transitions);
                        break;
                    case "ArrowRight":
                        handled = true;
                        caret = selectionStart !== null && !shift ? Math.max(caret, selectionStart) : clampIndex(caret + 1, value.length);
                        selectionStart = shift ? (selectionStart === null ? state.caret : selectionStart) : null;
                        setCaret(caret, selectionStart, transitions);
                        break;
                    case "Home":
                        handled = true;
                        selectionStart = shift ? (selectionStart === null ? state.caret : selectionStart) : null;
                        setCaret(0, selectionStart, transitions);
                        break;
                    case "End":
                        handled = true;
                        selectionStart = shift ? (selectionStart === null ? state.caret : selectionStart) : null;
                        setCaret(value.length, selectionStart, transitions);
                        break;
                    case "Backspace": {
                        handled = true;
                        const range = selectionRange(caret, selectionStart);
                        const result = range ? deleteRange(value, range) : caret > 0 ? deleteRange(value, [caret - 1, caret]) : { value, caret };
                        next = result.value;
                        changed = next !== value;
                        setCaret(result.caret, null, transitions);
                        break;
                    }
                    case "Delete": {
                        handled = true;
                        const range = selectionRange(caret, selectionStart);
                        const result = range ? deleteRange(value, range) : caret < value.length ? deleteRange(value, [caret, caret + 1]) : { value, caret };
                        next = result.value;
                        changed = next !== value;
                        setCaret(result.caret, null, transitions);
                        break;
                    }
                    case "Enter":
                        handled = true;
                        submitted = true;
                        break;
                    case "Escape":
                        handled = true;
                        reverted = true;
                        break;
                    default:
                        // a/c/x only mean select-all/copy/cut with a modifier
                        // held; unmodified, they are ordinary letters and must
                        // reach the printable-character path below like any
                        // other key.
                        if (meta && (input.key === "a" || input.key === "A")) {
                            handled = true;
                            setCaret(value.length, 0, transitions);
                        } else if (meta && (input.key === "c" || input.key === "C")) {
                            handled = true;
                            const range = selectionRange(caret, selectionStart);
                            if (range) clipboardWrite = value.slice(range[0], range[1]);
                        } else if (meta && (input.key === "x" || input.key === "X")) {
                            handled = true;
                            const range = selectionRange(caret, selectionStart);
                            if (range) {
                                clipboardWrite = value.slice(range[0], range[1]);
                                const result = deleteRange(value, range);
                                next = result.value;
                                changed = true;
                                setCaret(result.caret, null, transitions);
                            }
                        } else if (meta && (input.key === "v" || input.key === "V")) {
                            // The renderer's own in-app clipboard (spec 015):
                            // a real "paste" ClipboardEvent does not fire on a
                            // plain canvas for the Ctrl/Cmd+V shortcut in any
                            // browser tested, so this is the path that
                            // actually pastes, not a fallback for a rare case.
                            handled = true;
                            const text = typeof input.clipboardText === "string" ? input.clipboardText : "";
                            if (text) {
                                replaceSelectionOr(caret, caret, text);
                                changed = next !== value;
                                setCaret(caret, null, transitions);
                            }
                        } else if (isPrintable(input)) {
                            handled = true;
                            replaceSelectionOr(caret, caret, input.key);
                            changed = next !== value;
                            setCaret(caret, null, transitions);
                        }
                        break;
                }
                break;
            }
            default:
                break;
        }

        const result = { transitions, activated: false, blocked, handled, changed, value: next };
        if (submitted) result.submitted = true;
        if (reverted) { result.reverted = true; result.revertTo = revertTo === null ? value : revertTo; }
        if (clipboardWrite !== undefined) result.clipboardWrite = clipboardWrite;
        return result;
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            set("pressed", false, transitions);
            set("selectionStart", null, transitions);
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
