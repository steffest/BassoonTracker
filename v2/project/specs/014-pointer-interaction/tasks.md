# 014 — Implementation

Status: implemented and verified 2026-09-10.

- [x] `runtime/pointerRouter.js`: pure gesture recognition — pointer capture, the drag threshold with the delta measured from the press point, leave and re-enter while held, the double-click window and slop, secondary clicks that take no capture, and a cancel that ends a gesture without activating.
- [x] `runtime/behaviors.js`: the one table from a declared behavior name to a controller factory.
- [x] `runtime/valueController.js`: the `value` behavior, in absolute and relative modes, with a stepper, plus `boundsOf`, `valueFieldOf` and `quantize` shared with the renderer, the draw kinds and the emitter.
- [x] `runtime/scrollController.js` and `runtime/scrollbar.js`: the `scroll` behavior and the thumb arithmetic the controller, the draw kind and the cursor all read.
- [x] `runtime/buttonController.js`: a press that became a drag releases without activating, and every result reports `handled`.
- [x] `runtime/componentTypes.js`: `behavior`, `behaviorOptions` and `cursor` on the entry shape; the `slider` type; `spinBox` promoted to implemented; `viewport` made interactive with the `scroll` behavior.
- [x] `renderers/canvas/drawKinds.js`: the `slider` and `spinBox` kinds, and a thumb on the `background` kind when the renderer reports an overflowing extent.
- [x] `renderers/canvas/mountGeneric.js`: the router replaces four hand-tracked pointer variables; wheel routed up the ancestry until a controller takes it; `activate` generalized to `dispatch(id, event, detail)` for click, change, double-click and secondary click; the canvas cursor; file drag-and-drop; the value and scroll writes; the traces.
- [x] `runtime/skinModel.js`, `compiler/skin.js` and the authored skin: `thumbStyle`, plus `slider` and `spinBox` styles that need no new artwork.
- [x] `compiler/{convert,recipes}.js`: a numeric declared property reaches the node as a number; the `action` alias of `actions` is read; a `set <subject>` recipe; an action reference with no document behind it read as prose.
- [x] `compiler/emit.js` and `runtime/components.js`: every declared property carried generically; one hook per authored event in `on`; numeric initial values for value and scroll fields; reserved `host.` capabilities wired into the app context.
- [x] `capabilities.js` and `domain/playback/index.js`: `host.openFiles`, so a module dropped on the generated application is loaded and played.
- [x] `workbench/interactionLog.js`: the three new trace kinds listed in the filter set, with their own detail formats. A kind missing from that list is hidden, not merely uncoloured, so emitting a trace is not the same as showing it.
- [x] `tests/pointerInteraction.test.js` (24 cases) and browser scenario 10, in three parts: a hand-built tree, the real application, and the workbench's Interaction log.

## Evidence

`node --test "v2/tests/*.test.js"`: 161 tests, 159 passing, 2 skipped, up from 135. Twenty-four new cases plus three updated ones.

Browser scenario 10, 23 checks, all passing, driving real Chrome input events. Part A uses a hand-built tree holding a slider, a spin box, a scrolling viewport and a button carrying all three event hooks:

| check | result |
|---|---|
| pressing a slider at a quarter of its track | value 25 |
| dragging it, ending 260 pixels below the control | value 90, so capture held throughout |
| the thumb | moved from the left of the track to the right |
| the wheel on a spin box | 4 up to 5, then twice down to 3 |
| pressing the stepper's top half | one step |
| the wheel over a *row inside* the viewport | scrolled the viewport by one 24-pixel step |
| dragging the viewport background up 40 pixels | offset 24 to 64 |
| dragging the thumb 10 pixels | offset 64 to 112, so proportionally further |
| dragging across a button | no activation at all |
| a double-click | `click, click, doubleClick`, in that order |
| a right-click | `secondaryClick` only, never a click |
| cursors | `ew-resize` on the slider, `pointer` on the button, `default` on the panel, and still `ew-resize` while dragging the slider over the panel |
| a dropped file | acknowledged, kept from the browser, and handed to the application |
| the Interaction log | every one of `dragstart`, `drag`, `dragend`, `wheel`, `doubleclick`, `secondaryclick`, `value`, `scroll`, `filedrop` |
| drag coalescing | 8 drag entries out of 134 |
| the real application's spin box | draws artwork, not a placeholder |

Part C drives the real workbench, because a renderer emitting a trace is not the same as the log showing it. The log offers a filter for `value`, `scroll` and `filedrop`; a wheel over the *authored* spin box, located by asking the preview for its rectangle, is logged as a wheel with its delta, as a value change reading `tracks.value: 0 → 1`, and as the `tracks.set` command it is bound to, marked `on change`.

The other nine scenarios were re-run: 125 checks, all passing. Total 148 checks across ten scenarios, none failing.

`node build.mjs`: all three targets. Entry chunk 63,553 bytes, up from 46,248; the playback engine stays in a lazy 70,441-byte chunk, and the dropped-file hook is imported on first use so it does not pull that into the entry.

The authored application's compile went from 13 warnings to 9: three action references that had never resolved now do, and the spin box is no longer an unsupported component.

## Found while doing it

- **Three of the application's authored actions had never done anything**, and one had never even been read. `- click: toggleRecording` named an action document that does not exist, so the record button had been inert since spec 005; `action:` is documented as an alias of `actions:` but only `actions:` was parsed, so the third radio group's binding was dropped silently. Reading a bare reference as prose and honouring the alias fixed both, and the record button now reaches the red active artwork the skin has always described for it. That artwork was previously only checkable in the workbench's variant library.

- **A state change did not re-lay out, only redraw.** Spec 013's viewport therefore did not move when its bound field was written from outside the renderer: the rows kept their old rectangles. The browser scenario had passed on a pixel fingerprint that changed for an unrelated reason. Fixed by splitting the canvas resize from the layout pass and re-laying out on any state change, and the scenario now asserts the applied offset. Recorded as a dated amendment on spec 013.

- **The registry made `interactive` ambiguous.** A viewport needs a controller but is not a control. Rather than invent a second flag, `interactive` keeps its documented meaning — "the renderer gives it a behavior controller" — and `behavior` says which. Two tests that pinned the list of interactive types were rewritten to derive it from the registry and assert the *rule*, so a future interactive type does not fail them.

- **Two tests and one scenario used `spinBox` as their example of a declared-but-unimplemented type.** Promoting it broke all three. They now use `menu`, and one of them additionally checks an implemented type's declared property, so the pair covers both sides of the distinction rather than resting on which types happen to be finished.

- **A slider's `min: 1` reached the node as the string `"1"`.** The registry already declares the property's kind, so the compiler now converts a declared `number` and warns when the value is not one. That is a small thing that would otherwise have been rediscovered by every numeric control.

- **The thumb is brighter than its track, not darker**, and hover washes the whole control lighter. Two versions of the scenario's thumb check were wrong before the code was; the third parks the pointer away and compares the two ends of the track to each other.

- **The Interaction log would have hidden all three new kinds.** Its filter set starts as exactly the list of kinds it knows, so a kind missing from that list is filtered out rather than shown uncoloured. The requirement said "appears in the Interaction log", and satisfying it at the trace level only would have been a false pass; the workbench part of the scenario exists because of this.

- **The preview seeded a value control's field from the wrong side.** A command binding with no mock values seeded the field with the empty string before the control's own numeric seed could, so the first change read `→ 1` instead of `0 → 1`. The renderer now seeds the fields a control *owns* before the fields its bindings mention, which is the order the emitter already used, and is why the preview and the generated application now start from the same numbers.

## Known limits

Keyboard input is still the pre-014 minimum: Tab moves focus, Enter and Space activate. The focus model, text entry, the shortcut table, tooltips, dialog keys and command enablement are spec 015, which completes package P4.

The redraw is not coalesced: a drag re-lays out and redraws synchronously, as every input already does. Batching into one animation frame is package P8, which wants measurement first, and doing it here would have changed how every input redraws on no evidence.

There is no horizontal scrolling and no cell-level hit-testing; both belong to the pattern grid in P7. `scrollbar`, `knob` and `rangeSlider` are not component types: a viewport draws its own thumb, and a standalone scrollbar needs the binding vocabulary P5 brings. Touch and pen are not handled, which matches v1.
