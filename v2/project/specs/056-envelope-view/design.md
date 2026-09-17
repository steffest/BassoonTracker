# 056 — Design

## Overview

```
renderers/canvas/envelopeGeometry.js (new, pure)
  LOGICAL_WIDTH = 324, LOGICAL_HEIGHT = 64, HIT_RADIUS = 6
  toLogical(local, rect) -> {x, y}   // y flipped: 0 at rect's own bottom
  toPixel(point, rect) -> {x, y}     // inverse, for drawing
  pointAt(points, count, logical) -> index | -1

runtime/envelopeController.js (new)
  createEnvelopeController(options) -> { handle(input), setDisabled, state }
  options.envelopeType: "volume" | "panning" (default "volume")

runtime/behaviors.js: envelope -> createEnvelopeController
runtime/componentTypes.js: envelopeView { behavior: "envelope", draw: "envelopeView", properties: { envelopeType } }
renderers/canvas/drawKinds.js: envelopeView { measure(), draw(...) }
renderers/canvas/mountGeneric.js:
  - controller-construction loop: node.envelopeType -> options.envelopeType
  - handlePointerMove: widen the flyout-only pointermove forward to include "envelope"
```

## `renderers/canvas/envelopeGeometry.js`

```js
export const LOGICAL_WIDTH = 324;
export const LOGICAL_HEIGHT = 64;
export const HIT_RADIUS = 6;

/** Ported from envelope.js#onHover's own x/y lines (43-44) - logical y is measured from the rect's own bottom, the opposite of screen-pixel y. */
export function toLogical(local, rect) {
    const xScale = rect.width / LOGICAL_WIDTH;
    const yScale = rect.height / LOGICAL_HEIGHT;
    return { x: Math.round(local.x / xScale), y: Math.round((rect.height - local.y) / yScale) };
}

/** Inverse of toLogical, for the draw kind - shared so drawing and hit-testing can never disagree. */
export function toPixel(point, rect) {
    const xScale = rect.width / LOGICAL_WIDTH;
    const yScale = rect.height / LOGICAL_HEIGHT;
    return { x: point[0] * xScale, y: rect.height - point[1] * yScale };
}

/** Ported from envelope.js#onHover's own loop (47-66) - first point (in index order) within a 6-unit box, or -1. */
export function pointAt(points, count, logical) {
    for (let i = 0; i < count; i++) {
        const point = points[i] || [0, 0];
        if (Math.abs(logical.x - point[0]) < HIT_RADIUS && Math.abs(logical.y - point[1]) < HIT_RADIUS) return i;
    }
    return -1;
}
```

## `runtime/envelopeController.js`

```js
import * as envelope from "../domain/sampleEditor/envelope.js";
import { toLogical, pointAt } from "../renderers/canvas/envelopeGeometry.js";

export const ENVELOPE_STATE_FIELDS = ["hover", "focused", "disabled", "activeIndex", "dragging", "envelopeType"];

export function createEnvelopeController(options = {}) {
    const envelopeType = options.envelopeType === "panning" ? "panning" : "volume";
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), activeIndex: -1, dragging: false, envelopeType };
    let dragAnchor = null; // { index, startPoint: [x, y], startLogical: {x, y} }

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function updateHover(input, transitions) {
        if (state.disabled || state.dragging || !input.rect || !input.local) return;
        const env = envelope.getEnvelope(envelopeType);
        const index = env.enabled ? pointAt(env.points, env.count, toLogical(input.local, input.rect)) : -1;
        set("activeIndex", index, transitions);
    }

    function handle(input) {
        const transitions = [];
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("activeIndex", -1, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                dragAnchor = null;
                set("dragging", false, transitions);
                break;
            case "pointermove":
                updateHover(input, transitions);
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                updateHover(input, transitions);
                if (state.activeIndex < 0 || !input.rect || !input.local) break;
                const env = envelope.getEnvelope(envelopeType);
                const point = env.points[state.activeIndex];
                if (!point) break;
                dragAnchor = { index: state.activeIndex, startPoint: [point[0], point[1]], startLogical: toLogical(input.local, input.rect) };
                set("dragging", true, transitions);
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.local) break;
                const current = toLogical(input.local, input.rect);
                const candidateX = dragAnchor.startPoint[0] + (current.x - dragAnchor.startLogical.x);
                const candidateY = dragAnchor.startPoint[1] + (current.y - dragAnchor.startLogical.y);
                envelope.setPoint(envelopeType, dragAnchor.index, candidateX, candidateY);
                handled = true;
                break;
            }

            case "pointerup":
                if (dragAnchor) handled = true;
                dragAnchor = null;
                set("dragging", false, transitions);
                break;

            default:
                break;
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            dragAnchor = null;
            set("dragging", false, transitions);
            set("activeIndex", -1, transitions);
        }
        return transitions;
    }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

`pointerdown` calls `updateHover` itself first (rather than relying only on a preceding `pointermove`) so a plain click-without-prior-hover (a synthetic test, or a touch device with no hover concept at all) still finds the point it landed on - a small, deliberate robustness addition beyond v1's own mouse-only assumption, not a behavior change for the mouse case (which already hovers before it can press).

## `renderers/canvas/drawKinds.js` (new `envelopeView` entry)

Reads `domain/sampleEditor/envelope.js#getEnvelope(state.envelopeType)` directly - no bound field, the same contract every specialized leaf's own draw kind already has. `state.activeIndex` (the hovered/dragged point) comes from the controller the same generic way every other controller-derived draw field already does.

```js
envelopeView: {
    draw(ctx, assets, style, rect, label, state) {
        ctx.save();
        ctx.fillStyle = "rgb(13, 19, 27)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const envelopeType = (state && state.envelopeType) || "volume";
        if (envelopeType === "panning") {
            ctx.strokeStyle = "#4a7c92";
            ctx.setLineDash([1, 2]);
            const midY = rect.y + Math.floor(rect.height / 2);
            ctx.beginPath();
            ctx.moveTo(rect.x, midY);
            ctx.lineTo(rect.x + rect.width, midY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const env = envelope.getEnvelope(envelopeType);
        if (!env.count) { ctx.restore(); return { drawn: true }; }

        const activeIndex = (state && state.activeIndex) ?? -1;
        ctx.strokeStyle = env.enabled ? "rgba(120,255,50,0.5)" : "rgba(120,120,180,0.5)";
        ctx.beginPath();
        for (let i = 0; i < env.count; i++) {
            const point = env.points[i];
            if (!point) continue;
            const px = envGeo.toPixel(point, rect);
            if (i === 0) ctx.moveTo(rect.x + px.x, rect.y + px.y);
            else ctx.lineTo(rect.x + px.x, rect.y + px.y);
        }
        ctx.stroke();

        for (let i = 0; i < env.count; i++) {
            const point = env.points[i];
            if (!point) continue;
            const px = envGeo.toPixel(point, rect);
            const size = i === activeIndex ? 6 : 4;
            ctx.fillStyle = i === activeIndex ? "#FFFFFF" : (env.enabled ? "#D2861B" : "#546888");
            const h = size / 2;
            ctx.fillRect(rect.x + px.x - h, rect.y + px.y - h, size, size);
        }

        if (env.enabled) {
            const drawLine = x => {
                ctx.setLineDash([1, 2]);
                ctx.beginPath();
                ctx.moveTo(rect.x + x, rect.y);
                ctx.lineTo(rect.x + x, rect.y + rect.height);
                ctx.stroke();
            };
            const sustainPoint = env.points[env.sustainPoint];
            if (env.sustain && sustainPoint) {
                ctx.strokeStyle = "#67b6d2";
                drawLine(envGeo.toPixel(sustainPoint, rect).x);
            }
            if (env.loop) {
                ctx.strokeStyle = "#d2b637";
                const loopStart = env.points[env.loopStartPoint];
                const loopEnd = env.points[env.loopEndPoint];
                if (loopStart) drawLine(envGeo.toPixel(loopStart, rect).x);
                if (loopEnd) drawLine(envGeo.toPixel(loopEnd, rect).x);
            }
        }

        ctx.restore();
        return { drawn: true };
    },
    measure() { return { width: 324, height: 64 }; }
}
```

(Final shape confirmed against `drawKinds.js`'s own real per-kind interface at implementation time.)

## `runtime/componentTypes.js`

```js
envelopeView: {
    description: "The envelope editor's own interactive graph (spec 056) - the port's eighth specialized-component leaf. Its own controller (behavior \"envelope\") and draw kind read domain/sampleEditor/envelope.js (spec 055) directly - drag a point, hover to find one. `envelopeType` (\"volume\"/\"panning\") is the first per-node property any specialized leaf in this port needs to pick which of two variants of the same domain concept it addresses, read the same way rangeSlider's own `vertical` override already is (mountGeneric.js's controller-construction loop, not a second component type). Not yet authored in any component tree - the surrounding panel and screen wiring are a later spec's own.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "envelope",
    selection: null,
    direction: null,
    cursor: "default",
    draw: "envelopeView",
    authoredIn: null,
    properties: {
        envelopeType: { kind: "text", description: "Which of the current instrument's two envelopes this view edits - \"volume\" or \"panning\". Defaults to \"volume\"." }
    }
}
```

## `runtime/behaviors.js`

```js
envelope: createEnvelopeController
```

## `renderers/canvas/mountGeneric.js`

Two small, additive changes:

```js
// in the controller-construction loop, next to node.vertical:
if (node.envelopeType) options.envelopeType = node.envelopeType;
```

```js
// in handlePointerMove, widening the existing flyout-only forward:
const behaviorName = behaviorNames.get(routedId);
if (behaviorName === "flyout" || behaviorName === "envelope") feed(routedId, { type: "pointermove", point }, { quietIfIgnored: true });
```

## Data models

Controller state's `activeIndex`/`dragging`/`envelopeType` are read by the draw kind only - never written to `app.state`, the same "specialized leaf owns its own interaction state" contract every prior leaf already has.

## Error handling

- **No rect/local on `pointerdown`/`drag`/`pointermove`** (not reachable through `mountGeneric.js`'s own dispatch, but guarded the same way every other controller here already is): the branch does nothing.
- **A disabled envelope**: `updateHover` never sets an `activeIndex` at all (mirroring v1's own `if (currentEnvelope && currentEnvelope.enabled)` guard), so no drag can ever start either - `pointerdown` finds `activeIndex < 0` and does nothing beyond focusing.
- **`getEnvelope`'s own points array shorter than `count`, or a missing point at the active index** (defensive - `domain/sampleEditor/envelope.js`'s own invariants should prevent this, but the leaf does not assume it): `pointAt`'s own `points[i] || [0, 0]` guard, and `pointerdown`'s own `if (!point) break;`.

## Testing strategy

- **`tests/envelopeGeometry.test.js`** (new): `toLogical`/`toPixel` are inverses over a range of rects and points; `pointAt` for a hit, a miss, and two points close enough together that only the first-in-order one wins.
- **`tests/envelopeController.test.js`** (new): hover finding the nearest point (and none on a disabled envelope, and none while already dragging); a relative drag moving the active point by the correct delta, including one that gets clamped by `setPoint` itself; `envelopeType` defaulting to `"volume"` and correctly addressing `"panning"` when constructed with that option - against a real loaded `.xm` fixture's own real envelope, mirroring `nibblesController.test.js`'s/`multitrackController.test.js`'s own convention.
- **`tests/envelopeView.test.js`** (new): registry declaration (including the new `envelopeType` property), `measure()`, draw-never-throws for a disabled envelope, an enabled one with sustain/loop, and the panning variant's own reference line appearing exactly once and only for that variant.
- `node --test tests/*.test.js` passes. This spec touches no YAML/`capabilities.js` - `envelopeView` is registered but not yet placed in any component tree, matching `loopCreatorView`'s/`multitrackView`'s own precedent; `node compiler/generate.js`/`node build.mjs app` confirmed unaffected by an unchanged run.

## What this deliberately does not do

See requirements.md's Scope boundaries: no surrounding panel, no screen wiring, no dynamic cursor hinting, no instrument-property undo.
