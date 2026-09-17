import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameGovernor } from "../runtime/frameGovernor.js";

// Spec 032: the frame-rate cap and the frame-skip counter, ported from
// script/src/ui/ui.js's own render() loop, composed the way v1 composes
// them - the cap decides whether a tick is even eligible; only an eligible
// tick advances the skip counter.

test("with no skip count, every frame at least 1000/maxFps apart is drawn", () => {
    const governor = createFrameGovernor({ maxFps: 60 });
    assert.equal(governor.shouldDraw(0, 0), true, "the very first call always draws");
    assert.equal(governor.shouldDraw(5, 0), false, "too soon for a 60fps cap (~16.6ms)");
    assert.equal(governor.shouldDraw(17, 0), true);
    assert.equal(governor.shouldDraw(20, 0), false, "too soon again");
    assert.equal(governor.shouldDraw(34, 0), true);
});

test("the fps cap holds even at a 120Hz callback cadence", () => {
    const governor = createFrameGovernor({ maxFps: 60 });
    let draws = 0;
    for (let now = 0; now <= 1000; now += 1000 / 120) {
        if (governor.shouldDraw(now, 0)) draws++;
    }
    // Floating-point drift over ~120 accumulating steps can cost a handful
    // of otherwise-eligible frames right at the cap boundary - the property
    // this test actually cares about is the ceiling, not an exact count.
    assert.ok(draws <= 60, `expected at most 60 draws in one simulated second, got ${draws}`);
    assert.ok(draws >= 45, `expected roughly 60 draws (half the 120Hz cadence), got ${draws}`);
});

test("a skip count of N draws only every (N+1)th eligible frame", () => {
    const governor = createFrameGovernor({ maxFps: 1000 }); // effectively no fps cap for this test
    const results = [];
    for (let i = 0; i < 8; i++) results.push(governor.shouldDraw(i, 3));
    assert.deepEqual(results, [false, false, false, true, false, false, false, true], "\"Low CPU\": draws every 4th eligible frame");
});

test("a frame the fps cap rejects never consumes a skip slot", () => {
    const governor = createFrameGovernor({ maxFps: 60 });
    assert.equal(governor.shouldDraw(0, 0), true, "an initial draw with no skip count, to establish lastDrawTime");

    // Flood with same-instant calls the fps cap alone should reject (too
    // soon after the draw above); none of these should advance the skip
    // counter, regardless of the (large) skip count passed here.
    for (let i = 0; i < 10; i++) assert.equal(governor.shouldDraw(0.001 * i, 5), false, "rejected by the fps cap, not the skip counter");

    // The first *eligible* (cap-passed) frame is opportunity 1 of 6 needed
    // for skip=5 - if the flood above had incorrectly consumed slots, fewer
    // than 6 eligible calls would be needed here.
    let draws = 0;
    let now = 17;
    for (let i = 0; i < 6; i++) {
        if (governor.shouldDraw(now, 5)) draws++;
        now += 17;
    }
    assert.equal(draws, 1, "exactly the 6th eligible call draws, confirming none of the flooded ones counted");
});

test("skipCount of 0 never engages the counter at all", () => {
    const governor = createFrameGovernor({ maxFps: 1000 });
    for (let i = 0; i < 5; i++) assert.equal(governor.shouldDraw(i, 0), true);
});
