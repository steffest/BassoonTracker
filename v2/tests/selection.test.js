import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import { normalizeRange, createSelectionState } from "../domain/song/selection.js";
import { duplicateNote, EMPTY_NOTE_DATA } from "../domain/song/noteData.js";
import * as SongDoc from "../domain/song/index.js";

// Spec 029: a rectangular block selection and one clipboard, built on spec
// 028's own undo/mutation primitives. Read from
// script/src/ui/app/components/patternView.js's own _range/_rangeCopy.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

// --- selection.js, pure ----------------------------------------------------

test("normalizeRange: sorts either drag direction into the same rectangle", () => {
    const downRight = normalizeRange({ start: { row: 2, track: 0 }, end: { row: 5, track: 2 } });
    const upLeft = normalizeRange({ start: { row: 5, track: 2 }, end: { row: 2, track: 0 } });
    assert.deepEqual(downRight, { top: 2, bottom: 5, left: 0, right: 2 });
    assert.deepEqual(upLeft, { top: 2, bottom: 5, left: 0, right: 2 });
});

test("normalizeRange: null range normalizes to null", () => {
    assert.equal(normalizeRange(null), null);
});

test("createSelectionState: range and clipboard are independent slots", () => {
    const state = createSelectionState();
    assert.equal(state.getRange(), null);
    assert.equal(state.getClipboard(), null);
    state.setRange({ start: { row: 0, track: 0 }, end: { row: 0, track: 0 } });
    assert.ok(state.getRange());
    assert.equal(state.getClipboard(), null, "setting a range does not touch the clipboard");
});

// --- domain/song/index.js, integrated against a real loaded module ---------

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
    SongDoc.resetSelection();
    SongDoc.clearClipboard();
});

test("beginSelection/extendSelection build a normalized rectangle", () => {
    assert.equal(SongDoc.hasSelection(), false);
    SongDoc.beginSelection(1, 0);
    SongDoc.extendSelection(3, 2);
    assert.deepEqual(SongDoc.getSelectionRange(), { top: 1, bottom: 3, left: 0, right: 2 });
    assert.equal(SongDoc.hasSelection(), true);

    SongDoc.resetSelection();
    assert.equal(SongDoc.hasSelection(), false);
    assert.equal(SongDoc.getSelectionRange(), null);
});

test("extendSelection with no prior range behaves like beginSelection", () => {
    SongDoc.extendSelection(4, 1);
    assert.deepEqual(SongDoc.getSelectionRange(), { top: 4, bottom: 4, left: 1, right: 1 });
});

test("selectAll selects the current track's full row range", () => {
    const patternData = Tracker.getSong().patterns[0];
    SongDoc.setCurrentTrack(2);
    SongDoc.selectAll();
    assert.deepEqual(SongDoc.getSelectionRange(), { top: 0, bottom: patternData.length - 1, left: 2, right: 2 });
});

test("selectionCopy reads the selection into the clipboard without mutating the document", () => {
    const pattern = Tracker.getSong().patterns[0];
    const before = pattern.map(row => row.map(note => duplicateNote(note)));

    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(2, 1);
    assert.equal(SongDoc.hasClipboard(), false);
    const copied = SongDoc.selectionCopy();
    assert.equal(copied, true);
    assert.equal(SongDoc.hasClipboard(), true);

    const clipboard = SongDoc.getClipboard();
    assert.equal(clipboard.height, 3);
    assert.equal(clipboard.width, 2);
    assert.deepEqual(clipboard.rows[0][0], duplicateNote(pattern[0][0]));
    assert.deepEqual(clipboard.rows[2][1], duplicateNote(pattern[2][1]));

    assert.deepEqual(pattern.map(row => row.map(note => duplicateNote(note))), before, "copy never mutates the document");
    assert.equal(SongDoc.canUndo(), false, "copy registers no undo action");
});

test("selectionCopy with no active selection is a no-op", () => {
    assert.equal(SongDoc.selectionCopy(), false);
    assert.equal(SongDoc.hasClipboard(), false);
});

test("selectionClear clears exactly the selected cells as one undoable action", () => {
    SongDoc.setCurrentTrack(0);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.putNote({ instrument: 4, period: 100 });
    SongDoc.setCurrentPatternPos(1);
    SongDoc.putNote({ instrument: 4, period: 110 });
    SongDoc.clearHistory();

    const pattern = Tracker.getSong().patterns[0];
    const untouchedRow2 = duplicateNote(pattern[2][0]);

    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(1, 0);
    SongDoc.selectionClear();
    assert.equal(pattern[0][0].instrument, 0);
    assert.equal(pattern[1][0].instrument, 0);
    assert.deepEqual(duplicateNote(pattern[2][0]), untouchedRow2, "outside the selection is untouched");

    assert.equal(SongDoc.canUndo(), true);
    SongDoc.undo();
    assert.equal(pattern[0][0].instrument, 4);
    assert.equal(pattern[0][0].period, 100);
    assert.equal(pattern[1][0].instrument, 4);
    assert.equal(pattern[1][0].period, 110);
});

test("selectionCut copies then clears as one undo step", () => {
    const pattern = Tracker.getSong().patterns[0];
    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(1, 1);
    const before = [[duplicateNote(pattern[0][0]), duplicateNote(pattern[0][1])], [duplicateNote(pattern[1][0]), duplicateNote(pattern[1][1])]];

    SongDoc.selectionCut();
    assert.equal(SongDoc.hasClipboard(), true);
    assert.deepEqual(SongDoc.getClipboard().rows, before);
    assert.ok(pattern[0][0].instrument === 0 && pattern[1][1].instrument === 0);

    SongDoc.undo();
    assert.deepEqual(duplicateNote(pattern[0][0]), before[0][0]);
    assert.deepEqual(duplicateNote(pattern[1][1]), before[1][1]);
    assert.equal(SongDoc.canUndo(), false, "cut is exactly one undo step");
});

test("selectionPaste writes the clipboard at the current selection and survives a pattern switch", () => {
    SongDoc.setCurrentPattern(0);
    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(1, 1);
    SongDoc.putNote({ instrument: 5, period: 100 }); // row 0 track 0 (cursor still there from beforeEach)
    SongDoc.selectionCopy();

    SongDoc.setCurrentPattern(1); // auto-creates an empty pattern
    SongDoc.beginSelection(3, 0);
    SongDoc.selectionPaste();

    const patternOne = Tracker.getSong().patterns[1];
    assert.equal(patternOne[3][0].instrument, 5);
    assert.equal(patternOne[3][0].period, 100);

    assert.equal(SongDoc.canUndo(), true);
    SongDoc.undo();
    assert.equal(patternOne[3][0].instrument, 0, "one undo step reverts the whole pasted block");
});

test("selectionPaste with no active selection targets the current cursor", () => {
    SongDoc.beginSelection(0, 0);
    SongDoc.putNote({ instrument: 6, period: 120 });
    SongDoc.selectionCopy();
    SongDoc.resetSelection();

    SongDoc.setCurrentPatternPos(4);
    SongDoc.setCurrentTrack(1);
    SongDoc.selectionPaste();

    const pattern = Tracker.getSong().patterns[0];
    assert.equal(pattern[4][1].instrument, 6);
    assert.equal(pattern[4][1].period, 120);
});

test("selectionPaste clips to the pattern's row count and the current track count", () => {
    const pattern = Tracker.getSong().patterns[0];
    const trackCount = Tracker.getTrackCount();
    SongDoc.setCurrentTrack(trackCount - 1);
    SongDoc.setCurrentPatternPos(0);
    SongDoc.putNote({ instrument: 8, period: 100 });
    SongDoc.beginSelection(0, trackCount - 1);
    SongDoc.extendSelection(0, trackCount - 1);
    SongDoc.selectionCopy();

    // Paste starting one column before the last, spanning past the track count.
    SongDoc.beginSelection(pattern.length - 1, trackCount - 1);
    assert.doesNotThrow(() => SongDoc.selectionPaste());

    // Paste starting at the last row: nothing past the end should be written or throw.
    SongDoc.beginSelection(pattern.length - 1, 0);
    const clipboard = SongDoc.getClipboard();
    clipboard.rows.push(clipboard.rows[0]); // pretend a two-row clipboard past the last row
    assert.doesNotThrow(() => SongDoc.selectionPaste());
});

test("selectionCopy/selectionClear/selectionPaste with no clipboard/selection return false rather than throwing", () => {
    assert.equal(SongDoc.selectionClear(), false);
    assert.equal(SongDoc.selectionPaste(), false);
});

test("clearClipboard empties an addressable clipboard explicitly", () => {
    SongDoc.beginSelection(0, 0);
    SongDoc.selectionCopy();
    assert.equal(SongDoc.hasClipboard(), true);
    SongDoc.clearClipboard();
    assert.equal(SongDoc.hasClipboard(), false);
    assert.equal(SongDoc.getClipboard(), null);
});
