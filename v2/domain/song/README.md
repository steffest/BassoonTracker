# Song-editing capability

Pattern editing, undo, selection and clipboard, behind one boundary. Specs [028](../../project/specs/028-song-document/requirements.md) and [029](../../project/specs/029-selection-clipboard/requirements.md), package P6 of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md) (closed), plus a handful of thin read forwards (`isPlaying`, `getTrackCount`, `getPatternLength`, `inFTMode`, `getStepsPerTrack`) and one display helper (`formatNoteName`) added by spec [030](../../project/specs/030-pattern-grid/requirements.md) so that package P7's pattern grid - the first real consumer of this module outside its own tests - never needs a second door onto `domain/playback`.

```
index.js         the capability: cursor/position, pattern-editing mutations, undo/redo, selection/clipboard
editHistory.js   the undo/redo stack (pure - no Tracker/Note import)
noteData.js      duplicateNote()/populateNote() (pure - no Tracker import)
selection.js     a rectangular range + one clipboard (pure - no Tracker/Note import)
```

## The boundary

Only `index.js` may be imported from outside this folder. `index.js` itself imports `Tracker` and `Note` directly from `../playback/engine/`, the one documented exception to `domain/playback/README.md`'s own "index.js only" rule: pattern editing mutates the exact song object the scheduler reads from, not a copy, so it needs the same live singleton, not a second one. Nothing else gets that exception - `runtime/`, `renderers/`, `compiler/`, `workbench/`, the generated `app/`, and `domain/playback/` itself, all reach editing only through this file. `tests/domainBoundary.test.js` checks this mechanically for both folders at once.

## Provenance

Ported from `script/src/editor.js` (the mutation operations) and `script/src/ui/stateManager.js` (the undo/redo history) - neither file was part of `player/src`, the playback-only subset P2 already ported, so none of this existed in v2 before this spec. `noteData.js`'s two functions are `script/src/models/note.js`'s own `Note.duplicate()`/`populate()`, kept as free functions rather than added to the ported engine's own `models/note.js` (which never carried them, being copied from the playback-only `player/src`) - see `domain/playback/README.md`'s own "byte-identical, three divergences" invariant, which this module does not extend.

## What this covers, and what it does not

Pattern-scoped editing: put a note, edit a note's effect/param nibbles, clear a track or pattern, insert/remove a row, copy and paste a track or pattern - each undoable, with the same hundred-step cap and same-control coalescing `stateManager.js` has. `insertNote`/`removeNote` are undoable here even though v1's own versions register no undo action at all - a deliberate, cheap fix, not a parity gap, since they fit the same cell-diff shape every other mutation here already uses.

A rectangular block selection distinct from the edit cursor (`beginSelection`/`extendSelection`/`selectAll`/`resetSelection`/`getSelectionRange`/`hasSelection`), and one addressable clipboard (`getClipboard`/`hasClipboard`) driven by `selectionCopy`/`selectionCut`/`selectionClear`/`selectionPaste` - all undoable the same way, via one `RANGE`-kind action per call. v1 kept a *second*, independent clipboard for whole-track/pattern copies (`editor.js`'s own `pasteBuffer`); this module has only the one - `copyTrack`/`pasteTrack`/`copyPattern`/`pastePattern` above remain explicit, no-clipboard primitives, and "copy the whole track to the clipboard" is `selectAll()` then `selectionCopy()`, not a second buffer. v1's `SELECTION.DELETE`/`REPLACE` stay declared, not implemented, matching v1 itself.

Not here: song-structural editing (the pattern-table sequence, pattern length, track count, a whole-song clear) - a different shape of edit (resizing the document, not diffing its cells), and not part of what spec 010's PORT-003 calls "pattern editing" either; v1 leaves these genuinely un-undoable too, and closing that gap is a later spec's decision to make explicitly, not this one's to absorb by extension. The pattern-grid UI itself (`runtime/gridController.js`, the `patternGrid` draw kind) is spec 030's, not this module's - it is a consumer of the API here, the same as any other.

Nothing here touches `runtime/store.js` or `app/state.js`. Song data, cursor position and undo history are reachable only through this module's own functions, per spec 010's own decision that the store holds only what the UI binds to.
