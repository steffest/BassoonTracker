import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../domain/settings/storage.js";

test("createStorage returns a caller-supplied backend unchanged", () => {
    const backend = { getItem: () => "x", setItem: () => {} };
    assert.equal(createStorage(backend), backend);
});

test("createStorage picks up a real-shaped globalThis.localStorage when present", () => {
    const fakeGlobal = { getItem: () => "seeded", setItem: () => {} };
    const original = globalThis.localStorage;
    globalThis.localStorage = fakeGlobal;
    try {
        assert.equal(createStorage(), fakeGlobal);
    } finally {
        if (original === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = original;
    }
});

test("createStorage falls back to a working in-memory store with no localStorage global", () => {
    const original = globalThis.localStorage;
    delete globalThis.localStorage;
    try {
        const storage = createStorage();
        assert.equal(storage.getItem("missing"), null);
        storage.setItem("k", JSON.stringify({ a: 1 }));
        assert.equal(storage.getItem("k"), JSON.stringify({ a: 1 }));
    } finally {
        if (original !== undefined) globalThis.localStorage = original;
    }
});

test("two separate no-backend createStorage() calls do not share state", () => {
    const original = globalThis.localStorage;
    delete globalThis.localStorage;
    try {
        const a = createStorage();
        const b = createStorage();
        a.setItem("k", "1");
        assert.equal(b.getItem("k"), null, "each no-backend call gets its own fresh in-memory store");
    } finally {
        if (original !== undefined) globalThis.localStorage = original;
    }
});
