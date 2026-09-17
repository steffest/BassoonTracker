import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as SampleEditor from "../domain/sampleEditor/index.js";

// Spec 041: waveformView, the specialized-component contract's third leaf
// (after patternGrid and fileBrowser). Mirrors patternGrid.test.js's own
// fake-canvas convention for the draw kind.

test("waveformView is declared as a specialized leaf with its own behavior and draw kind", () => {
    const entry = componentType("waveformView");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(behaviorOf("waveformView"), "waveform");
    assert.equal(drawKindOf("waveformView"), "waveformView");
    assert.equal(cursorOf("waveformView"), "default");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/song, domain/sampleEditor, and the node's own rect, nothing authored");
});

// --- the draw kind itself, against a real loaded song and fake canvas -----

let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

beforeEach(async () => {
    await load("wizballalt.mod");
    SampleEditor.resetSampleSelection();
});

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]),
        moveTo: (...a) => calls.push(["moveTo", ...a]), lineTo: (...a) => calls.push(["lineTo", ...a]),
        stroke: () => calls.push(["stroke"]), fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); }
    };
}

const RECT = { x: 0, y: 0, width: 100, height: 60 };

test("measure() floors to a fixed size, unaffected by the loaded song", () => {
    assert.deepEqual(drawKind("waveformView").measure(), { width: 300, height: 140 });
});

test("draw() never throws with no current instrument", () => {
    Tracker.setCurrentInstrumentIndex(0); // instrument 0: v1's own "no instrument selected" sentinel
    assert.doesNotThrow(() => drawKind("waveformView").draw(fakeCtx(), null, null, RECT, "", {}));
});

test("draw() never throws, and draws the waveform line, for an instrument with sample data", () => {
    const instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length > 0);
    assert.ok(instrumentIndex > 0);
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
    const sampleLength = Tracker.getInstruments()[instrumentIndex].sample.length;

    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawKind("waveformView").draw(ctx, null, null, RECT, "", { zoomStart: 0, zoomLength: sampleLength }));
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "the background is filled");
    assert.ok(ctx.calls.filter(c => c[0] === "moveTo").length >= 4, "3 guide lines plus the waveform's own polyline each start with a moveTo");
});

test("draw() draws a selection tint when a selection exists, and skips it otherwise", () => {
    const instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 64);
    assert.ok(instrumentIndex > 0);
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
    const sampleLength = Tracker.getInstruments()[instrumentIndex].sample.length;
    const state = { zoomStart: 0, zoomLength: sampleLength };

    const noSelection = fakeCtx();
    drawKind("waveformView").draw(noSelection, null, null, RECT, "", state);
    const tintCalls = noSelection.calls.filter(c => c[0] === "fillStyle" && String(c[1]).includes("110,150,230"));
    assert.equal(tintCalls.length, 0, "no selection tint drawn without a selection");

    SampleEditor.setSampleSelection(10, 20);
    const withSelection = fakeCtx();
    drawKind("waveformView").draw(withSelection, null, null, RECT, "", state);
    const tinted = withSelection.calls.filter(c => c[0] === "fillStyle" && String(c[1]).includes("110,150,230"));
    assert.equal(tinted.length, 1, "the selection tint is drawn exactly once");
});

test("draw() never throws for a selection entirely outside the current zoom window", () => {
    const instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 64);
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
    const sampleLength = Tracker.getInstruments()[instrumentIndex].sample.length;
    SampleEditor.setSampleSelection(0, 4); // a tiny selection at the very start
    const zoomedAway = { zoomStart: Math.max(0, sampleLength - 10), zoomLength: Math.min(10, sampleLength) };
    assert.doesNotThrow(() => drawKind("waveformView").draw(fakeCtx(), null, null, RECT, "", zoomedAway));
});
