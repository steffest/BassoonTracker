# 050 — Tasks

Status: done.

- [x] Read `sampleView.js`'s own `EVENT.trackerModeChanged` handler (1004-1029) in full before scoping, confirming both "missing mechanisms" spec 042 recorded were smaller than assumed.
- [x] `compiler/recipes.js`: one new `RULE_RECIPES` entry (`disabled-unless-active`); one new `CONDITION_FIELD_ALIASES` entry (`ft mode`).
- [x] `compiler/emit.js`: the `disabledWhen`-generating branch, added in **both** of emit.js's own node-construction paths (a real, confirmed bug found while implementing - see below).
- [x] `domain/playback/index.js`: `STATE_FIELDS.ftMode`, `publishFtMode`, called from both `loadModule` and `openFiles`.
- [x] `domain/sampleEditor/index.js`: eight new capability functions (`setFinetune`, `setPanning`, `setFadeout`, `setRelativeNote`, `setVibratoSpeed`, `setVibratoDepth`, `setVibratoSweep`, `setVibratoWave`); `STATE_FIELDS`/`publishInstrumentFields` extended.
- [x] `capabilities.js`: eight new command mappings.
- [x] `project/specs/application/current/components/sampleEditPanel.yaml`: a new `ftOnlyRow` inside `sampleEditNormalView`, with `rule:` on each of the eleven interactive controls (not the row or the radio group - see below).
- [x] `tests/recipes.test.js` (extended): the new rule recipe, the alias, all eight `set-value`-derived actions.
- [x] `tests/emit.test.js` (extended): a real `disabledWhen` for an inline child, and a synthetic test proving the module-root path too.
- [x] `tests/playback.test.js` (extended): `ft-mode.active` for both a `.mod` and a `.xm` fixture.
- [x] `tests/sampleEditor.test.js` (extended): all eight capability functions, including finetune's own mode-dependent clamp in both modes.
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command/field table, read back) and the loose-ends delta.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back (spec 036/042/045/046/048/049's own "confirm empirically" precedent), by a real generated `disabledWhen` function evaluated directly (mirroring the existing `highlightedWhen` test right next to it), and by unit tests against the real engine for every new capability.

## Evidence

- `node compiler/generate.js`: 16 warnings, 0 errors, unchanged - none on any node this spec added.
- Read back `app-outline.json`: all eight bindings match design.md's table exactly; `ftOnlyRow`'s own eleven interactive descendants each carry the `disabled-unless-active` binding (`ft-mode.active`), confirmed individually, not just spot-checked.
- `node build.mjs app`: loose ends rose from 84 to 88, entirely the four new vibrato-waveform `radioItem`s' own `inert-control` entries - the same established category every other authored `radioGroup`'s items already carry. None of the eight new commands appear as `mocked-command`; `app/actions/{finetune,panning,fadeout,relativeNote,vibratoSpeed,vibratoDepth,vibratoSweep,vibratoWave}Set.js` all exist and import the real `domain/sampleEditor/index.js` export.
- `tests/recipes.test.js`: 3 new tests (18 total, up from 15).
- `tests/emit.test.js`: 2 new tests (up from the pre-existing count) - one against the real generated tree (an inline child), one synthetic (the module-root path, exercised directly since the real YAML no longer puts a rule there).
- `tests/playback.test.js`: 1 new test (15 total) - `ft-mode.active` correct for both a `.mod` and a `.xm` fixture.
- `tests/sampleEditor.test.js`: 8 new tests (43 total, up from 35).
- Full suite: `node --test tests/*.test.js` -> 728/728 passing (714 before this spec + 14 new).
- `node build.mjs dist` still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded.

## Found while doing it

- **Both of spec 042's own recorded "missing mechanisms" turned out smaller than estimated, confirmed by reading the whole handler rather than trusting the earlier one-example summary.** Re-reading `sampleView.js:1004-1029` in full (not just the `fineTuneSlider` example spec 042's own research already knew) found only `fineTuneSlider` actually re-bounds by mode; every other of the eight disabled controls keeps one fixed range regardless of mode. Since ProTracker's own finetune range (`-8..7`) is a strict subset of FastTracker's (`-128..127`), "author the wide range as the ceiling, clamp the narrow one in the capability" (spec 042's own established shape for `loop-start`/`loop-length`) closed the second "mechanism" without inventing anything new at all.
- **A real, confirmed compiler bug, found only by checking the generated output rather than trusting the outline**: after adding the `disabledWhen`-generating branch to `compiler/emit.js`'s `nodeExpression()` (the path for an inline child) and authoring the rule on `ftOnlyRow` itself (a module-owning `panel`), the compiled outline showed the binding correctly, but the *generated JavaScript* for `ftOnlyRow`'s own module never carried `disabledWhen` at all. `emit.js` has a second, separate node-construction path (the loop building each `ui/<module>.js` file's own root, `emit.js:356` onward) that never processed rule bindings at all - the exact same class of gap spec 025 already found and fixed once for `breakpoints`/`visibleWhen` ("two separate node-construction code paths and only one carried [them] to a *generated* application"), recurring for a different property pair because nothing had ever put a `rule:` directly on a module-owning container before this spec. Fixed the same way spec 025 fixed its own: duplicated the same branch into the second path rather than unifying them.
- **A second, related design correction, found by reading the renderer's own sync loop rather than assuming a container's `disabled` cascades to its children**: even after fixing the compiler gap above, authoring the rule on `ftOnlyRow` itself (or on `vibratoWaveGroup`, the radio group) would have had zero runtime effect - `mountGeneric.js#syncDisabled` skips any node with no controller, and both `panel` and `radioGroup` are `interactive: false` and have none; only `slider`/`spinBox`/`radioItem` do. Design.md's own first draft had already recorded this exact contingency ("if a container's own disabled does not propagate to its children, each control gets its own identical rule instead") before writing any YAML, so the fix was applying that already-planned fallback: eleven identical `rule:` lines (seven sliders/spinboxes, four radio items), not one on the row.

## Known limits

Same as requirements.md's own Scope boundaries: no envelope editing, no Loop/Vibrato tab switch (both sections always shown together, gated only by `disabledWhen`), no instrument-property undo (unchanged from spec 042's own recorded limitation). No browser verification occurred in this environment.
