# 031 — Design

## Overview

Everything here lands in three places already spec 030 built: `domain/song/index.js` gains recording/octave state and one note-resolution entry point; `runtime/gridController.js`'s `handleKeydown` grows from five navigation cases to the full set v1's `input.js` has; `renderers/canvas/mountGeneric.js`'s `keyInput()` gains two additive fields. No new component type, no new behavior name, no new controller - this spec is entirely inside the specialized component spec 030 already proved out.

## Architecture

```
domain/song/keyboardNotes.js (new, pure - no Tracker import)
  KEYBOARD_TABLE, keyboardNoteFor(code) -> offset|null
  resolveNote(offset, octave, ftMode, tables) -> {period,index}|null
  resolveColumnValue(column, key, ftMode) -> number|null
        ^ called by, tables supplied live
        |
domain/song/index.js (spec 028/029/030, extended)
  + isRecording/setRecording/toggleRecording, getCurrentOctave/setCurrentOctave
  + getCurrentInstrumentIndex (thin Tracker forward)
  + getNoteForKeyCode(code) -> {period,index}|null   (wraps resolveNote with live octave/ftMode/tables)
  + getColumnValue(key) -> number|null                (wraps resolveColumnValue with live ftMode/column)
  + recordToggle(app, detail)                         (the capability: flips isRecording, mirrors to app.state)
        ^
        | same one door gridController already uses
        |
runtime/gridController.js (spec 030, extended)
  handleKeydown: + Backspace/Delete/Ctrl+Backspace/Ctrl+Enter, Escape,
                 Ctrl+ArrowLeft/Right (track jump), corrected ArrowUp/Down
                 (wrap) and PageUp/PageDown (quarter-pattern), the note-key/
                 hex-entry fallthrough, selection-growth wrapper
        ^
        | keyInput()'s two new fields
        |
renderers/canvas/mountGeneric.js
  keyInput(): + code: event.code, repeat: event.repeat

capabilities.js
  "record.toggle": { module: "./domain/song/index.js", export: "recordToggle" }
```

## Components and interfaces

### `domain/song/keyboardNotes.js` (new)

Pure, ported from `script/src/enum.js`'s `KEYBOARDKEYS`/`OCTAVENOTES`/`KEYBOARDTABLE.main` (419-505) and `script/src/ui/input.js`'s `handleNoteOn` (734-772) and its FastTracker volume-mnemonic switch (790-806). No `Tracker`/`Note` import - like `noteData.js`/`selection.js`, it is testable with plain numbers and fake tables, never a loaded song.

```js
export const KEYBOARD_TABLE = { KeyZ: 1, KeyX: 3, KeyC: 5, KeyV: 6, KeyB: 8, KeyN: 10, KeyM: 12,
    Comma: 13, Period: 15, KeyS: 2, KeyD: 4, KeyG: 7, KeyH: 9, KeyJ: 11,
    KeyQ: 13, KeyW: 15, KeyE: 17, KeyR: 18, KeyT: 20, KeyY: 22, KeyU: 24, KeyI: 25, KeyO: 27,
    Digit2: 14, Digit3: 16, Digit5: 19, Digit6: 21, Digit7: 23, Digit9: 26,
    Backquote: 0, Backslash: 0 };
// (values are KEYBOARDKEYS' own semitone-offset numbers, inlined - the enum
// itself is not needed anywhere else, unlike OCTAVENOTES' note-name strings)

const OCTAVE_NOTE_NAMES = { 0: "OFF", 1: "C", 2: "Cs", 3: "D", 4: "Ds", 5: "E", 6: "F", 7: "Fs", 8: "G", 9: "Gs", 10: "A", 11: "As", 12: "B" };

export function keyboardNoteFor(code) {
    const value = KEYBOARD_TABLE[code];
    return typeof value === "number" ? value : null;
}

/**
 * Ported from handleNoteOn (input.js:744-772). `tables.notePeriod` is v1's
 * NOTEPERIOD (name+octave -> {period}); `tables.ftNotes`/`ftPeriods` are
 * FTNotes/FTPeriods (index -> {period}). Returns null for an offset with no
 * resolvable note at this octave (e.g. NOTEPERIOD has no "OFF" entries, so a
 * ProTracker-mode note-off key resolves to null - MOD has no note-off; this
 * is a real format limitation, not a gap - matched deliberately.
 */
export function resolveNote(offset, octave, ftMode, tables) {
    const noteOctave = Math.floor((offset - 1) / 12) + 1;
    const noteIndex = (offset - 1) % 12 + 1;
    const name = OCTAVE_NOTE_NAMES[noteIndex];
    if (!name) return null;
    if (ftMode) {
        if (name === "OFF") return { period: 1, index: 0 };
        const index = octave * 12 + offset;
        const ftNote = tables.ftNotes[index];
        return ftNote ? { period: ftNote.period, index } : null;
    }
    const entry = tables.notePeriod[name + (noteOctave - 1)];
    return entry ? { period: entry.period, index: 0 } : null;
}

const FT_VOLUME_MNEMONICS = { "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "-": 5, "+": 6, d: 7, D: 7, u: 8, U: 8, s: 9, S: 9, v: 10, V: 10, p: 11, P: 11, "<": 12, ">": 13, M: 14 };

/** Ported from handleNoteOn's hex/mnemonic block (input.js:781-808). `column` is 1-based (never 0: the note column has no hex entry). */
export function resolveColumnValue(column, key, ftMode) {
    if (ftMode && column === 3) {
        const value = FT_VOLUME_MNEMONICS[key];
        return typeof value === "number" ? value : null;
    }
    if (ftMode && column === 5) {
        return /^[0-9A-Za-z]$/.test(key) ? parseInt(key, 36) : null;
    }
    return /^[0-9A-Fa-f]$/.test(key) ? parseInt(key, 16) : null;
}
```

`resolveNote`'s `index` for a non-FT (ProTracker) note is always `0`: v1's own `note.index` there is never set (only `note.period` matters in ProTracker mode - `putNote`'s `noteIndex` parameter is FastTracker-only, per spec 028's own `putNote` reading `typeof period === "number"` as the ProTracker branch).

### `domain/song/index.js` (extended)

```js
import { NOTEPERIOD } from "../playback/engine/enum.js";
import { keyboardNoteFor, resolveNote, resolveColumnValue } from "./keyboardNotes.js";

let recording = false;
let currentOctave = 2;

export const isRecording = () => recording;
export function setRecording(value) { recording = Boolean(value); }
export function toggleRecording() { recording = !recording; return recording; }

export const getCurrentOctave = () => currentOctave;
export function setCurrentOctave(value) {
    const [min, max] = Tracker.inFTMode() ? [0, 7] : [1, 3];
    if (value >= min && value <= max) currentOctave = value;
}

export const getCurrentInstrumentIndex = () => Tracker.getCurrentInstrumentIndex();

/** null for an unmapped key, or one with no resolvable note at the current octave/format (e.g. note-off in ProTracker mode). */
export function getNoteForKeyCode(code) {
    const offset = keyboardNoteFor(code);
    if (offset === null) return null;
    return resolveNote(offset, currentOctave, Tracker.inFTMode(), { notePeriod: NOTEPERIOD, ftNotes: FTNotes, ftPeriods: FTPeriods });
}

export function getColumnValue(key) {
    return resolveColumnValue(currentTrackPosition, key, Tracker.inFTMode());
}

/** The record.toggle capability (spec 007's manifest shape) - flips recording, mirrors to the store. */
export function recordToggle(app, detail) {
    const next = detail && typeof detail.value === "boolean" ? detail.value : !recording;
    setRecording(next);
    if (app && app.state) app.state.set("record.active", next);
    if (app && app.log) app.log("record.toggle", { "record.active": next });
    return next;
}
```

`FTNotes`/`FTPeriods` are already imported (spec 030's `formatNoteName`); `NOTEPERIOD` is a new import, from `enum.js` rather than `tracker.js` (where `periodNoteTable`/`FTNotes`/`FTPeriods` live) - a different table, ported for the opposite direction (name→period rather than period→name).

### `capabilities.js`

```js
"record.toggle": { module: "./domain/song/index.js", export: "recordToggle" },
```

Replaces the comment placeholder. `app/actions/recordToggle.js` is GENERATED (`node build.mjs app`) - not hand-edited, exactly as `transportToggle.js` became a thin wrapper when spec 012 mapped it.

### `renderers/canvas/mountGeneric.js`

`keyInput()`:

```js
function keyInput(type, event) {
    return { type, key: event.key, code: event.code, repeat: event.repeat, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, clipboardText: lastClipboard };
}
```

Two additive fields, read by nothing before this spec - every other controller's `handle()` already ignores unrecognized input fields.

### `runtime/gridController.js`

`handleKeydown` grows from spec 030's five cases to the full set. The selection-growth rule (NOTE-007) wraps every position-changing case identically, so it is one small helper rather than five copies:

```js
function withSelectionGrowth(input, transitions, move) {
    const before = { row: song.getCurrentPatternPos(), track: song.getCurrentTrack() };
    move();
    if (input.ctrlKey || input.metaKey) {
        if (!song.hasSelection()) song.beginSelection(before.row, before.track);
        song.extendSelection(song.getCurrentPatternPos(), song.getCurrentTrack());
    }
    return { transitions, handled: true };
}
```

```js
function handleKeydown(input, transitions) {
    switch (input.key) {
        case "ArrowUp": return withSelectionGrowth(input, transitions, () => wrapPatternPos(-1));
        case "ArrowDown": return withSelectionGrowth(input, transitions, () => wrapPatternPos(1));
        case "PageUp": return withSelectionGrowth(input, transitions, () => quarterPageJump(-1));
        case "PageDown": return withSelectionGrowth(input, transitions, () => quarterPageJump(1));
        case "Home": return withSelectionGrowth(input, transitions, () => song.setCurrentPatternPos(0));
        case "End": return withSelectionGrowth(input, transitions, () => song.setCurrentPatternPos(song.getPatternLength() - 1));
        case "ArrowLeft":
            return withSelectionGrowth(input, transitions, () =>
                (input.ctrlKey || input.metaKey) ? song.moveCursorPosition(-song.getStepsPerTrack()) : song.moveCursorPosition(-1));
        case "ArrowRight":
            return withSelectionGrowth(input, transitions, () =>
                (input.ctrlKey || input.metaKey) ? song.moveCursorPosition(song.getStepsPerTrack()) : song.moveCursorPosition(1));
        case "Escape":
            if (song.hasSelection()) { song.resetSelection(); return { transitions, handled: true }; }
            return { transitions, handled: false };
        case "Backspace": return handleBackspace(transitions, Boolean(input.ctrlKey || input.metaKey));
        case "Delete": return handleDelete(transitions);
        case "Enter":
            if ((input.ctrlKey || input.metaKey) && song.isRecording()) {
                song.insertNote();
                wrapPatternPos(1);
                return { transitions, handled: true };
            }
            return { transitions, handled: false };
        default:
            return handleCharacterKey(input, transitions);
    }
}
```

`wrapPatternPos(delta)`/`quarterPageJump(direction)` are the two corrected helpers (NOTE-010), ported from `script/src/tracker.js:230-236` and `input.js:390-403` respectively:

```js
function wrapPatternPos(delta) {
    const max = song.getPatternLength() - 1;
    let next = song.getCurrentPatternPos() + delta;
    if (next < 0) next = max;
    if (next > max) next = 0;
    song.setCurrentPatternPos(next);
}

function quarterPageJump(direction) {
    const length = song.getPatternLength();
    let step = Math.floor(length / 4);
    if (step === 0) step = 1;
    const pos = song.getCurrentPatternPos();
    let target = direction < 0 ? Math.floor(pos / step) * step : Math.ceil(pos / step) * step;
    if (target === pos) target += direction * step;
    song.setCurrentPatternPos(Math.min(Math.max(target, 0), length - 1));
}
```

`ArrowLeft`/`ArrowRight`'s `Ctrl`/`Cmd` branch is NOTE-006's track jump - `moveCursorPosition(±stepsPerTrack)` already wraps at the song's own track bounds (spec 028's existing implementation), so no new wrap logic is needed there, only the choice of magnitude.

`handleBackspace`/`handleDelete` (NOTE-005), ported from `input.js:329-354,424-434`:

```js
function handleBackspace(transitions, withModifier) {
    if (!song.isRecording()) return { transitions, handled: false };
    if (withModifier) {
        song.removeNote();
        wrapPatternPos(-1);
    } else {
        clearCurrentColumn(-1); // -1: FT volume column clears to "empty" (v1's putNoteParam(pos,-1)), not zero
        wrapPatternPos(1);
    }
    return { transitions, handled: true };
}

function handleDelete(transitions) {
    if (!song.isRecording()) return { transitions, handled: false };
    clearCurrentColumn(0);
    wrapPatternPos(1);
    return { transitions, handled: true };
}

function clearCurrentColumn(ftVolumeClearValue) {
    const column = song.getCurrentTrackPosition();
    // song.putNote's ported signature takes an options object, unlike v1's
    // own positional Editor.putNote(instrument, period, ...) - period must
    // be passed explicitly as 0 (not omitted) or putNote's own `typeof
    // period === "number"` guard leaves the existing period untouched
    // instead of clearing it.
    if (column === 0) { song.putNote({ instrument: 0, period: 0 }); return; }
    const ftMode = song.inFTMode();
    const value = (ftMode && (column === 3 || column === 4)) ? ftVolumeClearValue : 0;
    song.putNoteParam(column, value);
}
```

`clearCurrentColumn`'s `ftVolumeClearValue` parameter is the one real difference between Backspace and Delete v1 has (`input.js:337` uses `-1` for the FT volume columns, `input.js:429` always uses `0`) - `putNoteParam`'s own volume-nibble math (spec 028) already treats a resulting `volumeEffect < 16` as "clear it to 0", so passing `-1` there produces the same "empty" outcome `0` does for every other column, just through the value v1 itself passes.

The note-key/hex-entry fallthrough (NOTE-003/004), ported from `handleNoteOn`:

```js
function handleCharacterKey(input, transitions) {
    // A Ctrl/Cmd-held letter is reserved for a shortcut (undo, select-all,
    // cut/copy/paste - v1's own input.js:499-521 checks this before ever
    // reaching its keyboard-table lookup, for the same reason): never treat
    // it as a note or hex digit, recording or not.
    if (input.ctrlKey || input.metaKey) return { transitions, handled: false };
    if (!song.isRecording()) return { transitions, handled: false };
    if (song.getCurrentTrackPosition() === 0) {
        if (input.repeat) return { transitions, handled: true }; // v1's keyDown[index] guard, via the browser's own repeat flag
        const note = song.getNoteForKeyCode(input.code);
        if (!note) return { transitions, handled: false };
        song.putNote({ instrument: song.getCurrentInstrumentIndex(), period: note.period, noteIndex: note.index });
        wrapPatternPos(1);
        return { transitions, handled: true };
    }
    const value = song.getColumnValue(input.key);
    if (value === null) return { transitions, handled: false };
    song.putNoteParam(song.getCurrentTrackPosition(), value);
    wrapPatternPos(1);
    return { transitions, handled: true };
}
```

F1-F7 (NOTE-002) is one more `handleKeydown` case:

```js
case "F1": case "F2": case "F3": case "F4": case "F5": case "F6": case "F7":
    song.setCurrentOctave(Number(input.key.slice(1)));
    return { transitions, handled: true };
```

Octave selection only takes effect while the grid is focused (a real, recorded narrowing: v1's own F-keys are global in `input.js`, but nothing else in v2 - no piano widget yet - needs them live elsewhere).

## Data models

- **Recording**: a plain boolean in `domain/song`, mirrored one-way to the existing `record.active` store field (the store never writes back into `domain/song` - the same direction `playback.status` already mirrors `Tracker.isPlaying()`).
- **Current octave**: a plain number in `domain/song`, no store field (nothing outside the not-yet-built piano widget displays it in v1 either).
- **Resolved note**: `{ period: number, index: number }` - `index` is `0` for a ProTracker/non-FT note (unused there) and the FastTracker note-table index otherwise; `null` stands for "no note" (unmapped key, or a note-off pressed in a format that cannot represent one).
- **Resolved column value**: a plain number `0-255`, or `null` for "not a recognized character in this column right now".

## Error handling

- **An unmapped key, in any column, in any state**: `handled: false`, never throws - the same "let it fall through" contract spec 030 already established for an out-of-range wheel/click.
- **A note-off pressed in ProTracker mode**: `getNoteForKeyCode` returns `null` (see `resolveNote`'s doc comment) - nothing is written, matching the Amiga MOD format's own inability to represent a note-off, not a bug to work around.
- **Octave out of the current format's range**: `setCurrentOctave` silently ignores the request (matches v1's own silent clamp-by-doing-nothing).
- **`removeNote`/`insertNote` at the pattern's edges**: already handled by spec 028's own functions (`removeNote` at step 0 is a documented no-op); this spec adds no new edge handling.

## Testing strategy

No Playwright/Chromium install exists in this environment (recheck before starting; unchanged since specs 019/030). Verification is:

- **`tests/keyboardNotes.test.js`** (new, pure): `keyboardNoteFor` against a representative sample of the 27 mapped codes and an unmapped one; `resolveNote` against fake `notePeriod`/`ftNotes` tables for both modes, including the ProTracker note-off → `null` case; `resolveColumnValue` for every FT volume mnemonic, the FT effect column's base-36 acceptance, and the default hex path, including rejected characters.
- **`tests/gridController.test.js`** (extended): against the same real loaded fixture already used - recording gate (nothing mutates while off, matching the exact same input once turned on); a mapped note key writes a note and advances, a repeat is ignored; hex entry on the instrument column; Backspace/Delete/Ctrl+Backspace/Ctrl+Enter each against a real pattern, undoable; Ctrl+Arrow track jump wraps at track bounds; Ctrl+Arrow selection growth produces the same rectangle a mouse drag would; Escape clears a selection; `ArrowUp` wraps at row 0; `PageDown` matches the quarter-pattern math exactly.
- **`tests/song.test.js`** (extended): `isRecording`/`setRecording`/`toggleRecording`; `getCurrentOctave`/`setCurrentOctave`'s mode-dependent clamp; `recordToggle(app, detail)` against a fake `app.state`.

## Performance considerations

Nothing here runs per frame - only per keydown, already bounded by human typing speed; no new allocation in a hot path (`resolveNote`/`resolveColumnValue` are pure lookups against fixed-size tables).

## Security considerations

Not applicable beyond the existing keyboard handling (specs 015/030); `event.code`/`event.repeat` are standard, read-only `KeyboardEvent` fields.

## Monitoring and observability

No change: `feed()`'s existing trace calls already fire for any `handled`/`transitions` result the grid controller returns (spec 030), so every new keydown case already appears in the Interaction log with no new tracing code.

## What this deliberately does not do

- **No live audio preview when a mapped key is pressed while not recording.** v1's `handleNoteOn` always triggers a sound; that reaches the audio engine directly, has nothing to do with the grid's own focus, and is P11's "the piano" surface - see requirements.md's scope decision.
- **No global Edit-menu shortcuts** (`undo`/`redo`/`cut`/`copy`/`paste`) - a menu-wiring spec's job, not gated on the grid's focus the way everything here is.
- **No octave auto-nudge on a format-mode change** (v1's `input.js:962-968`) - nothing in this spec's scope changes the loaded format at runtime.
- **No browser verification**, for the same environment reason specs 019/030 recorded.
