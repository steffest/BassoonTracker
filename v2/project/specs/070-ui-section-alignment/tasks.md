# 070 — Tasks

Status: done (retroactively registered - carried out and verified 2026-09-16 under `010-port-roadmap/visual-parity-plan.md` before this spec folder existed).

- [x] Live-browser visual-parity audit (Playwright, both apps) - first live-browser pass this whole port has done; found and corrected one wrong initial assumption (v1 has floating overlay panels) before any fix work started - see `../ui-layout-model.md`.
- [x] Real section map fact-checked against v1 source in full (`appMainPanel.js`, `controlPanel.js`, `patternPanel.js`, `layout.js`, `mainPanel.js`).
- [x] Step 1: `editPad.yaml` button sizing; `compiler/emit.js#layoutLiteral()` and `runtime/components.js#component()` both fixed to stop dropping `layout.direction`; `normalMainView` given `height: fill`.
- [x] Step 2: File Operations empty-list bug - `domain/diskOperations/index.js#BROWSER_ROWS_FIELD` id fixed; `compiler/emit.js` gained a `"rowList"` state-field case.
- [x] Step 3: `patternSection` wrapper (`app.yaml`), `editPad`/`infoBar`/`patternViewPanel` nested inside it.
- [x] Step 4: `sampleEditPanel` scoped to a new `pattern-section-view.value` field; `domain/appView/index.js` created (`setTopView`, later replaced in step 6).
- [x] Step 5: `songProperties.yaml` given real content (`songPropertiesDefault` + `songPatternList`), height 160.
- [x] Step 6: found and fixed step 4's own mutual-exclusivity bug (three independent buttons, not one radioGroup); `song-properties-view.value` introduced; `nibblesPanel` extracted to its own file and re-scoped into `songProperties`; `main-view.value` retired.
- [x] Step 7: `optionsPanel.yaml` restructured into v1's real column grid (7 columns incl. one deliberate v2-only addition); `songProperties.yaml` height raised 160 -> 220 to fit it without clipping.
- [x] Step 8: `fileOperationsPanel.yaml` restructured into a 3-column grid; `BROWSER_ROWS_FIELD` fixed a second time (staleness recurred after steps 6 and 8 both moved the node it names).
- [x] Every pre-existing test each step broke traced and fixed individually (never blanket-patched) - `compiler.test.js`, `emit.test.js`, `nibbles.test.js`, `nibblesMainView.test.js` (rewritten in step 6), `patternViewScreen.test.js`, `pianoScreen.test.js`, `envelopeScreen.test.js`, `saveExportScreen.test.js`, `server.test.js`, `yaml.test.js`, `diskOperations.test.js`.
- [x] `node --test tests/*.test.js` passes after every step.
- [x] `node compiler/generate.js`: 12 warnings throughout, unchanged.
- [x] `node build.mjs app`/`dist`: succeeds after every step; loose ends settled at 99.
- [x] `v2/project/progress.md`: one dated entry per step (eight total).
- [x] `v2/project/specs/010-port-roadmap/visual-parity-plan.md`: each of the eight steps marked done in place with its full technical finding.
- [x] Retroactively registered as spec 070 (this folder) once the earlier "spec 069" mislabeling in code comments was found and corrected - see "Found while doing it."
- [x] `v2/project/specs/index.md`: this entry added.

## Verification plan

The same `computeGenericLayout`-against-the-real-compiled-`app.yaml` convention every prior spec in this port has used, **plus**, for the first time, live verification in a real Chromium browser via Playwright (available in this environment despite every prior spec's own recorded assumption otherwise). Both were required for every step - several of this spec's own real, confirmed bugs were invisible to the headless convention alone.

## Evidence

- Full suite: `node --test tests/*.test.js` → 960/960 passing (958 before this spec's own work began + 2 net across eight steps' own test additions/removals).
- `node compiler/generate.js`: 12 warnings, unchanged across all eight steps.
- `node build.mjs app`: loose ends moved 103 → 99 across the eight steps (step 6 replaced three would-be mocked commands with three real ones; step 7/8 added no new loose ends). `node build.mjs dist` succeeds throughout.
- Live-browser screenshots taken and inspected at every step (Sample Edit + File Operations open simultaneously; Nibbles cramped into the song-properties strip with the pattern section untouched underneath; `optionsPanel`'s real 7-column grid; `fileOperationsPanel`'s Load/Save column grid with Bassoon's module list populating) - none committed to the repository (ad hoc, `/tmp`-only, per this whole effort's own convention).

## Found while doing it

- **Two real, system-wide compiler/runtime bugs** (step 1): `compiler/emit.js#layoutLiteral()` and `runtime/components.js#component()` both silently dropped every authored `layout.direction` in the entire generated application - confirmed by grepping every emitted file for one occurrence and finding it only inside an unrelated `breakpoints` blob.
- **A real, foundational state-registration gap** (step 2): `compiler/emit.js`'s own state-field derivation switch never had a case for `fileBrowser`'s own `"rowList"` behavior, so no file-browser's `rows.*`/`scroll.*` field had ever been registered in any generated `state.js`, for any fileBrowser node, since the type was first built (specs 035/036) - invisible until now because every test's own fake `app.state` never validates field names the way the real store does.
- **A real, confirmed bug in step 4's own, already-"done" work** (found while researching step 6): v1's three control-bar buttons are independent toggles, not one mutually-exclusive radioGroup - confirmed live (File Operations and Sample Edit both open at once). Flagged to the user mid-session; user chose to fix it as part of step 6 rather than defer it.
- **A larger, second wrong assumption, from spec 048 originally** (also found in step 6): Nibbles does not replace the whole main content area - it shares the song-properties section's own bounded 160px (later 220px) slot, confirmed via source, a live console log, and a screenshot of the actual cramped gameplay.
- **A real v1-only quirk** (step 7): `optionsPanel.js`'s own `optionDefs` array authors a seventh column ("Play from") that never actually renders, at any tested width - a genuine, pre-existing limitation in v1 itself, not reproduced.
- **A real, pre-existing compiler limitation** (step 7): `compiler/convert.js#convertItems()` hardcodes every radioGroup/buttonGroup item's own `layout` to a fixed default, silently discarding any per-item override - confirmed by tracing why an attempted fix had zero effect. Left unfixed (systemic, out of this spec's own scope).
- **The identical stale-hardcoded-id defect, found twice** (steps 2 and 8): `domain/diskOperations/index.js#BROWSER_ROWS_FIELD` hardcodes a full node-id string rather than deriving it, so it silently breaks every time the node it names moves - something this spec's own restructuring did repeatedly. Fixed reactively both times; the structural fix (deriving the id) remains a real, recorded, open gap.
- **A documentation-hygiene error, found while starting spec 071's own research**: every one of the eight steps' own code comments cited "spec 069's own UI-alignment pass" - but spec 069 is a real, different, already-completed feature (`069-disk-operations-playlists`). This whole effort had never actually been registered as its own numbered spec; corrected by creating this folder retroactively and fixing the ~16 mislabeled comments across 10 files (`capabilities.js`, `domain/{appView,nibbles}/index.js`, and seven test files) to say "spec 070" instead.

## Known limits

Section reordering (v1's own real top-to-bottom order - menu, song properties, control bar, pattern, piano - vs. v2's song-properties section still rendering at the bottom) was never part of any of the eight steps' own scope; every step fixed scoping/independence, not position. `compiler/convert.js#convertItems()`'s own per-item layout limitation and `domain/diskOperations/index.js`'s own hardcoded-id fragility both remain open, real, systemic gaps. No net-new content (logo/tracker banners, mod-name input, instrument listbox, pattern sidebar, `TrackControl`, piano's responsive shrink) was built - see `010-port-roadmap/visual-parity-plan.md`'s own steps 9-12, each its own later initiative.
