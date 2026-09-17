# 070 — UI section alignment

Date: 2026-09-16. Kind: feature. Status: specified (retroactively registered - the eight steps below were carried out under `010-port-roadmap/visual-parity-plan.md` before this spec folder existed; see that document for the full, dated, step-by-step audit trail this summarizes). Continues the [port roadmap](../010-port-roadmap/requirements.md)'s own visual-parity effort.

## Purpose

A visual-parity audit (Playwright screenshots of both apps side by side, the first live-browser verification pass this whole port has done - every prior spec's own headless-only convention had never caught what a real screenshot immediately showed) found v2's main screen did not match v1's real structure: several regions that belong inside one of v1's five fixed sections were instead flat, unscoped siblings sharing one large stack, and one basic finding (v1 has no floating overlay panels at all - every section swaps its own content in place) was initially got wrong and had to be corrected by the user before any fix work started (see `../ui-layout-model.md`, the resulting steering doc).

This spec closes that gap structurally, without adding any content v2 did not already have: each of v1's five real sections (menu bar, song properties, control bar, pattern, piano) becomes a genuine, bounded region in `app.yaml`, and everything that visually lives inside one gets nested inside it, matching v1's own real ownership.

## What v1 actually does (read from source, not assumed)

The full section map - fact-checked by reading `appMainPanel.js` (509 lines), `controlPanel.js` (398), `patternPanel.js` (336), `layout.js` (153), `mainPanel.js` (230) in full, and confirmed live wherever the reading alone left something ambiguous - lives in `010-port-roadmap/visual-parity-plan.md`'s own "real section map" table. The two findings with the widest blast radius, both confirmed live before any fix was written:

- **The control bar's File Operations/Options/Sample Edit "switch" is not one mutually-exclusive control.** `controlPanel.js` builds three independent `Checkboxbutton`s, each with its own onDown handler. File Operations/Options share one slot (`appMainPanel.js`'s own `_currentView`); Sample Edit lives in a second, completely independent slot (`patternPanel.js`'s own `currentView`). Confirmed live: opening Sample Edit, then clicking File Operations, leaves **both open at once** - a screenshot no single shared command could ever produce.
- **Nibbles does not replace the main content area.** `appMainPanel.js`'s own `pluginRenderHook` handler (`target: "main"`) creates a custom render panel sized to `appMainPanel`'s own dimensions - the same fixed, bounded song-properties strip File Operations/Options already share, not the whole screen. Confirmed three ways: reading the handler itself; the real, live console log while opening Nibbles in v1 (`"Set Nibbles render target to {width:1200, height:160}"`); and a screenshot of the actual, playable game genuinely cramped into that one strip, with the control bar/edit pad/scopes/pattern grid all still visible underneath.

## Decisions and assumptions

- **Pure restructuring, no new content.** Every one of the eight steps below uses only YAML/fields/commands v2 already had, just re-scoped and re-nested to match v1's real ownership. Net-new content v1 has that v2 has never built (the logo/tracker banners, the mod-name inputbox, the instrument listbox, the pattern-sidebar song browser, per-track `TrackControl`, the piano's responsive height shrink) is deliberately out of this spec's scope - each is its own later, larger initiative (see `010-port-roadmap/visual-parity-plan.md`'s own steps 9-12).
- **Two real, confirmed compiler/runtime bugs, not just YAML mistakes, were found and fixed along the way** (not anticipated - found only because this spec's own live-browser verification, not the headless-only convention every prior spec had used, caught them): `compiler/emit.js#layoutLiteral()` and `runtime/components.js#component()` both silently dropped every authored `layout.direction` from the entire generated application, and `compiler/emit.js`'s own state-field derivation switch never had a case for `fileBrowser`'s own `"rowList"` behavior, so no file-browser's `rows.*`/`scroll.*` field had ever been registered in any generated `state.js` since the type was first built.
- **A recurring defect class, found twice in this spec alone (steps 2 and 8):** `domain/diskOperations/index.js`'s own `BROWSER_ROWS_FIELD` hardcodes a full node-id string rather than deriving it, so it silently goes stale every time the node it names moves - something this spec's own restructuring did repeatedly. Left unfixed structurally (a real, recorded, still-open gap) since fixing it generically was judged out of this spec's own scope both times it was found.
- **One real, confirmed layout-engine limit found (step 7), left unfixed as out of scope**: `compiler/convert.js#convertItems()` hardcodes every radioGroup/buttonGroup item's own `layout` to a fixed default, silently discarding any per-item `layout:` override an author writes - a systemic gap affecting every radioGroup/buttonGroup in the whole application, not just the one this spec's own step 7 hit.
- **Two deliberate, documented deviations from v1's own exact numbers**, both because v2's generic, auto-sized controls need more room than v1's own hand-tuned pixel-perfect widgets: `songProperties.yaml`'s own fixed height grew from 160px (step 5, matching v1's own default) to 220px (step 7, to fit `optionsPanel`'s own real column grid without clipping). `optionsPanel.yaml` also kept a real, working "Play from" column v1's own source defines but - confirmed live, at two different widths - never actually renders; deleting genuinely-working v2 functionality to match a v1 bug was rejected.

## User stories and acceptance

- **UISEC-001 — `editPad`'s buttons render at a real, usable size.** Fixed via the `layout.direction` compiler/runtime bug above; verified by screenshot.
- **UISEC-002 — File Operations' module/sample/playlist lists populate.** Fixed via the `rowList` state-field bug above; verified live (Bassoon's curated list, and spec 069's own Playlists list, both populate with no console errors).
- **UISEC-003 — The pattern section (`editPad`/`infoBar`/`patternViewPanel`/`sampleEditPanel`) is a real, bounded wrapper**, nested inside `normalMainView`, matching `_patternPanel`'s own real child ownership - not a set of independent regions sharing `normalMainView`'s own flat stack.
- **UISEC-004 — `sampleEditPanel` is scoped to the pattern section's own alternate field** (`pattern-section-view.value`), independent of the song-properties section's own switch.
- **UISEC-005 — The song-properties section (`songPatternList`/`fileOperationsPanel`/`optionsPanel`/`nibblesPanel`) is a real, bounded wrapper**, matching `_appPanel`'s own real child ownership.
- **UISEC-006 — File Operations/Options/Nibbles are three independent, correctly-scoped alternates** of the song-properties section's own field (`song-properties-view.value`), matching v1's own three-`Checkboxbutton` shape exactly - including that Sample Edit can be open at the same time as either of them, and that opening Nibbles closes Sample Edit (v1's own single "main" broadcast reaching both sections at once).
- **UISEC-007 — `optionsPanel`'s content matches v1's real column grid** (values stacked vertically under each label, a checkbox row aligned beneath, seven columns rather than v1's six real ones - the seventh a documented, deliberate v2 addition).
- **UISEC-008 — `fileOperationsPanel`'s content matches v1's real column grid** (Action / target-or-save-type / content - three columns, not v1's real four, since v2 has never built the "Type" selector v1's fourth column needs).
- **UISEC-009 — No regressions.** Full unit suite passes after each of the eight steps; `node compiler/generate.js` reports no new warnings beyond each step's own recorded, deliberate changes; `node build.mjs app`/`dist` both succeed.

## Non-functional requirements

- Every step verified two ways: `computeGenericLayout` against the real, live, compiled `app.yaml` (this whole port's own established convention since spec 019), **and**, for the first time in this port, live in a real Chromium browser via Playwright (available in this environment despite every prior spec's own recorded assumption otherwise - see `010-port-roadmap/visual-parity-plan.md`'s own "How to reproduce this audit" section) - several of this spec's own real, confirmed findings (the `rowList` state bug, the `BROWSER_ROWS_FIELD` staleness twice, the mutual-exclusivity bug, the `optionsGrid` overflow) were invisible to the headless convention alone and only surfaced this way.
- No git commit created for any of the eight steps (explicit, standing instruction for this whole effort).

## Scope boundaries

In scope: `app.yaml`, `components/{editPad,infoBar,patternViewPanel,sampleEditPanel,songProperties,songPatternList,fileOperationsPanel,optionsPanel,controlBar,nibblesPanel}.yaml`; `compiler/{emit.js,recipes.js}`; `runtime/components.js`; `domain/{appView,nibbles,diskOperations}/index.js`; `capabilities.js`; the test files each step's own restructuring touched.

Out of scope, recorded rather than silently dropped (steps 9-12 of `010-port-roadmap/visual-parity-plan.md`, each its own later, separate, larger initiative):

- The song-properties section's own missing content: logo/tracker-wordmark banners, the mod-name inputbox, the instrument listbox.
- The pattern-sidebar song browser (`patternSidebar.js`) - a `TabPanel` with Songs/Samples/Playlists, transport controls, and the piano-toggle button. No v2 equivalent exists at all yet; the single largest net-new piece this whole visual-parity effort has found.
- Per-track `TrackControl` (the S/M/FX header on the classic pattern grid).
- The piano section's own responsive height shrink (200/150/100 by window height, vs. v2's fixed 200).
- Reordering the five sections to match v1's own real top-to-bottom order (menu, song properties, control bar, pattern, piano) - v2's own song-properties section still renders at the bottom of the screen, below the pattern section, not directly under the menu bar. Every step in this spec fixed *scoping and independence*, not *position*; repositioning was never part of any of the eight steps' own stated scope.
- Fixing `compiler/convert.js#convertItems()`'s own per-item `layout` limitation, and `domain/diskOperations/index.js`'s own hardcoded-id fragility - both real, confirmed, and recorded, but systemic changes with a blast radius wider than any single step here.
