# 067 — Tasks

Status: done.

- [x] Re-read `script/src/ui/diskOperations.js` (the Load/Save toggle, `DiskOperationActions`) and `script/src/ui/diskOp_Save.js` (already read in full for spec 064) before designing, specifically tracing the module type's own "wav"/"mp3" options line by line to confirm they are a whole-song render, not sample export.
- [x] `compiler/recipes.js`: `"export"` added to the `verb-action` verb list.
- [x] `components/fileOperationsPanel.yaml`: `diskActionRow` (new); `visibleWhen` added to the three existing load-view nodes (no id change); `saveView`/`saveTypeRow`/`saveModulePanel`/`saveSamplePanel`/`savePlaylistPanel` (new).
- [x] `domain/moduleExport/index.js`: `setSampleExportFormat`, `exportSampleSelection`.
- [x] `domain/playlist/index.js`: `setPlaylistExportFormat`, `exportPlaylistSelection`.
- [x] `capabilities.js`: four new mappings (`sample-format.set`, `sample.export`, `playlist-format.set`, `play-list.export`).
- [x] `tests/saveExportScreen.test.js` (new).
- [x] `tests/sampleExport.test.js`, `tests/playlist.test.js`, `tests/recipes.test.js` (extended).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`: 12 warnings, unchanged.
- [x] `node build.mjs app`/`dist`: 101 loose ends, up from 87 (the expected 12 new inert radio items + 2 new deliberately-mocked pure-UI-state commands; no new `unresolved-*` warning).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment). `tests/saveExportScreen.test.js` compiles the real, live `app.yaml` and exercises visibility purely through `computeGenericLayout()`, the same convention specs 048/059/062 already established (no hand-built tree - this is the real application). The two new capability wrappers are exercised through the same DOM-stub convention their own underlying capabilities (`exportSample`/`exportPlaylist`) already use.

## Evidence

- `tests/saveExportScreen.test.js`: 6/6 passing - the whole panel absent outside "File Operations"; the load view visible and the save view absent at the real seeded default (`disk-action.value` unset); the save view visible (defaulting to the Module sub-panel) and the load view absent once `disk-action.value` is `"Save"`; `save-type.value` of `"Sample"`/`"Playlist"` each showing exactly one sub-panel with its own format radioGroup and button present.
- `tests/sampleExport.test.js`: 2 new tests - `exportSampleSelection` dispatches to whichever format `setSampleExportFormat` last selected (XI then RAW 8-bit, asserted by the downloaded file's own extension); an unrecognized label falls back to `wav8`.
- `tests/playlist.test.js`: 2 new tests - the identical shape for `exportPlaylistSelection`/`setPlaylistExportFormat` (M3U then JSON; an unrecognized label falls back to `pls`).
- `tests/recipes.test.js`: 2 new tests - `exportSample` → `sample.export`; `exportPlayList` → `play-list.export` (confirmed to land on the same `play-list` noun spec 063's own `randomPlayList` already established, not a second spelling).
- Full suite: `node --test tests/*.test.js` → 944/944 passing (934 before this spec + 6 + 2 + 2).
- `node compiler/generate.js`: 12 warnings, unchanged (every new authored action reference resolved; confirmed by grepping the regenerated `app-outline.json` for each of the eight new/reused command names before trusting the warning count alone).
- `node build.mjs app`: 101 loose ends, up from 87 - accounted for exactly: 12 new `inert-control` radio items (Load, Save, Module, Sample, Playlist, WAV 8-bit, WAV 16-bit, RAW 8-bit, XI, PLS, M3U, JSON) and 2 new `mocked-command` entries (`disk-action.set`, `save-type.set`, both deliberate). `node build.mjs dist` succeeds.
- `node --check` passed on every new/touched source and test file before the suite ran.

## Found while doing it

- **v1's own module-type "wav"/"mp3" save options are not sample export** - a first read of `diskOp_Save.js`'s selection-type table alone could easily conflate them with the sample type's own identically-labeled options; tracing the `onClick` handler's own branch for `mainFileType === FILETYPE.module` line by line (72-95) confirmed they call `BassoonProvider.renderFile(...)` instead - a whole-song offline render, a real, separate, still-unallocated P9 item, not a gap in this spec's own scope.
- **No renesting was needed for the existing load-view content** - `visibleWhen` is a per-node property, not a restructuring; adding it directly to `diskTargetRow`/`browser` (rather than wrapping them in a new panel, which is what the *save* side's own new content needed) kept `main.fileOperationsPanel.browser`'s own id, `domain/diskOperations/index.js`'s hardcoded field name and every one of `tests/diskOperations.test.js`'s own assertions untouched - avoiding the exact class of accidental id-shift breakage specs 046/048/049 each hit once before.
- **Two real test-harness gaps caught before trusting any assertion**: the first draft of `tests/saveExportScreen.test.js` omitted `"main-view.value": ""` from its own `stateValueOf` stub (a bootstrap default `pianoScreen.test.js`'s own sibling-only `pianoPanel` never needed, since `fileOperationsPanel` is nested *inside* `normalMainView`, unlike `pianoPanel`); the same test then also needed `"disk-action.value": ""`/`"save-type.value": ""` supplied explicitly for its own "unset default" cases, since the real running application seeds these mocked fields but this test's own hand-built `stateValueOf` stub does not unless told to.

## Known limits

No MP3/WAV whole-song render, no Dropbox target, no filename rename field, no "has a playlist" gate on the Playlist export button, no disk-operations playlist listboxes - see requirements.md's Scope boundaries. No browser verification occurred in this environment.
