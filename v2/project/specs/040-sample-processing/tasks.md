# 040 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Dedicated research pass reading `script/plugins/sampleeditor/{sampleEditor,sampleView,waveform,sampleProcessing,loopCreator,resamplePanel,hissReductionPanel}.js` in full (~4,300 lines) before scoping - confirmed `sampleProcessing.js` as the cleanest, most portable first slice.
- [x] Independently traced `domain/song/editHistory.js`'s own `EDITACTION.SAMPLE` seam and `script/src/ui/stateManager.js#createSampleUndo`/its undo-redo dispatch before designing the undo integration.
- [x] `domain/sampleEditor/processing.js` (new, pure): `normalize`, `fadeIn`, `fadeOut`, `adjustVolumePercent`, `reverseRange`, `invertRange`, `trimBounds` - three small, deliberate guards added against v1's own division-by-zero edge cases (a silent range, a single-sample range).
- [x] `domain/sampleEditor/index.js` (new): selection get/set/reset, `adjustVolume`/`trim`/`reverse`/`invert`, each registering one undo entry.
- [x] `domain/sampleEditor/README.md` (new).
- [x] `domain/song/index.js`: `getCurrentInstrument()`, `registerSampleEdit()`, an internal `applySampleDiff` wired into `createEditHistory`.
- [x] `domain/song/editHistory.js`: `applySampleDiff` option added, `replay()`'s own SAMPLE branch implemented (the stale "P10's own territory" comment removed - this is that implementation).
- [x] `tests/sampleProcessing.test.js` (new, 16 cases).
- [x] `tests/sampleEditor.test.js` (new, 11 cases, against a real loaded fixture).
- [x] `tests/song.test.js` (extended, +1): a SAMPLE-kind action now genuinely replays through a supplied `applySampleDiff`, not just a no-op; the prior no-op test's own description corrected (it was never testing "declared, not implemented" once this spec exists - now it explicitly tests the "no `applySampleDiff` supplied" case, distinct from the real one).
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler/capabilities.js change - confirmed by rebuilding; loose ends unchanged at 78).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019) - no screen exists yet. `processing.js` is verified with plain arrays and known expected output (not a round trip - there is no file format involved); `index.js` is verified against a real loaded fixture (`wizballalt.mod`, the same one every other engine-integrated test in this suite already uses), since sample edits mutate the exact instrument object the engine holds, the same reasoning `domain/song`'s own tests already follow.

## Evidence

`node --test tests/*.test.js`: 543 tests, all passing, up from 515 (16 new in `tests/sampleProcessing.test.js`; 11 new in `tests/sampleEditor.test.js`; 1 more in `tests/song.test.js`).

`node build.mjs app`: succeeds, exit 0, loose ends unchanged at 78 - confirms this spec touched no YAML/compiler/capability surface, exactly as planned (a headless capability spec, matching spec 039's own shape). `node build.mjs dist`: unaffected, still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded.

## Found while doing it

- **The `EDITACTION.SAMPLE` seam really was planted on purpose, two specs early** - confirmed by tracing `domain/song/editHistory.js`'s own comment and construction call (`createEditHistory({ applyPatternDiff })`, no sample hook wired) before writing anything, rather than assuming design.md's own claim. This meant the undo integration needed no new mechanism, only filling in an already-shaped gap - the same kind of "read before designing" that avoided guessing at a host interface in spec 039.
- **Two real, small data-corrupting bugs in v1's own algorithms, found and fixed rather than ported**: `adjustVolume("max")` on an entirely silent (all-zero) range divides by zero (`scale = Infinity`), turning every sample into `NaN`; `adjustVolume("fadein"/"fadeout")` on a single-sample selection divides `i/last` with `last = 0`, same result. Neither is a deliberate v1 behavior worth preserving (unlike, say, `domain/playback/README.md`'s own audible 8-bit clipping quirk) - both are guarded here, each with a comment explaining why, the same kind of call spec 034 made fixing `hippo.js`'s own crash.
- **`applySampleDiff` needed to use `action.data`/`.dataTo`'s own lengths, not `action.to`** (the selection length *at edit time*, which `trim()` makes stale the moment it shortens the data) - worked out by hand before writing the code, not discovered by a failing test, since getting this wrong would have silently corrupted data on undo/redo for `trim()` specifically while `reverse`/`invert`/`adjustVolume` (never length-changing) would have looked fine. The dedicated `tests/sampleEditor.test.js` case for `trim()`'s own undo/redo round trip (including the sample's own `length` field) exists specifically to prove this, not just to exercise the happy path.
- **Everything else matched design.md going in**: `withRange`'s shared bookkeeping needed no revision once the four operations' own "did anything change" convention (`normalize`'s own early return vs. the other three always changing something) was settled; the cross-instrument undo test (switch away, then undo, and confirm it switches back) passed on the first try, mirroring `stateManager.js`'s own `undo()`/`redo()` line exactly (`if (action.instrument && action.instrument !== Tracker.getCurrentInstrumentIndex()) ...`).

## Known limits

The waveform view, the rest of the sample-editor screen, `loopCreator.js`/`resamplePanel.js`/`hissReductionPanel.js`, `resample`/`resampleToRate`, and 8-bit/16-bit conversion all remain out of scope - see requirements.md. Nothing here is reachable from any UI yet (no screen, no capability mapping) - verified headless only, matching spec 039's own precedent. No browser verification occurred in this environment.
