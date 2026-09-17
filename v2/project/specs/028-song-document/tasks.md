# 028 — Tasks

- [x] Re-read `script/src/editor.js` and `script/src/ui/stateManager.js` in full; confirmed which pattern-editing operations v1 registers undo for and which it silently does not.
- [x] `domain/song/editHistory.js` (new): pure undo/redo stack ported from `stateManager.js` — 100-entry cap, redo cleared on new edit, sequential same-id `VALUE` coalescing, `NOTE`/`RANGE`/`TRACK`/`PATTERN` replay delegated to an injected `applyPatternDiff`.
- [x] `domain/song/noteData.js` (new): `duplicateNote`/`populateNote`, ported from v1's `Note.duplicate()`/`populate()` as free functions (the ported v2 engine's own `models/note.js` never carried them).
- [x] `domain/song/index.js` (new): the capability boundary. Cursor/position API (track/column state of its own; pattern/song position delegated to `Tracker`); `putNote`, `putNoteParam`, `clearTrack`, `clearPattern`, `insertNote`, `removeNote`, `copyTrack`, `copyPattern`, `pasteTrack`, `pastePattern`, all wired through one `editHistory` instance; `undo`/`redo`/`canUndo`/`canRedo`/`getUndoLabel`/`getRedoLabel`/`clearHistory`.
- [x] `domain/song/README.md` (new): provenance, the one documented cross-boundary import (`Tracker`/`Note` straight from `domain/playback/engine/`), and the scope boundaries above.
- [x] `domain/playback/README.md`: boundary paragraph amended to name `domain/song/` as the one other module allowed to import `engine/`.
- [x] `tests/domainBoundary.test.js` (new): greps every source file outside `domain/playback/` and `domain/song/` for an import path containing `domain/playback/engine`; fails if one exists.
- [x] `tests/song.test.js` (new): `editHistory` against a fake `applyPatternDiff` (cap, coalescing, undo/redo, labels); `noteData`'s round trip; `domain/song/index.js` end to end against the real fixtures already used by `tests/playback.test.js` — put a note and undo/redo it, clear a track and undo it, clear a pattern and undo it, insert/remove a row and undo it, copy a track from one pattern and paste it (undoably) into another, copy/paste a whole pattern.
- [x] `node --test "v2/tests/*.test.js"` passes; `node build.mjs app`/`dist` succeed unchanged (no YAML authored, no compiler/renderer touched).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; P6 is open, not closed (selection/clipboard remain, spec 029).
