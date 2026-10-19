// The song-editing capability (spec 028), package P6 of the port roadmap.
//
// This is the only module anything outside `domain/song/` may import for
// editing. It is a second, narrow door onto the same document
// `domain/playback/` already owns: pattern editing has to mutate the exact
// object the scheduler reads from, not a copy, so this module imports the
// shared Tracker/Note singletons directly from `domain/playback/engine/` -
// the one documented exception to that folder's own "index.js only" rule
// (see domain/playback/README.md and domain/song/README.md).
//
// Ported from script/src/editor.js (the mutation operations) and
// script/src/ui/stateManager.js (the undo/redo history), read in full for
// this spec. Song-structural editing (pattern-table sequence, pattern
// length, track count, whole-song clear) was out of scope at the time -
// spec 071 is the point that scope naturally expands, the same way
// domain/sampleEditor grew across five later specs of its own.
//
// Spec 029 adds a rectangular block selection and one clipboard (ported
// from patternView.js's own _range/_rangeCopy) on top of the same undo/
// mutation primitives above - see that spec's design.md.
//
// Spec 071 adds the song-properties section's own always-present content:
// the pattern-table mutation primitives script/src/editor.js:372-416 always
// had (closing songPatternList.yaml's own four pre-existing mocked
// commands as a side effect, not a separate initiative - see that spec's
// requirements.md), the six spinboxes' own thin capabilities, and the two
// fileBrowser-typed row lists (song/pattern list, instrument list) this
// domain now publishes to.

import Tracker, { FTNotes, FTPeriods, periodNoteTable } from "../playback/engine/tracker.js";
import { NOTEOFF, NOTEPERIOD } from "../playback/engine/enum.js";
import Note from "../playback/engine/models/note.js";
import { createEditHistory, EDITACTION } from "./editHistory.js";
import { duplicateNote, populateNote, EMPTY_NOTE_DATA } from "./noteData.js";
import { createSelectionState, normalizeRange } from "./selection.js";
import { keyboardNoteFor, resolveNote, resolveColumnValue } from "./keyboardNotes.js";
import { formatInstrumentIndex } from "./format.js";
import { rowsFieldOf } from "../../runtime/fileBrowserController.js";
import { importRawSample, importXIInstrument } from "./sampleImport.js";

export { EDITACTION };

let currentTrack = 0;
let currentTrackPosition = 0;
let currentCursorPosition = 0;

function getStepsPerTrack() {
    return Tracker.inFTMode() ? 8 : 6;
}

/** Exported (spec 030): the cursor's own column count, needed by the grid's Tab-jump-a-track math. */
export { getStepsPerTrack };

export function getCurrentCursorPosition() {
    return currentCursorPosition;
}

export function setCurrentCursorPosition(index) {
    currentCursorPosition = index;
    const stepsPerTrack = getStepsPerTrack();
    currentTrack = Math.floor(currentCursorPosition / stepsPerTrack);
    currentTrackPosition = currentCursorPosition % stepsPerTrack;
}

export function moveCursorPosition(amount) {
    const stepsPerTrack = getStepsPerTrack();
    const max = Tracker.getTrackCount() * stepsPerTrack - 1;
    let next = currentCursorPosition + amount;
    if (next > max) next = 0;
    if (next < 0) next = max;
    setCurrentCursorPosition(next);
}

export function getCurrentTrack() {
    return currentTrack;
}

export function setCurrentTrack(track) {
    setCurrentCursorPosition(track * getStepsPerTrack() + currentTrackPosition);
}

export function getCurrentTrackPosition() {
    return currentTrackPosition;
}

export function setCurrentTrackPosition(position) {
    setCurrentCursorPosition(currentTrack * getStepsPerTrack() + position);
}

// Pattern/song position already live correctly on Tracker - delegated, not
// duplicated, so there is exactly one source of truth for each.
export const getCurrentPattern = () => Tracker.getCurrentPattern();
export const setCurrentPattern = (index) => Tracker.setCurrentPattern(index);
export const getCurrentPatternPos = () => Tracker.getCurrentPatternPos();
export const setCurrentPatternPos = (index) => Tracker.setCurrentPatternPos(index);
export const getCurrentSongPosition = () => Tracker.getCurrentSongPosition();
export const setCurrentSongPosition = (index) => Tracker.setCurrentSongPosition(index);

export function getSong() {
    return Tracker.getSong();
}

// Thin Tracker forwards (spec 030), added so runtime/gridController.js and
// the patternGrid draw kind can stay inside the one-door rule above rather
// than importing domain/playback themselves. v1's own `isRecording` has no
// equivalent here: the ported engine (player/src) never carried a getter for
// it (only a private, unread `isRecording` var - a UI/editor concern spec 012
// had no reason to port), so this spec's own record-mode-implies-selection
// gesture (patternView.js:517) is dropped; the selection modifier alone
// decides drag-to-select vs drag-to-pan (see 030's design.md).
export const isPlaying = () => Tracker.isPlaying();
export const getTrackCount = () => Tracker.getTrackCount();
export const getPatternLength = () => Tracker.getPatternLength();
export const inFTMode = () => Tracker.inFTMode();

// --- pattern-table mutation (spec 071, ported from script/src/editor.js:372-416) ---
//
// Both default to operating at the end of the table (matching v1's own
// `typeof index == "undefined"` fallback), which is exactly what the Song
// Length spinbox's own onChange needs - one call per one-step change,
// exactly as appMainPanel.js:152-156 itself only ever makes one.

export function addToPatternTable(index, patternIndex = 0) {
    const song = getSong();
    if (!song || !song.patternTable) return;
    if (index === undefined) index = song.length;
    if (index === song.length) {
        song.patternTable[index] = patternIndex;
    } else {
        for (let i = song.length; i > index; i--) song.patternTable[i] = song.patternTable[i - 1];
        song.patternTable[index] = patternIndex;
    }
    song.length++;
}

export function removeFromPatternTable(index) {
    const song = getSong();
    if (!song || !song.patternTable || song.length < 2) return;
    if (index === undefined) index = song.length - 1;
    if (index === song.length - 1) {
        song.patternTable[index] = 0;
    } else {
        for (let i = index; i < song.length; i++) song.patternTable[i] = song.patternTable[i + 1];
    }
    song.length--;
    if (getCurrentSongPosition() >= song.length) setCurrentSongPosition(song.length - 1);
}

/** Ported from songPatternList.js:39-49/56-66's own +/- buttons, minus the press-and-hold repeat (a real, recorded UI simplification - one click, one step). */
export function incrementPatternTableEntry(index) {
    const song = getSong();
    if (!song || !song.patternTable) return;
    song.patternTable[index] = (song.patternTable[index] || 0) + 1;
}

export function decrementPatternTableEntry(index) {
    const song = getSong();
    if (!song || !song.patternTable) return;
    if (song.patternTable[index] > 0) song.patternTable[index]--;
}

// --- rows published for the song-properties section's own two real,
// data-bound row lists (spec 071) - both fileBrowser-typed, see
// components/songPatternList.yaml/instrumentList.yaml's own comments for why ---

// Spec 071's own layout follow-up nested both of these one level deeper,
// under the new songPropertiesLayout wrapper and its songPatternGroup/
// instrumentGroup columns (the 4-column-vs-stacked responsive rework) - the
// ids below match the current components/songProperties.yaml exactly.
const SONG_PATTERN_ROWS_FIELD = rowsFieldOf({ id: "main.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList.list" });
const INSTRUMENT_ROWS_FIELD = rowsFieldOf({ id: "main.songProperties.songPropertiesDefault.songPropertiesLayout.instrumentGroup.instrumentList" });

function pad2(n) {
    const s = String(n);
    return s.length < 2 ? "0" + s : s;
}

/** Ported from songPatternList.js:120-127's own setPatternTable. */
export function publishSongPatternRows(app) {
    const song = getSong();
    if (!song || !app || !app.state) return;
    const rows = [];
    for (let i = 0; i < song.length; i++) rows.push({ title: `${pad2(i + 1)}:${pad2(song.patternTable[i] || 0)}` });
    app.state.set(SONG_PATTERN_ROWS_FIELD, rows);
}

/** Ported from appMainPanel.js:84-110's own item render, minus the drag-handle/reorder half (see requirements.md's own scope boundary). */
export function publishInstrumentRows(app) {
    if (!app || !app.state) return;
    const max = getMaxInstruments();
    const rows = [];
    for (let i = 1; i <= max; i++) {
        const instrument = getInstrumentAt(i);
        const name = (instrument && instrument.name) || "";
        // Not trimmed - v1's own appMainPanel.js:106 never trims either, and
        // formatInstrumentIndex's own trailing space (single-digit hex,
        // format.js:16-21) is there specifically to keep every row's own
        // name column aligned regardless of index width.
        rows.push({ title: `${formatInstrumentIndex(i)} ${name}` });
    }
    app.state.set(INSTRUMENT_ROWS_FIELD, rows);
}

/**
 * The pattern sidebar's own Samples tab, leaf-click/double-click capability
 * (spec 073) - dispatches by extension, matching v1's own FileDetector split
 * (.xi vs. everything else, which this port only needs raw PCM for; see
 * requirements.md for why WAV/MP3/FLAC/OGG/AIFF/8SVX are out of scope).
 */
export function importSampleFile(app, name, bytes) {
    const ok = String(name).toLowerCase().endsWith(".xi") ? importXIInstrument(name, bytes) : importRawSample(name, bytes);
    if (ok) publishInstrumentRows(app);
    return ok;
}

// --- the song-properties section's own six spinbox capabilities (spec 071) ---

export function setCurrentPatternNumber(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) setCurrentPattern(value);
    if (app && app.state) app.state.set("current-pattern.value", getCurrentPattern());
}

/** Ported from appMainPanel.js:152-156's own onChange - one add/remove per one-step spinbox change. */
export function setSongLength(app, detail) {
    const song = getSong();
    const requested = Math.round(Number(detail && detail.value));
    if (!song || !Number.isFinite(requested)) return;
    if (requested > song.length) addToPatternTable();
    else if (requested < song.length) removeFromPatternTable();
    if (app && app.state) app.state.set("song-length.value", song.length);
    publishSongPatternRows(app);
}

export function setSongRepeat(app, detail) {
    const song = getSong();
    const value = Math.round(Number(detail && detail.value));
    if (!song || !Number.isFinite(value)) return;
    song.restartPosition = value;
    if (app && app.state) app.state.set("song-repeat.value", value);
}

export function setPatternLength(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) Tracker.setPatternLength(value);
    if (app && app.state) app.state.set("pattern-length.value", getPatternLength());
}

// --- the song-properties section's own two real row lists' own actions (spec 071) ---

export function setInstrumentRow(app, detail) {
    const index = Number(detail && detail.value);
    if (!Number.isFinite(index)) return;
    setCurrentInstrumentIndex(index + 1);
    if (app && app.state) app.state.set("instrument-index.value", getCurrentInstrumentIndex());
}

/** The instrument listbox's own double-click (appMainPanel.js:93-100's own same-row-within-400ms detection - simplified here to the platform's own doubleClick gesture, already generic at the renderer level). Unconditionally opens the sample editor - not a toggle, since re-double-clicking a different row must keep it open on the newly-selected instrument. */
export function openInstrumentInSampleEditor(app, detail) {
    setInstrumentRow(app, detail);
    if (app && app.state) app.state.set("pattern-section-view.value", "Sample Edit");
}

export function setSongPatternRow(app, detail) {
    const index = Number(detail && detail.value);
    if (!Number.isFinite(index)) return;
    setCurrentSongPosition(index);
}

/** The song/pattern list's own four buttons (songPatternList.js:37-87) - all four act on whichever row that same list's own setSongPatternRow last selected. */
export function incrementSelectedPatternRow(app) {
    incrementPatternTableEntry(getCurrentSongPosition());
    publishSongPatternRows(app);
}

export function decrementSelectedPatternRow(app) {
    decrementPatternTableEntry(getCurrentSongPosition());
    publishSongPatternRows(app);
}

export function insertAtSelectedPatternRow(app) {
    addToPatternTable(getCurrentSongPosition());
    if (app && app.state) app.state.set("song-length.value", getSong().length);
    publishSongPatternRows(app);
}

export function deleteSelectedPatternRow(app) {
    removeFromPatternTable(getCurrentSongPosition());
    if (app && app.state) app.state.set("song-length.value", getSong().length);
    publishSongPatternRows(app);
}

/**
 * Everything above that needs to resync whenever the song document changes
 * underneath the UI - not just after a local edit (spec 071, matching v1's
 * own EVENT.songPropertyChange/instrumentChange resync, appMainPanel.js:
 * 210-228). Called from domain/playback/index.js's own module-load success
 * path, an ordinary door-to-door call - the same shape domain/sampleEditor
 * already uses to reach this module.
 */
export function publishSongProperties(app) {
    const song = getSong();
    if (!song || !app || !app.state) return;
    app.state.set("current-pattern.value", getCurrentPattern());
    app.state.set("instrument-index.value", getCurrentInstrumentIndex());
    app.state.set("song-length.value", song.length);
    app.state.set("song-repeat.value", song.restartPosition || 1);
    app.state.set("pattern-length.value", getPatternLength());
    publishSongPatternRows(app);
    publishInstrumentRows(app);
}

/**
 * The note-name text for one cell (spec 030), ported from
 * patternView.js:571-603's own `_renderNote` - display formatting, not a
 * mutation, so it lives alongside the other read helpers above rather than
 * in the grid's own controller or draw kind, which otherwise could not
 * resolve a note name without importing the engine's tables themselves.
 */
export function formatNoteName(note) {
    if (!note) return "---";
    if (Tracker.inFTMode()) {
        if (note.index) {
            const ftNote = note.index === 97 ? FTNotes[NOTEOFF] : FTNotes[note.index];
            return ftNote ? ftNote.name : "???";
        }
        const baseNote = FTPeriods[note.period];
        if (baseNote) {
            const ftNote = FTNotes[baseNote];
            if (ftNote) return ftNote.name;
        }
        return "---";
    }
    const baseNote = periodNoteTable[note.period];
    return baseNote ? baseNote.name : "---";
}

/**
 * Ported from multitrack.js#_getNoteName (749-754) - a note's own display
 * name for the arrangement view's blocks, deliberately not `formatNoteName`
 * above: that function returns placeholders ("---"/"???") for an unnamed
 * cell, matching the classic grid's own always-shows-a-column look; this one
 * returns "" the way v1's own block-labeling helper does, since an empty
 * string draws nothing rather than a placeholder glyph inside a block.
 */
export function getRawNoteName(note) {
    if (!note) return "";
    if (note.index && FTNotes[note.index]) return FTNotes[note.index].name || "";
    if (note.period && periodNoteTable[note.period]) return periodNoteTable[note.period].name || "";
    return "";
}

/**
 * Ported from script/plugins/sampleeditor/resamplePanel.js's own modeNote/
 * noteName/targetPeriod (77-84), folded into one pure function (spec 046)
 * so domain/sampleEditor/resample.js can resolve a target note without
 * touching FTNotes/periodNoteTable itself - domain/sampleEditor never
 * imports domain/playback/engine/ directly. `index` is a resamplePanel-
 * style FTNotes index, 1-96.
 */
export function getNoteForResampleIndex(index) {
    const note = FTNotes[Tracker.inFTMode() ? index : index + 24];
    const name = !note
        ? "NOTE " + index
        : (!Tracker.inFTMode() && periodNoteTable[note.period]) ? periodNoteTable[note.period].name : note.name;
    const period = (Tracker.inFTMode() && Tracker.useLinearFrequency)
        ? 7680 - (index - 1) * 64
        : (note ? note.period : 428);
    return { name, period };
}

// --- Recording, octave and keyboard note entry (spec 031) ------------------
//
// "Recording" and "current octave" are two more pieces of internal state,
// the same shape currentTrack/currentTrackPosition already are - v1's own
// Tracker.isRecording()/toggleRecord() and script/src/ui/input.js's private
// currentOctave have no v2 equivalent yet, so this spec adds them here
// rather than reaching for a UI-owned concept.

let recording = false;
let currentOctave = 2;

export const isRecording = () => recording;
export function setRecording(value) { recording = Boolean(value); }
export function toggleRecording() { recording = !recording; return recording; }

export const getCurrentOctave = () => currentOctave;

/** Ported from script/src/ui/input.js:726-730 - silently ignores a value outside the current format's range. */
export function setCurrentOctave(value) {
    const min = Tracker.inFTMode() ? 0 : 1;
    const max = Tracker.inFTMode() ? 7 : 3;
    if (value >= min && value <= max) currentOctave = value;
}

/**
 * capabilities.js's own `current-octave.set` mapping (spec 062) - the
 * piano's own octave spinbox. A distinct wrapper from setCurrentOctave
 * itself: that one is called internally with a plain number
 * (runtime/gridController.js's own F1-F7 octave-select keys, spec 031), not
 * an (app, detail) pair - one capability's own signature can't double as
 * the other's. Republishes the actual, possibly-clamped-away, resulting
 * value - setCurrentOctave itself already silently no-ops outside the
 * current tracker format's own range, the same "wide ceiling, narrow clamp
 * inside the capability" shape spec 050's own finetune capability already
 * established.
 */
export function applyOctaveChange(app, detail) {
    setCurrentOctave(Math.round(Number(detail && detail.value)) || 0);
    if (app && app.state) app.state.set("current-octave.value", getCurrentOctave());
    if (app && app.log) app.log("current-octave.set", { "current-octave.value": getCurrentOctave() });
}

export const getCurrentInstrumentIndex = () => Tracker.getCurrentInstrumentIndex();
export const getCurrentInstrument = () => Tracker.getCurrentInstrument();

/** Spec 051: an arbitrary instrument by index, not only the current one - domain/arrangement's own block segmentation needs a row's own instrument, whichever one that is. */
export const getInstrumentAt = (index) => Tracker.getInstrument(index);

/** Spec 042: the sample-editor screen's own instrument selector. */
export const getMaxInstruments = () => Tracker.getMaxInstruments();

/** Ported from tracker.js#setCurrentInstrumentIndex - silently a no-op past getMaxInstruments(), lazily allocating a blank instrument for any unused slot up to it (spec 042). */
export function setCurrentInstrumentIndex(index) {
    Tracker.setCurrentInstrumentIndex(index);
}

/**
 * Resolves a physical key (`event.code`) to the note it plays at the
 * current octave/format, or null for an unmapped key or one with no
 * resolvable note right now (e.g. a note-off in ProTracker mode - see
 * keyboardNotes.js's resolveNote doc comment).
 */
export function getNoteForKeyCode(code) {
    const offset = keyboardNoteFor(code);
    if (offset === null) return null;
    return resolveNote(offset, currentOctave, Tracker.inFTMode(), { notePeriod: NOTEPERIOD, ftNotes: FTNotes });
}

/** Resolves a typed character (`event.key`) against the *current* cursor column - see keyboardNotes.js's resolveColumnValue. */
export function getColumnValue(key) {
    return resolveColumnValue(currentTrackPosition, key, Tracker.inFTMode());
}

/**
 * The `record.toggle` capability (capabilities.js): flips recording,
 * mirrors it to the store's `record.active` field one-way, exactly as
 * `domain/playback`'s own transport state mirrors to `playback.status` -
 * the store never writes back into this module.
 * @param {{state?: {set: Function}, log?: Function}} [app]
 * @param {{value?: boolean}} [detail]
 */
export function recordToggle(app, detail) {
    const next = detail && typeof detail.value === "boolean" ? detail.value : !recording;
    setRecording(next);
    if (app && app.state) app.state.set("record.active", next);
    if (app && app.log) app.log("record.toggle", { "record.active": next });
    return next;
}

export function getPattern(index) {
    return Tracker.getSong().patterns[index];
}

function applyPatternDiff(action, direction) {
    const patternData = Tracker.getSong().patterns[action.id];
    if (Tracker.getCurrentPattern() !== action.id) Tracker.setCurrentPattern(action.id);
    action.data.forEach((item) => {
        if (!patternData) return;
        const row = patternData[item.position.row];
        let note = row[item.position.track];
        if (!note) {
            note = new Note();
            row[item.position.track] = note;
        }
        if (direction === "undo") {
            populateNote(note, item.from);
        } else if (item.to) {
            populateNote(note, item.to);
        } else {
            note.clear();
        }
    });
}

/**
 * Replays a SAMPLE-kind action (spec 040 - domain/sampleEditor/index.js is
 * the only caller of registerSampleEdit below). `action.data`/`.dataTo`'s
 * own lengths are what matter, not `action.to` (the selection length at
 * edit time, which trim() can make stale) - this is what lets a length-
 * changing edit undo/redo exactly the same way a same-length one does.
 *
 * `action.loop` is optional (spec 043's own loop creator is the first
 * caller to supply it): `{from: {start, length}, to: {start, length}}`,
 * restored alongside the data when present. v1's own equivalent
 * (`loopCreator.js#saveLoop`) sets the same two fields on its own undo
 * action, but its replay path (`waveform.js`'s own `commandProcessSample`
 * handler) only ever reads them for its CUT/PASTE branches, never REPLACE -
 * the one kind "Create Loop" actually uses - so v1's own loop bounds stay
 * wherever the loop-creation session left them after an undo, out of sync
 * with the data that reverted underneath. Fixed here, not reproduced: a
 * cheap, unambiguous correctness improvement, the same kind of call spec
 * 040 already made unifying sample-edit undo into one shared stack.
 */
function applySampleDiff(action, direction) {
    const instrument = Tracker.getInstruments()[action.instrument];
    if (!instrument) return;
    if (Tracker.getCurrentInstrumentIndex() !== action.instrument) Tracker.setCurrentInstrumentIndex(action.instrument);

    const restoreData = direction === "undo" ? action.data : action.dataTo;
    const currentLength = direction === "undo" ? action.dataTo.length : action.data.length;
    const data = instrument.sample.data;
    const head = data.slice(0, action.from);
    const tail = data.slice(action.from + currentLength);
    instrument.sample.data = [...head, ...restoreData, ...tail];
    instrument.sample.length = instrument.sample.data.length;

    if (action.loop) {
        const loop = direction === "undo" ? action.loop.from : action.loop.to;
        instrument.sample.loop.start = loop.start;
        instrument.sample.loop.length = loop.length;
    }
}

const history = createEditHistory({ applyPatternDiff, applySampleDiff });

/** The one door for domain/sampleEditor/ (or any future sibling) to add an undo entry to this shared stack - see editHistory.js's own SAMPLE handling. */
export function registerSampleEdit(action) {
    history.registerEdit(action);
}

export const undo = history.undo;
export const redo = history.redo;
export const canUndo = history.canUndo;
export const canRedo = history.canRedo;
export const getUndoLabel = history.getUndoLabel;
export const getRedoLabel = history.getRedoLabel;
export const clearHistory = history.clear;

function noteAction(pattern, name, track, row, note) {
    return {
        type: EDITACTION.NOTE,
        id: pattern,
        name,
        data: [{ position: { track, row }, from: note ? duplicateNote(note) : { ...EMPTY_NOTE_DATA } }]
    };
}

function scopedAction(type, pattern, name) {
    return { type, id: pattern, name, data: [] };
}

function addDiff(action, track, row, note) {
    const diff = { position: { track, row }, from: note ? duplicateNote(note) : { ...EMPTY_NOTE_DATA } };
    action.data.push(diff);
    return diff;
}

/**
 * Ported from multitrack.js#_moveNote (587-623) - one undo/redo step
 * covering both cells (an `EDITACTION.NOTE`-kind action, but with two diffs
 * at two different positions rather than one; `applyPatternDiff` already
 * replays any number of diffs at any positions, so no editHistory.js change
 * is needed). A no-op, registering nothing, when the source cell has no
 * playable note - matching v1's own guard exactly.
 */
export function moveNote(srcTrack, srcStep, dstTrack, dstStep) {
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const srcNote = patternData[srcStep] && patternData[srcStep][srcTrack];
    if (!srcNote || (!srcNote.period && !srcNote.index)) return { moved: false };

    const action = scopedAction(EDITACTION.NOTE, pattern, "Move Note");
    const dstRow = patternData[dstStep] || (patternData[dstStep] = []);
    const dstNote = dstRow[dstTrack] || new Note();
    dstRow[dstTrack] = dstNote;

    const srcDiff = addDiff(action, srcTrack, srcStep, srcNote);
    const dstDiff = addDiff(action, dstTrack, dstStep, dstNote);

    const srcData = duplicateNote(srcNote);
    populateNote(dstNote, srcData);
    srcNote.clear();

    srcDiff.to = duplicateNote(srcNote);
    dstDiff.to = duplicateNote(dstNote);
    history.registerEdit(action);

    setCurrentTrack(dstTrack);
    setCurrentPatternPos(dstStep);
    return { moved: true };
}

/** script/src/editor.js:81-108 */
export function putNote({ instrument = 0, period, noteIndex, volume } = {}) {
    const pattern = getCurrentPattern();
    const row = getCurrentPatternPos();
    const patternData = Tracker.getSong().patterns[pattern][row];
    let note = patternData[currentTrack] || new Note();
    const action = noteAction(pattern, "Note", currentTrack, row, note);

    note.instrument = instrument;
    if (noteIndex) {
        note.setIndex(noteIndex);
    } else if (typeof period === "number") {
        note.setPeriod(period);
    }
    if (typeof volume === "number") {
        if (Tracker.inFTMode()) {
            note.volumeEffect = volume + 16;
        } else {
            note.effect = 12;
            note.param = volume;
        }
    }

    patternData[currentTrack] = note;
    action.data[0].to = duplicateNote(note);
    history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:110-155 */
export function putNoteParam(pos, value) {
    const pattern = getCurrentPattern();
    const row = getCurrentPatternPos();
    const note = Tracker.getSong().patterns[pattern][row][currentTrack];
    const action = noteAction(pattern, "Note", currentTrack, row, note);

    if (note) {
        let x, y;
        if (pos === 1 || pos === 2) {
            x = note.instrument >> 4;
            y = note.instrument & 0x0f;
            if (pos === 1) x = value;
            if (pos === 2) y = value;
            note.instrument = (x << 4) + y;
        }

        let xmOffset = 0;
        if (Tracker.inFTMode()) {
            xmOffset = 2;
            if (pos === 3 || pos === 4) {
                let vparam = note.volumeEffect;
                x = (vparam >> 4) || 1;
                y = vparam & 0x0f;
                if (pos === 3) x = value + 1;
                if (pos === 4) y = value;
                note.volumeEffect = (x << 4) + y;
                if (note.volumeEffect < 16) note.volumeEffect = 0;
            }
        }

        if (pos === 3 + xmOffset) note.effect = value;
        if (pos === 4 + xmOffset || pos === 5 + xmOffset) {
            let param = note.param;
            x = param >> 4;
            y = param & 0x0f;
            if (pos === 4 + xmOffset) x = value;
            if (pos === 5 + xmOffset) y = value;
            note.param = (x << 4) + y;
        }
    }

    action.data[0].to = note ? duplicateNote(note) : { ...EMPTY_NOTE_DATA };
    history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:158-171 */
export function clearTrack() {
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const action = scopedAction(EDITACTION.TRACK, pattern, "Clear Track");
    for (let i = 0; i < patternData.length; i++) {
        const note = patternData[i][currentTrack];
        if (note) {
            addDiff(action, currentTrack, i, note);
            note.clear();
        }
    }
    history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:172-187 */
export function clearPattern() {
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const trackCount = Tracker.getTrackCount();
    const action = scopedAction(EDITACTION.PATTERN, pattern, "Clear Pattern");
    for (let i = 0; i < patternData.length; i++) {
        for (let j = 0; j < trackCount; j++) {
            const note = patternData[i][j];
            if (note) {
                addDiff(action, j, i, note);
                note.clear();
            }
        }
    }
    history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:322-342, with undo added (v1 has none here). */
export function insertNote() {
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const start = getCurrentPatternPos();
    const end = patternData.length - 2;
    const action = scopedAction(EDITACTION.RANGE, pattern, "Insert Row");

    for (let i = end; i >= start; i--) {
        addDiff(action, currentTrack, i + 1, patternData[i + 1][currentTrack]);
    }
    addDiff(action, currentTrack, start, patternData[start][currentTrack]);

    for (let i = end; i >= start; i--) {
        const from = patternData[i][currentTrack];
        const to = patternData[i + 1][currentTrack];
        populateNote(to, duplicateNote(from));
    }
    const first = patternData[start][currentTrack];
    if (first) first.clear();

    action.data.forEach((diff) => {
        const note = patternData[diff.position.row][diff.position.track];
        diff.to = note ? duplicateNote(note) : { ...EMPTY_NOTE_DATA };
    });
    history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:344-369, with undo added (v1 has none here). */
export function removeNote(track, step) {
    if (typeof track === "undefined") track = currentTrack;
    if (typeof step === "undefined") step = getCurrentPatternPos();
    if (step === 0) return { pattern: getCurrentPattern(), changed: false };

    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const end = patternData.length - 1;
    const action = scopedAction(EDITACTION.RANGE, pattern, "Remove Row");

    // Rows step-1..end all change (step-1 is overwritten first), so the
    // "from" capture has to start one row earlier than the shift itself.
    for (let i = step - 1; i <= end; i++) {
        addDiff(action, track, i, patternData[i][track]);
    }

    for (let i = step; i <= end; i++) {
        const from = patternData[i][track];
        const to = patternData[i - 1][track];
        populateNote(to, duplicateNote(from));
    }
    const last = patternData[end][track];
    if (last) last.clear();

    action.data.forEach((diff) => {
        const note = patternData[diff.position.row][diff.position.track];
        diff.to = note ? duplicateNote(note) : { ...EMPTY_NOTE_DATA };
    });
    history.registerEdit(action);
    return { pattern, changed: true };
}

/** script/src/editor.js:212-221, minus the pasteBuffer write - a pure read. */
export function copyTrack(trackNumber) {
    const pattern = getCurrentPattern();
    const track = typeof trackNumber === "undefined" ? currentTrack : trackNumber;
    const patternData = Tracker.getSong().patterns[pattern];
    return patternData.map((row) => duplicateNote(row[track] || { ...EMPTY_NOTE_DATA }));
}

/** script/src/editor.js:230-238, minus the pasteBuffer write - a pure read. */
export function copyPattern() {
    const trackCount = Tracker.getTrackCount();
    const data = [];
    for (let j = 0; j < trackCount; j++) data.push(copyTrack(j));
    return data;
}

/** script/src/editor.js:245-283 */
export function pasteTrack(trackNumber, trackData, parentAction) {
    if (!trackData) return false;
    const pattern = getCurrentPattern();
    const track = typeof trackNumber === "undefined" ? currentTrack : trackNumber;
    const patternData = Tracker.getSong().patterns[pattern];
    const action = parentAction || scopedAction(EDITACTION.TRACK, pattern, "Paste Track");

    for (let i = 0; i < patternData.length; i++) {
        let note = patternData[i][track];
        if (!note) {
            note = new Note();
            patternData[i][track] = note;
        }
        const source = trackData[i];
        const diff = addDiff(action, track, i, note);
        diff.to = source;
        if (source) populateNote(note, source);
    }

    if (!parentAction) history.registerEdit(action);
    return { pattern };
}

/** script/src/editor.js:285-299 */
export function pastePattern(patternData) {
    if (!patternData) return false;
    const pattern = getCurrentPattern();
    const trackCount = Tracker.getTrackCount();
    const action = scopedAction(EDITACTION.PATTERN, pattern, "Paste Pattern");
    for (let j = 0; j < trackCount; j++) pasteTrack(j, patternData[j], action);
    history.registerEdit(action);
    return { pattern };
}

// --- Selection and clipboard (spec 029) -------------------------------
//
// One selection object for the one document this capability edits - there
// is nothing here for v1's UI.setSelection callback-swapping to arbitrate
// between. Ported from patternView.js's own _range/_rangeCopy; see that
// spec's design.md for why there is one clipboard rather than v1's two.

const selectionState = createSelectionState();

/** Starts a one-cell range at an arbitrary cell (a click, or a Shift+Arrow's origin). */
export function beginSelection(row, track) {
    selectionState.setRange({ start: { row, track }, end: { row, track } });
}

/** Grows the range to cover the rectangle between its start and this cell (a drag, or Shift+Arrow). */
export function extendSelection(row, track) {
    const range = selectionState.getRange();
    if (!range) {
        beginSelection(row, track);
        return;
    }
    selectionState.setRange({ start: range.start, end: { row, track } });
}

/** script/src/ui/app/components/patternView.js:140-151 - the current track's full row range. */
export function selectAll() {
    const patternData = Tracker.getSong().patterns[getCurrentPattern()];
    const track = getCurrentTrack();
    selectionState.setRange({ start: { row: 0, track }, end: { row: patternData.length - 1, track } });
}

/** SELECTION.RESET - deselects; the clipboard is untouched. */
export function resetSelection() {
    selectionState.setRange(null);
}

export function hasSelection() {
    return selectionState.getRange() !== null;
}

/** The normalized {top, left, bottom, right} rectangle, or null if nothing is selected. */
export function getSelectionRange() {
    return normalizeRange(selectionState.getRange());
}

export function getClipboard() {
    return selectionState.getClipboard();
}

export function hasClipboard() {
    return selectionState.getClipboard() !== null;
}

/** Empties the clipboard explicitly - v1 has no equivalent (nothing ever clears pasteBuffer/_rangeCopy), but an addressable clipboard should be able to say "nothing copied" too. */
export function clearClipboard() {
    selectionState.setClipboard(null);
}

/** SELECTION.COPY - reads the selected cells into the clipboard; the document is untouched. */
export function selectionCopy() {
    const range = getSelectionRange();
    if (!range) return false;
    const patternData = Tracker.getSong().patterns[getCurrentPattern()];
    const width = range.right - range.left + 1;
    const rows = [];
    for (let r = range.top; r <= range.bottom; r++) {
        const row = [];
        for (let c = 0; c < width; c++) row.push(duplicateNote(patternData[r][range.left + c]));
        rows.push(row);
    }
    selectionState.setClipboard({ rows, width, height: rows.length });
    return true;
}

/** SELECTION.CLEAR - clears exactly the selected cells, as one undoable action. */
export function selectionClear() {
    const range = getSelectionRange();
    if (!range) return false;
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const action = scopedAction(EDITACTION.RANGE, pattern, "Clear Selection");
    for (let r = range.top; r <= range.bottom; r++) {
        for (let t = range.left; t <= range.right; t++) {
            const note = patternData[r][t];
            if (note) {
                addDiff(action, t, r, note);
                note.clear();
            }
        }
    }
    history.registerEdit(action);
    return { pattern };
}

/** SELECTION.CUT - copy then clear, as one undo step (copying alone never mutates). */
export function selectionCut() {
    if (!selectionCopy()) return false;
    return selectionClear();
}

/**
 * SELECTION.PASTE - writes the clipboard back at the current selection's
 * top-left, or the cursor if nothing is selected (replacing v1's POSITION
 * fallback - see requirements.md). Clips to the pattern's row count and the
 * song's current track count, exactly as v1's own paste does.
 */
export function selectionPaste() {
    const clipboard = selectionState.getClipboard();
    if (!clipboard) return false;

    const range = getSelectionRange();
    const startRow = range ? range.top : getCurrentPatternPos();
    const startTrack = range ? range.left : getCurrentTrack();
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const trackCount = Tracker.getTrackCount();
    const action = scopedAction(EDITACTION.RANGE, pattern, "Paste Block");

    for (let r = 0; r < clipboard.rows.length && startRow + r < patternData.length; r++) {
        const row = startRow + r;
        for (let c = 0; c < clipboard.rows[r].length; c++) {
            const track = startTrack + c;
            if (track >= trackCount) continue;
            let note = patternData[row][track];
            if (!note) {
                note = new Note();
                patternData[row][track] = note;
            }
            const diff = addDiff(action, track, row, note);
            diff.to = clipboard.rows[r][c];
            populateNote(note, diff.to);
        }
    }

    history.registerEdit(action);
    return { pattern };
}
