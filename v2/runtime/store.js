/**
 * A minimal explicit store: a flat map of field path -> value, with
 * subscriptions scoped to one field path. Setting a field only notifies
 * subscribers of that field (LWB-004); it never rebuilds the specification
 * tree.
 *
 * @param {Record<string, { initial: unknown }>} fields state.fields from a validated document
 */
export function createStore(fields) {
    const state = {};
    const subscribers = new Map();

    for (const [path, field] of Object.entries(fields)) {
        state[path] = field.initial;
    }

    function get(path) {
        return state[path];
    }

    function getState() {
        return { ...state };
    }

    function set(path, value) {
        if (!(path in state)) throw new Error(`store: unknown field "${path}"`);
        if (state[path] === value) return;
        state[path] = value;
        const subs = subscribers.get(path);
        if (subs) for (const fn of [...subs]) fn(value, path);
    }

    function subscribe(path, fn) {
        if (!(path in state)) throw new Error(`store: unknown field "${path}"`);
        if (!subscribers.has(path)) subscribers.set(path, new Set());
        subscribers.get(path).add(fn);
        return () => subscribers.get(path)?.delete(fn);
    }

    return { get, getState, set, subscribe };
}
