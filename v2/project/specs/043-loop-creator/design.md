# 043 — Design

## Overview

```
domain/sampleEditor/loopCreator.js (new)
  module state: loopStart/End/Length, dataLen, originalData (snapshot),
  origLoopStart/Length (for cancel + undo), three region sizes + their
  maxes, six blend values, snapToZero, instrument reference, isActive

  openLoopCreator(instrument)      seeds defaults, matches me.open
  isLoopCreatorOpen()
  getLoopCreatorState()            a plain snapshot object
  setLoopStart/setLoopLength       matches me.setLoopStart/setLoopLength
  setTailSize/setHeadSize/setLoopEndSize
  setBlendTail/setBlendHead/setBlendLoopEnd
  setOrigBlendTail/setOrigBlendHead/setOrigBlendLoopEnd
  setSnapToZero
  applyLoopPreset(index)           matches applyPreset
  saveLoopCreator()                registers one undo entry, matches saveLoop
  cancelLoopCreator()               matches cancelLoop

domain/song/index.js
  applySampleDiff gains one optional, backward-compatible extension:
  action.loop = {from: {start,length}, to: {start,length}}, restored
  alongside the data when present - fixes v1's own dead loopStart/
  loopLength undo fields (see requirements.md)
```

## `domain/sampleEditor/loopCreator.js`

```js
import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";

let instrument = null;
let originalData = null;      // Float32Array snapshot at open time
let origLoopStart = 0, origLoopLength = 0;
let loopStart = 0, loopLength = 0, loopEnd = 0, dataLen = 0;
let isActive = false;
let snapToZero = false;       // read by a later drag controller only - see requirements.md

let tailSize = 0, headSize = 0, loopEndSize = 0;
let maxTailSize = 0, maxHeadSize = 0, maxLoopEndSize = 0;
let blendTail = 0.5, blendHead = 0.5, blendLoopEnd = 0.5;
let origBlendTail = 1, origBlendHead = 1, origBlendLoopEnd = 1;

let headModLayer = [], loopEndLayer = [], tailLayer = []; // purple, orange, cyan
```

`recomputeMaxes`, `nearestZeroCrossing`, `computeLayers`, `applyPreview`, `clamp` are ported verbatim from `loopCreator.js` (276-375, 693) - see requirements.md's Purpose section for the algorithm itself; nothing about the math changes, only the host shape (module-level state instead of a closure's own `var`s, arrays instead of `Float32Array` for the three layers to match `domain/sampleEditor/processing.js`'s own plain-array convention).

```js
export function isLoopCreatorOpen() { return isActive; }

export function getLoopCreatorState() {
    return {
        loopStart, loopEnd, loopLength, dataLen,
        tailSize, headSize, loopEndSize,
        maxTailSize, maxHeadSize, maxLoopEndSize,
        blendTail, blendHead, blendLoopEnd,
        origBlendTail, origBlendHead, origBlendLoopEnd,
        snapToZero
    };
}

/** Ported from loopCreator.js#open (757-813). */
export function openLoopCreator(instr) {
    if (!instr || !instr.sample || !instr.sample.data || !instr.sample.data.length) return false;
    instrument = instr;
    const needsDefaultLoop = !instr.sample.loop.enabled || instr.sample.loop.length < 2;

    loopStart = instr.sample.loop.start;
    loopLength = instr.sample.loop.length;
    loopEnd = loopStart + loopLength;
    dataLen = instr.sample.data.length;
    origLoopStart = loopStart;
    origLoopLength = loopLength;
    originalData = Float64Array.from(instr.sample.data);

    if (needsDefaultLoop) {
        let defaultStart = nearestZeroCrossing(Math.floor(dataLen * 0.6));
        let defaultEnd = nearestZeroCrossing(Math.floor(dataLen * 0.85));
        if (defaultEnd <= defaultStart) defaultEnd = (defaultStart + 2) & ~1;
        loopStart = defaultStart; loopEnd = defaultEnd; loopLength = loopEnd - loopStart;
        instr.sample.loop.start = loopStart;
        instr.sample.loop.length = loopLength;
        instr.sample.loop.enabled = true;
        origLoopStart = loopStart;
        origLoopLength = loopLength;
    }

    recomputeMaxes();
    tailSize = Math.floor(maxTailSize / 4);
    headSize = Math.floor(maxHeadSize / 4);
    loopEndSize = Math.floor(maxLoopEndSize / 4);
    blendTail = blendHead = blendLoopEnd = 0.5;
    origBlendTail = origBlendHead = origBlendLoopEnd = 1;
    snapToZero = false;

    if (needsDefaultLoop) applyLoopPreset(3);
    else computeLayers();

    isActive = true;
    return true;
}

export function setLoopStart(value) {
    if (!dataLen) return;
    loopStart = Math.max(0, Math.min(value, loopEnd - 2)) & ~1;
    loopLength = loopEnd - loopStart;
    recomputeMaxes();
    computeLayers();
}

export function setLoopLength(value) {
    if (!dataLen) return;
    loopLength = Math.max(2, Math.min(value, dataLen - loopStart)) & ~1;
    loopEnd = loopStart + loopLength;
    recomputeMaxes();
    computeLayers();
}

export function setTailSize(value) { tailSize = Math.max(0, Math.min(maxTailSize, value)); computeLayers(); }
export function setHeadSize(value) { headSize = Math.max(0, Math.min(maxHeadSize, value)); computeLayers(); }
export function setLoopEndSize(value) { loopEndSize = Math.max(0, Math.min(maxLoopEndSize, value)); computeLayers(); }
export function setBlendTail(value) { blendTail = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setBlendHead(value) { blendHead = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setBlendLoopEnd(value) { blendLoopEnd = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setOrigBlendTail(value) { origBlendTail = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setOrigBlendHead(value) { origBlendHead = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setOrigBlendLoopEnd(value) { origBlendLoopEnd = Math.max(0, Math.min(1, value)); computeLayers(); }
export function setSnapToZero(value) { snapToZero = Boolean(value); }

const PRESETS = [
    null,
    () => [maxHeadSize, 1, 0, 0, 0, 1, 0, 0, 1],
    () => [0, 0, 1, maxTailSize, 1, 0, 0, 0, 1],
    () => [maxHeadSize >> 1, 0.5, 0.5, maxTailSize >> 1, 0.5, 0.5, maxLoopEndSize >> 1, 0.5, 0.5]
];

/** Ported from loopCreator.js#applyPreset (603-624). index 0 ("Select") is a no-op, matching v1. */
export function applyLoopPreset(index) {
    const build = PRESETS[index];
    if (!build) return false;
    const [h, bh, obh, t, bt, obt, le, ble, oble] = build();
    headSize = h; blendHead = bh; origBlendHead = obh;
    tailSize = t; blendTail = bt; origBlendTail = obt;
    loopEndSize = le; blendLoopEnd = ble; origBlendLoopEnd = oble;
    computeLayers();
    return true;
}

/** Ported from loopCreator.js#saveLoop (652-672), with domain/song/index.js's own applySampleDiff fix (see requirements.md) closing the loop-bounds-on-undo gap v1 never did. */
export function saveLoopCreator() {
    if (!isActive || !instrument || !originalData) return false;
    const undoFrom = Math.max(0, loopStart - Math.max(loopEndLayer.length, headModLayer.length));
    const undoTo = Math.max(loopEnd, Math.min(dataLen, loopStart + tailLayer.length));

    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: undoFrom,
        to: undoTo - undoFrom,
        data: Array.from(originalData.slice(undoFrom, undoTo)),
        dataTo: instrument.sample.data.slice(undoFrom, undoTo),
        loop: { from: { start: origLoopStart, length: origLoopLength }, to: { start: loopStart, length: loopLength } },
        name: "Create Loop"
    });

    isActive = false;
    return true;
}

/** Ported from loopCreator.js#cancelLoop/restoreInstrumentData (674-691). */
export function cancelLoopCreator() {
    if (!isActive) return false;
    if (instrument && originalData) {
        instrument.sample.data = Array.from(originalData);
        instrument.sample.loop.start = origLoopStart;
        instrument.sample.loop.length = origLoopLength;
    }
    isActive = false;
    return true;
}
```

## `domain/song/index.js` (one optional extension)

```js
function applySampleDiff(action, direction) {
    // ... existing data restore, unchanged ...
    if (action.loop) {
        const loop = direction === "undo" ? action.loop.from : action.loop.to;
        instrument.sample.loop.start = loop.start;
        instrument.sample.loop.length = loop.length;
    }
}
```

Every existing caller (the four spec-040 operations in `domain/sampleEditor/index.js`) omits `action.loop` entirely and is unaffected; `saveLoopCreator()` above is the first to supply it.

## Data models

`getLoopCreatorState()`'s own return shape is new; everything it reads/writes on `instrument.sample` (`.data`, `.length`, `.loop.{start,length,enabled}`) already exists (spec 040).

## Error handling

- **`openLoopCreator` with no instrument, no sample, or an empty sample** (v1's own early-return branch, `loopCreator.js:759-762`): returns `false`, leaves every setter's own `if (!dataLen) return;`/`computeLayers`'s own `if (!originalData || !dataLen) return;` guard as the backstop for any setter called out of sequence.
- **A setter called before `openLoopCreator`**: every setter either no-ops (`setLoopStart`/`setLoopLength`'s own `dataLen` guard) or writes a value `computeLayers` then silently ignores (its own `originalData`/`dataLen` guard) - matches v1's own behavior of a panel that simply has nothing to compute yet.
- **`saveLoopCreator`/`cancelLoopCreator` called while not open**: both return `false` immediately, a no-op - not reachable in v1 (the panel is hidden and its own buttons unresponsive), but cheap to guard here since nothing enforces "not called" the way visibility does in v1.

## Testing strategy

- **`tests/loopCreator.test.js`** (new): against the real `wizballalt.mod` fixture, mirroring `tests/sampleEditor.test.js`'s own convention - `openLoopCreator`'s two branches (default-loop creation with the Cross Fade preset applied; keeping an existing usable loop), every setter's own clamp (including a marker move that shrinks a region's current size below its new max), all three presets, `saveLoopCreator`'s own undo/redo round trip (data *and* loop bounds together - the fix), and `cancelLoopCreator`'s immediate restore with nothing registered on the undo stack.
- **A small, hand-computed fixture test for `computeLayers`/`applyPreview`** - a short synthetic sample (8-16 samples) with known loop bounds and blend values, asserting the exact expected output at a few indices, plus a same-input-twice idempotence check.
- **`tests/song.test.js`** (extended): one new test supplying `action.loop` to a manually-registered SAMPLE action and confirming both the data and the loop bounds round-trip through undo/redo together.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` unaffected (no YAML/compiler/capabilities.js touched).

## What this deliberately does not do

See requirements.md's Scope boundaries: no interactive drag-based overlay (the fourth specialized-component leaf, a later spec), no menu-bar controls or screen wiring, no `snapMarkersToZero` (dead code in v1), no zoom sync, no reactive instrument-change handling.
