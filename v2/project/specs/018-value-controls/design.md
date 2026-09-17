# 018 — Design

## Both types reuse `runtime/valueController.js` unchanged

```js
rangeSlider: { behavior: "value", behaviorOptions: { mode: "absolute", axis: "x" }, ... }
knob:        { behavior: "value", behaviorOptions: { mode: "relative", axis: "y" }, ... }
```

`rangeSlider` is `slider`'s own options (absolute mode, jump-to-press, drag-follows-pointer). `knob` is `spinBox`'s relative mode (`mode: "relative", axis: "y"`) with no `stepper` - a vertical drag moves the value by its distance in pixels, exactly as `spinBox`'s readout area already does, and the wheel already steps by `bounds.step` regardless of mode or axis, so `knob` gets wheel support with no extra code at all. Neither type needed a change to `valueController.js`, `behaviors.js`'s dispatch table, or `mountGeneric.js`'s `feed()`/`contextFor()` value-behavior branch - all of that was already generic across every "value" type.

## The one new generic mechanism: a per-node axis override

`rangeSlider`'s `vertical` property has to reach the controller (so a drag/press computes the value from the right axis) and the draw kind (so it lays out top-to-bottom). Both read it the same way, in one place each, by property name rather than by asking "is this a rangeSlider":

```js
// mountGeneric.js, where every controller is built:
const options = { ...behaviorOptionsOf(node.type) };
if (node.vertical) options.axis = "y";
const controller = behavior ? createBehaviorController(behavior, options) : null;
```

```js
// drawKinds.js's rangeSlider kind:
if (node && node.vertical) { /* lay out the track and thumb top-to-bottom */ }
```

This is deliberately not gated on `node.type === "rangeSlider"` (which the project's own registry-consistency test would catch: "no module outside the registry branches on a component type name"). Any future type that wants a per-instance vertical axis gets it for free, the same way `node.field` already works for every field-bound type regardless of which one it is.

## Found while verifying: a shared style cannot give two different lengths

The first draft's built-in fallback style copied `slider`'s shape verbatim - `width: 120, height: 20` - and the vertical branch of `measure()` read `style.height || 120` as the vertical instance's length. That is wrong twice over: `style.height` is `20`, not a sensible on-screen length for a vertical fader, and it is the *wrong dimension conceptually* - a style's `height` means "how tall the control's short axis is" for the horizontal case, and there is no way for the same flat style object to also mean "how long the control's travel axis is" for the vertical case, because those are different questions whose answers happen to collide in one property name.

Caught by mounting a hand-built tree in a real browser and reading back `layoutRects()`: a vertical `rangeSlider` measured to `height: 20`, visibly indistinguishable from the horizontal one sitting above it. The unit tests had not caught it because the first draft's test happened to pass a style with only one axis set at a time (see tasks.md's "found while doing it").

Fixed by not reading the style for the vertical instance's length at all: `RANGE_SLIDER_LENGTH`, a plain constant (120), is the length along whichever axis is in play, and the built-in style no longer declares a `height` (so nothing suggests it means something for the vertical case). The one thing this leaves unresolved on purpose: there is still no authored vocabulary for "this vertical instance should be 200px tall, not 120" - a real per-orientation skin length - and none is invented here, since nothing needs one yet.

## `knob`: canvas primitives, not skin artwork

No rotary sprite exists in the built-in skin (or the authored one), and adding `knob_back`/`knob_front`-equivalent artwork is not this spec's job. `knob`'s draw kind is fully procedural: a filled disc (state-tinted for `disabled`), a progress arc swept between v1's own two angle constants (`-230deg` to `50deg`, kept identical so the gauge reads the same way), and a straight pointer line from the centre to the arc's current angle. `styled: false` reflects that there is no skin-state asset resolution involved at all, the same as `image`/`icon`.

`knob`'s v1 behaviour of toggling its own `disabled` flag on a plain click (movement under the drag threshold) is not carried forward, per spec 016's own flag on this contract and VAL-004 above: a control disabling itself on click is not a pattern anything else in this catalogue has, and the generic `disabledWhen` mechanism (spec 015) is where disabling any control belongs.

## What this deliberately does not do

- **No `scrollbar`.** See requirements.md's scope decision - it is provisionally P7/P11 territory, not this cluster's.
- **No authored per-orientation length for `rangeSlider`.** See "found while verifying" above.
- **No change to `slider` or `spinBox`.** Both already existed and are used in the real authored application; neither's registry entry, draw kind, or controller was touched, and the regression evidence in tasks.md confirms it.
