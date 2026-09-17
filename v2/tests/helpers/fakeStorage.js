// A shared fake Web Storage backend for domain/settings/ tests (spec 033):
// same {getItem, setItem} shape createStorage() falls back to, but a test
// constructs and holds one explicitly so two calls into the module under
// test can share it and prove a round trip actually persisted.

export function createFakeStorage(seed = {}) {
    const map = new Map(Object.entries(seed));
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); }
    };
}
