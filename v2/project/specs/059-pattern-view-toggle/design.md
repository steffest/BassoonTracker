# 059 — Design

## Overview

```
project/specs/application/current/components/multitrackPanel.yaml (renamed)
  -> components/patternViewPanel.yaml, restructured:
     patternViewPanel (panel, column)
       scopes (scopesView, always visible)
       patternGridPanel (panel, visibleWhen pattern-view.value oneOf ["", "Column view"])
         patternGrid
       multitrackViewPanel (panel, visibleWhen pattern-view.value oneOf ["Row view"])
         multitrackView

project/specs/application/current/app.yaml
  main.normalMainView.content: multitrackPanel -> patternViewPanel

project/specs/application/current/components/controlBar.yaml
  new radioGroup, "Column view" / "Row view", next to the existing "Display" group
```

No `capabilities.js` change, no `compiler/recipes.js` change - `setPatternView` already resolves via the existing `set-value` recipe (confirmed empirically: `interpretAction("set pattern view")` -> `{command: "pattern-view.set", mockField: "pattern-view.value"}`), and is left as a generated mock deliberately (see requirements.md's Decisions).

## `components/patternViewPanel.yaml`

```yaml
name: patternViewPanel
type: panel
layout:
  width: fill
  height: fill
  direction: column
content:
  - name: scopes
    type: scopesView
    layout:
      width: fill
      height: 80
  - name: patternGridPanel
    type: panel
    layout:
      width: fill
      height: fill
    visibleWhen:
      field: pattern-view.value
      oneOf:
        - ""
        - "Column view"
    content:
      - name: patternGrid
        type: patternGrid
        layout:
          width: fill
          height: fill
  - name: multitrackViewPanel
    type: panel
    layout:
      width: fill
      height: fill
    visibleWhen:
      field: pattern-view.value
      oneOf:
        - "Row view"
    content:
      - name: multitrackView
        type: multitrackView
        layout:
          width: fill
          height: fill
```

## `app.yaml`

```yaml
- name: normalMainView
  ...
  content:
    - fileOperationsPanel
    - optionsPanel
    - sampleEditPanel
    - editPad
    - patternViewPanel
    - songPatternList
    - songProperties
```

## `components/controlBar.yaml`

One new `radioGroup`, in the same sub-panel the existing "Display" (4/8/12/16) group already sits in, matching where `controlPanel.js` itself puts its own "Column view"/"Row view" buttons:

```yaml
      - name: patternViewGroup
        type: radioGroup
        variant: buttons
        items:
          - label: "Column view"
          - label: "Row view"
        actions:
          - change: setPatternView
```

No `field:` authored - the same shape `topViewGroup` (this same file) already has: with no bound field of its own, a selection-like control's own value lives in whichever field its own `change` action's derived `set-value` binding names (`pattern-view.value`, confirmed empirically above), the established precedent for a radioGroup that infers its own field rather than declaring one redundantly.

## Testing strategy

- **`tests/patternViewScreen.test.js`** (renamed from `tests/multitrackScreen.test.js`, its own content updated for the new node ids and the toggle): `patternGrid` present/sized by default (`pattern-view.value` unset); `multitrackView` present/sized instead once `pattern-view.value` is `"Row view"`, `patternGrid` then absent; `scopesView` present either way; the whole area still sits between `editPad` and `songPatternList`.
- **`tests/server.test.js`** (extended): the renamed file in the file listing, repositioned alphabetically (`patternViewPanel.yaml` sorts after `optionsPanel.yaml`, not in the old `multitrackPanel.yaml` slot between `infoBar.yaml`/`optionsPanel.yaml`).
- **`tests/yaml.test.js`** (extended, if it names the old node by position - confirmed at implementation time against what actually breaks, not assumed).
- `node compiler/generate.js`: no new warnings (diffed). `node build.mjs app`: the new `mocked-command` loose end (`pattern-view.set`) plus the new radioGroup's own two `inert-control` items - confirmed by reading `LOOSE-ENDS.md` back, not assumed.
- `node --test tests/*.test.js` passes.

## What this deliberately does not do

See requirements.md's Scope boundaries: no classic-grid mute/solo/FX header, no piano, no real capability for the toggle.
