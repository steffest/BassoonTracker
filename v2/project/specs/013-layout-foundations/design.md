# 013 — Design

## The layout result

`computeGenericLayout` returns rectangles today. It gains two more maps and one list:

```js
{
  rects:   Map<id, {x, y, width, height}>,     // unchanged
  clips:   Map<id, {x, y, width, height}>,     // where this node may draw
  extents: Map<id, {width, height}>,           // a viewport's content size
  overlays: string[]                            // overlay node ids, in paint order
}
```

- **`clips`** is the intersection of a node's own rect with its parent's clip. A node whose type does not clip passes its parent's clip straight through, so the map is total and the renderer never has to walk ancestors.
- **`extents`** is only filled for a viewport: the natural size of its content, which is what a scrollbar needs to size a thumb and what clamps the offset.
- **`overlays`** are laid out against the viewport rather than in flow, in the order they appear in the tree, and the renderer paints them after everything else.

## Clipping

One rule: a node's clip is `intersect(parentClip, ownRect)` when its type clips, and `parentClip` otherwise. Only `viewport` clips by default; a panel does not, because panels are the flow and clipping them would hide the overflow the author needs to see while authoring. That is a deliberate choice and it is what keeps the current application's rendering identical.

The renderer wraps each node's draw in `save`, `beginPath`, `rect`, `clip`, `restore`, and skips the whole dance when the clip already contains the node's rect, which is the common case. An empty clip skips the draw entirely.

Hit-testing takes the clip alongside the rect: a point must be inside both. `hitTestPoint` therefore takes entries of `{ id, rect, clip }`, with `clip` optional so existing callers and tests keep working.

## The viewport type

A new registered component type:

| field | value |
|---|---|
| container | `content`, named slots allowed |
| direction | `column` |
| clips | yes |
| draw | `background` |
| properties | `field`: the state field holding the vertical scroll offset in pixels |

Its children are laid out at natural size in a column, then translated by the clamped offset. Layout reports the content extent so the offset can be clamped to `max(0, contentHeight - viewportHeight)`. A viewport with no bound field is simply a clipping box, which is useful on its own.

Horizontal scrolling is deliberately absent: v1's horizontal scrollers are the pattern grid and the arrangement view, which arrive with their own package and their own axis handling.

## The overlay layer

Two new registry fields, both optional:

- `layer: "overlay"` takes the node out of flow. It is laid out against the viewport, at its own fixed size where it declares one, centred where it does not.
- `modal: true` additionally makes it swallow input: hit-testing outside it returns nothing.

The renderer keeps its existing single-pass paint for the flow tree and then paints `layout.overlays` in order. Hit-testing scans overlays first, in reverse paint order, and stops there if a modal is present. This is v1's rule (`sortZIndex` plus one global `modalElement`) expressed as declared data rather than as a sort key an author has to maintain.

No component type declares either field yet: `dropdown`, `menu`, `modalDialog` and `tooltip` are P5. The mechanism is verified by mounting a hand-built tree, which is a supported public API (`mountGenericRenderer(container, { root })`), so the verification does not depend on inventing a type this package is not delivering.

## Authored direction

`layout.direction` joins `width`, `height` and `resizable` in `compiler/layoutFields.js`, with the same treatment: a recognised value is carried, an unrecognised one warns and is ignored. The resolution order becomes authored, then the type's declared direction, then the pre-013 rule that a fixed-height container is a row. That last step stays so the current application, which relies on it for the top bar and the control bar, renders identically.

## What this does not change

Measurement. A node's intrinsic size is still what its draw kind reports, and a viewport's children are still measured the same way; the viewport only changes where they are put and what they are clipped to. Nothing in the outline's node shape or identity changes, so every id, binding and source range stays as it was.

## Risks

- **A clip leak turns into invisible content.** Mitigated by computing clips in the pure layout pass, testing them there, and asserting in the browser that the application still draws the same number of lit pixels outside the areas that were previously overflowing.
- **The overlay layer touches hit-testing, which the workbench's Inspect mode also uses.** Its acceptance says Inspect and Interact must both still work, and the existing workbench scenario re-runs as the regression check.
- **An unbounded viewport offset** would scroll content out of sight with no way back. The offset is clamped in the layout pass, so a bad field value cannot lose the content.
