import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";

// Spec 054: volumeMeter, the specialized-component contract's seventh leaf
// (after patternGrid, fileBrowser, waveformView, loopCreatorView,
// nibblesGrid and multitrackView). Mirrors nibblesGridView.test.js's/
// multitrackView.test.js's own fake-canvas convention.

test("volumeMeter is declared as a specialized leaf with its own behavior, draw kind and tick clock", () => {
    const entry = componentType("volumeMeter");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("volumeMeter"), "vuMeter");
    assert.equal(drawKindOf("volumeMeter"), "volumeMeter");
    assert.equal(cursorOf("volumeMeter"), "default");
    assert.equal(entry.ticks, true);
    assert.deepEqual(entry.properties, {}, "everything comes from domain/playback directly, nothing authored");
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 } };
}

const RECT = { x: 0, y: 0, width: 160, height: 16 };

test("measure() floors to a fixed size", () => {
    assert.deepEqual(drawKind("volumeMeter").measure(), { width: 160, height: 16 });
});

test("draw() never throws, and every dot is unlit when the underlying data is silence", () => {
    // Node's own top-level before() runs ahead of every test in this file
    // regardless of declaration order, so a real engine/connection already
    // exists by this point - but the silent context's own
    // getByteTimeDomainData stub always fills exactly 128 (silence)
    // regardless of connection state, so dynamicRange is 0 and every dot
    // stays unlit either way. This is what is actually being verified here
    // - not "no connection", which this headless environment cannot
    // distinguish visually from "connected but silent" at all.
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("volumeMeter").draw(ctx, fakeAssets(), null, RECT, ""));
    const fills = ctx.calls.filter(c => c[0] === "fillStyle");
    assert.ok(fills.length > 0, "dots were still drawn, just unlit");
    assert.ok(fills.every(c => c[1].includes(",0.25)")), "every dot is at the unlit alpha");
});

// --- against a real loaded fixture, once a connection exists ---------------

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
});

test("draw() never throws with a real loaded song, and draws two rows of dots", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("volumeMeter").draw(ctx, fakeAssets(), null, RECT, ""));
    const rects = ctx.calls.filter(c => c[0] === "fillRect");
    // Two rows, each with the same dot count for this width.
    const dots = new Set(rects.map(r => r[1])).size; // distinct x positions
    assert.ok(dots > 0);
    assert.equal(rects.length, dots * 2, "each dot column appears once per row");
});

test("draw() colors dots by zone - green/yellow/red all appear across a full-width strip", () => {
    const ctx = fakeCtx();
    drawKind("volumeMeter").draw(ctx, fakeAssets(), null, RECT, "");
    const colors = ctx.calls.filter(c => c[0] === "fillStyle").map(c => c[1]);
    assert.ok(colors.some(c => c.startsWith("rgba(70,200,90")), "green appears");
    assert.ok(colors.some(c => c.startsWith("rgba(210,190,60")), "yellow appears");
    assert.ok(colors.some(c => c.startsWith("rgba(200,60,60")), "red appears");
});
