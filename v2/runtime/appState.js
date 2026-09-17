import { createStore } from "./store.js";
import { applyPersistedSettings } from "../domain/settings/index.js";

// Application state for generated apps (spec 007): the spec-003 store (flat
// field paths, per-field subscriptions) plus a whole-store change hook the
// renderer uses to redraw when *any* action or capability module changes a
// field, including asynchronously.
//
// Spec 033's one documented exception: this is otherwise generic
// infrastructure with no knowledge of any specific domain, but seeding a
// settings-backed field before the very first render (with no setTimeout)
// needs the seed to happen exactly where the store is constructed - see
// domain/settings/README.md. `options.settingsStorage` is never supplied by
// the generated `app/state.js` (its own call stays `createStore(INITIAL_STATE)`,
// unchanged); it exists only so a test can inject a fake backend.
//
// @param {Record<string, unknown>} initial field path -> initial value
// @param {{settingsStorage?: object}} [options]
export function createAppState(initial, options = {}) {
    const seeded = applyPersistedSettings(initial, options.settingsStorage);
    const fields = Object.fromEntries(Object.entries(seeded).map(([path, value]) => [path, { initial: value }]));
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
