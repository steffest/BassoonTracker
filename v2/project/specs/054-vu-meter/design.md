# 054 — Design

## Overview

```
domain/playback/index.js (extended)
  getMasterScopeData(leftTarget, rightTarget) -> {left, right} | null
    lazily creates one ChannelSplitter(2) + two analysers, connects them
    once to Audio.cutOffVolume, fills leftTarget/rightTarget in place.

renderers/canvas/vuMeterGeometry.js (new, pure)
  DOT_WIDTH, DOT_MARGIN, LEVEL_SCALE (= Math.E - 1)
  dynamicRange(buffer) -> number 0-1          // ported _getDynamicRange, unscaled
  dotCountFor(width) -> number
  zoneFor(index, totalDots) -> "green"|"yellow"|"red"
  litDotCount(range, totalDots) -> number     // range already LEVEL_SCALE-applied by the caller

runtime/vuMeterController.js (new, minimal)
  createVuMeterController(initial) -> { handle(input), setDisabled, state }
  handle() only tracks hover/focused/disabled - no gesture vocabulary at all

runtime/behaviors.js: vuMeter -> createVuMeterController
runtime/componentTypes.js: volumeMeter { behavior: "vuMeter", draw: "volumeMeter", ticks: true, ... }
renderers/canvas/drawKinds.js: volumeMeter { measure(), draw(...) }

project/specs/application/current/components/volumemeter.yaml (new)
  name: volumemeter
  type: volumeMeter
  layout: { width: 160, height: 16 }   // explicit numbers, not the "fixed" keyword - see below
```

## `domain/playback/index.js` addition

```js
let masterScopeAnalysers = null; // { left, right } | null

function ensureMasterScopeAnalysers() {
    if (masterScopeAnalysers || !Audio.context || !Audio.cutOffVolume) return;
    const splitter = Audio.context.createChannelSplitter(2);
    Audio.cutOffVolume.connect(splitter);
    const left = Audio.context.createAnalyser();
    const right = Audio.context.createAnalyser();
    left.fftSize = right.fftSize = 32;
    left.smoothingTimeConstant = right.smoothingTimeConstant = 0.85;
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    masterScopeAnalysers = { left, right };
}

/**
 * The mix's own final stereo output (spec 054) - taps Audio.cutOffVolume,
 * the same real node v1's own menu.js#vumeter.connect does, not any
 * per-track signal (see getTrackScopeData, spec 052, for that). Lazily
 * connected once; every call after just refills the two targets.
 */
export function getMasterScopeData(leftTarget, rightTarget) {
    ensureMasterScopeAnalysers();
    if (!masterScopeAnalysers) return null;
    masterScopeAnalysers.left.getByteTimeDomainData(leftTarget);
    masterScopeAnalysers.right.getByteTimeDomainData(rightTarget);
    return { left: leftTarget, right: rightTarget };
}
```

`reset()` gains `masterScopeAnalysers = null;`, the same cleanup `trackAnalysers = []` already gets (spec 052) - a stale connection into a torn-down context must not survive a `reset()`/`createEngine()` cycle.

## `renderers/canvas/vuMeterGeometry.js`

```js
export const DOT_WIDTH = 10;
export const DOT_MARGIN = 2;
export const LEVEL_SCALE = Math.E - 1; // v1's own fudge factor, applied once in _renderVU

/** Ported from vumeter.js#_getDynamicRange (126-134) - unscaled, matching v1's own split. */
export function dynamicRange(buffer) {
    let min = 128, max = 128;
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        if (v < min) min = v;
        else if (v > max) max = v;
    }
    return (max - min) / 255;
}

export function dotCountFor(width) {
    return Math.max(0, Math.floor(width / (DOT_WIDTH + DOT_MARGIN)));
}

/** Ported from vumeter.js#_buildVu's own zone thresholds (94-97). */
export function zoneFor(index, totalDots) {
    if (index >= totalDots / 1.5) return "red";
    if (index >= totalDots / 3) return "yellow";
    return "green";
}

/** `range` is already LEVEL_SCALE-applied by the caller, matching v1's own _renderVU. A whole-dot simplification of v1's own pixel-precise clip (see requirements.md's Decisions) - dots light up to the level, not a partially-lit final dot. */
export function litDotCount(range, totalDots) {
    return Math.max(0, Math.min(totalDots, Math.floor(range * totalDots)));
}
```

## `runtime/vuMeterController.js`

```js
export const VU_METER_STATE_FIELDS = ["hover", "focused", "disabled"];

export function createVuMeterController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };
    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }
    function handle(input) {
        const transitions = [];
        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); break;
            case "pointerleave": set("hover", false, transitions); break;
            case "focus": set("focused", true, transitions); break;
            case "blur": set("focused", false, transitions); break;
            default: break;
        }
        return { transitions, activated: false, blocked: null, handled: false, changed: false, value: null, scrollTo: null };
    }
    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        return transitions;
    }
    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

No `mountGeneric.js#contextFor` branch is needed - nothing here reads a bound field or needs a modifier key resolved, the smallest possible specialized-leaf contract short of not having a controller at all (which `ticks` requires - see requirements.md's Decisions).

## `renderers/canvas/drawKinds.js` (new `volumeMeter` entry)

Reads `domain/playback#getMasterScopeData` directly - no bound field. Two rows of flat-colored dots (green/yellow/red by `zoneFor`), each row lit up to `litDotCount(dynamicRange(channelBuffer) * LEVEL_SCALE, totalDots)`, unlit dots drawn at lower alpha - the same lit/unlit contrast v1's own two pre-rendered canvases give, without the sprite images.

```js
volumeMeter: {
    draw(ctx, assets, style, rect) {
        const leftBuf = new Uint8Array(32), rightBuf = new Uint8Array(32);
        const data = playback.getMasterScopeData(leftBuf, rightBuf);
        const dots = vuGeo.dotCountFor(rect.width);
        const rowH = Math.max(1, Math.floor((rect.height - 4) / 2));

        function drawRow(buffer, y) {
            const lit = data ? vuGeo.litDotCount(vuGeo.dynamicRange(buffer) * vuGeo.LEVEL_SCALE, dots) : 0;
            for (let i = 0; i < dots; i++) {
                const zone = vuGeo.zoneFor(i, dots);
                const color = zone === "red" ? "200,60,60" : zone === "yellow" ? "210,190,60" : "70,200,90";
                ctx.fillStyle = `rgba(${color},${i < lit ? 0.95 : 0.25})`;
                ctx.fillRect(rect.x + i * (vuGeo.DOT_WIDTH + vuGeo.DOT_MARGIN), y, vuGeo.DOT_WIDTH, rowH);
            }
        }
        drawRow(leftBuf, rect.y);
        drawRow(rightBuf, rect.y + rowH + 4);
        return { drawn: true };
    },
    measure() { return { width: 160, height: 16 }; }
}
```

(Final shape confirmed against `drawKinds.js`'s own real per-kind interface, `import * as playback from "../../domain/playback/index.js"` and `import * as vuGeo from "./vuMeterGeometry.js"` added alongside this port's existing imports, at implementation time.)

## `runtime/componentTypes.js`

```js
volumeMeter: {
    description: "The stereo VU meter (spec 054) - the port's seventh specialized-component leaf. Taps the mix's own final output (domain/playback#getMasterScopeData) directly, no bound field. Genuinely passive in v1 (no click/drag/keyboard at all) but still interactive:true/ticks:true, the smallest controller shape short of not existing at all - a controller is required for `ticks` to take effect (see requirements.md's Decisions). Flat-colored dots, not skin-atlas sprites - see requirements.md.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "vuMeter",
    ticks: true,
    selection: null,
    direction: null,
    cursor: "default",
    draw: "volumeMeter",
    authoredIn: null,
    properties: {}
}
```

## `components/volumemeter.yaml`

```yaml
name: volumemeter
type: volumeMeter
layout:
  width: 160
  height: 16
```

Matches the *filename* `app.yaml`'s own existing `volume meter: volumemeter` bare-scalar reference resolves against (`convertReference` looks up `components/<name>.yaml` by that literal string, not a component-type name - confirmed by reading `compiler/convert.js#convertReference` before writing this file).

**Found while implementing, not anticipated in the sketch above**: `layout: {width: fixed, height: fixed}` (the keyword, no number - the shape every other specialized leaf's own placement uses) triggered two new `layout-default-fallback` warnings, since `resolveLayoutFields` only has a *default* size to fall back to for a `styled: true` type with a skin entry, or one of a handful of hardcoded component types (`panel`/`button`/`radioGroup`/`label`) - `volumeMeter` is none of those, and every prior specialized leaf sidesteps this by using `width: fill, height: fill` instead (confirmed by grep - none of them appear in `skin/default.yaml` either). Since `top`'s own row already gives `volumemeter` a fixed slot beside `menu`/`notifications`, `fill` was not the right fit here the way it is for a specialized leaf that already owns a whole panel to itself. Fixed by authoring the actual numbers (`160`/`16`, matching `measure()`'s own default) directly in `layout:` instead of the bare keyword - `resolveLayoutFields` treats an explicit number as self-sufficient, no default lookup at all, and emits no warning.

## Testing strategy

- **`tests/vuMeterGeometry.test.js`** (new): `dynamicRange` against hand-built buffers (silence -> 0, one sample at 0/255 with the rest 128 -> matches the formula exactly, a full-scale 0-255 spread -> 1); `dotCountFor` against a few widths; `zoneFor`'s three boundaries, hand-derived for a specific `totalDots`; `litDotCount`'s clamp at both ends and its floor behavior mid-range.
- **`tests/vuMeterController.test.js`** (new): hover/focus/blur transitions, `setDisabled`, `handle()` returning `handled: false` for everything (nothing here is a real gesture) - mirroring the smallest slice of `nibblesController.test.js`'s own convention.
- **`tests/volumeMeterView.test.js`** (new): registry declaration (including `ticks: true`), `measure()`, draw-never-throws before any connection exists (a real loaded fixture with no prior `getMasterScopeData` call) and after one, both rows' own dot count matching `dotCountFor(rect.width)`.
- **`tests/playback.test.js`** (extended): `getMasterScopeData` connects exactly once across repeated calls (checked via a call counter on a spied `createChannelSplitter`, or by asserting the same connection survives - confirmed at implementation time against what's easiest to observe honestly), and returns real per-channel byte data against a real loaded fixture and the silent context's own stub.
- `node compiler/generate.js`: diffed before/after - the `unresolved-component-reference "volumemeter"` warning is gone (15 warnings, down from 16), nothing else changes.
- `node --test tests/*.test.js` passes; `node build.mjs app` succeeds with loose ends adjusted only by the one warning resolving (an `unresolved-component-reference`'s own entry, if it separately appears in `LOOSE-ENDS.md` too - confirmed at implementation time by reading the actual before/after diff, not assumed).

## What this deliberately does not do

See requirements.md's Scope boundaries: no skin-atlas sprites, no v1-exact 500x16px size, no true VU ballistics beyond the analyser's own smoothing.
