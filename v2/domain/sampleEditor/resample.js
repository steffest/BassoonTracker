// The resample panel (spec 046), the second of P10's three separable
// sample-editor sub-features spec 040 recorded (the hiss-reduction panel is
// left for a later spec). Ported from script/plugins/sampleeditor/
// resamplePanel.js (the dialog) and waveform.js#resampleToRate (1344-1370,
// the DSP) - resample("up"/"down"), a different, separately-named v1 action
// (the Edit menu's own Upsample/DownSample quick items), is out of scope -
// see requirements.md.
//
// Unlike loopCreator.js, nothing is mutated until applyResample() runs (v1's
// own resamplePanel.js never touches the sample before its Apply callback
// fires either), so there is no live-preview snapshot to restore on cancel -
// only the small amount of state the open dialog itself needs to display.
//
// Like loopCreator.js, this module never imports domain/playback/engine/
// directly - it reaches the current instrument and registers undo entries
// only through domain/song/index.js's own public surface, and reaches
// engine audio math only through domain/playback/index.js's own public
// surface - two ordinary inter-module dependencies, neither a new
// documented exception (see requirements.md's Decisions and assumptions).

import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";
import { getSampleRateForPeriod } from "../playback/index.js";

let isOpen = false;
let sourceRate = 8363;
let sourceBytes = 0;
let targetIndex = 37; // v1's own default (resamplePanel.js:69)

export function isResampleOpen() {
    return isOpen;
}

/**
 * Ported from resamplePanel.js#open (86-114) - only the state this port
 * needs to open with, not the panel's own layout math.
 * @returns {boolean} false when there is no usable sample to open for.
 */
export function openResample(instrument) {
    if (!instrument || !instrument.sample || !instrument.sample.data || !instrument.sample.data.length) return false;
    const sample = instrument.sample;
    sourceRate = sample.originalSampleRate || sample.c2spd || 8363;
    sourceBytes = sample.data.length * (sample.bits === 16 ? 2 : 1);
    targetIndex = 37;
    isOpen = true;
    return true;
}

export function closeResample() {
    isOpen = false;
}

/** Ported from resamplePanel.js's own onKeyDown target (69-75) - clamped to the same [1, 96] FTNotes-index range, driven by an authored spinBox instead of a captured key press (see requirements.md). */
export function setTargetIndex(value) {
    targetIndex = Math.max(1, Math.min(96, Math.round(Number(value)) || 1));
}

export function getResampleState() {
    return { sourceRate, sourceBytes, targetIndex };
}

function targetPeriod() {
    return song.getNoteForResampleIndex(targetIndex).period;
}

export function getTargetNoteName() {
    return song.getNoteForResampleIndex(targetIndex).name;
}

export function getTargetRate() {
    return getSampleRateForPeriod(targetPeriod());
}

/**
 * Ported from waveform.js#resampleToRate (1344-1370). Rewrites the WHOLE
 * current instrument's sample, unconditionally - matches v1: the panel's
 * own apply callback never consults any range selection.
 */
export function applyResample(interpolate) {
    if (!isOpen) return false;
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample || !instrument.sample.data || !instrument.sample.data.length) return false;

    const targetRate = getTargetRate();
    const oldData = instrument.sample.data.slice();
    const newLength = Math.max(1, Math.round(oldData.length * targetRate / sourceRate));
    const newData = new Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const position = i * sourceRate / targetRate;
        const left = Math.floor(position);
        const right = Math.min(left + 1, oldData.length - 1);
        const fraction = position - left;
        newData[i] = interpolate
            ? oldData[left] + (oldData[right] - oldData[left]) * fraction
            : oldData[Math.min(Math.round(position), oldData.length - 1)];
    }

    const ratio = targetRate / sourceRate;
    const oldLoop = { start: instrument.sample.loop.start, length: instrument.sample.loop.length };
    const newLoop = { start: Math.round(oldLoop.start * ratio), length: Math.round(oldLoop.length * ratio) };

    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: 0,
        to: oldData.length,
        data: oldData,
        dataTo: newData.slice(),
        loop: { from: oldLoop, to: newLoop },
        name: "Resample Sample"
    });

    instrument.sample.data = newData;
    instrument.sample.length = newData.length;
    instrument.sample.loop.start = newLoop.start;
    instrument.sample.loop.length = newLoop.length;

    isOpen = false;
    return true;
}
