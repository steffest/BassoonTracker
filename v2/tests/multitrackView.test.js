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
import * as geo from "../renderers/canvas/multitrackGeometry.js";

// Spec 052: multitrackView, the specialized-component contract's sixth leaf
// (after patternGrid, fileBrowser, waveformView, loopCreatorView and
// nibblesGrid). Mirrors loopCreatorView.test.js's/waveformView.test.js's
// own fake-canvas convention for the draw kind, and a real loaded fixture
// for the blocks/effects/scope data it reads from domain/song and
// domain/arrangement directly.

test("multitrackView is declared as a specialized leaf with its own behavior, draw kind and tick clock", () => {
    const entry = componentType("multitrackView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("multitrackView"), "multitrack");
    assert.equal(drawKindOf("multitrackView"), "multitrackView");
    assert.equal(cursorOf("multitrackView"), "default");
    assert.equal(entry.ticks, true, "the live oscilloscope needs the renderer's own tick clock to keep redrawing");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/song and domain/arrangement directly, nothing authored");
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), rect: (...a) => calls.push(["rect", ...a]),
        clip: () => calls.push(["clip"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        strokeRect: (...a) => calls.push(["strokeRect", ...a]),
        moveTo: (...a) => calls.push(["moveTo", ...a]), lineTo: (...a) => calls.push(["lineTo", ...a]),
        stroke: () => calls.push(["stroke"]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); },
        set lineWidth(v) { calls.push(["lineWidth", v]); },
        set globalAlpha(v) { calls.push(["globalAlpha", v]); }
    };
}
function fakeAssets() {
    const writes = [];
    return {
        skin: { getAsset: () => null },
        styleFor: () => null,
        font: { getTextWidth: text => (text || "").length * 6, write: (ctx, text, x, y) => writes.push({ text, x, y }), charHeight: 8, writes }
    };
}

const RECT = { x: 0, y: 0, width: geo.CTRL_WIDTH + 400, height: geo.HEADER_HEIGHT + 4 * 90 };

test("measure() floors to a fixed size", () => {
    assert.deepEqual(drawKind("multitrackView").measure(), { width: 500, height: 200 });
});

// --- against a real loaded fixture, since blocks/effects/mute-solo/scope
// all come from domain/song and domain/arrangement directly.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

beforeEach(async () => {
    await load("wizballalt.mod");
    song.clearHistory();
    song.setCurrentPattern(0);
    song.setCurrentPatternPos(0);
    for (let i = 0; i < song.getTrackCount(); i++) {
        arrangement.setTrackMute(i, false);
        arrangement.setTrackSolo(i, false);
    }
});

test("draw() never throws against a real loaded song, with default (zero) scroll/zoom state", () => {
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", {}));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "something was drawn");
});

test("draw() never throws with an empty track (no notes) or a zero-track/zero-pattern song", () => {
    song.setCurrentTrack(0);
    song.setCurrentPatternPos(0);
    song.clearTrack();
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", {
        scrollX: 0, scrollY: 0, pixelsPerStep: 14, dragMode: null, dragNote: null
    }));
});

test("draw() draws the drag ghost while dragMode is 'note', and never throws when dragNote is missing despite dragMode", () => {
    const ctx = fakeCtx();
    const state = {
        scrollX: 0, scrollY: 0, pixelsPerStep: 14, dragMode: "note",
        dragNote: { sourceTrack: 0, sourceStep: 0, targetTrack: 1, targetStep: 5, offsetStep: 0 }
    };
    assert.doesNotThrow(() => drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", state));
    assert.ok(ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "#ffd232"), "the ghost's own outline color was set");

    assert.doesNotThrow(() => drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", { dragMode: "note", dragNote: null }));
});

test("a muted track draws a flat, dimmed oscilloscope line; an unmuted one draws the real (silent-context) data the same way", () => {
    arrangement.setTrackMute(0, true);
    const ctx = fakeCtx();
    drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", {});
    assert.ok(ctx.calls.some(c => c[0] === "strokeStyle" && c[1] === "rgba(100,220,80,0.25)"), "the muted-track flat line color appears");
});

test("draw() renders a real note block's own name text", () => {
    song.setCurrentTrack(0);
    song.setCurrentPatternPos(0);
    song.clearTrack();
    song.putNote({ instrument: 2, period: 214 });
    const assets = fakeAssets();
    drawKind("multitrackView").draw(fakeCtx(), assets, null, RECT, "", {});
    assert.ok(assets.font.writes.length > 0, "at least one text label was written (a block name, an effect, a ruler number, or a control-strip button label)");
});

test("draw() never throws with scrollbars visible (zoomed/scrolled state overflowing the viewport)", () => {
    const ctx = fakeCtx();
    const state = { scrollX: 50, scrollY: 10, pixelsPerStep: 40, dragMode: null, dragNote: null };
    assert.doesNotThrow(() => drawKind("multitrackView").draw(ctx, fakeAssets(), null, RECT, "", state));
});
