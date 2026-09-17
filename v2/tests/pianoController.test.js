import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, previewNoteOn, isPreviewNoteActive, reset } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import { createPianoController } from "../runtime/pianoController.js";
import { keyRectsFor } from "../renderers/canvas/pianoGeometry.js";

// Spec 061: the "piano" behavior. Exercised against a real loaded fixture,
// the same way tests/scopesController.test.js already is, since a
// press/drag/release here calls domain/playback#previewNoteOn/previewNoteOff
// (spec 060) directly.

const RECT = { width: 500, height: 150 };
let Tracker;
let context;
let app;

before(() => {
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
});

beforeEach(async () => {
    reset();
    context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
    app = { audioContext: context, state: { get: () => undefined, set: () => {} }, log: () => {} };

    const data = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "wizballalt.mod"));
    await Tracker.processFile(new Uint8Array(data).buffer, "wizballalt.mod");
    song.setCurrentInstrumentIndex(1); // has real sample data

    // Bootstraps domain/playback's own ensureEngine() against this test's
    // silent context - a real controller call site never supplies an `app`
    // (see previewNoteOn's own doc comment), so this is the test's own
    // responsibility, done once here rather than in every test below. -1
    // resolves to no note either way (no instrument lookup even reached),
    // a clean no-op beyond the bootstrap itself.
    previewNoteOn(-1, app);
});

function input(local) {
    return { type: undefined, rect: RECT, local, point: { x: RECT.x + local.x, y: RECT.y + local.y } };
}

test("pointerdown on a white key plays it; pointerup releases it", () => {
    const controller = createPianoController();
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const local = { x: white[0].left + 10, y: white[0].top + white[0].height - 20 };

    const down = controller.handle({ ...input(local), type: "pointerdown" });
    assert.equal(down.handled, true);
    assert.equal(isPreviewNoteActive(white[0].index), true);

    const up = controller.handle({ type: "pointerup" });
    assert.equal(up.handled, true);
    assert.equal(isPreviewNoteActive(white[0].index), false);
});

test("drag to a different key note-offs the old one and note-ons the new one", () => {
    const controller = createPianoController();
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const local0 = { x: white[0].left + 10, y: white[0].top + white[0].height - 20 };
    const local1 = { x: white[1].left + 10, y: white[1].top + white[1].height - 20 };

    controller.handle({ ...input(local0), type: "pointerdown" });
    assert.equal(isPreviewNoteActive(white[0].index), true);

    const drag = controller.handle({ ...input(local1), type: "drag" });
    assert.equal(drag.handled, true);
    assert.equal(isPreviewNoteActive(white[0].index), false, "the old key released");
    assert.equal(isPreviewNoteActive(white[1].index), true, "the new key sounding");

    controller.handle({ type: "pointerup" });
    assert.equal(isPreviewNoteActive(white[1].index), false);
});

test("PIANO-003: a drag that resolves to the same held key is a no-op", () => {
    const controller = createPianoController();
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const local = { x: white[0].left + 10, y: white[0].top + white[0].height - 20 };
    const localAlsoWhite0 = { x: white[0].left + 30, y: white[0].top + white[0].height - 10 }; // still inside the same key

    controller.handle({ ...input(local), type: "pointerdown" });
    assert.equal(isPreviewNoteActive(white[0].index), true);

    const drag = controller.handle({ ...input(localAlsoWhite0), type: "drag" });
    assert.equal(drag.handled, false, "no re-trigger for the same key");
    assert.equal(isPreviewNoteActive(white[0].index), true, "still sounding, not silenced and replayed");

    controller.handle({ type: "pointerup" });
});

test("setDisabled blocks pointerdown, and releases any held key", () => {
    const controller = createPianoController();
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const local = { x: white[0].left + 10, y: white[0].top + white[0].height - 20 };

    controller.handle({ ...input(local), type: "pointerdown" });
    assert.equal(isPreviewNoteActive(white[0].index), true);

    controller.setDisabled(true);
    assert.equal(isPreviewNoteActive(white[0].index), false, "disabling releases the held key");

    const down = controller.handle({ ...input(local), type: "pointerdown" });
    assert.equal(down.blocked, "disabled");
    assert.equal(isPreviewNoteActive(white[0].index), false);
});

test("blur releases a held key, the same as pointerup", () => {
    const controller = createPianoController();
    const { white } = keyRectsFor(RECT, song.getCurrentOctave());
    const local = { x: white[0].left + 10, y: white[0].top + white[0].height - 20 };

    controller.handle({ ...input(local), type: "pointerdown" });
    assert.equal(isPreviewNoteActive(white[0].index), true);

    controller.handle({ type: "blur" });
    assert.equal(isPreviewNoteActive(white[0].index), false);
});

test("a miss (no rect/local, or a click outside every key) does nothing", () => {
    const controller = createPianoController();
    const down = controller.handle({ type: "pointerdown" });
    assert.equal(down.handled, false);
});
