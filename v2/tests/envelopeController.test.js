import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as envelope from "../domain/sampleEditor/envelope.js";
import { createEnvelopeController } from "../runtime/envelopeController.js";
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, toPixel } from "../renderers/canvas/envelopeGeometry.js";

// Spec 056: the "envelope" behavior. Exercised against a real loaded .xm
// fixture's own real envelope (sin.xm's instrument 1: volume enabled with
// points [[0,48],[4,64],[8,44],[14,8],[24,22],[32,8],...], panning disabled),
// the same convention every other specialized-leaf controller test uses.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const RECT = { x: 0, y: 0, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }; // 1:1 logical:pixel

let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

async function loadWithEnabledVolumeEnvelope() {
    const data = readFileSync(join(FIXTURES, "sin.xm"));
    const buffer = new Uint8Array(data).buffer;
    await Tracker.processFile(buffer, "sin.xm");
    song.setCurrentInstrumentIndex(1);
}

function point(local) {
    return { x: RECT.x + local.x, y: RECT.y + local.y };
}

/** local pixel coordinates for a real envelope point, at RECT's own 1:1 scale (y flipped). */
function localFor(pointArr) {
    const px = toPixel(pointArr, RECT);
    return { x: px.x, y: px.y };
}

test("pointerenter/leave and focus/blur set hover/focused, and leaving clears the active index", () => {
    const controller = createEnvelopeController();
    controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.hover, true);
    controller.handle({ type: "focus" });
    assert.equal(controller.state.focused, true);

    controller.handle({ type: "pointerleave" });
    assert.equal(controller.state.hover, false);
    assert.equal(controller.state.activeIndex, -1);
});

test("createEnvelopeController defaults envelopeType to \"volume\", and honors an explicit \"panning\"", () => {
    assert.equal(createEnvelopeController().state.envelopeType, "volume");
    assert.equal(createEnvelopeController({ envelopeType: "panning" }).state.envelopeType, "panning");
    assert.equal(createEnvelopeController({ envelopeType: "something else" }).state.envelopeType, "volume", "anything but \"panning\" falls back to \"volume\"");
});

test("pointermove finds the nearest real point on an enabled envelope", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const local = localFor([4, 64]); // envelope point index 1
    controller.handle({ type: "pointermove", rect: RECT, point: point(local), local });
    assert.equal(controller.state.activeIndex, 1);
});

test("pointermove never finds a point on a disabled envelope", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "panning" }); // this fixture's own panning envelope is disabled
    const local = localFor([0, 32]); // its own point 0
    controller.handle({ type: "pointermove", rect: RECT, point: point(local), local });
    assert.equal(controller.state.activeIndex, -1);
});

test("pointermove does not update the active index while already dragging", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const p1 = localFor([4, 64]);
    controller.handle({ type: "pointerdown", rect: RECT, point: point(p1), local: p1 });
    assert.equal(controller.state.activeIndex, 1);
    assert.equal(controller.state.dragging, true);

    const p2 = localFor([8, 44]); // a different real point
    controller.handle({ type: "pointermove", rect: RECT, point: point(p2), local: p2 });
    assert.equal(controller.state.activeIndex, 1, "frozen at the point the drag started on");
});

test("pointerdown with no preceding hover still finds its own point (a synthetic-input robustness addition)", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const local = localFor([8, 44]); // point index 2
    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(controller.state.activeIndex, 2);
    assert.equal(result.handled, true);
});

test("pointerdown on empty space (no nearby point) does not start a drag", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const local = localFor([200, 32]);
    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(controller.state.dragging, false);
    assert.equal(result.handled, false);
});

test("dragging the active point moves it by the pointer's own relative delta, clamped by setPoint", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });

    const down = localFor([4, 64]); // point index 1: neighbors are [0,48] and [8,44] -> x clamps to [0,8]
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    assert.equal(controller.state.activeIndex, 1);

    const dragTo = { x: down.x + 10, y: down.y + 5 }; // +10 logical x (clamped to 8), -5 logical y (64 -> 59)
    controller.handle({ type: "drag", rect: RECT, point: point(dragTo), local: dragTo });

    const points = envelope.getEnvelope("volume").points;
    assert.deepEqual(points[1], [8, 59]);

    controller.handle({ type: "pointerup" });
    assert.equal(controller.state.dragging, false);
});

test("dragging is relative to the point's own start position, not an absolute jump to the cursor", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });

    const down = localFor([8, 44]); // point index 2: neighbors [4,64] and [14,8]
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });

    // A tiny move (2 logical units right) should move the point by exactly
    // that much from its own start (8 -> 10), not snap it to wherever this
    // particular pixel maps in absolute envelope-space.
    const dragTo = { x: down.x + 2, y: down.y };
    controller.handle({ type: "drag", rect: RECT, point: point(dragTo), local: dragTo });
    const points = envelope.getEnvelope("volume").points;
    assert.deepEqual(points[2], [10, 44]);
});

test("setDisabled cancels any drag and clears the active index", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const down = localFor([4, 64]);
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    assert.equal(controller.state.dragging, true);

    controller.setDisabled(true);
    assert.equal(controller.state.dragging, false);
    assert.equal(controller.state.activeIndex, -1);

    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    assert.equal(result.blocked, "disabled");
});

test("blur cancels an in-progress drag", async () => {
    await loadWithEnabledVolumeEnvelope();
    const controller = createEnvelopeController({ envelopeType: "volume" });
    const down = localFor([4, 64]);
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    assert.equal(controller.state.dragging, true);

    controller.handle({ type: "blur" });
    assert.equal(controller.state.dragging, false);
    assert.equal(controller.state.focused, false);
});
