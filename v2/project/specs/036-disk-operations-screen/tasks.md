# 036 — Tasks

Status: implemented and verified 2026-09-13.

- [x] `project/specs/application/current/components/fileOperationsPanel.yaml`: replaced spec 026's placeholder with the target radioGroup + `fileBrowser` instance.
- [x] Ran `node compiler/generate.js` and read `app-outline.json` back to confirm the real node ids/derived command names before writing the capability (`main.fileOperationsPanel.browser`, `disk-target.set`/`.value`, `browser-row.set`/`.value`).
- [x] `domain/diskOperations/index.js` (new): `setDiskTarget`, `setBrowserRow`, `reset` (test/harness entry point).
- [x] `v2/assets/data/modules.json` (new): the curated local snapshot.
- [x] `capabilities.js`: `disk-target.set`/`browser-row.set` mapped.
- [x] `build.mjs`: the dist asset-copy step generalized from one hardcoded `assets/demo/` block to a `mediaSubdirs` loop (`["demo", "data"]`); verified the copy logic directly (esbuild's own pre-existing, unrelated failure blocks a full `dist` build in this environment before that step runs).
- [x] `tests/diskOperations.test.js` (new, 8 cases).
- [x] `tests/domainBoundary.test.js`: added to the existing provider-host exclusion list.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`: succeeds; the two new commands leave the mocked-command list; loose ends 76 → 79 (the three new radio items' own "inert-control" entries - expected, matching every other radioGroup).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019). The generated app's own wiring (`app/ui/fileOperationsPanel.js`, `app/ui/diskTargetRow.js`, `app/actions/{diskTargetSet,browserRowSet}.js`) was read by hand after a real `node build.mjs app` run to confirm the emitted code imports and calls this spec's own capability correctly - not just that the unit suite passes in isolation.

## Evidence

`node --test tests/*.test.js`: 495 tests, all passing, up from 487 (8 new in `tests/diskOperations.test.js`).

`node build.mjs app`: succeeds, exit 0. `app/LOOSE-ENDS.md`'s item count moves from 76 to 79 - exactly the three new radio items' own inert-control entries, no new mocked-command entries (both `disk-target.set` and `browser-row.set` are real). Hand-read the generated `app/ui/fileOperationsPanel.js`, `app/ui/diskTargetRow.js` and both new `app/actions/*.js` wrappers: the fileBrowser node carries the exact id design.md predicted, and both action wrappers import `domain/diskOperations/index.js`'s own exports, matching every other capability-backed action's shape.

`node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch every spec since 019 has recorded, before the asset-copy step this spec touched ever runs; the copy logic itself was verified directly with a standalone script against a throwaway directory (see "Found while doing it").

## Found while doing it

- **A real bug in the first draft, caught by the capability's own test, not by inspection**: `loadModule`'s own URL resolution (`new URL(url, globalThis.location?.href)`) throws `Invalid URL` for a relative path with no `globalThis.location` - true in Node, and also the *wrong* base even in a real browser (a local snapshot's `url` is relative to `v2/assets/`, not to wherever the generated application's own page happens to be hosted). Fixed by resolving a leaf's `url` through the same `assetUrl()` helper `loadBassoonRoot()` already uses, before calling `loadModule` - a remote catalog's own absolute `url` passes through unchanged, so this is one code path, not a branch on which target is active.
- **Confirming the fileBrowser's own runtime id empirically was the right call, not a shortcut**: rather than re-deriving `identity.js`'s naming rules by reading them, the YAML was authored first, the outline regenerated, and the real id read back - `main.fileOperationsPanel.browser`, exactly the panel's own authored name plus the fileBrowser's own, no collision. Confirmed the two commands' derived names (`disk-target.set`/`browser-row.set`) the same way.
- **`build.mjs`'s dist asset-copy step had never needed more than one folder before** - generalizing it from a single hardcoded `assets/demo/` block to a small loop over `["demo", "data"]` was a five-line change once the shape was clear, verified in isolation (a standalone script against a throwaway directory) since the pre-existing `esbuild` version mismatch in this environment blocks ever reaching that code through a real `node build.mjs dist` run.
- **Everything else matched design.md going in**: the flatten/publish shape needed no revision once the row contract (spec 035) and the tree-node shape (v1's own, unchanged) were both already settled; the "cached, never re-fetched" test for a branch's children passed on the first try.

## Known limits

Samples, playlists, save/export, Dropbox and local-file browsing remain out of scope - see requirements.md. `v2/assets/data/modules.json` is a curated nine-entry subset of v1's own twenty-seven, not a full port - the sixteen entries with a `demomods/`-relative URL were left out rather than silently broken, since no such folder exists in this port yet. No browser verification occurred in this environment - the same recorded gap every spec since 019 has left; this spec's own verification rests on the unit suite plus a hand-read of the regenerated `app/` output, not a real page load or a real click on a real button.
