import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";

// Spec 058: scopesView, the specialized-component contract's ninth leaf
// (after patternGrid, fileBrowser, waveformView, loopCreatorView,
// nibblesGrid, multitrackView, volumeMeter and envelopeView). Mirrors
// volumeMeterView.test.js's/multitrackView.test.js's own fake-canvas
// convention.

test("scopesView is declared as a specialized leaf with its own behavior, draw kind and tick clock", () => {
    const entry = componentType("scopesView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("scopesView"), "scopes");
    assert.equal(drawKindOf("scopesView"), "scopesView");
    assert.equal(cursorOf("scopesView"), "default");
    assert.equal(entry.ticks, true);
    assert.deepEqual(entry.properties, {}, "everything comes from domain/song/domain/arrangement directly, nothing authored");
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]),
        moveTo: (...a) => calls.push(["moveTo", ...a]), lineTo: (...a) => calls.push(["lineTo", ...a]),
        stroke: () => calls.push(["stroke"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); },
        set lineWidth(v) { calls.push(["lineWidth", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 } };
}

const RECT = { x: 0, y: 0, width: 400, height: 80 };

test("measure() floors to a fixed size", () => {
    assert.deepEqual(drawKind("scopesView").measure(), { width: 320, height: 80 });
});

test("draw() never throws with zero tracks (no engine loaded at all in this file yet)", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("scopesView").draw(ctx, fakeAssets(), null, RECT));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "the background was still drawn");
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

beforeEach(async () => {
    const data = readFileSync(join(FIXTURES, "wizballalt.mod"));
    const buffer = new Uint8Array(data).buffer;
    await Tracker.processFile(buffer, "wizballalt.mod");
    for (let i = 0; i < song.getTrackCount(); i++) {
        arrangement.setTrackMute(i, false);
        arrangement.setTrackSolo(i, false);
    }
});

test("draw() never throws with a real loaded song, drawing one scope per track", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("scopesView").draw(ctx, fakeAssets(), null, RECT));
    const strokes = ctx.calls.filter(c => c[0] === "stroke").length;
    assert.equal(strokes, song.getTrackCount());
});

test("draw() draws a flat, dimmed line for a muted track, and a live trace for the rest", () => {
    arrangement.setTrackMute(1, true);
    const ctx = fakeCtx();
    drawKind("scopesView").draw(ctx, fakeAssets(), null, RECT);
    assert.ok(ctx.calls.some(c => c[0] === "fillStyle" && c[1] === "rgba(34,49,85,0.5)"), "the muted-track dim overlay appears");
    // exactly one dim overlay fillRect beyond the initial background fill
    const dimFills = ctx.calls.filter(c => c[0] === "fillRect");
    assert.equal(dimFills.length, 2, "one background fill + one muted-track overlay");
});
