# 014 — Design

## Shape of the change

Gesture recognition is a pure state machine in `runtime/`, the behavior a node has is chosen by its registry entry, and the renderer is the only module that touches the DOM. Nothing in `renderers/canvas/` learns a component type name.

```
raw DOM event
   |
   v
mountGeneric.js          hit-test, then hand the point to the router
   |
   v
runtime/pointerRouter.js pure: capture, drag threshold, double-click window
   |                     -> a list of semantic inputs, always naming a node
   v
runtime/behaviors.js     which controller a type gets: button | value | scroll
   |
   v
runtime/{buttonController,valueController,scrollController}.js
   |                     -> { transitions, activated, changed, value, scrollTo, ... }
   v
mountGeneric.js          write state, dispatch actions, trace, redraw
```

## The pointer router

One object, four inputs, a list of semantic events out. It never sees a DOM event and never asks what a node *is*: the renderer resolves the node under the point and passes the id.

```js
const router = createPointerRouter();
router.down({ id, point, button, time });   // -> [{ type: "pointerdown", id, point }]
router.move({ hitId, point, time });        // -> [] | [{type:"dragstart"...}, {type:"drag"...}] | hover changes
router.up({ point, time, button });         // -> [{type:"pointerup", id}, {type:"doubleclick", id}?]
router.cancel();                            // -> [{type:"dragend"}?, {type:"pointerleave"}?]
```

**Capture.** `down` records the id. Until the matching `up` or a `cancel`, every `move` and the `up` are addressed to that id, whatever `hitId` says. This is v1's behaviour and it is what makes a slider usable: the pointer leaves the 20-pixel-tall control almost immediately.

**Hover while captured.** Crossing out of the captured node's rect emits `pointerleave`, which releases the held press through the existing controller rule, so releasing outside does not activate. Crossing back in emits `pointerenter` and, because the button is still held, `pointerdown` again, which re-presses. That is what a native `<button>` does, and it costs three lines.

**The drag threshold.** Three logical pixels, as a named constant. Below it the gesture is still a click. The first `drag` event after crossing reports the delta from the **press point**, not from the crossing point, so a fast flick does not lose its first three pixels. A node that produced a `dragstart` is marked, and its `up` still emits `pointerup` (the controller needs it to unpress) but the renderer suppresses the activation. That is how a slider drag avoids also firing the slider's click.

**Double-click.** The router remembers the last completed click: its id, point and time. A second `up` on the same id within 400 ms and 5 pixels appends a `doubleclick` event *after* the `pointerup`. It is additive on purpose: a type that does not handle it behaves exactly as it does today, so promoting a type to double-click-aware is one registry change and never a regression.

**Secondary click.** A `down` with a button other than 0 emits `secondaryclick` and takes no capture, so a right-press cannot press, drag or activate a control.

**Cancel.** `pointercancel`, the window losing focus, and leaving Interact mode all route to `cancel()`, which ends a drag and releases a press without activating.

The wheel needs no state, so it is not a router concern. The renderer hit-tests, walks the ancestry for the nearest node whose behavior accepts a wheel, and feeds it.

## Behaviors in the registry

A component type declares which controller it gets, and with what options:

```js
slider: {
    interactive: true,
    behavior: "value",
    behaviorOptions: { mode: "absolute", axis: "x" },
    cursor: "ew-resize",
    ...
}
```

`behaviorOf(type)` returns `entry.behavior`, defaulting to `"button"` for an interactive type that names none, so every type that exists today keeps its controller without an edit. `behaviorOptions` is opaque to the renderer and passed straight to the factory. `cursorOf(type)` is the declared CSS cursor keyword.

`runtime/behaviors.js` is the one table from a behavior name to a factory, exactly as `drawKinds.js` is the one table from a draw kind to pixels. Every controller has the same three members, so `feed()` in the renderer stays a single function:

```
handle(input) -> { transitions, activated, blocked, handled, changed?, value?, scrollTo? }
setDisabled(disabled) -> transitions
get state()
```

`handled` is new and says the controller consumed the input, so the renderer knows whether to call `preventDefault` on a wheel.

## The value behavior

One controller serves `slider` and `spinBox`; the difference is two options.

| option | slider | spinBox |
|---|---|---|
| `mode` | `absolute`: the value follows the pointer's position in the control | `relative`: the value follows the pointer's *movement* |
| `axis` | `x` | `y` |
| pixels per step | derived from the control's length and the range | a constant, four pixels per step |

Bounds come from the node's authored `min`, `max` and `step` (already declared properties of `spinBox`), with documented defaults of 0, 100 and 1. Every result is clamped and quantized to the step, so no input path can produce an out-of-range or fractional value.

Inputs it handles: `pointerdown` (absolute mode jumps to the pressed position, exactly as v1's sliders do), `drag`, `wheel` (one notch is one step, up increases), and the ordinary hover/press/focus transitions so it still draws its states. It never `activated`s: a value control reports `changed` with its new `value`, and the renderer turns that into a `change` action dispatch and a state write.

`spinBox` also has two hit areas: pressing in the top or bottom half of its stepper column steps the value once. That is the click path; a drag on the value area is the continuous path.

## The scroll behavior

The `viewport` type becomes interactive with `behavior: "scroll"`. It computes a **requested** offset and nothing else; the clamp stays in `runtime/genericLayout.js`, where spec 013 put it, so every path (a bound field written by an author, a wheel, a drag, a thumb) is clamped by the same code and none of them can lose the content.

| gesture | requested offset |
|---|---|
| wheel | `offset + sign(deltaY) * 24` |
| drag on the background | `offsetAtPress - dragDelta.y`, so the content follows the pointer |
| drag on the thumb | `offsetAtPress + dragDelta.y * contentHeight / trackHeight` |

`runtime/scrollbar.js` holds the one piece of arithmetic all three share and the draw kind reads:

```js
thumbMetrics(rect, extent, offset) -> null | { track, thumb }
```

It returns `null` when the content does not overflow, which is also how the draw kind decides not to draw a thumb and how the renderer decides the cursor is not a grab. A viewport with no bound `field` never scrolls; its controller reports `handled: false` so the wheel falls through to an ancestor that can.

The renderer writes the requested offset to the viewport's bound state field. In the authoring preview that is the mock map; in the generated application it is the real store. No new plumbing.

## Drawing

Two new draw kinds, and one existing one gains the thumb.

- **`slider`** — the style's `normal` artwork as a track, a thumb drawn from the style's `thumbStyle` (a new style property, exactly parallel to `radioGroup`'s existing `itemStyle`), and the value as text when the control is tall enough.
- **`spinBox`** — the track, the value, and a stepper column on the right with a `+` above a `-`, each drawn from `thumbStyle`. The font has both glyphs.
- **`background`** (the viewport's kind) — draws the thumb when `thumbMetrics` returns one.

No new artwork is needed: the track is `panel_inset_dark` and the thumb is `button_inlay`, both already in `assets/skin/src/`. The authored skin gets `slider` and `spinBox` style blocks that say so.

## Cursors

The registry declares one cursor per type. The renderer sets `canvas.style.cursor` from the node under the pointer, with two overrides: while a drag is in progress the cursor stays the dragged node's shape wherever the pointer goes, and a viewport that cannot scroll falls back to `default`. Inspect mode keeps `crosshair` throughout, because the pointer there inspects rather than operates.

## File drag-and-drop

The canvas listens for `dragover`, `dragleave` and `drop`, suppresses the browser's own navigation, draws a border while a drag is over it, and on drop traces the file names and calls `appContext.openFiles(files)` if the application supplied one.

The generated application supplies it through a **reserved host command**. `capabilities.js` keys beginning `host.` are not authored in YAML and are not compiled from a binding; they are the hooks the renderer offers, and the emitter wires them into the app context in `main.js`. `host.openFiles` maps to `domain/playback/index.js#openFiles`, which reads the first dropped file and loads it through the engine that spec 012 already built. The authoring preview passes no app context, so a drop there is a trace and nothing else, which keeps the promise that opening the workbench never starts audio.

## Actions and the `change` event

`actions:` mappings already carry an arbitrary event key, so `- change: setPlaybackType` compiles today; nothing consumed it. The renderer now dispatches bindings whose `event` is `change` when a controller reports `changed`, and passes the new value to the mock dispatch so the trace shows it.

Two recipe additions make the application's existing authored actions resolve instead of warning:

- `set <subject>` and `set number of <subject>` become a `command` binding named after the subject, with a numeric mock field.
- An action reference that names no file falls back to interpreting the reference itself as prose, after splitting `camelCase` into words. That turns the authored `toggleRecording` into the `toggle recording` recipe that already exists, and it is why the record button has been inert since spec 005.

Both are additive: an unresolved reference still warns, it just warns less often.

## What this deliberately does not do

- **No animation-frame coalescing of the redraw.** A drag redraws synchronously, as every other input already does. Coalescing is package P8 and wants measurement first; doing it here would mean changing how *every* input redraws, on no evidence.
- **No layout pass per pointer move beyond the existing one.** A drag writes a state field and redraws; the layout is recomputed on resize and on a scroll offset change, which is what spec 013 already does.
- **No new component types beyond `slider`.** `scrollbar`, `knob` and `rangeSlider` are P5. The viewport's thumb is part of the viewport, not a component, because a standalone scrollbar needs the anchored placement and the binding vocabulary P5 brings.
- **No touch or pen handling.** Pointer events cover both well enough for a mouse-designed application, and v1 has no touch path either.
