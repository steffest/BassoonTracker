import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, fadeIn, fadeOut, adjustVolumePercent, reverseRange, invertRange, trimBounds } from "../domain/sampleEditor/processing.js";

// Spec 040: pure sample-data DSP, ported from
// script/plugins/sampleeditor/sampleProcessing.js. Plain arrays in, no
// Tracker, no domain/song - the same portability the research pass found
// made this the single most directly portable file in the whole plugin.

test("normalize scales up to unity peak, and only when that increases volume", () => {
    const quiet = [0.1, -0.2, 0.15];
    assert.equal(normalize(quiet), true);
    assert.ok(Math.abs(Math.max(...quiet, -Math.min(...quiet)) - 1) < 1e-9);

    const alreadyLoud = [1, -0.5, 0.3];
    assert.equal(normalize(alreadyLoud), false, "already at unity peak - scale would be 1, never applied");
    assert.deepEqual(alreadyLoud, [1, -0.5, 0.3]);
});

test("normalize is a no-op on a silent range, rather than corrupting it to NaN (v1's own division-by-zero, fixed here)", () => {
    const silence = [0, 0, 0];
    assert.equal(normalize(silence), false);
    assert.deepEqual(silence, [0, 0, 0]);
});

test("fadeIn ramps linearly from 0 to the original value", () => {
    const range = [1, 1, 1, 1];
    fadeIn(range);
    assert.deepEqual(range, [0, 1 / 3, 2 / 3, 1]);
});

test("fadeOut ramps linearly from the original value to 0", () => {
    const range = [1, 1, 1, 1];
    fadeOut(range);
    assert.deepEqual(range, [1, 1 - 1 / 3, 1 - 2 / 3, 0]);
});

test("fadeIn/fadeOut are a no-op on a single-sample or empty range, rather than dividing by zero", () => {
    const one = [0.5];
    fadeIn(one);
    assert.deepEqual(one, [0.5]);
    fadeOut(one);
    assert.deepEqual(one, [0.5]);
    const empty = [];
    assert.doesNotThrow(() => { fadeIn(empty); fadeOut(empty); });
});

test("adjustVolumePercent attenuates and clamps for a negative amount", () => {
    const range = [0.9, -0.9, 0.1];
    adjustVolumePercent(range, -50); // scale = 1 + 1/-50 = 0.98
    assert.ok(Math.abs(range[0] - 0.9 * 0.98) < 1e-9);
    assert.ok(range.every(v => v >= -1 && v <= 1));
});

test("adjustVolumePercent clamps a large negative amount without overshooting -1/1", () => {
    const range = [0.99, -0.99];
    adjustVolumePercent(range, -1); // scale = 1 + 1/-1 = 0
    assert.deepEqual(range, [0, -0]);
});

test("adjustVolumePercent boosts under the soft-knee threshold with a plain linear scale", () => {
    const range = [0.1, -0.2];
    const scale = 1 + 1 / 100;
    adjustVolumePercent(range.slice(), 100);
    const expected = range.map(v => v * scale);
    const actual = [0.1, -0.2];
    adjustVolumePercent(actual, 100);
    for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-9);
});

test("adjustVolumePercent engages the soft-knee compressor once a boost would exceed 0.9 peak", () => {
    const range = [0.5, -0.95];
    adjustVolumePercent(range, 20); // scale = 1.05 -> peak would be 0.9975, over the 0.9 knee
    assert.ok(range.every(v => v >= -1 && v <= 1), "never exceeds full scale even when boosted");
    assert.ok(Math.abs(range[1]) > 0.9, "still clearly louder than before, not clamped flat");
});

test("reverseRange reverses in place", () => {
    const range = [1, 2, 3];
    reverseRange(range);
    assert.deepEqual(range, [3, 2, 1]);
});

test("invertRange negates every sample in place", () => {
    const range = [0.5, -0.25, 0];
    invertRange(range);
    assert.deepEqual(range, [-0.5, 0.25, -0]);
});

test("trimBounds strips near-silent head and tail", () => {
    const range = [0, 0.001, 0.5, 0.6, 0.001, 0];
    const bounds = trimBounds(range, null);
    assert.ok(bounds);
    assert.ok(range[bounds.start] === 0.5 || Math.abs(range[bounds.start]) >= 1 / 128);
});

test("trimBounds returns null when there is nothing to trim", () => {
    const range = [0.5, 0.6, 0.7, 0.8]; // even length, no silence at either end
    assert.equal(trimBounds(range, null), null);
});

test("trimBounds returns null for an entirely silent range", () => {
    const range = [0, 0, 0];
    assert.equal(trimBounds(range, null), null);
});

test("trimBounds truncates past a loop's own end point, since nothing after it ever plays (v1's own comment: 'everything after the loop end point is never played')", () => {
    const allLoud = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]; // no trailing silence at all
    assert.equal(trimBounds(allLoud.slice(), null), null, "nothing to trim without a loop");

    const withLoop = trimBounds(allLoud.slice(), { start: 0, length: 4 }); // loop ends at index 3
    assert.ok(withLoop);
    assert.equal(withLoop.start, 0);
    assert.equal(withLoop.end, 3);
});

test("trimBounds enforces an even final length", () => {
    // silence only at the very end, one sample wide, forcing an odd trimmed length unless corrected
    const range = [0.5, 0.5, 0.5, 0];
    const bounds = trimBounds(range, null);
    assert.equal((bounds.end - bounds.start + 1) % 2, 0);
});
