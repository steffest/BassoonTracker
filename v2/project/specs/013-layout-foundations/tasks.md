# 013 — Implementation

Status: implemented and verified 2026-09-10.

- [x] `runtime/genericLayout.js`: a clip per node, a viewport that clips and offsets its content and reports its extent, an overlay pass laid out against the viewport, and authored direction ahead of the type's and the fixed-height default.
- [x] `runtime/hitTest.js`: a point must be inside a node's clip as well as its rect; `clip` is optional so nothing else had to change.
- [x] `runtime/componentTypes.js`: the `viewport` type, and `clips`, `layer` and `modal` on the entry shape.
- [x] `renderers/canvas/mountGeneric.js`: clipped drawing that skips the save/restore when the clip already contains the rect and skips the draw when the clip is empty; overlays painted after the tree in declared order; one modal gate in front of every pointer path; the scroll offset read from state.
- [x] `compiler/{layoutFields,convert}.js`: `layout.direction`, with a warning for an unsupported value.
- [x] Skin styles for the viewport, authored and built-in.
- [x] `tests/layoutFoundations.test.js` and browser scenario 9.

## Evidence

`node --test "v2/tests/*.test.js"`: 135 tests, 133 passing, 2 skipped, up from 127. Eight new cases covering clips being total and only narrowed by a clipping type, a viewport clipping and reporting its extent, offsets applied and clamped both ways, a clipped-away control not being hit where it is not visible, an overlay laid out against the viewport and free of its parent's box, overlay paint order, and the three-level direction resolution.

Browser scenario 9, 9 checks, all passing, mounting a hand-built tree through the public renderer API:

| check | result |
|---|---|
| a 60-pixel viewport holding twelve rows | 2,621 lit pixels inside it, **0** below it where the clipped rows were laid out |
| the sibling after the viewport | still drawn, so clipping did not swallow the flow |
| the bound field | changing it changes the top row's pixels |
| an absurd offset | clamped: 2,612 pixels still drawn rather than an empty box |
| a visible row | activates on click |
| a modal overlay | drawn centred over the tree, 837 lit pixels |
| a control behind the modal | cannot be activated |
| hygiene | nothing thrown |

The other eight scenarios were re-run: 111 checks, all passing. The application's own rendering is unchanged, because only a viewport clips and the application has none yet.

## Found while doing it

- **The overlay and modal fields have no consumer yet**, since `dropdown`, `menu`, `modalDialog` and `tooltip` are package P5. Rather than invent a type this spec does not deliver, both the unit tests and the browser scenario declare a throwaway type exactly the way P5 will declare one, and remove it again. That keeps the mechanism verified without pretending it has a user.
- **Two test fixtures were wrong before the code was.** A viewport's content extent is its own inner width, not its parent's, and a row that *starts* inside a 20-pixel box can still *extend* past it. Both were my arithmetic, corrected against the real layout rather than by loosening the assertion.
- **A clip's bounds are inclusive**, so the very first pixel row of a clipped-away control still counts as inside it. That matches the pre-existing hit-test semantics and is left alone; the test samples a few pixels in and says why.
- **A panel's own 9-slice border reads as content** to a pixel counter, one bright pixel down each edge for the full height. The scenario's strips avoid the outer 20 pixels and say so, which is the difference between a real clipping check and one that always passes.

## Amendment 2026-09-10 (found by spec [014](../014-pointer-interaction/requirements.md))

**A viewport did not move when its bound field was written from outside the renderer.** `mountGeneric.js` redrew on a state change but did not re-lay out, so the rows kept the rectangles the previous pass had given them. The claim in this document that "changing the bound field moves the content" was therefore only half true: the field was clamped and recorded correctly, and nothing acted on it.

The browser scenario had passed because its check rested on a pixel fingerprint of the top row, which changed for an unrelated reason. Spec 014 split the canvas resize from the layout pass, re-lays out on any state change, and rewrote the check to assert the applied offset as well as the pixels. The nine checks in the table below all still pass, and the third one now means what it says.

The wider lesson is recorded rather than fixed by policy: a check that samples pixels needs a second, structural assertion beside it, or it can pass over the absence of the thing it is checking.

## Known limits

Interactive scrolling is not here: a viewport moves only when its bound field changes, and wheel, drag and a scrollbar thumb arrive with package P4. **Delivered 2026-09-10 by spec [014](../014-pointer-interaction/requirements.md)**, which added all three; the clamp stayed here, so every path is bounded by this pass. Horizontal scrolling waits for the pattern grid in P7. `align`, minimum and maximum sizes, and the declared breakpoints that replace v1's hand-written cascade are P5, when the screens ask for them.

Only a viewport clips. A panel deliberately does not, because clipping the flow would hide the overflow an author needs to see, and because it is what keeps the current application's rendering identical. The application still overflows its control bar; that is now a visible authoring problem rather than a renderer limitation.
