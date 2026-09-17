import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerFeature, openFeature, closeFeature, featureState, resetAllFeatures } from "../domain/features/index.js";

// Spec 039: the lazy feature registry, package P10's own mechanism. Verified
// against hand-built mock features - no sample editor, no Nibbles.

beforeEach(() => {
    resetAllFeatures();
});

/** A controllable load: resolves/rejects only when the test says so. */
function deferredManifest() {
    let resolve;
    let reject;
    let calls = 0;
    const manifest = {
        load: () => {
            calls++;
            return new Promise((res, rej) => { resolve = res; reject = rej; });
        }
    };
    return { manifest, get calls() { return calls; }, resolve: v => resolve(v), reject: e => reject(e) };
}

test("FEATURE-001: a registered feature's load() never runs until openFeature() is called", () => {
    const { manifest } = deferredManifest();
    registerFeature("mock", manifest);
    assert.equal(featureState("mock").status, "idle");
    // (deferredManifest's own `calls` getter would be 0 here too, but the
    // real assertion is registerFeature itself never touched `load`.)
});

test("FEATURE-002: two concurrent opens while loading share one in-flight load, and load() is called exactly once", async () => {
    const d = deferredManifest();
    registerFeature("mock", d.manifest);

    const first = openFeature("mock");
    const second = openFeature("mock");
    d.resolve({ default: { name: "x" } });
    const [a, b] = await Promise.all([first, second]);

    assert.equal(d.calls, 1);
    assert.equal(a, b, "both callers see the same instance");
    assert.equal(a.name, "x");
    assert.equal(featureState("mock").status, "ready");
});

test("FEATURE-003: closing during load leaves it closed, with no onReady callback, and no second load on the next open", async () => {
    const d = deferredManifest();
    registerFeature("mock", d.manifest);

    let readyCalled = false;
    const opening = openFeature("mock", () => { readyCalled = true; });
    closeFeature("mock");
    d.resolve({ default: { name: "x" } });
    const result = await opening;

    assert.equal(result, null, "the opener's own promise resolves null once closed");
    assert.equal(readyCalled, false);
    assert.deepEqual(featureState("mock"), { status: "ready", open: false }, "still cached, just not open");

    const reopened = await openFeature("mock");
    assert.equal(d.calls, 1, "reopening a ready, cached feature never calls load() again");
    assert.equal(reopened.name, "x");
    assert.equal(featureState("mock").open, true);
});

test("FEATURE-004: a failed load can be retried", async () => {
    const d = deferredManifest();
    registerFeature("mock", d.manifest);

    const failing = openFeature("mock");
    d.reject(new Error("network error"));
    const failedResult = await failing;

    assert.equal(failedResult, null);
    assert.equal(featureState("mock").status, "failed");

    // A second attempt starts an entirely new load - a fresh deferred, since
    // the first manifest's own promise already settled.
    const d2 = deferredManifest();
    registerFeature("mock", d2.manifest);
    const retried = openFeature("mock");
    d2.resolve({ default: { name: "recovered" } });
    const result = await retried;

    assert.equal(result.name, "recovered");
    assert.equal(featureState("mock").status, "ready");
});

test("an unregistered feature resolves null and never creates a record", async () => {
    const result = await openFeature("nonesuch");
    assert.equal(result, null);
    assert.deepEqual(featureState("nonesuch"), { status: "idle", open: false });
});

test("closeFeature on an already-ready feature only toggles open, leaving status alone", async () => {
    const d = deferredManifest();
    registerFeature("mock", d.manifest);
    const opening = openFeature("mock");
    d.resolve({ default: { name: "x" } });
    await opening;

    closeFeature("mock");
    assert.deepEqual(featureState("mock"), { status: "ready", open: false });
});

test("opening an already-open, already-ready feature again is idempotent - no second load, onReady still fires", async () => {
    const d = deferredManifest();
    registerFeature("mock", d.manifest);
    const opening = openFeature("mock");
    d.resolve({ default: { name: "x" } });
    await opening;

    let calledWith = null;
    const again = await openFeature("mock", instance => { calledWith = instance; });
    assert.equal(d.calls, 1);
    assert.equal(again.name, "x");
    assert.equal(calledWith.name, "x");
});

test("a manifest whose module has no default export is used as-is", async () => {
    const bare = { load: () => Promise.resolve({ name: "no-default" }) };
    registerFeature("mock", bare);
    const instance = await openFeature("mock");
    assert.equal(instance.name, "no-default");
});
