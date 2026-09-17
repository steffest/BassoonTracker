# 048 — Design

## Overview

```
compiler/recipes.js
  verb-action gains one more verb: "show" (resolves showMain -> main.show;
  also, as a side effect, showOptions/showFileOperations/showSampleEditor
  now resolve to options.show/file-operations.show/sample-editor.show -
  none of the three is mapped in capabilities.js, so each simply becomes a
  mocked-command loose end instead of an unresolved-action-reference one;
  not this spec's concern to map, see requirements.md's scope boundary)

domain/nibbles/index.js (extended)
  openNibblesView(app)   sets main-view.value = "nibbles"
  showMain(app)          sets main-view.value = ""

capabilities.js
  "nibbles.open": openNibblesView
  "main.show": showMain

project/specs/application/current/app.yaml
  fileOperationsPanel/optionsPanel/sampleEditPanel/editPad/songPatternList/
  songProperties wrapped in a new "normalMainView" panel
  (visibleWhen main-view.value in ["", undefined-as-""])
  a new sibling "nibblesPanel" (visibleWhen main-view.value == "nibbles"),
  placeholder content only
  the View menu's "Nibbles" item: click: nibbles -> click: openNibbles
```

Confirmed empirically before writing any YAML (spec 036/042/045/046's own precedent):

| Authored action | Command | Field |
|---|---|---|
| `openNibbles` | `nibbles.open` | *(none)* |
| `showMain` | `main.show` | *(none)* |

`showMain` did not resolve at all before this spec (`"show"` was not a recognized `verb-action` verb) - confirmed by running `interpretAction` directly, not assumed from the existing `showOptions`/`showFileOperations`/`showSampleEditor` siblings' own (also-unresolved) state.

## Why `openNibblesView`/`showMain` live in `domain/nibbles/index.js`, not a new module

Neither is really "game" logic - they are view-routing, the same kind of thin `app.state.set(...)` wrapper spec 045/046 already put directly in `domain/sampleEditor/index.js` for their own screen's mode field. There is no existing "app view routing" domain module to put a more general version in, and `showMain` exists only to undo Nibbles' own takeover today - inventing a general-purpose view router for a second, hypothetical full-screen feature that does not exist yet would be exactly the kind of mechanism-ahead-of-need this port has repeatedly declined elsewhere (`CONDITION_FIELD_ALIASES`, `verb-action`'s own verb list, both grown one real need at a time). If a second full-screen takeover is ever added, generalizing `showMain` past Nibbles becomes that spec's own decision to make with a second real data point, not this one's to guess at.

## `domain/nibbles/index.js` (extended)

```js
/** The "Nibbles" menu item's own capability - switches the whole main content area to the game. */
export function openNibblesView(app) {
    if (app && app.state) app.state.set("main-view.value", "nibbles");
    if (app && app.log) app.log("nibbles.open", {});
}

/** Ported from nibbles.js's own "Exit" button (GameControls.exitButton.onClick, 720-722: EventBus.trigger(EVENT.command, COMMAND.showMain)) - undoes openNibblesView. */
export function showMain(app) {
    if (app && app.state) app.state.set("main-view.value", "");
    if (app && app.log) app.log("main.show", {});
}
```

## `compiler/recipes.js`

```js
// verb-action gains "show" (resolves this spec's own showMain, and as a
// side effect the View menu's other three already-authored "show X" items -
// none mapped in capabilities.js, so each simply becomes a mocked-command
// loose end instead of an unresolved-action-reference one):
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out|open|cancel|show)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
```

## `project/specs/application/current/app.yaml`

```yaml
        - controlBar
        - infoBar
        - name: normalMainView
          type: panel
          layout: { width: fill, direction: column }
          visibleWhen: { field: main-view.value, oneOf: [""] }
          content:
            - fileOperationsPanel
            - optionsPanel
            - sampleEditPanel
            - editPad
            - songPatternList
            - songProperties
        - name: nibblesPanel
          type: panel
          layout: { width: fill, height: fill }
          visibleWhen: { field: main-view.value, oneOf: [nibbles] }
          content:
            - type: label
              label: "Nibbles (placeholder - spec 049 authors the real screen)"
            - type: button
              label: Exit
              actions: [click: showMain]
```

`normalMainView` is authored `direction: column` explicitly (not left to the fallback height-based rule) so the six wrapped regions stack exactly as they did as direct children of `main` - none of them authors `height: fill` today (confirmed by reading `editPad.yaml`/`songPatternList.yaml`/`songProperties.yaml` in full), so nesting one level deeper changes no sizing behavior, only ownership.

The View menu's own existing item:

```yaml
- type: label
  label: Nibbles
  actions:
    - click: openNibbles   # was: click: nibbles
```

## `capabilities.js` (two new mappings)

```js
"nibbles.open": { module: "./domain/nibbles/index.js", export: "openNibblesView" },
"main.show": { module: "./domain/nibbles/index.js", export: "showMain" }
```

## Data models

`main-view.value` (`""`/`"nibbles"`) is the only new field.

## Error handling

Neither `openNibblesView` nor `showMain` has a failure case - both are unconditional field writes, matching v1's own unconditional show/hide calls.

## Testing strategy

- **`tests/recipes.test.js`** (extended): `show` resolves `showMain` to `main.show`; a regression test confirming the pre-existing `showOptions`/`showFileOperations`/`showSampleEditor` items now also resolve (to `options.show`/`file-operations.show`/`sample-editor.show`), recorded as the side effect it is, not silently left unverified.
- **A new `tests/nibblesMainView.test.js`**: compiles the real `app.yaml`, calls `computeGenericLayout()` with `main-view.value` seeded `""` (the real app's own initial-state value - not JS's `undefined`, which no `oneOf` list will ever match, confirmed the hard way when an early draft of this test used it and every one of the six regions came back with no rect at all) and separately `"nibbles"`, asserting: each of the six regions still respects its own pre-existing `visibleWhen` (e.g. `fileOperationsPanel`/`sampleEditPanel` still need their own matching `top-view.value` too - `main-view.value` alone does not override spec 025/026's own mechanism); `normalMainView`'s whole subtree is absent (not merely empty) when `main-view.value` is `"nibbles"`, and `nibblesPanel` gets a rect; the menu bar/control bar/info bar are present regardless; and nesting costs exactly one panel's own padding level, not an unexpected amount (mirroring spec 019's own "direct computeGenericLayout() integration check" convention - no Playwright in this environment).
- `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command table above, read back) and that `nibbles`/`showMain` no longer appear as `unresolved-action-reference` loose ends.
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no real screen content (spec 049's own), no feature-registry wiring (a real, already-existing, port-wide limitation, not fixed here), `showOptions`/`showFileOperations`/`showSampleEditor` left exactly as unmapped as before (now mocked rather than unresolved, a byproduct of the shared verb, not a mapped capability).
