# 053 — Design

## Overview

```
project/specs/application/current/components/multitrackPanel.yaml (new)
  panel (width: fill, height: fill)
    multitrackView (width: fill, height: fill)

project/specs/application/current/app.yaml
  main.normalMainView.content: [..., editPad, multitrackPanel, songPatternList, songProperties, ...]
```

No `capabilities.js` change, no new `compiler/recipes.js` vocabulary - `multitrackView` has no authored `rule:`/`actions:`/`field:` at all, matching every other specialized leaf's own placement (`nibblesGrid`'s own YAML node needs none either, beyond its siblings').

## `components/multitrackPanel.yaml`

```yaml
name: multitrackPanel
type: panel
layout:
  width: fill
  height: fill
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
    - multitrackPanel
    - songPatternList
    - songProperties
```

One new line, no gate - `normalMainView`'s own `main-view.value` condition already covers this the same way it already covers `editPad`/`songPatternList`/`songProperties`.

## Testing strategy

- **`tests/multitrackScreen.test.js`** (new), mirroring `tests/nibblesMainView.test.js`'s own convention exactly: compile the real `app.yaml`, run `computeGenericLayout()` with `main-view.value` seeded to `""` (the real app's own initial value, not JS's `undefined` - spec 048's own caught mistake, not repeated here), and assert `main.normalMainView.multitrackPanel.multitrackView` is present with a non-zero rect; assert it is absent when `main-view.value` is `"nibbles"`.
- `node compiler/generate.js`: no new warnings (confirmed by a before/after diff, not just "still zero errors" - a genuinely new leaf placement could in principle introduce an `unknown-component-property` or similar if `multitrackView`'s own registered `properties: {}` were ever wrong, so this is checked, not assumed).
- `node build.mjs app`: loose ends unchanged - no command is authored, so no `mocked-command`/`unresolved-action-reference` entries are possible from this spec.
- `node --test tests/*.test.js` passes.

## What this deliberately does not do

See requirements.md's Scope boundaries: no classic grid screen, no row/column toggle, no classic-grid mute/solo header, no View-menu entry, no scopes/VU meters.
