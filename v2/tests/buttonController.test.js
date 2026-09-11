import { test } from "node:test";
import assert from "node:assert/strict";
import { createButtonController } from "../runtime/buttonController.js";

function fields(transitions) {
    return transitions.map(t => `${t.field}:${t.from}>${t.to}`);
}

test("pointer press and release over the button activates once", () => {
    const c = createButtonController();
    assert.deepEqual(fields(c.handle({ type: "pointerenter" }).transitions), ["hover:false>true"]);
    const down = c.handle({ type: "pointerdown" });
    assert.deepEqual(fields(down.transitions), ["focused:false>true", "pressed:false>true"]);
    assert.equal(down.activated, false);
    const up = c.handle({ type: "pointerup" });
    assert.deepEqual(fields(up.transitions), ["pressed:true>false"]);
    assert.equal(up.activated, true);
    assert.equal(up.blocked, null);
    // a second up without a press does nothing
    const again = c.handle({ type: "pointerup" });
    assert.equal(again.activated, false);
    assert.deepEqual(again.transitions, []);
});

test("leaving while pressed releases without activating", () => {
    const c = createButtonController();
    c.handle({ type: "pointerenter" });
    c.handle({ type: "pointerdown" });
    const leave = c.handle({ type: "pointerleave" });
    assert.deepEqual(fields(leave.transitions), ["hover:true>false", "pressed:true>false"]);
    assert.equal(leave.activated, false);
    assert.equal(c.handle({ type: "pointerup" }).activated, false);
});

test("keyboard: Enter activates on keydown, Space on keyup, only while focused", () => {
    const c = createButtonController();
    const unfocused = c.handle({ type: "keydown", key: "Enter" });
    assert.equal(unfocused.activated, false);
    assert.equal(unfocused.blocked, "unfocused");

    c.handle({ type: "focus" });
    assert.equal(c.handle({ type: "keydown", key: "Enter" }).activated, true);

    const spaceDown = c.handle({ type: "keydown", key: " " });
    assert.deepEqual(fields(spaceDown.transitions), ["pressed:false>true"]);
    assert.equal(spaceDown.activated, false);
    const spaceUp = c.handle({ type: "keyup", key: " " });
    assert.deepEqual(fields(spaceUp.transitions), ["pressed:true>false"]);
    assert.equal(spaceUp.activated, true);

    // blur while Space is held cancels the press
    c.handle({ type: "keydown", key: " " });
    assert.deepEqual(fields(c.handle({ type: "blur" }).transitions), ["focused:true>false", "pressed:true>false"]);
});

test("disabled: hover and focus are tracked, nothing presses or activates, attempts are reported", () => {
    const c = createButtonController({ disabled: true });
    assert.deepEqual(fields(c.handle({ type: "pointerenter" }).transitions), ["hover:false>true"]);
    const down = c.handle({ type: "pointerdown" });
    assert.deepEqual(fields(down.transitions), ["focused:false>true"], "focus moves, press does not");
    assert.equal(down.blocked, "disabled");
    const up = c.handle({ type: "pointerup" });
    assert.equal(up.activated, false);
    assert.equal(up.blocked, "disabled");
    const enter = c.handle({ type: "keydown", key: "Enter" });
    assert.equal(enter.activated, false);
    assert.equal(enter.blocked, "disabled");
    const space = c.handle({ type: "keydown", key: " " });
    assert.equal(space.blocked, "disabled");
    assert.equal(c.state.pressed, false);
});

test("setDisabled reports the transition and releases a held press", () => {
    const c = createButtonController();
    c.handle({ type: "pointerenter" });
    c.handle({ type: "pointerdown" });
    assert.deepEqual(fields(c.setDisabled(true)), ["disabled:false>true", "pressed:true>false"]);
    assert.deepEqual(c.setDisabled(true), [], "idempotent");
    assert.deepEqual(fields(c.setDisabled(false)), ["disabled:true>false"]);
    // after re-enabling, a fresh press activates normally
    c.handle({ type: "pointerdown" });
    assert.equal(c.handle({ type: "pointerup" }).activated, true);
});

test("state getter returns a copy", () => {
    const c = createButtonController();
    const snapshot = c.state;
    snapshot.hover = true;
    assert.equal(c.state.hover, false);
});
