# 042 — Tasks

Status: done.

- [x] Re-read `sampleView.js` in full (1070 lines) before scoping - beyond spec 040's own high-level pass over the whole plugin.
- [x] `domain/song/index.js`: `getMaxInstruments`, `setCurrentInstrumentIndex` (thin re-exports of the ported engine's own methods).
- [x] `domain/sampleEditor/index.js`: `STATE_FIELDS`, `publishInstrumentFields`, `setInstrumentIndex`, `setInstrumentName`, `setVolume`, `toggleLoopEnabled`, `setLoopStart`, `setLoopLength`, and six zero-argument operation wrappers.
- [x] `runtime/waveformController.js`: `ensureZoom` resets the zoom window on an instrument switch, not only on first use (additive to spec 041).
- [x] `compiler/recipes.js`: `verb-action` gains six verbs (`normalize`/`trim`/`reverse`/`invert`/`fade in`/`fade out`); `CONDITION_FIELD_ALIASES` gains one entry (`loop enabled`).
- [x] `capabilities.js`: twelve new command mappings.
- [x] `project/specs/application/current/components/sampleEditPanel.yaml`: replaces spec 026's placeholder with real content.
- [x] `tests/recipes.test.js` (extended).
- [x] `tests/sampleEditor.test.js` (extended).
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the real outline, no new warnings, loose ends unaffected.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back (spec 036's own "confirm empirically" precedent, which caught one real field-name mismatch - see design.md) and by unit tests against a real loaded fixture for every new capability function, mirroring `tests/sampleEditor.test.js`'s own existing convention.

## Evidence

- `node compiler/generate.js`: 26 warnings, unchanged from before this spec (0 net new) - the first draft of the YAML briefly introduced two (`unknown-component-property` from `buttonGroup`'s own `content:` vs. `items:` shape, `ambiguous-duplicate-name` from two unnamed `spinBox` siblings), both fixed before this count - see Found while doing it. 0 errors. Read back `app-outline.json` directly (not just warning counts) to confirm every one of the twelve authored bindings' own `command`/`mockField` strings - see design.md's table. This is what caught `setVolume` deriving to `volume.set`/`volume.value` instead of the intended `sample-volume.*` (fixed by renaming the authored action to `setSampleVolume`), and confirmed the `loop-enabled.active` alias resolves identically from both the rule and the toggle action.
- `node build.mjs app`: 78 loose ends, unchanged from before this spec (all twelve new commands are mapped in `capabilities.js`; none left as a generated mock). `app/ui/sampleEditPanel.js`/`app/actions/sample*.js` read by hand to confirm each imports the real `domain/sampleEditor/index.js` export, not a mock.
- `tests/recipes.test.js`: 6 new tests (up from 4) - the six verb-action additions, the loop-enabled alias agreement.
- `tests/sampleEditor.test.js`: 8 new tests (19 total, up from 11) - `publishInstrumentFields` (with a real instrument, and its no-instrument fallback), `setInstrumentIndex`'s clamp/reset-selection/republish-even-when-rejected, `setInstrumentName`, `setVolume`'s clamp, `toggleLoopEnabled`'s flip and explicit-value paths, `setLoopStart`/`setLoopLength`'s real-sample-length clamp (not the static authored ceiling), and all six operation wrappers' own republish-on-change behavior.
- Full suite: `node --test tests/*.test.js` → 575/575 passing (567 before this spec + 8 new; the 567 itself already included spec 041's own 22).
- `node --check` passed on every touched/new `.js` file before any test was written.

## Found while doing it

- **Two authoring mistakes caught immediately by `node compiler/generate.js`'s own warnings, before any test ran**: `buttonGroup`'s container shape is `{ childrenIn: "items" }` (spec 021), not `content` - the first draft used `content:` and got an `unknown-component-property` warning naming exactly which properties are accepted; two unnamed `spinBox` siblings in the same row (`loop-start`/`loop-length`) resolved to the same identity and got an `ambiguous-duplicate-name` warning, fixed by giving each an explicit `name:`. Both fixed before generating the application; the final warning count is identical to before this spec.
- **One real defect in this spec's own first draft, caught by the empirical outline read-back**: the authored action name `setVolume` derives (via `actionNameAsProse` + the `set-value` recipe) to command `volume.set`/field `volume.value` - a single-word subject - not `sample-volume.*` as first assumed by analogy with the other five fields. Fixed by renaming the authored YAML action to `setSampleVolume` (deriving the intended, collision-avoiding field) rather than changing `capabilities.js`/`domain/sampleEditor`'s own constant to match the accidental name. This is exactly the class of mistake spec 036's own "confirm empirically" precedent exists to catch, and it did.
- **The scanning test `tests/componentTypes.test.js`'s "adding a component type touches only the registry"** flagged two of this spec's own comments (in `capabilities.js` and `compiler/recipes.js`) purely for containing the literal word "checkbox" in prose, unrelated to any type-name branch - that test's own `sourceFiles()` helper seeds `capabilities.js` (and `build.mjs`/`server.mjs`) into its scan explicitly, not only the four directories it walks. Reworded both comments to say "toggle control" instead - no behavior changed, and the lesson (avoid a component type's own bare name in prose comments in the seeded/walked files) is now folded into how this session writes such comments.
- **`toggle-generic`'s own regex requires the ENTIRE authored subject in one contiguous run with no extra words**, which made `toggleLoopEnabled` -> "toggle loop enabled" a clean match with no adjustment needed - unlike the rule side, which needed the new alias. Confirms the asymmetry called out in requirements.md's own Decisions section was real, not hypothetical.
- **`Tracker.setCurrentInstrumentIndex`'s own no-op-past-the-ceiling behavior in ProTracker mode** (engine/tracker.js:121, `if (index<=me.getMaxInstruments())`) means a naive capability that just forwarded the raw dragged value would silently desync the displayed spinBox value from the real current instrument whenever a user dragged past 31 in MOD mode. `setInstrumentIndex`'s own defensive clamp-then-always-republish avoids this, and the test `"setInstrumentIndex clamps to [1, getMaxInstruments()]..."` specifically exercises the desync case.

## Known limits

FT-only fields (finetune, panning, fadeout, relative note, vibrato speed/depth/sweep/wave-type) are not authored - see requirements.md's Decisions and Scope boundaries (blocked on the still-missing `disabledWhen` YAML vocabulary and on any mechanism for a control's authored `min`/`max` to vary by tracker mode). No envelope editing, loop creator, hiss-reduction panel, resample panel, draw mode, 8/16-bit conversion, playback preview, sample load/save, maximize/slices, percentage volume buttons, or Select group. Instrument-property edits (name/volume/loop) are not undoable. The screen's own fields display blank/zero values until the instrument-index control is first touched - there is no proactive "publish on song load" hook, and adding one would require `domain/playback` to import `domain/sampleEditor`, inverting this port's own established module layering. No browser verification occurred in this environment.
