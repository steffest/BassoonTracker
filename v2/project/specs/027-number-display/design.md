# 027 — Design

## A third controller shape, not an alias

Specs 018/020/021/023 each found a new type that could reuse an *existing* controller under a second behavior name (`rangeSlider`/`knob` are `slider`'s own absolute/relative modes; `disclose`/`collapsible` are the plain button controller; `tabs` is `listController`). `numberDisplay` looked like a candidate for the same trick at first (spec 016 explicitly left "which controller it reuses" as an open question) - but reading v1's actual edit model settled it the other way: every edit re-parses the *whole padded string* as an integer and only clamps, never snaps to a step grid, which is not what either existing controller does (`valueController` always snaps via `quantize()`; `textController` has no numeric bounds concept at all). `runtime/numberDisplayController.js` is a genuinely new, small controller - borrowing `valueController`'s bounds shape and `textController`'s caret shape as *references*, not as code it calls into.

Two pure helpers are exported for reuse rather than duplicated where they are needed: `paddedValue(value, padLength)` (v1's own `_padValue()` - left-pad with spaces, never truncate a value wider than `padLength`) and `clampOnly(value, bounds)` (clamp with no step-snapping, the one property that rules out reusing `runtime/valueController.js`'s own `quantize()`). Both `renderers/canvas/mountGeneric.js` (to resolve the displayed text and the context a click/keystroke needs) and the controller itself use the same two functions, so the padded string a caret position is computed against is always the same one that gets drawn.

## Wiring into the renderer

`mountGeneric.js`'s `textOf()` gained one more special case, alongside the existing dropdown one: a `"digitEntry"`-behavior node's drawn text is its padded digit string, not a raw field value - resolved once, so the draw kind, `charIndexAt()` (click-to-caret) and the controller's own caret math all agree on the same string. `contextFor()` gained a `"digitEntry"` branch supplying `bounds` (reusing `valueController.js`'s own `boundsOf()`), the current `value` (clamped, never snapped - so a defensive re-clamp on display can never disagree with what typing itself would clamp to), `padLength`, and `charIndex` (reusing the existing font-aware `charIndexAt()` unchanged). Nothing in `feed()` needed a new branch at all: the controller's result shape (`{ changed, value }`, `value` a plain number) is exactly what the existing generic `applyValue()` dispatch already handles for every value-shaped control.

The draw kind reads `style.label.offsetX` for where the text starts, the same way `charIndexAt()` already does, falling back to the same constant (4px) either function would otherwise hard-code on its own - so a click always maps to the character actually drawn under it, not a few pixels off.

## What this deliberately does not do

See requirements.md's scope boundaries: no LED font or size variants, no blinking caret, no authored use anywhere yet. `numberDisplay` being the last catalogue gap closes package P5's own component-catalogue half; "the screens" half was already closed by specs 022-026.
