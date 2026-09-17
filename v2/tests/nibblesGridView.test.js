import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import * as Nibbles from "../domain/nibbles/index.js";

// Spec 047: nibblesGrid, the specialized-component contract's fifth leaf
// (after patternGrid, fileBrowser, waveformView and loopCreatorView).
// Mirrors waveformView.test.js/loopCreatorView.test.js's own fake-canvas
// convention for the draw kind.

test("nibblesGrid is declared as a specialized leaf with its own behavior, draw kind and ticks flag", () => {
    const entry = componentType("nibblesGrid");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(entry.ticks, true);
    assert.equal(behaviorOf("nibblesGrid"), "nibbles");
    assert.equal(drawKindOf("nibblesGrid"), "nibblesGrid");
    assert.equal(cursorOf("nibblesGrid"), "default");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/nibbles/index.js and the node's own rect, nothing authored");
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        strokeRect: (...a) => calls.push(["strokeRect", ...a]),
        beginPath: () => calls.push(["beginPath"]),
        moveTo: (...a) => calls.push(["moveTo", ...a]),
        lineTo: (...a) => calls.push(["lineTo", ...a]),
        stroke: () => calls.push(["stroke"]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); }
    };
}

const RECT = { x: 0, y: 0, width: 400, height: 150 };

beforeEach(() => {
    Nibbles.setWrap(false);
    Nibbles.setDifficulty(1);
    Nibbles.resetGame();
});

test("measure() returns a floor size matching the fixed grid at 10px/cell", () => {
    assert.deepEqual(drawKind("nibblesGrid").measure(), { width: 400, height: 150 });
});

test("draw() never throws before any game starts, mid-game, and while paused", () => {
    const before = fakeCtx();
    assert.doesNotThrow(() => drawKind("nibblesGrid").draw(before, null, null, RECT, "", {}));
    assert.ok(before.calls.some(c => c[0] === "fillRect"), "the background is filled");

    Nibbles.update();
    Nibbles.update();
    const mid = fakeCtx();
    assert.doesNotThrow(() => drawKind("nibblesGrid").draw(mid, null, null, RECT, "", {}));
    assert.ok(mid.calls.length > before.calls.length - 1, "at least the snake's own cells are drawn once the game has moved");

    Nibbles.pauseGame();
    const paused = fakeCtx();
    assert.doesNotThrow(() => drawKind("nibblesGrid").draw(paused, null, null, RECT, "", {}));
});

test("draw() dims the grid exactly once while the game is not playing", () => {
    Nibbles.pauseGame();
    const ctx = fakeCtx();
    drawKind("nibblesGrid").draw(ctx, null, null, RECT, "", {});
    const dimCalls = ctx.calls.filter(c => c[0] === "fillStyle" && c[1] === "rgba(0,0,0,0.3)");
    assert.equal(dimCalls.length, 1);
});

test("draw() never dims the grid while actively playing", () => {
    const ctx = fakeCtx();
    drawKind("nibblesGrid").draw(ctx, null, null, RECT, "", {});
    const dimCalls = ctx.calls.filter(c => c[0] === "fillStyle" && c[1] === "rgba(0,0,0,0.3)");
    assert.equal(dimCalls.length, 0);
});

test("draw() never throws on a rect too small to fit even one cell", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("nibblesGrid").draw(ctx, null, null, { x: 0, y: 0, width: 2, height: 1 }, "", {}));
});

// --- grid lines vs. a plain border (spec 049) -------------------------------

test("draw() draws grid lines when getShowGrid() is true (the default)", () => {
    assert.equal(Nibbles.getShowGrid(), true, "v1's own default");
    const ctx = fakeCtx();
    drawKind("nibblesGrid").draw(ctx, null, null, RECT, "", {});
    assert.ok(ctx.calls.some(c => c[0] === "moveTo"), "grid lines are plotted as a polyline");
    assert.ok(!ctx.calls.some(c => c[0] === "strokeRect"), "no plain border drawn at the same time");
});

test("draw() draws a plain border instead, when getShowGrid() is false", () => {
    Nibbles.setShowGrid(false);
    const ctx = fakeCtx();
    drawKind("nibblesGrid").draw(ctx, null, null, RECT, "", {});
    assert.ok(ctx.calls.some(c => c[0] === "strokeRect"), "a plain border is drawn");
    assert.ok(!ctx.calls.some(c => c[0] === "moveTo"), "no grid lines drawn at the same time");
    Nibbles.setShowGrid(true); // restore for any test running after this one
});
