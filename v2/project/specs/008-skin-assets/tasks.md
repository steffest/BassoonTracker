# 008 — Implementation

Status: implemented and verified 2026-09-10.

## Phase 1 — Traceable assets and the atlas packer

- [x] Source PNGs copied into `v2/assets/skin/src/` (33 files, 185 KB) with a provenance README stating that a file's base name *is* the asset name.
- [x] `tools/skinAtlas.mjs`: PNG decode (colour types 0/2/3/4/6, 8-bit, non-interlaced), shelf pack over candidate widths, PNG encode with per-scanline filter search, `writeAtlas()`. Plain Node, no dependency, adapted from the parent repository's `skin/generate.js` with provenance recorded.
- [x] `build.mjs skin` writes `assets/skin/generated/atlas.{png,json}` from exactly the assets the compiled skin references.

Verification: `tests/skinAtlas.test.js` (5 cases) decodes the real PNGs, packs without overlap or overflow, proves the layout depends on the asset *set* and not on input order, round-trips arbitrary RGBA through `encodePng`, refuses two files claiming one asset name, and checks that **every** rect in the written map is pixel-identical to its source PNG. `node v2/build.mjs skin` packs the 12 referenced assets into 601x256 (50,344 bytes).

## Phase 2 — Skin source and compilation

- [x] `skin/default.yaml`: the small font, `panel/default`, `button/{default,play,record}`, `radioGroup/{default,buttons}`, `radioItem/{default,button}`, `label/default`.
- [x] `compiler/skin.js` + `runtime/skinModel.js`: parse, expand `extends`, validate states/properties/assets/fonts, emit the model with a source range per reference. The vocabulary, the built-in fallback skin, `lookupStyle`, `resolveStateAsset` and `styleLayoutDefaults` live in `runtime/` so the renderer shares them without importing the YAML parser.
- [x] `compiler/convert.js`: `app.skin`, the `variant:` key (with `style:` as an alias), `node.style`, a radio group's `itemStyle` cascading to its items, and the compiled skin in the result; `layoutFields.js` takes style sizes as its defaults.
- [x] `generate.js`, `server.mjs`, `build.mjs` pass an asset lister and publish `skin` in the outline; `GET /api/skin-assets` lists the available PNGs for the workbench.
- [x] `compiler/emit.js` writes `app/skin.js` (atlas mode, source ranges stripped, asset-to-PNG trace kept) and `runtime/components.js` accepts `style`.

Verification: `tests/skin.test.js` (13 cases) covers `extends` expansion and inherited marking, asset-to-file traceability with authoring sites, every diagnostic, cycles, a type without a `default`, per-side insets, the resolution chain and its effects, the flags-to-state mapping, layout defaults, the missing-document fallback, both link keys with an unknown variant, and a group variant cascading to its items. Compiler and outline versions were raised to 0.2.0 / 3.

## Phase 3 — Style-driven rendering

- [x] `renderers/canvas/skin.js`: loose and atlas modes behind one `getAsset()`, per-model cache key, a failed image collected and reported rather than fatal.
- [x] `renderers/canvas/assets.js`: a `BitmapFont` per authored font (glyph sheet found at its own asset rect plus the authored offsets), the style table, `styleFor`, and the pre-008 `button`/`panel` fields kept for spec 003's `mount.js`.
- [x] `renderers/canvas/buttonSkin.js`: `resolveStateAsset` chain, overlays only where a stand-in is used, style insets/size/label/focus colour, a visible placeholder for artwork that failed to load, `describeResolution()` for captions.
- [x] `renderers/canvas/mountGeneric.js` draws and measures every node through its own style.

Verification: headless-Chrome scenarios 1, 2, 4 and 5 below.

## Phase 4 — Workbench skin section

- [x] `workbench/skinEdit.js`: replace a scalar, insert an override into a `states:` block, create the block, remove an override; every path refuses a range that no longer holds the expected text.
- [x] `workbench/skinEditor.js`: styles by type and variant, per-state rows (source PNG, drawn result, asset, provenance, picker), the variant by state library, and the used-by list.
- [x] `workbench.html`: third tool tab, a details-panel `style:` row linking both ways, `applySourceEdit` refusing a dirty or stale buffer, read-only on a static host.
- [x] `workbench/stateGallery.js` draws its fixtures with the selected node's own style.

Verification: `tests/skinEdit.test.js` (9 cases) proves comments, order and unrelated lines survive, that each edit compiles back to the intended value, that three edits compose, and that a stale location is refused; scenario 3 below drives the real UI.

## Phase 5 — Documentation and acceptance

- [x] `project/documentation/skin.md`, plus updates to the documentation index, specs index, product steering, `runtime.md`, `compiler.md`, `interactive-workbench.md`, `AGENTS.md` and `project/progress.md`.
- [x] Full unit suite, `node v2/build.mjs`, browser acceptance.

## Evidence

`node --test "v2/tests/*.test.js"`: 125 tests, 123 passing, 2 skipped (the pre-existing Windows symlink skips), up from 97/95 before this spec.

Headless Chrome, 72 checks in six scenarios, all passing (the chrome-devtools MCP browser was unusable again, so the runs used scratchpad CDP scripts, not part of the repository):

| scenario | checks | what it proves |
|---|---|---|
| 1 — development loading | 11 | `app.html` requests 12 individual `src/*.png` and no sheet; loose mode; no missing artwork; font metrics from the skin; play/normal, /hover and /active resolve to the authored assets; each loose asset reports its own file and full-image rect |
| 2 — state artwork | 5 | clicking Play dispatches `transport.toggle` and repaints the button with the green active artwork (mean g-b -12.9 to +0.6), releasing restores the normal artwork exactly; record is inert and unchanged, because its authored action reference does not resolve |
| 3 — workbench Skin tab | 26 | every styled type and variant listed; the 7 state rows with the right PNG, own/inherited/fallback provenance and YAML links; 34 pickable PNGs; the 3x7 variant library with per-cell captions; used-by; the details-panel style row in both directions; a picker edit lands in the buffer only (disk untouched), then Save & Refresh publishes generation 1 and the outline plus the tab show the new artwork |
| 4 — atlas parity | 12 | `app/index.html` and `dist/index.html` (static host rooted at `dist/`) request exactly `atlas.png` + `atlas.json`, no `src/` PNG, no outline, nothing from `workbench/`, `vendor/`, `compiler/` or `/api/`; the Play region is byte-identical across development, generated app and bundle |
| 5 — artwork swap and absence | 7 | overwriting a source PNG changes the app on reload with no build step and restoring it restores the pixels; a state naming a file that does not exist warns in the compiler *and* the loader and draws a red dashed placeholder without throwing, with the rest of the interface intact |
| 6 — static host and no regressions | 11 | served by a plain static host the Skin tab still reads the skin (7 state rows, 21 library cells) with every picker disabled and an explanation, attempts only the live-service probe and throws nothing; spec 003's `preview.html`, which has no authored skin, still renders through the built-in fallback skin from the legacy sprite sheet, requesting no individual PNG and no atlas |

Screenshots reviewed: the development app, the workbench with the Skin tab and the changed line selected, the generated app, the bundle, the swapped artwork and the missing-artwork placeholders. Every file a scenario touched (`skin/default.yaml`, `assets/skin/src/button_inlay.png`) was restored byte for byte and the outline regenerated afterwards.

## Found while building

- **Source offsets were short by each line's indentation.** `compiler/yaml.js` computed every column from the start of a line's *content*, not the line, so an offset on an indented line pointed a few characters early. Nothing noticed while only line numbers were read; the Skin tab's first splice produced `button_inlay_blueay_green`. Fixed, and both the compiler and outline versions were raised because a previously generated outline carries the old offsets.
- **A long-lived page cached the first skin it loaded.** `loadSkin`/`loadCanvasAssets` keyed their cache on the asset base only, so the workbench kept drawing the previous generation's artwork. They now accept a `cacheKey` (the outline's source hash), which the workbench passes and the application never needs.
- **Splicing needs a guard, not optimism.** A stale range is a corrupted source file, so `skinEdit.js` verifies the range still holds the text it expects and `applySourceEdit` refuses a dirty or stale buffer outright.
- **`build dist` could not clear its output folder.** Directory removal fails in this environment (`EPERM`) while file deletion works. Both builds now clear the contents and report that they could not remove the folder itself, rather than failing.

## Known limits

The Skin tab sets a state's artwork; insets, sizes, label placement and font metrics are edited as YAML text. There is no artwork editor, no runtime skin switching and no second skin document. `radioItem/button` differs from `radioItem/default` only in its lit colour, because no other radio artwork was needed yet. The atlas is unhashed and re-packed on every build. Nothing draws the `disabled` state in the current application, so it is exercised through the gallery and the library only.
