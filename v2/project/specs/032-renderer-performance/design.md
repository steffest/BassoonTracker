# 032 — Design

## Overview

Three independent pieces, none of them touching `domain/playback/engine/` (v1-ported code, under its own "nothing else" divergence rule):

1. **Coalescing.** `renderers/canvas/mountGeneric.js`'s ~20 direct `draw()`/`relayout()` call sites become `markNeedsDraw()`/`markNeedsRelayout()`, which set a dirty flag and request at most one `requestAnimationFrame` callback. The frame-rate cap and the "Screen refresh" skip count both gate *inside* that callback, in a new pure module so the gating logic itself is unit-testable (`mountGeneric.js` itself has no test today and gets none here either - see Testing strategy).
2. **A real "Screen refresh".** A new capability, `setScreenRefresh`, replaces the currently-broken mock; the renderer reads the field it writes.
3. **A real "Optimize High DPI".** No capability needed - the field and its correct default already exist. `recomputeLayout()` starts reading it.

The automatic missed-deadline throttle threads through both (2) and (3)'s shared field, from a new registration point on the scheduler, called once from the same place `domain/playback/index.js` already sets everything else up.

## Architecture

```
domain/playback/scheduler.js (spec 012, extended)
  + setDefaultOnMissedDeadline(fn)   module-level default, read by the
                                      constructor when no per-call option
                                      is given - engine/tracker.js's own
                                      `new WAAClock(Audio.context)` call
                                      (untouched) picks it up for free.
        ^
        | registered once, closing over `app`
        |
domain/playback/index.js (extended)
  ensureEngine(app): registers the default handler
  handleMissedDeadline(app, lateBy): the cooldown+escalation policy
                                      (ported from ui.js:607-618),
                                      writes STATE_FIELDS.screenRefresh
  setScreenRefresh(app, detail): the manual capability (replaces the
                                      broken mock), writes the same field
        |
        v  (both write the one shared field)
"screen-refresh.value" (already declared, already authored)
        ^
        |  read fresh every animation frame
        |
runtime/frameGovernor.js (new, pure)
  createFrameGovernor({maxFps}).shouldDraw(now, skipCount)
        ^
        | called from
        |
renderers/canvas/mountGeneric.js (extended)
  markNeedsDraw()/markNeedsRelayout() -> requestFrame() -> one rAF ->
  onAnimationFrame(now): shouldDraw? -> performDraw()/performRelayout() :
  reschedule and try again next frame
  recomputeLayout(): reads "high-dpi.active" (already correctly seeded
  false), only then multiplies by window.devicePixelRatio
```

## Components and interfaces

### `runtime/frameGovernor.js` (new, pure)

No DOM, no `requestAnimationFrame` - `mountGeneric.js` supplies `now` (from the rAF callback's own timestamp argument) and calls in. Testable with plain numbers, like `pointerRouter.js`/`scrollbar.js`.

```js
export const DEFAULT_MAX_FPS = 60;

/**
 * @param {{ maxFps?: number }} [options]
 * @returns {{ shouldDraw: (now: number, skipCount: number) => boolean }}
 */
export function createFrameGovernor({ maxFps = DEFAULT_MAX_FPS } = {}) {
    let lastDrawTime = -Infinity; // so the very first call is never rejected by the cap
    let opportunity = 0; // how many *eligible* (fps-cap-passed) frames since the last actual draw

    function shouldDraw(now, skipCount) {
        const minInterval = maxFps > 0 ? 1000 / maxFps : 0;
        if (now - lastDrawTime < minInterval) return false; // too soon for the cap; no skip slot consumed
        if (skipCount > 0) {
            opportunity++;
            if (opportunity <= skipCount) return false;
        }
        opportunity = 0;
        lastDrawTime = now;
        return true;
    }

    return { shouldDraw };
}
```

Ordering matters and is deliberate: the fps cap is checked *before* the skip counter, so a frame the cap already rejected never consumes one of the skip counter's slots (PERF-003's cap holds regardless of the "Screen refresh" setting; PERF-004's "every 4th eligible frame" means eligible-after-the-cap).

### `domain/playback/scheduler.js` (extended)

```js
let defaultOnMissedDeadline = null;

/** The frame loop's own hook, registered once - engine/tracker.js's `new WAAClock(context)` call is never touched (design.md's own boundary). */
export function setDefaultOnMissedDeadline(fn) {
    defaultOnMissedDeadline = fn;
}

// in the constructor:
this.onMissedDeadline = options.onMissedDeadline || defaultOnMissedDeadline;
```

A module-level default rather than a constructor parameter, because `engine/tracker.js:278`'s `clock = clock || new WAAClock(Audio.context)` is v1-ported code under `domain/playback/README.md`'s "byte-identical... nothing else" rule - the extension point has to live entirely in `scheduler.js` (already documented as v2 code) and be picked up by an unmodified call site.

### `domain/playback/index.js` (extended)

```js
export const STATE_FIELDS = {
    status: "playback.status",
    title: "song.title",
    position: "playback.position",
    pattern: "playback.pattern",
    screenRefresh: "screen-refresh.value" // new
};

const MISSED_DEADLINE_COOLDOWN_MS = 2000; // ui.js:610
const MAX_AUTO_SKIP = 4;                  // ui.js:612 (`skipRenderSteps<4`)
const SCREEN_REFRESH_LABELS = ["Smooth", "Normal", "Economical", "Low CPU"]; // optionsPanel.yaml:60-63, in authored order

let lastThrottleEscalation = 0;

/** Ported from ui.js:607-618 - escalates on every missed deadline unless one already did within the cooldown. */
function handleMissedDeadline(app, lateBy) {
    if (!app || !app.state) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastThrottleEscalation <= MISSED_DEADLINE_COOLDOWN_MS) return;
    lastThrottleEscalation = now;
    const current = Number(app.state.get(STATE_FIELDS.screenRefresh)) || 0;
    if (current >= MAX_AUTO_SKIP) return;
    app.state.set(STATE_FIELDS.screenRefresh, current + 1);
    if (app.log) app.log("playback.throttle", { lateBy, skip: current + 1 });
}

function ensureEngine(app) {
    if (engineReady) return context;
    // ...unchanged...
    setDefaultOnMissedDeadline(lateBy => handleMissedDeadline(app, lateBy));
    engineReady = true;
    return context;
}

/**
 * The "Screen refresh" capability (replaces the mock, which could not guess
 * a value set for a radioGroup's own label payload). The item's position in
 * SCREEN_REFRESH_LABELS *is* the skip count, exactly as v1's own
 * `UI.skipFrame(index)` (optionsPanel.js:97-99) already uses the clicked
 * item's list index directly.
 */
export function setScreenRefresh(app, detail) {
    const label = detail && detail.value;
    const index = SCREEN_REFRESH_LABELS.indexOf(label);
    const value = index >= 0 ? index : 0;
    if (app && app.state) app.state.set(STATE_FIELDS.screenRefresh, value);
    if (app && app.log) app.log("screen-refresh.set", { [STATE_FIELDS.screenRefresh]: value });
    return value;
}
```

Both writers live here, not split across two files: `handleMissedDeadline` has to, since only this module ever sees a missed deadline, and co-locating `setScreenRefresh` keeps the one field's two writers next to each other rather than fragmenting ownership between a playback-capability file and some other, unrelated home - `setScreenRefresh` itself has no audio/engine logic at all, but nothing about it needs the audio device either (unlike `transportToggle`, it never calls `ensureEngine`), so this stays cheap for the authoring preview to import if it ever needs to (it does not today - the preview keeps its own mock, matching every other capability's own preview/generated-app split).

### `capabilities.js`

```js
"screen-refresh.set": { module: "./domain/playback/index.js", export: "setScreenRefresh" },
```

`high-dpi.toggle` is deliberately **not** added here - see "What this deliberately does not do".

### `renderers/canvas/mountGeneric.js` (extended)

The existing `draw()`/`relayout()` function bodies are renamed `performDraw()`/`performRelayout()` (unchanged internally - `performRelayout()` still ends by calling `performDraw()`). New:

```js
import { createFrameGovernor } from "../../runtime/frameGovernor.js";
// ...
const frameGovernor = createFrameGovernor();
let frameHandle = null;
let pending = null; // null | "draw" | "relayout" - "relayout" subsumes "draw"

function requestFrame(kind) {
    if (pending !== "relayout") pending = kind;
    if (frameHandle !== null) return;
    frameHandle = requestAnimationFrame(onAnimationFrame);
}

function onAnimationFrame(now) {
    frameHandle = null;
    const skipCount = Number(mockState.get("screen-refresh.value")) || 0;
    if (!frameGovernor.shouldDraw(now, skipCount)) {
        frameHandle = requestAnimationFrame(onAnimationFrame); // still pending; try again next frame
        return;
    }
    const kind = pending;
    pending = null;
    if (kind === "relayout") performRelayout();
    else if (kind === "draw") performDraw();
    // kind === null: nothing was actually pending when this frame arrived
    // (can happen after a skip-delay uses up its last opportunity on a tick
    // where nothing new came in) - nothing to draw, and nothing reschedules,
    // which is PERF-002's "goes idle" in practice.
}

function markNeedsDraw() { requestFrame("draw"); }
function markNeedsRelayout() { requestFrame("relayout"); }
```

Every prior direct call becomes one of the two mark functions - a mechanical rename at each of the ~20 sites, not a behavior change beyond "now next frame, not this tick." `recomputeLayout()`:

```js
function recomputeLayout() {
    const highDpi = Boolean(mockState.get("high-dpi.active"));
    const dpr = highDpi ? (window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round((canvas.clientWidth || 1) * dpr);
    canvas.height = Math.round((canvas.clientHeight || 1) * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    markNeedsRelayout();
}
```

The `onAnyChange` subscription near the end of the mount function gains one branch, since `high-dpi.active` affects the canvas's own backing size (a `recomputeLayout()` concern) while every other field only affects what gets drawn (a `markNeedsRelayout()` concern):

```js
const unsubscribeState = typeof options.state?.onAnyChange === "function"
    ? options.state.onAnyChange(path => {
        renderMockReadout();
        if (path === "high-dpi.active") recomputeLayout();
        else markNeedsRelayout();
    })
    : null;
```

## Data models

- **`screen-refresh.value`**: a plain integer, 0-4 (0-3 reachable manually via the four radio items in their authored order; 4 only reachable via automatic escalation, one step past the UI's own ceiling, matching v1). Already declared, seeded `""` today (read as `0` via `Number(value) || 0` wherever it is consumed).
- **`high-dpi.active`**: unchanged - already a plain boolean, already seeded `false`.
- No new store fields.

## Error handling

- **`screen-refresh.value` holds something unexpected** (the pre-this-spec seed `""`, or any non-numeric leftover): `Number(value) || 0` in both `frameGovernor`'s caller and `handleMissedDeadline` treats it as `0` (Smooth - render every eligible frame), never throws.
- **A missed deadline fires before `ensureEngine(app)` has ever run** (should not happen - the scheduler is only ever constructed inside `playPattern`/`playSong`, both deep inside code paths `ensureEngine` already gated): `setDefaultOnMissedDeadline` is a no-op call with nothing yet registered, so `Scheduler`'s own `onMissedDeadline` stays `null` and nothing fires - the existing `if (lateBy > DEFAULT_LATE && this.onMissedDeadline)` guard already tolerates a `null` handler.
- **A resize fires mid-frame while a draw is already pending**: `requestFrame("relayout")` running while `pending === "draw"` upgrades it to `"relayout"` (relayout always subsumes a plain draw); the reverse (a plain draw request arriving while a relayout is already pending) leaves `pending` at `"relayout"`, per `requestFrame`'s own guard - never downgraded.

## Testing strategy

`renderers/canvas/mountGeneric.js` has never had a test in this codebase (no DOM-testing dependency exists - `package.json` has none, confirmed before writing this design) and gains none here either; every prior spec that touched it (014, 015, 019, 020, 025, 030, 031) recorded the same real gap. What is newly testable, and covered:

- **`tests/frameGovernor.test.js`** (new, pure): the fps cap alone (a burst of calls faster than the cap all rejected, one every `1000/maxFps` accepted); the skip counter alone (skip=3 accepts the 4th eligible call, resets, repeats); the two composed (a rejected-by-cap call never advances the skip counter).
- **`tests/scheduler.test.js`** (extended): `setDefaultOnMissedDeadline` - a `Scheduler` built with no `onMissedDeadline` option calls the registered default when a deadline is missed; an explicit per-instance option still overrides it.
- **`tests/playback.test.js`** (extended): `handleMissedDeadline`'s cooldown (one call escalates immediately from a fresh state; a second inside 2000ms does not; a third past it does; the cap at 4 holds) against a fake `app.state`; `setScreenRefresh` against every label, an unrecognized one defaulting to `0`, and the no-`detail` case.

## Performance considerations

This spec's entire point. The measurable claims it makes (draws coalesce to one per frame, the fps cap holds, the skip count throttles) are proven at the level of `frameGovernor.js`'s own pure logic, not by measuring real canvas paint time - no browser exists here to measure that in, the same gap as ever. Per-node dirty regions (a further optimization *within* one coalesced draw) are explicitly deferred - see Scope boundaries in requirements.md.

## Security considerations

Not applicable; no new input surface.

## Monitoring and observability

`handleMissedDeadline`/`setScreenRefresh` both call `app.log(...)` on the same pattern every other capability already uses, so a throttle escalation or a manual screen-refresh change already appears wherever the application's own log sink is, with no new mechanism.

## What this deliberately does not do

- **No capability mapping for `high-dpi.toggle`.** The existing generated mock already does the one thing needed (cycle `[false, true]`, matching a plain checkbox exactly) - there is no domain logic to add, and mapping it to a hand-written module that would just do the same thing the mock already does is not simplicity, it is ceremony. `renderers/canvas/mountGeneric.js` reading the field is the whole fix.
- **No per-node dirty regions or per-element offscreen canvases** - the design sketch's own second, measurement-guided step. Not attempted without a way to measure whether it is needed.
- **No unification of the sprite-animation clock (spec 017) and this spec's own coalescing loop** into one shared `requestAnimationFrame` driver - both have independent, already-correct start/stop lifecycles; merging them is a refactor with no acceptance criterion requiring it.
- **No change to `domain/playback/engine/tracker.js`** - the extension point lives entirely in `scheduler.js` and `index.js`, both already v2 code.
