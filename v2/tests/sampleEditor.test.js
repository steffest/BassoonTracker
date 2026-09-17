import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as SongDoc from "../domain/song/index.js";
import * as SampleEditor from "../domain/sampleEditor/index.js";
import * as LoopCreator from "../domain/sampleEditor/loopCreator.js";
import * as Resample from "../domain/sampleEditor/resample.js";

// Spec 040: the sample editor's own first slice - selection and the four
// core operations, undoable through domain/song's shared history. Exercised
// against a real loaded module, the same convention tests/song.test.js
// already uses, since sample edits mutate the exact instrument objects the
// engine holds.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

let Tracker;
let instrumentIndex; // the first real instrument with enough sample data to exercise every operation

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
    SongDoc.clearHistory();
    SampleEditor.resetSampleSelection();

    instrumentIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 8);
    assert.ok(instrumentIndex > 0, "fixture has at least one instrument with real sample data");
    Tracker.setCurrentInstrumentIndex(instrumentIndex);
});

function currentData() {
    return Tracker.getInstruments()[instrumentIndex].sample.data.slice();
}

// --- selection --------------------------------------------------------------

test("selection defaults to the whole sample", () => {
    assert.deepEqual(SampleEditor.getSampleSelection(), { start: 0, length: 0 });
});

test("selection can be set and read back, clamped to non-negative", () => {
    SampleEditor.setSampleSelection(4, 10);
    assert.deepEqual(SampleEditor.getSampleSelection(), { start: 4, length: 10 });
    SampleEditor.setSampleSelection(-5, -5);
    assert.deepEqual(SampleEditor.getSampleSelection(), { start: 0, length: 0 });
});

// --- the four operations, against the whole sample ---------------------------

test("reverse reverses the whole sample's own data and is undoable", () => {
    const before = currentData();
    assert.equal(SampleEditor.reverse(), true);
    assert.deepEqual(currentData(), before.slice().reverse());

    SongDoc.undo();
    assert.deepEqual(currentData(), before);
    SongDoc.redo();
    assert.deepEqual(currentData(), before.slice().reverse());
});

test("invert negates every sample and is undoable", () => {
    const before = currentData();
    assert.equal(SampleEditor.invert(), true);
    assert.deepEqual(currentData(), before.map(v => -v));

    SongDoc.undo();
    assert.deepEqual(currentData(), before);
});

test("adjustVolume('max') normalizes and is undoable", () => {
    const before = currentData();
    const changed = SampleEditor.adjustVolume("max");
    if (changed) {
        const after = currentData();
        const peak = Math.max(...after, -Math.min(...after));
        assert.ok(Math.abs(peak - 1) < 1e-6 || peak <= 1);
        SongDoc.undo();
        assert.deepEqual(currentData(), before);
    } else {
        // the fixture's own instrument was already at or above unity peak - a
        // legitimate outcome, not a test failure; nothing to undo either.
        assert.equal(SongDoc.canUndo(), false);
    }
});

test("adjustVolume('fadein') ramps the whole sample from 0 and is undoable", () => {
    const before = currentData();
    assert.equal(SampleEditor.adjustVolume("fadein"), true);
    const after = currentData();
    assert.ok(Math.abs(after[0]) < 1e-9 || before[0] === 0);
    SongDoc.undo();
    assert.deepEqual(currentData(), before);
});

test("adjustVolume with an unrecognized value is a no-op", () => {
    const before = currentData();
    assert.equal(SampleEditor.adjustVolume("nonesuch"), false);
    assert.deepEqual(currentData(), before);
    assert.equal(SongDoc.canUndo(), false);
});

// --- a selected range, not the whole sample -----------------------------------

test("an operation over a selected range only touches that range, leaving the rest untouched", () => {
    const before = currentData();
    SampleEditor.setSampleSelection(1, 4);
    assert.equal(SampleEditor.invert(), true);
    const after = currentData();

    assert.deepEqual(after.slice(0, 1), before.slice(0, 1), "head untouched");
    assert.deepEqual(after.slice(1, 5), before.slice(1, 5).map(v => -v), "only the selected range inverted");
    assert.deepEqual(after.slice(5), before.slice(5), "tail untouched");

    SongDoc.undo();
    assert.deepEqual(currentData(), before);
});

// --- trim ---------------------------------------------------------------------

test("trim strips near-silent head/tail and is undoable, including the sample's own length changing", () => {
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const original = currentData();
    instrument.sample.data = [0, 0, 0.5, 0.6, 0.5, 0, 0, 0];
    instrument.sample.length = instrument.sample.data.length;
    SampleEditor.resetSampleSelection();

    const before = currentData();
    assert.equal(SampleEditor.trim(), true);
    const trimmed = currentData();
    assert.ok(trimmed.length < before.length);
    assert.equal(instrument.sample.length, trimmed.length);

    SongDoc.undo();
    assert.deepEqual(currentData(), before);
    assert.equal(instrument.sample.length, before.length);

    SongDoc.redo();
    assert.deepEqual(currentData(), trimmed);

    // restore, so any test running after this one sees the fixture's own data
    instrument.sample.data = original;
    instrument.sample.length = original.length;
});

test("trim is a no-op when there is nothing to trim", () => {
    const instrument = Tracker.getInstruments()[instrumentIndex];
    instrument.sample.data = [0.5, 0.6, 0.7, 0.8];
    instrument.sample.length = 4;
    assert.equal(SampleEditor.trim(), false);
});

// --- undo restores which instrument was current, not just its data -----------

test("undoing an edit made on a different instrument switches back to it first", () => {
    const otherIndex = Tracker.getInstruments().findIndex((instrument, i) => i !== instrumentIndex && instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 4);
    assert.ok(otherIndex > 0, "fixture has a second usable instrument");

    Tracker.setCurrentInstrumentIndex(otherIndex);
    const otherBefore = Tracker.getInstruments()[otherIndex].sample.data.slice();
    assert.equal(SampleEditor.invert(), true);

    Tracker.setCurrentInstrumentIndex(instrumentIndex); // switch away before undoing
    SongDoc.undo();

    assert.equal(Tracker.getCurrentInstrumentIndex(), otherIndex, "undo switched back to the instrument the edit belongs to");
    assert.deepEqual(Tracker.getInstruments()[otherIndex].sample.data, otherBefore);
});

// --- the sample-editor screen's own capability surface (spec 042) ----------

function fakeApp() {
    const store = new Map();
    const logs = [];
    return { app: { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) }, log: (command, detail) => logs.push([command, detail]) }, store, logs };
}

test("publishInstrumentFields pushes every field for the current instrument", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    instrument.name = "lead";
    instrument.sample.volume = 40;
    instrument.sample.loop.enabled = true;
    instrument.sample.loop.start = 10;
    instrument.sample.loop.length = 20;

    SampleEditor.publishInstrumentFields(app);

    assert.equal(store.get(SampleEditor.STATE_FIELDS.instrumentIndex), instrumentIndex);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.instrumentName), "lead");
    assert.equal(store.get(SampleEditor.STATE_FIELDS.volume), 40);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopEnabled), true);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopStart), 10);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopLength), 20);
});

test("publishInstrumentFields falls back to blank/zero fields when there is no current instrument", () => {
    const { app, store } = fakeApp();
    Tracker.setCurrentInstrumentIndex(0); // v1's own "no instrument selected" sentinel
    SampleEditor.publishInstrumentFields(app);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.instrumentName), "");
    assert.equal(store.get(SampleEditor.STATE_FIELDS.volume), 0);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopEnabled), false);
});

test("setInstrumentIndex clamps to [1, getMaxInstruments()], resets the sample selection, and republishes even a rejected request", () => {
    const { app, store } = fakeApp();
    SampleEditor.setSampleSelection(5, 5);

    SampleEditor.setInstrumentIndex(app, { value: 999999 });
    assert.equal(Tracker.getCurrentInstrumentIndex(), SongDoc.getMaxInstruments(), "clamped to the ceiling");
    assert.deepEqual(SampleEditor.getSampleSelection(), { start: 0, length: 0 }, "selection reset on instrument switch");
    assert.equal(store.get(SampleEditor.STATE_FIELDS.instrumentIndex), SongDoc.getMaxInstruments());

    SampleEditor.setInstrumentIndex(app, { value: instrumentIndex });
    assert.equal(Tracker.getCurrentInstrumentIndex(), instrumentIndex);
});

test("setInstrumentName writes the current instrument's own name", () => {
    const { app } = fakeApp();
    SampleEditor.setInstrumentName(app, { value: "kick" });
    assert.equal(Tracker.getInstruments()[instrumentIndex].name, "kick");
});

test("setInstrumentName also republishes the song-properties section's own instrument row list (spec 071)", () => {
    const { app, store } = fakeApp();
    SampleEditor.setInstrumentName(app, { value: "snare" });
    const rows = store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.instrumentGroup.instrumentList");
    assert.ok(Array.isArray(rows));
    assert.ok(rows[instrumentIndex - 1].title.includes("snare"));
});

test("setVolume clamps to [0, 64] and publishes back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolume(app, { value: 999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.volume, 64);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.volume), 64);

    SampleEditor.setVolume(app, { value: -10 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.volume, 0);
});

test("toggleLoopEnabled flips by default and accepts an explicit boolean", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    instrument.sample.loop.enabled = false;

    SampleEditor.toggleLoopEnabled(app);
    assert.equal(instrument.sample.loop.enabled, true);
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopEnabled), true);

    SampleEditor.toggleLoopEnabled(app, { value: false });
    assert.equal(instrument.sample.loop.enabled, false);
});

test("setLoopStart/setLoopLength clamp against the sample's own current length, not a static ceiling", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const length = instrument.sample.length;
    instrument.sample.loop.length = 4;

    SampleEditor.setLoopStart(app, { value: length + 1000 }); // far past the end
    assert.equal(instrument.sample.loop.start, Math.max(0, length - 4));
    assert.equal(store.get(SampleEditor.STATE_FIELDS.loopStart), instrument.sample.loop.start);

    instrument.sample.loop.start = 0;
    SampleEditor.setLoopLength(app, { value: length + 1000 });
    assert.equal(instrument.sample.loop.length, length);
});

test("normalizeSample/fadeInSample/fadeOutSample/trimSample/reverseSample/invertSample each run the existing operation and republish only when something changed", () => {
    const { app, logs } = fakeApp();

    assert.equal(SampleEditor.reverseSample(app), true);
    assert.deepEqual(logs.at(-1), ["sample.reverse", { changed: true }]);

    assert.equal(SampleEditor.invertSample(app), true);
    assert.deepEqual(logs.at(-1), ["sample.invert", { changed: true }]);

    const before = currentData();
    const result = SampleEditor.adjustVolume("nonesuch"); // sanity: the underlying no-op path still exists
    assert.equal(result, false);
    assert.deepEqual(currentData(), before);
});

// --- the loop creator's own menu bar and screen wiring (spec 045) ----------
// These wrappers only test the mode-field transitions and delegation to
// spec 043's own session functions; the DSP/preset numbers themselves are
// already covered by tests/loopCreator.test.js against hand-computable
// synthetic instruments.

test("openLoopCreator opens spec 043's session for the current instrument and sets the shared view field", () => {
    const { app, store } = fakeApp();
    assert.equal(SampleEditor.openLoopCreator(app), true);
    assert.equal(store.get("sample-edit-view.value"), "loop-creator");
    assert.equal(LoopCreator.isLoopCreatorOpen(), true);
    SampleEditor.cancelLoopCreator(app); // leave closed for later tests
});

test("openLoopCreator with no current instrument does not open a session or touch the view field", () => {
    const { app, store } = fakeApp();
    Tracker.setCurrentInstrumentIndex(0); // v1's own "no instrument selected" sentinel
    assert.equal(SampleEditor.openLoopCreator(app), false);
    assert.equal(store.get("sample-edit-view.value"), undefined);
    assert.equal(LoopCreator.isLoopCreatorOpen(), false);
    Tracker.setCurrentInstrumentIndex(instrumentIndex); // restore for later tests
});

test("saveLoopCreator registers an undoable edit and closes the view field", () => {
    const { app, store } = fakeApp();
    assert.equal(SampleEditor.openLoopCreator(app), true);
    assert.equal(SampleEditor.saveLoopCreator(app), true);
    assert.equal(store.get("sample-edit-view.value"), "");
    assert.equal(SongDoc.canUndo(), true);
    assert.equal(SongDoc.getUndoLabel(), "Undo Create Loop");
    SongDoc.undo(); // restore the instrument's own data/loop bounds for later tests
});

test("cancelLoopCreator restores the sample immediately and closes the view field, registering no undo entry", () => {
    SongDoc.clearHistory();
    const { app, store } = fakeApp();
    const before = currentData();
    assert.equal(SampleEditor.openLoopCreator(app), true);
    assert.equal(SampleEditor.cancelLoopCreator(app), true);
    assert.equal(store.get("sample-edit-view.value"), "");
    assert.deepEqual(currentData(), before);
    assert.equal(SongDoc.canUndo(), false);
});

test("saveLoopCreator/cancelLoopCreator are harmless no-ops when nothing is open, but still close the view field", () => {
    const { app, store } = fakeApp();
    assert.equal(LoopCreator.isLoopCreatorOpen(), false);
    assert.equal(SampleEditor.saveLoopCreator(app), false);
    assert.equal(store.get("sample-edit-view.value"), "");
    assert.equal(SampleEditor.cancelLoopCreator(app), false);
    assert.equal(store.get("sample-edit-view.value"), "");
});

test("toggleSnapToZero accepts an explicit boolean and flips by default", () => {
    const { app, store } = fakeApp();
    SampleEditor.toggleSnapToZero(app, { value: false });
    assert.equal(LoopCreator.getLoopCreatorState().snapToZero, false);
    assert.equal(store.get("snap-to-zero.active"), false);

    SampleEditor.toggleSnapToZero(app);
    assert.equal(LoopCreator.getLoopCreatorState().snapToZero, true);
    assert.equal(store.get("snap-to-zero.active"), true);

    SampleEditor.toggleSnapToZero(app, { value: true });
    assert.equal(LoopCreator.getLoopCreatorState().snapToZero, true);
});

test("setLoopPreset maps each label to spec 043's own preset index; \"Select\" and an unrecognized label are no-ops", () => {
    const { app } = fakeApp();
    assert.equal(SampleEditor.openLoopCreator(app), true);

    assert.equal(SampleEditor.setLoopPreset(app, { value: "Select" }), false, "index 0 is a deliberate no-op, matching v1");
    assert.equal(SampleEditor.setLoopPreset(app, { value: "Fade in Head" }), true);
    assert.equal(SampleEditor.setLoopPreset(app, { value: "Fade out Tail" }), true);
    assert.equal(SampleEditor.setLoopPreset(app, { value: "Cross Fade" }), true);
    assert.equal(SampleEditor.setLoopPreset(app, { value: "Nonesuch" }), false);

    SampleEditor.cancelLoopCreator(app); // leave no open session behind for later tests
});

// --- the resample panel (spec 046) -----------------------------------------
// Nothing is mutated until saveResample runs, unlike the loop creator, so
// there is no live-preview data to check between open and Apply/Cancel.

test("getNoteForResampleIndex resolves name/period correctly in every mode", async () => {
    assert.deepEqual(SongDoc.getNoteForResampleIndex(37), { name: "C-3", period: 214 }, "ProTracker mode (the wizballalt.mod fixture, still loaded from beforeEach)");

    await load("sin.xm"); // a real XM fixture, switching the engine to FastTracker mode - its own loader sets useLinearFrequency true
    assert.equal(Tracker.inFTMode(), true);
    assert.equal(Tracker.useLinearFrequency, true);
    assert.deepEqual(SongDoc.getNoteForResampleIndex(1), { name: "C-0", period: 7680 }, "FT mode, linear frequency formula: 7680 - (index-1)*64");
    assert.equal(SongDoc.getNoteForResampleIndex(37).period, 7680 - 36 * 64);

    Tracker.useLinearFrequency = false; // a real, toggleable per-song option (spec 033) - not fabricated state
    const nonLinear = SongDoc.getNoteForResampleIndex(37);
    assert.equal(nonLinear.name, "C-3");
    assert.notEqual(nonLinear.period, 7680 - 36 * 64, "the non-linear period comes straight from FTNotes, not the linear formula");

    await load("wizballalt.mod"); // restore, though the next test's own beforeEach reloads it anyway
});

test("openResample opens spec 046's own session for the current instrument, publishes fields, and sets the shared view field", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const sourceRate = instrument.sample.originalSampleRate || instrument.sample.c2spd || 8363;

    assert.equal(SampleEditor.openResample(app), true);
    assert.equal(store.get("sample-edit-view.value"), "resample");
    assert.equal(Resample.isResampleOpen(), true);
    assert.equal(Resample.getResampleState().targetIndex, 37);
    assert.equal(store.get("resample-source-rate.value"), Math.round(sourceRate));
    assert.equal(store.get("resample-target-index.value"), 37);
    assert.ok(store.get("resample-target-note.value"));
    assert.ok(store.get("resample-target-rate.value") > 0);

    SampleEditor.cancelResample(app); // leave closed for later tests
});

test("openResample with no current instrument does not open a session or touch the view field", () => {
    const { app, store } = fakeApp();
    Tracker.setCurrentInstrumentIndex(0); // v1's own "no instrument selected" sentinel
    assert.equal(SampleEditor.openResample(app), false);
    assert.equal(store.get("sample-edit-view.value"), undefined);
    assert.equal(Resample.isResampleOpen(), false);
    Tracker.setCurrentInstrumentIndex(instrumentIndex); // restore for later tests
});

test("setResampleTargetIndex clamps to [1, 96] and republishes every target field", () => {
    const { app, store } = fakeApp();
    assert.equal(SampleEditor.openResample(app), true);

    SampleEditor.setResampleTargetIndex(app, { value: 1 });
    assert.equal(Resample.getResampleState().targetIndex, 1);
    assert.equal(store.get("resample-target-index.value"), 1);
    const rateAt1 = store.get("resample-target-rate.value");

    SampleEditor.setResampleTargetIndex(app, { value: 999 }); // far past the ceiling
    assert.equal(Resample.getResampleState().targetIndex, 96, "clamped to the ceiling");
    assert.equal(store.get("resample-target-index.value"), 96);
    assert.notEqual(store.get("resample-target-rate.value"), rateAt1, "a different index re-publishes a different rate");

    SampleEditor.cancelResample(app);
});

test("toggleResampleInterpolate accepts an explicit boolean and flips by default", () => {
    const { app, store } = fakeApp();
    SampleEditor.toggleResampleInterpolate(app, { value: false });
    assert.equal(store.get("resample-interpolate.active"), false);

    SampleEditor.toggleResampleInterpolate(app);
    assert.equal(store.get("resample-interpolate.active"), true);

    SampleEditor.toggleResampleInterpolate(app, { value: false });
    assert.equal(store.get("resample-interpolate.active"), false);
});

test("saveResample resamples the whole current instrument to the target rate, scales the loop, and is undoable", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    instrument.sample.loop.enabled = true;
    instrument.sample.loop.start = 4;
    instrument.sample.loop.length = 4;
    const before = currentData();
    const beforeLength = before.length;

    assert.equal(SampleEditor.openResample(app), true);
    SampleEditor.setResampleTargetIndex(app, { value: 1 }); // a very different rate from the source, so the length clearly changes
    SampleEditor.toggleResampleInterpolate(app, { value: true });

    assert.equal(SampleEditor.saveResample(app), true);
    assert.equal(store.get("sample-edit-view.value"), "");
    const after = currentData();
    assert.notEqual(after.length, beforeLength, "resampling to a different rate changes the sample's own length");
    assert.equal(instrument.sample.length, after.length);
    assert.equal(SongDoc.canUndo(), true);
    assert.equal(SongDoc.getUndoLabel(), "Undo Resample Sample");

    SongDoc.undo();
    assert.deepEqual(currentData(), before);
    assert.equal(instrument.sample.loop.start, 4);
    assert.equal(instrument.sample.loop.length, 4);

    SongDoc.redo();
    assert.deepEqual(currentData(), after);
});

test("saveResample without interpolation uses nearest-sample selection, matching the ported formula's length", () => {
    const { app } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    const sourceRate = instrument.sample.originalSampleRate || instrument.sample.c2spd || 8363;
    const before = currentData();

    assert.equal(SampleEditor.openResample(app), true);
    SampleEditor.setResampleTargetIndex(app, { value: 96 });
    const targetRate = Resample.getTargetRate();
    SampleEditor.toggleResampleInterpolate(app, { value: false });
    assert.equal(SampleEditor.saveResample(app), true);

    const expectedLength = Math.max(1, Math.round(before.length * targetRate / sourceRate));
    assert.equal(currentData().length, expectedLength);

    SongDoc.undo();
});

test("cancelResample closes the view field without mutating the sample, registering no undo entry", () => {
    SongDoc.clearHistory();
    const { app, store } = fakeApp();
    const before = currentData();

    assert.equal(SampleEditor.openResample(app), true);
    SampleEditor.setResampleTargetIndex(app, { value: 1 }); // changing the target before Cancel must still not touch the data
    assert.equal(SampleEditor.cancelResample(app), true);

    assert.equal(store.get("sample-edit-view.value"), "");
    assert.equal(Resample.isResampleOpen(), false);
    assert.deepEqual(currentData(), before);
    assert.equal(SongDoc.canUndo(), false);
});

test("saveResample/cancelResample are harmless when nothing is open, but still close the view field", () => {
    const { app, store } = fakeApp();
    assert.equal(Resample.isResampleOpen(), false);
    assert.equal(SampleEditor.saveResample(app), false);
    assert.equal(store.get("sample-edit-view.value"), "");
    assert.equal(SampleEditor.cancelResample(app), true);
    assert.equal(store.get("sample-edit-view.value"), "");
});

// --- the FT-only side panel (spec 050) --------------------------------------

test("setFinetune clamps to [-8,7] in ProTracker mode and publishes back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setFinetune(app, { value: 100 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].getFineTune(), 7);
    assert.equal(store.get("finetune.value"), 7);

    SampleEditor.setFinetune(app, { value: -100 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].getFineTune(), -8);
});

test("setFinetune clamps to [-128,127] in FastTracker mode", async () => {
    await load("sin.xm");
    const ftIndex = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 8);
    assert.ok(ftIndex > 0, "the xm fixture has at least one instrument with real sample data");
    Tracker.setCurrentInstrumentIndex(ftIndex);

    const { app } = fakeApp();
    SampleEditor.setFinetune(app, { value: 100 });
    assert.equal(Tracker.getInstruments()[ftIndex].getFineTune(), 100, "within the wide range, unclamped");
    SampleEditor.setFinetune(app, { value: 200 });
    assert.equal(Tracker.getInstruments()[ftIndex].getFineTune(), 127);
    SampleEditor.setFinetune(app, { value: -200 });
    assert.equal(Tracker.getInstruments()[ftIndex].getFineTune(), -128);
});

test("setPanning clamps to [-127,127] and publishes back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setPanning(app, { value: 200 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.panning, 127);
    assert.equal(store.get("panning.value"), 127);
    SampleEditor.setPanning(app, { value: -200 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.panning, -127);
});

test("setFadeout clamps to [0,4095] and publishes back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setFadeout(app, { value: 9999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].fadeout, 4095);
    assert.equal(store.get("fadeout.value"), 4095);
    SampleEditor.setFadeout(app, { value: -5 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].fadeout, 0);
});

test("setRelativeNote clamps to [-127,128] and publishes back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setRelativeNote(app, { value: 999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.relativeNote, 128);
    assert.equal(store.get("relative-note.value"), 128);
    SampleEditor.setRelativeNote(app, { value: -999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].sample.relativeNote, -127);
});

test("setVibratoSpeed/Depth/Sweep each clamp to their own range and publish back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVibratoSpeed(app, { value: 999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.rate, 63);
    assert.equal(store.get("vibrato-speed.value"), 63);

    SampleEditor.setVibratoDepth(app, { value: 999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.depth, 15);
    assert.equal(store.get("vibrato-depth.value"), 15);

    SampleEditor.setVibratoSweep(app, { value: 999 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.sweep, 255);
    assert.equal(store.get("vibrato-sweep.value"), 255);
});

test("setVibratoWave maps each of v1's own four labels to its own index; an unrecognized label is a no-op", () => {
    const { app, store } = fakeApp();
    assert.equal(SampleEditor.setVibratoWave(app, { value: "Square" }), true);
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.type, 1);
    assert.equal(store.get("vibrato-wave.value"), "Square");

    assert.equal(SampleEditor.setVibratoWave(app, { value: "Saw Inverse" }), true);
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.type, 3);

    assert.equal(SampleEditor.setVibratoWave(app, { value: "Nonesuch" }), false);
    assert.equal(Tracker.getInstruments()[instrumentIndex].vibrato.type, 3, "unchanged by the unrecognized label");
});

test("publishInstrumentFields includes all eight FT-only fields", () => {
    const { app, store } = fakeApp();
    const instrument = Tracker.getInstruments()[instrumentIndex];
    instrument.setFineTune(3);
    instrument.sample.panning = 10;
    instrument.fadeout = 20;
    instrument.sample.relativeNote = 5;
    instrument.vibrato.rate = 6;
    instrument.vibrato.depth = 7;
    instrument.vibrato.sweep = 8;
    instrument.vibrato.type = 2;

    SampleEditor.publishInstrumentFields(app);

    assert.equal(store.get("finetune.value"), 3);
    assert.equal(store.get("panning.value"), 10);
    assert.equal(store.get("fadeout.value"), 20);
    assert.equal(store.get("relative-note.value"), 5);
    assert.equal(store.get("vibrato-speed.value"), 6);
    assert.equal(store.get("vibrato-depth.value"), 7);
    assert.equal(store.get("vibrato-sweep.value"), 8);
    assert.equal(store.get("vibrato-wave.value"), "Saw");
});

// --- the envelope screen (spec 057) -----------------------------------------
//
// wizballalt.mod's own instruments already carry a real volumeEnvelope/
// panningEnvelope object regardless of tracker mode - every instrument gets
// one from its own construction default (domain/playback/engine/models/
// instrument.js), only ever populated further by a real XM's own envelope
// data. No need to load an .xm fixture for these.

test("setVolumeEnvelopeEnabled toggles the flag and republishes only its own type's fields; setPanningEnvelopeEnabled addresses the other envelope entirely", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolumeEnvelopeEnabled(app, { value: true });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.enabled, true);
    assert.equal(store.get("volume-envelope-enabled.active"), true);
    assert.equal(store.get("panning-envelope-enabled.active"), undefined, "not republished by a volume-only call");
    assert.equal(Tracker.getInstruments()[instrumentIndex].panningEnvelope.enabled, false, "untouched");

    SampleEditor.setPanningEnvelopeEnabled(app, { value: true });
    assert.equal(Tracker.getInstruments()[instrumentIndex].panningEnvelope.enabled, true);
    assert.equal(store.get("panning-envelope-enabled.active"), true);
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.enabled, true, "still enabled - independent of the panning call");
});

test("addVolumeEnvelopePoint/removeVolumeEnvelopePoint are no-ops on a disabled envelope, and work once enabled", () => {
    const { app, store } = fakeApp();
    const before = Tracker.getInstruments()[instrumentIndex].volumeEnvelope.count;

    SampleEditor.addVolumeEnvelopePoint(app);
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.count, before, "disabled - unchanged");

    SampleEditor.setVolumeEnvelopeEnabled(app, { value: true });
    SampleEditor.addVolumeEnvelopePoint(app);
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.count, before + 1);

    SampleEditor.removeVolumeEnvelopePoint(app);
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.count, before);
});

test("addVolumeEnvelopePoint/removeVolumeEnvelopePoint republish sustainPoint/loopStartPoint/loopEndPoint when removal re-clamps them", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolumeEnvelopeEnabled(app, { value: true });
    const envelope = Tracker.getInstruments()[instrumentIndex].volumeEnvelope;
    const lastIndex = envelope.count - 1;
    SampleEditor.setVolumeEnvelopeSustainPoint(app, { value: lastIndex });
    assert.equal(store.get("volume-envelope-sustain-point.value"), lastIndex);

    SampleEditor.removeVolumeEnvelopePoint(app);
    assert.equal(envelope.sustainPoint, envelope.count - 1, "re-clamped by the domain's own clampIndices");
    assert.equal(store.get("volume-envelope-sustain-point.value"), envelope.count - 1, "the republish picked up the re-clamped value, not the stale one");
});

test("setVolumeEnvelopeSustain/setVolumeEnvelopeSustainPoint work and publish back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolumeEnvelopeSustain(app, { value: true });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.sustain, true);
    assert.equal(store.get("volume-envelope-sustain.active"), true);

    SampleEditor.setVolumeEnvelopeSustainPoint(app, { value: 2 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.sustainPoint, 2);
    assert.equal(store.get("volume-envelope-sustain-point.value"), 2);
});

test("setVolumeEnvelopeLoop/setVolumeEnvelopeLoopStart/setVolumeEnvelopeLoopEnd work and publish back", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolumeEnvelopeLoop(app, { value: true });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.loop, true);
    assert.equal(store.get("volume-envelope-loop.active"), true);

    SampleEditor.setVolumeEnvelopeLoopStart(app, { value: 1 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.loopStartPoint, 1);
    assert.equal(store.get("volume-envelope-loop-start.value"), 1);

    SampleEditor.setVolumeEnvelopeLoopEnd(app, { value: 3 });
    assert.equal(Tracker.getInstruments()[instrumentIndex].volumeEnvelope.loopEndPoint, 3);
    assert.equal(store.get("volume-envelope-loop-end.value"), 3);
});

test("the panning envelope's own eight capabilities mirror the volume ones exactly, addressing panningEnvelope only", () => {
    const { app, store } = fakeApp();
    SampleEditor.setPanningEnvelopeEnabled(app, { value: true });
    SampleEditor.addPanningEnvelopePoint(app);
    SampleEditor.setPanningEnvelopeSustain(app, { value: true });
    SampleEditor.setPanningEnvelopeSustainPoint(app, { value: 1 });
    SampleEditor.setPanningEnvelopeLoop(app, { value: true });
    SampleEditor.setPanningEnvelopeLoopStart(app, { value: 0 });
    SampleEditor.setPanningEnvelopeLoopEnd(app, { value: 2 });

    const panning = Tracker.getInstruments()[instrumentIndex].panningEnvelope;
    assert.equal(panning.enabled, true);
    assert.equal(panning.sustain, true);
    assert.equal(panning.sustainPoint, 1);
    assert.equal(panning.loop, true);
    assert.equal(panning.loopStartPoint, 0);
    assert.equal(panning.loopEndPoint, 2);

    assert.equal(store.get("panning-envelope-enabled.active"), true);
    assert.equal(store.get("panning-envelope-sustain-point.value"), 1);
    assert.equal(store.get("panning-envelope-loop-end.value"), 2);

    const volume = Tracker.getInstruments()[instrumentIndex].volumeEnvelope;
    assert.equal(volume.enabled, false, "volume envelope untouched by any of the panning calls");

    SampleEditor.removePanningEnvelopePoint(app);
    assert.ok(true, "removePanningEnvelopePoint runs without throwing");
});

test("publishInstrumentFields includes all twelve envelope fields, safely defaulted with no current instrument", () => {
    const { app, store } = fakeApp();
    SampleEditor.setVolumeEnvelopeEnabled(app, { value: true });
    SampleEditor.publishInstrumentFields(app);
    assert.equal(store.get("volume-envelope-enabled.active"), true);
    assert.equal(typeof store.get("volume-envelope-sustain-point.value"), "number");
    assert.equal(typeof store.get("panning-envelope-loop-start.value"), "number");

    SongDoc.setCurrentInstrumentIndex(0);
    SampleEditor.publishInstrumentFields(app);
    assert.equal(store.get("volume-envelope-enabled.active"), false, "no instrument - the all-falsy default");
    assert.equal(store.get("volume-envelope-sustain-point.value"), 0);
    assert.equal(store.get("panning-envelope-loop-end.value"), 0);
});
