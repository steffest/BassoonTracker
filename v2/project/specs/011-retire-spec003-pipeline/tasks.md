# 011 — Implementation

Status: implemented and verified 2026-09-10.

- [x] Traced every import of every candidate file before deleting anything, and corrected two assumptions: `hitTest.js` only mentions `normalize.js` in a comment, and `mountGeneric.js` has its own `flatten`, so `normalize.js` was removable after all; `store.js` was not, because `appState.js` wraps it.
- [x] Copied the eleven source files and four test files to this session's scratchpad, since no v2 file has ever been committed.
- [x] Deleted the retired pipeline.
- [x] Removed the follow-on dead code: `assets.js`'s pre-skin `button`/`panel` fields and their `legacy()` helper, and spec 009's seam-test exclusion.
- [x] Corrected the eight current documents and the service header, leaving the historical specs and the progress log alone.
- [x] Recorded the two capabilities that lived only in the retired code, in spec 010, `runtime.md` and this spec's design.
- [x] Verified.

## Evidence

| check | result |
|---|---|
| files removed | 11 source files and 4 test files, about 920 and 280 lines |
| dangling imports | none; every remaining reference was a comment, and all were corrected |
| unit suite | 111 tests, 109 passing, 2 pre-existing skips, down from 138 by exactly the 27 retired tests |
| compiled outline | byte-identical before and after |
| build | `node v2/build.mjs` runs all three targets; the bundle entry moved from 41,327 to 41,144 bytes |
| seam test | now covers every module with no exception: nothing anywhere branches on a component type name |

Browser: the workbench, the application, the generated app and the bundle all behave as before, and `/preview.html` and `/dev.html` now return 404. Verified in the acceptance run recorded below.

## Backup manifest

Recoverable for this session only, at `<scratchpad>/retired-spec003/`:

```
dev.html
preview.html
domain/mockTracker.js
project/specs/application/outline.json
renderers/canvas/mount.js
runtime/{commands,layout,normalize,uiCommands,validate}.js
templates/editor-workspace.js
tests/{commands,layout,normalize,validate}.test.js
```

## Found while doing it

- **The deletion removes v2's only accessibility layer.** `mount.js` put a real, visually transparent `<button>` over every control, which is where focus, accessible names, native Enter and Space activation and the disabled state came from. `mountGeneric.js` has never had one. Spec 010 had claimed the roadmap's promised semantic mirror was never delivered; it was, for this renderer only. Both documents now say so, and spec 010's renderer package carries it forward with the note that the semantic layer deserves its own decision rather than being a side effect of the DOM-renderer question.
- **Command enablement went with it too.** `runtime/commands.js` was the only implementation of "may this command run", consulted by both the renderer and the dispatcher. Spec 010's interaction package now owns rebuilding it.

## Known leftovers

`v2/templates/` and `v2/domain/` are now empty directories. Directory removal is denied in this environment, so both were left in place; `domain/` is wanted anyway, because spec 010's playback package fills it next.
