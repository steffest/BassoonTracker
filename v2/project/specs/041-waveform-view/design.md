# 041 — Design

## Overview

```
runtime/componentTypes.js              "waveformView" registered
runtime/behaviors.js                   "waveform" -> createWaveformController
runtime/waveformController.js          the controller - reads/writes domain/song
                                        and domain/sampleEditor directly, the
                                        same contract gridController.js has
renderers/canvas/
  waveformGeometry.js                  pure: pixel<->sample-index, zoom clamp,
                                        edge-handle hit-testing
  drawKinds.js                         "waveformView" draw kind (new entry)
  mountGeneric.js                      one additive contextFor branch
```

## Why this mirrors `patternGrid`, not `fileBrowser`

Traced before designing, the same way spec 035 traced why `fileBrowser` could not reuse `listbox`'s own plumbing. A waveform view is tied to exactly one thing - the current instrument's sample - the same way `patternGrid` is tied to exactly one thing, the current pattern; neither is a generic, data-source-agnostic container the way `fileBrowser` deliberately is. `gridController.js` already established the contract for this shape: no bound `field`, reads/writes its own domain module(s) directly as a side effect of `handle()`, returns no `value`/`scrollTo` for the generic `applyValue`/`applyScroll` write-back to act on. `runtime/waveformController.js` follows the same contract, importing `domain/song/index.js` (for the current instrument) and `domain/sampleEditor/index.js` (for the selection) directly, exactly as `gridController.js` imports `domain/song/index.js`.

## `renderers/canvas/waveformGeometry.js` (new, pure)

```js
export const MIN_ZOOM_LENGTH = 16; // samples - a floor so zooming in can never collapse the view to nothing

export function contentLength(sampleLength) {
    return Math.max(0, sampleLength);
}

/** Clamps a requested {zoomStart, zoomLength} window into a valid one for `sampleLength` samples. */
export function clampZoom(zoomStart, zoomLength, sampleLength) {
    if (sampleLength <= 0) return { zoomStart: 0, zoomLength: 0 };
    const length = Math.min(Math.max(zoomLength, MIN_ZOOM_LENGTH), sampleLength);
    const start = Math.min(Math.max(zoomStart, 0), Math.max(0, sampleLength - length));
    return { zoomStart: start, zoomLength: length };
}

/** The sample index a pixel x (in the same space as `rect`) falls on, given the current window - matches waveform.js's own `zoomStart + i*(zoomLength/width)`. */
export function pixelToSampleIndex(rect, pixelX, zoomStart, zoomLength) {
    if (!rect || rect.width <= 0) return zoomStart;
    const step = zoomLength / rect.width;
    return Math.round(zoomStart + (pixelX - rect.x) * step);
}

/** The pixel x a sample index draws at - the exact inverse, so hit-testing and drawing can never disagree. */
export function sampleIndexToPixel(rect, index, zoomStart, zoomLength) {
    if (!rect || zoomLength <= 0) return rect ? rect.x : 0;
    const step = rect.width / zoomLength;
    return rect.x + (index - zoomStart) * step;
}

const EDGE_HIT_PIXELS = 5; // matches waveform.js's own `Math.abs(x - markerX) < 5`

/** Which selection edge (if any) a pixel x is within EDGE_HIT_PIXELS of - "start", "end", or null. */
export function edgeAt(rect, pixelX, selection, zoomStart, zoomLength) {
    if (!selection || !selection.length) return null;
    const startPixel = sampleIndexToPixel(rect, selection.start, zoomStart, zoomLength);
    const endPixel = sampleIndexToPixel(rect, selection.start + selection.length, zoomStart, zoomLength);
    if (Math.abs(pixelX - startPixel) < EDGE_HIT_PIXELS) return "start";
    if (Math.abs(pixelX - endPixel) < EDGE_HIT_PIXELS) return "end";
    return null;
}
```

## `runtime/waveformController.js` (new)

```js
import * as song from "../domain/song/index.js";
import * as sampleEditor from "../domain/sampleEditor/index.js";
import { clampZoom, pixelToSampleIndex, edgeAt, MIN_ZOOM_LENGTH } from "../renderers/canvas/waveformGeometry.js";

export const WAVEFORM_STATE_FIELDS = ["hover", "focused", "disabled", "zoomStart", "zoomLength"];

export function createWaveformController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), zoomStart: 0, zoomLength: 0 };
    let dragAnchor = null; // { mode: "resize-start"|"resize-end"|"new", index }

    function sampleLength() {
        const instrument = song.getCurrentInstrument();
        return instrument && instrument.sample ? instrument.sample.length : 0;
    }

    function ensureZoom() {
        const length = sampleLength();
        if (!state.zoomLength) state.zoomLength = length; // first use: the whole sample, matching v1's own zoom === 1 reset
        const clamped = clampZoom(state.zoomStart, state.zoomLength, length);
        state.zoomStart = clamped.zoomStart;
        state.zoomLength = clamped.zoomLength;
        return length;
    }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function handle(input) {
        const transitions = [];
        const length = ensureZoom();
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); break;
            case "pointerleave": set("hover", false, transitions); break;
            case "focus": set("focused", true, transitions); break;
            case "blur": set("focused", false, transitions); dragAnchor = null; break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled || !input.rect || !input.point || length <= 0) { blocked = state.disabled ? "disabled" : null; break; }
                const selection = sampleEditor.getSampleSelection();
                const edge = edgeAt(input.rect, input.point.x, selection, state.zoomStart, state.zoomLength);
                const index = pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength);
                if (edge === "start") dragAnchor = { mode: "resize-start", otherEdge: selection.start + selection.length };
                else if (edge === "end") dragAnchor = { mode: "resize-end", otherEdge: selection.start };
                else dragAnchor = { mode: "new", anchor: Math.max(0, Math.min(length - 1, index)) };
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.point) break;
                const index = Math.max(0, Math.min(length, pixelToSampleIndex(input.rect, input.point.x, state.zoomStart, state.zoomLength)));
                if (dragAnchor.mode === "new") {
                    const start = Math.min(dragAnchor.anchor, index);
                    const end = Math.max(dragAnchor.anchor, index);
                    sampleEditor.setSampleSelection(start, Math.max(0, end - start));
                } else if (dragAnchor.mode === "resize-start") {
                    const start = Math.min(Math.max(0, index), dragAnchor.otherEdge - 2);
                    sampleEditor.setSampleSelection(Math.max(0, start), dragAnchor.otherEdge - Math.max(0, start));
                } else if (dragAnchor.mode === "resize-end") {
                    const end = Math.max(Math.min(length, index), dragAnchor.otherEdge + 2);
                    sampleEditor.setSampleSelection(dragAnchor.otherEdge, Math.min(length, end) - dragAnchor.otherEdge);
                }
                handled = true;
                break;
            }

            case "pointerup":
                dragAnchor = null;
                handled = true;
                break;

            case "wheel": {
                if (state.disabled || length <= 0) break;
                const ctrlKey = input.ctrlKey;
                if (ctrlKey) {
                    const direction = Math.sign(input.deltaY || 0);
                    const factor = direction > 0 ? 1.25 : 0.8;
                    const center = state.zoomStart + state.zoomLength / 2;
                    const nextLength = state.zoomLength * factor;
                    const clamped = clampZoom(center - nextLength / 2, nextLength, length);
                    if (clamped.zoomStart === state.zoomStart && clamped.zoomLength === state.zoomLength) break;
                    state.zoomStart = clamped.zoomStart;
                    state.zoomLength = clamped.zoomLength;
                } else {
                    const direction = Math.sign(input.deltaY || 0);
                    const step = Math.max(1, Math.round(state.zoomLength * 0.1));
                    const clamped = clampZoom(state.zoomStart + direction * step, state.zoomLength, length);
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
        if (disabled) dragAnchor = null;
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

`changed`/`value`/`scrollTo` are always `null`/`false` - every effect (the selection, the zoom window) is already applied as a side effect inside `handle()`, the same shape `gridController.js` already uses; `mountGeneric.js`'s existing `feed()` write-back (`applyValue`/`applyScroll`) is never triggered for this behavior, exactly as it never is for `"grid"`.

## `renderers/canvas/drawKinds.js` (new entry)

```js
import * as sampleEditor from "../../domain/sampleEditor/index.js";
// (song is already imported for patternGrid)

waveformView: {
    draw(ctx, assets, style, rect, label, state) {
        const instrument = song.getCurrentInstrument();
        const data = instrument && instrument.sample ? instrument.sample.data : null;
        const length = data ? data.length : 0;

        ctx.save();
        ctx.fillStyle = "rgb(13, 19, 27)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const mid = rect.y + Math.floor(rect.height / 2);
        const quarter = Math.floor(rect.height / 4);
        ctx.strokeStyle = "rgba(0, 200, 180, 0.5)";
        ctx.beginPath(); ctx.moveTo(rect.x, mid); ctx.lineTo(rect.x + rect.width, mid); ctx.stroke();
        ctx.strokeStyle = "rgba(0, 200, 180, 0.2)";
        ctx.beginPath(); ctx.moveTo(rect.x, mid + quarter); ctx.lineTo(rect.x + rect.width, mid + quarter); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rect.x, mid - quarter); ctx.lineTo(rect.x + rect.width, mid - quarter); ctx.stroke();

        if (length > 0 && rect.width > 0) {
            const zoomStart = (state && state.zoomStart) || 0;
            const zoomLength = (state && state.zoomLength) || length;

            const selection = sampleEditor.getSampleSelection();
            if (selection.length) {
                const x1 = sampleIndexToPixel(rect, selection.start, zoomStart, zoomLength);
                const x2 = sampleIndexToPixel(rect, selection.start + selection.length, zoomStart, zoomLength);
                ctx.fillStyle = "rgba(110,150,230,0.28)";
                ctx.fillRect(Math.max(rect.x, x1), rect.y, Math.min(rect.x + rect.width, x2) - Math.max(rect.x, x1), rect.height);
            }

            const step = zoomLength / rect.width;
            const maxHeight = rect.height / 2 - 2;
            ctx.strokeStyle = "rgba(120, 255, 50, 0.5)";
            ctx.beginPath();
            for (let i = 0; i < rect.width; i++) {
                const index = zoomStart + Math.floor(i * step);
                const value = index >= 0 && index < length ? data[index] : 0;
                const y = mid - value * maxHeight;
                if (i === 0) ctx.moveTo(rect.x + i, y); else ctx.lineTo(rect.x + i, y);
            }
            ctx.stroke();
        }
        ctx.restore();
        return { drawn: true };
    },
    measure() {
        return { width: 300, height: 140 };
    }
}
```

Selection highlight drawn *underneath* the waveform line (matching draw order elsewhere - a tint first, content on top), not a v1 behavior to match exactly since v1 draws markers as separate lines, not a filled tint - a v2-appropriate simplification consistent with `listbox`/`fileBrowser`'s own selection-tint convention.

## `runtime/componentTypes.js`

```js
waveformView: {
    description: "The current instrument's sample, drawn and range-selectable (spec 041) - the port's third specialized-component leaf after patternGrid and fileBrowser. Reads domain/song and domain/sampleEditor directly, the same contract patternGrid already has, since a waveform view is tied to exactly one thing - not a generic, data-source-agnostic container the way fileBrowser deliberately is.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "waveform", // deliberately not "waveformView" - see fileBrowser's own naming lesson (spec 035)
    selection: null,
    direction: null,
    cursor: "default",
    draw: "waveformView",
    authoredIn: null,
    properties: {}
}
```

## `runtime/behaviors.js`

```js
waveform: createWaveformController
```

## `renderers/canvas/mountGeneric.js` (one additive touch)

```js
// contextFor(): a new branch alongside "grid"
} else if (behavior === "waveform") {
    extra.ctrlKey = pointerModifiers.ctrl;
}
```

`rect`/`point`/`local`/`deltaY` are already supplied generically at the top of `contextFor()` for every behavior; nothing else is needed. No `visualStateOf()` branch at all - the draw kind reads `domain/song`/`domain/sampleEditor` directly, the same as `patternGrid`'s own draw kind, so `state` passed to it is just `{...controller.state, highlighted}`, which already includes `zoomStart`/`zoomLength`.

## Data models

None new - reads `instrument.sample.data`/`.length` (already existing) and `domain/sampleEditor`'s own `{start, length}` selection (spec 040).

## Error handling

- **No current instrument, or an empty sample**: `sampleLength()` returns 0; every gesture's own `length <= 0` guard makes it a no-op; the draw kind's own `length > 0` guard skips the waveform line (still draws the guide lines and background).
- **A selection outside the current zoom window**: `sampleIndexToPixel` still computes a (possibly off-canvas) pixel position; the fill-rect clamps to `rect`'s own bounds (`Math.max(rect.x, x1)`/`Math.min(rect.x+rect.width, x2)`), so an out-of-view selection simply draws nothing rather than throwing or drawing outside the leaf's own box.

## Testing strategy

- **`tests/waveformGeometry.test.js`** (new, pure): `clampZoom` at both ends and for an empty sample; `pixelToSampleIndex`/`sampleIndexToPixel` round-trip; `edgeAt` for both edges, a miss, and no selection at all.
- **`tests/waveformController.test.js`** (new): a `patternGrid.test.js`-style setup against a real loaded fixture (`domain/song`/`domain/sampleEditor` both need a real instrument) - a plain drag creates a new, correctly-normalized selection; dragging an existing edge resizes it without moving the other edge or crossing it; wheel pans and clamps at both ends; ctrl+wheel zooms in and out and clamps at the minimum/full-length ends; disabled blocks every gesture.
- **`tests/waveformView.test.js`** (new, `patternGrid.test.js`-style fake canvas): the registry declaration; `measure()`'s floor size; `draw()` never throws with no instrument, an empty sample, or a selection outside the view; a selection tint is drawn when one exists.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` unaffected.

## What this deliberately does not do

See requirements.md's Scope boundaries: no loop markers, no range-volume fade gesture, no draw mode, no individual-sample dragging, no playback preview, no slice overlay, no pinch-zoom scrollbar, no screen.
