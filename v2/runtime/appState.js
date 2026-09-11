import { createStore } from "./store.js";

// Application state for generated apps (spec 007): the spec-003 store (flat
// field paths, per-field subscriptions) plus a whole-store change hook the
// renderer uses to redraw when *any* action or capability module changes a
// field, including asynchronously.
//
// @param {Record<string, unknown>} initial field path -> initial value
export function createAppState(initial) {
    const fields = Object.fromEntries(Object.entries(initial).map(([path, value]) => [path, { initial: value }]));
    const store = createStore(fields);
    const anyListeners = new Set();
    return {
        get: store.get,
        getState: store.getState,
        subscribe: store.subscribe,
        set(path, value) {
            const before = store.get(path);
            store.set(path, value);
            if (before !== value) anyListeners.forEach(fn => fn(path, value));
        },
        onAnyChange(fn) {
            anyListeners.add(fn);
            return () => anyListeners.delete(fn);
        }
    };
}
