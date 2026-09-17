// The loop creator (spec 043), the first of P10's three separable
// sub-features spec 040 recorded (loopCreator.js/resamplePanel.js/
// hissReductionPanel.js). Ported from script/plugins/sampleeditor/
// loopCreator.js (848 lines) - the state model and DSP only: three
// independently-sized regions blended across a loop seam to avoid an
// audible click, each with its own two blend-volume controls. The
// interactive drag-based waveform overlay this needs (its own eight
// independent drag targets), the menu-bar controls, and the screen wiring
// are a later spec's own - see requirements.md's Scope boundaries. Nothing
// here is reachable from any UI yet - headless only, matching spec
// 039/040's own precedent.
//
// Like domain/sampleEditor/index.js, this module never imports
// domain/playback/engine/ directly - it reaches the current instrument
// index and registers undo entries only through domain/song/index.js's own
// public surface.

import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";

let instrument = null;
let originalData = null; // a plain-array snapshot at open time, not a typed array - matches every other sample snapshot in this port (domain/sampleEditor/index.js's own withRange)
let origLoopStart = 0, origLoopLength = 0; // loop bounds at open time - restored by cancelLoopCreator, and by undo (via the registered action's own "from")
let loopStart = 0, loopLength = 0, loopEnd = 0, dataLen = 0;
let isActive = false;
let snapToZero = false; // read by a later drag controller only - setLoopStart/setLoopLength deliberately never apply it, matching v1's own asymmetry (see requirements.md)

let tailSize = 0, headSize = 0, loopEndSize = 0; // cyan, orange, purple - see requirements.md's Purpose section
let maxTailSize = 0, maxHeadSize = 0, maxLoopEndSize = 0;
let blendTail = 0.5, blendHead = 0.5, blendLoopEnd = 0.5;
let origBlendTail = 1, origBlendHead = 1, origBlendLoopEnd = 1;

let headModLayer = []; // purple: loop-end audio -> pre-loop head
let loopEndLayer = []; // orange: modified head -> loop end
let tailLayer = [];    // cyan: tail audio -> loop start

export function isLoopCreatorOpen() {
    return isActive;
}

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

/** The three computed blend layers (spec 044's own draw kind plots each in its own color, matching loopCreator.js#drawLayer) - fresh copies, safe to hold onto across a computeLayers() call that would otherwise replace the module's own arrays. */
export function getLoopCreatorLayers() {
    return { headModLayer: headModLayer.slice(), loopEndLayer: loopEndLayer.slice(), tailLayer: tailLayer.slice() };
}

/** Ported from loopCreator.js#recomputeMaxes (276-283). */
function recomputeMaxes() {
    maxLoopEndSize = Math.max(0, Math.min(loopStart, loopLength));
    maxTailSize = Math.max(0, Math.min(loopLength, dataLen - loopEnd));
    maxHeadSize = Math.max(0, Math.min(loopLength, loopStart));
    tailSize = Math.min(tailSize, maxTailSize);
    headSize = Math.min(headSize, maxHeadSize);
    loopEndSize = Math.min(loopEndSize, maxLoopEndSize);
}

/**
 * Ported from loopCreator.js#nearestZeroCrossing (285-299). Exported (spec
 * 044): the interactive drag controller's own marker drag needs this to
 * honor snapToZero the same way v1's own onDrag does inline - only a mouse
 * drag snaps, never the absolute setLoopStart/setLoopLength above (see
 * requirements.md's own asymmetry note, spec 043).
 */
export function nearestZeroCrossing(pos) {
    if (!originalData || !dataLen) return pos & ~1;
    const maxSearch = Math.min(8000, Math.floor(dataLen / 4));
    for (let d = 0; d <= maxSearch; d++) {
        const r = pos + d;
        if (r > 0 && r < dataLen && originalData[r - 1] * originalData[r] <= 0) return r & ~1;
        if (d > 0) {
            const l = pos - d;
            if (l > 0 && l < dataLen && originalData[l - 1] * originalData[l] <= 0) return l & ~1;
        }
    }
    return pos & ~1;
}

function clamp(v) {
    return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Ported from loopCreator.js#computeLayers (303-341) - builds the three blended layers from the untouched originalData snapshot, then applies them (idempotent: applyPreview always rebuilds from that same snapshot, never compounding). */
function computeLayers() {
    if (!originalData || !dataLen) return;

    const effTail = Math.max(0, Math.min(tailSize, maxTailSize));
    const effHead = Math.max(0, Math.min(headSize, maxHeadSize));
    const effLoopEnd = Math.max(0, Math.min(loopEndSize, maxLoopEndSize));

    headModLayer = new Array(effLoopEnd);
    loopEndLayer = new Array(effHead);
    tailLayer = new Array(effTail);

    for (let i = 0; i < effLoopEnd; i++) {
        const fade = effLoopEnd > 1 ? i / (effLoopEnd - 1) : 1;
        headModLayer[i] = originalData[loopEnd - effLoopEnd + i] * fade * blendLoopEnd;
    }

    for (let i = 0; i < effHead; i++) {
        const fade = effHead > 1 ? i / (effHead - 1) : 1;
        const srcIdx = loopStart - effHead + i;
        let headSample = originalData[srcIdx];
        const purpleIdx = srcIdx - (loopStart - effLoopEnd);
        if (purpleIdx >= 0 && purpleIdx < effLoopEnd) headSample += headModLayer[purpleIdx];
        loopEndLayer[i] = headSample * fade * blendHead;
    }

    for (let i = 0; i < effTail; i++) {
        const fade = effTail > 1 ? 1 - i / (effTail - 1) : 1;
        tailLayer[i] = originalData[loopEnd + i] * fade * blendTail;
    }

    applyPreview();
}

/** Ported from loopCreator.js#applyPreview (345-375). Rewrites instrument.sample.data from the original snapshot every call - never compounds across repeated calls. */
function applyPreview() {
    if (!instrument) return;
    const sampleData = instrument.sample.data;

    for (let i = 0; i < dataLen; i++) sampleData[i] = originalData[i];

    for (let i = 0; i < headModLayer.length; i++) {
        const pos = loopStart - headModLayer.length + i;
        const t = headModLayer.length > 1 ? i / (headModLayer.length - 1) : 0;
        sampleData[pos] = clamp(originalData[pos] * (1 - (1 - origBlendLoopEnd) * t) + headModLayer[i]);
    }

    for (let i = 0; i < loopEndLayer.length; i++) {
        const pos = loopEnd - loopEndLayer.length + i;
        const t = loopEndLayer.length > 1 ? i / (loopEndLayer.length - 1) : 0;
        sampleData[pos] = clamp(originalData[pos] * (1 - (1 - origBlendHead) * t) + loopEndLayer[i]);
    }

    for (let i = 0; i < tailLayer.length; i++) {
        const t = tailLayer.length > 1 ? i / (tailLayer.length - 1) : 0;
        sampleData[loopStart + i] = clamp(originalData[loopStart + i] * (origBlendTail + (1 - origBlendTail) * t) + tailLayer[i]);
    }

    instrument.sample.loop.start = loopStart;
    instrument.sample.loop.length = loopLength;
}

/**
 * Ported from loopCreator.js#open (757-813). Seeds a default loop (~60%-85%
 * of the sample, snapped to the nearest zero crossing at each end, Cross
 * Fade applied automatically) when the instrument has no usable existing
 * loop - matching v1's own `needsDefaultLoop` branch - otherwise keeps the
 * existing loop and computes layers from whatever region sizes are already
 * in state (all reset to their spec-043 defaults below either way).
 * @returns {boolean} false when there is no usable sample to open for.
 */
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
    originalData = instr.sample.data.slice();

    if (needsDefaultLoop) {
        let defaultStart = nearestZeroCrossing(Math.floor(dataLen * 0.6));
        let defaultEnd = nearestZeroCrossing(Math.floor(dataLen * 0.85));
        if (defaultEnd <= defaultStart) defaultEnd = (defaultStart + 2) & ~1;
        loopStart = defaultStart;
        loopEnd = defaultEnd;
        loopLength = loopEnd - loopStart;
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

/** Ported from loopCreator.js#me.setLoopStart (714-720) - called by a host's own loop-start control while this session is open. Deliberately ignores snapToZero, matching v1's own asymmetry (see requirements.md). */
export function setLoopStart(value) {
    if (!dataLen) return;
    loopStart = Math.max(0, Math.min(value, loopEnd - 2)) & ~1;
    loopLength = loopEnd - loopStart;
    recomputeMaxes();
    computeLayers();
}

/** Ported from loopCreator.js#me.setLoopLength (722-728). */
export function setLoopLength(value) {
    if (!dataLen) return;
    loopLength = Math.max(2, Math.min(value, dataLen - loopStart)) & ~1;
    loopEnd = loopStart + loopLength;
    recomputeMaxes();
    computeLayers();
}

/** The domain-level equivalent of v1's own delta-driven drag handlers (onDrag's "tail"/"head"/"loopEnd" branches, 245-251) - a later drag controller supplies the delta and calls these with the resulting absolute value. */
export function setTailSize(value) {
    tailSize = Math.max(0, Math.min(maxTailSize, value));
    computeLayers();
}

export function setHeadSize(value) {
    headSize = Math.max(0, Math.min(maxHeadSize, value));
    computeLayers();
}

export function setLoopEndSize(value) {
    loopEndSize = Math.max(0, Math.min(maxLoopEndSize, value));
    computeLayers();
}

export function setBlendTail(value) {
    blendTail = Math.max(0, Math.min(1, value));
    computeLayers();
}

export function setBlendHead(value) {
    blendHead = Math.max(0, Math.min(1, value));
    computeLayers();
}

export function setBlendLoopEnd(value) {
    blendLoopEnd = Math.max(0, Math.min(1, value));
    computeLayers();
}

export function setOrigBlendTail(value) {
    origBlendTail = Math.max(0, Math.min(1, value));
    computeLayers();
}

export function setOrigBlendHead(value) {
    origBlendHead = Math.max(0, Math.min(1, value));
    computeLayers();
}

export function setOrigBlendLoopEnd(value) {
    origBlendLoopEnd = Math.max(0, Math.min(1, value));
    computeLayers();
}

/** Plain state for a later drag controller to read (onDrag's own markerStart/markerEnd branches) - neither setter above applies it; see requirements.md. */
export function setSnapToZero(value) {
    snapToZero = Boolean(value);
}

// Ported from loopCreator.js#applyPreset's own presetValues table (604-609).
// Index 0 ("Select") is a deliberate no-op, matching v1.
const PRESETS = [
    null,
    () => [maxHeadSize, 1, 0, 0, 0, 1, 0, 0, 1],
    () => [0, 0, 1, maxTailSize, 1, 0, 0, 0, 1],
    () => [maxHeadSize >> 1, 0.5, 0.5, maxTailSize >> 1, 0.5, 0.5, maxLoopEndSize >> 1, 0.5, 0.5]
];

/** Ported from loopCreator.js#applyPreset (603-624). @param {0|1|2|3} index 0=Select (no-op), 1=Fade in Head, 2=Fade out Tail, 3=Cross Fade. */
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

/**
 * Ported from loopCreator.js#saveLoop (652-672). The preview is already
 * live in instrument.sample.data - this only registers the undo entry,
 * carrying both the data and the loop bounds together (`loop:`) so undo/
 * redo restores both in sync - domain/song/index.js#applySampleDiff's own
 * fix for the dead loopStart/loopLength fields v1's own undo path never
 * actually read (see requirements.md).
 */
export function saveLoopCreator() {
    if (!isActive || !instrument || !originalData) return false;

    const undoFrom = Math.max(0, loopStart - Math.max(loopEndLayer.length, headModLayer.length));
    const undoTo = Math.max(loopEnd, Math.min(dataLen, loopStart + tailLayer.length));

    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: undoFrom,
        to: undoTo - undoFrom,
        data: originalData.slice(undoFrom, undoTo),
        dataTo: instrument.sample.data.slice(undoFrom, undoTo),
        loop: { from: { start: origLoopStart, length: origLoopLength }, to: { start: loopStart, length: loopLength } },
        name: "Create Loop"
    });

    isActive = false;
    return true;
}

/** Ported from loopCreator.js#cancelLoop/restoreInstrumentData (674-691) - restores immediately, registers nothing on the undo stack. */
export function cancelLoopCreator() {
    if (!isActive) return false;
    if (instrument && originalData) {
        instrument.sample.data = originalData.slice();
        instrument.sample.loop.start = origLoopStart;
        instrument.sample.loop.length = origLoopLength;
    }
    isActive = false;
    return true;
}
