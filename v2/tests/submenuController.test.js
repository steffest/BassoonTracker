import { test } from "node:test";
import assert from "node:assert/strict";
import { createSubmenuController } from "../runtime/submenuController.js";

// Spec 020: the "flyout" behavior. Shaped like runtime/listController.js
// (click-to-act on whatever a point landed inside) but simpler - no
// scrolling, and it activates an item's command rather than merely
// selecting it.

test("hovering updates the preselected item, and leaving clears it", () => {
    const controller = createSubmenuController();
    const enter = controller.handle({ type: "pointerenter" });
    assert.equal(enter.transitions.some(t => t.field === "hover" && t.to === true), true);
    const moved = controller.handle({ type: "pointermove", itemIndex: 1 });
    assert.equal(controller.state.hoverIndex, 1);
    assert.equal(moved.handled, false, "a bare hover is not itself a handled gesture");
    const left = controller.handle({ type: "pointerleave" });
    assert.equal(controller.state.hoverIndex, null);
    assert.equal(left.transitions.some(t => t.field === "hover" && t.to === false), true);
});

test("a press-and-release on a non-disabled item activates it by index", () => {
    const controller = createSubmenuController();
    controller.handle({ type: "pointerdown", itemIndex: 2, itemDisabled: false });
    const result = controller.handle({ type: "pointerup", itemIndex: 2, itemDisabled: false });
    assert.equal(result.activated, true);
    assert.equal(result.itemIndex, 2);
    assert.equal(result.blocked, null);
});

test("a disabled item blocks activation and reports why", () => {
    const controller = createSubmenuController();
    controller.handle({ type: "pointerdown", itemIndex: 0, itemDisabled: true });
    const result = controller.handle({ type: "pointerup", itemIndex: 0, itemDisabled: true });
    assert.equal(result.activated, false);
    assert.equal(result.blocked, "item-disabled");
});

test("releasing over no item at all (itemIndex null) does not activate", () => {
    const controller = createSubmenuController();
    controller.handle({ type: "pointerdown", itemIndex: null });
    const result = controller.handle({ type: "pointerup", itemIndex: null });
    assert.equal(result.activated, false);
});

test("the controller's own disabled flag blocks input entirely, like every other controller", () => {
    const controller = createSubmenuController({ disabled: true });
    const down = controller.handle({ type: "pointerdown", itemIndex: 0 });
    assert.equal(down.blocked, "disabled");
    assert.equal(down.handled, false);
});

test("blur clears hover, pressed and focus together", () => {
    const controller = createSubmenuController();
    controller.handle({ type: "focus" });
    controller.handle({ type: "pointerdown", itemIndex: 1 });
    controller.handle({ type: "pointermove", itemIndex: 1 });
    const blurred = controller.handle({ type: "blur" });
    assert.equal(controller.state.focused, false);
    assert.equal(controller.state.hoverIndex, null);
    assert.ok(blurred.transitions.length > 0);
});

test("setDisabled(true) clears pressed and hover, matching every other controller's convention", () => {
    const controller = createSubmenuController();
    controller.handle({ type: "pointerdown", itemIndex: 0 });
    controller.handle({ type: "pointermove", itemIndex: 0 });
    const transitions = controller.setDisabled(true);
    assert.equal(controller.state.disabled, true);
    assert.equal(controller.state.pressed, false);
    assert.equal(controller.state.hoverIndex, null);
    assert.ok(transitions.some(t => t.field === "disabled"));
});
