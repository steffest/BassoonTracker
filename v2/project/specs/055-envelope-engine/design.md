# 055 — Design

## Overview

```
domain/sampleEditor/envelope.js (new)
  getEnvelope(type) -> {enabled, points, count, sustain, sustainPoint, loop, loopStartPoint, loopEndPoint}
  setPoint(type, index, x, y)
  addPoint(type)
  removePoint(type)
  setEnabled(type, enabled)
  setSustain(type, enabled)
  setSustainPoint(type, value)
  setLoop(type, enabled)
  setLoopStart(type, value)
  setLoopEnd(type, value)
```

`type` is `"volume"` or `"panning"` throughout - every function resolves `song.getCurrentInstrument()[type + "Envelope"]` itself, matching v1's own `instrument[me.type + "Envelope"]` lookup exactly.

## `domain/sampleEditor/envelope.js`

```js
import * as song from "../song/index.js";

const MAX_X = 324;
const MAX_Y = 64;
const MIN_GAP = 10; // v1's own fixed spacing for a newly added point

function envelopeOf(type) {
    const instrument = song.getCurrentInstrument();
    return instrument ? instrument[type + "Envelope"] : null;
}

/** ENV-001: a safe, falsy-default snapshot - every field v1's own envelopePanel.js#setInstrument reads falsy-safe, made explicit here instead of scattered `|| 0`/`|| false` at every call site. */
export function getEnvelope(type) {
    const envelope = envelopeOf(type);
    if (!envelope) return { enabled: false, points: [], count: 0, sustain: false, sustainPoint: 0, loop: false, loopStartPoint: 0, loopEndPoint: 0 };
    return {
        enabled: !!envelope.enabled,
        points: envelope.points || [],
        count: envelope.count || 0,
        sustain: !!envelope.sustain,
        sustainPoint: envelope.sustainPoint || 0,
        loop: !!envelope.loop,
        loopStartPoint: envelope.loopStartPoint || 0,
        loopEndPoint: envelope.loopEndPoint || 0
    };
}

/** ENV-002: ported from envelope.js#onHover/onDrag's own bounds (36-75, 92-110) - point 0 never moves horizontally; every other point clamps to its own immediate neighbors (or MAX_X for the last one); y always clamps 0-MAX_Y. */
export function setPoint(type, index, x, y) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.points || !envelope.points[index]) return;
    const point = envelope.points[index];

    let minX = 0, maxX = 0;
    if (index > 0) {
        minX = envelope.points[index - 1][0];
        maxX = index < envelope.count - 1 ? envelope.points[index + 1][0] : MAX_X;
    }
    point[0] = Math.max(minX, Math.min(maxX, x));
    point[1] = Math.max(0, Math.min(MAX_Y, y));
}

/** ENV-004: shared re-clamp, ported from envelopePanel.js#checkMax (245-251) - also run directly by setSustainPoint/setLoopStart/setLoopEnd, matching v1's own spinbox onChange call sites, not only removePoint's. */
function clampIndices(envelope) {
    if (!envelope.count) return;
    if (envelope.sustainPoint >= envelope.count) envelope.sustainPoint = envelope.count - 1;
    if (envelope.loopStartPoint >= envelope.count) envelope.loopStartPoint = envelope.count - 1;
    if (envelope.loopEndPoint >= envelope.count) envelope.loopEndPoint = envelope.count - 1;
}

/** ENV-003: ported from envelopePanel.js's own buttonAdd.onDown (40-61). */
export function addPoint(type) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.enabled) return;
    if (envelope.points.length > envelope.count) {
        const prevPoint = envelope.points[envelope.count - 1] || [0, 0];
        const nextPoint = envelope.points[envelope.count];
        if (prevPoint[0] + MIN_GAP < 320) {
            if (nextPoint[0] <= prevPoint[0]) nextPoint[0] = prevPoint[0] + MIN_GAP;
            envelope.count++;
        }
    } else {
        const lastPoint = envelope.points[envelope.points.length - 1];
        if (lastPoint[0] + MIN_GAP < 320) {
            envelope.points.push([lastPoint[0] + MIN_GAP, 32]);
            envelope.count = envelope.points.length;
        }
    }
}

/** ENV-003/004: ported from envelopePanel.js's own buttonRemove.onDown (67-79). */
export function removePoint(type) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.enabled) return;
    if (envelope.count > 2) {
        envelope.count--;
        clampIndices(envelope);
    }
}

export function setEnabled(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.enabled = !!enabled;
}
export function setSustain(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.sustain = !!enabled;
}
export function setSustainPoint(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.sustainPoint = Math.max(0, value);
    clampIndices(envelope);
}
export function setLoop(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.loop = !!enabled;
}
export function setLoopStart(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.loopStartPoint = Math.max(0, value);
    clampIndices(envelope);
}
export function setLoopEnd(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.loopEndPoint = Math.max(0, value);
    clampIndices(envelope);
}
```

`addPoint`'s own two branches mutate `envelope.points`/`envelope.count` directly on the real instrument object (the same live object `getCurrentInstrument()` returns) - no copy, matching every other `domain/sampleEditor` mutation's own "the real instrument, not a snapshot" shape (`setFinetune`, etc., spec 050).

## Data models

`{enabled, points, count, sustain, sustainPoint, loop, loopStartPoint, loopEndPoint}` - `points` stays a live reference to the instrument's own array (spec's own Decisions: "read by reference, not copied"). Nothing here is published to `app.state` - like `domain/sampleEditor/loopCreator.js`, this is read and written only by a later specialized leaf's own controller and draw kind, never through a bound `field`.

## Error handling

- **No current instrument, or an instrument with no envelope object at all**: `getEnvelope` returns the safe all-falsy shape; every setter's own `if (!envelope) return;` guard makes every other function a no-op rather than throwing.
- **`setPoint` for an index past `count` or with no point at that index**: a no-op (`!envelope.points[index]` guard) - not reachable through a real leaf's own hit-testing (which only ever offers an index `< count`), but cheap to guard anyway.
- **`addPoint`/`removePoint` on a disabled envelope**: both are no-ops, exactly matching v1's own shared guard - confirmed by reading `envelopePanel.js` line by line, not assumed from the two buttons' own visible behavior alone.

## Testing strategy

- **`tests/envelope.test.js`** (new): `getEnvelope` for no instrument, an instrument with a fresh (all-default) envelope, and a real `.xm` fixture's own real envelope; `setPoint` for point 0 (never moves), a middle point (both edges), and the last point (upper bound `MAX_X`), plus `y`'s own clamp; `addPoint`'s reuse-vs-append branches and its edge-of-canvas guard, and its disabled-envelope no-op; `removePoint`'s `count > 2` floor, its own re-clamp, and its disabled-envelope no-op; `setEnabled`/`setSustain`/`setLoop` each toggling with no other side effect; `setSustainPoint`/`setLoopStart`/`setLoopEnd` each re-clamping via the shared `clampIndices`.
- `node --test tests/*.test.js` passes; this spec touches no YAML/`capabilities.js`, so `node compiler/generate.js`/`node build.mjs app` are confirmed unaffected by an unchanged run, the same precedent specs 039/040/043/047/051 already established.

## What this deliberately does not do

See requirements.md's Scope boundaries: no interactive leaf, no surrounding panel, no screen wiring, no instrument-property undo.
