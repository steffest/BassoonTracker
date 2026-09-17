# 044 — Design

## Overview

```
runtime/componentTypes.js              "loopCreatorView" registered
runtime/behaviors.js                   "loopCreator" -> createLoopCreatorController
runtime/loopCreatorController.js       the controller - reads/writes
                                        domain/sampleEditor/loopCreator.js
                                        directly, the same contract
                                        waveformController.js has
renderers/canvas/
  loopCreatorGeometry.js               pure: hitLoopTarget, blendToY (done)
  drawKinds.js                         "loopCreatorView" draw kind (new entry)
  mountGeneric.js                      one additive contextFor branch

domain/sampleEditor/loopCreator.js     two small additive exports:
                                        nearestZeroCrossing, getLoopCreatorLayers (done)
```

## `runtime/loopCreatorController.js` (new)

```js
import * as loopCreator from "../domain/sampleEditor/loopCreator.js";
import { clampZoom, pixelToSampleIndex } from "../renderers/canvas/waveformGeometry.js";
import { hitLoopTarget } from "../renderers/canvas/loopCreatorGeometry.js";

export const LOOP_CREATOR_STATE_FIELDS = ["hover", "focused", "disabled", "zoomStart", "zoomLength", "dragging"];

export function createLoopCreatorController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), zoomStart: 0, zoomLength: 0, dragging: null };
    let dragAnchor = null; // { mode, startX, startY, start<Field> } - one of the eleven target kinds

    function ensureZoom() {
        const s = loopCreator.getLoopCreatorState();
        const length = s.dataLen || 0;
        if (!state.zoomLength) state.zoomLength = length;
        const clamped = clampZoom(state.zoomStart, state.zoomLength, length);
        state.zoomStart = clamped.zoomStart;
        state.zoomLength = clamped.zoomLength;
        return s;
    }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function beginDrag(hit, input, s) {
        dragAnchor = { mode: hit, startX: input.point.x, startY: input.local.y, snapshot: s };
    }

    function applyDrag(input, s) {
        const startIndex = pixelToSampleIndex(input.rect, dragAnchor.startX, state.zoomStart, state.zoomLength);
        const currentIndex = pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength);
        const dx = currentIndex - startIndex;
        const dy = input.local ? input.local.y - dragAnchor.startY : 0;
        const waveH = input.rect.height;
        const denom = Math.max(1, waveH - 20); // BLEND_MARGIN*2, avoids a divide-by-~0 on a tiny rect
        const snap = value => (s.snapToZero ? loopCreator.nearestZeroCrossing(value) : value);

        switch (dragAnchor.mode) {
            case "markerStart": loopCreator.setLoopStart(snap(dragAnchor.snapshot.loopStart + dx)); break;
            case "markerEnd": loopCreator.setLoopLength(snap(dragAnchor.snapshot.loopEnd + dx) - dragAnchor.snapshot.loopStart); break;
            case "tail": loopCreator.setTailSize(dragAnchor.snapshot.tailSize + dx); break;
            case "head": loopCreator.setHeadSize(dragAnchor.snapshot.headSize - dx); break;
            case "loopEnd": loopCreator.setLoopEndSize(dragAnchor.snapshot.loopEndSize - dx); break;
            case "blendTail": loopCreator.setBlendTail(dragAnchor.snapshot.blendTail - dy / denom); break;
            case "blendHead": loopCreator.setBlendHead(dragAnchor.snapshot.blendHead - dy / denom); break;
            case "blendLoopEnd": loopCreator.setBlendLoopEnd(dragAnchor.snapshot.blendLoopEnd - dy / denom); break;
            case "origTail": loopCreator.setOrigBlendTail(dragAnchor.snapshot.origBlendTail - dy / denom); break;
            case "origHead": loopCreator.setOrigBlendHead(dragAnchor.snapshot.origBlendHead - dy / denom); break;
            case "origLoopEnd": loopCreator.setOrigBlendLoopEnd(dragAnchor.snapshot.origBlendLoopEnd - dy / denom); break;
        }
    }

    function handle(input) {
        const transitions = [];
        const s = ensureZoom();
        let handled = false, blocked = null;

        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); break;
            case "pointerleave": set("hover", false, transitions); break;
            case "focus": set("focused", true, transitions); break;
            case "blur": set("focused", false, transitions); dragAnchor = null; set("dragging", null, transitions); break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.point || !input.local || input.local.y < 0) break;
                const hit = hitLoopTarget(input.rect, { x: input.point.x, y: input.local.y }, { ...s, zoomStart: state.zoomStart, zoomLength: state.zoomLength });
                if (!hit) break;
                beginDrag(hit, input, s);
                set("dragging", hit, transitions);
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.point) break;
                applyDrag(input, s);
                handled = true;
                break;
            }

            case "pointerup":
                if (dragAnchor) handled = true;
                dragAnchor = null;
                set("dragging", null, transitions);
                break;

            case "wheel": {
                // identical pan/zoom shape to waveformController.js's own wheel case
                if (state.disabled || !(s.dataLen > 0)) break;
                const direction = Math.sign(input.deltaY || 0);
                if (direction === 0) break;
                if (input.ctrlKey) {
                    const factor = direction > 0 ? 1.25 : 0.8;
                    const center = state.zoomStart + state.zoomLength / 2;
                    const nextLength = state.zoomLength * factor;
                    const clamped = clampZoom(center - nextLength / 2, nextLength, s.dataLen);
                    if (clamped.zoomStart === state.zoomStart && clamped.zoomLength === state.zoomLength) break;
                    state.zoomStart = clamped.zoomStart;
                    state.zoomLength = clamped.zoomLength;
                } else {
                    const step = Math.max(1, Math.round(state.zoomLength * 0.1));
                    const clamped = clampZoom(state.zoomStart + direction * step, state.zoomLength, s.dataLen);
                    if (clamped.zoomStart === state.zoomStart) break;
                    state.zoomStart = clamped.zoomStart;
                }
                handled = true;
                break;
            }
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) { dragAnchor = null; set("dragging", null, transitions); }
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

`dragAnchor.snapshot` is the full `getLoopCreatorState()` captured at `pointerdown` - every drag re-derives its own candidate value from that one fixed starting point plus the current total delta, exactly as v1's own `dragStartLoop`/`dragStartSize`/`dragStartBlend` (each captured once at `onDragStart`) do, never from the previous `drag` event's own value. `changed`/`value`/`scrollTo` stay `null`/`false` always - every effect is already applied as a side effect inside `handle()`, the same shape every other specialized leaf's controller already has.

## `renderers/canvas/drawKinds.js` (new entry)

```js
import { getLoopCreatorState, getLoopCreatorLayers } from "../../domain/sampleEditor/loopCreator.js";
import { blendToY, sampleIndexToPixel } from "./loopCreatorGeometry.js"; // sampleIndexToPixel re-exported from waveformGeometry.js

loopCreatorView: {
    draw(ctx, assets, style, rect, label, state) {
        const s = getLoopCreatorState();
        ctx.save();
        ctx.fillStyle = "rgb(13, 19, 27)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        if (!(s.dataLen > 0) || rect.width <= 0) { ctx.restore(); return { drawn: true }; }

        const zoomStart = state.zoomStart || 0, zoomLength = state.zoomLength || s.dataLen;
        const at = index => sampleIndexToPixel(rect, index, zoomStart, zoomLength);
        const waveH = rect.height;

        // loop-region tint
        const lsX = at(s.loopStart), leX = at(s.loopEnd);
        ctx.fillStyle = "rgba(100, 130, 220, 0.10)";
        ctx.fillRect(lsX, rect.y, leX - lsX, waveH);

        // the three blend layers, each plotted only over its own sample range
        const layers = getLoopCreatorLayers();
        drawBlendLayer(ctx, layers.tailLayer, s.loopStart, at, rect, waveH, "rgba(0,210,230,0.85)", "rgba(0,210,230,0.13)");
        drawBlendLayer(ctx, layers.loopEndLayer, s.loopEnd - s.headSize, at, rect, waveH, "rgba(255,140,50,0.85)", "rgba(255,140,50,0.13)");
        drawBlendLayer(ctx, layers.headModLayer, s.loopStart - s.loopEndSize, at, rect, waveH, "rgba(180,80,255,0.85)", "rgba(180,80,255,0.13)");

        // loop markers - a plain vertical line, brighter while its own drag is active
        ctx.fillStyle = "rgba(241, 220, 71, 0.9)";
        ctx.fillRect(lsX, rect.y, state.dragging === "markerStart" ? 2 : 1, waveH);
        ctx.fillRect(leX, rect.y, state.dragging === "markerEnd" ? 2 : 1, waveH);

        // blend-volume/orig-volume lines (small filled triangles toward the loud side)
        drawBlendLine(ctx, s.blendTail, s.loopStart, s.loopStart + s.tailSize, at, waveH, "rgba(0,210,230,", state.dragging === "blendTail");
        drawBlendLine(ctx, s.blendHead, s.loopEnd - s.headSize, s.loopEnd, at, waveH, "rgba(255,140,50,", state.dragging === "blendHead");
        drawBlendLine(ctx, s.blendLoopEnd, s.loopStart - s.loopEndSize, s.loopStart, at, waveH, "rgba(180,80,255,", state.dragging === "blendLoopEnd");
        drawBlendLine(ctx, s.origBlendTail, s.loopStart, s.loopStart + s.tailSize, at, waveH, "rgba(120,255,50,", state.dragging === "origTail");
        drawBlendLine(ctx, s.origBlendHead, s.loopEnd - s.headSize, s.loopEnd, at, waveH, "rgba(120,255,50,", state.dragging === "origHead");
        drawBlendLine(ctx, s.origBlendLoopEnd, s.loopStart - s.loopEndSize, s.loopStart, at, waveH, "rgba(120,255,50,", state.dragging === "origLoopEnd");

        // the three size handles
        const handleMidY = rect.y + Math.floor(waveH / 2);
        drawHandle(ctx, at(s.loopStart + s.tailSize), handleMidY, "rgba(0,210,230,0.95)", state.dragging === "tail");
        if (s.maxHeadSize > 0) drawHandle(ctx, at(s.loopEnd - s.headSize), handleMidY, "rgba(255,140,50,0.95)", state.dragging === "head");
        if (s.maxLoopEndSize > 0) drawHandle(ctx, at(s.loopStart - s.loopEndSize), handleMidY, "rgba(180,80,255,0.95)", state.dragging === "loopEnd");

        ctx.restore();
        return { drawn: true };
    },
    measure() { return { width: 300, height: 140 }; }
}
```

`drawBlendLayer`/`drawBlendLine`/`drawHandle` are small private helpers ported from `loopCreator.js#drawLayer`/`drawBlendLine`/`drawHandle` (481-537), simplified to this port's own rect-relative coordinate space (v1's own panel is always at local origin `0,0`; this draw kind adds `rect.x`/`rect.y` throughout, matching every other draw kind's own convention). The color-key legend (v1's own `drawWave` tail, 462-476) is left out - see requirements.md's Scope boundaries.

## `runtime/componentTypes.js`

```js
loopCreatorView: {
    description: "The loop creator's own interactive overlay (spec 044) - the port's fourth specialized-component leaf, after patternGrid, fileBrowser and waveformView. Its own controller (behavior \"loopCreator\") and draw kind read domain/sampleEditor/loopCreator.js directly - eleven independent drag targets (two loop markers, three blend-size handles, three blend-volume lines, three \"original volume\" lines), each already clamped by the exact domain setter spec 043 built.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "loopCreator",
    selection: null,
    direction: null,
    cursor: "default",
    draw: "loopCreatorView",
    authoredIn: null,
    properties: {}
}
```

## `runtime/behaviors.js`

```js
loopCreator: createLoopCreatorController
```

No type-name collision to avoid here (the type is `loopCreatorView`, the behavior is `loopCreator` - distinct strings, same shape `waveform`/`waveformView` already established).

## `renderers/canvas/mountGeneric.js` (one additive touch)

```js
// contextFor(): a new branch alongside "waveform"
} else if (behavior === "loopCreator") {
    extra.ctrlKey = pointerModifiers.ctrl;
}
```

`rect`/`point`/`local`/`deltaY` are already supplied generically; nothing else is needed. No `visualStateOf` branch - the draw kind reads `domain/sampleEditor/loopCreator.js` directly, so `state` passed to it is just `{...controller.state, highlighted}` (`zoomStart`/`zoomLength`/`dragging` already included).

## Data models

None new - `getLoopCreatorState()`/`getLoopCreatorLayers()` (spec 043, extended by this spec) are the only state read; nothing here is authored in any component tree yet.

## Error handling

- **No loop-creator session open** (`s.dataLen` is 0): every gesture's own `!(s.dataLen > 0)`/`length<=0` guard makes it a no-op; the draw kind's own guard skips straight to just the background fill.
- **A drag target whose region has shrunk to zero since the drag started** (e.g. a marker move mid-drag on a *different* pointer sequence changed `maxTailSize` down to where `tailSize` no longer fits): not reachable from a single continuous drag (only one target moves per drag), and the next `pointerdown`'s own `hitLoopTarget` call re-evaluates against the live state regardless.

## Testing strategy

- **`tests/loopCreatorGeometry.test.js`** (new, pure): all eleven targets resolve correctly and in the right priority order where two could otherwise overlap; a miss; `blendToY`'s own inverse relationship to `BLEND_MARGIN`.
- **`tests/loopCreatorController.test.js`** (new): against the real `wizballalt.mod` fixture (matching `waveformController.test.js`'s own convention, since this controller also reads/writes a real domain module directly) - each of the eleven drag targets moves its own matching state field by the expected amount; marker drags honor `snapToZero` only when it is on; wheel pan/zoom mirrors `waveformController.test.js`'s own tests; disabled blocks every gesture.
- **`tests/loopCreatorView.test.js`** (new, `patternGrid.test.js`-style fake canvas): the registry declaration; `measure()`'s floor size; `draw()` never throws with no session open, with a real session open, and with every region size at its own maximum.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` unaffected.

## What this deliberately does not do

See requirements.md's Scope boundaries: no menu-bar controls, no screen wiring, no dynamic cursor hinting, no zoom sync with the plain waveform view, no color-key legend.
