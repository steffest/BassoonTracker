# 028 — Design

## Where the document actually lives

`domain/playback/engine/tracker.js` owns one module-private `song` variable, set by `processFile()`/`load()` and read everywhere in the engine by closure, exactly as in v1. Playback (P2) must keep reading and writing that identical object — the scheduler reads pattern data straight out of it while a song plays, and an edit made anywhere has to be visible to the *next* scheduled step without a copy-and-sync step in between. So `domain/song/` does not own a second copy of the document; it is a second, narrower door onto the same one, opened deliberately rather than found as an accident:

```js
// domain/song/index.js
import Tracker from "../playback/engine/tracker.js";
import Note from "../playback/engine/models/note.js";
```

`domain/playback/README.md`'s boundary paragraph is amended (see below) to name this one exception. Everything else — `runtime/`, `renderers/`, `compiler/`, `workbench/`, the generated `app/` — still may only import `domain/playback/index.js`, and now, for editing, only `domain/song/index.js`. A grep-based test (`tests/domainBoundary.test.js`) makes this mechanical rather than a paragraph nobody checks again: it scans every source file outside `domain/playback/` and `domain/song/` for an import path containing `domain/playback/engine`, and fails if one exists.

## Two pure modules, one integration point

Mirroring the split `stateManager.js`/`editor.js` already had in v1 (a generic history mechanism, and a document-specific caller of it), but as two independently-testable v2 modules instead of one always-instantiated singleton pair:

**`domain/song/editHistory.js`** — pure, knows nothing about `Tracker`. `createEditHistory({ maxHistory, applyPatternDiff })` returns `{registerEdit, undo, redo, canUndo, canRedo, getUndoLabel, getRedoLabel, clear}`. The 100-cap, redo-clear-on-new-edit, and same-id `VALUE` coalescing are ported line-for-line from `stateManager.js:13-42`. Replay for the four cell-diff kinds (`NOTE`/`RANGE`/`TRACK`/`PATTERN`) is delegated to the caller-supplied `applyPatternDiff(action, direction)` rather than reaching for a pattern array itself — this is what makes the module testable with a fake accessor and no loaded song at all (see tests). `VALUE` replay calls `action.target.setValue(...)` directly, ported as-is since it is generic already; `DATA`/`SAMPLE` are accepted by the switch and are deliberate no-ops (P10's territory, same "declared, not implemented" convention as the component catalogue).

**`domain/song/noteData.js`** — pure, no `Tracker` import either. `duplicateNote(note)`/`populateNote(note, data)` are `Note.duplicate()`/`populate()` from `script/src/models/note.js`, ported as free functions because the v2 engine's own `models/note.js` (copied from `player/src`, the playback-only subset) never carried those two methods, and `domain/playback/`'s "byte-identical, three documented divergences" invariant is not this spec's to extend with a fourth. Operating on the six fields externally rather than adding methods to the vendored `Note` object keeps that invariant intact while giving `domain/song/` exactly what it needs.

**`domain/song/index.js`** — the integration point. Holds the one thing v1 kept in `Editor`'s closure that `Tracker` has no equivalent for (track/column cursor position — `Tracker` already has pattern/song position, so those are delegated, not duplicated), constructs one `editHistory` instance with `applyPatternDiff` wired against `Tracker.getSong().patterns`, and exposes the mutation functions below, each building an edit action with `noteData.js`'s helpers and finishing with `history.registerEdit(...)`.

## The mutation surface, ported operation by operation

Every function below is `editor.js`'s own, read again for this spec, adapted only to call the new `editHistory`/`noteData` modules instead of `StateManager`/`Note.duplicate`:

- `putNote({instrument, period, noteIndex, volume})` — `editor.js:81-108`. Builds a `NOTE` action capturing the cell's `from` before mutating, `to` after.
- `putNoteParam(pos, value)` — `editor.js:110-155`, including its FT-mode-only volume-column branch (`Tracker.inFTMode()`), ported unchanged.
- `clearTrack()` / `clearPattern()` — `editor.js:158-187`. One `TRACK`/`PATTERN` action per call, one diff entry per non-empty cell actually cleared (matching v1: an all-empty track produces an action with an empty `data` array, which is what v1 does too — harmless, not special-cased).
- `insertNote()` / `removeNote(track, step)` — `editor.js:322-369`. v1 performs the row shift with **no** undo action at all; this spec wraps the same shift in one `RANGE` action (capture every affected row's `from` before shifting, `to` after) — the one deliberate improvement this spec makes, costing nothing since the shape already exists for `clearTrack`.
- `copyTrack(trackNumber)` / `copyPattern()` — `editor.js:212-239`, minus the `pasteBuffer` write. These become pure reads: they return the plain-data array/array-of-arrays via `duplicateNote`, and do not store anything. Clipboard *ownership* (what "the" copied thing is, for a keyboard Ctrl+C/V) is spec 029's job; this spec only provides "read out this track/pattern's data" as a primitive, the same way `putNote` provides "write this one cell" as a primitive.
- `pasteTrack(trackNumber, trackData, parentAction)` / `pastePattern(patternData)` — `editor.js:245-299`. `pasteTrack` still accepts an optional parent action so `pastePattern` can wrap all of a pattern's per-track pastes into one `PATTERN`-kind undo entry, exactly as v1's own nesting does.

Cursor/position: `getStepsPerTrack`, `getCurrentTrack`/`setCurrentTrack`, `getCurrentTrackPosition`/`setCurrentTrackPosition`, `getCurrentCursorPosition`/`setCurrentCursorPosition`, `moveCursorPosition` are `editor.js:37-78` ported as closure state inside `domain/song/index.js` (nothing here has a `Tracker` equivalent). `getCurrentPattern`/`setCurrentPattern`, `getCurrentPatternPos`/`setCurrentPatternPos`, `getCurrentSongPosition`/`setCurrentSongPosition` are thin delegations straight to `Tracker`, since it already owns that state correctly — duplicating it here would create two sources of truth for the same three numbers.

## What each mutation returns

Nothing here re-triggers v1's `EVENT.patternChange`. Each mutation function returns `{ pattern: <index> }` (or, for `pasteTrack`/`copyTrack`, the data itself plus which pattern it targeted). A future caller — the pattern grid, P7 — reads that return value to know whether and what to redraw. This is deliberately not a pub/sub mechanism: there are zero subscribers today, and building one now would be exactly the kind of speculative abstraction this project avoids elsewhere (see numberDisplayController's `{changed, value}` result for the same convention on a much smaller scale).

## What this deliberately does not do

See requirements.md's scope boundaries. No song-structural editing (pattern-table sequence, pattern length, track count, whole-song clear) — a different undo shape (whole-field snapshot, not a cell diff), not required by any acceptance criterion here, and not silently smuggled in under "pattern editing." No selection, no clipboard object, no wiring to the generated application's mocked commands (`pattern.clear` etc. stay mocks — there is no pattern-grid-driven "current pattern/track" yet for them to act on). No store fields. No browser verification.
