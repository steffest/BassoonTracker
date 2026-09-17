# 053 — The multitrack screen

Date: 2026-09-15. Kind: feature. Status: specified. Closes the multitrack arrangement view's own three-part arc within package **P11** (the remaining specialized surfaces) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 051 (the headless engine) and spec 052 (the interactive leaf). Places `multitrackView` into the real component tree for the first time - the same "mechanism, then interactive leaf, then screen" pattern loop creator (043/044/045) and Nibbles (047/048/049) already completed.

## Purpose

Specs 051/052 built everything `multitrackView` needs to be useful - segmentation, mute/solo, move-note, scroll/zoom, the live oscilloscope and the per-track control strip - but it is registered, not placed anywhere `app.yaml` reaches. This spec places it.

## What v1 actually does, and what this narrows out (read from source, not assumed)

v1's multitrack view is not its own screen: it is the *alternate* content of the same area the classic, column-based pattern grid (`patternView.js`) occupies, toggled by two icon buttons in `controlPanel.js` ("Column view" -> `EVENT.showView("main")`, "Row view" -> `EVENT.showView("multitrack")`, 126-177), each hiding the other (`patternPanel.js`'s own `EVENT.showView` handler, 275-314: `case "multitrack": ... patternView.hide(); ... multitrackView.show();`). The per-track solo/mute/record header above the classic grid (`trackControl.js`) is a *different*, smaller component from `multitrackView`'s own control strip (`dawtrack.js`, already built in spec 052) - the same mute/solo mechanism (`domain/arrangement`, spec 051), a second, simpler consumer of it.

**This is the real narrowing this spec must make, confirmed by reading `app.yaml` and every existing pattern-adjacent component file (`editPad.yaml`, `songPatternList.yaml`, `songProperties.yaml`) rather than assumed**: v2 has never authored the classic column-based pattern grid into any screen at all. `patternGrid` (spec 030) and keyboard note entry (spec 031) built the mechanism; "authoring `patternGrid` into `app.yaml`'s actual pattern-panel screen" was recorded as unallocated after spec 031 and no later spec closed it - P10 and Nibbles filled the packages in between. There is, today, no classic grid screen for a "row/column view toggle" to toggle *away from*, and no classic-grid header (`trackControl.js`) screen to place a second mute/solo consumer *beside*.

## Decisions and assumptions

- **`multitrackView` is placed on its own, always shown, with no view-style toggle.** Building a toggle between "column view" and "row view" when the column view itself does not exist would be either a dead control (nothing to switch to) or would require this spec to also build the classic grid screen - a real, substantial, unrelated piece of P7's own leftover work, not P11's. The toggle button pair (`controlPanel.js`'s own "Column view"/"Row view" icons) is recorded as blocked on that gap, not built here.
- **The classic grid's own smaller mute/solo header (`trackControl.js`) is not built**, for the identical reason - it has no screen to attach above. `domain/arrangement`'s mute/solo functions already have their first real consumer (`multitrackView`'s own control strip, spec 052); a second consumer arrives only once the classic grid screen does.
- **No View-menu entry.** v1's own toggle lives in `controlPanel.js`, not any menu, and with no alternate view to switch to or from, a menu action here would have nothing meaningful to do either.
- **Placement: a new `multitrackPanel.yaml`, one more sibling inside `normalMainView`'s existing content list** (`fileOperationsPanel`, `optionsPanel`, `sampleEditPanel`, `editPad`, `songPatternList`, `songProperties` - spec 048), between `editPad` and `songPatternList` - the same conceptual slot v1's own main editing area occupies, between its control-panel row and its lower info panels. No `visibleWhen` gate: `editPad`/`songPatternList`/`songProperties` already have none (spec 048's own precedent - only the three panels with their own `top-view.value` overlay condition do), so neither does this.
- **No new `capabilities.js` mapping.** `multitrackView`'s own controller already calls `domain/song`/`domain/arrangement` directly for every gesture it handles (spec 052) - unlike Nibbles' own screen (spec 049), which needed several *surrounding* ordinary controls (score/lives labels, a difficulty `radioGroup`, toggle checkboxes, a primary button) around a leaf that draws only its own playing field, `multitrackView` already draws its own control strip, blocks, effects and scope inline. Nothing ordinary needs authoring around it at all - confirmed by re-reading spec 052's own requirements.md before assuming otherwise.

## User stories and acceptance

- **SCREEN-001 — `multitrackView` renders, in place, sized to fill its own panel.** `computeGenericLayout()` against the real, compiled `app.yaml` places `multitrackPanel`'s own `multitrackView` node with a non-zero width/height, visible whenever `main-view.value` is `""` (the same condition `normalMainView` itself already has). Acceptance: a layout-integration test mirroring spec 048's own `tests/nibblesMainView.test.js` convention.
- **SCREEN-002 — No regressions.** Full unit suite passes; `node compiler/generate.js` shows no new warnings; `node build.mjs app` succeeds, with no new `mocked-command`/`unresolved-*` entries (this spec authors no command at all).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).

## Scope boundaries

In scope: `project/specs/application/current/components/multitrackPanel.yaml` (new), `app.yaml`'s `normalMainView.content` (one new entry), and a layout-integration test.

Out of scope, recorded rather than silently dropped:

- **The classic, column-based pattern grid's own screen** - `patternGrid`/keyboard note entry (specs 030/031) remain implemented but unauthored, exactly as they were before this spec; closing that gap is a P7 cleanup, not P11's.
- **The row/column view toggle** (`controlPanel.js`'s own two icon buttons) and **the classic grid's own smaller mute/solo header** (`trackControl.js`) - both blocked on the gap above.
- **A View-menu entry** - nothing to toggle to or from.
- **The scopes and VU meters** - P11's remaining two surfaces, a later spec's own.
