import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../runtime/store.js";

function fields() {
    return {
        "playback.status": { initial: "stopped" },
        "instruments.selectedId": { initial: null }
    };
}

test("get/getState reflect initial values", () => {
    const store = createStore(fields());
    assert.equal(store.get("playback.status"), "stopped");
    assert.deepEqual(store.getState(), { "playback.status": "stopped", "instruments.selectedId": null });
});

test("set updates the field and notifies its subscribers", () => {
    const store = createStore(fields());
    const seen = [];
    store.subscribe("playback.status", (value) => seen.push(value));
    store.set("playback.status", "playing");
    assert.equal(store.get("playback.status"), "playing");
    assert.deepEqual(seen, ["playing"]);
});

test("a subscriber of one field is not notified when a different field changes", () => {
    const store = createStore(fields());
    let calls = 0;
    store.subscribe("playback.status", () => { calls++; });
    store.set("instruments.selectedId", "inst-1");
    assert.equal(calls, 0);
});

test("setting the same value again does not notify", () => {
    const store = createStore(fields());
    let calls = 0;
    store.subscribe("playback.status", () => { calls++; });
    store.set("playback.status", "stopped");
    assert.equal(calls, 0);
});

test("unsubscribe stops further notifications", () => {
    const store = createStore(fields());
    let calls = 0;
    const unsubscribe = store.subscribe("playback.status", () => { calls++; });
    unsubscribe();
    store.set("playback.status", "playing");
    assert.equal(calls, 0);
});

test("set/subscribe on an unknown field throws", () => {
    const store = createStore(fields());
    assert.throws(() => store.set("nope", 1));
    assert.throws(() => store.subscribe("nope", () => {}));
});
