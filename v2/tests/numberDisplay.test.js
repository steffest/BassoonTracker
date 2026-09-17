import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, cursorOf, drawKindOf, isImplemented, isStyledType } from "../runtime/componentTypes.js";
import { createNumberDisplayController, paddedValue, clampOnly } from "../runtime/numberDisplayController.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";

// Spec 027: numberDisplay, moved out of spec 017's leaf cluster because it
// turned out to be a real, bounded, editable control - v1
// (script/src/ui/components/numberdisplay.js) treats it as a fixed-width,
// left-padded digit string with a caret, re-parsed as an integer and
// *clamped but never snapped to a step grid* on every edit. Neither
// runtime/valueController.js nor runtime/textController.js fit that shape
// alone, so it gets its own controller (behavior "digitEntry").

// --- registry ----------------------------------------------------------------

test("numberDisplay is implemented with its own \"digitEntry\" behavior and a padLength property", () => {
    const entry = componentType("numberDisplay");
    assert.equal(entry.implemented, true);
    assert.equal(entry.styled, false, "no artwork exists for it yet, matching knob/listbox/submenu");
    assert.equal(behaviorOf("numberDisplay"), "digitEntry");
    assert.equal(cursorOf("numberDisplay"), "text");
    assert.equal(drawKindOf("numberDisplay"), "numberDisplay");
    assert.equal(isStyledType("numberDisplay"), false);
    assert.equal(entry.properties.padLength.kind, "number");
    assert.equal(isImplemented("numberDisplay"), true);
});

// --- pure helpers --------------------------------------------------------------

test("paddedValue left-pads with spaces to padLength, and never truncates a longer value", () => {
    assert.equal(paddedValue(5, 4), "   5");
    assert.equal(paddedValue(-3, 4), "  -3");
    assert.equal(paddedValue(12345, 4), "12345", "a value wider than padLength is not cut");
    assert.equal(paddedValue(NaN, 4), "   0", "a non-finite value reads as 0");
});

test("clampOnly clamps but never snaps to a step grid", () => {
    assert.equal(clampOnly(150, { min: 0, max: 100, step: 10 }), 100);
    assert.equal(clampOnly(-5, { min: 0, max: 100, step: 10 }), 0);
    assert.equal(clampOnly(37, { min: 0, max: 100, step: 10 }), 37, "37 is not a multiple of step, and stays exactly 37");
});

// --- the "digitEntry" controller -----------------------------------------------

const BOUNDS = { min: 0, max: 999, step: 1 };

test("focusing places the caret at the end of the padded string, matching v1's own setFocus()", () => {
    const controller = createNumberDisplayController();
    const result = controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(controller.state.focused, true);
    assert.equal(controller.state.caret, 4, "\"   5\" is 4 characters");
    assert.equal(result.handled, false, "focus itself is not a handled gesture, matching every other controller");
});

test("a digit key splices into the padded string and re-parses it as an integer", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 }); // caret at 4, text "   5"
    const result = controller.handle({ type: "keydown", key: "7", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(result.handled, true);
    assert.equal(result.changed, true);
    assert.equal(result.value, 57, "\"   5\" with \"7\" spliced in at the end becomes \"  57\"");
});

test("typing never snaps to a step grid, only clamps at the bounds", () => {
    const controller = createNumberDisplayController();
    const bounds = { min: 0, max: 60, step: 10 };
    controller.handle({ type: "focus", value: 6, bounds, padLength: 2 }); // text " 6", caret 2
    const result = controller.handle({ type: "keydown", key: "1", value: 6, bounds, padLength: 2 }); // " 6" + "1" -> "61"
    assert.equal(result.value, 60, "61 clamped to max 60 - not snapped to the nearest multiple of 10");
});

test("Backspace deletes the digit before the caret and moves it back one", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 42, bounds: BOUNDS, padLength: 4 }); // "  42", caret 4
    const result = controller.handle({ type: "keydown", key: "Backspace", value: 42, bounds: BOUNDS, padLength: 4 });
    assert.equal(result.value, 4, "\"  42\" minus the char before the caret becomes \"  4\" -> 4");
    assert.equal(controller.state.caret, 3);
});

test("Delete removes the digit at the caret without moving it", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 42, bounds: BOUNDS, padLength: 4 });
    controller.handle({ type: "keydown", key: "ArrowLeft", value: 42, bounds: BOUNDS, padLength: 4 }); // caret 3, between 4 and 2
    const result = controller.handle({ type: "keydown", key: "Delete", value: 42, bounds: BOUNDS, padLength: 4 });
    assert.equal(result.value, 4, "the \"2\" at the caret is removed");
    assert.equal(controller.state.caret, 3, "Delete does not move the caret");
});

test("ArrowUp/ArrowDown always move by exactly 1, ignoring the authored step", () => {
    const bounds = { min: 0, max: 100, step: 10 };
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds, padLength: 2 });
    const up = controller.handle({ type: "keydown", key: "ArrowUp", value: 5, bounds, padLength: 2 });
    assert.equal(up.value, 6);
    const down = controller.handle({ type: "keydown", key: "ArrowDown", value: 5, bounds, padLength: 2 });
    assert.equal(down.value, 4);
});

test("the wheel moves by the authored step, clamped, matching valueController's own \"up increases\" convention", () => {
    const bounds = { min: 0, max: 100, step: 5 };
    const controller = createNumberDisplayController();
    const up = controller.handle({ type: "wheel", deltaY: -1, value: 10, bounds });
    assert.equal(up.value, 15);
    const down = controller.handle({ type: "wheel", deltaY: 1, value: 10, bounds });
    assert.equal(down.value, 5);
});

test("ArrowLeft/Right move the caret but never left of where the digits actually start", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 }); // "   5", caret 4
    controller.handle({ type: "keydown", key: "ArrowLeft", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(controller.state.caret, 3, "the one real digit's own position");
    const result = controller.handle({ type: "keydown", key: "ArrowLeft", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(controller.state.caret, 3, "cannot move into the padding before the digit");
    assert.equal(result.handled, true, "still a handled gesture, even though the caret did not move");
});

test("Enter blurs, exactly as v1's own onKeyDown does - no revert, no distinct submit outcome", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 });
    const result = controller.handle({ type: "keydown", key: "Enter", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(result.handled, true);
    assert.equal(controller.state.focused, false);
    assert.equal(result.submitted, undefined, "unlike inputbox, v1's own Enter has no distinct submit outcome");
});

test("a non-digit key (a letter) is not handled", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 });
    const result = controller.handle({ type: "keydown", key: "a", value: 5, bounds: BOUNDS, padLength: 4 });
    assert.equal(result.handled, false);
    assert.equal(result.changed, false);
});

test("disabled blocks editing and the wheel alike", () => {
    const controller = createNumberDisplayController({ disabled: true });
    const key = controller.handle({ type: "keydown", key: "5", value: 0, bounds: BOUNDS });
    assert.equal(key.blocked, "disabled");
    const wheel = controller.handle({ type: "wheel", deltaY: -1, value: 0, bounds: BOUNDS });
    assert.equal(wheel.blocked, "disabled");
});

test("setDisabled(true) blurs and un-presses, matching every other controller's convention", () => {
    const controller = createNumberDisplayController();
    controller.handle({ type: "focus", value: 5, bounds: BOUNDS, padLength: 4 });
    const transitions = controller.setDisabled(true);
    assert.equal(controller.state.disabled, true);
    assert.equal(controller.state.focused, false);
    assert.ok(transitions.some(t => t.field === "disabled"));
});

// --- draw kind (shallow, matching valueControls.test.js/overlayTypes.test.js) --

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: s => (s || "").length * 4, write: (...a) => {}, charHeight: 8 } };
}

test("numberDisplay draws its padded label and a caret only while focused", () => {
    const rect = { x: 0, y: 0, width: 40, height: 20 };
    const idle = fakeCtx();
    drawKind("numberDisplay").draw(idle, fakeAssets(), null, rect, "   5", {});
    const focused = fakeCtx();
    drawKind("numberDisplay").draw(focused, fakeAssets(), null, rect, "   5", { focused: true, caret: 4 });
    assert.ok(focused.calls.filter(c => c[0] === "fillRect").length > idle.calls.filter(c => c[0] === "fillRect").length, "an extra fillRect for the caret while focused");
});

test("numberDisplay dims when disabled, without throwing", () => {
    const rect = { x: 0, y: 0, width: 40, height: 20 };
    assert.doesNotThrow(() => drawKind("numberDisplay").draw(fakeCtx(), fakeAssets(), null, rect, "   5", { disabled: true }));
});

test("numberDisplay measures from its own padded label width", () => {
    const short = drawKind("numberDisplay").measure(fakeAssets(), null, "  5");
    const long = drawKind("numberDisplay").measure(fakeAssets(), null, "12345");
    assert.ok(long.width > short.width);
});
