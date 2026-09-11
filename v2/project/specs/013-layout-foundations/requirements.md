# 013 — Layout foundations: clipping, viewports and an overlay layer

Date: 2026-09-10. Kind: feature. Status: specified. Implements package **P3** of spec [010](../010-port-roadmap/requirements.md), the port roadmap.

## Purpose

The layout engine can stack rows and columns. Every v1 screen that is not a toolbar needs three things it does not have:

- **Clipping.** Nothing is clipped today. A label longer than its panel draws over its neighbours, and the current application already shows this: the control bar's contents overflow it. v1 avoids the problem by sizing each widget's own canvas exactly; v2 draws everything into one canvas and needs a clip rectangle per node.
- **A scroll viewport.** Every list, the pattern grid and the arrangement view scroll. v1 has no generic scroller: `listbox`, `patternView` and `multitrack` each reimplement index windows or pixel offsets with their own thumb arithmetic. One viewport container replaces all three.
- **An overlay layer.** Dropdown popups, context menus, tooltips and modal dialogs are all drawn above the tree and hit-tested before it, and a modal swallows everything outside itself. v1 does this with a `zIndex` sort and one global modal slot.

Spec 003's step 4 promised clipping bounds and never delivered them. This is that debt, plus the two things next to it.

## Scope decision

Interactive scrolling is **not** in this package. A viewport can be scrolled by its bound state field, which is enough to lay out, clip and verify it, but a wheel, a drag or a scrollbar thumb needs the input work in package P4. Splitting there keeps this package about geometry, which is what it is.

Also out: `align`, minimum and maximum sizes, and the declared breakpoints that replace v1's hand-written cascade. Those are language additions the screens will ask for in P5, not foundations anything else waits on.

## User stories and acceptance

- **LAY-001 — Nothing draws outside its box:** As an author, a component's drawing stays inside its own rectangle, and inside every ancestor's. Acceptance: the layout result carries a clip rectangle per node, computed as the intersection of its own rect with its ancestors' clips; the renderer clips each node's drawing to it; a label longer than its panel is cut at the panel edge rather than drawn over the next panel; the existing application's rendering is unchanged except where it was previously overflowing.
- **LAY-002 — Hit-testing agrees with what is visible:** As a user, clicking where a control is *not* visible does not activate it. Acceptance: a point inside a node's rect but outside its clip is not a hit; Inspect and Interact both use the same rule; the workbench's hover and selection overlays follow the clip.
- **LAY-003 — A viewport scrolls and clips its content:** As an author, a `viewport` lays its content out at natural size, clips it to the viewport, and offsets it by a bound state field. Acceptance: content taller than the viewport is clipped, not shrunk; changing the bound field moves the content and redraws; the content's full extent is reported so a future scrollbar can size a thumb; hit-testing accounts for the offset; a scroll offset is clamped to the content extent.
- **LAY-004 — An overlay draws above the tree and is hit first:** As an author, a component type declared as an overlay is positioned against the viewport rather than in flow, painted after everything else in declared order, and hit-tested before everything else. Acceptance: an overlay node draws over content that comes later in the tree; two overlays paint in their declared order; an overlay is never clipped by its parent.
- **LAY-005 — A modal overlay takes all input:** As a user, while a modal is open, controls behind it do not respond. Acceptance: with a modal overlay present, hit-testing outside it returns nothing, activation of a control behind it is impossible, and removing the modal restores normal routing.
- **LAY-006 — Direction is authored, not inferred:** As an author, `layout.direction` says whether a container is a row or a column. Acceptance: an authored direction wins; a type's declared direction is next; the pre-013 rule (a fixed-height container is a row) remains the last resort so the current application is unchanged; an unsupported value warns and falls back.
- **LAY-007 — No regressions:** Acceptance: the unit suite passes, the compiled outline gains clip and viewport information but no node changes shape or identity, and the eight browser scenarios still pass.

## Non-functional requirements

The layout engine stays pure and DOM-free, so clipping and scrolling are unit-testable without a canvas. Clip rectangles are computed once per layout pass, not per draw. The renderer's clip must not leak: every save has its restore, and a node that draws nothing does not pay for a clip. No new dependency.

## Scope boundaries

In scope: clip rectangles, the `viewport` type, the overlay and modal layer, authored `layout.direction`, and the tests and documentation for all four.

Out of scope: wheel, drag and scrollbar input (P4); `align`, min and max sizes, and breakpoints (P5); the `dropdown`, `menu`, `modalDialog` and `tooltip` types that will use the overlay layer (P5); horizontal scrolling, which the pattern grid brings with it (P7); and any change to how a node is measured.
