# 040 — Design

## Overview

```
domain/sampleEditor/processing.js   pure DSP transforms - normalize, fades,
                                     boost/attenuate (soft-clip), trim bounds,
                                     reverse, invert. No Tracker, no domain/song.
domain/sampleEditor/index.js        the capability: selection, the four
                                     operations, undo registration
domain/sampleEditor/README.md

domain/song/index.js                + getCurrentInstrument(), + registerSampleEdit(),
                                     + applySampleDiff (wired into editHistory)
domain/song/editHistory.js           + an applySampleDiff hook, mirroring
                                     applyPatternDiff's own shape
```

## `domain/sampleEditor/processing.js` (new, pure)

Ported from `script/plugins/sampleeditor/sampleProcessing.js`, operating directly on a plain array (`range`) rather than an injected `context` - the split into "pure transform" vs. "how to get/put the range" is what `domain/sampleEditor/index.js` owns instead.

```js
const SILENCE_THRESHOLD = 1 / 128; // one 8-bit quantization step

function softClippedVolume(value, peak) {
    const sign = value < 0 ? -1 : 1;
    let abs = Math.abs(value);
    const inputKnee = 0.9;
    const outputKnee = 0.95;
    if (abs <= inputKnee) return value * (outputKnee / inputKnee);
    abs = Math.min(abs, peak);
    const compressed = outputKnee + ((abs - inputKnee) / (peak - inputKnee)) * (1 - outputKnee);
    return sign * Math.min(compressed, 1);
}

function boostVolumeSoftClip(range, scale) {
    let peak = 0;
    for (let i = 0; i < range.length; i++) {
        range[i] = range[i] * scale;
        peak = Math.max(peak, Math.abs(range[i]));
    }
    if (peak <= 0.9) return;
    peak = Math.max(peak, 1);
    for (let i = 0; i < range.length; i++) range[i] = softClippedVolume(range[i], peak);
}

/** @param {number[]} range mutated in place. @returns {boolean} whether anything changed. */
export function normalize(range) {
    let min = 0, max = 0;
    for (const v of range) { min = Math.min(min, v); max = Math.max(max, v); }
    const scale = 1 / Math.max(max, -min);
    if (scale <= 1) return false;
    for (let i = 0; i < range.length; i++) range[i] *= scale;
    return true;
}

export function fadeIn(range) {
    const last = range.length - 1;
    for (let i = 0; i <= last; i++) range[i] *= i / last;
}

export function fadeOut(range) {
    const last = range.length - 1;
    for (let i = 0; i <= last; i++) range[i] *= 1 - i / last;
}

/** amount > 0 boosts through the soft-knee compressor above; amount < 0 attenuates and clamps. */
export function adjustVolumePercent(range, amount) {
    const scale = 1 + 1 / amount;
    if (amount > 0) boostVolumeSoftClip(range, scale);
    else for (let i = 0; i < range.length; i++) range[i] = Math.min(Math.max(range[i] * scale, -1), 1);
}

export function reverseRange(range) { range.reverse(); }
export function invertRange(range) { for (let i = 0; i < range.length; i++) range[i] = -range[i]; }

/**
 * The new [start, end] bounds after stripping near-silent head/tail, never
 * cutting past a loop's own end, and enforcing an even length. Pure - takes
 * and returns bounds, does not slice `range` itself (index.js does that,
 * the same "compute, then apply" split trim()'s own v1 code already has).
 * @returns {{start: number, end: number}|null} null when there is nothing to trim.
 */
export function trimBounds(range, loop) {
    let start = 0;
    while (start < range.length && Math.abs(range[start]) < SILENCE_THRESHOLD) start++;
    if (start >= range.length) return null;

    let end = range.length - 1;
    while (end > start && Math.abs(range[end]) < SILENCE_THRESHOLD) end--;

    if (loop && loop.length > 2) {
        const loopEnd = loop.start + loop.length - 1;
        if (loopEnd > 0 && loopEnd < end) end = loopEnd;
    }

    if ((end - start + 1) & 1) end--;
    if (start > end) return null;
    if (start === 0 && end === range.length - 1) return null;

    return { start, end };
}
```

`trimBounds` takes `loop` already relative to the range being trimmed (`index.js` is responsible for that offset, matching v1's own `loopEnd = loop.start + loop.length - 1 - absRangeStart`); kept this way so the pure function never needs to know about "the rest of the sample outside the selection" at all.

## `domain/sampleEditor/index.js`

```js
import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";
import { normalize, fadeIn, fadeOut, adjustVolumePercent, reverseRange, invertRange, trimBounds } from "./processing.js";

let selectionStart = 0;
let selectionLength = 0; // 0 = "the whole sample"

export function getSampleSelection() {
    return { start: selectionStart, length: selectionLength };
}
export function setSampleSelection(start, length) {
    selectionStart = Math.max(0, start || 0);
    selectionLength = Math.max(0, length || 0);
}
export function resetSampleSelection() {
    selectionStart = 0;
    selectionLength = 0;
}

function splitRange(instrument) {
    const data = instrument.sample.data;
    if (selectionLength) {
        return {
            start: selectionStart,
            head: data.slice(0, selectionStart),
            range: data.slice(selectionStart, selectionStart + selectionLength),
            tail: data.slice(selectionStart + selectionLength)
        };
    }
    return { start: 0, head: [], range: data.slice(0), tail: [] };
}

function joinRange(instrument, parts) {
    instrument.sample.data = [...parts.head, ...parts.range, ...parts.tail];
    instrument.sample.length = instrument.sample.data.length;
}

function withRange(name, transform) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return false;
    const parts = splitRange(instrument);
    const before = parts.range.slice();
    const changed = transform(parts.range) !== false; // a transform returning `false` means "nothing changed"
    if (!changed) return false;
    joinRange(instrument, parts);
    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: parts.start,
        to: selectionLength,
        data: before,
        dataTo: parts.range.slice(),
        name
    });
    return true;
}

export function adjustVolume(amount) {
    if (amount === "max") return withRange("Adjust Volume", normalize);
    if (amount === "fadein") return withRange("Adjust Volume", range => { fadeIn(range); });
    if (amount === "fadeout") return withRange("Adjust Volume", range => { fadeOut(range); });
    if (typeof amount === "number") return withRange("Adjust Volume", range => { adjustVolumePercent(range, amount); });
    return false;
}

export function trim() {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return false;
    const parts = splitRange(instrument);
    const loop = instrument.sample.loop;
    const relativeLoop = loop && loop.length > 2 ? { start: loop.start - parts.start, length: loop.length } : null;
    const bounds = trimBounds(parts.range, relativeLoop);
    if (!bounds) return false;

    const before = parts.range.slice();
    parts.range = parts.range.slice(bounds.start, bounds.end + 1);
    joinRange(instrument, parts);
    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: parts.start,
        to: selectionLength,
        data: before,
        dataTo: parts.range.slice(),
        name: "Trim Sample"
    });

    // Shift the loop's own start the same way v1 does, then re-even both.
    if (loop && loop.length > 2 && loop.start >= parts.start) {
        const newStart = Math.max(parts.start, loop.start - bounds.start) & ~1;
        const newLength = loop.length & ~1;
        if (newStart !== loop.start || newLength !== loop.length) {
            loop.start = newStart;
            loop.length = newLength;
        }
    }
    return true;
}

export function reverse() { return withRange("Reverse Sample", reverseRange); }
export function invert() { return withRange("Invert Sample", invertRange); }
```

`withRange`'s own "did anything change" convention (`transform(...) !== false`) matches `sampleProcessing.js`'s own `update` boolean exactly: `normalize` (via `processing.js`) already returns `false` when scale ≤ 1, matching v1's own guard; the other transforms always change something once called, so they return `undefined` (`!== false`, i.e. "changed").

## `domain/song/index.js` (extended)

```js
export const getCurrentInstrument = () => Tracker.getCurrentInstrument();
export function registerSampleEdit(action) { history.registerEdit(action); }

function applySampleDiff(action, direction) {
    const instrument = Tracker.getInstruments()[action.instrument];
    if (!instrument) return;
    if (Tracker.getCurrentInstrumentIndex() !== action.instrument) Tracker.setCurrentInstrumentIndex(action.instrument);

    const restoreData = direction === "undo" ? action.data : action.dataTo;
    const currentLength = direction === "undo" ? action.dataTo.length : action.data.length;
    const data = instrument.sample.data;
    const head = data.slice(0, action.from);
    const tail = data.slice(action.from + currentLength);
    instrument.sample.data = [...head, ...restoreData, ...tail];
    instrument.sample.length = instrument.sample.data.length;
}

const history = createEditHistory({ applyPatternDiff, applySampleDiff });
```

`applySampleDiff` never needs `action.to` (the *original* selection length, unchanged even when `trim()` shortens the data) - only `action.data.length`/`action.dataTo.length`, which are always the true, current lengths on either side of the edit, so undo/redo work correctly for a length-changing edit (`trim`) exactly as they do for a same-length one (`reverse`/`invert`/`adjustVolume`).

## `domain/song/editHistory.js` (extended)

```js
export function createEditHistory({ maxHistory = 100, applyPatternDiff, applySampleDiff } = {}) {
    // ...unchanged...
    function replay(action, direction) {
        if (CELL_DIFF_KINDS.has(action.type)) {
            applyPatternDiff(action, direction);
        } else if (action.type === EDITACTION.VALUE) {
            // ...unchanged...
        } else if (action.type === EDITACTION.SAMPLE) {
            if (applySampleDiff) applySampleDiff(action, direction);
        }
    }
    // ...unchanged...
}
```

The stale `// DATA/SAMPLE: declared, not implemented here - P10's own territory.` comment is removed - this spec is that implementation. `EDITACTION.DATA` stays declared (harmless, matches v1's own enum) but nothing constructs an action with that `type` - see requirements.md's own collapsing decision.

## Data models

A sample-edit action: `{type: EDITACTION.SAMPLE, instrument: number, from: number, to: number, data: number[], dataTo: number[], name: string}` - `to` is the *selection length at the time of the edit* (informational/for parity with v1's own field, not read by replay), `from`/`data`/`dataTo` are what replay actually needs.

## Error handling

- **No current instrument, or no sample data**: every operation's own `song.getCurrentInstrument()` guard returns `false`/no-op, matching how nothing in this spec is reachable without a loaded song anyway (the same assumption every other capability in this codebase already makes).
- **A selection past the end of the sample**: `Array.prototype.slice` already clamps silently (matching JS's own semantics, and matching what v1's own `Array.slice` calls already do too - no v1 guard exists here either).

## Testing strategy

- **`tests/sampleProcessing.test.js`** (new, pure): `normalize` (scales up only when it would increase volume, never scales down), `fadeIn`/`fadeOut`, `adjustVolumePercent` (a boost that stays under the soft-knee threshold vs. one that engages it; an attenuation that clamps), `reverseRange`/`invertRange`, `trimBounds` (strips silence, respects a loop's own end point, enforces an even length, returns `null` when there is nothing to trim or the whole range is already tight).
- **`tests/sampleEditor.test.js`** (new): selection get/set/default; each of the four operations against a hand-built instrument object (mirroring `domain/playback/engine/models/instrument.js`'s own shape closely enough for `sample.data`/`sample.length`/`sample.loop` to work, not a full loaded module - matching how `domain/song`'s own history tests already use a fake pattern accessor rather than a real fixture where nothing else is needed); undo/redo for each operation, including a check that undoing an edit made on instrument N while instrument M is current switches back to N first, and that `trim`'s own length-changing edit round-trips exactly.
- **`domain/song`'s own existing tests** (unaffected - `applyPatternDiff`'s own behavior is untouched; a version-controlled diff of `editHistory.js` should show only additive lines).
- `node --test tests/*.test.js` passes; no `build.mjs`/compiler involvement at all.

## What this deliberately does not do

See requirements.md's Scope boundaries: no waveform view, no sample-editor screen, no loop creator, no resample panel, no hiss reduction, no bit-depth conversion, no decision yet on where the eventual screen mounts.
