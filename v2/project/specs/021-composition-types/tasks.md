# 021 — Tasks

- [x] `runtime/genericLayout.js`: `options.activeTab`/`options.collapsed`, defaulting to `() => 0`/`() => false`. `layoutTabs()` (only the active child gets a rect); `layoutNode()` treats a collapsed node as having no children at all. Neither changes behaviour for a caller that does not use them.
- [x] `runtime/componentTypes.js`: `tabPanel` promoted (`tabHeader: { height: 24 }`, `behavior: "tabs"`, `draw: "tabPanel"`, `field` property); `collapsePanel` promoted (`collapsible: true`, `behavior: "collapsible"`, `draw: "collapsePanel"`, `field` property); `buttonGroup` promoted (`container` corrected to bare `{ childrenIn: "items" }`, `draw: "none"` unchanged).
- [x] `runtime/behaviors.js`: register `tabs` (alias of `createListController`) and `collapsible` (alias of `createButtonController`).
- [x] `renderers/canvas/drawKinds.js`: `tabPanel` and `collapsePanel` draw kinds.
- [x] `renderers/canvas/mountGeneric.js`: `tabIndexAt()`; `contextFor()`/`visualStateOf()` branches for behaviors `"tabs"`/`"collapsible"`; `feed()`'s one new branch (a `"collapsible"` activation toggles its own field via `applyValue`, rather than dispatching); `relayout()`'s `computeGenericLayout` call gains `activeTab`/`collapsed`.
- [x] `compiler/emit.js`: state-field seeding for behaviors `"tabs"` (numeric, seeded 0) and `"collapsible"` (boolean, seeded false).
- [x] `tests/compositionLayout.test.js` (new): `layoutTabs` (only the active child gets a rect/clip; others get none; out-of-range/negative active index clamps to a valid one); collapsed gets no children laid out, expanded lays them out normally; both options default to their pre-021 behaviour when omitted.
- [x] `tests/compositionTypes.test.js` (new): registry facts for all three (implemented, draw kind, styled-ness, behavior, `tabHeader`/`collapsible`); draw kinds' `draw()`/`measure()` against a fake canvas context, mirroring `overlayTypes.test.js`'s own pattern; `buttonGroup`'s `container` no longer has a `childType`.
- [x] `tests/componentTypes.test.js`: remove `tabPanel`, `collapsePanel`, `buttonGroup` from the "still placeholders" list.
- [x] `tests/compiler.test.js`: a case proving `buttonGroup`'s items are independent, full-treatment nodes (each keeps its own `actions:`), not `radioGroup`'s forced-childType/group-level-binding shape.
- [x] `node --test "v2/tests/*.test.js"` passes; `node v2/build.mjs app`/`dist` succeed unchanged (nothing in `app.yaml` authors any of the three).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; browser verification recorded as not performed (no Playwright in this environment, checked again).
