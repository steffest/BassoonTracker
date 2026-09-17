import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, previewNoteOn, previewNoteOff, isPreviewNoteActive, reset } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";

// Spec 060: the piano's own live-audio note-preview engine, ported from the
// playback slice of script/src/ui/input.js#handleNoteOn/handleNoteOff
// (734-907) - the record-into-pattern slice of that same function is a
// separate, out-of-scope concern (see requirements.md's Decisions).
//
// Exercised against real loaded fixtures, the same way tests/arrangement.js
// and tests/envelope.test.js already are - `previewNoteOn` reaches real
// instrument/sample data (setSampleForNoteIndex, relativeNote), not
// something a hand-built fake could stand in for wholesale.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

let context;
let Tracker;
let app;

before(() => {
    // ensureEngine() (called inside previewNoteOn) requires a global
    // AudioContext constructor to exist even though app.audioContext
    // (supplied below) is what actually gets used - see
    // tests/playback.test.js's own "loadModule retries..." test, the same
    // shape reused here.
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
});

beforeEach(() => {
    reset();
    context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
    app = { audioContext: context, state: { get: () => undefined, set: () => {} }, log: () => {} };
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

// --- PREVIEW-001/002/003/005: on/dedup/off/isActive, ProTracker fixture ----

test("previewNoteOn plays a resolvable note, previewNoteOff silences it, and a second on/off round trips", async () => {
    await load("wizballalt.mod");
    song.setCurrentInstrumentIndex(1); // has real sample data (confirmed against the fixture)
    assert.equal(context.started.length, 0);

    const key = 25; // octave 2, offset 1 (C) - resolves to a real ProTracker note
    assert.equal(isPreviewNoteActive(key), false);
    const started = previewNoteOn(key, app);
    assert.equal(started, true, "PREVIEW-001: plays");
    assert.equal(context.started.length, 1);
    assert.equal(isPreviewNoteActive(key), true);

    const dedup = previewNoteOn(key, app);
    assert.equal(dedup, false, "PREVIEW-002: already sounding, no-op");
    assert.equal(context.started.length, 1, "no second sound started");

    const off = previewNoteOff(key);
    assert.equal(off, true, "PREVIEW-003: found a sounding key to silence");
    assert.equal(isPreviewNoteActive(key), false);
    const rampedToZero = context.automation.some(
        entry => entry.param === "gain.gain" && entry.method === "linearRampToValueAtTime" && entry.args[0] === 0
    );
    assert.ok(rampedToZero, "PREVIEW-003: the note's own volume gain was ramped to 0");

    const replay = previewNoteOn(key, app);
    assert.equal(replay, true, "the same key can sound again once released");
    assert.equal(context.started.length, 2);
});

test("previewNoteOff on a key that was never sounding is a safe no-op", async () => {
    await load("wizballalt.mod");
    song.setCurrentInstrumentIndex(1);
    const off = previewNoteOff(999);
    assert.equal(off, false);
    assert.equal(context.stopped.length, 0);
});

// --- PREVIEW-004: no current instrument -------------------------------------

test("previewNoteOn is a no-op with no current instrument selected", async () => {
    await load("wizballalt.mod");
    song.setCurrentInstrumentIndex(0); // slot 0 is unused - Tracker.getCurrentInstrument() is undefined
    assert.equal(Tracker.getCurrentInstrument(), undefined, "confirms this is genuinely no instrument");
    const started = previewNoteOn(25, app);
    assert.equal(started, false);
    assert.equal(context.started.length, 0);
});

// --- PREVIEW-006: FastTracker relative-note transpose -----------------------

test("previewNoteOn reflects a sample's own relativeNote transpose (FT mode)", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);
    const instrument = Tracker.getCurrentInstrument();
    assert.equal(Tracker.inFTMode(), true);

    // No bundled fixture happens to ship a nonzero relativeNote - hand-set
    // on the real, already-loaded instrument, the same "hand-built
    // instrument-shaped" precedent tests/envelope.test.js's own header
    // documents, just applied to a real loaded instrument's one field
    // rather than a fully fake object.
    instrument.samples[0].relativeNote = 0;
    previewNoteOn(49, app); // one octave above key 37 below
    const baselineRate = context.started[context.started.length - 1].node.playbackRate.value;
    previewNoteOff(49);

    instrument.samples[0].relativeNote = 12; // +12 semitones = +1 octave
    previewNoteOn(37, app);
    const shiftedRate = context.started[context.started.length - 1].node.playbackRate.value;
    previewNoteOff(37);

    assert.equal(shiftedRate, baselineRate, "key 37 shifted by +12 sounds identical to key 49 unshifted");

    instrument.samples[0].relativeNote = 0;
    previewNoteOn(37, app);
    const unshiftedRate = context.started[context.started.length - 1].node.playbackRate.value;
    previewNoteOff(37);

    assert.notEqual(unshiftedRate, shiftedRate, "the shift genuinely changed the pitch, not a coincidental match");
});
