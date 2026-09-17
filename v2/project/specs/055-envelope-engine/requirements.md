# 055 — The envelope editor's engine

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P11** (the remaining specialized surfaces) of the [port roadmap](../010-port-roadmap/requirements.md), following the VU meter (spec 054). Closes a real, already-recorded gap: specs 042 and 050 both listed "no envelope editing" among the sample editor's own known limits. This spec is the headless mechanism only, matching the "engine, then interactive leaf, then screen" pattern loop creator (043/044/045) and the multitrack arrangement view (051/052/053) already completed - the port's eighth specialized-component leaf will follow in a later spec, then its screen.

## Purpose

`script/src/ui/envelope.js` (239 lines) and `script/src/ui/envelopePanel.js` (258 lines), both read in full for this spec, together let a FastTracker instrument's volume and panning envelopes be edited: drag a point, add or remove a point, toggle the envelope on/off, and set a sustain point or a loop range. The envelope *data itself* is already fully ported (`domain/playback/engine/models/instrument.js#volumeEnvelope`/`panningEnvelope`, and `engine/fileformats/fasttracker.js#processEnvelope`, which reads it from a real XM file) - nothing here needs new engine data, only capabilities to mutate what already loads correctly. This spec builds those capabilities as a new internal sibling module, `domain/sampleEditor/envelope.js`, mirroring `loopCreator.js`'s own precedent exactly: the domain-level equivalent of v1's own delta-driven drag handlers, so a later leaf only has to compute a candidate value and hand it to an already-clamping setter.

## What v1 actually does, and what this narrows out (read from source, not assumed)

**The envelope's own shape**: `{raw: [], enabled, points: [[x,y], ...], count, type, sustain, sustainPoint, loop, loopStartPoint, loopEndPoint}`. `x` ranges `0-324` (roughly one tick per unit - the panel's own canvas is 324px wide, one unit per pixel at the identity zoom `envelope.js` always uses); `y` ranges `0-64`. `sustain`/`loop` and their own point indices are only ever set to `true`/a real value while parsing a real XM's own envelope-type bitmask (`fasttracker.js:168-180` - bit 1 enabled, bit 2 sustain, bit 4 loop); nothing in v1 ever explicitly sets them back to `false`/`0` on a fresh instrument, so every read in `envelopePanel.js#setInstrument` is written falsy-safe (`envelope.sustain`, `envelope.sustainPoint || 0`) - this spec's own accessor does the same, rather than assuming a field is always present.

**Add a point** (`envelopePanel.js:40-61`): a no-op unless the envelope is already `enabled` (both this and remove share that guard - easy to miss, since it sits above both button handlers rather than being named as a shared precondition). If `count` is already less than the array's own stored length (a point removed earlier, still sitting in `points` past `count`), the *existing* point at index `count` is reused - repositioned only if it would not sit strictly after the previous point - and `count` increments; otherwise a brand-new point is appended 10 units after the last one and `count` becomes `points.length`. Either way, nothing happens if the previous point's own `x` is already within 10 of the panel's own right edge (320) - v1's own guard, not merely "if there's room for one more point at all."

**Remove a point** (`envelopePanel.js:67-79`): also a no-op unless the envelope is `enabled`. Only when `count > 2` (an envelope needs at least two points to mean anything), decrements `count` and then re-clamps `sustainPoint`/`loopStartPoint`/`loopEndPoint` down to `count - 1` if any now point past the new, smaller count (`checkMax`) - the same re-clamp also runs after every sustain/loop spinbox's own `onChange`, not only after a remove.

**Drag a point** (`envelope.js:36-110`): hovering finds the nearest point within a 6-unit box (first match wins, in point order - there is no priority rule to port since points are drawn left to right and never overlap in practice); dragging clamps `x` between the *previous* point's own `x` (exclusive on the low end, since `minX` is set to it directly and the drag can reach it) and either the *next* point's own `x` or `324` for the last point, and clamps `y` to `0-64` unconditionally; point 0 can never move horizontally at all (`minX`/`maxX` both set to `0`).

## Decisions and assumptions

- **A new internal sibling module, `domain/sampleEditor/envelope.js`**, not folded into `index.js` itself - the same precedent `loopCreator.js`/`resample.js` already set: state and math large and distinct enough from `index.js`'s own plain scalar setters to warrant its own file, imported directly by a later leaf's own controller, not re-exported through `index.js` under its own name.
- **One module, both envelope types**, distinguished by a `type` parameter (`"volume"`/`"panning"`) on every function - v1 itself parameterizes the identical way (`Envelope(type)`/`EnvelopePanel(type)`, each instantiated twice), so this mirrors that rather than duplicating the file.
- **Every setter reaches the current instrument only through `domain/song`'s own public surface** (`getCurrentInstrument`), never `domain/playback/engine/` directly - the same boundary `loopCreator.js`/`resample.js` already keep.
- **No undo.** v1's own `trackUndo`/`undoInstrument` flags on the surrounding spinboxes are the *general* instrument-property-undo mechanism spec 042 already recorded as missing, port-wide - not something this spec re-opens or works around on its own. A point drag itself has no undo in v1 either (only the spinboxes do, and only through that missing general mechanism).
- **Points are read by reference, not copied.** A later leaf's own controller and draw kind read `getEnvelope(type)`'s own `points` array directly, the same "specialized leaf reads the domain model directly" contract every other one already has (`patternGrid`, `loopCreatorView`, `nibblesGrid`) - not a value the generic store-bound `field` mechanism would ever hold, since it is a variable-length array of pairs, not a scalar.
- **`setPoint` computes its own clamp bounds from the current envelope**, rather than requiring the caller to pass them in - unlike `loopCreator.js`'s own setters (each of which the *controller* already has a bounds argument for, from its own zoom/session state), an envelope point's bounds are entirely determined by its own neighbors and the fixed `0-324`/`0-64` ranges, so there is nothing session-specific for a caller to supply.

## User stories and acceptance

- **ENV-001 — `getEnvelope` returns a safe, falsy-default shape for both envelope types, for any instrument state.** No current instrument, an instrument with no envelope data at all, and a real XM instrument's own real envelope each return a well-formed `{enabled, points, count, sustain, sustainPoint, loop, loopStartPoint, loopEndPoint}` - never `undefined` fields. Acceptance: unit tests for all three, against a real loaded `.xm` fixture for the third.
- **ENV-002 — `setPoint` clamps exactly like v1's own drag handler.** Point 0 never moves horizontally; every other point's `x` clamps to its own immediate neighbors (or `324` for the last point); every point's `y` clamps to `0-64`. Acceptance: unit tests for the first point, a middle point (both edges), and the last point.
- **ENV-003 — `addPoint`/`removePoint` match v1's own exact rules, including the reuse-vs-append branch and the edge-of-canvas guard.** Acceptance: unit tests reproducing each of `envelopePanel.js`'s own branches: append when `count === points.length`, reuse-in-place when a point already exists past `count`, the `count > 2` floor on remove, and the guard against adding past `x = 320`.
- **ENV-004 — Removing a point re-clamps `sustainPoint`/`loopStartPoint`/`loopEndPoint`, and so does setting any of the three directly.** Acceptance: unit tests for both trigger paths.
- **ENV-005 — `setEnabled`/`setSustain`/`setLoop` toggle their own flag with no other side effect**, matching v1's own checkbox handlers exactly (no re-clamp on enabling/disabling itself - only the spinbox/removal paths re-clamp). Acceptance: unit tests per toggle.
- **ENV-006 — No regressions.** Full unit suite passes; `node build.mjs app`/`dist` unaffected (no YAML/compiler/`capabilities.js` change - this spec is headless, matching spec 039/040/043/047/051's own precedent for an engine-first spec).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No new authoring mechanism, no YAML, no `capabilities.js` mapping - nothing here is reachable from any UI yet.

## Scope boundaries

In scope: `domain/sampleEditor/envelope.js` (new), and tests for it.

Out of scope, recorded rather than silently dropped:

- **The interactive drag-based envelope graph** (`envelope.js`'s own hover/drag hit-testing and drawing) - the port's eighth specialized-component leaf, a real, later spec's own, the same way `loopCreator.js`'s state model (043) preceded its own overlay (044).
- **The surrounding panel** (title bar, enable checkbox, add/remove buttons, sustain/loop checkboxes and spinboxes) and **wiring it twice** (volume and panning) into the sample-editor screen - a later spec's own, the same way spec 045 was the loop creator's own screen.
- **Instrument-property undo** - unchanged from spec 042's own recorded, port-wide limitation.
