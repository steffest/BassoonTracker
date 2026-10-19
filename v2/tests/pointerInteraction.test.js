import { test } from "node:test";
import assert from "node:assert/strict";
import { createPointerRouter, DRAG_THRESHOLD, DOUBLE_CLICK_MS, DOUBLE_CLICK_SLOP } from "../runtime/pointerRouter.js";
import { createValueController, quantize, valueAtPosition, boundsOf, valueFieldOf, STEPPER_WIDTH } from "../runtime/valueController.js";
import { createScrollController } from "../runtime/scrollController.js";
import { thumbMetrics, isOnScrollbar, SCROLLBAR_WIDTH, WHEEL_STEP } from "../runtime/scrollbar.js";
import { createButtonController } from "../runtime/buttonController.js";
import { BEHAVIORS, createBehaviorController } from "../runtime/behaviors.js";
import { COMPONENT_TYPES, behaviorOf, behaviorOptionsOf } from "../runtime/componentTypes.js";

// Spec 014: gesture recognition and the two new behaviors. All pure, so all
// of it is tested without a canvas; the browser scenario covers the wiring.

const at = (x, y) => ({ x, y });
const types = list => list.map(i => i.type);

// --- the pointer router ---------------------------------------------------

test("a press captures the pointer, so later moves ignore what is under it", () => {
    const router = createPointerRouter();
    // A press with no hover yet enters first, because the controller needs
    // hover before it can show a pressed state. In the renderer a move
    // always precedes the press; here it does not, so both appear.
    assert.deepEqual(types(router.down({ id: "slider", point: at(10, 10), time: 0 })), ["pointerenter", "pointerdown"]);
    assert.equal(router.captureId, "slider");

    // The pointer is now over a different control; the drag still belongs to
    // the slider, which is the whole reason capture exists.
    const moved = router.move({ hitId: "otherButton", point: at(60, 40), time: 10 });
    assert.ok(moved.every(input => input.id === "slider"), `every input went to the slider: ${JSON.stringify(moved.map(i => i.id))}`);
    assert.deepEqual(types(moved), ["pointerleave", "dragstart", "drag"], "leaving releases the press, and the move is a drag");

    const released = router.up({ point: at(60, 40), time: 20 });
    assert.deepEqual(types(released), ["dragend", "pointerup"]);
    assert.equal(released[1].id, "slider");
    assert.equal(released[1].inside, false, "released outside, so nothing activates");
    assert.equal(router.captureId, null);
});

test("leaving and re-entering while held releases and re-takes the press", () => {
    const router = createPointerRouter();
    router.down({ id: "b", point: at(5, 5), time: 0 });
    assert.deepEqual(types(router.move({ hitId: null, point: at(5, 5), time: 5 })), ["pointerleave"], "no motion, so no drag");
    const back = router.move({ hitId: "b", point: at(5, 5), time: 8 });
    assert.deepEqual(types(back), ["pointerenter", "pointerdown"], "coming back re-presses, as a native button does");
    const released = router.up({ point: at(5, 5), time: 10 });
    assert.deepEqual(types(released), ["pointerup"]);
    assert.equal(released[0].inside, true, "so this release does activate");
});

test("movement under the threshold is still a click; the first drag keeps the whole delta", () => {
    const router = createPointerRouter();
    router.down({ id: "b", point: at(100, 100), time: 0 });
    const small = router.move({ hitId: "b", point: at(100 + DRAG_THRESHOLD - 1, 100), time: 5 });
    assert.deepEqual(types(small), [], "below the threshold nothing is reported at all");

    const crossed = router.move({ hitId: "b", point: at(140, 100), time: 10 });
    const start = crossed.find(i => i.type === "dragstart");
    assert.ok(start, "past the threshold a drag starts");
    assert.deepEqual(start.delta, { x: 40, y: 0 }, "measured from the press point, not from the crossing");
    assert.deepEqual(start.origin, { x: 100, y: 100 });

    const up = router.up({ point: at(140, 100), time: 20 });
    assert.deepEqual(types(up), ["dragend", "pointerup"]);
    assert.equal(up[1].dragged, true, "so the controller knows not to activate");
});

test("two quick clicks on one node report a double-click after the second release", () => {
    const router = createPointerRouter();
    const click = (time, point = at(10, 10)) => {
        router.down({ id: "row", point, time });
        return router.up({ point, time: time + 1 });
    };
    assert.deepEqual(types(click(0)), ["pointerup"], "the first click is only a click");
    const second = click(100);
    assert.deepEqual(types(second), ["pointerup", "doubleclick"], "and the double-click is additive");
    assert.equal(second[1].id, "row");

    // A third click is not a triple: the pair was consumed.
    assert.deepEqual(types(click(200)), ["pointerup"]);

    // Too slow, too far, or a different node: not a double-click.
    assert.deepEqual(types(click(200 + DOUBLE_CLICK_MS + 50)), ["pointerup"]);
    router.down({ id: "row", point: at(10, 10), time: 5000 });
    router.up({ point: at(10, 10), time: 5001 });
    router.down({ id: "row", point: at(10 + DOUBLE_CLICK_SLOP + 4, 10), time: 5050 });
    assert.deepEqual(types(router.up({ point: at(10 + DOUBLE_CLICK_SLOP + 4, 10), time: 5051 })), ["pointerup"], "moved too far between the clicks");
});

test("a drag neither reports nor arms a double-click", () => {
    const router = createPointerRouter();
    router.down({ id: "b", point: at(0, 0), time: 0 });
    router.move({ hitId: "b", point: at(30, 0), time: 5 });
    router.up({ point: at(30, 0), time: 10 });
    router.down({ id: "b", point: at(30, 0), time: 20 });
    assert.deepEqual(types(router.up({ point: at(30, 0), time: 21 })), ["pointerup"], "the drag did not count as the first click");
});

test("a secondary press is its own gesture and takes no capture", () => {
    const router = createPointerRouter();
    const down = router.down({ id: "grid", point: at(4, 4), button: 2, time: 0 });
    assert.deepEqual(types(down), ["secondaryclick"]);
    assert.equal(router.captureId, null, "so a right-press can never press or drag a control");
    assert.deepEqual(router.up({ point: at(4, 4), button: 2, time: 1 }), []);
});

test("cancelling ends a drag and releases the press without activating", () => {
    const router = createPointerRouter();
    router.down({ id: "b", point: at(0, 0), time: 0 });
    router.move({ hitId: "b", point: at(20, 0), time: 5 });
    const cancelled = router.cancel();
    assert.deepEqual(types(cancelled), ["dragend", "pointerleave"]);
    assert.equal(cancelled[0].cancelled, true);
    assert.equal(router.captureId, null);
    assert.equal(router.dragging, false);
});

test("hover moves between nodes without a press", () => {
    const router = createPointerRouter();
    assert.deepEqual(types(router.move({ hitId: "a", point: at(1, 1) })), ["pointerenter"]);
    assert.deepEqual(types(router.move({ hitId: "a", point: at(2, 1) })), [], "same node, nothing to report");
    const crossed = router.move({ hitId: "b", point: at(50, 1) });
    assert.deepEqual(types(crossed), ["pointerleave", "pointerenter"]);
    assert.deepEqual(crossed.map(i => i.id), ["a", "b"]);
    assert.deepEqual(types(router.move({ hitId: null, point: at(500, 500) })), ["pointerleave"]);
});

// --- the value behavior ---------------------------------------------------

test("a value is always clamped to its range and snapped to its step", () => {
    const bounds = { min: 0, max: 10, step: 2 };
    assert.equal(quantize(-5, bounds), 0);
    assert.equal(quantize(99, bounds), 10);
    assert.equal(quantize(5, bounds), 6, "5 is closer to 6 than to 4");
    assert.equal(quantize(NaN, bounds), 0);
    assert.equal(quantize(0.34, { min: 0, max: 1, step: 0.1 }), 0.3, "and a fractional step keeps its decimals");
    // A range that is not a whole number of steps still cannot exceed itself.
    assert.equal(quantize(7, { min: 0, max: 7, step: 2 }), 7);
});

test("an absolute value control jumps to the pressed position and follows a drag", () => {
    const control = createValueController({ mode: "absolute", axis: "x" });
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    const bounds = { min: 0, max: 100, step: 1 };

    const pressed = control.handle({ type: "pointerdown", value: 0, bounds, rect, local: at(25, 10) });
    assert.equal(pressed.changed, true);
    assert.equal(pressed.value, 25, "a quarter along a 0..100 range");
    assert.equal(pressed.handled, true);
    assert.equal(pressed.activated, false, "a value control reports a change, never an activation");

    control.handle({ type: "dragstart", value: 25, bounds, rect, local: at(25, 10) });
    assert.equal(control.state.dragging, true);
    const dragged = control.handle({ type: "drag", value: 25, bounds, rect, local: at(90, 10), delta: at(65, 0) });
    assert.equal(dragged.value, 90, "the value follows the pointer, not the delta");

    // Past the end it stops at the end rather than running away.
    assert.equal(control.handle({ type: "drag", value: 90, bounds, rect, local: at(400, 10), delta: at(375, 0) }).value, 100);
    assert.equal(control.handle({ type: "drag", value: 90, bounds, rect, local: at(-40, 10), delta: at(-65, 0) }).value, 0);
});

test("a vertical absolute control reads bottom to top", () => {
    const rect = { x: 0, y: 0, width: 20, height: 100 };
    assert.equal(valueAtPosition(at(10, 0), rect, { min: 0, max: 100 }, "y"), 100, "the top is the maximum");
    assert.equal(valueAtPosition(at(10, 100), rect, { min: 0, max: 100 }, "y"), 0);
});

test("a relative value control moves in steps as the pointer moves, from where the drag began", () => {
    const control = createValueController({ mode: "relative", axis: "y", pixelsPerStep: 4 });
    const rect = { x: 0, y: 0, width: 60, height: 24 };
    const bounds = { min: 0, max: 64, step: 1 };

    control.handle({ type: "pointerdown", value: 10, bounds, rect, local: at(5, 12) });
    control.handle({ type: "dragstart", value: 10, bounds, rect, local: at(5, 12) });
    // Dragging up increases: four pixels per step.
    assert.equal(control.handle({ type: "drag", value: 10, bounds, rect, delta: at(0, -16) }).value, 14);
    // The next event is measured from the *press*, not cumulatively, so a
    // drag back to where it started restores the original value.
    assert.equal(control.handle({ type: "drag", value: 14, bounds, rect, delta: at(0, 0) }).value, 10);
    assert.equal(control.handle({ type: "drag", value: 10, bounds, rect, delta: at(0, 40) }).value, 0, "and it clamps");
});

test("a stepper press moves one step, up in the top half and down in the bottom", () => {
    const control = createValueController({ mode: "relative", axis: "y", stepper: true });
    const rect = { x: 0, y: 0, width: 60, height: 24 };
    const bounds = { min: 0, max: 64, step: 4 };
    const inStepper = x => ({ x, y: 0 });

    const up = control.handle({ type: "pointerdown", value: 8, bounds, rect, local: { x: rect.width - 2, y: 3 } });
    assert.equal(up.value, 12);
    const down = control.handle({ type: "pointerdown", value: 8, bounds, rect, local: { x: rect.width - 2, y: 20 } });
    assert.equal(down.value, 4);
    // Pressing the readout, left of the stepper column, is not a step.
    const readout = control.handle({ type: "pointerdown", value: 8, bounds, rect, local: { x: rect.width - STEPPER_WIDTH - 5, y: 12 } });
    assert.equal(readout.changed, false, "pressing the readout starts a drag instead");
    assert.ok(inStepper);
});

test("a spinbox can author a wider stepper and exposes its hovered half", () => {
    const control = createValueController({ mode: "relative", axis: "y", stepper: true });
    const rect = { x: 0, y: 0, width: 60, height: 32 };
    const common = { value: 4, bounds: { min: 2, max: 32, step: 1 }, rect, stepperWidth: 20 };
    assert.equal(control.handle({ ...common, type: "pointermove", local: { x: 41, y: 4 } }).transitions[0].to, "up");
    assert.equal(control.state.hoverPart, "up");
    assert.equal(control.handle({ ...common, type: "pointerdown", local: { x: 41, y: 28 } }).value, 3);
    control.handle({ ...common, type: "pointerleave", local: null });
    assert.equal(control.state.hoverPart, null);
});

test("a horizontal spinbox stepper exposes up on the left and down on the right", () => {
    const controller = createValueController({ mode: "relative", axis: "y", stepper: true });
    const common = { value: 4, bounds: { min: 2, max: 32, step: 1 }, rect: { width: 100, height: 28 }, stepperWidth: 20, stepperDirection: "horizontal" };
    const up = controller.handle({ type: "pointermove", local: { x: 70, y: 14 }, ...common });
    assert.equal(controller.state.hoverPart, "up");
    const down = controller.handle({ type: "pointerdown", local: { x: 90, y: 14 }, ...common });
    assert.equal(controller.state.hoverPart, "up");
    assert.equal(down.value, 3);
});

test("a focused value control blinks its cursor on the v1 300ms cadence", () => {
    const control = createValueController({ mode: "relative", axis: "y", stepper: true });
    control.handle({ type: "focus", value: 4 });
    assert.equal(control.state.cursorVisible, true);
    control.onFrame(299);
    assert.equal(control.state.cursorVisible, true);
    control.onFrame(1);
    assert.equal(control.state.cursorVisible, false);
    control.handle({ type: "blur", value: 4 });
    assert.equal(control.state.cursorVisible, false);
});

test("the wheel moves a value one step per notch, up increasing", () => {
    const control = createValueController({});
    const bounds = { min: 0, max: 10, step: 2 };
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    assert.equal(control.handle({ type: "wheel", value: 4, bounds, rect, deltaY: -120 }).value, 6);
    assert.equal(control.handle({ type: "wheel", value: 4, bounds, rect, deltaY: 120 }).value, 2);
    assert.equal(control.handle({ type: "wheel", value: 0, bounds, rect, deltaY: 120 }).changed, false, "already at the bottom");
    assert.equal(control.handle({ type: "wheel", value: 4, bounds, rect, deltaY: 0 }).changed, false);
});

test("a disabled value control reports the refusal and changes nothing", () => {
    const control = createValueController({ disabled: true });
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    const result = control.handle({ type: "pointerdown", value: 5, bounds: { min: 0, max: 10, step: 1 }, rect, local: at(90, 10) });
    assert.equal(result.blocked, "disabled");
    assert.equal(result.changed, false);
    assert.equal(control.state.pressed, false);
    assert.equal(control.handle({ type: "wheel", value: 5, bounds: { min: 0, max: 10, step: 1 }, rect, deltaY: -120 }).changed, false);
});

test("the bounds and the value field come from the node, with documented defaults", () => {
    assert.deepEqual(boundsOf({}), { min: 0, max: 100, step: 1 });
    assert.deepEqual(boundsOf({ min: 1, max: 32, step: 1 }), { min: 1, max: 32, step: 1 });
    assert.deepEqual(boundsOf({ min: "4" }), { min: 4, max: 100, step: 1 }, "an authored scalar still reads as a number");
    assert.deepEqual(boundsOf({ min: "many" }), { min: 0, max: 100, step: 1 });

    assert.equal(valueFieldOf({ field: "tracks.count", id: "x" }), "tracks.count", "the authored field wins");
    assert.equal(valueFieldOf({
        id: "x",
        bindings: [{ origin: "action", kind: "command", event: "change", mockField: "tracks.value" }]
    }), "tracks.value", "then the change action's own field, so both agree without saying it twice");
    assert.equal(valueFieldOf({ id: "main.controlBar.spinBox" }), "value.main.controlBar.spinBox");
});

// --- the scroll behavior --------------------------------------------------

const VIEWPORT = { x: 0, y: 0, width: 200, height: 60 };
const CONTENT = { width: 192, height: 300 };

test("the wheel scrolls a viewport by one step and lets the ends fall through", () => {
    const control = createScrollController();
    const base = { rect: VIEWPORT, extent: CONTENT, scrollable: true };
    const down = control.handle({ ...base, type: "wheel", offset: 0, deltaY: 120 });
    assert.equal(down.scrollTo, WHEEL_STEP);
    assert.equal(down.handled, true);

    assert.equal(control.handle({ ...base, type: "wheel", offset: 0, deltaY: -120 }).handled, false, "already at the top");
    assert.equal(control.handle({ ...base, type: "wheel", offset: 240, deltaY: 120 }).handled, false, "already at the bottom");
    // Not consuming it at the end is what lets an outer scroller take over.
    assert.equal(control.handle({ ...base, type: "wheel", offset: 240, deltaY: 120 }).scrollTo, null);
});

test("a viewport with nothing to scroll consumes nothing", () => {
    const control = createScrollController();
    const fits = { rect: VIEWPORT, extent: { width: 192, height: 30 }, scrollable: true };
    assert.equal(control.handle({ ...fits, type: "wheel", offset: 0, deltaY: 120 }).handled, false);

    // Nor does a box with no bound field, which is a clipping box only.
    const unbound = { rect: VIEWPORT, extent: CONTENT, scrollable: false };
    assert.equal(control.handle({ ...unbound, type: "wheel", offset: 0, deltaY: 120 }).handled, false);
    assert.equal(control.handle({ ...unbound, type: "pointerdown", offset: 0, point: at(10, 10) }).handled, false);
});

test("dragging the background moves the content with the pointer", () => {
    const control = createScrollController();
    const base = { rect: VIEWPORT, extent: CONTENT, scrollable: true, offset: 100 };
    control.handle({ ...base, type: "pointerdown", point: at(20, 20) });
    control.handle({ ...base, type: "dragstart", point: at(20, 20) });
    // Dragging down by 30 shows content 30 pixels higher up.
    assert.equal(control.handle({ ...base, type: "drag", delta: at(0, 30) }).scrollTo, 70);
    assert.equal(control.handle({ ...base, type: "drag", delta: at(0, -30) }).scrollTo, 130);
    assert.equal(control.state.dragging, true);
    control.handle({ ...base, type: "dragend" });
    assert.equal(control.state.dragging, false);
});

test("dragging the thumb scrolls proportionally, so the thumb follows the pointer", () => {
    const control = createScrollController();
    const metrics = thumbMetrics(VIEWPORT, CONTENT, 0);
    const base = { rect: VIEWPORT, extent: CONTENT, scrollable: true, offset: 0 };
    // Press inside the scrollbar column, which is what makes this a thumb drag.
    control.handle({ ...base, type: "pointerdown", point: at(VIEWPORT.width - 2, 4) });
    control.handle({ ...base, type: "dragstart" });
    const moved = control.handle({ ...base, type: "drag", delta: at(0, 10) });
    assert.equal(moved.scrollTo, 10 * metrics.ratio, "one pixel of thumb is `ratio` pixels of content");
    assert.ok(moved.scrollTo > 10, "which is faster than dragging the background");
});

test("a scrollbar has a thumb only when the content overflows", () => {
    assert.equal(thumbMetrics(VIEWPORT, { width: 192, height: 60 }, 0), null, "content exactly fits");
    assert.equal(thumbMetrics(VIEWPORT, null, 0), null);
    assert.equal(thumbMetrics(null, CONTENT, 0), null);

    const metrics = thumbMetrics(VIEWPORT, CONTENT, 0);
    assert.equal(metrics.overflow, 240);
    assert.equal(metrics.track.width, SCROLLBAR_WIDTH);
    assert.equal(metrics.track.x, VIEWPORT.width - SCROLLBAR_WIDTH, "against the right edge");
    assert.equal(metrics.thumb.height, 12, "a fifth of 60, floored at the grabbable minimum");
    assert.equal(metrics.thumb.y, VIEWPORT.y, "at the top when the offset is zero");

    const scrolled = thumbMetrics(VIEWPORT, CONTENT, 240);
    assert.equal(scrolled.thumb.y + scrolled.thumb.height, VIEWPORT.y + VIEWPORT.height, "and at the bottom when fully scrolled");

    assert.equal(isOnScrollbar(VIEWPORT, at(VIEWPORT.width - 1, 10)), true);
    assert.equal(isOnScrollbar(VIEWPORT, at(10, 10)), false);
});

// --- the button behavior, extended --------------------------------------

test("a press that became a drag releases without activating", () => {
    const control = createButtonController();
    control.handle({ type: "pointerenter" });
    control.handle({ type: "pointerdown" });
    assert.equal(control.state.pressed, true);
    control.handle({ type: "dragstart" });
    const released = control.handle({ type: "pointerup" });
    assert.equal(released.activated, false, "dragging across buttons must not fire one");
    assert.equal(control.state.pressed, false);

    // And the very next press still activates normally.
    control.handle({ type: "pointerdown" });
    assert.equal(control.handle({ type: "pointerup" }).activated, true);
});

test("a button reports whether it consumed an input, so the wheel can look elsewhere", () => {
    const control = createButtonController();
    assert.equal(control.handle({ type: "wheel", deltaY: 120 }).handled, false, "a button does nothing with a wheel");
    control.handle({ type: "pointerdown" });
    assert.equal(control.handle({ type: "pointerup" }).handled, true);
    control.handle({ type: "focus" });
    assert.equal(control.handle({ type: "keydown", key: "Enter" }).handled, true);
});

// --- the behavior table -------------------------------------------------

test("every behavior a type declares has a factory, and every controller has the same shape", () => {
    for (const [type, entry] of Object.entries(COMPONENT_TYPES)) {
        const behavior = behaviorOf(type);
        if (!behavior) {
            assert.ok(!entry.interactive || !entry.implemented, `${type} has no behavior, so it must not be an implemented interactive type`);
            continue;
        }
        assert.ok(BEHAVIORS[behavior], `${type} declares behavior "${behavior}", which must exist`);
        const controller = createBehaviorController(behavior, behaviorOptionsOf(type));
        assert.equal(typeof controller.handle, "function", `${type} controller handles input`);
        assert.equal(typeof controller.setDisabled, "function", `${type} controller can be disabled`);
        assert.equal(typeof controller.state, "object", `${type} controller exposes its state`);
        // The renderer calls the same three members on all of them, so an
        // unknown input must be tolerated rather than throw.
        const result = controller.handle({ type: "somethingNobodyHandles" });
        assert.equal(result.handled, false);
        assert.deepEqual(result.transitions, []);
        assert.deepEqual(controller.setDisabled(true).map(t => t.field), ["disabled"]);
    }
    assert.equal(createBehaviorController(null), null);
    assert.equal(createBehaviorController("nonesuch"), null);
});
