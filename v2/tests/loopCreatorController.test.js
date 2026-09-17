import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as loopCreator from "../domain/sampleEditor/loopCreator.js";
import { createLoopCreatorController } from "../runtime/loopCreatorController.js";
import { sampleIndexToPixel } from "../renderers/canvas/waveformGeometry.js";

// Spec 044: the "loopCreator" behavior. Exercised against small,
// hand-computable synthetic instrument objects - the same convention
// tests/loopCreator.test.js (spec 043) already uses for its own state/DSP
// tests, since exact drag-delta/snap-to-zero numbers matter here too.

const RECT = { x: 0, y: 0, width: 220, height: 60 };

// A clean slate before every test - loopCreator.js's module state is a
// singleton across the whole file (matches tests/loopCreator.test.js's own
// convention).
beforeEach(() => {
    loopCreator.cancelLoopCreator();
});

function openWith(dataLength, loop) {
    const data = new Array(dataLength).fill(0).map((_, i) => Math.sin(i) * 0.3);
    const instrument = { sample: { data, length: dataLength, loop: { enabled: loop.enabled, start: loop.start, length: loop.length } } };
    loopCreator.openLoopCreator(instrument);
    return instrument;
}

function pixel(controller, sampleIndex) {
    const s = controller.state;
    return sampleIndexToPixel(RECT, sampleIndex, s.zoomStart, s.zoomLength);
}

function drag(controller, fromX, toX, y = 30) {
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: fromX, y }, local: { x: fromX - RECT.x, y: y - RECT.y } });
    controller.handle({ type: "drag", rect: RECT, point: { x: toX, y }, local: { x: toX - RECT.x, y: y - RECT.y } });
    controller.handle({ type: "pointerup" });
}

test("the zoom window seeds to the whole sample on first use", () => {
    openWith(220, { enabled: true, start: 50, length: 60 });
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.zoomStart, 0);
    assert.equal(controller.state.zoomLength, 220);
});

// loop [50, 110); tail region [50,70) - handle at 70; head region
// [95,110) - handle at 95; loopEnd region [40,50) - handle at 40. dataLen
// equals RECT.width (220), so a sample index equals its own pixel x - every
// drag delta below is hand-derivable.
function openStandard() {
    openWith(220, { enabled: true, start: 50, length: 60 });
    loopCreator.setTailSize(20);
    loopCreator.setHeadSize(15);
    loopCreator.setLoopEndSize(10);
    loopCreator.setBlendTail(0.5);
    loopCreator.setBlendHead(0.5);
    loopCreator.setBlendLoopEnd(0.5);
    loopCreator.setOrigBlendTail(1);
    loopCreator.setOrigBlendHead(1);
    loopCreator.setOrigBlendLoopEnd(1);
}

test("dragging a loop marker moves it by the drag's own delta, reporting handled and the target under drag", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });

    const down = controller.handle({ type: "pointerdown", rect: RECT, point: { x: 50, y: 55 }, local: { x: 50, y: 55 } });
    assert.equal(down.handled, true);
    assert.equal(controller.state.dragging, "markerStart");
    controller.handle({ type: "drag", rect: RECT, point: { x: 60, y: 55 }, local: { x: 60, y: 55 } });
    const up = controller.handle({ type: "pointerup" });
    assert.equal(up.handled, true);
    assert.equal(controller.state.dragging, null);

    const s = loopCreator.getLoopCreatorState();
    assert.equal(s.loopStart, 60, "moved by the +10 drag delta");
    assert.equal(s.loopEnd, 110, "the other marker untouched");
});

test("dragging the end marker moves it by the drag's own delta", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    drag(controller, 110, 100, 55);
    const s = loopCreator.getLoopCreatorState();
    assert.equal(s.loopEnd, 100, "moved by the -10 drag delta");
    assert.equal(s.loopStart, 50, "the other marker untouched");
});

test("dragging the tail size handle grows/shrinks tailSize by the drag's own delta", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    drag(controller, 70, 80, 30); // handle at loopStart+tailSize = 70
    assert.equal(loopCreator.getLoopCreatorState().tailSize, 30);
});

test("dragging the head size handle grows/shrinks headSize by the drag's own inverted delta", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    drag(controller, 95, 85, 30); // handle at loopEnd-headSize = 95; dx=-10 -> headSize grows
    assert.equal(loopCreator.getLoopCreatorState().headSize, 25);
});

test("dragging the loopEnd size handle grows/shrinks loopEndSize by the drag's own inverted delta", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    drag(controller, 40, 30, 30); // handle at loopStart-loopEndSize = 40; dx=-10 -> loopEndSize grows
    assert.equal(loopCreator.getLoopCreatorState().loopEndSize, 20);
});

test("dragging the blendTail line moves blendTail vertically, inverted (up increases)", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 60, y: 30 }, local: { x: 60, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 60, y: 22 }, local: { x: 60, y: 22 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().blendTail - 0.7) < 1e-9);
});

test("dragging the blendHead line moves blendHead vertically, inverted", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 100, y: 30 }, local: { x: 100, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 100, y: 22 }, local: { x: 100, y: 22 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().blendHead - 0.7) < 1e-9);
});

test("dragging the blendLoopEnd line moves blendLoopEnd vertically, inverted", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 45, y: 30 }, local: { x: 45, y: 30 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 45, y: 22 }, local: { x: 45, y: 22 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().blendLoopEnd - 0.7) < 1e-9);
});

test("dragging the origTail line moves origBlendTail vertically, inverted", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });

    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 60, y: 10 }, local: { x: 60, y: 10 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 60, y: 18 }, local: { x: 60, y: 18 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().origBlendTail - 0.8) < 1e-9);
});

test("dragging the origHead line moves origBlendHead vertically, inverted", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 100, y: 10 }, local: { x: 100, y: 10 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 100, y: 18 }, local: { x: 100, y: 18 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().origBlendHead - 0.8) < 1e-9);
});

test("dragging the origLoopEnd line moves origBlendLoopEnd vertically, inverted", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 45, y: 10 }, local: { x: 45, y: 10 } });
    controller.handle({ type: "drag", rect: RECT, point: { x: 45, y: 18 }, local: { x: 45, y: 18 } });
    controller.handle({ type: "pointerup" });
    assert.ok(Math.abs(loopCreator.getLoopCreatorState().origBlendLoopEnd - 0.8) < 1e-9);
});

test("a pointerdown well away from every target is not handled and starts no drag", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    const down = controller.handle({ type: "pointerdown", rect: RECT, point: { x: 150, y: 50 }, local: { x: 150, y: 50 } });
    assert.equal(down.handled, false);
    assert.equal(controller.state.dragging, null);
});

// --- marker drags and snapToZero (spec 043's own asymmetry: only a drag
// honors it, never the plain setters - see requirements.md) --------------

test("a marker drag honors snapToZero, landing on the nearest zero crossing rather than the raw dragged position", () => {
    const dataLen = 220;
    const data = new Array(dataLen).fill(0).map((_, i) => (i < 60 ? 0.3 : -0.3)); // one crossing, at 60
    const instrument = { sample: { data, length: dataLen, loop: { enabled: true, start: 50, length: 60 } } };
    loopCreator.openLoopCreator(instrument);
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });

    const rawTarget = 55;
    const expectedSnapped = loopCreator.nearestZeroCrossing(rawTarget);
    assert.notEqual(expectedSnapped, rawTarget & ~1, "the fixture really does have a nearby crossing worth snapping to");

    loopCreator.setSnapToZero(true);
    drag(controller, pixel(controller, 50), pixel(controller, rawTarget), 55);
    assert.equal(loopCreator.getLoopCreatorState().loopStart, expectedSnapped);
});

test("a marker drag ignores snapToZero when it is off, landing on the raw dragged position (even-aligned)", () => {
    const dataLen = 220;
    const data = new Array(dataLen).fill(0).map((_, i) => (i < 60 ? 0.3 : -0.3));
    const instrument = { sample: { data, length: dataLen, loop: { enabled: true, start: 50, length: 60 } } };
    loopCreator.openLoopCreator(instrument);
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });

    const rawTarget = 55;
    drag(controller, pixel(controller, 50), pixel(controller, rawTarget), 55); // snapToZero defaults false
    assert.equal(loopCreator.getLoopCreatorState().loopStart, rawTarget & ~1);
});

// --- wheel pan/zoom, mirroring waveformController.test.js's own tests ----

test("wheel pans the zoom window and clamps at both ends", () => {
    openWith(220, { enabled: true, start: 50, length: 60 });
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "wheel", deltaY: -1, ctrlKey: true }); // zoom in first, so there's room to pan
    assert.ok(controller.state.zoomLength < 220);

    controller.handle({ type: "wheel", deltaY: 1 });
    assert.ok(controller.state.zoomStart > 0);

    for (let i = 0; i < 100; i++) controller.handle({ type: "wheel", deltaY: 1 });
    assert.equal(controller.state.zoomStart, 220 - controller.state.zoomLength);

    for (let i = 0; i < 100; i++) controller.handle({ type: "wheel", deltaY: -1 });
    assert.equal(controller.state.zoomStart, 0);
});

test("ctrl+wheel zooms in and out, clamped at the minimum and the full length", () => {
    openWith(220, { enabled: true, start: 50, length: 60 });
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    const result = controller.handle({ type: "wheel", deltaY: -1, ctrlKey: true });
    assert.equal(result.handled, true);
    assert.ok(controller.state.zoomLength < 220);

    for (let i = 0; i < 50; i++) controller.handle({ type: "wheel", deltaY: 1, ctrlKey: true });
    assert.equal(controller.state.zoomLength, 220);
});

// --- disabled ---------------------------------------------------------------

test("disabled blocks pointerdown and makes wheel a no-op", () => {
    openStandard();
    const controller = createLoopCreatorController({ disabled: true });
    controller.handle({ type: "pointerenter" });
    const down = controller.handle({ type: "pointerdown", rect: RECT, point: { x: 70, y: 30 }, local: { x: 70, y: 30 } });
    assert.equal(down.blocked, "disabled");
    const zoomStartBefore = controller.state.zoomStart;
    const wheel = controller.handle({ type: "wheel", deltaY: 1 });
    assert.equal(wheel.handled, false);
    assert.equal(controller.state.zoomStart, zoomStartBefore);
});

test("blur clears any in-progress drag anchor", () => {
    openStandard();
    const controller = createLoopCreatorController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", rect: RECT, point: { x: 70, y: 30 }, local: { x: 70, y: 30 } });
    controller.handle({ type: "blur" });
    assert.equal(controller.state.dragging, null);
    const before = loopCreator.getLoopCreatorState().tailSize;
    controller.handle({ type: "drag", rect: RECT, point: { x: 90, y: 30 }, local: { x: 90, y: 30 } });
    assert.equal(loopCreator.getLoopCreatorState().tailSize, before, "no drag anchor left to act on");
});
