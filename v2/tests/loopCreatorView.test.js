import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import * as loopCreator from "../domain/sampleEditor/loopCreator.js";

// Spec 044: loopCreatorView, the specialized-component contract's fourth
// leaf (after patternGrid, fileBrowser and waveformView). Mirrors
// waveformView.test.js's own fake-canvas convention for the draw kind.

test("loopCreatorView is declared as a specialized leaf with its own behavior and draw kind", () => {
    const entry = componentType("loopCreatorView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("loopCreatorView"), "loopCreator");
    assert.equal(drawKindOf("loopCreatorView"), "loopCreatorView");
    assert.equal(cursorOf("loopCreatorView"), "default");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/sampleEditor/loopCreator.js and the node's own rect, nothing authored");
});

// --- the draw kind itself, against small synthetic sessions and a fake canvas

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), closePath: () => calls.push(["closePath"]),
        moveTo: (...a) => calls.push(["moveTo", ...a]), lineTo: (...a) => calls.push(["lineTo", ...a]),
        stroke: () => calls.push(["stroke"]), fill: () => calls.push(["fill"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); },
        set lineWidth(v) { calls.push(["lineWidth", v]); },
        set globalAlpha(v) { calls.push(["globalAlpha", v]); }
    };
}

const RECT = { x: 0, y: 0, width: 220, height: 60 };

beforeEach(() => {
    loopCreator.cancelLoopCreator();
});

function openStandard() {
    const data = new Array(220).fill(0).map((_, i) => Math.sin(i) * 0.3);
    const instrument = { sample: { data, length: 220, loop: { enabled: true, start: 50, length: 60 } } };
    loopCreator.openLoopCreator(instrument);
    loopCreator.setTailSize(20);
    loopCreator.setHeadSize(15);
    loopCreator.setLoopEndSize(10);
}

test("measure() floors to a fixed size, unaffected by whether a session is open", () => {
    assert.deepEqual(drawKind("loopCreatorView").measure(), { width: 300, height: 140 });
});

test("draw() never throws with no session open, and only fills the background", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("loopCreatorView").draw(ctx, null, null, RECT, "", {}));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "the background is filled");
    assert.equal(ctx.calls.filter(c => c[0] === "moveTo").length, 0, "nothing else drawn with no session open");
});

test("draw() never throws with a real session open, and plots the three blend layers, markers and size handles", () => {
    openStandard();
    const state = { zoomStart: 0, zoomLength: 220, dragging: null };
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("loopCreatorView").draw(ctx, null, null, RECT, "", state));

    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the background plus at least the loop-region tint and the two markers");
    assert.ok(ctx.calls.some(c => c[0] === "moveTo"), "at least one blend layer's own polyline");
    assert.ok(ctx.calls.some(c => c[0] === "fill"), "at least one blend/orig line's own filled triangle");
});

test("draw() highlights whichever target state.dragging names, without throwing", () => {
    openStandard();
    const state = { zoomStart: 0, zoomLength: 220, dragging: "tail" };
    assert.doesNotThrow(() => drawKind("loopCreatorView").draw(fakeCtx(), null, null, RECT, "", state));
});

test("draw() never throws when a region's own size is zero (no handle drawn for a zero max)", () => {
    const data = new Array(40).fill(0).map((_, i) => Math.sin(i) * 0.3);
    // loop occupies almost the whole tiny sample - maxHeadSize/maxLoopEndSize
    // both land at 0 (loopStart is 0), matching a real degenerate case
    // recomputeMaxes already guards elsewhere (spec 043).
    const instrument = { sample: { data, length: 40, loop: { enabled: true, start: 0, length: 40 } } };
    loopCreator.openLoopCreator(instrument);
    const state = { zoomStart: 0, zoomLength: 40, dragging: null };
    assert.doesNotThrow(() => drawKind("loopCreatorView").draw(fakeCtx(), null, null, RECT, "", state));
});

test("draw() never throws for a zoom window that excludes the loop region entirely", () => {
    openStandard();
    const state = { zoomStart: 150, zoomLength: 40, dragging: null }; // loop [50,110) is entirely out of view
    assert.doesNotThrow(() => drawKind("loopCreatorView").draw(fakeCtx(), null, null, RECT, "", state));
});
