# 032 — Tasks

Status: implemented and verified 2026-09-11.

- [x] Re-verified against `script/src/ui/ui.js` (`render()`, `me.scaleToDevicePixelRatio`, the `EVENT.clockEventExpired` listener at 607-618, `nowFunction` at 62-66) and `script/src/ui/optionsPanel.js:97-99` while writing the code.
- [x] `runtime/frameGovernor.js` (new, pure): `createFrameGovernor({maxFps})` → `{ shouldDraw(now, skipCount) }` - the fps cap checked before the skip counter, so a cap-rejected frame never consumes a skip slot.
- [x] `domain/playback/scheduler.js`: `setDefaultOnMissedDeadline(fn)`; the constructor falls back to it when `options.onMissedDeadline` is absent. No change to `engine/tracker.js`.
- [x] `domain/playback/index.js`: `STATE_FIELDS.screenRefresh`; `handleMissedDeadline(app, lateBy)` (2000ms cooldown between escalations, capped at 4, ported from `ui.js:607-618`); registered via `setDefaultOnMissedDeadline` inside `ensureEngine(app)`; `setScreenRefresh(app, detail)` (label → its own list index, unrecognized → 0); both exported for direct testing.
- [x] `capabilities.js`: mapped `"screen-refresh.set"` to `domain/playback/index.js#setScreenRefresh`. `"high-dpi.toggle"` deliberately left as the generated mock (it already does the one thing needed for a plain boolean).
- [x] `renderers/canvas/mountGeneric.js`:
  - Renamed `draw()`/`relayout()` to `performDraw()`/`performRelayout()`.
  - Added `frameGovernor`, `frameHandle`, `pending`, `requestFrame(kind)`, `onAnimationFrame(now)`, `markNeedsDraw()`, `markNeedsRelayout()`.
  - Replaced all ~24 prior `draw()`/`relayout()` call sites (one more than design.md's own "~20" estimate - a fresh grep before editing, per this file's own task item, found the real count) with the matching mark function, via a scripted whole-file substitution guarded against matching inside `performDraw`/`performRelayout`'s own longer names, then read end to end by hand.
  - `recomputeLayout()`: reads `high-dpi.active` before computing `dpr`; ends with `markNeedsRelayout()`.
  - The `onAnyChange` subscription: branches on `path === "high-dpi.active"` (→ `recomputeLayout()`) vs. everything else (→ `markNeedsRelayout()`).
- [x] `tests/frameGovernor.test.js` (new, 5 cases): the fps cap alone; the cap holding at a simulated 120Hz cadence; the skip counter alone (every 4th eligible frame at skip=3); a cap-rejected flood never consuming a skip slot; skip=0 never engaging the counter.
- [x] `tests/scheduler.test.js` (extended, +3 cases): a `Scheduler` built with no option uses the registered default; an explicit per-instance option overrides it; no default registered at all does not throw.
- [x] `tests/playback.test.js` (extended, +5 cases): `setScreenRefresh` against all four labels, an unrecognized one, and no `detail`; `handleMissedDeadline`'s immediate-first-escalation-then-cooldown behavior, its cap, sharing the field with `setScreenRefresh`, and tolerating a missing `app`/`app.state`.
- [x] `node --test "v2/tests/*.test.js"` passes (413, up from 400). `node v2/build.mjs app` succeeds; `screen-refresh.set` leaves the mocked-command list (loose ends 88 → 87); `high-dpi.toggle` still correctly appears there, deliberately.
- [x] Read through the final `mountGeneric.js` diff end to end by hand - see "Found while doing it" for what that pass caught.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded; **P8 closed**.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No Playwright/Chromium install exists in this environment (rechecked). `renderers/canvas/mountGeneric.js` itself has no test coverage in this codebase at all (confirmed again: no DOM-testing dependency in `package.json`) and gains none here - the coalescing mechanism's own correctness rests on the hand-read-through above and `frameGovernor.js`'s own unit tests, not an integration test. This is the deepest version yet of the same real gap specs 019/030/031 recorded, and should be the first thing re-verified in a browser-capable environment - see Known limits.

## Evidence

`node --test "v2/tests/*.test.js"`: 413 tests, all passing, up from 400 (13 new: 5 in `tests/frameGovernor.test.js`, 3 in `tests/scheduler.test.js`, 5 in `tests/playback.test.js`).

`node v2/build.mjs app`: succeeds, exit 0. `screen-refresh.set` leaves the mocked-command list (88 → 87 loose ends); `app/actions/screenRefreshSet.js` regenerated as a thin wrapper over `domain/playback/index.js#setScreenRefresh`, the same shape `transportToggle.js`/`recordToggle.js` already have; `high-dpi.toggle` still listed, confirmed deliberate. `node build.mjs dist` still fails on the same pre-existing, unrelated `esbuild` binary-version mismatch every spec since 019 has recorded.

## Found while doing it

- **`runtime/frameGovernor.js`'s own first draft had a real off-by-one that its own first test caught before anything downstream used it.** `lastDrawTime` initialized to `0` meant the very first call (`now` also near `0`, or exactly `0` in a fresh test) computed `now - lastDrawTime = 0`, which is *not* `>= minInterval`, so the first-ever draw was rejected by its own fps cap - the opposite of the intended "always draw immediately the first time." Fixed by initializing to `-Infinity`. Caught by `tests/frameGovernor.test.js`'s very first assertion, not by reasoning it through in advance.
- **The pure fps-cap-vs-skip-counter composition needed a second correction once a test tried to isolate them.** The first version of the "a frame the fps cap rejects never consumes a skip slot" test itself assumed a cap-passing first call would draw immediately even with a nonzero skip count - which contradicts the (already-correct, already-tested) "every 4th eligible frame" behavior for a nonzero skip count. The test's premise was wrong, not the governor; rewritten to actually isolate what it claims to test (a flood of cap-rejected calls, then enough genuinely-eligible calls to know whether any of the flood secretly counted).
- **`handleMissedDeadline`'s cooldown check has a real, faithfully-ported edge case discovered while writing its own tests, not found in v1's source directly.** v1's `nowFunction` prefers `performance.now()` (`ui.js:62-66`) exactly as this port's `handleMissedDeadline` does, and `performance.now()` is relative to the process/page's own start, not the epoch - so a missed deadline arriving within the first ~2 seconds of a fresh `performance.now()` origin can appear to be "inside the cooldown" relative to the reset state's `lastThrottleEscalation = 0`, even though nothing actually escalated yet. This is a real property of the *original* v1 code, ported faithfully, not a bug introduced here - but it meant the tests needed a controlled fake clock (`withFakeClock`, starting well past 2000) rather than trusting the test process's own real elapsed time, which is exactly the kind of short-lived-process assumption a Node test file cannot rely on the way a long-open browser tab could.
- **The `draw()`/`relayout()` call-site count was undercounted in design.md's own research pass** (~20 estimated, ~24 actual, plus the two definitions) - re-grepped fresh immediately before editing rather than trusting the earlier count, per this file's own first task item; the scripted substitution (word-boundary-guarded so it could never touch `performDraw`/`performRelayout`'s own longer names) caught all of them in one pass, confirmed by a `node --check` syntax pass and then a full by-hand read-through.
- **Everything else matched the plan going in**: `screen-refresh.value`'s two writers (`setScreenRefresh`, `handleMissedDeadline`) needed no coordination beyond reading-then-writing the same field, exactly as designed; `high-dpi.active`'s already-correct default and already-correct mock needed zero changes outside the renderer's own read; no change to `domain/playback/engine/tracker.js` was needed anywhere.

## Known limits

`renderers/canvas/mountGeneric.js`'s own coalescing wiring - the actual behavior this whole spec is about - has no automated test coverage in this environment (no DOM-testing dependency exists, and none was added; see design.md's Testing strategy). Per-node dirty regions / per-element offscreen buffers remain deferred, unmeasured (requirements.md's scope boundary). The sprite-animation clock's own `requestAnimationFrame` loop (spec 017) still runs independently of this spec's coalescing loop - not unified. No browser verification occurred in this environment - the same open item every spec since 019 has left, and the most important one to close before trusting this spec's own core claim.
