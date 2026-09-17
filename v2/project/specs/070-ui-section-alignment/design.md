# 070 — Design

## Overview

```
app.yaml
  normalMainView: visibleWhen removed (main-view.value retired) - always present
    patternSection (new)
      patternSectionDefault (new): editPad, infoBar, patternViewPanel
      sampleEditPanel
    songProperties (bare reference; its own content built out - see below)

components/songProperties.yaml
  height: 160 (step 5) -> 220 (step 7)
  songPropertiesDefault (new): songPatternList
  fileOperationsPanel, optionsPanel, nibblesPanel (new, moved in from app.yaml/normalMainView)

components/nibblesPanel.yaml (new file - extracted from app.yaml's own former inline block)
  visibleWhen: song-properties-view.value oneOf [Nibbles]   (was: main-view.value oneOf [nibbles])

components/controlBar.yaml
  topViewGroup (radioGroup, 3 items) -> topViewButtons (buttonGroup, 3 independent buttons)

components/optionsPanel.yaml
  *Row (7x, horizontal value rows) -> optionsGrid (7 columns, values stacked) + optionsCheckboxRow

components/fileOperationsPanel.yaml
  flat rows -> diskOperationsGrid: actionColumn, targetColumn (From/Save-type, same slot), contentColumn

domain/appView/index.js (new)
  setTopView (step 4, later found buggy) -> toggleFileOperationsView/toggleOptionsView/toggleSampleEditPanel (step 6)

domain/nibbles/index.js
  openNibblesView/showMain: main-view.value -> song-properties-view.value + pattern-section-view.value

domain/diskOperations/index.js
  BROWSER_ROWS_FIELD: hardcoded id fixed twice (steps 2, 8)

compiler/emit.js
  layoutLiteral(): now emits layout.direction (was silently dropped)
  state-field derivation: new "rowList" case (rows.*/scroll.* now registered)

compiler/recipes.js
  CONDITION_FIELD_ALIASES: +3 (step 6, string-valued rules) - unrelated to the "rowList" fix above

runtime/components.js
  component(): layout object now includes .direction too (the same drop, second place)

capabilities.js
  file-operations-view.toggle / options-view.toggle / sample-edit-panel.toggle (step 6, replacing setTopView)
```

## Step-by-step (full detail in `010-port-roadmap/visual-parity-plan.md`, dated entries)

**Step 1 - `editPad` button sizing.** `editPad.yaml`: removed bare `height: fixed` (no `size:`, fell back to a 28px generic default), added `direction: row`. Exposed two real, system-wide compiler/runtime bugs (`compiler/emit.js#layoutLiteral()` and `runtime/components.js#component()` both silently dropped every authored `layout.direction`) - fixed in both places. Also found `normalMainView` itself was missing `height: fill`, so none of its `height: fill` descendants ever received real space; fixing it also fixed two pre-existing `patternViewScreen.test.js` failures as a direct, confirmed side effect.

**Step 2 - File Operations empty list.** Real bug, not a static-serving artifact: `domain/diskOperations/index.js`'s `BROWSER_ROWS_FIELD` hardcoded a stale, one-level-shallow id, **and** `compiler/emit.js`'s state-field derivation switch had no case for `fileBrowser`'s own `"rowList"` behavior, so `rows.*`/`scroll.*` were never registered in any generated `state.js` at all, for any fileBrowser node, since specs 035/036. Both fixed; every fake `app.state` test stand-in never validates field names, which is why this had been invisible until live-browser verification.

**Step 3 - `patternSection` wrapper.** New `patternSection` panel in `app.yaml`, nested inside `normalMainView`, holding `editPad`/`infoBar`/`patternViewPanel` (moved out of `normalMainView`'s own flat stack) plus `sampleEditPanel` as a sibling - matching `_patternPanel`'s own real child order. Real, deliberate behavior change: `infoBar` is no longer independent of `main-view.value`, so it correctly hides during Nibbles (at the time; step 6 later found Nibbles doesn't actually touch this section at all, superseding this specific consequence without reverting the wrapper itself).

**Step 4 - `sampleEditPanel` scoped to the pattern section.** New `patternSectionDefault` wrapper (gated on new field `pattern-section-view.value`, `oneOf: [""]`) holds the default content; `sampleEditPanel` becomes its sibling, re-gated onto the same field (`oneOf: ["Sample Edit"]`). New module `domain/appView/index.js#setTopView` written to keep this and `top-view.value` (File Operations/Options) in sync via one shared command - **later found, in step 6, to be based on a wrong assumption** (see below) and replaced.

**Step 5 - `songProperties` wrapper.** The pre-existing, empty `songProperties.yaml` placeholder given `height: 160` and real content: a new `songPropertiesDefault` wrapper (gated on new field `song-properties-view.value`, `oneOf: [""]`) holding `songPatternList`, moved out of `normalMainView`'s own flat stack. Pure internal restructuring - no visible change.

**Step 6 - song-properties alternates, and the mutual-exclusivity bug.** Researching this step (reading `controlPanel.js` in full) found step 4's own `setTopView` was wrong: v1's three control-bar buttons are independent toggles (confirmed live: File Operations and Sample Edit can both be open at once), not one shared switch. Fixed: `controlBar.yaml`'s `topViewGroup` radioGroup replaced with `topViewButtons`, a `buttonGroup` of three independent buttons; `domain/appView/index.js` rewritten as three independent `toggle*` exports; three new `compiler/recipes.js#CONDITION_FIELD_ALIASES` entries let each button's rule compare a string field to a specific value. Also found and fixed the larger assumption behind spec 048's own original design: Nibbles does not replace the main content area - it shares the song-properties section's own slot (confirmed via `appMainPanel.js`'s own `pluginRenderHook` handler, a live console log, and a screenshot of the actual cramped gameplay). `main-view.value` retired entirely; `nibblesPanel` extracted into its own file, moved inside `songProperties.yaml`, re-gated on the new `song-properties-view.value` field; `domain/nibbles/index.js#openNibblesView`/`showMain` rewritten to write the two real, section-scoped fields, matching v1's own single "main" broadcast (opening Nibbles clears Sample Edit; "Main"/Exit resets both).

**Step 7 - `optionsPanel`'s real column grid.** Read `optionsPanel.js` in full and screenshotted v1's own real panel at two widths: v1's layout is N columns in one row, each a label with values stacked vertically underneath (not the old horizontal-row shape), with any checkbox pinned to one band at the bottom of the whole panel. Found v1's own `optionDefs` array authors a seventh column ("Play from") that **never actually renders**, at any tested width - a real, confirmed v1 quirk, not reproduced (kept as a genuine seventh column in v2 instead of deleting real functionality). Rebuilt as `optionsGrid` (7 `width: fill` columns) + a separate `optionsCheckboxRow` with spacers for columns with no checkbox. Found two more real, confirmed things while fitting this into the existing 160px `songProperties` height: `compiler/convert.js#convertItems()` silently discards any per-item `layout:` override (real, pre-existing, left unfixed - systemic, out of scope); and the real, auto-sized ~20px controls this engine renders (unlike v1's own hand-tuned pixel-perfect widgets) genuinely don't fit in 160px for the tallest column - fixed by raising `songProperties.yaml`'s height to 220px, a deliberate, documented deviation.

**Step 8 - `fileOperationsPanel`'s real column grid, and the `BROWSER_ROWS_FIELD` bug again.** Read `diskOperations.js` and its four sub-panels in full: v1's real layout is four columns (Action, Type, From/To, content) - v2 has never built the "Type" selector, so building one now would be new functionality, not restructuring; left out, a real three-column result. Rebuilt as `diskOperationsGrid` (`actionColumn`, `targetColumn` holding "From" and "Save type" as two alternates in the same slot, `contentColumn`). Found, live, the exact same defect class step 2 already fixed once: `BROWSER_ROWS_FIELD`'s hardcoded id had gone stale again (twice over - step 6's move into `songProperties`, and this step's own deeper nesting) - fixed the constant and its 10 matching test occurrences again. Re-checked `nibblesGrid`'s own sizing as asked: v1 itself derives it dynamically from its render target's real height, never a hardcoded pixel value, so v2's existing `width/height: fill` already matches - no change needed.

## Testing strategy

Every step: `computeGenericLayout` against the real, compiled `app.yaml` first (this port's own established headless convention), then live in a real Chromium browser via Playwright - the only way several of this spec's own real, confirmed bugs (the `rowList` state-registration gap, `BROWSER_ROWS_FIELD` staleness twice, the mutual-exclusivity bug, the `optionsGrid` overflow) were ever actually caught, since none of them were visible to `computeGenericLayout` or the fake, non-validating test stores alone. Every pre-existing test a step's own restructuring broke was traced individually and fixed to match the real, new, correct shape - never blanket-patched - the same discipline this whole port has used since spec 048's own first structural move.

## What this deliberately does not do

See requirements.md's own Scope boundaries: no net-new content (logo/tracker banners, mod-name input, instrument listbox, pattern sidebar, `TrackControl`, piano's responsive shrink), no section reordering, no fix for `convertItems()`'s own per-item layout gap or `domain/diskOperations/index.js`'s own hardcoded-id fragility - all real, confirmed, and recorded, not overlooked.
