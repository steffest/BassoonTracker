import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as SampleEditor from "../domain/sampleEditor/index.js";
import { createWaveformController } from "../runtime/waveformController.js";
import { MIN_ZOOM_LENGTH, sampleIndexToPixel } from "../renderers/canvas/waveformGeometry.js";

// Spec 041: the "waveform" behavior. Exercised against a real loaded
// fixture, the same convention tests/gridController.test.js/
// tests/sampleEditor.test.js already use, since this controller reads
// domain/song/domain/sampleEditor directly rather than synthetic input alone.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

let Tracker;
let instrumentIndex;
let sampleLength;

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
    SampleEditor.resetSampleSelection();

    instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 64);
    assert.ok(instrumentIndex > 0, "fixture has at least one instrument with enough sample data");
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
    sampleLength = Tracker.getInstruments()[instrumentIndex].sample.length;
});

const RECT = { x: 0, y: 0, width: 100, height: 60 };

test("the zoom window seeds to the whole sample on first use", () => {
    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.zoomStart, 0);
    assert.equal(controller.state.zoomLength, sampleLength);
});

test("a plain drag over empty space creates a new, correctly-normalized selection", () => {
    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" }); // seeds the zoom window

    // click at pixel 60 (further right), drag left to pixel 20 - a backwards drag
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 60, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 20, y: 30 } });
    controller.handle({ type: "pointerup" });

    const selection = SampleEditor.getSampleSelection();
    assert.ok(selection.length > 0);
    assert.ok(selection.start < selection.start + selection.length, "start comes before end regardless of drag direction");
});

test("dragging an existing selection's start edge resizes it without moving the end", () => {
    const step = sampleLength / RECT.width;
    SampleEditor.setSampleSelection(Math.round(20 * step), Math.round(30 * step));
    const originalEnd = SampleEditor.getSampleSelection().start + SampleEditor.getSampleSelection().length;

    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    const startPixel = sampleIndexToPixel(RECT, SampleEditor.getSampleSelection().start, 0, sampleLength);
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: startPixel, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: startPixel - 10, y: 30 } }); // drag the start edge further left
    controller.handle({ type: "pointerup" });

    const resized = SampleEditor.getSampleSelection();
    assert.ok(resized.start < Math.round(20 * step), "start moved");
    assert.equal(resized.start + resized.length, originalEnd, "end untouched");
});

test("dragging an existing selection's end edge resizes it without moving the start", () => {
    const step = sampleLength / RECT.width;
    SampleEditor.setSampleSelection(Math.round(20 * step), Math.round(30 * step));
    const originalStart = SampleEditor.getSampleSelection().start;

    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    const endPixel = sampleIndexToPixel(RECT, originalStart + SampleEditor.getSampleSelection().length, 0, sampleLength);
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: endPixel, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: endPixel + 10, y: 30 } });
    controller.handle({ type: "pointerup" });

    const resized = SampleEditor.getSampleSelection();
    assert.equal(resized.start, originalStart, "start untouched");
    assert.ok(resized.start + resized.length > originalStart + Math.round(30 * step), "end moved further right");
});

test("resizing an edge never crosses the other one - at least 2 samples of range remain", () => {
    const step = sampleLength / RECT.width;
    SampleEditor.setSampleSelection(Math.round(20 * step), Math.round(30 * step));
    const selection = SampleEditor.getSampleSelection();

    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    const startPixel = sampleIndexToPixel(RECT, selection.start, 0, sampleLength);
    const farRightPixel = sampleIndexToPixel(RECT, selection.start + selection.length + 1000, 0, sampleLength);
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: startPixel, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: farRightPixel, y: 30 } }); // drag start way past end
    controller.handle({ type: "pointerup" });

    const resized = SampleEditor.getSampleSelection();
    assert.ok(resized.length >= 2);
});

test("wheel pans the zoom window and clamps at both ends", () => {
    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "wheel", deltaY: -1, ctrlKey: true }); // zoom in first, so there's room to pan
    assert.ok(controller.state.zoomLength < sampleLength);

    controller.handle({ type: "wheel", deltaY: 1 }); // pan right
    assert.ok(controller.state.zoomStart > 0);

    for (let i = 0; i < 100; i++) controller.handle({ type: "wheel", deltaY: 1 }); // pan hard right, past the end
    assert.equal(controller.state.zoomStart, sampleLength - controller.state.zoomLength);

    for (let i = 0; i < 100; i++) controller.handle({ type: "wheel", deltaY: -1 }); // pan hard left, past the start
    assert.equal(controller.state.zoomStart, 0);
});

test("ctrl+wheel zooms in and out, clamped at the minimum and the full sample length", () => {
    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    const result = controller.handle({ type: "wheel", deltaY: -1, ctrlKey: true }); // zoom in
    assert.equal(result.handled, true);
    assert.ok(controller.state.zoomLength < sampleLength);

    for (let i = 0; i < 50; i++) controller.handle({ type: "wheel", deltaY: -1, ctrlKey: true });
    assert.ok(controller.state.zoomLength >= MIN_ZOOM_LENGTH);

    for (let i = 0; i < 50; i++) controller.handle({ type: "wheel", deltaY: 1, ctrlKey: true });
    assert.equal(controller.state.zoomLength, sampleLength);
});

test("disabled blocks selection dragging and wheel alike", () => {
    const controller = createWaveformController({ disabled: true });
    controller.handle({ type: "pointerenter" });
    const down = controller.handle({ type: "pointerdown", rect: RECT, point: { x: 50, y: 30 } });
    assert.equal(down.blocked, "disabled");
    const zoomStartBefore = controller.state.zoomStart;
    const wheel = controller.handle({ type: "wheel", deltaY: 1 });
    assert.equal(wheel.handled, false);
    assert.equal(controller.state.zoomStart, zoomStartBefore, "wheel is a no-op while disabled");
});

test("blur clears any in-progress drag anchor", () => {
    const controller = createWaveformController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 50, y: 30 } });
    controller.handle({ type: "blur" });
    const before = SampleEditor.getSampleSelection();
    controller.handle({ type: "drag", rect: RECT, point: { x: 10, y: 30 } });
    assert.deepEqual(SampleEditor.getSampleSelection(), before, "no drag anchor left to act on");
});
