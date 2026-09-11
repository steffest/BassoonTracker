import { test } from "node:test";
import assert from "node:assert/strict";
import Scheduler from "../domain/playback/scheduler.js";

// Spec 012: the lookahead clock that replaced the vendored WAAClock bundle.
// The sequencer uses exactly four things from it, so these tests pin those
// four and nothing else. Every case drives a fake audio clock by hand, so the
// timing is deterministic and no timer has to actually fire.

function fakeContext() {
    return { currentTime: 0, advance(seconds) { this.currentTime += seconds; return this.currentTime; } };
}

test("an event fires once its deadline arrives, and carries that deadline", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    clock.setTimeout(event => fired.push(event.deadline), 0.2);

    clock.tick();
    assert.deepEqual(fired, [], "nothing fires before the deadline");

    context.advance(0.1);
    clock.tick();
    assert.deepEqual(fired, [], "still early");

    context.advance(0.1);
    clock.tick();
    assert.deepEqual(fired, [0.2], "fires with the absolute audio-clock deadline it was given");

    context.advance(1);
    clock.tick();
    assert.equal(fired.length, 1, "a one-shot event does not repeat");
});

test("repeat reschedules from the deadline, not from when it actually fired", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    const event = clock.setTimeout(e => fired.push(e.deadline), 0.2).repeat(0.5);

    context.advance(0.2);
    clock.tick();
    // Deliberately late: the deadline series must not drift with the timer.
    context.advance(0.9);
    clock.tick();
    context.advance(0.5);
    clock.tick();
    assert.deepEqual(fired, [0.2, 0.7, 1.2], "deadlines advance by the interval, independent of jitter");
    assert.equal(event.interval, 0.5);
});

test("the engine's growing lookahead works: repeat can change between firings", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    // This is what tracker.js does: start at 0.2s, then stretch to 1s.
    const event = clock.setTimeout(e => {
        fired.push(e.deadline);
        if (fired.length >= 2) event.repeat(1);
    }, 0.2).repeat(0.2);

    for (let i = 0; i < 4; i++) {
        context.advance(0.2);
        clock.tick();
    }
    assert.deepEqual(fired, [0.2, 0.4], "after the second firing the interval grows past the steps taken");
    context.advance(1);
    clock.tick();
    assert.deepEqual(fired, [0.2, 0.4, 1.4]);
});

test("timeStretch rescales a pending deadline and its interval, which is how tempo changes land", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    const event = clock.setTimeout(e => fired.push(e.deadline), 1).repeat(1);

    context.advance(0.5);
    clock.timeStretch(context.currentTime, [event], 0.5);
    assert.equal(event.deadline, 0.75, "half the remaining wait");
    assert.equal(event.interval, 0.5, "and half the interval from then on");

    context.advance(0.25);
    clock.tick();
    assert.deepEqual(fired, [0.75]);
});

test("stop cancels everything and start runs again, which is what play/stop/play needs", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    let fired = 0;
    clock.setTimeout(() => { fired += 1; }, 0.1).repeat(0.1);

    clock.stop();
    context.advance(1);
    clock.tick();
    assert.equal(fired, 0, "a stopped clock has no events left");

    clock.setTimeout(() => { fired += 1; }, 0.1);
    context.advance(0.1);
    clock.tick();
    assert.equal(fired, 1, "and accepts new ones afterwards");
    clock.stop();
});

test("clear removes one event without touching the others", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    const first = clock.setTimeout(() => fired.push("first"), 0.1);
    clock.setTimeout(() => fired.push("second"), 0.1);
    first.clear();
    context.advance(0.1);
    clock.tick();
    assert.deepEqual(fired, ["second"]);
});

test("a late firing is reported, which is what v1 used to throttle its frame rate", () => {
    const context = fakeContext();
    const late = [];
    const clock = new Scheduler(context, { onMissedDeadline: by => late.push(by) });
    clock.setTimeout(() => {}, 0.1);
    context.advance(0.5);
    clock.tick();
    assert.equal(late.length, 1);
    assert.ok(late[0] > 0.3, `reported ${late[0]}s late`);
});

test("a failing step clears itself instead of killing the clock", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    clock.setTimeout(() => { throw new Error("boom"); }, 0.1).repeat(0.1);
    clock.setTimeout(() => fired.push("other"), 0.1);
    context.advance(0.1);
    clock.tick();
    assert.deepEqual(fired, ["other"], "the healthy event still ran");
    context.advance(1);
    assert.equal(clock.tick(), 0, "and the thrower is gone rather than throwing every tick");
});

test("due events fire in deadline order", () => {
    const context = fakeContext();
    const clock = new Scheduler(context);
    const fired = [];
    clock.setTimeout(() => fired.push("late"), 0.3);
    clock.setTimeout(() => fired.push("early"), 0.1);
    context.advance(0.5);
    clock.tick();
    assert.deepEqual(fired, ["early", "late"]);
});
