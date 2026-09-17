import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, previewNoteOn, previewNoteOff, reset } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import { keyRectsFor } from "../renderers/canvas/pianoGeometry.js";

// Spec 061: pianoView, the specialized-component contract's tenth leaf
// (after patternGrid, fileBrowser, waveformView, loopCreatorView,
// nibblesGrid, multitrackView, volumeMeter, envelopeView and scopesView).
// Mirrors scopesView.test.js's own fake-canvas convention.

test("pianoView is declared as a specialized leaf with its own behavior and draw kind", () => {
    const entry = componentType("pianoView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("pianoView"), "piano");
    assert.equal(drawKindOf("pianoView"), "pianoView");
    assert.equal(cursorOf("pianoView"), "default");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/song/domain/playback directly, nothing authored");
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        strokeRect: (...a) => calls.push(["strokeRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 } };
}

const RECT = { x: 0, y: 0, width: 500, height: 150 };

test("measure() returns a fixed default size", () => {
    assert.deepEqual(drawKind("pianoView").measure(), { width: 480, height: 150 });
});

test("draw() never throws with no engine loaded at all in this file yet", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("pianoView").draw(ctx, fakeAssets(), null, RECT));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "the background was still drawn");
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
let Tracker;
let app;

before(() => {
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
});

beforeEach(async () => {
    reset();
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
    app = { audioContext: context, state: { get: () => undefined, set: () => {} }, log: () => {} };
    const data = readFileSync(join(FIXTURES, "wizballalt.mod"));
    await Tracker.processFile(new Uint8Array(data).buffer, "wizballalt.mod");
    song.setCurrentInstrumentIndex(1);
});

test("draw() draws every white/black key, highlighting exactly the ones isPreviewNoteActive reports", () => {
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const heldIndex = white[0].index;
    previewNoteOn(heldIndex, app);

    const ctx = fakeCtx();
    drawKind("pianoView").draw(ctx, fakeAssets(), null, RECT);

    const fills = ctx.calls.filter(c => c[0] === "fillStyle").map(c => c[1]);
    assert.ok(fills.includes("#8fd0ff"), "the held white key's own highlight color appears");
    // exactly one white key highlighted (the rest use the plain color)
    const plainWhiteFills = fills.filter(v => v === "#f4f6f8").length;
    const { white: allWhite } = keyRectsFor(RECT, song.getCurrentOctave());
    assert.equal(plainWhiteFills, allWhite.length - 1);

    previewNoteOff(heldIndex);
});
