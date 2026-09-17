# 050 — Design

## Overview

```
compiler/recipes.js
  RULE_RECIPES gains: disabled-unless-active ("disabled unless X is active")
  CONDITION_FIELD_ALIASES gains: "ft mode" -> ft-mode.active

compiler/emit.js
  the rule-binding-to-generated-code block gains a second branch:
  binding.kind === "visual-state" && binding.state === "disabled"
    -> disabledWhen: state => state.get(field) !== activeValue

domain/playback/index.js
  STATE_FIELDS gains: ftMode: "ft-mode.active"
  publishFtMode(app), called from loadModule and openFiles,
  alongside the existing song.title/playback.status publishes

domain/sampleEditor/index.js (extended)
  STATE_FIELDS gains: finetune, panning, fadeout, relativeNote,
    vibratoSpeed, vibratoDepth, vibratoSweep, vibratoWave
  publishInstrumentFields extended to publish all eight
  setFinetune(app, detail)      clamps to [-8,7] in ProTracker mode, else [-128,127]
  setPanning(app, detail)
  setFadeout(app, detail)
  setRelativeNote(app, detail)
  setVibratoSpeed(app, detail)
  setVibratoDepth(app, detail)
  setVibratoSweep(app, detail)
  setVibratoWave(app, detail)   label -> index -> instrument.vibrato.type

project/specs/application/current/components/sampleEditPanel.yaml
  a new ftOnlyRow (or similar) inside sampleEditNormalView, all eight
  controls plus their own rule: disabled unless ft mode is active
```

Confirmed empirically before writing any YAML (spec 036/042/045/046/048/049's own precedent):

| Authored action | Command | Field |
|---|---|---|
| `setFinetune` | `finetune.set` | `finetune.value` |
| `setPanning` | `panning.set` | `panning.value` |
| `setFadeout` | `fadeout.set` | `fadeout.value` |
| `setRelativeNote` | `relative-note.set` | `relative-note.value` |
| `setVibratoSpeed` | `vibrato-speed.set` | `vibrato-speed.value` |
| `setVibratoDepth` | `vibrato-depth.set` | `vibrato-depth.value` |
| `setVibratoSweep` | `vibrato-sweep.set` | `vibrato-sweep.value` |
| `setVibratoWave` | `vibrato-wave.set` | `vibrato-wave.value` |

All eight resolve through the existing `set-value` recipe with no new verb needed. `interpretRule(null, "disabled unless ft mode is active")` will be confirmed against the real implementation the moment it exists, the same "confirm empirically" discipline applied to every new recipe addition in this port.

## `compiler/recipes.js`

```js
const RULE_RECIPES = [
    { code: "highlighted-when-active", /* unchanged */ },
    {
        code: "disabled-unless-active",
        pattern: /disabled\s+unless\s+(.+?)\s+is\s+active/i,
        bind: match => {
            const subject = match[1].trim();
            const alias = CONDITION_FIELD_ALIASES.find(a => a.pattern.test(subject));
            return {
                kind: "visual-state",
                state: "disabled",
                mockField: alias ? alias.mockField : deriveMockFieldName(subject),
                activeValue: alias ? alias.activeValue : true,
                conditionText: subject
            };
        }
    }
];
```

```js
// CONDITION_FIELD_ALIASES gains one entry:
{ pattern: /\bft mode\b/i, mockField: "ft-mode.active", activeValue: true }
```

## `compiler/emit.js` (the second branch, next to the existing `highlightedWhen` one)

```js
if (binding.kind === "visual-state" && binding.state === "highlighted") {
    // unchanged
} else if (binding.kind === "visual-state" && binding.state === "disabled") {
    comments.push(`rule (${binding.source.file}:${binding.source.range?.start.line ?? "?"}) "disabled unless ${binding.conditionText} is active" -> disabled unless ${binding.mockField} === ${js(binding.activeValue)}`);
    props.push(`disabledWhen: state => state.get(${js(binding.mockField)}) !== ${js(binding.activeValue)}`);
} else if (binding.kind === "layout-policy") {
    // unchanged
}
```

No change anywhere else: `visualFallbacks`'s own seeding (`emit.js:216-218`) already keys off `binding.kind === "visual-state"` generically, not the `state` value, so `ft-mode.active` gets the same `false`-until-a-module-loads default `record.active`/`loop-enabled.active` etc. already get.

## `domain/playback/index.js` (extended)

```js
export const STATE_FIELDS = {
    // ...existing entries...
    ftMode: "ft-mode.active"
};

function publishFtMode(app) {
    publish(app, STATE_FIELDS.ftMode, Tracker.inFTMode());
}

// in loadModule, right after the existing publish(app, STATE_FIELDS.title, ...):
publishFtMode(app);

// in openFiles, same place:
publishFtMode(app);
```

## `domain/sampleEditor/index.js` (extended)

```js
export const STATE_FIELDS = {
    // ...existing entries...
    finetune: "finetune.value",
    panning: "panning.value",
    fadeout: "fadeout.value",
    relativeNote: "relative-note.value",
    vibratoSpeed: "vibrato-speed.value",
    vibratoDepth: "vibrato-depth.value",
    vibratoSweep: "vibrato-sweep.value",
    vibratoWave: "vibrato-wave.value"
};

const VIBRATO_WAVE_LABELS = ["Sine", "Square", "Saw", "Saw Inverse"]; // sampleView.js's own waveLabels order (329)

// publishInstrumentFields gains, alongside the existing six publish() calls:
publish(app, STATE_FIELDS.finetune, instrument.getFineTune());
publish(app, STATE_FIELDS.panning, instrument.sample.panning || 0);
publish(app, STATE_FIELDS.fadeout, instrument.fadeout || 0);
publish(app, STATE_FIELDS.relativeNote, instrument.sample.relativeNote || 0);
publish(app, STATE_FIELDS.vibratoSpeed, instrument.vibrato.rate || 0);
publish(app, STATE_FIELDS.vibratoDepth, instrument.vibrato.depth || 0);
publish(app, STATE_FIELDS.vibratoSweep, instrument.vibrato.sweep || 0);
publish(app, STATE_FIELDS.vibratoWave, VIBRATO_WAVE_LABELS[instrument.vibrato.type || 0]);

/** Ported from sampleView.js's own fineTuneSlider.onChange + trackerModeChanged's own setMin/setMax (265-266, 1005-1006) - the authored ceiling is the wide (FastTracker) range; ProTracker's own narrower range is enforced here, not in YAML, the same "authored ceiling, real clamp" shape setLoopStart/setLoopLength already use. */
export function setFinetune(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const [min, max] = song.inFTMode() ? [-128, 127] : [-8, 7];
    const value = Math.max(min, Math.min(max, Math.round(Number(detail && detail.value)) || 0));
    instrument.setFineTune(value);
    publish(app, STATE_FIELDS.finetune, instrument.getFineTune());
}

/** Ported from sampleView.js's own panningSlider.onChange (270). */
export function setPanning(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const value = Math.max(-127, Math.min(127, Math.round(Number(detail && detail.value)) || 0));
    instrument.sample.panning = value;
    publish(app, STATE_FIELDS.panning, value);
}

/** Ported from sampleView.js's own fadeOutSlider.onChange (305). */
export function setFadeout(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(4095, Math.round(Number(detail && detail.value)) || 0));
    instrument.fadeout = value;
    publish(app, STATE_FIELDS.fadeout, value);
}

/** Ported from sampleView.js's own spinBoxRelativeNote.onChange (309). */
export function setRelativeNote(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const value = Math.max(-127, Math.min(128, Math.round(Number(detail && detail.value)) || 0));
    instrument.sample.relativeNote = value;
    publish(app, STATE_FIELDS.relativeNote, value);
}

/** Ported from sampleView.js's own spinBoxVibratoSpeed.onChange (315). */
export function setVibratoSpeed(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(63, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.rate = value;
    publish(app, STATE_FIELDS.vibratoSpeed, value);
}

/** Ported from sampleView.js's own spinBoxVibratoDepth.onChange (320). */
export function setVibratoDepth(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(15, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.depth = value;
    publish(app, STATE_FIELDS.vibratoDepth, value);
}

/** Ported from sampleView.js's own spinBoxVibratoSweep.onChange (325). */
export function setVibratoSweep(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(255, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.sweep = value;
    publish(app, STATE_FIELDS.vibratoSweep, value);
}

/** Ported from sampleView.js's own setVibratoWave (919-929), by label rather than index. */
export function setVibratoWave(app, detail) {
    const index = VIBRATO_WAVE_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    const instrument = song.getCurrentInstrument();
    if (!instrument) return false;
    instrument.vibrato.type = index;
    publish(app, STATE_FIELDS.vibratoWave, detail.value);
    return true;
}
```

`song.inFTMode()` is already exported (spec 030); no new `domain/song` surface needed.

## `project/specs/application/current/components/sampleEditPanel.yaml` (a new section inside `sampleEditNormalView`)

```yaml
- name: ftOnlyRow
  type: panel
  layout: { direction: row }
  rule: disabled unless ft mode is active
  content:
    - { type: label, label: Finetune }
    - { type: slider, field: finetune.value, min: -128, max: 127, step: 1, actions: [change: setFinetune] }
    - { type: label, label: Panning }
    - { type: slider, field: panning.value, min: -127, max: 127, step: 1, actions: [change: setPanning] }
    - { type: label, label: Fadeout }
    - { type: spinBox, field: fadeout.value, min: 0, max: 4095, step: 1, actions: [change: setFadeout] }
    - { type: label, label: "Relative Note" }
    - { type: spinBox, field: relative-note.value, min: -127, max: 128, step: 1, actions: [change: setRelativeNote] }
    - { type: label, label: "Vib Speed" }
    - { type: spinBox, field: vibrato-speed.value, min: 0, max: 63, step: 1, actions: [change: setVibratoSpeed] }
    - { type: label, label: "Vib Depth" }
    - { type: spinBox, field: vibrato-depth.value, min: 0, max: 15, step: 1, actions: [change: setVibratoDepth] }
    - { type: label, label: "Vib Sweep" }
    - { type: spinBox, field: vibrato-sweep.value, min: 0, max: 255, step: 1, actions: [change: setVibratoSweep] }
    - name: vibratoWaveGroup
      type: radioGroup
      variant: buttons
      items:
        - { label: Sine }
        - { label: Square }
        - { label: Saw }
        - { label: "Saw Inverse" }
      actions: [change: setVibratoWave]
```

**Amendment, made while implementing, before any test ran**: the sketch above put one `rule:` on the whole row, assuming disabling a container might propagate to its children the way an unmet `visibleWhen` already removes a whole subtree. Reading `renderers/canvas/mountGeneric.js#syncDisabled` (spec 015) directly, rather than assuming, found it is not so: `syncDisabled()` looks up each node's own controller and skips the node entirely if there is none (`if (!controller) continue;`) - and `panel` (`ftOnlyRow`'s own type) is `interactive: false` and has no controller at all, so a `disabledWhen` authored there is silently inert. `radioGroup` is *also* `interactive: false` (only its own `radioItem` children are); only `slider`/`spinBox`/`radioItem` actually have a controller here. The real authoring therefore puts `rule: disabled unless ft mode is active` on each of the seven slider/spinBox controls individually, and on each of the four `radioItem`s (not the `vibratoWaveGroup` itself) - eleven identical `rule:` lines, not one, the exact fallback this design already recorded as a contingency. `ftOnlyRow` itself carries no rule at all in the real YAML.

## `capabilities.js` (eight new mappings)

```js
"finetune.set": { module: "./domain/sampleEditor/index.js", export: "setFinetune" },
"panning.set": { module: "./domain/sampleEditor/index.js", export: "setPanning" },
"fadeout.set": { module: "./domain/sampleEditor/index.js", export: "setFadeout" },
"relative-note.set": { module: "./domain/sampleEditor/index.js", export: "setRelativeNote" },
"vibrato-speed.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoSpeed" },
"vibrato-depth.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoDepth" },
"vibrato-sweep.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoSweep" },
"vibrato-wave.set": { module: "./domain/sampleEditor/index.js", export: "setVibratoWave" }
```

## Data models

New fields: `ft-mode.active` (boolean, `domain/playback`), `finetune.value`, `panning.value`, `fadeout.value`, `relative-note.value`, `vibrato-speed.value`, `vibrato-depth.value`, `vibrato-sweep.value`, `vibrato-wave.value` (`domain/sampleEditor`).

## Error handling

- **`setVibratoWave` with an unrecognized label or no current instrument**: returns `false` without mutating anything, the same guard `setLoopPreset`/`setResampleTargetIndex` already use.
- **Every numeric setter with no current instrument**: returns without publishing, matching `setVolume`'s own existing guard exactly.

## Testing strategy

- **`tests/recipes.test.js`** (extended): the `disabled-unless-active` rule's own binding shape; the `ft mode` alias.
- **`tests/emit.test.js`** (extended): a real `disabledWhen` function generated from the live `app.yaml`, evaluated against both a `"protracker"`-shaped and `"fasttracker"`-shaped mock state (mirroring the existing `highlightedWhen` test right next to it, `emit.test.js:73-75`).
- **`tests/playback.test.js`** (extended): `ft-mode.active` publishes correctly after loading both a `.mod` and a `.xm` fixture.
- **`tests/sampleEditor.test.js`** (extended): all eight new capability functions against the real fixture, including `setFinetune`'s own mode-dependent clamp in both modes and `setVibratoWave`'s own four labels plus one unrecognized.
- `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command/field table, read back) and that every new command is mapped, none left as a mock.
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no envelope editing, no Loop/Vibrato tab switch, no instrument-property undo.
