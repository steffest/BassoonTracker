# 058 — Tasks

Status: done.

- [x] Read `visualiser.js` (204 lines) in full - found `render()` always calls `_modeTracksRender()` regardless of `_mode`, confirming "wave"/"spectrum" are dead labels with no rendering path; confirmed `_analyserAmp = 1.5` is live (grepped the whole v1 tree for any other assignment - none exists), not dead.
- [x] `renderers/canvas/scopesGeometry.js` (new).
- [x] `runtime/scopesController.js` (new).
- [x] `runtime/behaviors.js`: registers `scopes`.
- [x] `runtime/componentTypes.js`: `scopesView` type entry.
- [x] `renderers/canvas/drawKinds.js`: `scopesView` draw kind.
- [x] `components/multitrackPanel.yaml`: new `scopesView` sibling, above `multitrackView` - an explicit numeric `height: 80`, not the bare `fixed` keyword (found necessary empirically, the identical lesson spec 054 already recorded).
- [x] `tests/scopesGeometry.test.js`, `tests/scopesController.test.js`, `tests/scopesView.test.js` (all new); `tests/multitrackScreen.test.js` (extended).
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no new warnings, no new loose ends).
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment). Pure geometry unit tests, controller unit tests against a real loaded fixture, and a fake-canvas draw test, plus a layout-integration test confirming placement.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - unchanged after fixing the one `layout-default-fallback` warning the bare `fixed` keyword produced first (an explicit `height: 80` fixed it, matching `measure()`'s own default).
- `node build.mjs app`: loose ends unchanged at 87 - no command is authored at all (a click calls `domain/arrangement` directly).
- `tests/scopesGeometry.test.js`: 5 new tests - the one-row and two-row (including an odd track count) layout branches, the strict-inequality hit test at cell edges and outside every row.
- `tests/scopesController.test.js`: 4 new tests - hover/focus, a real hit toggling exactly one track's own mute (and back off on a second click), a miss doing nothing, `disabled` blocking.
- `tests/scopesView.test.js`: 5 new tests - registry declaration (including `ticks: true`), `measure()`, draw-never-throws with zero tracks and with a real loaded song (one stroke per track), a muted track's own flat line and dim overlay.
- `tests/multitrackScreen.test.js`: 2 new tests - `scopesView` present, sized, and above `multitrackView`; absent when `multitrackPanel` itself is.
- Full suite: `node --test tests/*.test.js` -> 865/865 passing (849 before this spec + 16 new).

## Found while doing it

- **`layout: {width: fill, height: fixed}` (the bare keyword) produced the identical `layout-default-fallback` warning spec 054 already found and fixed once for `volumemeter.yaml`** - `scopesView` has no skin entry and is not one of the four hardcoded fallback types either. Fixed the same way: an explicit number (`height: 80`, matching `measure()`'s own default) instead of the keyword.
- No other surprises - every formula (the two-row layout, the strict-inequality hit test, the `1.5x` amplitude boost and its own recentering offset) matched the design sketch on the first test run, once the amplitude formula's own `offsetY` term (not just a bare multiply) was worked out algebraically before writing any code, from re-reading `visualiser.js:149-152` directly rather than approximating "some kind of boost."

## Known limits

Same as requirements.md's own Scope boundaries: no "wave"/"spectrum" modes, no skin-atlas sprite background, no adaptive low-framerate FFT-size shrink, no piano, no classic-grid screen. No browser verification occurred in this environment.
