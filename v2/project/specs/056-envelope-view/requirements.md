# 056 — The interactive envelope view

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P11** (the remaining specialized surfaces) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 055 (the envelope editor's own headless engine). Gives that mechanism its interactive front end - the port's eighth specialized-component leaf, after `patternGrid` (030), `fileBrowser` (035), `waveformView` (041), `loopCreatorView` (044), `nibblesGrid` (047), `multitrackView` (052) and `volumeMeter` (054).

## Purpose

Spec 055 built every setter a drag controller needs, already clamping exactly as v1's own inline drag math does - the interaction itself deliberately deferred, the same split spec 043 (loop creator) already established for its own overlay. This spec is that interaction: `script/src/ui/envelope.js`'s own `onHover`/`onDragStart`/`onDrag` (36-110) and `render` (127-232), read in full for spec 055 already and re-read here for the drawing detail.

**A genuinely new authoring need, not yet hit by any prior specialized leaf**: this is the first leaf this port has built that needs to know *which* instance of a shared concept it addresses - v1 itself parameterizes the identical way (`Envelope(type)`/`EnvelopePanel(type)`, each instantiated twice, once for `"volume"` and once for `"panning"`). Every specialized leaf so far (patternGrid, the waveform view, the loop creator, Nibbles, the multitrack view, the VU meter) addresses exactly one domain concept with no variant at all. Resolved the same way `rangeSlider`'s own per-node `vertical` override already works (spec 018): one new node-level property, `envelopeType`, merged into the controller's own construction options in `mountGeneric.js` exactly where `node.vertical` already is - not two separate component types (which would duplicate a type registration, a behavior-name-collision test entry and a draw-kind entry for a difference that is otherwise nothing but which data the same leaf reads).

## What v1 actually does, and what this narrows out (read from source, not assumed)

**Coordinate space.** The canvas is always treated as a fixed 324x64 logical grid (`xScale = width/324`, `yScale = height/64`), with logical `y` measured from the *bottom* (`y = Math.round((height - eventY)/yScale)`) - an envelope's own value increases upward, the opposite of screen-pixel `y`.

**Hover** (`onHover`, 36-75) only ever runs while not already dragging, and only when the envelope is `enabled` - a disabled envelope has no hover target at all, matching spec 055's own `addPoint`/`removePoint` guard. It finds the *first* point (in index order) within a 6-logical-unit box of the pointer and records, alongside its index, the exact bounds `setPoint` (spec 055) already independently reproduces - point 0 fixed at `x=0`, every other point's `x` bounded by its own immediate neighbors (or 324 for the last point), `y` always 0-64.

**Drag** (`onDragStart`/`onDrag`, 78-110) is relative, not absolute: it captures the active point's own `x`/`y` at drag start, tracks the pointer's own logical-space delta since then, and applies `start + delta` (clamped by `setPoint`, not duplicated here) on every move - a point never jumps to wherever the cursor currently sits, it moves by how far the cursor has moved, matching v1's own feel exactly. Nothing is deferred to release: v1 calls `me.refresh()` (and, with this port's own `setPoint`, would mutate the real value) on every `onDrag`, not only on `onTouchUp` - unlike the multitrack view's own note-drag (spec 052), there is no "ghost while dragging, commit on release" shape here, because there is nothing to revert to (envelope point edits have no undo in v1 either - spec 055's own recorded limitation, unchanged).

**Drawing** (`render`, 127-232): a background fill; for the `"panning"` variant only, a dashed horizontal reference line at mid-height; if the envelope has any points at all, a connecting line plus one small square per point (orange `#D2861B` when enabled, a muted blue-grey `#546888` when not; the hovered/active point drawn larger and white); and, only while enabled, a dashed vertical sustain line (cyan `#67b6d2`) and two dashed vertical loop lines (yellow `#d2b637`).

## Decisions and assumptions

- **One new node-level property, `envelopeType`** (`"volume"`/`"panning"`), read by `mountGeneric.js`'s own controller-construction loop the same way `node.vertical` already overrides `rangeSlider`'s own axis - not two component types. One controller factory, one draw kind, one behavior name.
- **A new `renderers/canvas/envelopeGeometry.js`** (pure): the logical-space conversion (`toLogical`/`toPixel`) and the nearest-point hit test (`pointAt`) - the same "shared by drawing and hit-testing" role every other specialized leaf's own geometry module already has. The *clamping* bounds themselves are not duplicated here at all - `setPoint` (spec 055) already owns them; this controller only ever computes a candidate value and hands it over, the same split spec 044's own `loopCreatorController.js` already established for its own eleven drag targets.
- **Dragging is relative, computed from two `toLogical` conversions (at drag-start and on each move), not from raw pixel deltas divided by scale.** Mathematically identical as long as the rect does not resize mid-gesture (true for any single drag), and it reuses the same pure conversion function the hit test and the draw kind already need, rather than a second, parallel scale computation.
- **No "commit on release."** Every drag event calls `setPoint` directly, matching v1's own live-update-during-drag exactly - there is nothing to revert on a cancelled drag (no undo either way), so no ghost/snapshot machinery is needed the way the multitrack view's own note-drag (spec 052) needs one.
- **The background is a flat fill, not the scale-9 dark panel image** - the same flat-fill simplification every specialized leaf's own background already makes (`nibblesGrid`, `multitrackView`, `volumeMeter`).
- **Continuous hover tracking needs one small, additive widening of an existing mechanism**: `mountGeneric.js`'s own `handlePointerMove` already forwards a fine-grained `"pointermove"` event with the live point to exactly one behavior today (`"flyout"`, for a submenu's own per-row hover preview - spec 020). This leaf needs the identical thing (which point is nearest the pointer, updated continuously, not just on entering/leaving the whole node) - the check is widened to include this leaf's own behavior name too, not given a second, parallel mechanism.

## User stories and acceptance

- **VIEW-001 — Hovering finds the nearest point within the fixed 6-unit box, first match in index order, and none at all on a disabled envelope or while already dragging.** Acceptance: pure geometry unit tests for `pointAt` (a hit, a miss, two points close enough that only the first-in-order one should ever win) and controller unit tests for the disabled/dragging gates.
- **VIEW-002 — Dragging the active point moves it by the pointer's own logical-space delta from where the drag started, clamped by `domain/sampleEditor/envelope.js#setPoint` - never a jump to the cursor's own absolute position.** Acceptance: controller unit tests against a real loaded `.xm` fixture's own real envelope, checking the exact resulting point position for a known delta, including a delta large enough to be clamped.
- **VIEW-003 — The draw kind never throws; draws the panning-only reference line, the connecting line and per-point squares (colored by enabled state, the active one larger/white), and the sustain/loop dashed lines only while enabled.** Acceptance: a fake-canvas-context test mirroring `loopCreatorView.test.js`'s/`multitrackView.test.js`'s own convention.
- **VIEW-004 — `envelopeType` reaches the controller from a per-node authored property, the same way `rangeSlider`'s own `vertical` override already does.** Acceptance: a `componentTypes.js`/`mountGeneric.js` unit test constructing two controllers off the same behavior with different `node.envelopeType` values and confirming each reads its own instrument's own envelope.
- **VIEW-005 — No regressions.** Full unit suite passes; `node build.mjs app`/`dist` unaffected (no YAML/compiler/`capabilities.js` change - this type is registered but not yet placed in any component tree, exactly as `loopCreatorView`/`multitrackView` each were between their own mechanism and screen specs).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No new authoring mechanism beyond the one node-level property (`envelopeType`) - no YAML placement yet.

## Scope boundaries

In scope: `renderers/canvas/envelopeGeometry.js` (new, pure), `runtime/envelopeController.js` (new), `runtime/behaviors.js`/`runtime/componentTypes.js`/`renderers/canvas/drawKinds.js`/`renderers/canvas/mountGeneric.js` registrations (including the one node-level `envelopeType` property and the `pointermove` widening), and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **The surrounding panel** (title bar, enable checkbox, add/remove buttons, sustain/loop checkboxes and spinboxes) and **wiring it twice** (volume and panning) into the sample-editor screen - a later spec's own, the same way spec 045 was the loop creator's own screen.
- **Dynamic cursor hinting** - the same recorded omission `loopCreatorView` (spec 044) and `multitrackView` (spec 052) already made.
- **Instrument-property undo** - unchanged from spec 042's own recorded, port-wide limitation.
