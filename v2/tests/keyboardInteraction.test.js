import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShortcut, matchesShortcut, shortcutSignature, buildShortcutTable, matchShortcutTable } from "../runtime/shortcuts.js";
import { createTextController, TEXT_STATE_FIELDS } from "../runtime/textController.js";
import { BEHAVIORS, createBehaviorController } from "../runtime/behaviors.js";
import { componentType, behaviorOf, cursorOf } from "../runtime/componentTypes.js";

// Spec 015: focus/keyboard mechanics. All pure, so all of it is tested
// without a browser, exactly as spec 014 did for pointer input.

// --- runtime/shortcuts.js --------------------------------------------------

test("parseShortcut normalizes modifiers independently and the key", () => {
    assert.deepEqual(parseShortcut("Ctrl+S"), { key: "s", ctrl: true, shift: false, alt: false, meta: false });
    assert.deepEqual(parseShortcut("Ctrl+Shift+S"), { key: "s", ctrl: true, shift: true, alt: false, meta: false });
    assert.deepEqual(parseShortcut("Escape"), { key: "Escape", ctrl: false, shift: false, alt: false, meta: false });
    assert.deepEqual(parseShortcut("cmd+K"), { key: "k", ctrl: false, shift: false, alt: false, meta: true });
    assert.equal(parseShortcut(""), null);
    assert.equal(parseShortcut(null), null);
});

test("matchesShortcut requires every modifier to match, not just the key", () => {
    const ctrlS = parseShortcut("Ctrl+S");
    assert.ok(matchesShortcut(ctrlS, { key: "s", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }));
    assert.ok(matchesShortcut(ctrlS, { key: "S", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }), "key comparison is case-insensitive for single characters");
    assert.equal(matchesShortcut(ctrlS, { key: "s", ctrlKey: true, shiftKey: true, altKey: false, metaKey: false }), false, "Ctrl+S and Ctrl+Shift+S are different shortcuts");
    assert.equal(matchesShortcut(ctrlS, { key: "s", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }), false);
});

test("buildShortcutTable keeps the first registration of a duplicate and reports it", () => {
    const nodes = [{ id: "a", shortKey: "Ctrl+S" }, { id: "b", shortKey: "Ctrl+S" }, { id: "c", shortKey: null }, { id: "d" }];
    const duplicates = [];
    const table = buildShortcutTable(nodes, (signature, existingId, duplicateId) => duplicates.push({ signature, existingId, duplicateId }));
    assert.equal(table.get(shortcutSignature(parseShortcut("Ctrl+S"))), "a");
    assert.deepEqual(duplicates, [{ signature: "ctrl+s", existingId: "a", duplicateId: "b" }]);
    assert.equal(matchShortcutTable(table, { key: "s", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false }), "a");
    assert.equal(matchShortcutTable(table, { key: "s", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }), null);
});

// --- runtime/behaviors.js / componentTypes.js ------------------------------

test("text is a registered behavior and inputbox declares it", () => {
    assert.ok(Object.prototype.hasOwnProperty.call(BEHAVIORS, "text"));
    assert.equal(behaviorOf("inputbox"), "text");
    assert.equal(cursorOf("inputbox"), "text");
    assert.ok(componentType("inputbox").implemented);
    assert.equal(createBehaviorController("text").state.caret, 0);
});

// --- runtime/textController.js ---------------------------------------------

function focusOn(controller, value) {
    return controller.handle({ type: "focus", value });
}

test("TEXT_STATE_FIELDS lists every field the controller reports", () => {
    const controller = createTextController();
    assert.deepEqual(Object.keys(controller.state).sort(), [...TEXT_STATE_FIELDS].sort());
});

test("typing inserts at the caret and advances it", () => {
    const controller = createTextController();
    focusOn(controller, "");
    let result = controller.handle({ type: "keydown", key: "h", value: "" });
    assert.equal(result.changed, true);
    assert.equal(result.value, "h");
    assert.equal(controller.state.caret, 1);
    result = controller.handle({ type: "keydown", key: "i", value: result.value });
    assert.equal(result.value, "hi");
    assert.equal(controller.state.caret, 2);
});

test("arrow keys move the caret and clamp at the ends", () => {
    const controller = createTextController();
    focusOn(controller, "abc"); // caret starts at the end (3)
    assert.equal(controller.state.caret, 3);
    controller.handle({ type: "keydown", key: "ArrowLeft", value: "abc" });
    assert.equal(controller.state.caret, 2);
    controller.handle({ type: "keydown", key: "Home", value: "abc" });
    assert.equal(controller.state.caret, 0);
    const result = controller.handle({ type: "keydown", key: "ArrowLeft", value: "abc" });
    assert.equal(result.handled, true);
    assert.equal(controller.state.caret, 0, "does not go below zero");
    controller.handle({ type: "keydown", key: "End", value: "abc" });
    assert.equal(controller.state.caret, 3);
    controller.handle({ type: "keydown", key: "ArrowRight", value: "abc" });
    assert.equal(controller.state.caret, 3, "does not go past the end");
});

test("Shift+arrow extends a selection; a plain arrow afterwards collapses to its edge", () => {
    const controller = createTextController();
    focusOn(controller, "abcdef"); // caret at 6
    controller.handle({ type: "keydown", key: "Home", value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    assert.equal(controller.state.caret, 2);
    assert.equal(controller.state.selectionStart, 0, "selection anchors at the position before the first shifted move");
    // An unshifted arrow collapses to the near edge rather than moving one further.
    controller.handle({ type: "keydown", key: "ArrowLeft", value: "abcdef" });
    assert.equal(controller.state.caret, 0);
    assert.equal(controller.state.selectionStart, null);
});

test("Backspace and Delete remove a selection, or one character", () => {
    const controller = createTextController();
    focusOn(controller, "abcdef");
    controller.handle({ type: "keydown", key: "Home", value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    let result = controller.handle({ type: "keydown", key: "Backspace", value: "abcdef" });
    assert.equal(result.value, "cdef", "deletes the selection, not just one character");
    assert.equal(controller.state.caret, 0);
    assert.equal(controller.state.selectionStart, null);

    result = controller.handle({ type: "keydown", key: "Delete", value: "cdef" });
    assert.equal(result.value, "def");
    assert.equal(controller.state.caret, 0);

    controller.handle({ type: "keydown", key: "End", value: "def" });
    result = controller.handle({ type: "keydown", key: "Backspace", value: "def" });
    assert.equal(result.value, "de");
    assert.equal(controller.state.caret, 2);
});

test("a printable character replaces the selection", () => {
    const controller = createTextController();
    focusOn(controller, "abcdef");
    controller.handle({ type: "keydown", key: "Home", value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abcdef" });
    const result = controller.handle({ type: "keydown", key: "Z", value: "abcdef" });
    assert.equal(result.value, "Zcdef");
    assert.equal(controller.state.caret, 1);
});

test("Ctrl+A selects everything; Ctrl+C copies the selection without changing it; Ctrl+X cuts", () => {
    const controller = createTextController();
    focusOn(controller, "abcdef");
    controller.handle({ type: "keydown", key: "a", ctrlKey: true, value: "abcdef" });
    assert.equal(controller.state.caret, 6);
    assert.equal(controller.state.selectionStart, 0);

    const copy = controller.handle({ type: "keydown", key: "c", ctrlKey: true, value: "abcdef" });
    assert.equal(copy.clipboardWrite, "abcdef");
    assert.equal(copy.changed, false, "copy never edits the text");

    const cut = controller.handle({ type: "keydown", key: "x", ctrlKey: true, value: "abcdef" });
    assert.equal(cut.clipboardWrite, "abcdef");
    assert.equal(cut.changed, true);
    assert.equal(cut.value, "");
});

test("Ctrl+V pastes the clipboard text the renderer supplies, at the caret, replacing a selection if one exists", () => {
    // A real "paste" ClipboardEvent does not fire on a plain canvas for the
    // Ctrl+V shortcut (verified empirically in Chromium, with and without
    // clipboard permissions granted), so this - the renderer riding the
    // in-app clipboard along with every keydown - is the path that actually
    // pastes, not a fallback for a rare case. See design.md.
    const controller = createTextController();
    focusOn(controller, "ad");
    controller.handle({ type: "keydown", key: "ArrowLeft", value: "ad" }); // caret between a and d
    const result = controller.handle({ type: "keydown", key: "v", ctrlKey: true, clipboardText: "bc", value: "ad" });
    assert.equal(result.changed, true);
    assert.equal(result.value, "abcd");
    assert.equal(controller.state.caret, 3);
});

test("a plain x/c/a key types a letter; only the modified combination is a command", () => {
    const controller = createTextController();
    focusOn(controller, "ab");
    const result = controller.handle({ type: "keydown", key: "x", value: "ab" });
    assert.equal(result.changed, true);
    assert.equal(result.value, "abx", "an unmodified x is a letter, not cut");
});

test("Enter submits without changing the text; Escape reverts to the value at focus and reports it", () => {
    const controller = createTextController();
    focusOn(controller, "original");
    const typed = controller.handle({ type: "keydown", key: "!", value: "original" });
    assert.equal(typed.value, "original!");

    const enter = controller.handle({ type: "keydown", key: "Enter", value: "original!" });
    assert.equal(enter.submitted, true);
    assert.equal(enter.changed, false);

    const escape = controller.handle({ type: "keydown", key: "Escape", value: "original!" });
    assert.equal(escape.reverted, true);
    assert.equal(escape.revertTo, "original", "restores the value focus captured, not the edited one");
});

test("a disabled control blocks edits and pointer placement alike", () => {
    const controller = createTextController({ disabled: true });
    const result = controller.handle({ type: "keydown", key: "a", value: "", ctrlKey: false });
    assert.equal(result.blocked, "disabled");
    assert.equal(result.handled, false);
    const press = controller.handle({ type: "pointerdown", value: "abc", charIndex: 1 });
    assert.equal(press.blocked, "disabled");
    assert.equal(controller.state.caret, 0, "no caret placement while disabled");
});

test("pointerdown places the caret at the resolved character index; drag extends a selection", () => {
    const controller = createTextController();
    controller.handle({ type: "pointerdown", value: "abcdef", charIndex: 2 });
    assert.equal(controller.state.caret, 2);
    assert.equal(controller.state.selectionStart, null);
    controller.handle({ type: "drag", value: "abcdef", charIndex: 5 });
    assert.equal(controller.state.caret, 5);
    assert.equal(controller.state.selectionStart, 2, "anchored where the press happened");
    controller.handle({ type: "drag", value: "abcdef", charIndex: 2 });
    assert.equal(controller.state.selectionStart, null, "dragging back to the anchor clears the selection");
});

test("blur clears the selection and an unfocused control ignores keys", () => {
    const controller = createTextController();
    focusOn(controller, "abc");
    controller.handle({ type: "keydown", key: "ArrowRight", shiftKey: true, value: "abc" });
    assert.notEqual(controller.state.selectionStart, null);
    controller.handle({ type: "blur" });
    assert.equal(controller.state.selectionStart, null);
    assert.equal(controller.state.focused, false);
    const result = controller.handle({ type: "keydown", key: "a", value: "abc" });
    assert.equal(result.blocked, "unfocused");
});
