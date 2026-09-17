# 047 — Tasks

Status: done.

- [x] Read `script/plugins/games/nibbles/nibbles.js` (1315 lines) in full before scoping.
- [x] `tools/nibblesLevels.mjs` (new): decodes `assets/games/nibbles/src/levels.png` (copied from the parent repo) via `skinAtlas.mjs#decodePng`, writes `domain/nibbles/levels.js` (30 levels).
- [x] `domain/nibbles/levels.js` (generated) - verified against three independently hand-checked levels (1, 3, 30) before being trusted.
- [x] `domain/nibbles/index.js` (new): the engine - `resetGame`/`startGame`/`pauseGame`/`resumeGame`/`primaryAction`/`move`/`update`, `setWrap`/`setDifficulty`/`getFrameTime`, `getSnakeHead`/`getDirection`/`getCellView`/`getState`/`getStatus`.
- [x] `domain/nibbles/highscores.js` (new): mirrors `domain/settings/favorites.js`; keeps v1's own storage key; fixes a real v1 bug (`index>0` excluding a genuine first-place score).
- [x] `runtime/nibblesController.js` (new): behavior `"nibbles"` - arrow keys, Enter, focus/disabled gating, `onFrame(deltaMs)`.
- [x] `runtime/behaviors.js`: registers the `nibbles` behavior.
- [x] `runtime/componentTypes.js`: the `nibblesGrid` type entry; the new `ticks` registry flag and `isTickingType()`.
- [x] `renderers/canvas/drawKinds.js`: the `nibblesGrid` draw kind.
- [x] `renderers/canvas/mountGeneric.js`: a second, independent tick clock (`tickingNodes`/`tickAnimationFrame`/`startTickClock`/`stopTickClock`), wired at the same two call sites the sprite clock already is.
- [x] `tests/nibblesLevels.test.js`, `tests/nibbles.test.js`, `tests/nibblesHighscores.test.js`, `tests/nibblesController.test.js`, `tests/nibblesGridView.test.js`.
- [x] `node --test tests/*.test.js` passes; `node compiler/generate.js`/`node build.mjs app` confirmed unaffected (no YAML/compiler/`capabilities.js` touched).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - a fake-canvas draw-kind test (mirroring `waveformView.test.js`/`loopCreatorView.test.js`) covers the drawing surface, and unit tests against the real engine cover everything else, including a full, real playthrough to a win and to game-over (not just isolated branch checks).

## Evidence

- `tests/nibblesLevels.test.js`: 6 tests - exact level count, level 1 (empty)/3 (two bars)/30 (dense maze) hand-verified against an independent read of the source pixels, every level's own start point in-bounds and wall-free, every wall color index valid.
- `tests/nibbles.test.js`: 15 tests - initial state, movement, the U-turn guard, wall/edge/wrap collision, `primaryAction()`'s full state dispatch, `getStatus()`'s text/label per state, and (the two hardest to get right) a full real playthrough to a win and to game-over.
- `tests/nibblesHighscores.test.js`: 6 tests, mirroring `tests/favorites.test.js`'s own convention.
- `tests/nibblesController.test.js`: 9 tests - keyboard/pointer/focus handling and the tick accumulator's own exact call count.
- `tests/nibblesGridView.test.js`: 6 tests - the registry declaration, `measure()`'s floor size, draw-never-throws, the paused-state dimming tint appearing exactly once and never while playing.
- Full suite: `node --test tests/*.test.js` -> 690/690 passing (648 before this spec + 42 new). Stress-tested `tests/nibbles.test.js` alone 100 consecutive times and the full suite 15 consecutive times with zero failures, after the walker fix below.
- `node compiler/generate.js`: 25 warnings, 0 errors - unchanged. `node build.mjs app`: loose ends unchanged at 82 - this spec authors no YAML and maps no command.

## Found while doing it

- **A real design risk caught by re-reading `renderers/canvas/mountGeneric.js` before writing any renderer code**: `animSprite`'s own `animated: true` flag (spec 017) keeps the render loop alive by advancing a *bound field's frame count* - the wrong shape for calling a whole simulation step, and it requires a `field` nibblesGrid has no reason to have. Rather than force-fitting it, a second, independent clock (`ticks: true`, `controller.onFrame(deltaMs)`) was added, mirroring the sprite clock's own start/stop shape without touching its code at all - the same choice spec 032's own coalesced-draw loop already made against the sprite clock for the identical reason.
- **A very persistent, self-inflicted test flakiness bug, tracked down over several iterations**: this spec's own first draft of `tests/nibbles.test.js` tried to prove a full 9-catch win using first a naive shortest-path walk, then a flood-fill-based "prefer open space" heuristic - both occasionally let the snake (which reaches ~109 segments by the last catch, on a 600-cell grid) trap itself, failing roughly 1 run in 15-40. Rather than keep tuning a heuristic that could never be proven safe, the walker was rewritten to follow a hand-verified Hamiltonian cycle over all 40x15 cells (visiting every cell exactly once before repeating), which makes self-collision structurally impossible regardless of where food lands - a real engineering technique (used by actual Snake-solving bots), not a workaround. Fixing that surfaced a second, deeper bug in the SAME test helper: `eatOneFood()` detected "the food was eaten" by checking whether `score` had changed - but v1's own `update()` decrements score by 1 on *every* tick regardless of eating, so the very first tick after calling `eatOneFood()` always "changed" the score and the helper falsely declared victory after a single step, meaning catches 2-8 in the win test were never actually happening at all (silently, since the per-catch assertion only checked `state === PLAYING`, which stayed true either way). Fixed by detecting the food cell's own position changing instead - unambiguous, and unrelated to score arithmetic entirely. Confirmed fixed with 100 consecutive stress runs of the file alone and 15 of the full suite, zero failures either way, after both fixes landed together.
- **A real v1 bug in the high-score check, not reproduced**: `checkHighScore`'s own `index>0` guard silently refuses to ever record a new *first-place* score (`findIndex` returning `0` for beating the very best entry fails that check). No comment or apparent reasoning suggests this is intentional; `domain/nibbles/highscores.js#qualifies` uses `index !== -1` instead.
- **A real, deliberately-preserved v1 oddity, not a bug**: `game.update()`'s own if/else shape means a wrap-around move skips wall/self/food collision detection entirely for that one step (the `else` branch, the only place a collision check happens, never runs once the `if`/off-grid branch already has) - a wrapped move can therefore never die or eat on the same tick it wraps. Confirmed by re-reading the exact branch structure (not just the outcome) and ported verbatim, recorded in `domain/nibbles/index.js`'s own `update()` comment rather than silently "fixed" into something more intuitive.
- **A real, confirmed misreading of this spec's own requirements.md, caught before implementation, not after**: the first draft assumed `lost()` itself resets the snake's position back to the level's own start - re-reading `nibbles.js` line by line showed `game.lost()` never touches the snake at all; only the following `primaryAction()`/`game.onClick()`'s own `LOST` case (calling `game.start()` again) does. `requirements.md`'s NIB-003 wording was corrected to say so before any test was written against the wrong assumption.

## Known limits

Same as requirements.md's own Scope boundaries: no screen (config panel, score/lives display, buttons, the high-score table's own visual list, the "Nibbles" menu action and feature-registry wiring), no dynamic window-size-derived grid dimensions (fixed at 40x15 instead), no high-score name-entry dialog, no "SKIP"/"TRITON" cheat codes, no decorative sprites. No browser verification occurred in this environment.
