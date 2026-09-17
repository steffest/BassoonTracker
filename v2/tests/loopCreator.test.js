import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as SongDoc from "../domain/song/index.js";
import {
    isLoopCreatorOpen, getLoopCreatorState, openLoopCreator,
    setLoopStart, setLoopLength, setTailSize, setHeadSize, setLoopEndSize,
    setBlendTail, setBlendHead, setBlendLoopEnd,
    setOrigBlendTail, setOrigBlendHead, setOrigBlendLoopEnd,
    setSnapToZero, applyLoopPreset, saveLoopCreator, cancelLoopCreator
} from "../domain/sampleEditor/loopCreator.js";

// Spec 043: the loop creator's own state model and DSP - headless, ported
// from script/plugins/sampleeditor/loopCreator.js. Most of this is
// exercised against a small, hand-computable synthetic instrument (LOOP-002
// through LOOP-004 need exact numbers, not a real fixture's own arbitrary
// data); saveLoopCreator's own undo/redo round trip needs the real engine,
// since it registers against domain/song's shared history.

function assertClose(actual, expected, msg) {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} !== ${expected}`);
}

function fakeInstrument(dataLength, loop) {
    const data = new Array(dataLength).fill(0).map((_, i) => Math.sin(i) * 0.3);
    return { sample: { data, length: dataLength, loop: { enabled: loop.enabled, start: loop.start, length: loop.length } } };
}

// A clean slate before every test - cancelLoopCreator() is a harmless no-op
// when nothing is open, and otherwise closes out whatever a prior test left
// open, since module state here is a singleton across the whole file.
beforeEach(() => {
    cancelLoopCreator();
});

// --- open: keeping an existing usable loop vs. seeding a default one ------

test("openLoopCreator keeps an existing usable loop untouched and resets blend defaults, without a preset", () => {
    const instrument = fakeInstrument(40, { enabled: true, start: 8, length: 6 });
    assert.equal(openLoopCreator(instrument), true);
    assert.equal(isLoopCreatorOpen(), true);

    const state = getLoopCreatorState();
    assert.equal(state.loopStart, 8);
    assert.equal(state.loopLength, 6);
    assert.equal(state.loopEnd, 14);
    assert.equal(state.dataLen, 40);
    assert.equal(state.blendTail, 0.5);
    assert.equal(state.blendHead, 0.5);
    assert.equal(state.blendLoopEnd, 0.5);
    assert.equal(state.origBlendTail, 1);
    assert.equal(state.origBlendHead, 1);
    assert.equal(state.origBlendLoopEnd, 1);
    assert.equal(state.snapToZero, false);
    // maxTailSize = min(loopLength=6, dataLen-loopEnd=26) = 6; same for head/loopEnd here
    assert.equal(state.tailSize, Math.floor(state.maxTailSize / 4));
    assert.equal(state.headSize, Math.floor(state.maxHeadSize / 4));
    assert.equal(state.loopEndSize, Math.floor(state.maxLoopEndSize / 4));
});

test("openLoopCreator seeds a default loop and applies Cross Fade when the instrument has no usable loop (disabled)", () => {
    const instrument = fakeInstrument(200, { enabled: false, start: 0, length: 0 });
    assert.equal(openLoopCreator(instrument), true);

    const state = getLoopCreatorState();
    assert.ok(state.loopStart > 0 && state.loopStart < state.loopEnd, "a real default loop was created");
    assert.equal(instrument.sample.loop.enabled, true, "the instrument's own loop is enabled to match");
    assert.equal(instrument.sample.loop.start, state.loopStart);
    assert.equal(instrument.sample.loop.length, state.loopLength);
    // Cross Fade: every blend value is 0.5, every region half its own max
    assert.equal(state.blendTail, 0.5);
    assert.equal(state.blendHead, 0.5);
    assert.equal(state.blendLoopEnd, 0.5);
    assert.equal(state.origBlendTail, 0.5);
    assert.equal(state.origBlendHead, 0.5);
    assert.equal(state.origBlendLoopEnd, 0.5);
    assert.equal(state.tailSize, state.maxTailSize >> 1);
    assert.equal(state.headSize, state.maxHeadSize >> 1);
    assert.equal(state.loopEndSize, state.maxLoopEndSize >> 1);
});

test("openLoopCreator seeds a default loop when the existing one is too short (length < 2), not only when disabled", () => {
    const instrument = fakeInstrument(200, { enabled: true, start: 50, length: 1 });
    openLoopCreator(instrument);
    const state = getLoopCreatorState();
    assert.notEqual(state.loopStart, 50, "the too-short loop was replaced, not kept");
});

test("openLoopCreator returns false and changes nothing for an instrument with no sample data", () => {
    assert.equal(openLoopCreator(null), false);
    assert.equal(openLoopCreator({ sample: { data: [], loop: { enabled: false } } }), false);
});

// --- computeLayers/applyPreview: exact, hand-computed output --------------

test("computeLayers/applyPreview write the exact blended values at the exact positions, idempotently", () => {
    const data = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
    const instrument = { sample: { data: data.slice(), length: data.length, loop: { enabled: true, start: 8, length: 6 } } };
    openLoopCreator(instrument); // tailSize=headSize=loopEndSize=1 (maxes are all 6, floor(6/4)=1); blends default to 0.5/1

    // hand-traced (see design.md): only indices 7, 8 and 13 change
    const expected = data.slice();
    expected[7] = 0.525;   // purple (headModLayer) write at loopStart - 1
    expected[8] = 0.55;    // cyan (tailLayer) write at loopStart
    expected[13] = 0.6125; // orange (loopEndLayer) write at loopEnd - 1

    for (let i = 0; i < data.length; i++) assertClose(instrument.sample.data[i], expected[i], `index ${i}`);

    // idempotence: re-running with the same inputs (via a same-value setter call) never compounds
    setHeadSize(getLoopCreatorState().headSize);
    for (let i = 0; i < data.length; i++) assertClose(instrument.sample.data[i], expected[i], `index ${i} after a same-value recompute`);
});

// --- setters clamp to their own current maximum, re-derived on every move -

test("setLoopStart/setLoopLength clamp and re-derive the loop end, keeping it even-aligned", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 20, length: 10 });
    openLoopCreator(instrument);

    setLoopStart(5);
    assert.equal(getLoopCreatorState().loopStart, 4, "odd values round down to even");
    setLoopStart(-10);
    assert.equal(getLoopCreatorState().loopStart, 0, "never negative");

    setLoopLength(3);
    assert.equal(getLoopCreatorState().loopLength, 2, "rounds down to even, floored at 2");
    setLoopLength(99999);
    assert.equal(getLoopCreatorState().loopLength, 100 - getLoopCreatorState().loopStart, "clamped to what's left of the sample");
});

test("shrinking the loop re-derives every region's own maximum and clamps a region already past it", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 10, length: 20 });
    openLoopCreator(instrument);
    setTailSize(5); // within the initial max (maxTailSize = min(20, 100-30) = 20)
    assert.equal(getLoopCreatorState().tailSize, 5);

    setLoopLength(2); // loopEnd becomes 12; maxTailSize becomes min(2, 100-12) = 2
    const state = getLoopCreatorState();
    assert.equal(state.maxTailSize, 2);
    assert.equal(state.tailSize, 2, "the region already past the new max was clamped down to fit");
});

test("setTailSize/setHeadSize/setLoopEndSize each clamp to [0, their own max]", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 10, length: 20 });
    openLoopCreator(instrument);
    const max = getLoopCreatorState();

    setTailSize(999999);
    assert.equal(getLoopCreatorState().tailSize, max.maxTailSize);
    setTailSize(-5);
    assert.equal(getLoopCreatorState().tailSize, 0);

    setHeadSize(999999);
    assert.equal(getLoopCreatorState().headSize, max.maxHeadSize);
    setLoopEndSize(999999);
    assert.equal(getLoopCreatorState().loopEndSize, max.maxLoopEndSize);
});

test("the six blend setters each clamp to [0, 1]", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 10, length: 20 });
    openLoopCreator(instrument);

    setBlendTail(5); assert.equal(getLoopCreatorState().blendTail, 1);
    setBlendHead(-5); assert.equal(getLoopCreatorState().blendHead, 0);
    setBlendLoopEnd(0.3); assert.equal(getLoopCreatorState().blendLoopEnd, 0.3);
    setOrigBlendTail(5); assert.equal(getLoopCreatorState().origBlendTail, 1);
    setOrigBlendHead(-5); assert.equal(getLoopCreatorState().origBlendHead, 0);
    setOrigBlendLoopEnd(0.7); assert.equal(getLoopCreatorState().origBlendLoopEnd, 0.7);
});

test("setLoopStart/setLoopLength/every size and blend setter are no-ops before openLoopCreator (or after a failed one)", () => {
    assert.equal(openLoopCreator(null), false);
    assert.doesNotThrow(() => {
        setLoopStart(10); setLoopLength(10);
        setTailSize(10); setHeadSize(10); setLoopEndSize(10);
        setBlendTail(1); setBlendHead(1); setBlendLoopEnd(1);
        setOrigBlendTail(1); setOrigBlendHead(1); setOrigBlendLoopEnd(1);
    });
    assert.equal(isLoopCreatorOpen(), false);
});

test("setSnapToZero stores plain state, applied by neither setLoopStart nor setLoopLength", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 20, length: 10 });
    openLoopCreator(instrument);
    setSnapToZero(true);
    assert.equal(getLoopCreatorState().snapToZero, true);
    setLoopStart(5); // an odd, non-zero-crossing-aligned value
    assert.equal(getLoopCreatorState().loopStart, 4, "only even-aligned, snapToZero is not consulted here");
});

// --- presets ----------------------------------------------------------------

test("applyLoopPreset(0) (\"Select\") is a deliberate no-op", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 7, length: 20 });
    openLoopCreator(instrument);
    const before = getLoopCreatorState();
    assert.equal(applyLoopPreset(0), false);
    assert.deepEqual(getLoopCreatorState(), before);
});

test("applyLoopPreset(1) (\"Fade in Head\") sets exactly the nine values v1's own table does", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 7, length: 20 });
    openLoopCreator(instrument);
    const max = getLoopCreatorState();
    assert.equal(applyLoopPreset(1), true);
    const s = getLoopCreatorState();
    assert.equal(s.headSize, max.maxHeadSize);
    assert.equal(s.blendHead, 1);
    assert.equal(s.origBlendHead, 0);
    assert.equal(s.tailSize, 0);
    assert.equal(s.blendTail, 0);
    assert.equal(s.origBlendTail, 1);
    assert.equal(s.loopEndSize, 0);
    assert.equal(s.blendLoopEnd, 0);
    assert.equal(s.origBlendLoopEnd, 1);
});

test("applyLoopPreset(2) (\"Fade out Tail\") sets exactly the nine values v1's own table does", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 7, length: 20 });
    openLoopCreator(instrument);
    const max = getLoopCreatorState();
    assert.equal(applyLoopPreset(2), true);
    const s = getLoopCreatorState();
    assert.equal(s.headSize, 0);
    assert.equal(s.blendHead, 0);
    assert.equal(s.origBlendHead, 1);
    assert.equal(s.tailSize, max.maxTailSize);
    assert.equal(s.blendTail, 1);
    assert.equal(s.origBlendTail, 0);
    assert.equal(s.loopEndSize, 0);
    assert.equal(s.blendLoopEnd, 0);
    assert.equal(s.origBlendLoopEnd, 1);
});

test("applyLoopPreset(3) (\"Cross Fade\") sets exactly the nine values v1's own table does", () => {
    const instrument = fakeInstrument(100, { enabled: true, start: 7, length: 20 });
    openLoopCreator(instrument);
    const max = getLoopCreatorState();
    assert.equal(applyLoopPreset(3), true);
    const s = getLoopCreatorState();
    assert.equal(s.headSize, max.maxHeadSize >> 1);
    assert.equal(s.blendHead, 0.5);
    assert.equal(s.origBlendHead, 0.5);
    assert.equal(s.tailSize, max.maxTailSize >> 1);
    assert.equal(s.blendTail, 0.5);
    assert.equal(s.origBlendTail, 0.5);
    assert.equal(s.loopEndSize, max.maxLoopEndSize >> 1);
    assert.equal(s.blendLoopEnd, 0.5);
    assert.equal(s.origBlendLoopEnd, 0.5);
});

// --- save/cancel, against a real loaded fixture ----------------------------

let Tracker;
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

let instrumentIndex;

beforeEach(async () => {
    await load("wizballalt.mod");
    SongDoc.clearHistory();
    // Requires an already-usable loop, not just enough data - openLoopCreator
    // would otherwise seed its own default loop as a side effect of opening,
    // which is what origLoopStart/origLoopLength (and so save/cancel's own
    // restore point) reflect, not whatever instrument.sample.loop held
    // before open() ran (matches v1's own me.open, ported verbatim - see
    // design.md). Picking an instrument with a real loop already sidesteps
    // that distinction for this test's own purpose.
    instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 40 && instrument.sample.loop && instrument.sample.loop.enabled && instrument.sample.loop.length >= 2);
    assert.ok(instrumentIndex > 0, "fixture has an instrument with an already-usable loop");
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
});

test("saveLoopCreator registers one undo entry restoring both the data and the loop bounds together", () => {
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const originalLoop = { start: instrument.sample.loop.start, length: instrument.sample.loop.length };
    const originalData = instrument.sample.data.slice();

    openLoopCreator(instrument);
    setBlendTail(1); // force a real, non-trivial change to the preview
    const createdLoop = { start: instrument.sample.loop.start, length: instrument.sample.loop.length };

    assert.equal(saveLoopCreator(), true);
    assert.equal(isLoopCreatorOpen(), false);
    assert.equal(SongDoc.canUndo(), true);

    SongDoc.undo();
    assert.deepEqual(instrument.sample.data, originalData, "data restored");
    assert.equal(instrument.sample.loop.start, originalLoop.start, "loop bounds restored in the same undo - the spec-043 fix");
    assert.equal(instrument.sample.loop.length, originalLoop.length);

    SongDoc.redo();
    assert.equal(instrument.sample.loop.start, createdLoop.start);
    assert.equal(instrument.sample.loop.length, createdLoop.length);
});

test("saveLoopCreator is a no-op when nothing is open", () => {
    assert.equal(saveLoopCreator(), false);
    assert.equal(SongDoc.canUndo(), false);
});

test("cancelLoopCreator restores immediately and registers nothing on the undo stack", () => {
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const originalLoop = { start: instrument.sample.loop.start, length: instrument.sample.loop.length };
    const originalData = instrument.sample.data.slice();

    openLoopCreator(instrument);
    setBlendTail(1);
    assert.notDeepEqual(instrument.sample.data, originalData, "the preview really did change something");

    assert.equal(cancelLoopCreator(), true);
    assert.equal(isLoopCreatorOpen(), false);
    assert.deepEqual(instrument.sample.data, originalData);
    assert.equal(instrument.sample.loop.start, originalLoop.start);
    assert.equal(instrument.sample.loop.length, originalLoop.length);
    assert.equal(SongDoc.canUndo(), false, "nothing registered on the undo stack");
});

test("cancelLoopCreator is a no-op when nothing is open", () => {
    assert.equal(cancelLoopCreator(), false);
});
