# 003 — Tasks and outcome

## Phase 1 — Schema, entry points, validation and state (IMPLEMENTATION-PLAN.md steps 1-3)

Goal: a deterministic path from a JSON specification document to a component tree, with an explicit store/dispatcher, reachable from direct-source entry points.

- [x] Define schema version 1 (`state.fields` + `view`) and write the transport/instrument-list example against it.
- [x] Create `v2/dev.html` (isolated-iframe workbench shell) and `v2/preview.html` (standalone runtime entry), both `type="module"`.
- [x] Implement `runtime/validate.js`: schema/type/id/reference checks, collected path-qualified diagnostics, no fail-fast on first error.
- [x] Implement `templates/editor-workspace.js` and `runtime/normalize.js`: deterministic expansion, rule id and path preserved per node.
- [x] Implement `runtime/store.js` (field-scoped subscriptions) and `runtime/commands.js` (registry + dispatcher with enablement).
- [x] Implement `runtime/uiCommands.js` (generic `ui.toggleSecondaryDrawer`) and `domain/mockTracker.js` (mock Play/Stop/select/sample-editor-open commands and initial state).
- [x] Write dependency-free tests (`node:test`) for validate/normalize/store/commands covering acceptance and rejection cases.

User verification: `node --test v2/tests` passes; opening `v2/preview.html` from a plain static server shows a loading state, then the mounted screen or an actionable validation error.

## Phase 2 — Shared layout and the canvas renderer (IMPLEMENTATION-PLAN.md step 4)

Goal: the example is visible and operable on canvas at wide and narrow widths.

- [x] Audit legacy bitmap-font, scale-9 and listbox rendering (recorded in `project/documentation/runtime.md` with source provenance).
- [x] Implement `runtime/layout.js`: row layout, padding/gaps, remaining-space allocation for the instrument list, and the explicit narrow-width drawer fallback.
- [x] Port `renderers/canvas/bitmapFont.js`, `renderers/canvas/scale9.js` and `renderers/canvas/skin.js` from the legacy implementation; copy `assets/skin/spritesheet_v6.png` and `assets/skin/spritemap_v6.json`.
- [x] Implement `renderers/canvas/mount.js`: panel/label/button/listbox drawing, a semantic DOM overlay carrying focus/activation/accessible names, RAF-coalesced redraw, and resize handling.
- [x] Manual verification pass: pointer and keyboard activate Play/Stop and instrument selection identically; Tab/Enter/Space and listbox arrow navigation show visible focus; resizing narrow shows/hides the instrument list via the drawer toggle without relayout on unrelated status updates; the canvas goes idle after interaction. Record the result below.

User verification: open `v2/preview.html`, resize the window across the narrow threshold, and confirm the screen matches the completion checks in `project/specs/003-live-workbench/requirements.md` (LWB-005, LWB-006, LWB-007).

## Deferred to later phases of this spec or a superseding spec

- DOM renderer interchangeability (step 5).
- Live specification editing inside `dev.html`, coordinated with spec 002's component gallery/log (step 6).
- Lazy feature loading proof for the sample-editor placeholder (step 7).
- The pattern-grid component (step 8) and real playback integration (step 9).

## Outcome

Phase 1 and Phase 2 are implemented and manually verified: schema version 1, direct-source entry points, a deterministic validate/normalize/store/commands/layout pipeline with 33 passing `node --test` cases, and a canvas renderer adapted from the legacy bitmap-font/scale-9/listbox conventions with a semantic DOM overlay for input and accessibility.

Manual verification (2026-09-09, `v2/preview.html` and `v2/dev.html` served from `python -m http.server` and driven via chrome-devtools): Play/Stop enablement and the mock status label update correctly and identically for pointer clicks and keyboard (Enter) activation on the real accessible `<button>` overlay; instrument selection works by pointer and by Up/Down-arrow-plus-Enter keyboard navigation, with a visible focus ring in both cases; narrowing the container below 420px replaces the instrument list with a "Show/Hide instruments" toggle bound to `ui.toggleSecondaryDrawer`, and the previously selected instrument is preserved when reopened; a network trace of `preview.html` shows only `runtime/`, `templates/`, `renderers/canvas/` and `domain/` modules, no workbench code. One real bug was found and fixed during this pass: the "small" bitmap font atlas has no `:`/`(`/`)` glyphs, so the status label's originally-planned `"Status: stopped (mock)"` format rendered as gaps; it now reads `"Status - stopped - mock"` (documented in `project/documentation/runtime.md`).

Not yet verified automatically: canvas idle-after-settle was only checked by visual inspection (no dedicated frame-count test). Milestone A (DOM renderer, live editing) has not started; steps 5-9 remain as noted above.
