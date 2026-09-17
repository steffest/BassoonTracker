import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";

// Spec 056: envelopeView, the specialized-component contract's eighth leaf
// (after patternGrid, fileBrowser, waveformView, loopCreatorView,
// nibblesGrid, multitrackView and volumeMeter). Mirrors
// loopCreatorView.test.js's/multitrackView.test.js's own fake-canvas
// convention for the draw kind.

test("envelopeView is declared as a specialized leaf with its own behavior, draw kind and envelopeType property", () => {
    const entry = componentType("envelopeView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("envelopeView"), "envelope");
    assert.equal(drawKindOf("envelopeView"), "envelopeView");
    assert.equal(cursorOf("envelopeView"), "default");
    assert.ok(entry.properties.envelopeType, "the one authored property this leaf needs");
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
        set lineWidth(v) { calls.push(["lineWidth", v]); },
        setLineDash: (...a) => calls.push(["setLineDash", ...a])
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 } };
}

const RECT = { x: 0, y: 0, width: 324, height: 64 };

test("measure() floors to the fixed 324x64 logical size", () => {
    assert.deepEqual(drawKind("envelopeView").measure(), { width: 324, height: 64 });
});

test("draw() never throws with no instrument at all - background only", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("envelopeView").draw(ctx, fakeAssets(), null, RECT, "", { envelopeType: "volume" }));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "the background was still drawn");
    assert.ok(!ctx.calls.some(c => c[0] === "stroke"), "no points to connect with no instrument");
});

test("draw() draws the panning-only reference line, and only for that variant", () => {
    const ctxPanning = fakeCtx();
    drawKind("envelopeView").draw(ctxPanning, fakeAssets(), null, RECT, "", { envelopeType: "panning" });
    assert.ok(ctxPanning.calls.some(c => c[0] === "strokeStyle" && c[1] === "#4a7c92"), "the panning reference line's own color appears");

    const ctxVolume = fakeCtx();
    drawKind("envelopeView").draw(ctxVolume, fakeAssets(), null, RECT, "", { envelopeType: "volume" });
    assert.ok(!ctxVolume.calls.some(c => c[0] === "strokeStyle" && c[1] === "#4a7c92"), "the volume variant never draws it");
});

// --- against a real loaded fixture, once a real enabled envelope exists ----

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

test("draw() never throws with a real enabled envelope (sustain, no loop), and draws its own points/line", async () => {
    const data = readFileSync(join(FIXTURES, "sin.xm"));
    const buffer = new Uint8Array(data).buffer;
    await Tracker.processFile(buffer, "sin.xm");
    song.setCurrentInstrumentIndex(1);

    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("envelopeView").draw(ctx, fakeAssets(), null, RECT, "", { envelopeType: "volume", activeIndex: 1 }));
    assert.ok(ctx.calls.some(c => c[0] === "stroke"), "the connecting line was drawn");
    assert.ok(ctx.calls.some(c => c[0] === "fillStyle" && c[1] === "#FFFFFF"), "the active point (index 1) is drawn white");
    assert.ok(ctx.calls.some(c => c[0] === "fillStyle" && c[1] === "#D2861B"), "an ordinary enabled point is drawn orange");
    assert.ok(ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "#67b6d2"), "the sustain line's own color appears - this fixture's own volume envelope has sustain");
    assert.ok(!ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "#d2b637"), "no loop line - this fixture's own volume envelope has no loop");
});

test("draw() never throws with a real disabled envelope, and draws muted points with no sustain/loop lines", async () => {
    // sin.xm's own instrument 1 panning envelope is disabled, with no sustain/loop flags set at all.
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("envelopeView").draw(ctx, fakeAssets(), null, RECT, "", { envelopeType: "panning", activeIndex: -1 }));
    assert.ok(ctx.calls.some(c => c[0] === "fillStyle" && c[1] === "#546888"), "a disabled point is drawn muted blue-grey");
    assert.ok(!ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "#67b6d2"), "no sustain line on a disabled envelope");
    assert.ok(!ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "#d2b637"), "no loop line on a disabled envelope");
});
