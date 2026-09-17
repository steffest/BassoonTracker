# 052 — Tasks

Status: done.

- [x] Requirements and design written, following spec 051's own "engine, then interactive leaf" split.
- [x] `domain/playback/index.js`: `getTrackScopeData`, `ensureTrackAnalysers` (private), `trackAnalysers` cleared in `reset()`.
- [x] `domain/playback/silentContext.js`: `StubNode#getByteTimeDomainData`.
- [x] `domain/arrangement/index.js`: `getTrackScopeData` forward.
- [x] `renderers/canvas/multitrackGeometry.js` (new).
- [x] `runtime/multitrackController.js` (new).
- [x] `runtime/behaviors.js`: registers `multitrack`.
- [x] `runtime/componentTypes.js`: `multitrackView` type entry.
- [x] `renderers/canvas/drawKinds.js`: `multitrackView` draw kind + six drawing helpers.
- [x] `renderers/canvas/mountGeneric.js`: `contextFor`'s `multitrack` branch.
- [x] `tests/multitrackGeometry.test.js`, `tests/multitrackController.test.js`, `tests/multitrackView.test.js` (all new); `tests/playback.test.js` (extended).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no YAML/`capabilities.js` change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment). Pure geometry unit tests, controller unit tests against a real loaded fixture, and a fake-canvas-context draw test - the same three-layer verification `loopCreatorView` (spec 044) already used.

## Evidence

- `node compiler/generate.js`: 16 warnings, 0 errors - unchanged, this spec authors no YAML. `node build.mjs app`: loose ends unchanged at 88.
- `tests/multitrackGeometry.test.js`: 10 new tests - every pure function, including `hitRegion`'s five-region coverage and `controlButtonAt`'s three buttons plus a miss.
- `tests/multitrackController.test.js`: 11 new tests - all three initial-gesture branches, wheel scroll/zoom-around-pointer, a full note-drag-and-release against a real fixture (calling `arrangement.moveNote` exactly once, confirmed by checking `canUndo()`), a no-op release, solo/mute button hits, the record hook, a scrollbar-thumb drag, and `setDisabled`.
- `tests/multitrackView.test.js`: 8 new tests - the registry declaration (including `ticks: true`), `measure()`, draw-never-throws across an ordinary state, an empty track, a drag ghost (with and without a `dragNote`), a muted track's flat scope line, a real block's own name text, and a scrolled/zoomed state with both scrollbars visible.
- `tests/playback.test.js`: 1 new test - `getTrackScopeData` growing on demand, never shrinking, filling the target from the silent context's own new stub.
- Full suite: `node --test tests/*.test.js` -> 778/778 passing (748 before this spec + 30 new).

## Found while doing it

- **A real geometry defect in the control-strip button layout, found only by running the controller tests against a plausible-looking but too-short test rect, not by reading the ported formula alone**: `controlButtonRect`'s own `buttonSpace = floor((trackHeight - BUTTON_SIZE*3)/4)` goes negative once `trackHeight` drops below roughly 90px (three 26px buttons need at least that much before any spacing is left over) - `DEFAULT_VISIBLE_TRACKS = 4` against a first test rect gave a 40px `trackHeight`, well under that, so the solo button's own `y` computed as -10 and every hit-test/draw call against it silently resolved to the wrong button (or none at all). This is not a bug introduced by the port - `dawtrack.js`'s own identical formula has the same characteristic at v1's own `MIN_TRACK_H` (24px) - but it is a real fact worth recording for whichever later spec picks the screen's own actual viewport height: a lane shorter than ~90px will not comfortably fit this control strip. Fixed in the test suite by choosing a realistic 90px-per-track rect, not in the geometry itself (faithfully ported, not "fixed" past what v1 itself guarantees).
- **Two sign/direction mistakes in the first draft of the wheel tests, found immediately on running them, not from misunderstanding the mechanism**: horizontal wheel scroll is `scrollX -= deltaX * 0.5` (ported verbatim from `multitrack.js`), so a *positive* `deltaX` decreases `scrollX` (clamped to 0 from a zero start) - the opposite of the first draft's own assumption; and the zoom factor is `deltaY > 0 ? 1.1 : 1/1.1` (zoom *in* on a positive `deltaY`), also the opposite of the first guess. Both fixed by using the sign the ported formula actually expects, not by changing the formula.
- **The zoom-recenter math drifts by up to one step**, an inherent `Math.floor()` rounding characteristic of the same recentering formula `multitrack.js#onMouseWheel` itself uses (confirmed by tracing the arithmetic, not assumed) - the test asserts "within one step of the original," not an exact match, the same tolerance any pixel-to-index rounding elsewhere in this port already needs.
- **A test-authoring mistake caught by the mute-button assertion itself failing, not by inspection**: soloing track 0 already mutes every other track by cascade (spec 051's own `setTrackSolo`), so a second test step clicking "mute" on an already-cascade-muted track 1 actually *toggles it back off* rather than on - fixed by resetting every track's own mute/solo state between the solo assertion and the mute assertion, rather than assuming the two buttons could be tested back-to-back with no interaction between them.

## Known limits

Same as requirements.md's own Scope boundaries: no waveform thumbnails, no scale-9 block panel image, no real record-button destination, no menu bar, no classic-grid header, no screen wiring, no dynamic cursor hinting, no `Layout.visibleTracks` breakpoint integration. No browser verification occurred in this environment.
