# 014 — Pointer interaction: capture, drag, wheel, scrolling and value controls

Date: 2026-09-10. Kind: feature. Status: specified. Implements the pointer half of package **P4** of spec [010](../010-port-roadmap/requirements.md), the port roadmap.

## Purpose

The behavior controller v2 has today knows four things: hover, press, focus, and Enter or Space. v1 attaches pointer handlers at over three hundred sites, and almost none of them are a plain click:

- **Every slider, knob, scrollbar, the piano and block selection is a drag**, captured to the element that received the press. Release outside the element still completes the gesture, and a press that never moves must stay a click.
- **Every numeric control is a wheel.** v1 wires `mousewheel` on its spin boxes, its sliders and its pattern view.
- **Every list and the pattern grid scroll.** Spec [013](../013-layout-foundations/requirements.md) built the viewport that clips and offsets content, and deliberately left wheel, drag and the thumb to this package.
- **Double-click and secondary click open things.** v1 uses a double-click to open a sample and a right-click for its context menus.

Without pointer capture there is no drag, and without a drag there is no slider, no scrollbar and no selection. That makes this the piece the rest of the catalogue waits on.

## Scope decision

Package P4 as the roadmap wrote it also covers the focus model, text entry with a caret, the declared shortcut table, command enablement, tooltips and dialog keys. Those are keyboard and command work; they share nothing with pointer capture except the renderer they land in. Splitting P4 in two gives two landings that can each be verified on their own, so:

- **this spec** is the pointer half: capture, drag, wheel, scrolling, double and secondary click, cursor shapes, file drag-and-drop, and the first controls that need them;
- **spec 015** is the keyboard and command half.

Package P4 is complete when both are.

## User stories and acceptance

- **INT-001 — A press captures the pointer:** As a user, once I press on a control, that control keeps receiving my pointer until I release, wherever the pointer goes. Acceptance: moves after a press route to the pressed node even when they leave its rect and even when they land on another control; the release completes the gesture on the captured node; a release outside the node's rect does not activate it, matching the existing button semantics; losing the pointer (a `pointercancel`, the window blurring) cancels without activating.
- **INT-002 — A press that moves becomes a drag:** As a user, dragging a control adjusts it continuously; clicking it still activates it. Acceptance: movement below a documented threshold stays a click; movement past it starts a drag, and the intervening motion is not lost — the first drag event reports the delta from the press point, not from the threshold crossing; the drag reports its running delta and its current point; releasing ends the drag; a node that dragged does not also activate.
- **INT-003 — The wheel reaches the control under the pointer:** As a user, the wheel over a control adjusts it and does not scroll the page. Acceptance: a wheel event is routed by hit-test to the deepest node that accepts it, and to its nearest scrollable ancestor otherwise; a node that consumes it prevents the page default; a wheel over nothing is left alone; horizontal wheel deltas are reported but unused, so the pattern grid can pick them up in P7.
- **INT-004 — A viewport scrolls by wheel, drag and thumb:** As a user, a list scrolls with the wheel, by dragging its background, and by dragging its scrollbar. Acceptance: the wheel scrolls by a documented step and stops at both ends; dragging the viewport background moves the content with the pointer; a thumb is drawn only when the content overflows, sized and positioned from the extent spec 013 already reports, and dragging the thumb scrolls proportionally; every path writes the same bound state field and is clamped by the same layout code, so no path can lose the content; a viewport with no bound field does not scroll and says so through its cursor.
- **INT-005 — Double-click and secondary click are distinct gestures:** As a user, a double-click and a right-click each do their own thing and neither is confused with a click. Acceptance: two clicks within a documented time and distance produce one double-click event *in addition to* the two ordinary activations, so a type that ignores it behaves exactly as before; a secondary press produces a secondary-click event and never presses or activates the control; the browser context menu is suppressed over the canvas.
- **INT-006 — A value control drags and wheels to a number:** As an author, a `slider` and a `spinBox` hold a number, bounded by `min` and `max` and moved in steps of `step`. Acceptance: dragging moves the value proportionally along the control's main axis; the wheel moves it one step per notch; the value is clamped, quantized to the step, and written to the bound state field; the control draws its current value; a `change` action bound to the control is dispatched with the new value; a drag dispatches while dragging, not only on release.
- **INT-007 — The cursor says what a control does:** As a user, the pointer shape tells me whether something is clickable, draggable or inert. Acceptance: a component type declares its cursor once in the registry; the canvas cursor follows the node under the pointer; while a drag is in progress the cursor stays the dragging shape regardless of what the pointer is over; Inspect mode keeps its own crosshair.
- **INT-008 — A file can be dropped on the application:** As a user, dragging a module file onto the application loads it. Acceptance: a drag over the canvas is acknowledged visually and the browser's own navigation is suppressed; a drop reports the dropped files to the application through the app context; the generated application loads the first dropped module through the playback capability; nothing happens in the authoring preview beyond a trace, because the preview must not start audio.
- **INT-009 — Every gesture is traceable:** As an author, the Interaction log shows the gestures, not just the clicks. Acceptance: capture, drag start, drag, drag end, wheel, scroll, double-click, secondary click, value change and file drop each emit a trace entry with the node, the numbers involved, and the same sequence and time stamping as the existing entries; a drag emits at most one entry per animation frame so the log stays readable.
- **INT-010 — No regressions:** Acceptance: the unit suite passes; the application's existing controls behave exactly as before for a plain click; the compiled outline's existing nodes do not change shape or identity; every earlier browser scenario still passes.

## Non-functional requirements

Gesture recognition is pure and DOM-free, in `runtime/`, so capture, thresholds and double-click windows are unit-testable without a browser. The renderer stays the only DOM consumer. No component type is named outside the registry: a type declares its behavior and its cursor, and the renderer reads them. A drag must not force a layout pass per pointer move beyond the one the existing redraw already does. No new dependency.

## Scope boundaries

In scope: pointer capture, drag recognition, wheel routing, viewport wheel/drag/thumb scrolling, double and secondary click, the `slider` type, promoting `spinBox` to implemented, declared cursors, file drag-and-drop, the traces for all of it, and the `change` event reaching an action.

Out of scope and deliberately left to spec 015: the focus model and key routing, text entry, the shortcut table, command enablement, tooltips, and Enter or Escape in a dialog. Out of scope entirely here: horizontal scrolling and cell-level hit-testing (P7), the remaining catalogue types including `scrollbar` as a standalone component, `knob` and `rangeSlider` (P5), MIDI input (a capability, not input plumbing), and touch or pen pressure, which v1 does not use either.
