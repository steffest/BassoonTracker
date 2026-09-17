# 046 — Tasks

Status: done.

- [x] Read `resamplePanel.js` (116 lines) and `waveform.js#resampleToRate`/`#resample` in full before scoping.
- [x] `domain/sampleEditor/resample.js` (new): `openResample`, `isResampleOpen`, `getResampleState`, `setTargetIndex`, `closeResample`, `getTargetNoteName`, `getTargetRate`, `applyResample`.
- [x] `domain/song/index.js`: `getNoteForResampleIndex` (ported from `modeNote`/`noteName`/`targetPeriod`).
- [x] `domain/playback/index.js`: `getSampleRateForPeriod` (thin forward to `Audio.getSampleRateForPeriod`).
- [x] `domain/sampleEditor/index.js`: `openResample`, `setResampleTargetIndex`, `toggleResampleInterpolate`, `saveResample`, `cancelResample`, `publishResampleFields`.
- [x] `compiler/recipes.js`: one new `CONDITION_FIELD_ALIASES` entry (`resample interpolate`).
- [x] `capabilities.js`: five new command mappings.
- [x] `project/specs/application/current/components/sampleEditPanel.yaml`: a third `visibleWhen`-gated child (`resamplePanel`) plus a new "Resample" button.
- [x] `tests/recipes.test.js` (extended): the alias, and the four existing-verb resolutions (open/save/cancel/set).
- [x] `tests/sampleEditor.test.js` (extended): `getNoteForResampleIndex` in every mode, all five capability wrappers against the real fixtures.
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the outline (the command/field table, read back) and no new mocked commands.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back (spec 036/042/045's own precedent) and by unit tests against real loaded fixtures (`wizballalt.mod` for ProTracker mode, `sin.xm` for FastTracker/linear-frequency mode) for every new capability function.

## Found while doing it

- **A real design gap in this spec's own first draft, not v1's**: the original design sketch gave the resample panel its own independent `resample.mode` field, mirroring spec 045's `loop-creator.mode` one-for-one. `runtime/genericLayout.js#isVisible` (spec 025) reads exactly one `field`/`oneOf` pair per node, so two independent panel-switch fields cannot mutually exclude a third sub-view - `sampleEditNormalView` and `resamplePanel` would both render at once whenever `resample.mode` was `"open"`, since its own `visibleWhen` only ever checked `loop-creator.mode`. Caught by re-reading `genericLayout.js` before writing the YAML, not by a failing test (no test exercises simultaneous-panel-visibility directly). Fixed by consolidating both fields into one shared `sample-edit-view.value` (`""`/`"loop-creator"`/`"resample"`), read by all three sub-views - a rename of spec 045's own delivered field, done here rather than left as a latent bug for whichever spec added a fourth sub-view to discover the hard way. `domain/sampleEditor/index.js`'s `openLoopCreator`/`saveLoopCreator`/`cancelLoopCreator` and their own six pre-existing tests were updated in place; see design.md's own "Found while doing it" note (its earlier sections still show the original, superseded sketch, deliberately not rewritten line by line).
- **Two `ambiguous-duplicate-name` collisions**, caught by `tests/compiler.test.js`'s own fixed-count assertion (`counts["ambiguous-duplicate-name"] === 1`, previously only the two notification lights): several field-bound `label` nodes with no `label:` text and no `name:` fell back to the bare type `"label"` as their local identity (`compiler/identity.js#localIdentity`), colliding with sibling labels under the same row (`resampleSourceRow`: 2; `resampleTargetRow`: 3). Fixed by naming every field-bound label explicitly (`resampleSourceRate`, `resampleSourceSize`, `resampleTargetNote`, `resampleTargetRate`, `resampleTargetSize`) - the same rule spec 042's own two authoring mistakes already illustrated (an unnamed spinBox pair colliding the same way).
- **A real domain-boundary violation caught by `tests/domainBoundary.test.js`**: this spec's own first draft of `tests/sampleEditor.test.js` imported `TRACKERMODE` directly from `domain/playback/engine/enum.js` to force FastTracker mode for the FT-mode test case - a direct engine import from outside `domain/playback/`, which that test mechanically forbids even for test files. Fixed by loading the real `sin.xm` fixture instead (the same convention every other test needing FT mode already uses - `tests/moduleExport.test.js`/`tests/playback.test.js` - confirmed by grep before assuming a fix), which sets FastTracker mode and `useLinearFrequency` through the real XM loader; the non-linear-period branch is then reached by toggling `Tracker.useLinearFrequency` directly (a plain property on the already-obtained `Tracker` singleton, not a new import).
- **A measurement mistake in this spec's own ad hoc verification script, not the shipped code**: an early manual check of `getNoteForResampleIndex`'s non-linear FT-mode branch was run without ever loading a module, so `Tracker.useLinearFrequency` was still at the engine's own unconditional default (`true`, set once at construction, only ever turned off by a MOD/XM loader) - making the "non-linear" and "linear" checks silently identical. Caught by the real test's own loaded-fixture assertion failing with a different, genuine value (856, not the assumed 5376); fixed by asserting the real value's shape (name/type) rather than a wrong hand-guessed number, and by proving the linear/non-linear cases actually differ instead of assuming it.

## Evidence

- `node compiler/generate.js`: 25 warnings, 0 errors - unchanged, none naming any node this spec added.
- Read back `app-outline.json` directly: all five bindings' own `command`/`mockField` strings match design.md's table exactly (`resample.open`/`resample.save`/`resample.cancel` with no field; `resample-interpolate.toggle` -> `resample-interpolate.active`; `resample-target-index.set` -> `resample-target-index.value`).
- `node build.mjs app`: loose ends unchanged at 82 (spec 045's own count) - all five new commands mapped in `capabilities.js`; `app/actions/resample*.js` read by hand to confirm none is a `GENERATED MOCK`.
- `tests/recipes.test.js`: 2 new tests (10 total, up from 8 after this session's earlier spec-045 gap-fill) - the resample-interpolate alias, and the four existing-verb resolutions (confirming no new `verb-action` vocabulary was needed).
- `tests/sampleEditor.test.js`: 9 new tests (35 total, up from 26 after this session's earlier spec-045 gap-fill) - `getNoteForResampleIndex` across ProTracker/FastTracker/linear-frequency modes, `openResample`'s session-open/field-publish/no-instrument-guard, `setResampleTargetIndex`'s clamp and republish, `toggleResampleInterpolate`'s flip/explicit-value paths, `saveResample`'s undo round trip in both interpolation modes (including a loop-bounds-scaled-by-ratio assertion), `saveResample`'s nearest-sample-vs-interpolated length distinction, and `cancelResample`'s no-mutation guarantee plus both save/cancel's harmless-when-nothing-open case. Also updated 5 pre-existing spec-045 tests for the `loop-creator.mode` -> `sample-edit-view.value` rename.
- Full suite: `node --test tests/*.test.js` -> 648/648 passing (628 at this session's start, +9 filling spec 045's own missing test coverage, +11 for this spec: 2 in recipes.test.js, 9 in sampleEditor.test.js).
- `node build.mjs dist` still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded.

## Known limits

Same as requirements.md's own Scope boundaries: no keyboard-driven target-note entry (a spinBox instead), no `resample("up"/"down")` quick actions (a different, separately-named v1 action), no hiss-reduction panel (deferred per user direction), no 8/16-bit conversion or playback preview. No browser verification occurred in this environment.
