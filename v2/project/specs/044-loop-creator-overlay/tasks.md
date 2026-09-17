# 044 — Tasks

Status: done.

- [x] Re-read `loopCreator.js`'s own `waveDisplay` (119-274, 379-537) closely before designing.
- [x] `renderers/canvas/loopCreatorGeometry.js` (new, pure): `blendToY`, `hitLoopTarget`, `isVerticalLoopTarget`.
- [x] `domain/sampleEditor/loopCreator.js`: two small additive exports, `nearestZeroCrossing` and `getLoopCreatorLayers`.
- [x] `runtime/loopCreatorController.js` (new): `createLoopCreatorController` - eleven drag targets, wheel pan/zoom, its own independent zoom window.
- [x] `runtime/behaviors.js`: registered `loopCreator` -> `createLoopCreatorController`.
- [x] `runtime/componentTypes.js`: `loopCreatorView` registered - leaf, behavior `"loopCreator"`, draw kind `"loopCreatorView"`, no properties.
- [x] `renderers/canvas/drawKinds.js`: `loopCreatorView` draw kind plus three private helpers (`drawLoopBlendLayer`/`drawLoopBlendLine`/`drawLoopHandle`).
- [x] `renderers/canvas/mountGeneric.js` (additive only): `contextFor()`'s new `"loopCreator"` branch (just `ctrlKey`).
- [x] `tests/loopCreatorGeometry.test.js` (new).
- [x] `tests/loopCreatorController.test.js` (new).
- [x] `tests/loopCreatorView.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen authored, no browser available in this environment (same recorded reason as every spec since 019) - verified the same way `waveformView` verified its own mechanism: pure geometry tests (all eleven targets, hand-derived at a carefully spaced 1:1 pixel/sample rect so every position is exact), a controller exercised against small synthetic instrument objects (mirroring `tests/loopCreator.test.js`'s own convention, since exact drag-delta and snap-to-zero numbers matter), and the draw kind exercised with a fake canvas context.

## Evidence

- `tests/loopCreatorGeometry.test.js`: 6/6 passing - `blendToY`'s own inverse relationship to `BLEND_MARGIN`; all eleven targets resolved at hand-derived positions in one test; a clean miss; the orig-before-handle-before-blend priority order demonstrated at a position that would otherwise ambiguously match two targets; graceful degradation for a zero-width rect/zero-length zoom/null rect; `isVerticalLoopTarget`'s own six-true/six-false split.
- `tests/loopCreatorController.test.js`: 19/19 passing - the zoom window seeding to the whole session length; each of the eleven drag targets moving its own matching state field by the expected, hand-derived amount (markers by the raw delta; the three size handles by the delta or its inverse; all six blend/orig lines by the inverted vertical delta); a miss reporting `handled: false`; a marker drag honoring `snapToZero` (landing on a real, deliberately-placed zero crossing) versus ignoring it (landing on the raw even-aligned position) for the exact same drag; wheel pan/zoom mirroring `waveformController.test.js`'s own tests; disabled blocking pointerdown and making wheel a no-op; blur clearing an in-progress drag anchor.
- `tests/loopCreatorView.test.js`: 7/7 passing - the registry declaration; `measure()`'s floor size; `draw()` never throws with no session open (background only, nothing else drawn); never throws with a real session open (plots the three blend layers, markers, size handles - at least one `moveTo`/`fill` call each); never throws while highlighting a `dragging` target, with a zero-max region (no handle to draw), or with a zoom window that excludes the loop region entirely.
- Full suite: `node --test tests/*.test.js` → 628/628 passing (596 before this spec + 6 + 19 + 7).
- `node build.mjs app`: 78 loose ends, unchanged from before this spec (no YAML/compiler/capabilities.js touched - `loopCreatorView` is registered but not yet authored in any component tree, exactly as `waveformView` was between specs 041 and 042).
- `node --check` passed on every touched/new source file before any test was written.

## Found while doing it

- **A real correctness mistake in this spec's own first-draft blend-line drawing, caught by re-deriving `wideAtStart` from v1's own six call sites rather than assuming a simplification held.** The first draft of `drawLoopBlendLine` always drew the filled triangle's wide end toward `sampleStart`, on the (wrong) assumption that this matched every caller. Re-checking `loopCreator.js#drawWave`'s own six `drawBlendLine` calls (429-449) line by line found the flag actually alternates per target (`blendTail`: wide at start; `blendHead`/`blendLoopEnd`: wide at end; the three `orig*` lines mirror each of their own counterparts) - fixed before writing any test, by threading a real `wideAtStart` parameter through to each of the six call sites instead.
- **A genuine test-data trap, caught before it produced a false pass**: an early draft of the eleven-target geometry test picked `origBlendLoopEnd`/`blendLoopEnd` values whose own `blendToY` positions were only 4px apart - well inside each other's 6px hit tolerance - so a point meant to test `blendLoopEnd` alone was actually also matching `origLoopEnd` (checked first in priority), and the test failed loudly rather than silently passing for the wrong reason. Fixed by choosing every orig value as 1 and every blend value as 0.1, putting all three orig lines and all three blend lines 36px apart - comfortably past the 6px tolerance on either side, for every region.
- **`waveformGeometry.js`'s own `sampleIndexToPixel`/`pixelToSampleIndex` needed no changes at all** to serve this spec's own eleven-target hit test and drag math - reused directly, exactly as `renderers/canvas/loopCreatorGeometry.js`'s own header comment says it would.

## Known limits

The menu-bar controls (title, Apply/Cancel, snap checkbox, presets dropdown) and the screen wiring into the sample-editor panel are a later spec's own - see requirements.md. No dynamic cursor hinting (matching `waveformView`'s own, now-explicit, omission). No zoom sync with the plain waveform view - this leaf owns its own independent zoom window. No color-key legend. No browser verification occurred in this environment.
