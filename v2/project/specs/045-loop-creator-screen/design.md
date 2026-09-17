# 045 — Design

## Overview

```
project/specs/application/current/components/sampleEditPanel.yaml
  restructured: existing content wrapped in "sampleEditNormalView"
  (visibleWhen loop-creator.mode is closed/""), new "Create Loop" button,
  new "loopCreatorPanel" (visibleWhen loop-creator.mode is open) hosting
  the menu bar and loopCreatorView

domain/sampleEditor/index.js (extended)
  openLoopCreator(app)             opens spec 043's session, sets mode=open
  saveLoopCreator(app)             spec 043's own save, sets mode=closed
  cancelLoopCreator(app)           spec 043's own cancel, sets mode=closed
  toggleSnapToZero(app, detail)    spec 043's own setSnapToZero, publishes
  setLoopPreset(app, detail)       label -> index -> spec 043's own applyLoopPreset

compiler/recipes.js
  verb-action gains: open, cancel
  CONDITION_FIELD_ALIASES gains: "snap to zero" -> "snap-to-zero.active"

capabilities.js
  five new command -> module/export mappings
```

Confirming field/command names empirically (spec 036/042's own precedent): every action name below was run through `node compiler/generate.js` and the compiled outline read back before capabilities.js was written, not hand-derived.

| Authored action | Command | Field |
|---|---|---|
| `openLoopCreator` | `loop-creator.open` | *(none)* |
| `saveLoopCreator` | `loop-creator.save` | *(none)* |
| `cancelLoopCreator` | `loop-creator.cancel` | *(none)* |
| `toggleSnapToZero` | `snap-to-zero.toggle` | `snap-to-zero.active` |
| `setLoopPreset` | `loop-preset.set` | `loop-preset.value` |

## `domain/sampleEditor/index.js` (extended)

```js
import * as loopCreator from "./loopCreator.js";

const LOOP_PRESET_LABELS = ["Select", "Fade in Head", "Fade out Tail", "Cross Fade"];

/** The "Create Loop" button's own capability - opens spec 043's own session for the current instrument and switches the sample-editor panel to show it. Distinct from loopCreator.js's own openLoopCreator(instrument), which this wraps - see that module's own header comment on this naming precedent (spec 043). */
export function openLoopCreator(app) {
    const opened = loopCreator.openLoopCreator(song.getCurrentInstrument());
    if (opened && app && app.state) app.state.set("loop-creator.mode", "open");
    if (app && app.log) app.log("loop-creator.open", { opened });
    return opened;
}

export function saveLoopCreator(app) {
    const saved = loopCreator.saveLoopCreator();
    if (app && app.state) app.state.set("loop-creator.mode", "closed");
    if (app && app.log) app.log("loop-creator.save", { saved });
    return saved;
}

export function cancelLoopCreator(app) {
    const cancelled = loopCreator.cancelLoopCreator();
    if (app && app.state) app.state.set("loop-creator.mode", "closed");
    if (app && app.log) app.log("loop-creator.cancel", { cancelled });
    return cancelled;
}

export function toggleSnapToZero(app, detail) {
    const current = loopCreator.getLoopCreatorState().snapToZero;
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    loopCreator.setSnapToZero(next);
    if (app && app.state) app.state.set("snap-to-zero.active", next);
    if (app && app.log) app.log("snap-to-zero.toggle", { next });
    return next;
}

export function setLoopPreset(app, detail) {
    const index = LOOP_PRESET_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    return loopCreator.applyLoopPreset(index);
}
```

## `compiler/recipes.js`

```js
// verb-action gains two more verbs - "open" (the "Create Loop" button) and
// "cancel" (the loop creator's own Cancel button):
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out|open|cancel)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
```

```js
// CONDITION_FIELD_ALIASES gains one entry, the same seam spec 042 already
// used for "loop enabled":
{ pattern: /\bsnap to zero\b/i, mockField: "snap-to-zero.active", activeValue: true }
```

## `project/specs/application/current/components/sampleEditPanel.yaml`

```yaml
name: sampleEditPanel
type: panel
layout: { width: fill, direction: column }
visibleWhen: { field: top-view.value, oneOf: [Sample Edit] }
content:
  - name: sampleEditNormalView
    type: panel
    layout: { direction: column }
    visibleWhen:
      field: loop-creator.mode
      oneOf: [closed, ""]
    content:
      - instrumentRow (unchanged)
      - waveform (unchanged)
      - sampleControlsRow (unchanged)
      - name: sampleEditButtons
        type: buttonGroup
        layout: { direction: row }
        items:
          - Normalize / Fade In / Fade Out / Trim / Reverse / Invert (unchanged)
          - { type: button, label: Create Loop, actions: [click: openLoopCreator] }
  - name: loopCreatorPanel
    type: panel
    layout: { direction: column }
    visibleWhen:
      field: loop-creator.mode
      oneOf: [open]
    content:
      - name: loopCreatorMenuBar
        type: panel
        layout: { direction: row }
        content:
          - { type: label, label: Create Loop }
          - { type: button, label: Apply, actions: [click: saveLoopCreator] }
          - { type: button, label: Cancel, actions: [click: cancelLoopCreator] }
          - { type: checkbox, label: Snap to zero, rule: "highlighted when snap to zero is active", actions: [click: toggleSnapToZero] }
          - name: loopPresets
            type: radioGroup
            variant: buttons
            items:
              - { label: Select }
              - { label: Fade in Head }
              - { label: Fade out Tail }
              - { label: Cross Fade }
            actions: [change: setLoopPreset]
      - name: loopCreatorWave
        type: loopCreatorView
        layout: { width: fill, height: fill }
```

`sampleEditNormalView`'s own `oneOf: [closed, ""]` matches the same "not yet set" empty-string convention `top-view.value`'s own `oneOf: [Options, ""]` already uses, so the normal view is what shows before `loop-creator.mode` is ever touched.

## `capabilities.js` (five new mappings)

```js
"loop-creator.open": { module: "./domain/sampleEditor/index.js", export: "openLoopCreator" },
"loop-creator.save": { module: "./domain/sampleEditor/index.js", export: "saveLoopCreator" },
"loop-creator.cancel": { module: "./domain/sampleEditor/index.js", export: "cancelLoopCreator" },
"snap-to-zero.toggle": { module: "./domain/sampleEditor/index.js", export: "toggleSnapToZero" },
"loop-preset.set": { module: "./domain/sampleEditor/index.js", export: "setLoopPreset" }
```

## Data models

`loop-creator.mode` (`"open"`/`"closed"`/`""`) is the only new field; everything else is spec 043/044's own existing state.

## Error handling

- **"Create Loop" clicked with no current instrument, or an instrument with no sample data**: `loopCreator.openLoopCreator` returns `false` (spec 043's own guard); `loop-creator.mode` is left untouched (never switches to `"open"`), so the panel stays on its normal view rather than showing an empty overlay.
- **Apply/Cancel clicked when nothing is open** (not reachable through the UI, since both are only visible while `loop-creator.mode` is `"open"`, but cheap to guard): both spec-043 functions already return `false` harmlessly; `loop-creator.mode` is still set to `"closed"`, a safe idempotent write.
- **An unrecognized preset label** (not reachable from the authored four items, but a real guard against a malformed `detail.value`): `setLoopPreset` returns `false` without calling `applyLoopPreset` at all.

## Testing strategy

- **`tests/recipes.test.js`** (extended): `open`/`cancel` resolve as fire-and-forget commands; the snap-to-zero alias agrees with its own toggle-generic field.
- **`tests/sampleEditor.test.js`** (extended): all five new capability functions, against the real `wizballalt.mod` fixture - open/save/cancel's own mode-field transitions and no-open-session guards, the snap toggle's flip/explicit-value paths, and all four preset labels plus one unrecognized label.
- `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (read back to verify the table above) and that the loose-ends count is unaffected.
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no `dropdown`-based presets, no live cursor hinting or zoom sync (already spec 044's own), no color-key legend.
