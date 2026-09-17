# 056 — Tasks

Status: done.

- [x] Re-read `envelope.js` (36-232) closely, beyond spec 055's own high-level pass, for the drag/hover/drawing detail.
- [x] `renderers/canvas/envelopeGeometry.js` (new).
- [x] `runtime/envelopeController.js` (new).
- [x] `runtime/behaviors.js`: registers `envelope`.
- [x] `runtime/componentTypes.js`: `envelopeView` type entry (with the new `envelopeType` property).
- [x] `renderers/canvas/drawKinds.js`: `envelopeView` draw kind.
- [x] `renderers/canvas/mountGeneric.js`: the `node.envelopeType` controller-options override; the `pointermove` forward widened to include `"envelope"`.
- [x] `tests/envelopeGeometry.test.js`, `tests/envelopeController.test.js`, `tests/envelopeView.test.js` (all new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no YAML/`capabilities.js` change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment). Pure geometry unit tests, controller unit tests against a real loaded fixture, and a fake-canvas draw test - the same three-layer verification `loopCreatorView`/`multitrackView` already used.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - unchanged, this spec authors no YAML. `node build.mjs app`: loose ends unchanged at 87.
- `tests/envelopeGeometry.test.js`: 5 new tests - `toLogical`'s own y-flip, `toPixel` as its exact inverse across a range of rect sizes, `pointAt`'s hit/miss/first-in-order/missing-point cases.
- `tests/envelopeController.test.js`: 11 new tests - hover/focus/blur, `envelopeType` defaulting and honoring an explicit value, hover finding a real point (and never on a disabled envelope, and freezing while dragging), a synthetic pointerdown-with-no-prior-hover still finding its point, a miss not starting a drag, a real relative drag (including its own clamp) against `sin.xm`'s own real envelope, confirming the drag is relative (not an absolute jump), `setDisabled` and `blur` both cancelling an in-progress drag.
- `tests/envelopeView.test.js`: 6 new tests - registry declaration (including the new `envelopeType` property), `measure()`, draw-never-throws with no instrument, the panning-only reference line appearing only for that variant, a real enabled envelope's own points/line/active-point/sustain-line (and no loop line, matching this fixture), a real disabled envelope's own muted points with neither line.
- Full suite: `node --test tests/*.test.js` -> 835/835 passing (813 before this spec + 22 new).

## Found while doing it

- No surprises this time - every clamp/branch/coordinate computation matched the design sketch on the first test run, including the hand-derived real-fixture drag numbers (`sin.xm`'s own volume envelope, points `[[0,48],[4,64],[8,44],...]`) - a rarity worth recording precisely because it is one, after several specs in a row each finding at least one real correction along the way.

## Known limits

Same as requirements.md's own Scope boundaries: no surrounding panel, no screen wiring, no dynamic cursor hinting, no instrument-property undo. No browser verification occurred in this environment.
