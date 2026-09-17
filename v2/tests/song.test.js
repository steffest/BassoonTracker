import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import { createEditHistory, EDITACTION } from "../domain/song/editHistory.js";
import { duplicateNote, populateNote, EMPTY_NOTE_DATA } from "../domain/song/noteData.js";
import * as SongDoc from "../domain/song/index.js";

// Spec 028: pattern editing and undo, read from script/src/editor.js and
// script/src/ui/stateManager.js in full. editHistory/noteData are pure and
// tested standalone; domain/song/index.js is tested against the same real
// fixtures tests/playback.test.js already uses, since it edits the exact
// object the engine schedules from.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

// --- editHistory.js, pure -------------------------------------------------

test("editHistory: registers, undoes and redoes through the injected replay", () => {
    const applied = [];
    const history = createEditHistory({ applyPatternDiff: (action, direction) => applied.push([action.id, direction]) });
    const action = { type: EDITACTION.NOTE, id: 3, name: "Note", data: [] };
    history.registerEdit(action);
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), false);

    history.undo();
    assert.deepEqual(applied, [[3, "undo"]]);
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), true);

    history.redo();
    assert.deepEqual(applied, [[3, "undo"], [3, "redo"]]);
});

test("editHistory: a new edit clears the redo stack", () => {
    const history = createEditHistory({ applyPatternDiff: () => {} });
    history.registerEdit({ type: EDITACTION.NOTE, id: 1, data: [] });
    history.undo();
    assert.equal(history.canRedo(), true);
    history.registerEdit({ type: EDITACTION.NOTE, id: 2, data: [] });
    assert.equal(history.canRedo(), false);
});

test("editHistory: sequential same-id VALUE edits coalesce into one entry", () => {
    const history = createEditHistory({ applyPatternDiff: () => {} });
    let calls = 0;
    const target = { setValue: (v) => { calls++; assert.equal(v, 0, "undo restores the first edit's own 'from', not an intermediate one"); } };

    history.registerEdit({ type: EDITACTION.VALUE, id: "slider1", target, from: 0, to: 1 });
    history.registerEdit({ type: EDITACTION.VALUE, id: "slider1", target, from: 0, to: 2 });
    history.registerEdit({ type: EDITACTION.VALUE, id: "slider1", target, from: 0, to: 3 });

    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(calls, 1, "one coalesced entry, not three");
    assert.equal(history.canUndo(), false, "the three coalesced into exactly one undo step");
});

test("editHistory: a hard cap of 100 drops the oldest entry", () => {
    const history = createEditHistory({ applyPatternDiff: () => {} });
    for (let i = 0; i < 101; i++) history.registerEdit({ type: EDITACTION.NOTE, id: i, data: [] });
    let count = 0;
    while (history.canUndo()) { history.undo(); count++; }
    assert.equal(count, 100, "the 101st push evicted the oldest of the first 100");
});

test("editHistory: undo/redo labels report the most recent action's name", () => {
    const history = createEditHistory({ applyPatternDiff: () => {} });
    history.registerEdit({ type: EDITACTION.TRACK, id: 0, name: "Clear Track", data: [] });
    assert.equal(history.getUndoLabel(), "Undo Clear Track");
    history.undo();
    assert.equal(history.getRedoLabel(), "Redo Clear Track");
});

test("editHistory: a SAMPLE-kind action is a graceful no-op when no applySampleDiff is supplied (spec 040 wires the real one in domain/song/index.js)", () => {
    const history = createEditHistory({ applyPatternDiff: () => { throw new Error("should not be called"); } });
    history.registerEdit({ type: EDITACTION.SAMPLE, id: "s", data: [] });
    assert.doesNotThrow(() => history.undo());
});

test("editHistory: a SAMPLE-kind action replays through applySampleDiff when one is supplied", () => {
    const calls = [];
    const history = createEditHistory({
        applyPatternDiff: () => { throw new Error("should not be called"); },
        applySampleDiff: (action, direction) => calls.push([action.id, direction])
    });
    history.registerEdit({ type: EDITACTION.SAMPLE, id: "s", data: [] });
    history.undo();
    assert.deepEqual(calls, [["s", "undo"]]);
    history.redo();
    assert.deepEqual(calls, [["s", "undo"], ["s", "redo"]]);
});

// --- noteData.js, pure -----------------------------------------------------

test("noteData: duplicateNote/populateNote round trip every field", () => {
    const note = { instrument: 5, period: 214, effect: 12, param: 64, volumeEffect: 68, index: 37 };
    const data = duplicateNote(note);
    assert.deepEqual(data, { instrument: 5, period: 214, effect: 12, param: 64, volumeEffect: 68, note: 37 });

    const target = { instrument: 0, period: 0, effect: 0, param: 0, volumeEffect: 0, index: 0 };
    populateNote(target, data);
    assert.equal(target.instrument, 5);
    assert.equal(target.period, 214);
    assert.equal(target.effect, 12);
    assert.equal(target.param, 64);
    assert.equal(target.volumeEffect, 68);
    assert.equal(target.index, 37);
});

test("noteData: EMPTY_NOTE_DATA is all zero and populateNote defaults missing fields to zero", () => {
    assert.deepEqual(EMPTY_NOTE_DATA, { instrument: 0, period: 0, effect: 0, param: 0, volumeEffect: 0, note: 0 });
    const target = { instrument: 9, period: 9, effect: 9, param: 9, volumeEffect: 9, index: 9 };
    populateNote(target, {});
    assert.deepEqual(
        { instrument: target.instrument, period: target.period, effect: target.effect, param: target.param, volumeEffect: target.volumeEffect, index: target.index },
        { instrument: 0, period: 0, effect: 0, param: 0, volumeEffect: 0, index: 0 }
    );
});

// --- domain/song/index.js, integrated against a real loaded module --------

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
    SongDoc.clearHistory();
    SongDoc.setCurrentPattern(0);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.setCurrentTrack(0);
});

test("cursor/position: track and column derive from one cursor index, wrapping at the ends", () => {
    SongDoc.setCurrentCursorPosition(0);
    assert.equal(SongDoc.getCurrentTrack(), 0);
    assert.equal(SongDoc.getCurrentTrackPosition(), 0);

    SongDoc.setCurrentTrack(2);
    assert.equal(SongDoc.getCurrentTrack(), 2);

    SongDoc.setCurrentCursorPosition(0);
    SongDoc.moveCursorPosition(-1);
    const max = Tracker.getTrackCount() * (Tracker.inFTMode() ? 8 : 6) - 1;
    assert.equal(SongDoc.getCurrentCursorPosition(), max, "moving before the first cell wraps to the last cell");
    assert.equal(SongDoc.getCurrentTrack(), Tracker.getTrackCount() - 1, "which is in the last track");
});

test("pattern/song position delegate to Tracker rather than duplicating it", () => {
    SongDoc.setCurrentPattern(0);
    assert.equal(SongDoc.getCurrentPattern(), Tracker.getCurrentPattern());
    SongDoc.setCurrentPatternPos(5);
    assert.equal(SongDoc.getCurrentPatternPos(), Tracker.getCurrentPatternPos());
});

test("putNote writes a cell and undo/redo restores it exactly", () => {
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(1);
    const before = duplicateNote(Tracker.getSong().patterns[0][1][0]);

    SongDoc.putNote({ instrument: 3, period: 214 });
    const after = Tracker.getSong().patterns[0][1][0];
    assert.equal(after.instrument, 3);
    assert.equal(after.period, 214);
    assert.equal(SongDoc.canUndo(), true);

    SongDoc.undo();
    assert.deepEqual(duplicateNote(Tracker.getSong().patterns[0][1][0]), before);
    assert.equal(SongDoc.canRedo(), true);

    SongDoc.redo();
    const redone = Tracker.getSong().patterns[0][1][0];
    assert.equal(redone.instrument, 3);
    assert.equal(redone.period, 214);
});

// --- Spec 051 additions: getInstrumentAt, getRawNoteName, moveNote --------

test("getInstrumentAt: an arbitrary instrument by index, not only the current one", () => {
    SongDoc.setCurrentInstrumentIndex(5);
    const current = SongDoc.getCurrentInstrument();
    SongDoc.setCurrentInstrumentIndex(1);
    assert.equal(SongDoc.getInstrumentAt(5), current);
});

test("getRawNoteName: checks index before period, unconditionally of tracker mode - matching v1's own _getNoteName exactly, unlike formatNoteName's mode-branching lookup", () => {
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(2);
    SongDoc.putNote({ instrument: 1, period: 214 });
    // setPeriod() also back-fills note.index (FTPeriods[period]), so even in
    // ProTracker mode getRawNoteName's own index-first check wins over the
    // period - a real, deliberate difference from formatNoteName's own
    // mode-branching lookup, not a bug: v1's own multitrack.js#_getNoteName
    // has the identical, unconditional index-first shape.
    const note = Tracker.getSong().patterns[0][2][0];
    const indexName = SongDoc.getRawNoteName(note);
    const periodOnlyName = SongDoc.getRawNoteName({ period: note.period, index: 0 });
    assert.notEqual(indexName, "");
    assert.notEqual(periodOnlyName, "");
    assert.notEqual(indexName, periodOnlyName, "index-derived and period-derived names differ here, proving index took priority");
    assert.equal(SongDoc.getRawNoteName({ period: 0, index: 0 }), "");
    assert.equal(SongDoc.getRawNoteName(null), "");
});

test("moveNote: moves a note from an occupied cell to an empty one as one undo step", () => {
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(1);
    SongDoc.putNote({ instrument: 4, period: 200 });
    SongDoc.clearHistory();

    const result = SongDoc.moveNote(0, 1, 2, 6);
    assert.equal(result.moved, true);

    const srcAfter = Tracker.getSong().patterns[0][1][0];
    assert.equal(srcAfter.period, 0);
    assert.equal(srcAfter.instrument, 0);
    const dstAfter = Tracker.getSong().patterns[0][6][2];
    assert.equal(dstAfter.period, 200);
    assert.equal(dstAfter.instrument, 4);

    assert.equal(SongDoc.getCurrentTrack(), 2, "cursor follows the moved note");
    assert.equal(SongDoc.getCurrentPatternPos(), 6);
    assert.equal(SongDoc.canUndo(), true);

    SongDoc.undo();
    assert.equal(Tracker.getSong().patterns[0][1][0].period, 200, "source restored");
    assert.equal(Tracker.getSong().patterns[0][6][2].period, 0, "destination restored");

    SongDoc.redo();
    assert.equal(Tracker.getSong().patterns[0][1][0].period, 0);
    assert.equal(Tracker.getSong().patterns[0][6][2].period, 200);
});

test("moveNote: a no-op on an empty source cell registers nothing", () => {
    SongDoc.setCurrentPattern(0);
    const cell = Tracker.getSong().patterns[0][4][1];
    if (cell) cell.clear();
    SongDoc.clearHistory();

    const result = SongDoc.moveNote(1, 4, 2, 5);
    assert.equal(result.moved, false);
    assert.equal(SongDoc.canUndo(), false);
});

test("putNoteParam edits the effect/param nibbles in place", () => {
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(2);
    SongDoc.putNote({ instrument: 1, period: 214 });
    SongDoc.putNoteParam(3, 4);  // effect
    SongDoc.putNoteParam(4, 0); // param high nibble
    SongDoc.putNoteParam(5, 2); // param low nibble
    const note = Tracker.getSong().patterns[0][2][0];
    assert.equal(note.effect, 4);
    assert.equal(note.param, 0x02);
});

test("clearTrack clears every cell in the current track and undo restores them all", () => {
    const pattern = Tracker.getSong().patterns[0];
    SongDoc.setCurrentTrack(1);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.putNote({ instrument: 2, period: 100 });
    SongDoc.setCurrentPatternPos(1);
    SongDoc.putNote({ instrument: 2, period: 120 });
    SongDoc.clearHistory();

    const before = pattern.map(row => duplicateNote(row[1]));
    SongDoc.clearTrack();
    assert.ok(pattern.every(row => row[1].instrument === 0 && row[1].period === 0), "every cell in the track is cleared");

    SongDoc.undo();
    assert.deepEqual(pattern.map(row => duplicateNote(row[1])), before);
});

test("clearPattern clears every track and undo restores the whole pattern", () => {
    const pattern = Tracker.getSong().patterns[0];
    const before = pattern.map(row => row.map(note => duplicateNote(note)));

    SongDoc.clearPattern();
    for (const row of pattern) {
        for (const note of row) assert.equal(note.instrument, 0);
    }

    SongDoc.undo();
    assert.deepEqual(pattern.map(row => row.map(note => duplicateNote(note))), before);
});

test("insertNote shifts rows down and clears the current row, undoably (v1 itself has no undo here)", () => {
    const pattern = Tracker.getSong().patterns[0];
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(3);
    const rowThree = duplicateNote(pattern[3][0]);
    const rowFour = duplicateNote(pattern[4][0]);

    SongDoc.insertNote();
    assert.deepEqual(duplicateNote(pattern[3][0]), { ...EMPTY_NOTE_DATA }, "the current row is now empty");
    assert.deepEqual(duplicateNote(pattern[4][0]), rowThree, "the old row 3 shifted down to row 4");

    SongDoc.undo();
    assert.deepEqual(duplicateNote(pattern[3][0]), rowThree);
    assert.deepEqual(duplicateNote(pattern[4][0]), rowFour);
});

test("removeNote shifts rows up and clears the last row, undoably (v1 itself has no undo here)", () => {
    const pattern = Tracker.getSong().patterns[0];
    SongDoc.setCurrentTrack(0);
    const rowTwo = duplicateNote(pattern[2][0]);
    const rowThree = duplicateNote(pattern[3][0]);
    const lastIndex = pattern.length - 1;
    const lastRowBefore = duplicateNote(pattern[lastIndex][0]);

    SongDoc.removeNote(0, 3);
    assert.deepEqual(duplicateNote(pattern[2][0]), rowThree, "row 3 shifted up into row 2");
    assert.deepEqual(duplicateNote(pattern[lastIndex][0]), { ...EMPTY_NOTE_DATA }, "the last row is cleared");

    SongDoc.undo();
    assert.deepEqual(duplicateNote(pattern[2][0]), rowTwo);
    assert.deepEqual(duplicateNote(pattern[lastIndex][0]), lastRowBefore);
});

test("removeNote at step 0 is a no-op, matching v1", () => {
    const pattern = Tracker.getSong().patterns[0];
    const before = pattern.map(row => duplicateNote(row[0]));
    const result = SongDoc.removeNote(0, 0);
    assert.equal(result.changed, false);
    assert.deepEqual(pattern.map(row => duplicateNote(row[0])), before);
});

test("copyTrack/pasteTrack round-trip across a pattern switch, undoably", () => {
    SongDoc.setCurrentPattern(0);
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.putNote({ instrument: 7, period: 100 });
    const copied = SongDoc.copyTrack(0);

    SongDoc.setCurrentPattern(1); // creates an empty pattern 1 if none exists yet
    const before = duplicateNote(Tracker.getSong().patterns[1][0][0]);
    SongDoc.pasteTrack(0, copied);
    assert.equal(Tracker.getSong().patterns[1][0][0].instrument, 7);
    assert.equal(Tracker.getSong().patterns[1][0][0].period, 100);

    SongDoc.undo();
    assert.deepEqual(duplicateNote(Tracker.getSong().patterns[1][0][0]), before);
});

test("copyPattern/pastePattern moves a whole pattern's data in one undoable step", () => {
    SongDoc.setCurrentPattern(0);
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.putNote({ instrument: 9, period: 150 });
    const copied = SongDoc.copyPattern();

    SongDoc.setCurrentPattern(1);
    SongDoc.pastePattern(copied);
    assert.equal(Tracker.getSong().patterns[1][0][0].instrument, 9);
    assert.equal(SongDoc.canUndo(), true);

    SongDoc.undo();
    assert.equal(Tracker.getSong().patterns[1][0][0].instrument, 0, "one undo step reverts the whole pasted pattern");
});

test("pasteTrack/pastePattern with no data return false rather than throwing", () => {
    assert.equal(SongDoc.pasteTrack(0, null), false);
    assert.equal(SongDoc.pastePattern(null), false);
});

// --- spec 031: recording, octave, and the record.toggle capability --------

test("isRecording/setRecording/toggleRecording", () => {
    SongDoc.setRecording(false);
    assert.equal(SongDoc.isRecording(), false);
    SongDoc.setRecording(true);
    assert.equal(SongDoc.isRecording(), true);
    assert.equal(SongDoc.toggleRecording(), false);
    assert.equal(SongDoc.isRecording(), false);
    assert.equal(SongDoc.toggleRecording(), true);
});

test("getCurrentOctave/setCurrentOctave clamps to the current format's range, silently ignoring an out-of-range value", () => {
    SongDoc.setCurrentOctave(2);
    assert.equal(SongDoc.getCurrentOctave(), 2, "wizballalt.mod is ProTracker/MOD");
    SongDoc.setCurrentOctave(5);
    assert.equal(SongDoc.getCurrentOctave(), 2, "5 is outside [1,3]; ignored");
    SongDoc.setCurrentOctave(1);
    assert.equal(SongDoc.getCurrentOctave(), 1);
    SongDoc.setCurrentOctave(0);
    assert.equal(SongDoc.getCurrentOctave(), 1, "0 is outside [1,3] in this mode too");
});

// --- applyOctaveChange: the piano's own octave spinbox capability (062) ----

test("applyOctaveChange sets the actual value within range, and republishes it to app.state", () => {
    SongDoc.setCurrentOctave(2);
    const store = new Map();
    const app = { state: { set: (field, value) => store.set(field, value) }, log: () => {} };

    SongDoc.applyOctaveChange(app, { value: 3 });
    assert.equal(SongDoc.getCurrentOctave(), 3);
    assert.equal(store.get("current-octave.value"), 3);
});

test("applyOctaveChange republishes the *unchanged* current value, not the out-of-range request, when the request is clamped away", () => {
    SongDoc.setCurrentOctave(2); // wizballalt.mod is ProTracker/MOD - valid range [1,3]
    const store = new Map();
    const app = { state: { set: (field, value) => store.set(field, value) }, log: () => {} };

    SongDoc.applyOctaveChange(app, { value: 9 });
    assert.equal(SongDoc.getCurrentOctave(), 2, "9 is outside [1,3]; setCurrentOctave silently ignores it");
    assert.equal(store.get("current-octave.value"), 2, "republishes the real, unchanged value - not 9");
});

test("applyOctaveChange works with no app context at all", () => {
    SongDoc.setCurrentOctave(1);
    SongDoc.applyOctaveChange(undefined, { value: 3 });
    assert.equal(SongDoc.getCurrentOctave(), 3);
});

test("recordToggle: toggles with no detail, sets an explicit detail.value, and mirrors to app.state", () => {
    SongDoc.setRecording(false);
    const store = new Map();
    const app = { state: { set: (field, value) => store.set(field, value) }, log: () => {} };

    const next = SongDoc.recordToggle(app);
    assert.equal(next, true);
    assert.equal(SongDoc.isRecording(), true);
    assert.equal(store.get("record.active"), true);

    const explicit = SongDoc.recordToggle(app, { value: false });
    assert.equal(explicit, false);
    assert.equal(SongDoc.isRecording(), false);
    assert.equal(store.get("record.active"), false);
});

test("recordToggle works with no app context at all", () => {
    SongDoc.setRecording(false);
    assert.equal(SongDoc.recordToggle(), true);
    assert.equal(SongDoc.isRecording(), true);
});

// --- applySampleDiff's optional loop-bounds restore (spec 043) -------------

test("a SAMPLE-kind action's optional 'loop' field restores instrument.sample.loop.start/length in sync with the data, on both undo and redo", () => {
    const index = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 8);
    assert.ok(index > 0, "fixture has a usable instrument");
    Tracker.setCurrentInstrumentIndex(index);
    const instrument = Tracker.getInstruments()[index];
    const before = instrument.sample.data.slice();
    instrument.sample.loop.start = 2;
    instrument.sample.loop.length = 4;

    SongDoc.registerSampleEdit({
        type: SongDoc.EDITACTION.SAMPLE,
        instrument: index,
        from: 0,
        to: 4,
        data: before.slice(0, 4),
        dataTo: [9, 9, 9, 9],
        loop: { from: { start: 2, length: 4 }, to: { start: 6, length: 10 } },
        name: "Create Loop"
    });
    instrument.sample.data = [...[9, 9, 9, 9], ...before.slice(4)];
    instrument.sample.loop.start = 6;
    instrument.sample.loop.length = 10;

    SongDoc.undo();
    assert.deepEqual(instrument.sample.data.slice(0, 4), before.slice(0, 4), "data restored");
    assert.equal(instrument.sample.loop.start, 2, "loop bounds restored in the same undo, not left stale");
    assert.equal(instrument.sample.loop.length, 4);

    SongDoc.redo();
    assert.deepEqual(instrument.sample.data.slice(0, 4), [9, 9, 9, 9]);
    assert.equal(instrument.sample.loop.start, 6);
    assert.equal(instrument.sample.loop.length, 10);
});

test("a SAMPLE-kind action with no 'loop' field leaves the loop bounds untouched, exactly as before spec 043", () => {
    const index = Tracker.getInstruments().findIndex(instrument => instrument && instrument.sample && instrument.sample.data && instrument.sample.data.length >= 4);
    Tracker.setCurrentInstrumentIndex(index);
    const instrument = Tracker.getInstruments()[index];
    instrument.sample.loop.start = 12;
    instrument.sample.loop.length = 8;

    SongDoc.registerSampleEdit({ type: SongDoc.EDITACTION.SAMPLE, instrument: index, from: 0, to: 2, data: [0, 0], dataTo: [1, 1], name: "Invert" });
    SongDoc.undo();
    assert.equal(instrument.sample.loop.start, 12);
    assert.equal(instrument.sample.loop.length, 8);
});

// --- spec 071: pattern-table mutation, the two row lists, and the
// song-properties section's own thin spinbox capabilities ------------------

function fakeApp() {
    const store = new Map();
    return { app: { state: { set: (field, value) => store.set(field, value) }, log: () => {} }, store };
}

test("addToPatternTable: appends at the end by default, extending song.length by one", () => {
    const song = Tracker.getSong();
    const before = song.length;
    SongDoc.addToPatternTable();
    assert.equal(song.length, before + 1);
    assert.equal(song.patternTable[before], 0);
});

test("addToPatternTable: inserts at an explicit index, shifting later entries up", () => {
    const song = Tracker.getSong();
    // The real fixture (wizballalt.mod) has a song.length of 1 - grow it to
    // 2 first (a plain append, already covered by its own test above) so
    // there is a real "later entry" for an insert-in-the-middle to shift.
    SongDoc.addToPatternTable();
    song.patternTable[0] = 5;
    song.patternTable[1] = 6;
    const originalLength = song.length;
    SongDoc.addToPatternTable(0, 9);
    assert.equal(song.patternTable[0], 9);
    assert.equal(song.patternTable[1], 5);
    assert.equal(song.patternTable[2], 6);
    assert.equal(song.length, originalLength + 1);
});

test("removeFromPatternTable: removes the last entry by default, shrinking song.length by one", () => {
    const song = Tracker.getSong();
    SongDoc.addToPatternTable(); // the real fixture's own song.length is 1; removing needs a second entry first
    const before = song.length;
    SongDoc.removeFromPatternTable();
    assert.equal(song.length, before - 1);
});

test("removeFromPatternTable: never shrinks below length 1", () => {
    const song = Tracker.getSong();
    song.length = 1;
    SongDoc.removeFromPatternTable();
    assert.equal(song.length, 1);
});

test("removeFromPatternTable: clamps the current song position when it now points past the end", () => {
    const song = Tracker.getSong();
    song.length = 2;
    SongDoc.setCurrentSongPosition(1);
    SongDoc.removeFromPatternTable();
    assert.equal(song.length, 1);
    assert.equal(SongDoc.getCurrentSongPosition(), 0);
});

test("incrementPatternTableEntry/decrementPatternTableEntry: change one entry, decrement never goes below zero", () => {
    const song = Tracker.getSong();
    song.patternTable[0] = 0;
    SongDoc.decrementPatternTableEntry(0);
    assert.equal(song.patternTable[0], 0, "never negative");
    SongDoc.incrementPatternTableEntry(0);
    assert.equal(song.patternTable[0], 1);
    SongDoc.decrementPatternTableEntry(0);
    assert.equal(song.patternTable[0], 0);
});

test("publishSongPatternRows: one row per song-position entry, '<step>:<pattern>'", () => {
    const song = Tracker.getSong();
    song.length = 2;
    song.patternTable[0] = 3;
    song.patternTable[1] = 10;
    const { app, store } = fakeApp();
    SongDoc.publishSongPatternRows(app);
    const rows = store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList.list");
    assert.deepEqual(rows, [{ title: "01:03" }, { title: "02:10" }]);
});

test("publishInstrumentRows: one row per instrument slot, hex index plus name", () => {
    const { app, store } = fakeApp();
    SongDoc.setCurrentInstrumentIndex(1);
    Tracker.getInstrument(1).name = "lead";
    SongDoc.publishInstrumentRows(app);
    const rows = store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.instrumentGroup.instrumentList");
    assert.equal(rows.length, SongDoc.getMaxInstruments());
    // formatInstrumentIndex(1) is itself "1 " (space-padded to two
    // characters, matching every double-digit hex index's own width) -
    // v1's own real appMainPanel.js:106 concatenates a second literal space
    // after it regardless ("formatInstrumentIndex(i) + " " + name"), so a
    // single-digit index's own row title genuinely has two spaces, not one.
    // Ported verbatim, not "fixed".
    assert.equal(rows[0].title, "1  lead");
});

test("setCurrentPatternNumber: sets the real pattern and republishes it", () => {
    const { app, store } = fakeApp();
    SongDoc.setCurrentPatternNumber(app, { value: 1 });
    assert.equal(SongDoc.getCurrentPattern(), Tracker.getCurrentPattern());
    assert.equal(store.get("current-pattern.value"), SongDoc.getCurrentPattern());
});

test("setSongLength: growing calls addToPatternTable once, shrinking calls removeFromPatternTable once, and republishes the row list", () => {
    const song = Tracker.getSong();
    const before = song.length;
    const { app, store } = fakeApp();
    SongDoc.setSongLength(app, { value: before + 1 });
    assert.equal(song.length, before + 1);
    assert.equal(store.get("song-length.value"), before + 1);
    assert.ok(store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList.list"));

    SongDoc.setSongLength(app, { value: before });
    assert.equal(song.length, before);
});

test("setSongRepeat: sets song.restartPosition and republishes it", () => {
    const { app, store } = fakeApp();
    SongDoc.setSongRepeat(app, { value: 3 });
    assert.equal(Tracker.getSong().restartPosition, 3);
    assert.equal(store.get("song-repeat.value"), 3);
});

test("setPatternLength: sets the real pattern length and republishes it", () => {
    const { app, store } = fakeApp();
    SongDoc.setPatternLength(app, { value: 16 });
    assert.equal(SongDoc.getPatternLength(), 16);
    assert.equal(store.get("pattern-length.value"), 16);
});

test("setInstrumentRow: a 0-based row index selects the 1-based instrument, and republishes instrument-index.value", () => {
    const { app, store } = fakeApp();
    SongDoc.setInstrumentRow(app, { value: 2 });
    assert.equal(SongDoc.getCurrentInstrumentIndex(), 3);
    assert.equal(store.get("instrument-index.value"), 3);
});

test("openInstrumentInSampleEditor: selects the row's own instrument and unconditionally opens the sample editor", () => {
    const { app, store } = fakeApp();
    store.set("pattern-section-view.value", "Sample Edit"); // already open
    SongDoc.openInstrumentInSampleEditor(app, { value: 4 });
    assert.equal(SongDoc.getCurrentInstrumentIndex(), 5);
    assert.equal(store.get("pattern-section-view.value"), "Sample Edit", "stays open, now showing the newly-selected instrument");
});

test("setSongPatternRow: sets the current song position", () => {
    const song = Tracker.getSong();
    song.length = 3;
    const { app } = fakeApp();
    SongDoc.setSongPatternRow(app, { value: 2 });
    assert.equal(SongDoc.getCurrentSongPosition(), 2);
});

test("the song/pattern list's own four buttons act on whichever row setSongPatternRow last selected", () => {
    const song = Tracker.getSong();
    song.length = 2;
    song.patternTable[0] = 5;
    const { app } = fakeApp();
    SongDoc.setSongPatternRow(app, { value: 0 });

    SongDoc.incrementSelectedPatternRow(app);
    assert.equal(song.patternTable[0], 6);

    SongDoc.decrementSelectedPatternRow(app);
    assert.equal(song.patternTable[0], 5);

    const beforeInsert = song.length;
    SongDoc.insertAtSelectedPatternRow(app);
    assert.equal(song.length, beforeInsert + 1);

    const beforeDelete = song.length;
    SongDoc.deleteSelectedPatternRow(app);
    assert.equal(song.length, beforeDelete - 1);
});

test("publishSongProperties: republishes every song-properties field and both row lists at once", () => {
    const { app, store } = fakeApp();
    SongDoc.publishSongProperties(app);
    for (const field of ["current-pattern.value", "instrument-index.value", "song-length.value", "song-repeat.value", "pattern-length.value"]) {
        assert.ok(store.has(field), `${field} was published`);
    }
    assert.ok(store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList.list"));
    assert.ok(store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.instrumentGroup.instrumentList"));
});
