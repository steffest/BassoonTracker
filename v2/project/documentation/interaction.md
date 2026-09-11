# Interaction: gestures, behaviors and input routing

Status: pointer half implemented and verified 2026-09-10 (spec [014](../specs/014-pointer-interaction/requirements.md)). Keyboard, text entry, shortcuts and command enablement are spec 015; together the two make up package **P4** of the [port roadmap](../specs/010-port-roadmap/requirements.md).

Input arrives as DOM events in one place, becomes a gesture in a second, and becomes a state change in a third. Only the first touches the DOM, and only the third knows about application state.

```
DOM event  ->  mountGeneric.js  ->  pointerRouter.js  ->  a controller  ->  a state write
               hit-test             capture, drag,        button, value       and an action
               and plumbing         double-click          or scroll
```

## The gesture vocabulary

`runtime/pointerRouter.js` is pure: it takes positions and the id of whatever the renderer found under them, and returns a list of inputs, each addressed to a node.

| input | when |
|---|---|
| `pointerenter`, `pointerleave` | hover, and abandoning a held press |
| `pointerdown`, `pointerup` | a press and its release, always to the node that took the press |
| `dragstart`, `drag`, `dragend` | once the press has moved past the threshold |
| `doubleclick` | after the second qualifying release, in addition to both clicks |
| `secondaryclick` | a non-primary press, which takes no capture at all |
| `wheel` | fed directly by the renderer; it needs no gesture state |

Three constants, all named and exported:

| constant | value | meaning |
|---|---|---|
| `DRAG_THRESHOLD` | 3 px | below this a press is still a click |
| `DOUBLE_CLICK_MS` | 400 ms | the window for a second click |
| `DOUBLE_CLICK_SLOP` | 5 px | how far the second click may be from the first |

**Capture** is the part that makes controls usable. Once a press lands on a node, every later move and the release belong to that node, whatever the pointer is over. A slider is twenty pixels tall, so a real drag leaves it immediately; without capture there would be no slider, no scrollbar and no block selection.

Three details are deliberate:

- The first `drag` reports its delta from the **press point**, not from where the threshold was crossed, so a fast flick does not silently lose its first three pixels.
- Leaving the captured node emits `pointerleave`, which releases the held press, and coming back emits `pointerenter` and a fresh `pointerdown`. That is what a native button does.
- A `doubleclick` is emitted **after** the second `pointerup`, never instead of it. A type that ignores double-clicks therefore behaves exactly as it did before they existed, which makes adding one to a type a change that cannot regress anything.

## Behaviors

A component type declares which controller it gets. `runtime/behaviors.js` is the single table from that name to a factory, exactly as the draw-kind table is the single table from a draw kind to pixels.

| behavior | types | what it does |
|---|---|---|
| `button` | `button`, `radioItem`, `checkbox` | press, release, Enter and Space activate a command |
| `value` | `slider`, `spinBox` | drag and wheel move one bounded number |
| `scroll` | `viewport` | wheel, drag and thumb move a scroll offset |

An interactive type that names no behavior gets `button`, so every type that predates behaviors keeps its controller without an entry of its own. Every controller has the same three members, which is what lets the renderer keep one `feed()`:

```
handle(input) -> { transitions, activated, blocked, handled, changed?, value?, scrollTo? }
setDisabled(disabled) -> transitions
get state()
```

`handled` says the controller consumed the input. It is how the wheel can be offered to each ancestor in turn until one takes it, and how the renderer decides whether to suppress the browser default.

## Value controls

A value control does **not** hold its value. The bound state field does, so every input carries the current value and the controller returns a new one. That keeps one authority for the number and means a value written by an action or a capability is immediately what the control shows.

Which field holds it, first match wins:

1. the authored `field:`;
2. the mock field of a `change` action bound to the control, so a control and the action that reacts to it agree without the author naming the field twice;
3. a field derived from the node id, so a control with neither still works and is still visible in the State gallery.

`valueFieldOf` is shared by the renderer and the emitter, so the field a generated application declares is the field the renderer writes.

Bounds come from the authored `min`, `max` and `step`, defaulting to 0, 100 and 1. Every result is clamped and snapped to the step, on every path, so no gesture can produce an out-of-range or fractional value.

The two shapes differ by two options:

| | `slider` | `spinBox` |
|---|---|---|
| `mode` | `absolute`: the value follows the pointer's position | `relative`: it follows the pointer's movement |
| `axis` | `x` | `y`, and dragging up increases |
| a press | jumps to where it landed, as v1's sliders do | starts a drag, or steps once if it landed on the stepper |
| pixels per step | derived from the track and the range | four |

## Scrolling a viewport

The `viewport` spec [013](../specs/013-layout-foundations/requirements.md) built can now be scrolled three ways. All three compute a **requested** offset and write it to the bound field; the clamp stays in `runtime/genericLayout.js`, so no path can lose the content.

| gesture | requested offset |
|---|---|
| wheel | one 24-pixel step per notch |
| drag on the background | the content follows the pointer, one for one |
| drag on the scrollbar | proportional, so the thumb follows the pointer |

`runtime/scrollbar.js` holds the arithmetic all three share and the draw kind reads, so they cannot disagree about where the thumb is. It returns `null` when the content fits, which is how the draw kind decides not to draw a thumb and how the renderer decides not to show a grab cursor.

A viewport at either end does not consume the wheel, and a viewport with no bound field never consumes it at all. Both cases let an outer scroller take over, which is what makes a list inside a scrolling surface feel right.

## Events an action can bind to

`actions:` has always carried an arbitrary event key; before spec 014 only `click` had a consumer.

| event | fired by |
|---|---|
| `click` | an activation, from the pointer or from Enter or Space |
| `change` | a value control whose value moved, or a radio group whose choice changed |
| `doubleClick` | the double-click gesture |
| `secondaryClick` | a secondary press |

A binding with no `event` is a click, so every outline written before this keeps working. A `change` carries the new value, and the generated action module receives it as `detail`:

```yaml
- type: spinBox
  variant: big
  actions:
    - change: set number of tracks
```

A radio group's choices are authored as items, so the group is where its `change` action lives; the chosen item's name is the value.

Two additions to the recipe vocabulary make prose like the above resolve:

- `set <subject>` and `set number of <subject>` become a command named after the subject with a numeric field.
- An action reference with no document behind it is read as prose, with `camelCase` split into words. That is how `toggleRecording` reaches the `toggle recording` recipe, and it is why the record button was inert from spec 005 until now.

## Cursors

The registry declares one cursor per type. The renderer sets the canvas cursor from the node under the pointer, with two overrides: while a drag runs the dragged node owns the cursor wherever the pointer goes, and a viewport that cannot scroll falls back to `default`. Inspect mode keeps `crosshair` throughout, because the pointer there inspects rather than operates.

## File drag-and-drop

A drag of files over the canvas is acknowledged with a dashed border and kept from navigating the browser away. A drop reports the file names as a trace and calls `appContext.openFiles(files)` if the application has one.

The generated application has one through a **reserved host command**. A key in `capabilities.js` beginning `host.` is not authored in YAML and is not compiled from a binding: it is a hook the renderer offers, and the manifest says which module takes it. The emitter wires each into the app context in `app/main.js`, imported on first use.

```js
"host.openFiles": { module: "./domain/playback/index.js", export: "openFiles" }
```

Dropping a module file on the generated application therefore loads and plays it. The authoring preview passes no app context at all, so a drop there is a trace and nothing else, which keeps the promise that opening the workbench never starts an audio device.

## What the Interaction log shows

Every gesture is traced with the same sequence and time stamping as the existing entries: `dragstart`, `drag`, `dragend`, `wheel`, `doubleclick`, `secondaryclick`, a `value` entry when a number changes, a `scroll` entry with the applied offset, and a `filedrop` entry with the file names. A drag fires per pointer move, so its trace is coalesced to about one entry per animation frame; everything else is traced once per event.

A wheel offered to an ancestor that ignores it is not traced, so walking the ancestry does not fill the log.

## Known limits

- **Keyboard input is still the pre-014 minimum**: Tab moves focus, Enter and Space activate. The focus model where the focused element sees keys first, text entry with a caret, the declared shortcut table and command enablement are spec 015.
- **The redraw is not coalesced.** A drag re-lays out and redraws synchronously, as every other input already does. Batching into one animation frame is package P8, which wants measurement before it changes how every input redraws.
- **No horizontal scrolling**, and no cell-level hit-testing. Both arrive with the pattern grid in P7.
- **`scrollbar`, `knob` and `rangeSlider` are not component types.** A viewport draws its own thumb, because a standalone scrollbar needs binding vocabulary package P5 brings.
- **No touch or pen handling.** Pointer events cover a mouse-designed application, and v1 has no touch path either.
