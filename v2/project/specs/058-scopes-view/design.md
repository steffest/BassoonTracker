# 058 — Design

## Overview

```
renderers/canvas/scopesGeometry.js (new, pure)
  cellRect(index, trackCount, rect) -> {left, top, width, height, lineLeft, lineWidth}
  hitTest(local, trackCount, rect) -> index | -1

runtime/scopesController.js (new)
  createScopesController(options) -> { handle(input), setDisabled, state }
  a pointerdown hit finds its own cell and calls domain/arrangement#toggleTrackMute

runtime/behaviors.js: scopes -> createScopesController
runtime/componentTypes.js: scopesView { behavior: "scopes", draw: "scopesView", ticks: true, ... }
renderers/canvas/drawKinds.js: scopesView { measure(), draw(...) }

project/specs/application/current/components/multitrackPanel.yaml (extended)
  a new scopesView sibling, above multitrackView
```

No `capabilities.js` change - a click calls `domain/arrangement` directly, the same self-contained shape `multitrackView`'s own control-strip clicks already have (spec 052).

## `renderers/canvas/scopesGeometry.js`

Ported from `visualiser.js`'s own `_setAnalyserPositions` (179-203) and `onClick`'s own hit test (96-108) - literally, including the `top = rect.height - cellHeight` formula for the second row (not `top = cellHeight`, the value it happens to equal once cells are exactly half-height, but not the expression v1 itself writes).

```js
export function cellRect(index, trackCount, rect) {
    let cols = trackCount;
    let cellHeight = rect.height;
    if (trackCount > 4) {
        cols = Math.ceil(trackCount / 2);
        cellHeight = rect.height / 2;
    }
    const cellWidth = rect.width / Math.max(1, cols);
    let left = index * cellWidth;
    let top = 0;
    if (index >= cols) {
        left = (index - cols) * cellWidth;
        top = rect.height - cellHeight;
    }
    return {
        left: Math.floor(left),
        top: Math.floor(top),
        width: Math.floor(cellWidth),
        height: Math.floor(cellHeight),
        lineLeft: Math.ceil(left + cellWidth / 70),
        lineWidth: Math.floor(cellWidth - cellWidth / 30)
    };
}

/** Ported from onClick's own strict-inequality hit test (100-105) - a point exactly on a cell's own edge misses, matching v1 exactly. */
export function hitTest(local, trackCount, rect) {
    for (let i = 0; i < trackCount; i++) {
        const pos = cellRect(i, trackCount, rect);
        if (local.x > pos.left && local.x < pos.left + pos.width && local.y > pos.top && local.y < pos.top + pos.height) return i;
    }
    return -1;
}
```

## `runtime/scopesController.js`

```js
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import { hitTest } from "../renderers/canvas/scopesGeometry.js";

export const SCOPES_STATE_FIELDS = ["hover", "focused", "disabled"];

export function createScopesController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };
    function set(field, value, transitions) { ... }

    function handle(input) {
        const transitions = [];
        let handled = false;
        let blocked = null;
        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); break;
            case "pointerleave": set("hover", false, transitions); break;
            case "focus": set("focused", true, transitions); break;
            case "blur": set("focused", false, transitions); break;
            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.local) break;
                const index = hitTest(input.local, song.getTrackCount(), input.rect);
                if (index >= 0) {
                    arrangement.toggleTrackMute(index);
                    handled = true;
                }
                break;
            }
            default: break;
        }
        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) { ... }
    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

No `ticks`-driven `onFrame` needed (the same as `multitrackView`/`volumeMeter`: `ticks: true` alone keeps the tick clock's own unconditional `markNeedsDraw()` running).

## `renderers/canvas/drawKinds.js` (new `scopesView` entry)

Reads `domain/song`/`domain/arrangement` directly - no bound field. Ported from `_modeTracksRender` (118-177), with the exact amplitude-boost formula (`_analyserAmp = 1.5`, confirmed live, not dead, by grepping the whole v1 tree for any other assignment - none exists):

```js
const SCOPE_BUFFER = new Uint8Array(256); // reused across cells/frames, matching multitrackView's own precedent

scopesView: {
    draw(ctx, assets, style, rect) {
        ctx.save();
        ctx.fillStyle = "rgb(9,13,19)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const trackCount = song.getTrackCount();
        const amp = 1.5;
        const offsetY = 0.5 - 0.5 * amp; // fraction of cell height - ported from _analyserAmp's own offsetY (149-152), expressed as a fraction rather than pixels here

        for (let i = 0; i < trackCount; i++) {
            const pos = scopesGeo.cellRect(i, trackCount, rect);
            const muteSolo = arrangement.getTrackMuteSolo(i);
            const data = muteSolo.mute ? null : arrangement.getTrackScopeData(i, SCOPE_BUFFER);

            ctx.strokeStyle = "rgba(120,255,50,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (data) {
                const sliceWidth = pos.lineWidth / data.length;
                for (let j = 0; j < data.length; j++) {
                    const v = data[j] / 128.0;
                    const wx = rect.x + pos.lineLeft + j * sliceWidth;
                    const wy = rect.y + pos.top + (v * amp / 2 + offsetY) * pos.height;
                    if (j === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
                }
            } else {
                const wy = rect.y + pos.top + pos.height / 2;
                ctx.moveTo(rect.x + pos.lineLeft, wy);
                ctx.lineTo(rect.x + pos.lineLeft + pos.lineWidth - 1, wy);
            }
            ctx.stroke();

            if (muteSolo.mute) {
                ctx.fillStyle = "rgba(34,49,85,0.5)";
                ctx.fillRect(rect.x + pos.left, rect.y + pos.top, pos.width, pos.height);
            }
        }
        ctx.restore();
        return { drawn: true };
    },
    measure() { return { width: 320, height: 80 }; }
}
```

(Final shape confirmed against `drawKinds.js`'s own real per-kind interface at implementation time.)

## `runtime/componentTypes.js`

```js
scopesView: {
    description: "The live per-track oscilloscope grid (spec 058) - the port's ninth specialized-component leaf. Reads domain/song/domain/arrangement directly (getTrackScopeData/getTrackMuteSolo, spec 051/052 - no new domain work at all, the first specialized leaf needing none). Only v1's own \"tracks\" mode is ported - \"wave\"/\"spectrum\" are declared labels with no rendering path behind them in v1 itself (render() always calls the one render method the file defines, regardless of the cycled mode - confirmed by reading the whole file). A click toggles that track's own mute directly, the same domain/arrangement mechanism multitrackView's own control strip already uses - no capabilities.js mapping.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "scopes",
    ticks: true,
    selection: null,
    direction: null,
    cursor: "default",
    draw: "scopesView",
    authoredIn: null,
    properties: {}
}
```

## `components/multitrackPanel.yaml`

```yaml
name: multitrackPanel
type: panel
layout:
  width: fill
  height: fill
content:
  - name: scopes
    type: scopesView
    layout:
      width: fill
      height: fixed
  - name: multitrackView
    type: multitrackView
    layout:
      width: fill
      height: fill
```

`height: fixed` relies on `measure()`'s own default (80px) the same way `editPad.yaml`'s own `height: fixed` already relies on `panel`'s skin default - confirmed empirically (no `layout-default-fallback` warning) before treating this as settled, the same lesson spec 054's own `layout: fixed` mistake already taught.

## Testing strategy

- **`tests/scopesGeometry.test.js`** (new): `cellRect` for <=4 tracks (one row) and >4 (two rows, including the exact `height - cellHeight` top), `hitTest`'s own strict-inequality edges and a miss between cells.
- **`tests/scopesController.test.js`** (new): a hit toggles the right track's own mute (against a real loaded fixture and `domain/arrangement#getTrackMuteSolo`); a miss does nothing; `disabled` blocks.
- **`tests/scopesView.test.js`** (new): registry declaration (including `ticks: true`), `measure()`, draw-never-throws with zero tracks, with real data, and with a muted track (the flat line + dim overlay).
- **`tests/multitrackScreen.test.js`** (extended): `scopesView` present, sized, and positioned above `multitrackView` inside `multitrackPanel`.
- `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no new warnings, no new loose ends - no command authored).
- `node --test tests/*.test.js` passes.

## What this deliberately does not do

See requirements.md's Scope boundaries: no "wave"/"spectrum" modes, no skin-atlas sprite background, no adaptive low-framerate FFT-size shrink, no piano, no classic-grid screen.
