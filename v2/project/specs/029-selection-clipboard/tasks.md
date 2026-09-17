# 029 — Tasks

- [x] Re-read `script/src/ui/app/components/patternView.js`'s selection/clipboard code and `script/src/ui/ui.js`'s `setSelection`/`copySelection`/`cutSelection`/`pasteSelection` in full; confirmed which of the eight `SELECTION` verbs v1 actually implements.
- [x] `domain/song/selection.js` (new): pure `createSelectionState()` (range + clipboard storage) and standalone `normalizeRange()`.
- [x] `domain/song/index.js`: `beginSelection`, `extendSelection`, `selectAll`, `resetSelection`, `getSelectionRange`, `hasSelection`, `selectionCopy`, `selectionCut`, `selectionClear`, `selectionPaste`, `getClipboard`, `hasClipboard`, `clearClipboard` - all built on the existing `scopedAction`/`addDiff`/`history.registerEdit` primitives spec 028 already has, no changes to spec 028's own exports.
- [x] `domain/song/README.md`: move selection/clipboard from "not here" to "here", record the one-clipboard decision.
- [x] `tests/song.test.js` (extended, or a new `tests/selection.test.js`): range normalization (either drag direction), `selectAll`, copy/cut/clear/paste each undoable, clipboard survives a pattern switch, clipboard is readable directly without a paste, paste clips to track count and pattern length, paste with no active selection targets the cursor.
- [x] `node --test "v2/tests/*.test.js"` passes; `node build.mjs app`/`dist` succeed unchanged (no YAML authored).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; **package P6 is now fully closed**.
