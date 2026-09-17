// Pure sample-data DSP (spec 040), ported from
// script/plugins/sampleeditor/sampleProcessing.js. No Tracker, no
// domain/song import - every function here takes and mutates/returns a
// plain array of floats (-1..1), the same shape
// domain/playback/engine/models/sample.js's own `data` already is.
// domain/sampleEditor/index.js owns getting that array out of the current
// instrument's sample and back in; this file only owns the math.

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

/**
 * Scales up to unity peak - never down, matching v1's own guard.
 * @param {number[]} range mutated in place.
 * @returns {boolean} whether anything changed.
 */
export function normalize(range) {
    let min = 0;
    let max = 0;
    for (const value of range) {
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    const peak = Math.max(max, -min);
    // peak === 0 (a silent/empty range) would divide by zero in v1's own
    // code too (scale = Infinity, then every sample becomes NaN) - a real,
    // if obscure, data-corrupting bug there; guarded here instead of ported.
    if (peak === 0) return false;
    const scale = 1 / peak;
    if (scale <= 1) return false;
    for (let i = 0; i < range.length; i++) range[i] *= scale;
    return true;
}

export function fadeIn(range) {
    const last = range.length - 1;
    // last === 0 (a single-sample range) would divide by zero in v1's own
    // code too (i/len is 0/0 = NaN) - guarded here instead of ported, the
    // same call as normalize()'s own peak === 0 guard above.
    if (last <= 0) return;
    for (let i = 0; i <= last; i++) range[i] *= i / last;
}

export function fadeOut(range) {
    const last = range.length - 1;
    if (last <= 0) return;
    for (let i = 0; i <= last; i++) range[i] *= 1 - i / last;
}

/** amount > 0 boosts through the soft-knee compressor above; amount < 0 attenuates and clamps to [-1, 1]. */
export function adjustVolumePercent(range, amount) {
    const scale = 1 + 1 / amount;
    if (amount > 0) {
        boostVolumeSoftClip(range, scale);
    } else {
        for (let i = 0; i < range.length; i++) range[i] = Math.min(Math.max(range[i] * scale, -1), 1);
    }
}

export function reverseRange(range) {
    range.reverse();
}

export function invertRange(range) {
    for (let i = 0; i < range.length; i++) range[i] = -range[i];
}

/**
 * The new [start, end] (inclusive) bounds after stripping near-silent
 * head/tail, never cutting past a loop's own end point, and enforcing an
 * even final length (MOD/XM word alignment). Pure - reports bounds, does
 * not slice `range` itself.
 * @param {number[]} range
 * @param {{start: number, length: number}|null} [loop] already relative to
 *   `range`'s own start (the caller's job, matching v1's own
 *   `loop.start - absRangeStart` offset).
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
