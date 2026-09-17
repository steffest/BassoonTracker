# 071 — Tasks

Status: implemented and verified.

- [x] Read `appMainPanel.js` in full for this spec's own specific detail (logo/corner/tracker, mod-name box, six spinboxes, instrument listbox) - spec 070's own reading was for section-level structure, not this.
- [x] Read `script/src/editor.js`'s own `addToPatternTable`/`removeFromPatternTable` (372-416) and `script/src/ui/app/components/songPatternList.js` in full - found `songPatternList.yaml`'s own listbox/four buttons are still 100% static/mocked, a real, pre-existing, closely-related gap.
- [x] Researched the dynamic-row-list mechanism (`listController.js` vs `fileBrowserController.js`/`drawKinds.js`) - confirmed `fileBrowser`'s own `rowList` behavior is the only mechanism that supports a variable-length, data-bound, click/double-click row list; confirmed the real row shape (`{title, ...}`, not `{label, ...}`) directly off the draw kind rather than trusting a paraphrase.
- [x] Confirmed `skin/src/logo_grey_70.png`/`logo_colour_70.png`/`togglecorner.png`/`tracker.png` all exist as real source PNGs.
- [x] Confirmed cross-domain calls through a sibling's own public `index.js` door are an established, unrestricted pattern (`domain/sampleEditor` already reaches `domain/song` this way) - `tests/domainBoundary.test.js` only restricts direct `engine/` access, not index-to-index calls.
- [x] User scoping decision: one spec, build mod-name input + all six spinboxes + instrument listbox (select + double-click, no drag-reorder) + decorative banners, in full.
- [x] User decision: `domain/playback`'s own `loadModule`/`openFiles` call `domain/song`'s own `publishSongProperties(app)` directly - a second, narrow, documented exception to the existing "don't import domain/song from domain/playback" comment.
- [x] `requirements.md` and `design.md` written and reviewed against the research above.
- [x] `domain/song/index.js`: pattern-table mutation primitives (`addToPatternTable`/`removeFromPatternTable`/`incrementPatternTableEntry`/`decrementPatternTableEntry`), row publishers (`publishSongPatternRows`/`publishInstrumentRows`), six spinbox capabilities, `publishSongProperties`.
- [x] `domain/song/format.js` (new): `formatInstrumentIndex`, ported verbatim (including its real, faithful double-space quirk - see Found while doing it).
- [x] `domain/playback/index.js`: `STATE_FIELDS.bpm`, `setBPM`, `setSongTitle`, load-time `publishSongProperties` call in both `loadModule` and `openFiles`.
- [x] `domain/sampleEditor/index.js`: `setInstrumentName` also republishes instrument rows.
- [x] `components/instrumentList.yaml` (new): `fileBrowser`, `change: setInstrumentRow`, `doubleClick: openInstrumentInSampleEditor`.
- [x] `components/songPatternList.yaml`: listbox -> real `fileBrowser`, four buttons wired to real capabilities.
- [x] `components/songProperties.yaml`: banner row, mod-name input, instrument list, the two three-spinbox columns and the song/pattern list, all placed inside `songPropertiesDefault`.
- [x] `capabilities.js`: all new command mappings, confirmed against the real compiled command names (not the design doc's own guessed ones) before finalizing.
- [x] Tests: `domain/song`, `domain/playback`, `domain/sampleEditor` (extended); `tests/server.test.js`, `tests/compiler.test.js`, `tests/skin.test.js` extended for the asset-registration fix; `tests/nibblesMainView.test.js`/`tests/patternViewScreen.test.js` updated for the new nested ids.
- [x] `node --test tests/*.test.js` passes (985/985).
- [x] `node compiler/generate.js`: 12 warnings, unchanged from before this spec - none new.
- [x] `node build.mjs app`/`dist`: succeeds; loose ends reviewed (96, unchanged from spec 070's own count).
- [x] Live-browser verification (Playwright): mod-name typing, the bpm spinbox stepper, instrument select + double-click opening the sample editor, the song/pattern list's own Ins button all producing a real, visible effect, with no console errors.
- [x] `v2/project/progress.md`, `v2/project/specs/index.md`: recorded.

## Layout follow-up (found live, fixed in the same spec)

Verifying this content live surfaced a real layout gap the design doc did not anticipate: `songPropertiesDefault`'s fixed 220px height cannot fit banner row + mod-name box + instrument list + six spinboxes + the song/pattern list's own four buttons stacked in one column - two of those four buttons (Ins/Del) rendered below the panel's own clipped bottom edge. Checked against v1's real source (`script/src/ui/app/appMainPanel.js:319-397`): v1 never stacks this content in one column at all - at its own real ≥620px width it spreads four groups across four side-by-side columns, collapsing (`script/src/ui/app/layout.js:111-113`) to a tab-switched single subview only below 620px width. Asked the user how to proceed (three options: compact single column, rebuild v1's exact multi-column layout, or ship as a known gap); the user chose to rebuild the real column layout, then refined it further: not a rigid 4-column-or-bust switch, but "columns when there's room, stacking when there isn't, scrollable as a last resort."

Implemented entirely with existing, already-tested mechanisms - no new layout-engine capability was needed:
- `songPropertiesDefault` changed from `panel` to `viewport` (spec 013's scrolling clip box) - its first real use in any compiled component tree. In wide mode everything fits and nothing scrolls; in narrow/stacked mode it scrolls.
- A new `songPropertiesLayout` wrapper panel holds four groups in v1's own left-to-right order (song/pattern list, two three-spinbox columns, logo/tracker+mod-name+instrument list), `direction: row` by default.
- A `breakpoints: [{maxWidth: 620, layout: {direction: column}}]` on that wrapper (spec 025's mechanism, already used by `controlBar.yaml`) switches it to a single stacked column below v1's own real 620px threshold.

Verified live at both 1280px (four columns, all four song/pattern-list buttons visible, no scrolling) and 500px (single stacked column, scrollbar appears, wheel scrolling reveals every group down to the instrument list) - zero console errors either way.

## Verification plan

Executed per this port's established two-part convention: `computeGenericLayout` against the compiled outline (id/rect checks in the extended screen tests), then live in a real Chromium browser via Playwright (module load, mod-name edit, spinbox stepper, instrument select/double-click/sample-editor-open, song/pattern-list Ins, and the wide/narrow/scroll layout checks above).

## Evidence

- `node --test tests/*.test.js`: 985/985 passing.
- `node compiler/generate.js`: 12 warnings (pre-existing, unchanged).
- `node build.mjs dist`: succeeds; atlas correctly packs `logo_grey_70`/`logo_colour_70`/`togglecorner`/`tracker`.
- 96 loose ends (unchanged from spec 070).
- Playwright screenshots (not committed, `/tmp/spec071-*.png` during this session): logo toggle, instrument double-click opening Sample Edit, mod-name live edit, bpm stepper, Ins button, wide four-column layout, narrow stacked+scrolled layout.

## Found while doing it

- `components/songPatternList.yaml`'s own listbox and four buttons (`incrementPattern`/`decrementPattern`/`insertPattern`/`deletePattern`) were 100% static/mocked placeholder content, never wired to the real song's pattern table - closed as a necessary side effect of building Song Length's own spinbox correctly (see requirements.md).
- `domain/song/index.js`'s own header comment explicitly recorded "pattern-table sequence... out of scope" as a spec-028-time decision - this spec is the point at which that scope naturally expanded, the same way `domain/sampleEditor` grew across five later specs.
- **Asset pipeline gap**: `compiler/skin.js#compileSkin()` only ever scanned skin.yaml's own style `states:` blocks for asset references, never the compiled app tree - so an asset referenced only through a plain `image`/`icon` node's own `src`/`icon` property (not through a skin style) was silently never packed into `node build.mjs dist`'s release atlas, though it rendered fine in dev mode. Confirmed empirically (`togglecorner`/`tracker` were missing from `atlas.json`, the two logo variants - referenced via a skin style - were not). Fixed with a new `registerAssetUse`/`assetPropertyOf` mechanism (a declarative `assetProperty` on `icon`/`image` in `componentTypes.js`, read generically in `compiler/convert.js` - no type-name branch, so `tests/componentTypes.test.js`'s architecture-enforcement test still passes).
- **Three-layer label-fallback bug**: an intentionally empty `label: ""` (the logo button, which must show only its artwork) still rendered its own authored name on top of the artwork. Traced through three independent, previously-uncoordinated fallback-to-name layers - `compiler/convert.js#applyLabel` (compile time), `renderers/canvas/mountGeneric.js#labelText()` (draw time), and `runtime/components.js#component()`'s own `labelVariants(props.label, props.name)` plus `compiler/emit.js`'s decision of whether to even emit a `label:` prop - all three needed fixing/coordinating.
- **Skin-style size not a layout default**: the `logo` button variant's own skin-declared `width: 70, height: 50` only applies to a type's "default" variant, not an arbitrary one - the logo rendered clipped to the ordinary button default size until `layout: {width: 70, height: 50}` was also authored directly on the node.
- **fileBrowser selection-field emission gap** (found live double-clicking the instrument list, not by any of the 985 existing tests): `runtime/valueController.js#valueFieldOf(node)` is supposed to be one function both compile time and runtime agree on, but its second resolution step - a `change` action's own recipe-derived `mockField` - reads `node.bindings`, which exists on the compiler's own AST node but is never carried onto the tree `runtime/components.js#component()` builds from generated code. A `fileBrowser` authored with a `change` action but no explicit `field:` (`instrumentList`, `songPatternList`'s `list`, and the pre-existing disk-operations `browser`) compiled its state field one way (e.g. `"instrument-row.value"`, found via the binding) while the real renderer's own `valueFieldOf(runtimeNode)` call - same function, no bindings to find - fell through to `"value.<id>"`, a field nothing ever declared; every real pointerup on such a row threw `"state field ... is not declared"` and silently dropped the write. No existing test caught this because a domain test dispatches its capability directly with an explicit `detail.value`, never touching the renderer's own store write. Fixed in `compiler/emit.js`: a `rowList`-behavior node with no authored `field:` now emits the compile-time-resolved name explicitly as `field:`, exactly like every other authored value control already does once it has *any* explicit `field:` of its own.

## Known limits

Drag-to-reorder for the instrument listbox is not built (explicit scope decision). The tracker banner's own dynamic version-text overlay is not reproduced pixel-for-pixel. `UI.setInfo()`'s own status-bar echo has no v2 equivalent to write into. The narrow/stacked layout scrolls rather than v1's own real tab-switch between the four groups - a deliberate, user-directed improvement over v1, not an oversight.
