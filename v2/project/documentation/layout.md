# Layout

Status: implemented and verified 2026-09-10 (spec [013](../specs/013-layout-foundations/requirements.md), package P3 of the [port roadmap](../specs/010-port-roadmap/requirements.md)). `runtime/genericLayout.js` is pure and DOM-free: the renderer supplies a measure function and receives rectangles.

## What a layout pass returns

```js
computeGenericLayout(root, viewport, measureLeaf, { scrollOffset })
// -> { rects, clips, extents, offsets, overlays }
```

| result | meaning |
|---|---|
| `rects` | where each node is |
| `clips` | where each node may draw. Total: every node has one, so no caller walks ancestors |
| `extents` | a viewport's content size, for clamping and for a future scrollbar thumb |
| `offsets` | a viewport's applied scroll offset, after clamping |
| `overlays` | the ids of out-of-flow nodes, in paint order |

## Sizing

Independent `width` and `height`, each `fill`, `fixed` or `auto`. Along the main axis, `fixed` and `auto` children keep their size and `fill` children split what is left. Across it, `fixed` keeps its size while `fill` and `auto` both stretch, so a tall child spills into its own content rather than into its siblings. A `fixed` dimension with no number takes the size the skin's style for that type declares ([skin.md](skin.md)), then the compiler's documented default.

## Direction

Resolution order, first match wins:

1. the authored `layout.direction`, `row` or `column`;
2. the component type's declared direction, so a `radioGroup` is always a row of choices ([components.md](components.md));
3. the pre-013 default: a container with a **fixed height** reads as one toolbar row, anything else stacks as a column.

The third step stays because the application relies on it for its top bar and its control bar. An unsupported authored value warns and is ignored.

## Clipping

A node's clip is the intersection of its parent's clip with its own rect **if its type clips**, and its parent's clip otherwise. Only `viewport` clips today. A panel deliberately does not: clipping the flow would hide the overflow an author needs to see while authoring, and not clipping is what kept the application's rendering identical when this landed.

The renderer wraps a node's drawing in a canvas clip only when the clip does not already contain the rect, and skips the drawing entirely when the clip is empty. Hit-testing requires the point to be inside both the rect and the clip, so a control scrolled out of sight cannot be clicked where it is not visible. The click falls through to whatever is actually visible there.

Clip bounds are inclusive, so a control's first pixel row still counts as inside its clip. That matches the pre-existing hit-test semantics.

## Viewports

```yaml
- track list:
    type: viewport
    field: tracks.scroll
    layout:
      height: fixed
```

A viewport lays its children out at their natural height in a column, translates them by the offset its bound field holds, and clips them to its own box. The offset is clamped to `max(0, contentHeight - viewportHeight)` inside the layout pass, so a bad field value cannot lose the content. With no bound field it is simply a clipping box, which is useful on its own.

One viewport replaces the three separate scrollers v1 hand-rolled in its list box, its pattern view and its arrangement view. Wheel, drag and a scrollbar thumb landed with spec [014](../specs/014-pointer-interaction/requirements.md); see [interaction.md](interaction.md) for how each of the three computes the offset this pass then clamps. Horizontal scrolling arrives with the pattern grid in P7.

Corrected 2026-09-10 (spec 014): a scroll offset written from *outside* the renderer did not actually move the content when this landed. The renderer redrew on a state change but did not re-lay out, so the rows kept their old rectangles. It now re-lays out, because a state change can move things and not only recolour them: an offset, and a field-bound label whose text changed width. The browser scenario now asserts the applied offset rather than only that the pixels changed, which is what let the original check pass over the bug.

## The overlay layer

A component type may declare itself out of flow:

| field | effect |
|---|---|
| `layer: "overlay"` | laid out against the viewport, not its parent; painted after the whole tree, in declared order; clipped only by the viewport |
| `modal: true` | additionally swallows input: a hit outside its subtree is not a hit at all |

This is v1's `zIndex` sort plus its single global modal slot, expressed as declared data instead of a sort key an author maintains. One gate in front of every pointer path means Inspect and Interact route identically.

No component type declares either field yet: `dropdown`, `menu`, `modalDialog` and `tooltip` are package P5. The mechanism is verified by mounting a hand-built tree, which is what `mountGenericRenderer(container, { root })` is for.

## Scrollbars

A viewport draws its own thumb, against its right edge, when its content overflows. `runtime/scrollbar.js` holds the arithmetic, and the draw kind, the scroll controller and the cursor logic all read the same function, so none of them can disagree about where the thumb is. It returns nothing at all when the content fits, which is how each of those three decides to do nothing.

A standalone `scrollbar` component is not a type and is not planned as one for the viewport's sake. It would need the binding vocabulary package P5 brings.

## Padding and gaps

Four pixels of padding inside a container and four between siblings, as constants. Authoring them is not supported and has not been needed; when a screen needs it, it belongs with `align` and the minimum and maximum sizes in P5.
