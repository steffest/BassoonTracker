# 017 — Implementation

Status: implemented and verified 2026-09-11.

- [x] `runtime/componentTypes.js`: `image` and `icon` promoted to `implemented: true`, `draw: "image"`; `image` gained `horizontalAlign`/`verticalAlign` to its contract. `animSprite` promoted to `implemented: true`, `draw: "animSprite"`, `animated: true`, and a new `field` property (the frame index). `isAnimatedType(type)` added, parallel to `isInteractiveType`. `numberDisplay` left exactly as spec 016 declared it.
- [x] `runtime/animationClock.js`: `advanceSprites()` (whole-step advancement with a carried remainder, wraparound, a documented default frame delay) and `anyFrameChanged()`. Pure, no DOM, no timer.
- [x] `renderers/canvas/drawKinds.js`: the shared `image` draw kind (`imageAsset()` helper reading `src` or `icon`; natural/aligned/stretched drawing; measures to the asset's natural size or a 14×14 fallback) and the `animSprite` kind (reads the strip left to right by `asset.width / frames`, clamps `state.fieldValue` to range). `measure()`'s documented signature grew an optional `node` argument; only these two kinds use it.
- [x] `renderers/canvas/mountGeneric.js`: `measureLeaf` passes `node` through to `measure()`. `visualStateOf()` gained a third, fully generic case - any non-interactive type with a bound `field` gets `state.fieldValue` - alongside the existing `value`/`scroll` ones. The animation clock: `animatedNodes`/`spriteClock` collected at mount, `startAnimationClock()`/`animationTick()`/`stopAnimationClock()`, wired into mount setup and `dispose()`.
- [x] `tests/leafTypes.test.js` (11 cases): the clock's stepping/wraparound/catch-up/default-delay arithmetic; the registry facts for all three types; `image`/`icon`/`animSprite`'s `draw()` and `measure()` exercised directly with a fake `ctx`/asset lookup (recording `drawImage` calls - the first draw kind logic in this project tested this way rather than only through a browser).
- [x] `tests/componentTypes.test.js`: spec 016's "fifteen declared-not-drawn" test narrowed to the twelve still `implemented: false`, since `icon`/`image`/`animSprite` are three of the fifteen it used to cover.

## Evidence

`node --test "v2/tests/*.test.js"`: 191 tests, all passing, up from 180 (11 new, one narrowed).

`node v2/build.mjs app`: succeeds, 24 loose ends, unchanged - nothing in `app.yaml` authors any of the three yet.

One hand-built-tree browser scenario, Playwright/Chromium: an `image` (`src: "checkbox_on"`), an `icon` (`icon: "checkbox_off"`), and an `animSprite` (`sprite: "button_inlay"`, `frames: 3`, `frameDelay: 80`) against the built-in fallback skin. Screenshot confirms all three draw real pixels (not blank, not a placeholder box). The animated field (`anim.frame`) starts at 0, reaches 1 within 600ms, and visits all three values `{0, 1, 2}` (never out of range) over 1.5s of real wall-clock time with no polling from the test beyond reading `mount.mockState`. No console errors or warnings at any point.

## Found while doing it

Nothing needed correcting after the fact this time - the two things flagged as risks going in (a colliding universal property, a `measure()` signature change breaking an existing kind) were designed around from the start rather than discovered by a failing test, unlike spec 016's `icon`/`animSprite` property names or spec 015's two real bugs. The one thing this spec's own requirements.md flags as a correction is a scoping one, decided before code was written: `numberDisplay` was going to be "simple" by spec 016's grouping and turned out not to be, so it was moved out rather than implemented under pressure to match the label.

## Known limits

`compiler/skin.js` does not yet register an authored `src`/`icon`/`sprite` value as an asset a real skin has to load (it only tracks assets a style's `states:` or a font references); this matters only once a screen actually authors one of these three, which none does yet. `numberDisplay` remains `implemented: false`, its own future spec. No compiler vocabulary authors `animSprite`'s `field` from YAML in a way that's distinguishable from an ordinary field - authoring one today would work, but nothing stops an author from also binding an action to the same field, which the animation clock would silently fight; recorded here rather than guarded against, since no authored instance exists to need the guard yet.
