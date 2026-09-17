# 050 — The FT-only side panel and `disabledWhen` authoring

Date: 2026-09-14. Kind: feature. Status: specified. Continues package **P10** (features and the plugin path) of the [port roadmap](../010-port-roadmap/requirements.md), closing spec 042's own recorded gap: "FT-only fields (finetune, panning, fadeout, relative note, vibrato)... blocked on two genuinely missing mechanisms." Both turn out smaller than spec 042 estimated - see Decisions and assumptions.

## Purpose

`sampleView.js`'s own `EVENT.trackerModeChanged` handler (`sampleView.js:1004-1029`, read in full for this spec) disables eight controls outright in ProTracker mode and re-bounds one (`fineTuneSlider`) dynamically. Spec 042 deferred all of it, recording two missing mechanisms: no YAML vocabulary for `disabledWhen`, and no way for a control's authored `min`/`max` to vary by tracker mode. This spec closes both, then authors the fields themselves.

## What v1 actually does, and what this narrows out (read from source, not assumed)

`sampleView.js:1004-1029`:

```js
EventBus.on(EVENT.trackerModeChanged,function(mode){
    fineTuneSlider.setMax(mode === TRACKERMODE.PROTRACKER ? 7 : 127,true);
    fineTuneSlider.setMin(mode === TRACKERMODE.PROTRACKER ? -8 : -128,true);
    ...
    volumeEnvelope.disabled = panningEnvelope.disabled = spinBoxRelativeNote.disabled =
    spinBoxVibratoSpeed.disabled = spinBoxVibratoDepth.disabled = spinBoxVibratoSweep.disabled =
    fadeOutSlider.disabled = panningSlider.disabled = !Tracker.inFTMode();
    ...
});
```

- **`disabledWhen` already exists as a runtime mechanism** (spec 015 INT-016: a `disabledWhen(state)` hook, synced generically after every state change, exactly where `highlightedWhen` already is - confirmed by reading `renderers/canvas/mountGeneric.js:1274-1290`, which reads `node.disabledWhen` off *any* node, hand-built or compiled, with no special-casing). What never existed is a *compiler* path from an authored `rule:` to that hook - `compiler/emit.js` has only ever generated `highlightedWhen` (confirmed by reading the whole rule-binding-to-generated-code block, `emit.js:298-310` - one `if` branch, never a second). This spec adds the second branch and one new `RULE_RECIPES` entry; nothing in the runtime changes at all.
- **The "min/max varies by mode" gap turns out not to need a new mechanism.** Only `fineTuneSlider` re-bounds (`panningSlider`/`fadeOutSlider`/`spinBoxRelativeNote`/the three vibrato spinboxes all keep one fixed range regardless of mode - confirmed by reading the whole handler, not assumed from the one example spec 042's own research already knew). ProTracker's own finetune range (`-8..7`) is a strict subset of FastTracker's (`-128..127`), so authoring the wide range as the static ceiling and clamping to the narrow one inside the capability handler when `!inFTMode()` is exactly the same "authored ceiling, real clamp on change" shape spec 042 already used for `loop-start`/`loop-length` against the sample's own real length - not a new pattern.
- **`instrument.vibrato.type`'s own four waveforms** (`waveLabels = ["sin","square","saw","saw_inverse"]`, `sampleView.js:329`) are authored as a `radioGroup`, matching every other small fixed choice set in this port (difficulty, loop presets, disk targets).
- **v1's own Loop/Vibrato sub-tab** (`setSubPanel`, `sampleView.js:889-917`) also hides the *already-authored* loop start/length controls while the Vibrato tab is active. Spec 042 already made those always-visible (not tabbed) - a deviation from v1 this spec does not revisit. Rather than build a second, narrower tab switch just for RelativeNote-vs-Vibrato (and touch nothing else), this spec shows both sections plainly, all the time, relying entirely on `disabledWhen` to greyed them out correctly in ProTracker mode - one fewer view-switch field, a real, recorded simplification of secondary screen real estate, not a functional change (nothing in either section is reachable in ProTracker mode either way).
- **The envelope panels** (`volumeEnvelope`/`panningEnvelope`, also disabled by the same handler) stay out of scope - envelope editing is a substantial, separate feature spec 042 already deferred for its own reasons, unrelated to this spec's own `disabledWhen` work.

## Decisions and assumptions

- **One new `RULE_RECIPES` entry, `disabled-unless-active`** (`"disabled unless X is active"`), mirroring `highlighted-when-active`'s own shape exactly but emitting a `{kind: "visual-state", state: "disabled"}` binding whose generated check is negated (`!==`, not `===`) - "disabled unless the condition holds" reads more naturally for this handler's own actual logic (`disabled = !inFTMode()`) than a double-negative "disabled when not X."
- **One new `CONDITION_FIELD_ALIASES` entry, `ft mode`** - confirmed empirically, as every prior entry in this list was, that the bare subject "ft mode" derives no field agreeing with whatever this spec publishes.
- **A new state field, `ft-mode.active`, published by `domain/playback/index.js`** (not `domain/sampleEditor/` or `domain/song/`) - which format loaded is playback/format state, the same reasoning that already put `getSampleRateForPeriod` there for spec 046 rather than growing `domain/song`'s own surface. Published at the same two points `song.title`/`playback.status` already are (`loadModule`, `openFiles`) - the only two places anything in this port learns a new module has loaded.
- **Finetune, panning, fadeout, relative note and the three vibrato values are not undoable**, matching spec 042's own recorded decision for volume/loop-enabled/loop-start/loop-length (v1's own `trackUndo`/`undoInstrument` mechanism replays through a live UI control object nothing in v2 has ever registered) - the same class of edit, not a new exception.
- **No Loop/Vibrato tab switch** - see above; both sections render together, `disabledWhen`-gated identically.

## User stories and acceptance

- **FT-001 — `disabledWhen` is authorable from YAML for the first time.** `rule: disabled unless ft mode is active` compiles to a real `disabledWhen` function on the generated node; a `.mod` fixture leaves it disabled, a `.xm` fixture leaves it enabled. Acceptance: a compiler-recipe unit test (the rule's own binding shape) plus an emit unit test (mirroring `tests/emit.test.js`'s own "generated UI builds the same tree..." convention) asserting the generated node's `disabledWhen` function returns the right boolean for both a `"protracker"`-shaped and `"fasttracker"`-shaped mock state.
- **FT-002 — Finetune clamps to the real range for the current mode, not the authored ceiling.** Authored `min: -128, max: 127`; a ProTracker-mode request past `[-8, 7]` clamps to that narrower range, matching `sampleView.js:1005-1006`'s own two `setMax`/`setMin` calls exactly. Acceptance: a capability unit test in both modes.
- **FT-003 — Panning, fadeout, relative note and the three vibrato values read and write the current instrument.** Each a thin, non-undoable capability wrapper, publishing back on every change, matching `setVolume`'s own established shape (spec 042). Acceptance: capability unit tests for all six.
- **FT-004 — The vibrato waveform radioGroup drives `instrument.vibrato.type`.** Four items (Sine/Square/Saw/Saw Inverse), matching `sampleView.js`'s own `waveLabels` order exactly. Acceptance: a capability unit test for all four labels plus one unrecognized-label no-op.
- **FT-005 — All eight controls are disabled together in ProTracker mode, enabled together in FastTracker mode**, matching `sampleView.js`'s own single combined assignment. Acceptance: the outline-level test from FT-001, applied to every one of the eight authored nodes, not just one representative.
- **FT-006 — No regressions.** Full unit suite passes; `node build.mjs app` succeeds with every new command mapped in `capabilities.js`; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No runtime/renderer change at all - confirmed by reading `mountGeneric.js`'s own `disabledWhen` evaluation before assuming it was needed; this spec is compiler-only plus the usual domain capability layer.

## Scope boundaries

In scope: `compiler/recipes.js` (one new rule recipe, one new alias), `compiler/emit.js` (the second `disabledWhen`-generating branch), `domain/playback/index.js` (`ft-mode.active` publishing), `domain/sampleEditor/index.js` (eight new capability functions plus `publishInstrumentFields`'s own extension), `project/specs/application/current/components/sampleEditPanel.yaml` (the new fields, plainly authored, no tab switch), new `capabilities.js` mappings, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Envelope editing** (`volumeEnvelope`/`panningEnvelope`) - a substantial, separate feature; already deferred by spec 042 for its own reasons.
- **The Loop/Vibrato tab switch** - see Decisions and assumptions; both sections shown together instead.
- **Instrument-property undo** - unchanged from spec 042's own recorded limitation.
- **8/16-bit conversion, draw mode, playback preview, sample load/save** - all already out of scope since specs 040-042.
