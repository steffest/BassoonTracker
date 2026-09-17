# 023 — Tasks

- [x] Read `script/src/ui/components/menu.js` and `script/src/ui/app/menu.js` in full; record the two-object (button/`Submenu`) structural finding in design.md before writing any code.
- [x] `runtime/componentTypes.js`: `menu` promoted (`implemented: true`, bare `{ childrenIn: "items" }`, `wrapsFlyoutItems`/`exclusiveOverlayChildren`, `draw: "none"`); `submenu` gains `wrapsFlyoutItems`/`exclusiveOverlayChildren`/`isMenuFlyout`; new `menuTrigger` type (`behavior: "disclose"`, `draw: "menuTrigger"`, synthesized-only).
- [x] `runtime/overlaySynthesis.js`: `synthesizeMenuTriggers()`; `visit()` calls it when `entry.wrapsFlyoutItems`.
- [x] `renderers/canvas/drawKinds.js`: `menuTrigger` draw kind (label + hover/pressed tint, no artwork).
- [x] `renderers/canvas/mountGeneric.js`: `textOf()`'s dropdown-label guard now also checks `node.field`; the "disclose" activation branch gains `node.popupEdge` and `exclusiveOverlayChildren`-gated sibling-closing.
- [x] `project/specs/application/current/app.yaml`: the placeholder menu block reshaped into a real (small) nested example - a "File" submenu holding the pre-existing `item1`/`action1`/`item2`/`action2` compiler-testing fixture, now authored as proper named-action references so they keep demonstrating an unresolved action reference, from inside a real menu structure.
- [x] `tests/overlaySynthesis.test.js`: menu-wraps-submenu-items (anchored below), submenu-wraps-nested-submenu-items (anchored right), the wrapper's derived id.
- [x] `tests/menuBar.test.js` (new): registry facts for `menu`/`menuTrigger`/`submenu`'s new facts; the `menuTrigger` draw kind; a compiler-level test compiling a real, doubly-nested `menu`/`submenu`/`submenu` authoring case end to end.
- [x] `tests/compiler.test.js`, `tests/componentTypes.test.js`, `tests/emit.test.js`: every assertion that used `menu` as the standing example of "declared but not implemented" moved to `tooltip`; assertions that counted `menu` among `app.yaml`'s unsupported/placeholder nodes updated now that it renders.
- [x] `node --test "v2/tests/*.test.js"` passes; `node v2/build.mjs app` succeeds with the expected loose ends (menu no longer among them; action1/action2 still unresolved, from inside the new structure); `node v2/build.mjs dist` still blocked only by the pre-existing esbuild version mismatch on this machine.
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec as the menu bar's prerequisite, not the screen itself.
