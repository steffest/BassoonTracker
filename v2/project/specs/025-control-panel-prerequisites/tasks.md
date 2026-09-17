# 025 — Tasks

- [x] Research (delegated, then verified against source): `script/src/ui/app/layout.js`'s `Layout.setLayout()` (the whole breakpoint cascade, one function) and the four independent `EVENT.showView` listeners (`appMainPanel.js`, `patternPanel.js`, `mainPanel.js`, `settings.js`); findings recorded in requirements.md before any design decision.
- [x] `runtime/componentTypes.js`: `breakpoints`/`visibleWhen` added to `UNIVERSAL_PROPERTIES`.
- [x] `compiler/convert.js`: parses `breakpoints:` into `node.breakpoints` (partial per-entry overrides, reusing `resolveLayoutFields` per entry then keeping only the authored keys) and `visibleWhen:` into `node.visibleWhen` (`{ field, oneOf }`, `oneOf` accepting a sequence or a bare scalar); both validated, with a diagnostic and no property set when malformed.
- [x] `runtime/genericLayout.js`: `effectiveLayout(node, viewportWidth)` (breakpoint merge) and `isVisible(node, context)` (state-gated visibility, folded into `flowChildren()`); every internal read of `node.layout` now goes through `effectiveLayout`; `context.viewportWidth`/`context.stateValueOf` added to `computeGenericLayout`'s context, both defaulting to pre-025 behaviour.
- [x] `compiler/emit.js`: seeds a `visibleWhen.field` to `""` if nothing else already declares it.
- [x] `renderers/canvas/mountGeneric.js`: `relayout()`'s `computeGenericLayout` call gains `stateValueOf`.
- [x] `tests/breakpointLayout.test.js` (new): threshold matching (at/under vs. above), narrowest-wins with three thresholds, partial-override-only, the pre-025 no-breakpoints case, a row/column switch shape.
- [x] `tests/viewVisibility.test.js` (new): absent-from-layout (node and subtree), no-`stateValueOf`-supplied default, the pre-025 no-`visibleWhen` case, two siblings on the same field, two independent regions on different fields, no space reserved for a hidden sibling.
- [x] `tests/controlPanelPrerequisites.test.js` (new): both are universal properties; `breakpoints:`/`visibleWhen:` compiler parsing, including the invalid-input cases and a real multi-region shape matching v1's own top/bottom split.
- [x] `node --test "v2/tests/*.test.js"` passes (295, up from 276, all pre-025 tests unchanged); `node build.mjs app`/`dist` succeed exactly as before (nothing yet authors either mechanism).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; the control panel screen itself remains the one deferred item, now unblocked.
