import { test } from "node:test";
import assert from "node:assert/strict";
import { createTraceCollector } from "../runtime/traceCollector.js";

function clock(start = 1000) {
    let t = start;
    return { now: () => t, tick: ms => { t += ms; } };
}

test("records entries in order with emitter seq/time preserved and local fallbacks", () => {
    const c = clock();
    const trace = createTraceCollector({ now: c.now });
    c.tick(5);
    const a = trace.record({ kind: "input", instance: "x", seq: 7, t: 12.5 });
    assert.equal(a.seq, 7);
    assert.equal(a.t, 12.5);
    assert.equal(a.receivedAt, 5);
    const b = trace.record({ kind: "state", instance: "x" });
    assert.equal(b.seq, 1, "collector-assigned sequence when the emitter supplied none");
    assert.equal(b.t, 5);
    assert.deepEqual(trace.view().map(e => e.kind), ["input", "state"]);
});

test("ring buffer is bounded and counts drops explicitly", () => {
    const trace = createTraceCollector({ capacity: 3 });
    for (let i = 0; i < 5; i++) trace.record({ kind: "input", instance: "x", seq: i });
    assert.equal(trace.size, 3);
    assert.equal(trace.dropped, 2);
    assert.deepEqual(trace.view().map(e => e.seq), [2, 3, 4]);
});

test("pause stops capture and counts ignored events separately from drops", () => {
    const trace = createTraceCollector({ capacity: 10 });
    trace.record({ kind: "input", instance: "x" });
    trace.pause();
    assert.equal(trace.paused, true);
    assert.equal(trace.record({ kind: "command", instance: "x" }), null);
    assert.equal(trace.size, 1);
    assert.equal(trace.ignoredWhilePaused, 1);
    assert.equal(trace.dropped, 0);
    trace.resume();
    trace.record({ kind: "command", instance: "x" });
    assert.equal(trace.size, 2);
});

test("filters are views only; clear resets entries and counters", () => {
    const trace = createTraceCollector({ capacity: 2 });
    trace.record({ kind: "input", instance: "a", renderer: "canvas" });
    trace.record({ kind: "command", instance: "b", renderer: "canvas" });
    trace.record({ kind: "state", instance: "a", renderer: "gallery" });
    assert.equal(trace.dropped, 1);
    assert.deepEqual(trace.view({ instance: "a" }).map(e => e.kind), ["state"]);
    assert.deepEqual(trace.view({ kinds: ["command"] }).map(e => e.instance), ["b"]);
    assert.deepEqual(trace.view({ renderer: "gallery" }).map(e => e.kind), ["state"]);
    assert.equal(trace.size, 2, "filtering did not discard anything");
    assert.deepEqual(trace.instances(), ["a", "b"]);
    trace.clear();
    assert.equal(trace.size, 0);
    assert.equal(trace.dropped, 0);
    assert.equal(trace.ignoredWhilePaused, 0);
});

test("subscribers are notified on record, pause/resume and clear", () => {
    const trace = createTraceCollector();
    let calls = 0;
    const off = trace.subscribe(() => { calls += 1; });
    trace.record({ kind: "input" });
    trace.pause();
    trace.resume();
    trace.clear();
    assert.equal(calls, 4);
    off();
    trace.record({ kind: "input" });
    assert.equal(calls, 4);
});
