# v2 skin source artwork

One PNG per skin asset. The file's base name **is** the asset name authored in
`project/specs/application/current/skin/*.yaml` (`normal: play_green` means
`play_green.png`), and the same name becomes the sprite name in the generated
atlas map. That is the whole traceability chain: YAML state -> asset name ->
this file (spec [008](../../../project/specs/008-skin-assets/requirements.md)).

## How these are used

- **Development**: `renderers/canvas/skin.js` loads these files individually,
  one `Image` per referenced asset. Replacing a file here and reloading the
  page shows the new artwork with no build step. Only assets the skin YAML
  references are requested.
- **Release**: `node v2/build.mjs skin` packs exactly the referenced assets
  into `../generated/atlas.png` plus `../generated/atlas.json`, and the
  generated app (`v2/app/`) and bundle (`v2/dist/`) load that pair instead.
  `assets/skin/generated/` is build output; do not edit it by hand.

Adding artwork: drop the PNG here, reference its base name from a style state
in the skin YAML, and regenerate. An unreferenced PNG is still offered in the
workbench's Skin tab picker but costs nothing in the atlas. A referenced name
with no file here produces an `unknown-skin-asset` warning and draws a dashed
placeholder.

## Provenance

Copied unmodified from `skin/src/` in the parent BassoonTracker repository
(same repository, MIT). They are duplicated here because all v2 edits stay
inside `v2/` (`v2/AGENTS.md`). `spritesheet_v6.png` and `spritemap_v6.json`
one level up are the older, whole-application atlas copied from the same
place; they are kept only as the built-in fallback skin's assets, which a
half-authored skin falls back to.

Constraints inherited from the packer (`v2/tools/skinAtlas.mjs`, itself
adapted from the parent repository's `skin/generate.js`): 8-bit,
non-interlaced PNG, color type 0, 2, 3, 4 or 6. The `font.png` glyph atlas is
read through the `fonts:` block of the skin YAML, which carries its own glyph
metrics; it is an ordinary asset otherwise.
