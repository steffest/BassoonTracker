# 046 — Design

## Overview

```
domain/sampleEditor/resample.js (new sibling module, mirrors loopCreator.js)
  openResample(instrument)        captures sourceRate/sourceBytes, resets targetIndex=37
  isResampleOpen()
  getResampleState()              { sourceRate, sourceBytes, targetIndex }
  setTargetIndex(value)           clamps to [1, 96]
  closeResample()
  applyResample(interpolate)      whole-sample linear/nearest resample, undoable, closes

domain/song/index.js (extended)
  getNoteForResampleIndex(index)  ported from resamplePanel.js's own modeNote/noteName/targetPeriod

domain/playback/index.js (extended)
  getSampleRateForPeriod(period)  thin forward to Audio.getSampleRateForPeriod

domain/sampleEditor/index.js (extended)
  openResample(app)                opens the session, publishes every field, view="resample"
  setResampleTargetIndex(app, d)   clamps, recomputes+republishes target fields
  toggleResampleInterpolate(app,d) publishes the checkbox's own boolean field
  saveResample(app)                reads interpolate from app.state, applies, view=""
  cancelResample(app)              closes the session (no restore needed), view=""

compiler/recipes.js
  CONDITION_FIELD_ALIASES gains: "resample interpolate" -> "resample-interpolate.active"
  (no new verb-action verbs - open/save/cancel/set-value/toggle-generic already cover this screen)

capabilities.js
  five new command -> module/export mappings
```

Confirmed empirically before writing any YAML (spec 036/042/045's own precedent) - every action name below was run through `interpretAction`/`interpretRule` directly in Node:

| Authored action | Command | Field |
|---|---|---|
| `openResample` | `resample.open` | *(none)* |
| `setResampleTargetIndex` | `resample-target-index.set` | `resample-target-index.value` |
| `toggleResampleInterpolate` | `resample-interpolate.toggle` | `resample-interpolate.active` |
| `saveResample` | `resample.save` | *(none)* |
| `cancelResample` | `resample.cancel` | *(none)* |

`interpretRule(null, "highlighted when resample interpolate is active")` derives `resample.interpolate` (dot-joined), which does **not** match `resample-interpolate.active` above - confirming the alias is needed, the same way `loop enabled`/`snap to zero` needed one before it.

## `domain/sampleEditor/resample.js` (new)

```js
// The resample panel (spec 046), the second of P10's three separable
// sample-editor sub-features spec 040 recorded (the hiss-reduction panel is
// left for a later spec). Ported from script/plugins/sampleeditor/
// resamplePanel.js (the dialog) and waveform.js#resampleToRate (1344-1370,
// the DSP) - resample("up"/"down"), a different, separately-named v1 action
// (the Edit menu's own Upsample/DownSample quick items), is out of scope -
// see requirements.md.
//
// Unlike loopCreator.js, nothing is mutated until applyResample() runs (v1's
// own resamplePanel.js never touches the sample before its Apply callback
// fires either), so there is no live-preview snapshot to restore on cancel -
// only the small amount of state the open dialog itself needs to display.
//
// Like loopCreator.js, this module never imports domain/playback/engine/
// directly - it reaches the current instrument and registers undo entries
// only through domain/song/index.js's own public surface.

import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";
import { getSampleRateForPeriod } from "../playback/index.js";

let isOpen = false;
let sourceRate = 8363;
let sourceBytes = 0;
let targetIndex = 37; // v1's own default (resamplePanel.js:69)

export function isResampleOpen() {
    return isOpen;
}

/** @returns {boolean} false when there is no usable sample to open for. */
export function openResample(instrument) {
    if (!instrument || !instrument.sample || !instrument.sample.data || !instrument.sample.data.length) return false;
    const sample = instrument.sample;
    sourceRate = sample.originalSampleRate || sample.c2spd || 8363;
    sourceBytes = sample.data.length * (sample.bits === 16 ? 2 : 1);
    targetIndex = 37;
    isOpen = true;
    return true;
}

export function closeResample() {
    isOpen = false;
}

export function setTargetIndex(value) {
    targetIndex = Math.max(1, Math.min(96, Math.round(Number(value)) || 1));
}

export function getResampleState() {
    return { sourceRate, sourceBytes, targetIndex };
}

function targetPeriod() {
    return song.getNoteForResampleIndex(targetIndex).period;
}

export function getTargetNoteName() {
    return song.getNoteForResampleIndex(targetIndex).name;
}

export function getTargetRate() {
    return getSampleRateForPeriod(targetPeriod());
}

/**
 * Ported from waveform.js#resampleToRate (1344-1370). Rewrites the WHOLE
 * current instrument's sample, unconditionally - matches v1: the panel's
 * own apply callback never consults any range selection.
 */
export function applyResample(interpolate) {
    if (!isOpen) return false;
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample || !instrument.sample.data || !instrument.sample.data.length) return false;

    const targetRate = getTargetRate();
    const oldData = instrument.sample.data.slice();
    const newLength = Math.max(1, Math.round(oldData.length * targetRate / sourceRate));
    const newData = new Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const position = i * sourceRate / targetRate;
        const left = Math.floor(position);
        const right = Math.min(left + 1, oldData.length - 1);
        const fraction = position - left;
        newData[i] = interpolate
            ? oldData[left] + (oldData[right] - oldData[left]) * fraction
            : oldData[Math.min(Math.round(position), oldData.length - 1)];
    }

    const ratio = targetRate / sourceRate;
    const oldLoop = { start: instrument.sample.loop.start, length: instrument.sample.loop.length };
    const newLoop = { start: Math.round(oldLoop.start * ratio), length: Math.round(oldLoop.length * ratio) };

    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: 0,
        to: oldData.length,
        data: oldData,
        dataTo: newData.slice(),
        loop: { from: oldLoop, to: newLoop },
        name: "Resample Sample"
    });

    instrument.sample.data = newData;
    instrument.sample.length = newData.length;
    instrument.sample.loop.start = newLoop.start;
    instrument.sample.loop.length = newLoop.length;

    isOpen = false;
    return true;
}
```

## `domain/song/index.js` (one new export, alongside `formatNoteName`)

```js
/**
 * Ported from script/plugins/sampleeditor/resamplePanel.js's own modeNote/
 * noteName/targetPeriod (77-84), folded into one pure function for spec
 * 046's own resample.js to call without touching FTNotes/periodNoteTable
 * itself (domain/sampleEditor never imports domain/playback/engine/
 * directly). `index` is a resamplePanel-style FTNotes index, 1-96.
 */
export function getNoteForResampleIndex(index) {
    const note = FTNotes[Tracker.inFTMode() ? index : index + 24];
    const name = !note
        ? "NOTE " + index
        : (!Tracker.inFTMode() && periodNoteTable[note.period]) ? periodNoteTable[note.period].name : note.name;
    const period = (Tracker.inFTMode() && Tracker.useLinearFrequency)
        ? 7680 - (index - 1) * 64
        : (note ? note.period : 428);
    return { name, period };
}
```

## `domain/playback/index.js` (one new export)

```js
/** Pure playback-engine math (engine/audio.js#getSampleRateForPeriod) - no audioContext needed, safe to call anytime. */
export function getSampleRateForPeriod(period) {
    return Audio.getSampleRateForPeriod(period);
}
```

## `domain/sampleEditor/index.js` (extended)

```js
import * as resample from "./resample.js";

function publishResampleFields(app) {
    const state = resample.getResampleState();
    publish(app, "resample-source-rate.value", Math.round(state.sourceRate));
    publish(app, "resample-source-size.value", state.sourceBytes);
    publish(app, "resample-target-index.value", state.targetIndex);
    publish(app, "resample-target-note.value", resample.getTargetNoteName());
    publish(app, "resample-target-rate.value", Math.round(resample.getTargetRate()));
    publish(app, "resample-target-size.value", Math.round(state.sourceBytes * resample.getTargetRate() / state.sourceRate));
}

export function openResample(app) {
    const opened = resample.openResample(song.getCurrentInstrument());
    if (opened) {
        if (app && app.state) app.state.set("sample-edit-view.value", "resample");
        publishResampleFields(app);
    }
    if (app && app.log) app.log("resample.open", { opened });
    return opened;
}

export function setResampleTargetIndex(app, detail) {
    resample.setTargetIndex(detail && detail.value);
    publishResampleFields(app);
    if (app && app.log) app.log("resample-target-index.set", { value: resample.getResampleState().targetIndex });
}

export function toggleResampleInterpolate(app, detail) {
    const current = app && app.state ? Boolean(app.state.get("resample-interpolate.active")) : false;
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    if (app && app.state) app.state.set("resample-interpolate.active", next);
    if (app && app.log) app.log("resample-interpolate.toggle", { next });
    return next;
}

export function saveResample(app) {
    const interpolate = Boolean(app && app.state && app.state.get("resample-interpolate.active"));
    const saved = resample.applyResample(interpolate);
    if (app && app.state) app.state.set("sample-edit-view.value", "");
    if (saved) publishInstrumentFields(app); // the loop bounds resample scales are the same fields spec 042 already publishes
    if (app && app.log) app.log("resample.save", { saved });
    return saved;
}

export function cancelResample(app) {
    resample.closeResample();
    if (app && app.state) app.state.set("sample-edit-view.value", "");
    if (app && app.log) app.log("resample.cancel", {});
    return true;
}
```

## `compiler/recipes.js`

```js
// CONDITION_FIELD_ALIASES gains one entry, the same seam "loop enabled"
// (spec 042) and "snap to zero" (spec 045) already needed:
{ pattern: /\bresample interpolate\b/i, mockField: "resample-interpolate.active", activeValue: true }
```

## `project/specs/application/current/components/sampleEditPanel.yaml` (a third `visibleWhen` child)

```yaml
  - name: resamplePanel
    type: panel
    layout: { direction: column }
    visibleWhen: { field: sample-edit-view.value, oneOf: [resample] }
    content:
      - name: resampleMenuBar
        type: panel
        layout: { direction: row }
        content:
          - { type: label, label: Resample }
          - { type: button, label: Apply, actions: [click: saveResample] }
          - { type: button, label: Cancel, actions: [click: cancelResample] }
          - type: checkbox
            label: Interpolate
            rule: "highlighted when resample interpolate is active"
            actions: [click: toggleResampleInterpolate]
      - name: resampleSourceRow
        type: panel
        layout: { direction: row }
        content:
          - { type: label, label: "Source:" }
          - { type: label, label: ORIGINAL }
          - { type: label, field: resample-source-rate.value }
          - { type: label, label: Hz }
          - { type: label, field: resample-source-size.value }
          - { type: label, label: B }
      - name: resampleTargetRow
        type: panel
        layout: { direction: row }
        content:
          - { type: label, label: "Target:" }
          - name: resampleTargetIndex
            type: spinBox
            field: resample-target-index.value
            min: 1
            max: 96
            step: 1
            actions: [change: setResampleTargetIndex]
          - { type: label, field: resample-target-note.value }
          - { type: label, field: resample-target-rate.value }
          - { type: label, label: Hz }
          - { type: label, field: resample-target-size.value }
          - { type: label, label: B }
  - type: button
    label: Resample
    actions: [click: openResample]
    # added to sampleEditButtons alongside the existing six operations + Create Loop
```

`sampleEditPanel.yaml`'s top-level structure becomes three `visibleWhen`-gated children (`sampleEditNormalView`, `loopCreatorPanel`, `resamplePanel`), each keyed off its own mode field - `top-view.value` still gates the whole panel, unchanged.

## `capabilities.js` (five new mappings)

```js
"resample.open": { module: "./domain/sampleEditor/index.js", export: "openResample" },
"resample-target-index.set": { module: "./domain/sampleEditor/index.js", export: "setResampleTargetIndex" },
"resample-interpolate.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleResampleInterpolate" },
"resample.save": { module: "./domain/sampleEditor/index.js", export: "saveResample" },
"resample.cancel": { module: "./domain/sampleEditor/index.js", export: "cancelResample" }
```

## Data models

No new panel-switch field is introduced here after all - see "Found while doing it" below: spec 045's own `loop-creator.mode` is renamed to a single shared `sample-edit-view.value` (`""`/`"loop-creator"`/`"resample"`), since `visibleWhen` reads only one field per node and a third mutually-exclusive sub-view cannot be expressed with two independent booleans. `resample-target-index.value`, `resample-interpolate.active` and the five read-only display fields (`resample-source-rate.value`, `resample-source-size.value`, `resample-target-note.value`, `resample-target-rate.value`, `resample-target-size.value`) are all new, all owned by this spec.

## Error handling

- **"Resample" clicked with no current instrument, or one with no sample data**: `openResample` returns `false`; `sample-edit-view.value` is left untouched, matching spec 045's own `openLoopCreator` guard exactly.
- **Apply/Cancel clicked when nothing is open** (not reachable through the UI, but cheap to guard, matching spec 045's own precedent): `applyResample` returns `false` when `!isOpen`; `saveResample`/`cancelResample` both still set `sample-edit-view.value` back to `""`, a safe idempotent write.

## Found while doing it

The original design sketch above (still shown as first written) gave the resample panel its own independent `resample.mode` field, mirroring spec 045's own `loop-creator.mode` one-for-one. Implementing it exposed a real gap in that mirroring: `runtime/genericLayout.js#isVisible` (spec 025) reads exactly one `field`/`oneOf` pair per node, so `sampleEditNormalView`'s own `visibleWhen` (checking only `loop-creator.mode`) could never also hide itself while `resample.mode` was `"open"` - both it and the resample panel would render at once. Fixed by consolidating both panel-switch fields into one, `sample-edit-view.value` (`""`/`"loop-creator"`/`"resample"`), read by all three of `sampleEditNormalView`/`loopCreatorPanel`/`resamplePanel`. This is a rename of spec 045's own delivered field, not an extension of it - `domain/sampleEditor/index.js`'s `openLoopCreator`/`saveLoopCreator`/`cancelLoopCreator` and their own tests were updated in place (see spec 045's original `loop-creator.mode` references throughout this document and requirements.md - superseded by this note, not individually rewritten).
- **A degenerate target rate** (division by a target rate of 0, not reachable since `getSampleRateForPeriod` never returns 0 for any of the 96 valid indices) is not specially guarded, matching v1's own lack of a guard here.

## Testing strategy

- **`tests/recipes.test.js`** (extended): the resample-interpolate alias agrees with its own toggle-generic field (no new verb tests needed - nothing new to cover there).
- **`tests/sampleEditor.test.js`** (extended): `openResample`'s mode transition and no-instrument guard, `setResampleTargetIndex`'s clamp and field republish (including a FT-mode-with-linear-frequency case for `getNoteForResampleIndex`'s own period formula), `toggleResampleInterpolate`'s flip/explicit-value paths, `saveResample`'s undo round trip in both interpolation modes (asserting the new length matches the ported formula and the loop bounds scale by the same ratio), and `cancelResample`'s no-mutation guarantee.
- `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (read back to verify the table above) and that no new commands are left as mocks.
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no keyboard-driven note entry (a spinBox instead), no `resample("up"/"down")` quick actions, no hiss-reduction panel, no 8/16-bit conversion or playback preview.
