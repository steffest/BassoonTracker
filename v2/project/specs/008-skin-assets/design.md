# 008 — Design

## Source shape

One new authored kind under `project/specs/application/current/`: `skin/<name>.yaml`, selected by `app.skin` in `app.yaml` (default `default`). It has three parts.

```yaml
name: default
description: Prose describing the skin as a whole.
fonts:
  small:
    asset: font          # -> assets/skin/src/font.png
    offsetX: 1
    charWidth: 6
    chars: ABC...
styles:
  button:
    default:
      description: Prose describing this graphical representation.
      insets: 5          # or a nested left/top/right/bottom mapping
      width: 80
      height: 24
      label:
        align: center
        offsetY: 0
        pressedOffset: 1
      focusColor: "#ffcc00"
      states:
        normal: button_inlay
        pressed: button_inlay_active
        active: button_inlay_green
    play:
      extends: default
      description: Transport play button; green artwork while playing.
      states:
        normal: play_green
        hover: play_green_hover
        active: play_active_red
```

**An asset name is the source PNG's base name.** `normal: play_green` means `assets/skin/src/play_green.png`, and the same name is the sprite name in the generated atlas map, exactly as the parent repository's packer already does. There is deliberately no second indirection table: the name *is* the trace to the file.

**State vocabulary** (`renderers/canvas/buttonSkin.js` owns the list): `normal`, `hover`, `pressed`, `disabled`, `active`, `active_hover`, `active_pressed`. `active` is the highlighted/on state a `highlighted when ... is active` rule drives. Resolution picks the first defined entry along one chain and records how it got there:

| flags | chain |
|---|---|
| disabled | `disabled` then `normal` |
| active + pressed | `active_pressed`, `pressed`, `active`, `normal` |
| active + hover | `active_hover`, `active`, `normal` |
| active | `active` then `normal` |
| pressed | `pressed` then `normal` |
| hover | `hover` then `normal` |
| none | `normal` |

When the chosen entry is not the state's own, the renderer applies the spec-005 fallback effect over the artwork (hover: white 15%, pressed: black 30% plus a one-pixel label offset, disabled: black 45%, active: green wash), so today's look is preserved wherever a style defines no dedicated asset. `resolveStateAsset()` returns the winning state, its asset, the state it fell back from and the effects applied, so the workbench can state which of the two happened per cell instead of guessing.

`extends` is resolved by the compiler, not the renderer: a derived variant is emitted fully expanded, with `extends` kept as provenance.

A component links to a style with one key: `style: play` on the component's mapping. It resolves against the component's own type, so style names live in a per-type namespace and `button/play` cannot collide with a future `panel/play`.

## Compilation

`compiler/skin.js` parses one skin document into the model below and returns diagnostics; `compiler/convert.js` calls it once, attaches `style` to every node, and returns the skin alongside the tree. `compileApplication` gains one optional dependency, `listAssets()`, returning the available source PNG base names; without it (the browser never has it) asset existence is simply not checked.

```json
"skin": {
  "name": "default",
  "mode": "loose",
  "description": "...",
  "source": { "file": "skin/default.yaml", "range": {} },
  "assets": [ { "name": "play_green", "file": "src/play_green.png", "usedBy": [ { "file": "skin/default.yaml", "range": {} } ] } ],
  "fonts": { "small": { "asset": "font", "offsetX": 1 } },
  "styles": { "button": { "play": { "type": "button", "variant": "play", "extends": "default", "description": "...",
      "insets": {}, "width": 80, "height": 24, "label": {},
      "states": { "normal": { "asset": "play_green", "source": {} } },
      "source": {} } } }
}
```

Every path in the asset list is relative to one asset base, so the same model serves both modes: loose mode resolves `src/<name>.png` against `v2/assets/skin/`, atlas mode ignores those paths and uses the sheet and map the packer wrote (`generated/atlas.png`, `generated/atlas.json`), and the release bundle only changes the base.

New diagnostics, all warnings that still publish: `unknown-skin-asset` (no such PNG), `unknown-style-variant` (a component names a variant the skin lacks), `unknown-style-state` (state name outside the vocabulary), `unknown-style-property`, `unresolved-style-extends` (cycle or missing base), `missing-skin` (no `skin/<name>.yaml`; the built-in fallback is used). None are errors: an application whose artwork is half-authored must still render.

Style sizes also become the source of the layout defaults `compiler/layoutFields.js` invents today: `resolveLayoutFields` takes a defaults map derived from the skin's styles and keeps its own table as the last resort, so a styled button with a fixed height gets the style's height and the existing `layout-default-fallback` warning only fires when nothing supplies one.

## Loading

`renderers/canvas/skin.js` becomes mode-aware and returns one interface either way:

```js
const skin = await loadSkin(model, base);   // { mode, getAsset(name), missing }
```

- **loose** (development): one `Image` per asset, origin at zero and size from the decoded image. Loads run in parallel; a failed load is collected, reported once to the console, and drawn as a dashed placeholder rect so one broken PNG cannot blank the UI.
- **atlas** (generated app, bundle): today's two requests, sheet plus map, with rects from the map.

`renderers/canvas/assets.js` keeps its cached `loadCanvasAssets()` entry point and its existing font/button/panel fields (spec 003's `mount.js` still uses them) and adds the styles and the skin handle. Called with no model it uses a built-in fallback skin equal to today's hardcoded behavior, which is also what a `missing-skin` compile falls back to, so `preview.html` and `outline.json` keep working untouched. The font is no longer at hardcoded atlas coordinates: it is the `font` asset's rect plus the authored offsets.

## Packing

`tools/skinAtlas.mjs` is project-owned plain Node adapted from the parent repository's `skin/generate.js` (MIT, same repository): PNG decode (color types 0/2/3/4/6, 8-bit, non-interlaced), a shelf packer over candidate widths, PNG encode, and one `writeAtlas(assets, outDir)` entry point. It packs *exactly* the assets the compiled skin references, so an unused PNG in `src/` costs nothing. `build.mjs` gains a `skin` target and runs it before `app` and `dist`; `dist` copies the atlas next to its bundle and its config swap keeps pointing at the copied directory. The emitter writes `app/skin.js`: the compiled skin model with atlas mode, so the generated app carries its own artwork description and still fetches no outline.

## Workbench

A third tool tab, **Skin**, mounted from `workbench/skinEditor.js` beside Interaction log and State gallery, with four regions:

1. **Styles** — every type and variant with its description, the count of application nodes using it, and its YAML line.
2. **States** — one row per state in the vocabulary: an image of the actual source PNG, the asset name, the source file, whether the row is authored or inherited through `extends`, and a picker listing every available source PNG. Changing the picker splices the buffer for the skin document; adding an undefined state inserts one line into the states block at its indentation. Both go through `workbench/skinEdit.js`, a pure text function tested in Node, and both leave the result as an unsaved buffer the author reviews and saves through the existing Ctrl+S path. No new server endpoint: the skin document is a `.yaml` file under `current/`, which the existing source write already accepts, hashes and conflict-checks.
3. **Library** — the variant by state matrix for the selected type, each cell drawn by the renderer's own button draw function, captioned with the asset that won the chain and whether an effect was applied.
4. **Used by** — the application nodes bound to this variant, each selectable in the preview.

The details panel gains a style row (variant name, link to its YAML definition, "show in Skin"), and the State gallery draws its fixtures with the selected node's own style instead of the one hardcoded button. The Skin tab is read-only on a static host, consistent with the editor.

## Alternatives considered

- *A second asset table mapping logical names to files.* Rejected: two indirections to author and to explain, for an indirection the atlas already provides by using the same names.
- *Editing the skin through a form that writes YAML from a model.* Rejected for now: it would need a YAML emitter and would reformat authored documents, which the save policy forbids. Splicing the exact scalar range keeps comments, order and formatting intact and is the same conservative move spec 005 made for source inspection.
- *Serving the source PNGs through a new API endpoint.* Unnecessary: they are static files under `v2/`, which the service already serves with the right MIME type.
- *Keeping the parent repository's `spritesheet_v6` pair as v2's atlas.* Rejected: it contains 132 sprites for the whole legacy app, has no authored provenance, and cannot answer "which file draws this state".
