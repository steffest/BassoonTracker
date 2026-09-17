import { test } from "node:test";
import assert from "node:assert/strict";
import { createVuMeterController } from "../runtime/vuMeterController.js";

// Spec 054: the "vuMeter" behavior - the smallest controller shape in this
// port, since v1's own VUMeter has no gesture vocabulary at all. Exists
// only so `ticks: true` has a controller to attach to.

test("pointerenter/leave and focus/blur set hover/focused, and nothing else", () => {
    const controller = createVuMeterController();
    assert.deepEqual(controller.state, { hover: false, focused: false, disabled: false });

    let result = controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.hover, true);
    assert.equal(result.handled, false, "not a real gesture - nothing to report as handled");

    controller.handle({ type: "pointerleave" });
    assert.equal(controller.state.hover, false);

    controller.handle({ type: "focus" });
    assert.equal(controller.state.focused, true);
    controller.handle({ type: "blur" });
    assert.equal(controller.state.focused, false);
});

test("every other input type is a no-op, never throws", () => {
    const controller = createVuMeterController();
    for (const type of ["pointerdown", "drag", "pointerup", "wheel", "keydown"]) {
        const result = controller.handle({ type });
        assert.equal(result.handled, false);
        assert.deepEqual(result.transitions, []);
    }
});

test("setDisabled toggles the disabled flag and reports the transition", () => {
    const controller = createVuMeterController();
    const transitions = controller.setDisabled(true);
    assert.equal(controller.state.disabled, true);
    assert.deepEqual(transitions, [{ field: "disabled", from: false, to: true }]);

    const noChange = controller.setDisabled(true);
    assert.deepEqual(noChange, [], "no transition when the value does not actually change");
});

test("createVuMeterController(options) seeds disabled from the initial options", () => {
    const controller = createVuMeterController({ disabled: true });
    assert.equal(controller.state.disabled, true);
});
