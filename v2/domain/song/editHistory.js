// Ported from script/src/ui/stateManager.js — the undo/redo stack, kept pure
// and independent of Tracker/Note so it is testable with a fake pattern
// accessor and no loaded song at all. domain/song/index.js supplies the real
// applyPatternDiff, wired against the shared engine's song object.

/** v1's EDITACTION enum (script/src/enum.js), as strings rather than magic numbers. */
export const EDITACTION = {
    PATTERN: "pattern",
    TRACK: "track",
    NOTE: "note",
    RANGE: "range",
    VALUE: "value",
    DATA: "data",
    SAMPLE: "sample"
};

const CELL_DIFF_KINDS = new Set([EDITACTION.NOTE, EDITACTION.RANGE, EDITACTION.TRACK, EDITACTION.PATTERN]);

/**
 * @param {object} options
 * @param {number} [options.maxHistory] v1's own cap (stateManager.js: 100).
 * @param {(action: object, direction: "undo"|"redo") => void} options.applyPatternDiff
 *   Replays a NOTE/RANGE/TRACK/PATTERN-kind action's cell diffs in the given direction.
 * @param {(action: object, direction: "undo"|"redo") => void} [options.applySampleDiff]
 *   Replays a SAMPLE-kind action (spec 040), supplied by domain/song/index.js
 *   the same way applyPatternDiff already is - this module stays independent
 *   of Tracker/Instrument either way.
 */
export function createEditHistory({ maxHistory = 100, applyPatternDiff, applySampleDiff } = {}) {
    let undoStack = [];
    let redoStack = [];
    let locked = false;

    function registerEdit(action) {
        if (locked) return false;

        if (action.type === EDITACTION.VALUE && undoStack.length) {
            const last = undoStack[undoStack.length - 1];
            if (last.type === EDITACTION.VALUE && last.id === action.id) {
                last.to = action.to;
                return false;
            }
        }

        undoStack.push(action);
        if (undoStack.length > maxHistory) undoStack.shift();
        redoStack = [];
        return true;
    }

    function replay(action, direction) {
        if (CELL_DIFF_KINDS.has(action.type)) {
            applyPatternDiff(action, direction);
        } else if (action.type === EDITACTION.VALUE) {
            if (action.target && typeof action.target.setValue === "function") {
                action.target.setValue(direction === "undo" ? action.from : action.to);
            }
        } else if (action.type === EDITACTION.SAMPLE) {
            if (applySampleDiff) applySampleDiff(action, direction);
        }
    }

    function undo() {
        if (!undoStack.length) return null;
        const action = undoStack.pop();
        locked = true;
        replay(action, "undo");
        locked = false;
        redoStack.push(action);
        return action;
    }

    function redo() {
        if (!redoStack.length) return null;
        const action = redoStack.pop();
        locked = true;
        replay(action, "redo");
        locked = false;
        undoStack.push(action);
        return action;
    }

    return {
        registerEdit,
        undo,
        redo,
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        getUndoLabel: () => "Undo " + (undoStack.length ? (undoStack[undoStack.length - 1].name || "") : ""),
        getRedoLabel: () => "Redo " + (redoStack.length ? (redoStack[redoStack.length - 1].name || "") : ""),
        clear: () => { undoStack = []; redoStack = []; }
    };
}
