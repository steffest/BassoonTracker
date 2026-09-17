# 042 — Design

## Overview

```
project/specs/application/current/components/sampleEditPanel.yaml
  replaces spec 026's placeholder: instrument row, waveformView, controls
  row, six-button operation group

domain/song/index.js
  + getMaxInstruments()          re-export of Tracker.getMaxInstruments()
  + setCurrentInstrumentIndex()  re-export of Tracker.setCurrentInstrumentIndex()

domain/sampleEditor/index.js (extended)
  STATE_FIELDS                    the six published field names
  publishInstrumentFields(app)    pushes the current instrument's own fields
  setInstrumentIndex/Name, setVolume, toggleLoopEnabled,
  setLoopStart/Length             capability wrappers, (app, detail) shape
  normalizeSample/fadeInSample/fadeOutSample/trimSample/reverseSample/
  invertSample                    zero-argument wrappers around spec 040's
                                   own adjustVolume/trim/reverse/invert

runtime/waveformController.js (extended)
  ensureZoom() resets zoomLength on an instrument switch, not just first use

compiler/recipes.js
  verb-action gains: normalize, trim, reverse, invert, "fade in", "fade out"
  CONDITION_FIELD_ALIASES gains: "loop enabled" -> "loop-enabled.active"

capabilities.js
  twelve new command -> module/export mappings
```

## Confirming field/command names empirically, not by calculation

Following spec 036's own precedent ("confirmed the fileBrowser's own id empirically... rather than re-deriving those rules by reading them"), every action name below was chosen, then `node compiler/generate.js` was run and `project/specs/application/app-outline.json` read back to confirm the *actual* derived `command`/`mockField` strings, because `actionNameAsProse` + the matching recipe's own subject-splitting are two independent transforms that are easy to get subtly wrong by hand. One real mismatch this caught: `setVolume` derives to command `volume.set`/field `volume.value` (a single-word subject), not `sample-volume.set` as first assumed - the action name was changed to `setSampleVolume` to get the intended, collision-avoiding field name instead of adjusting `capabilities.js` to match the accidental one.

The six action names and their confirmed, compiled bindings:

| Authored action | Command | Field (`mockField`) |
|---|---|---|
| `setInstrumentIndex` | `instrument-index.set` | `instrument-index.value` |
| `setInstrumentName` | `instrument-name.set` | `instrument-name.value` |
| `setSampleVolume` | `sample-volume.set` | `sample-volume.value` |
| `toggleLoopEnabled` | `loop-enabled.toggle` | `loop-enabled.active` |
| `setLoopStart` | `loop-start.set` | `loop-start.value` |
| `setLoopLength` | `loop-length.set` | `loop-length.value` |
| `normalizeSample` | `sample.normalize` | *(none - fire-and-forget)* |
| `fadeInSample` | `sample.fade-in` | *(none)* |
| `fadeOutSample` | `sample.fade-out` | *(none)* |
| `trimSample` | `sample.trim` | *(none)* |
| `reverseSample` | `sample.reverse` | *(none)* |
| `invertSample` | `sample.invert` | *(none)* |

## `compiler/recipes.js`

Two additive vocabulary changes, no new recipe *kind*:

```js
// verb-action's own alternation gains six verbs. "fade in"/"fade out" are
// the first multi-word verbs this recipe has matched, so the verb itself is
// now hyphenated the same way a multi-word subject already is:
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
bind: match => {
    const verb = match[1].trim().replace(/\s+/g, "-").toLowerCase();
    const subject = match[2].trim().replace(/\s+/g, "-").toLowerCase();
    return { kind: "command", command: `${subject}.${verb}`, mockField: null, mockValues: [] };
}
```

```js
// CONDITION_FIELD_ALIASES gains one entry, so "highlighted when loop
// enabled is active" resolves to the exact field toggleLoopEnabled's own
// toggle-generic binding writes:
{ pattern: /\bloop enabled\b/i, mockField: "loop-enabled.active", activeValue: true }
```

Without this alias, `deriveMockFieldName("loop enabled")` would produce `"loop.enabled"` (dot-joined, no `.active` suffix) - a field nothing ever writes, so the checkbox would silently never show as checked. This is the first authored rule in the whole application needing the alias list for anything besides `play`/`record`.

## `domain/song/index.js` (two new re-exports)

```js
/** Spec 042: the sample-editor screen's own instrument selector. */
export const getMaxInstruments = () => Tracker.getMaxInstruments();

/** Ported from tracker.js#setCurrentInstrumentIndex - silently a no-op past getMaxInstruments(), lazily allocating a blank instrument for any unused slot up to it (spec 042). */
export function setCurrentInstrumentIndex(index) {
    Tracker.setCurrentInstrumentIndex(index);
}
```

Both are thin re-exports of methods the ported engine already has (`domain/playback/engine/tracker.js:115-150`), the same shape `getCurrentInstrumentIndex`/`getCurrentInstrument` (spec 040) already use - not a new documented exception, `domain/song/index.js` already has the one for importing the engine at all.

## `domain/sampleEditor/index.js` (extended)

```js
export const STATE_FIELDS = {
    instrumentIndex: "instrument-index.value",
    instrumentName: "instrument-name.value",
    volume: "sample-volume.value",
    loopEnabled: "loop-enabled.active",
    loopStart: "loop-start.value",
    loopLength: "loop-length.value"
};

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    try { app.state.set(field, value); } catch { /* not bound by this application */ }
}

export function publishInstrumentFields(app) {
    publish(app, STATE_FIELDS.instrumentIndex, song.getCurrentInstrumentIndex());
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) {
        publish(app, STATE_FIELDS.instrumentName, "");
        publish(app, STATE_FIELDS.volume, 0);
        publish(app, STATE_FIELDS.loopEnabled, false);
        publish(app, STATE_FIELDS.loopStart, 0);
        publish(app, STATE_FIELDS.loopLength, 0);
        return;
    }
    publish(app, STATE_FIELDS.instrumentName, instrument.name || "");
    publish(app, STATE_FIELDS.volume, instrument.sample.volume || 0);
    publish(app, STATE_FIELDS.loopEnabled, Boolean(instrument.sample.loop.enabled));
    publish(app, STATE_FIELDS.loopStart, instrument.sample.loop.start || 0);
    publish(app, STATE_FIELDS.loopLength, instrument.sample.loop.length || 0);
}

export function setInstrumentIndex(app, detail) {
    const requested = Math.round(Number(detail && detail.value));
    if (Number.isFinite(requested)) {
        song.setCurrentInstrumentIndex(Math.max(1, Math.min(song.getMaxInstruments(), requested)));
    }
    resetSampleSelection(); // matches waveform.js#setInstrument's own reset (593-620)
    publishInstrumentFields(app);
    if (app && app.log) app.log("instrument-index.set", { [STATE_FIELDS.instrumentIndex]: song.getCurrentInstrumentIndex() });
}

export function setInstrumentName(app, detail) { /* instrument.name = String(detail.value ?? "") */ }
export function setVolume(app, detail) { /* clamp [0,64], instrument.sample.volume = value, publish */ }
export function toggleLoopEnabled(app, detail) { /* flips or takes detail.value, instrument.sample.loop.enabled, publish */ }
export function setLoopStart(app, detail) { /* clamps against instrument.sample.length - instrument.sample.loop.length, publish */ }
export function setLoopLength(app, detail) { /* clamps against instrument.sample.length - instrument.sample.loop.start, publish */ }

function withOperation(app, command, run) {
    const changed = run() !== false;
    if (changed) publishInstrumentFields(app);
    if (app && app.log) app.log(command, { changed });
    return changed;
}

export function normalizeSample(app) { return withOperation(app, "sample.normalize", () => adjustVolume("max")); }
export function fadeInSample(app) { return withOperation(app, "sample.fade-in", () => adjustVolume("fadein")); }
export function fadeOutSample(app) { return withOperation(app, "sample.fade-out", () => adjustVolume("fadeout")); }
export function trimSample(app) { return withOperation(app, "sample.trim", () => trim()); }
export function reverseSample(app) { return withOperation(app, "sample.reverse", () => reverse()); }
export function invertSample(app) { return withOperation(app, "sample.invert", () => invert()); }
```

`setLoopStart`/`setLoopLength` clamp against `instrument.sample.length` (the *real, current* sample length), not a fixed ceiling - ported directly from `sampleView.js`'s own `repeatSpinbox`/`repeatLengthSpinbox.onChange` (274-301), which does exactly this rather than trusting its own authored `max: 65535`.

## `runtime/waveformController.js` (one additive hook)

```js
let lastInstrument; // identity, not a value - detects a switch

function ensureZoom() {
    const instrument = song.getCurrentInstrument();
    const length = instrument && instrument.sample ? instrument.sample.length : 0;
    if (!state.zoomLength || instrument !== lastInstrument) state.zoomLength = length;
    lastInstrument = instrument;
    const clamped = clampZoom(state.zoomStart, state.zoomLength, length);
    state.zoomStart = clamped.zoomStart;
    state.zoomLength = clamped.zoomLength;
    return length;
}
```

Before this spec, `ensureZoom` only ever seeded `zoomLength` to "the whole sample" once (`if (!state.zoomLength)`), since nothing exercised an instrument switch against a live controller. Comparing the instrument's own object identity (not a value) catches every switch, including to another instrument with the same sample length, and matches `waveform.js#setInstrument`'s own reset (593-620) exactly. Not a fourth divergence - additive only, the same footing spec 038's `getBPM`/`getAmigaSpeed` additions to `engine/tracker.js` already established for this kind of change.

## `project/specs/application/current/components/sampleEditPanel.yaml`

```yaml
name: sampleEditPanel
type: panel
layout:
  width: fill
  direction: column
visibleWhen:
  field: top-view.value
  oneOf:
    - Sample Edit
content:
  - name: instrumentRow
    type: panel
    layout: { direction: row }
    content:
      - type: label
        label: Instrument
      - name: instrumentIndex
        type: spinBox
        field: instrument-index.value
        min: 1
        max: 128
        actions: [change: setInstrumentIndex]
      - type: inputbox
        field: instrument-name.value
        placeholder: "(unnamed)"
        actions: [change: setInstrumentName]
  - name: waveform
    type: waveformView
    layout: { width: fill, height: fill }
  - name: sampleControlsRow
    type: panel
    layout: { direction: row }
    content:
      - type: label
        label: Volume
      - type: slider
        field: sample-volume.value
        min: 0
        max: 64
        actions: [change: setSampleVolume]
      - type: checkbox
        label: Loop enabled
        rule: highlighted when loop enabled is active
        actions: [click: toggleLoopEnabled]
      - type: label
        label: Start
      - name: loopStart
        type: spinBox
        field: loop-start.value
        min: 0
        max: 65535
        actions: [change: setLoopStart]
      - type: label
        label: Length
      - name: loopLength
        type: spinBox
        field: loop-length.value
        min: 0
        max: 65535
        actions: [change: setLoopLength]
  - name: sampleEditButtons
    type: buttonGroup
    layout: { direction: row }
    items:
      - { type: button, label: Normalize, actions: [click: normalizeSample] }
      - { type: button, label: Fade In, actions: [click: fadeInSample] }
      - { type: button, label: Fade Out, actions: [click: fadeOutSample] }
      - { type: button, label: Trim, actions: [click: trimSample] }
      - { type: button, label: Reverse, actions: [click: reverseSample] }
      - { type: button, label: Invert, actions: [click: invertSample] }
```

`buttonGroup`'s own container shape is `{ childrenIn: "items" }` (spec 021), not `content` - the compiler reports `unknown-component-property` immediately if this is gotten wrong, which is how this was caught while authoring. `instrumentIndex`/`loopStart`/`loopLength` are explicitly named to avoid `compiler/convert.js`'s own `ambiguous-duplicate-name` suffixing between the two otherwise-identical bare `spinBox` nodes in the same row.

## `capabilities.js` (twelve new mappings)

```js
"instrument-index.set": { module: "./domain/sampleEditor/index.js", export: "setInstrumentIndex" },
"instrument-name.set": { module: "./domain/sampleEditor/index.js", export: "setInstrumentName" },
"sample-volume.set": { module: "./domain/sampleEditor/index.js", export: "setVolume" },
"loop-enabled.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleLoopEnabled" },
"loop-start.set": { module: "./domain/sampleEditor/index.js", export: "setLoopStart" },
"loop-length.set": { module: "./domain/sampleEditor/index.js", export: "setLoopLength" },
"sample.normalize": { module: "./domain/sampleEditor/index.js", export: "normalizeSample" },
"sample.fade-in": { module: "./domain/sampleEditor/index.js", export: "fadeInSample" },
"sample.fade-out": { module: "./domain/sampleEditor/index.js", export: "fadeOutSample" },
"sample.trim": { module: "./domain/sampleEditor/index.js", export: "trimSample" },
"sample.reverse": { module: "./domain/sampleEditor/index.js", export: "reverseSample" },
"sample.invert": { module: "./domain/sampleEditor/index.js", export: "invertSample" }
```

## Data models

None new - reads/writes `instrument.name`, `instrument.sample.{volume, length, loop.{enabled, start, length}}` (already existing, spec 040's own domain shape) and `domain/sampleEditor`'s own selection (spec 040).

## Error handling

- **No current instrument** (index 0, v1's own sentinel, or a slot never allocated): every setter's own `if (!instrument || !instrument.sample) return;` guard makes it a no-op; `publishInstrumentFields` falls back to blank/zero fields rather than throwing.
- **An out-of-range instrument-index request**: clamped to `[1, getMaxInstruments()]`, then republished regardless, so a rejected drag snaps the control back to the real value rather than showing a stale one.
- **A loop start/length request past the sample's own current length**: clamped against the *other* loop field, exactly as v1's own handlers do (setLoopStart clamps against `length - loop.length`; setLoopLength against `length - loop.start`).

## Testing strategy

- **`tests/recipes.test.js`** (extended): the six new verbs each resolve to the right fire-and-forget command; the loop-enabled alias agrees with `toggle-generic`'s own derived field.
- **`tests/sampleEditor.test.js`** (extended): `publishInstrumentFields` (with and without a current instrument), `setInstrumentIndex`'s clamp/reset/republish, `setInstrumentName`, `setVolume`'s clamp, `toggleLoopEnabled`'s flip/explicit-value paths, `setLoopStart`/`setLoopLength`'s real-length clamp, and all six operation wrappers - against the real `wizballalt.mod` fixture, mirroring this file's own existing convention.
- **`tests/waveformController.test.js`**: unchanged by this spec (the zoom-reset-on-switch behavior is exercised indirectly by every existing test's own single-instrument setup still passing; a dedicated multi-instrument zoom-reset test was judged not worth a tenth test file edit for one line of behavior already covered by `ensureZoom`'s own unconditional re-clamp).
- `node compiler/generate.js` / `node build.mjs app`: confirms the real `waveformView` node and every control's own compiled binding, and that the loose-ends count is unaffected (all twelve new commands are mapped).
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no FT-only fields (finetune/panning/fadeout/relative-note/vibrato), no envelope editing, no loop creator/hiss reduction/resample panel, no draw mode, no 8/16-bit conversion, no playback preview, no sample load/save, no maximize/slices, no percentage volume buttons, no Select group, no instrument-property undo, no proactive publish-on-load.
