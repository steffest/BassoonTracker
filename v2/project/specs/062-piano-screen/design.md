# 062 — Design

## Overview

```
project/specs/application/current/components/pianoPanel.yaml (new)
  pianoPanel (panel, width: fill, height: 200, direction: column)
    visibleWhen: {field: piano.active, oneOf: [true]}
    pianoHeaderRow (panel, row)
      pianoOctaveSpinBox (spinBox, field: current-octave.value, min:0, max:7, step:1, actions: [change: setCurrentOctave])
      pianoCloseButton (button, label: Close, actions: [click: togglePiano])
    pianoKeys (pianoView, width: fill, height: fill)

project/specs/application/current/app.yaml
  main.content: + pianoPanel (bare reference, new sibling after nibblesPanel - same level, not nested inside normalMainView)

domain/song/index.js
  + applyOctaveChange(app, detail) - capabilities.js's own "current-octave.set" mapping

capabilities.js
  + "current-octave.set": { module: "./domain/song/index.js", export: "applyOctaveChange" }
```

`piano.toggle`/`piano.active` resolve via the existing `toggle-generic` recipe with no new vocabulary (confirmed empirically: `togglePiano` -> "toggle piano" -> `piano.toggle` command, `piano.active` mock field) and are left as a **generated mock**, deliberately - pure UI visibility state, the same class every other view-mode toggle in this port already leaves mocked (`top-view.set`, `pattern-view.set`).

`current-octave.set`/`current-octave.value` resolve via the existing `set-value` recipe, also with no new vocabulary, but **is** given a real capability - the octave genuinely changes which note a piano click plays (`runtime/pianoController.js` reads `domain/song#getCurrentOctave()` directly, spec 061), unlike a pure view-mode toggle.

## `domain/song/index.js#applyOctaveChange`

```js
/**
 * capabilities.js's own `current-octave.set` mapping (spec 062) - the
 * piano's own octave spinbox. A distinct wrapper from setCurrentOctave
 * itself: that one is called internally with a plain number
 * (runtime/gridController.js's own F1-F7 octave-select keys, spec 031), not
 * an (app, detail) pair - one capability's own signature can't double as
 * the other's. Republishes the actual, possibly-clamped-away, resulting
 * value - setCurrentOctave itself already silently no-ops outside the
 * current tracker format's own range (spec 031), the same "wide ceiling,
 * narrow clamp inside the capability" shape spec 050's own finetune
 * capability already established.
 */
export function applyOctaveChange(app, detail) {
    setCurrentOctave(Math.round(Number(detail && detail.value)) || 0);
    if (app && app.state) app.state.set("current-octave.value", getCurrentOctave());
    if (app && app.log) app.log("current-octave.set", { "current-octave.value": getCurrentOctave() });
}
```

## `components/pianoPanel.yaml`

```yaml
name: pianoPanel
type: panel
layout:
  width: fill
  height: 200
  direction: column
visibleWhen:
  field: piano.active
  oneOf:
    - true
content:
  - name: pianoHeaderRow
    type: panel
    layout:
      width: fill
      direction: row
    content:
      - name: pianoOctaveSpinBox
        type: spinBox
        field: current-octave.value
        min: 0
        max: 7
        step: 1
        actions:
          - change: setCurrentOctave
      - name: pianoCloseButton
        type: button
        label: Close
        actions:
          - click: togglePiano
  - name: pianoKeys
    type: pianoView
    layout:
      width: fill
      height: fill
```

## `app.yaml`

`main.content` gains one new sibling, a bare reference, right after `nibblesPanel` (both `normalMainView` and `nibblesPanel` are themselves gated by `main-view.value`; `pianoPanel` is gated only by `piano.active`, so it shows or hides independently of whichever of those two is currently active underneath - PIANO-SCREEN-002):

```yaml
        - name: nibblesPanel
          ...
        - pianoPanel
```

## Testing strategy

- **`tests/pianoScreen.test.js`** (new, `computeGenericLayout()` against the real, compiled `app.yaml`, the same convention `tests/patternViewScreen.test.js`/`tests/envelopeScreen.test.js` already use): `piano.active` unset -> `pianoPanel`/`pianoKeys`/the spinbox/the close button all absent; `piano.active: true` -> all present and sized, positioned after `songProperties`/`nibblesPanel`; present with `piano.active: true` regardless of `main-view.value` (unset or `"Nibbles"`) and regardless of `pattern-view.value`.
- **`tests/song.test.js`** (extended): `applyOctaveChange` clamps per tracker format (PT 1-3, FT 0-7) and republishes the actual resulting value via `app.state.set`, not the raw requested one.
- `node compiler/generate.js`: no new warnings (diffed). `node build.mjs app`: no new loose ends at all, corrected from the design sketch's own prediction of one expected `mocked-command` - `piano.toggle` turned out to already be mapped to a real, pre-existing capability (`domain/settings/index.js#togglePiano`, predating this session), not a generated mock. Confirmed by reading `LOOSE-ENDS.md` back, not assumed.
- `node --test tests/*.test.js` passes.

## What this deliberately does not do

See requirements.md's Scope boundaries: no pattern-sidebar entry point, no responsive breakpoint sizing, no recording via piano clicks.
