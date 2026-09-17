# 041 — Tasks

Status: done.

- [x] Re-read `waveform.js`'s own `render`, `zoom`/`getZoomState`/`setZoomState`, and the range-only paths of `onDragStart`/`onDrag`/`onTouchUp` closely before implementing (beyond spec 040's own high-level pass).
- [x] `renderers/canvas/waveformGeometry.js` (new, pure): `clampZoom`, `pixelToSampleIndex`, `sampleIndexToPixel`, `edgeAt`.
- [x] `runtime/waveformController.js` (new): `createWaveformController` - reads/writes `domain/song`/`domain/sampleEditor` directly, the same contract `gridController.js` has.
- [x] `runtime/behaviors.js`: registered `waveform` -> `createWaveformController`.
- [x] `runtime/componentTypes.js`: `waveformView` registered - leaf, no `clips`, behavior `"waveform"`, draw kind `"waveformView"`, no properties.
- [x] `renderers/canvas/drawKinds.js`: `waveformView` draw kind.
- [x] `renderers/canvas/mountGeneric.js` (additive only): `contextFor()`'s new `"waveform"` branch (just `ctrlKey`).
- [x] `tests/waveformGeometry.test.js` (new).
- [x] `tests/waveformController.test.js` (new).
- [x] `tests/waveformView.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen authored, no browser available in this environment (same recorded reason as every spec since 019) - verified the same way `patternGrid`/`fileBrowser` verified their own mechanisms: pure geometry tests, a controller exercised against a real loaded fixture (mirroring `gridController.test.js`'s own convention, since this controller also reads `domain/song`/`domain/sampleEditor` directly rather than synthetic input alone), and the draw kind exercised with a fake canvas context.

## Evidence

- `tests/waveformGeometry.test.js`: 7/7 passing - `clampZoom`'s floor/ceiling/clamp/zero-sample-length behavior, `pixelToSampleIndex`/`sampleIndexToPixel`'s round-trip and graceful degradation with no rect or a zero-length window, `edgeAt`'s start/end/miss/no-selection cases.
- `tests/waveformController.test.js`: 9/9 passing, against the real `wizballalt.mod` fixture - the zoom window seeds to the whole sample on first use; a plain drag creates a new, normalized selection regardless of drag direction; dragging an existing selection's start or end edge resizes it without moving the other edge; an edge drag can never cross the other edge (at least 2 samples of range always remain); wheel pans and clamps at both ends; ctrl+wheel zooms in/out and clamps at `MIN_ZOOM_LENGTH`/the full sample length; disabled blocks pointerdown (reports `blocked: "disabled"`) and makes wheel a no-op; blur clears any in-progress drag anchor so a subsequent drag has no anchor to act on.
- `tests/waveformView.test.js`: 6/6 passing - the registry declaration (leaf, behavior `"waveform"`, draw kind `"waveformView"`, no properties); `measure()`'s floor size independent of the loaded song; `draw()` never throws with no current instrument, with a real instrument's sample data (and draws the background fill plus at least 4 `moveTo` calls - the 3 guide lines plus the waveform's own polyline), with a selection present (tints exactly once) vs. absent (no tint), and with a selection entirely outside the current zoom window.
- Full suite: `node --test tests/*.test.js` → 565/565 passing (543 before this spec + 22 new: 7 + 9 + 6).
- `node build.mjs app`: 78 loose ends, unchanged from before this spec (no YAML/compiler touched).
- `node --check` passed on all 6 touched/new source files before any test was written.

## Found while doing it

- The written controller separates the "disabled" and "missing rect/point/zero-length" guard clauses in `pointerdown` more cleanly than design.md's own sketch did (design.md's sketch folds both into one `if`, computing `blocked` with a ternary that is `null` whenever `state.disabled` is false anyway) - behavior is identical, the implementation just reads slightly clearer.
- `wheel` deliberately does not set `blocked: "disabled"` the way `pointerdown` does (matching design.md's own sketch, and `gridController.js`'s own `handleWheel`, which never checks or reports `disabled` at all) - "disabled blocks every gesture" is satisfied via `handled: false` and a verified no-op on state, not a reported `blocked` reason for every gesture kind. Adjusted the test to assert on that instead of assuming a `blocked` value that the controller never produces for `wheel`.
- The "wheel pans and clamps" test needed a zoomed-in window first: at the initial full-sample zoom (`zoomLength === sampleLength`), `clampZoom` has no room to move `zoomStart` at all, so an assertion made against the fully-zoomed-out state was accidentally vacuous. Zoomed in via ctrl+wheel first, then exercised panning both directions to their clamps.

## Known limits

Loop-marker dragging, the range-volume fade gesture, draw-mode freehand editing, individual-sample dragging, playback preview, the slice overlay, and the pinch-zoom scrollbar gesture are all deliberately out of scope - see requirements.md. No screen authored yet; no browser verification occurred in this environment.
