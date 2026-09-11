# Skin: artwork, component styles and the Skin tab

Status: implemented and verified 2026-09-10 (spec [008](../specs/008-skin-assets/requirements.md): [requirements](../specs/008-skin-assets/requirements.md), [design](../specs/008-skin-assets/design.md), [tasks](../specs/008-skin-assets/tasks.md)).

How a v2 component looks is authored, not coded. One YAML document says which artwork file draws which visual state of which component type; the renderer only follows it.

## The three pieces

| piece | where |
|---|---|
| artwork | one PNG per asset in `v2/assets/skin/src/`, named by the asset name |
| description | `project/specs/application/current/skin/default.yaml`, selected by `app.skin` |
| link from a component | `variant: play` (or `style: play`) on the component |

An asset name **is** the base name of its PNG: `normal: play_green` means `assets/skin/src/play_green.png`, and that same name is the sprite name in the packed atlas. There is no second lookup table, so the trace from a visual state to an artwork file is one step and cannot go stale.

## Authoring a style

```yaml
styles:
  button:
    default:
      description: Standard dark push button with a centered label.
      insets: 5                 # or a left/top/right/bottom mapping
      width: 80
      height: 24
      focusColor: "#ffcc00"
      label:
        align: center           # left | center | right
        offsetX: 0
        offsetY: 0
        pressedOffset: 1
      states:
        normal: button_inlay
        pressed: button_inlay_active
        active: button_inlay_green
    play:
      extends: default
      description: Transport play button; green while playing.
      states:
        hover: button_hover_green
```

`fonts:` describes each bitmap font the same way: an `asset` for the glyph sheet plus its metrics (`offsetX`, `offsetY`, `charWidth`, `charHeight`, `spaceWidth`, `margin`, `lineSpacing`, `charsPerLine`, `chars`, `onlyUpperCase`). Nothing about a font is hardcoded in the renderer any more.

Which types are styled is declared in the component registry ([components.md](components.md)), currently `panel`, `button`, `label`, `viewport`, `radioGroup`, `radioItem`, `checkbox`, `slider` and `spinBox`. Two styles point at another type's variant rather than carrying artwork of their own: a radio group's `itemStyle` chooses the `radioItem` variant its choices are drawn with, which an item may still override with its own `variant:`, and a slider's or spin box's `thumbStyle` chooses the `button` variant its thumb or its stepper halves are drawn with. Both exist so a new control can be skinned without new artwork. A component's `variant:` is looked up inside its own type, so `button/play` and a future `panel/play` cannot collide.

`width`/`height` on a style are also the defaults `layout: { height: fixed }` resolves to, so a size lives in one place.

## Visual states

`normal`, `hover`, `pressed`, `disabled`, `active`, `active_hover`, `active_pressed`. `active` is the highlighted/on state a `highlighted when ... is active` rule drives. Focus is a drawn ring (`focusColor`), not artwork.

A style need not define all seven. Each state falls back along one chain, and the renderer adds the pre-existing tint for whatever the stand-in does not express:

| state | tries, in order | overlay when a stand-in is used |
|---|---|---|
| `hover` | `hover`, `normal` | white 15% |
| `pressed` | `pressed`, `normal` | black 30% |
| `disabled` | `disabled`, `normal` | black 45% |
| `active` | `active`, `normal` | green wash |
| `active_hover` | `active_hover`, `active`, `normal` | white 15% if the winner is not a hover state |
| `active_pressed` | `active_pressed`, `pressed`, `active`, `normal` | black 30% and/or green wash as needed |

So a skin that defines only `normal` still looks like the pre-008 button, and every cell in the workbench says which of the two happened ("own artwork" versus "via normal +dim").

## Development versus release

- **Development** (`app.html`, `preview-app.html`, the workbench preview) loads the individual PNGs, one image per referenced asset. Replacing a file under `assets/skin/src/` and reloading shows the new artwork with no build step; only adding a *new* reference needs a regeneration.
- **Release** loads one packed sheet plus one map. `node v2/build.mjs skin` packs exactly the assets the compiled skin references into `assets/skin/generated/atlas.png` and `atlas.json`; `build.mjs app` and `dist` run it first, the generated app carries the skin as `app/skin.js` in atlas mode, and `dist/` gets the pair copied beside its bundle. Verified pixel-identical to development mode.

`assets/skin/generated/` is build output but is committed, for the same reason `app/` is: the generated application must run from a clone without a build step. Re-run `node v2/build.mjs skin` (or plain `node v2/build.mjs`) after changing artwork, or the generated app and the bundle keep showing the previous atlas while development already shows the new PNGs.

The packer (`v2/tools/skinAtlas.mjs`) is plain Node with no dependency: PNG decode (8-bit, non-interlaced, colour types 0/2/3/4/6), a shelf pack over candidate widths, PNG encode. It is a development tool; nothing in the runtime imports it.

An application with no skin document at all still runs: it warns (`missing-skin`) and uses the built-in fallback skin in `runtime/skinModel.js`, which is the pre-008 hardcoded set read from the legacy `spritesheet_v6` pair. It was introduced for spec 003's renderer, retired by spec 011, and stays because a half-authored skin must still draw.

## The Skin tab

`workbench.html` third tool tab, beside Interaction log and State gallery:

1. **Styles** — every type and variant, with its authored description, insets, default size and label placement, and a link to its YAML line.
2. **States** — one row per visual state: the source PNG, the result drawn by the application's own draw function, the asset name, where it comes from (own, inherited through `extends`, or a fallback plus its overlay) and a picker of every PNG in `assets/skin/src/`.
3. **Library** — the variant by state matrix for the selected type, every cell drawn by the renderer and captioned with the artwork that won.
4. **Used by** — the application components this variant draws, each selectable in the preview.

The details panel shows the selected component's style, the line that asked for it, the line that defines it, its description and a "show in Skin" button, so the link runs in both directions.

**Editing.** Choosing a PNG does not rewrite the document from a model: it splices the exact scalar the compiler recorded (or inserts one line into the style's `states:` block, or adds the block), leaving the buffer unsaved for review. Ctrl+S saves and regenerates through the normal path, so comments, key order and formatting survive. Two guards protect the source: the workbench refuses to edit a buffer that is dirty or that changed since the last generation, and the splice itself refuses if the recorded range no longer holds the text it expects. The tab is read-only on a static host, like the editor.

## Diagnostics

All warnings; artwork never fails a build or a conversion.

| code | meaning |
|---|---|
| `unknown-skin-asset` | a state or font names an asset with no PNG in `assets/skin/src/` (it draws as a red dashed placeholder) |
| `unknown-style-variant` | a component names a variant its type does not define (drawn with `default`) |
| `unknown-style-state` | a state name outside the seven |
| `unknown-style-property` | an unknown style, label, insets or font property |
| `unresolved-style-extends` | `extends` names a missing variant, or the chain is circular |
| `missing-skin` | no `skin/<name>.yaml`; the built-in fallback is used |
| `missing-skin-font` / `missing-skin-styles` / `missing-style-default` | the document defines none of those; the built-in ones fill in |

## Compatibility note

Spec 008 raised the compiler to 0.2.0 and the outline schema to 3: the outline gained `skin` and a `style` on every styled node, and source offsets now include each line's indentation. They were previously short by it, which nothing noticed while only line numbers were read, but splicing YAML needs them exact. Regenerate (`node v2/compiler/generate.js`, or Save & Refresh) after updating; an outline from an older compiler has offsets the Skin tab will refuse to splice.
