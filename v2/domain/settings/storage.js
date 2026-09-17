// A tiny Web Storage abstraction (spec 033), so domain/settings/ runs headless
// in plain Node, where no `localStorage` global exists.
//
// A fresh in-memory store per call with no backend given is deliberate: it
// makes every function in this folder safe to import with zero setup, and
// nothing leaks between unrelated tests by accident. A real browser always
// resolves to the one real `localStorage` singleton; a test that wants to
// prove a round trip constructs one fake store and passes it explicitly to
// both sides.

/**
 * @param {{getItem(key: string): string|null, setItem(key: string, value: string): void}} [backend]
 * @returns {{getItem(key: string): string|null, setItem(key: string, value: string): void}}
 */
export function createStorage(backend) {
    if (backend) return backend;
    if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
    return createMemoryStorage();
}

function createMemoryStorage() {
    const map = new Map();
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); }
    };
}
