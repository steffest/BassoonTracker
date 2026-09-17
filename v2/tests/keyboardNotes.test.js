import { test } from "node:test";
import assert from "node:assert/strict";
import { keyboardNoteFor, resolveNote, resolveColumnValue } from "../domain/song/keyboardNotes.js";

// Spec 031: physical-key-to-note resolution, ported from script/src/enum.js
// and script/src/ui/input.js's handleNoteOn. Pure - fake tables, no loaded
// song needed.

test("keyboardNoteFor resolves a representative sample of physical keys, and null for an unmapped one", () => {
    assert.equal(keyboardNoteFor("KeyZ"), 1, "C at the current octave");
    assert.equal(keyboardNoteFor("KeyS"), 2, "C# at the current octave");
    assert.equal(keyboardNoteFor("KeyM"), 12, "B at the current octave");
    assert.equal(keyboardNoteFor("KeyQ"), 13, "C one octave up");
    assert.equal(keyboardNoteFor("KeyO"), 27, "D two octaves up");
    assert.equal(keyboardNoteFor("Backquote"), 0, "note-off");
    assert.equal(keyboardNoteFor("Backslash"), 0, "note-off, the second binding");
    assert.equal(keyboardNoteFor("KeyA"), null, "unmapped");
    assert.equal(keyboardNoteFor("Escape"), null, "unmapped");
});

// --- resolveNote -------------------------------------------------------------

const NOTE_PERIOD = { C1: { period: 856 }, Cs1: { period: 808 }, C0: { period: 900 } };
const FT_NOTES = { 25: { period: 500 } }; // offset=1, octave=2 -> index = 2*12+1 = 25

test("resolveNote (ProTracker/non-FT): note name + octave looks up NOTEPERIOD, index is always 0", () => {
    const result = resolveNote(1, 1, false, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES });
    assert.deepEqual(result, { period: 856, index: 0 }, "C at keyboard-octave 1 -> C1 in NOTEPERIOD's own (octave-1) naming");
});

test("resolveNote (ProTracker/non-FT): a note-off resolves to null - MOD cannot represent one", () => {
    const result = resolveNote(0, 1, false, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES });
    assert.equal(result, null, "NOTEPERIOD has no OFF entries at all");
});

test("resolveNote (FastTracker/FT): a note-off resolves to a real note-off marker", () => {
    const result = resolveNote(0, 2, true, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES });
    assert.deepEqual(result, { period: 1, index: 0 });
});

test("resolveNote (FastTracker/FT): a mapped semitone looks up FTNotes by octave*12+offset", () => {
    const result = resolveNote(1, 2, true, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES });
    assert.deepEqual(result, { period: 500, index: 25 });
});

test("resolveNote: an out-of-range octave/offset combination with no table entry resolves to null, not throwing", () => {
    assert.equal(resolveNote(1, 99, false, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES }), null);
    assert.equal(resolveNote(1, 99, true, { notePeriod: NOTE_PERIOD, ftNotes: FT_NOTES }), null);
});

// --- resolveColumnValue --------------------------------------------------------

test("resolveColumnValue: plain hex columns accept 0-9A-Fa-f and reject everything else", () => {
    assert.equal(resolveColumnValue(1, "3", false), 3);
    assert.equal(resolveColumnValue(1, "f", false), 15);
    assert.equal(resolveColumnValue(1, "F", false), 15);
    assert.equal(resolveColumnValue(1, "g", false), null);
    assert.equal(resolveColumnValue(1, " ", false), null);
});

test("resolveColumnValue: the FastTracker volume column (3) accepts only its own mnemonics, overriding what a plain hex read would give", () => {
    assert.equal(resolveColumnValue(3, "0", true), 0);
    assert.equal(resolveColumnValue(3, "4", true), 4);
    assert.equal(resolveColumnValue(3, "-", true), 5);
    assert.equal(resolveColumnValue(3, "+", true), 6);
    assert.equal(resolveColumnValue(3, "d", true), 7);
    assert.equal(resolveColumnValue(3, "D", true), 7);
    assert.equal(resolveColumnValue(3, "u", true), 8);
    assert.equal(resolveColumnValue(3, "s", true), 9);
    assert.equal(resolveColumnValue(3, "v", true), 10);
    assert.equal(resolveColumnValue(3, "p", true), 11);
    assert.equal(resolveColumnValue(3, "<", true), 12);
    assert.equal(resolveColumnValue(3, ">", true), 13);
    assert.equal(resolveColumnValue(3, "M", true), 14);
    assert.equal(resolveColumnValue(3, "f", true), null, "a valid hex digit, but not a volume mnemonic - column 3 rejects it");
    assert.equal(resolveColumnValue(3, "5", true), null, "digits 5-9 are not volume mnemonics either");
});

test("resolveColumnValue: the FastTracker effect column (5) accepts base-36, not just hex", () => {
    assert.equal(resolveColumnValue(5, "z", true), parseInt("z", 36));
    assert.equal(resolveColumnValue(5, "9", true), 9);
    assert.equal(resolveColumnValue(5, "!", true), null);
});

test("resolveColumnValue: column 3/5's special cases only apply in FastTracker mode - outside it, they are plain hex columns like any other", () => {
    assert.equal(resolveColumnValue(3, "d", false), 13, "\"d\" is a valid hex digit; the FT mnemonic override does not apply outside FT mode");
    assert.equal(resolveColumnValue(3, "-", false), null, "\"-\" is not a hex digit and there is no mnemonic table outside FT mode");
    assert.equal(resolveColumnValue(5, "z", false), null, "base-36 only applies in FT mode - \"z\" is not a hex digit");
    assert.equal(resolveColumnValue(5, "9", false), 9, "still plain hex outside FT mode");
});
