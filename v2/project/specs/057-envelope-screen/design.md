# 057 — Design

## Overview

```
compiler/recipes.js (extended)
  verb-action: two new verbs, "add"/"remove" (envelope point +/- buttons)
  CONDITION_FIELD_ALIASES: six new entries (enabled/sustain/loop x volume/panning)

domain/sampleEditor/index.js (extended)
  STATE_FIELDS: twelve new entries (six per envelope type)
  publishInstrumentFields: + publishEnvelopeFields(app, "volume") / (..., "panning"), unconditionally
  publishEnvelopeFields(app, type)                     (private)
  envelopeCapabilities(type) -> { setEnabled, addPoint, removePoint, setSustain, setSustainPoint, setLoop, setLoopStart, setLoopEnd }  (private factory)
  16 exported capabilities: set/add/removeVolumeEnvelope*, set/add/removePanningEnvelope*

capabilities.js (extended)
  16 new command mappings

project/specs/application/current/components/sampleEditPanel.yaml (extended)
  sampleEditNormalView.content: + envelopeRow (two panels: volume, panning)
```

## `compiler/recipes.js`

Confirmed empirically before writing any YAML (this port's own standing discipline), all via `node -e` against the real module:

```
actionNameAsProse("addVolumeEnvelopePoint")    -> "add volume envelope point"
interpretAction("add volume envelope point")   -> unsupported until "add" is a known verb
```

Two new verbs, `add`/`remove`, added to the existing `verb-action` pattern (`clear|copy|...|start|add|remove`). Re-verified after adding them:

```
addVolumeEnvelopePoint    -> "volume-envelope-point.add"
removeVolumeEnvelopePoint -> "volume-envelope-point.remove"
addPanningEnvelopePoint   -> "panning-envelope-point.add"
removePanningEnvelopePoint -> "panning-envelope-point.remove"
```

The other twelve actions (`setVolumeEnvelopeEnabled`, `setVolumeEnvelopeSustain`, `setVolumeEnvelopeSustainPoint`, `setVolumeEnvelopeLoop`, `setVolumeEnvelopeLoopStart`, `setVolumeEnvelopeLoopEnd`, and their `Panning` counterparts) already resolve through the existing `set-value` recipe with no new vocabulary at all - confirmed the same way, e.g. `setVolumeEnvelopeSustainPoint` -> `"volume-envelope-sustain-point.set"`, `mockField: "volume-envelope-sustain-point.value"`.

Six new `CONDITION_FIELD_ALIASES` entries - confirmed necessary the same way `loop enabled`'s own entry already is (`deriveMockFieldName`'s dot-joining never agrees with the hyphen-joined `-active` field a multi-word boolean subject needs):

```js
{ pattern: /\bvolume envelope enabled\b/i, mockField: "volume-envelope-enabled.active", activeValue: true },
{ pattern: /\bvolume envelope sustain\b/i, mockField: "volume-envelope-sustain.active", activeValue: true },
{ pattern: /\bvolume envelope loop\b/i, mockField: "volume-envelope-loop.active", activeValue: true },
{ pattern: /\bpanning envelope enabled\b/i, mockField: "panning-envelope-enabled.active", activeValue: true },
{ pattern: /\bpanning envelope sustain\b/i, mockField: "panning-envelope-sustain.active", activeValue: true },
{ pattern: /\bpanning envelope loop\b/i, mockField: "panning-envelope-loop.active", activeValue: true }
```

Re-verified after adding: `interpretRule("x", "highlighted when volume envelope enabled is active")` -> `mockField: "volume-envelope-enabled.active"`, matching `STATE_FIELDS.volumeEnvelopeEnabled` exactly (below) - the same field a checkbox's own `highlightedWhen` and this module's own `publish()` call must agree on for the checkbox to ever visibly reflect real state.

## `domain/sampleEditor/index.js`

```js
import * as envelope from "./envelope.js";

// STATE_FIELDS gains:
volumeEnvelopeEnabled: "volume-envelope-enabled.active",
volumeEnvelopeSustain: "volume-envelope-sustain.active",
volumeEnvelopeSustainPoint: "volume-envelope-sustain-point.value",
volumeEnvelopeLoop: "volume-envelope-loop.active",
volumeEnvelopeLoopStart: "volume-envelope-loop-start.value",
volumeEnvelopeLoopEnd: "volume-envelope-loop-end.value",
panningEnvelopeEnabled: "panning-envelope-enabled.active",
panningEnvelopeSustain: "panning-envelope-sustain.active",
panningEnvelopeSustainPoint: "panning-envelope-sustain-point.value",
panningEnvelopeLoop: "panning-envelope-loop.active",
panningEnvelopeLoopStart: "panning-envelope-loop-start.value",
panningEnvelopeLoopEnd: "panning-envelope-loop-end.value"

/** Republishes all six of one envelope type's own fields - addPoint/removePoint can silently re-clamp three of them (spec 055's own clampIndices), so every mutation republishes the whole small set rather than tracking which one operation can affect which field. Safe unconditionally: getEnvelope's own no-instrument default is already all-falsy. */
function publishEnvelopeFields(app, type) {
    const env = envelope.getEnvelope(type);
    const prefix = type === "volume" ? "volumeEnvelope" : "panningEnvelope";
    publish(app, STATE_FIELDS[`${prefix}Enabled`], env.enabled);
    publish(app, STATE_FIELDS[`${prefix}Sustain`], env.sustain);
    publish(app, STATE_FIELDS[`${prefix}SustainPoint`], env.sustainPoint);
    publish(app, STATE_FIELDS[`${prefix}Loop`], env.loop);
    publish(app, STATE_FIELDS[`${prefix}LoopStart`], env.loopStartPoint);
    publish(app, STATE_FIELDS[`${prefix}LoopEnd`], env.loopEndPoint);
}

// publishInstrumentFields gains, unconditionally, after its own existing if/else:
publishEnvelopeFields(app, "volume");
publishEnvelopeFields(app, "panning");

/** One small internal factory instead of sixteen hand-written near-duplicates - see requirements.md's Decisions. */
function envelopeCapabilities(type) {
    return {
        setEnabled(app, detail) { envelope.setEnabled(type, Boolean(detail && detail.value)); publishEnvelopeFields(app, type); },
        addPoint(app) { envelope.addPoint(type); publishEnvelopeFields(app, type); },
        removePoint(app) { envelope.removePoint(type); publishEnvelopeFields(app, type); },
        setSustain(app, detail) { envelope.setSustain(type, Boolean(detail && detail.value)); publishEnvelopeFields(app, type); },
        setSustainPoint(app, detail) { envelope.setSustainPoint(type, Math.round(Number(detail && detail.value)) || 0); publishEnvelopeFields(app, type); },
        setLoop(app, detail) { envelope.setLoop(type, Boolean(detail && detail.value)); publishEnvelopeFields(app, type); },
        setLoopStart(app, detail) { envelope.setLoopStart(type, Math.round(Number(detail && detail.value)) || 0); publishEnvelopeFields(app, type); },
        setLoopEnd(app, detail) { envelope.setLoopEnd(type, Math.round(Number(detail && detail.value)) || 0); publishEnvelopeFields(app, type); }
    };
}

const volumeEnvelope = envelopeCapabilities("volume");
const panningEnvelope = envelopeCapabilities("panning");

export const setVolumeEnvelopeEnabled = volumeEnvelope.setEnabled;
export const addVolumeEnvelopePoint = volumeEnvelope.addPoint;
export const removeVolumeEnvelopePoint = volumeEnvelope.removePoint;
export const setVolumeEnvelopeSustain = volumeEnvelope.setSustain;
export const setVolumeEnvelopeSustainPoint = volumeEnvelope.setSustainPoint;
export const setVolumeEnvelopeLoop = volumeEnvelope.setLoop;
export const setVolumeEnvelopeLoopStart = volumeEnvelope.setLoopStart;
export const setVolumeEnvelopeLoopEnd = volumeEnvelope.setLoopEnd;

export const setPanningEnvelopeEnabled = panningEnvelope.setEnabled;
export const addPanningEnvelopePoint = panningEnvelope.addPoint;
export const removePanningEnvelopePoint = panningEnvelope.removePoint;
export const setPanningEnvelopeSustain = panningEnvelope.setSustain;
export const setPanningEnvelopeSustainPoint = panningEnvelope.setSustainPoint;
export const setPanningEnvelopeLoop = panningEnvelope.setLoop;
export const setPanningEnvelopeLoopStart = panningEnvelope.setLoopStart;
export const setPanningEnvelopeLoopEnd = panningEnvelope.setLoopEnd;
```

## `capabilities.js`

Sixteen new entries, all `{ module: "./domain/sampleEditor/index.js", export: "<name above>" }`, keyed by the exact command strings `interpretAction` derived above (`volume-envelope-enabled.set`, `volume-envelope-point.add`, `volume-envelope-point.remove`, `volume-envelope-sustain.set`, `volume-envelope-sustain-point.set`, `volume-envelope-loop.set`, `volume-envelope-loop-start.set`, `volume-envelope-loop-end.set`, and the `panning-envelope-*` equivalents).

## `components/sampleEditPanel.yaml`

One new sibling, `envelopeRow`, added to `sampleEditNormalView`'s own content list (spec 042/045/046/050) right after `ftOnlyRow`:

```yaml
- name: envelopeRow
  type: panel
  layout:
    direction: row
  content:
    - name: volumeEnvelopePanel
      type: panel
      layout:
        direction: column
      content:
        - name: volumeEnvelopeHeader
          type: panel
          layout:
            direction: row
          content:
            - type: checkbox
              label: "Volume Envelope"
              rule:
                - highlighted when volume envelope enabled is active
                - disabled unless ft mode is active
              actions:
                - click: setVolumeEnvelopeEnabled
            - type: button
              label: "+"
              rule: disabled unless ft mode is active
              actions:
                - click: addVolumeEnvelopePoint
            - type: button
              label: "-"
              rule: disabled unless ft mode is active
              actions:
                - click: removeVolumeEnvelopePoint
        - name: volumeEnvelopeBody
          type: panel
          layout:
            direction: row
          content:
            - name: volumeEnvelopeGraph
              type: envelopeView
              envelopeType: volume
              layout:
                width: fill
                height: fill
              rule: disabled unless ft mode is active
            - name: volumeEnvelopeControls
              type: panel
              layout:
                direction: column
              content:
                - type: checkbox
                  label: Sustain
                  rule:
                    - highlighted when volume envelope sustain is active
                    - disabled unless ft mode is active
                  actions:
                    - click: setVolumeEnvelopeSustain
                - name: volumeEnvelopeSustainPoint
                  type: spinBox
                  field: volume-envelope-sustain-point.value
                  min: 0
                  max: 100
                  step: 1
                  rule: disabled unless ft mode is active
                  actions:
                    - change: setVolumeEnvelopeSustainPoint
                - type: checkbox
                  label: Loop
                  rule:
                    - highlighted when volume envelope loop is active
                    - disabled unless ft mode is active
                  actions:
                    - click: setVolumeEnvelopeLoop
                - type: label
                  label: From
                - name: volumeEnvelopeLoopStart
                  type: spinBox
                  field: volume-envelope-loop-start.value
                  min: 0
                  max: 100
                  step: 1
                  rule: disabled unless ft mode is active
                  actions:
                    - change: setVolumeEnvelopeLoopStart
                - type: label
                  label: To
                - name: volumeEnvelopeLoopEnd
                  type: spinBox
                  field: volume-envelope-loop-end.value
                  min: 0
                  max: 100
                  step: 1
                  rule: disabled unless ft mode is active
                  actions:
                    - change: setVolumeEnvelopeLoopEnd
    - name: panningEnvelopePanel
      type: panel
      layout:
        direction: column
      content:
        # identical structure, every "volume"/"Volume" swapped for "panning"/"Panning"
```

`rule:` accepts a list (confirmed by reading `compiler/convert.js`'s own handling of a `seq`-kind rule node before authoring this - each item resolves to its own binding, so a control can carry both a `highlighted-when-active` and a `disabled-unless-active` rule at once, exactly as the enable/sustain/loop checkboxes each need).

## Testing strategy

- **`tests/recipes.test.js`** (extended): the two new verbs, the six new aliases.
- **`tests/sampleEditor.test.js`** (extended): all sixteen new capabilities against a real loaded `.xm` fixture, including that `addPoint`/`removePoint` republish a re-clamped `sustainPoint`/`loopStartPoint`/`loopEndPoint` correctly.
- **`tests/sampleEditorScreen.test.js`** or an extension of an existing layout-integration test (confirmed at implementation time against what already exists) mirroring spec 048/053's own `computeGenericLayout()` convention: both `envelopeView` nodes get a non-zero rect whenever `sampleEditNormalView` is visible.
- `node compiler/generate.js`: no new warnings (diffed). `node build.mjs app`: every one of the sixteen new commands appears as a real mapped capability, not a `mocked-command`; loose ends checked, not assumed.
- `node --test tests/*.test.js` passes.

## What this deliberately does not do

See requirements.md's Scope boundaries: no `isMaximized`/`moreExpanded`, no v1-exact column positions, no scopes/piano, no classic-grid screen.
