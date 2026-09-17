# 039 — Design

## Overview

```
domain/features/index.js   the registry: registerFeature, openFeature, closeFeature,
                            featureState, resetFeature/resetAllFeatures (test-only)
```

One new domain module, no other file touched - the smallest possible surface for a mechanism spec, matching spec 035's own shape (a controller/geometry pair with nothing else touched) before any screen or capability exists to call it.

## State machine

Per feature name, one record:

```
{ status: "idle" | "loading" | "ready" | "failed", open: boolean, instance: any, error: any, loading: Promise|null }
```

```
idle --openFeature()--> loading --resolves--> ready
                            |
                            +--rejects--> failed --openFeature()--> loading (retried)

ready/failed: open toggles independently via closeFeature()/a fresh openFeature()
```

- **idle → loading**: `openFeature` finds no record (or a `failed` one) and starts `manifest.load()`, storing the in-flight promise on the record so a concurrent caller can join it.
- **loading, already in flight**: a second `openFeature` call returns the *same* stored promise - `manifest.load()` is never called twice (FEATURE-002).
- **loading → ready**: on resolution, `status = "ready"`, `instance = module`, `open = true` - *unless* `closeFeature` ran while the promise was pending, in which case `open` stays `false` and the caller's own `onReady` is skipped (FEATURE-003).
- **loading → failed**: on rejection, `status = "failed"`, `instance = null`, `error` recorded. The record is *not* removed - the next `openFeature` call sees `status === "failed"`, not `"loading"` or `"ready"`, and starts a fresh load, exactly mirroring v1's own loader (which achieves the same thing by a different, accidental route - falling through both `if` checks because neither `loaded` nor `loading` is truthy).
- **ready ↔ closed**: `closeFeature` sets `open = false` without touching `status`/`instance` - the module stays cached. A later `openFeature` call on an already-`ready` feature resolves immediately (no new `load()` call), sets `open = true`, and calls `onReady` synchronously-via-microtask, the same shape a fresh load's own resolution has.

## `domain/features/index.js`

```js
// The lazy feature registry (spec 039), opening package P10. A metadata-only
// table (name -> { load: () => Promise<Module> }) plus a small per-feature
// state machine - idle/loading/ready/failed, and open/closed as a second,
// independent flag - so a feature's own module is imported at most once
// (deduplicated while in flight, cached forever once ready) and its own
// "shown" state can still be toggled after that, exactly the split spec 010's
// own design sketch asked for ("disposal separate from module caching").
//
// No sample editor, no Nibbles - see requirements.md. Verified against a
// hand-built mock feature only.

const registry = new Map(); // name -> { load }
const records = new Map();  // name -> { status, open, instance, error, loading }

export function registerFeature(name, manifest) {
    registry.set(name, manifest);
}

function recordFor(name) {
    if (!records.has(name)) records.set(name, { status: "idle", open: false, instance: null, error: null, loading: null });
    return records.get(name);
}

/**
 * @param {string} name a name passed to registerFeature
 * @param {(instance: any) => void} [onReady] called once the feature is open
 *   with its loaded instance - skipped if closeFeature() ran before the load
 *   (or the already-cached resolution) settled.
 * @returns {Promise<any|null>} the instance, or null if closed before ready
 */
export async function openFeature(name, onReady) {
    const manifest = registry.get(name);
    if (!manifest) return null;
    const record = recordFor(name);

    if (record.status === "ready") {
        record.open = true;
        if (onReady) onReady(record.instance);
        return record.instance;
    }

    if (record.status === "loading") {
        record.open = true; // a second opener while loading still counts as "wants it open"
        return record.loading.then(() => (record.open ? record.instance : null)).then(instance => {
            if (instance && onReady) onReady(instance);
            return instance;
        });
    }

    // idle or failed: start a fresh load
    record.status = "loading";
    record.open = true;
    record.error = null;
    record.loading = manifest.load().then(
        module => {
            record.status = "ready";
            record.instance = module.default || module;
            record.loading = null;
            return record.instance;
        },
        error => {
            record.status = "failed";
            record.instance = null;
            record.error = error;
            record.loading = null;
            throw error;
        }
    );

    try {
        const instance = await record.loading;
        if (record.open && onReady) onReady(instance);
        return record.open ? instance : null;
    } catch {
        return null; // FEATURE-004: status is "failed"; the next openFeature() retries
    }
}

export function closeFeature(name) {
    const record = records.get(name);
    if (record) record.open = false;
}

/** @returns {{status: string, open: boolean}} for inspection and tests. */
export function featureState(name) {
    const record = records.get(name);
    return record ? { status: record.status, open: record.open } : { status: "idle", open: false };
}

/** Test/harness entry point. */
export function resetFeature(name) {
    records.delete(name);
}
export function resetAllFeatures() {
    records.clear();
}
```

`registerFeature`/the module-level `registry` Map plays the same role v1's own static `registry.js` object does, without hardcoding any real plugin name yet - a later spec calls `registerFeature("SampleEditor", { load: () => import(...) })` from wherever it wires the command, not from this file.

## Data models

None new - a feature's own `instance` is whatever its `load()` promise resolves to (`module.default || module`, matching every other lazy-loaded module in this codebase, e.g. `runtime/overlaySynthesis.js`'s own convention and `capabilities.js`'s own capability modules).

## Error handling

- **An unregistered name**: `openFeature` resolves `null` immediately, matching v1's own `console.warn("Can't load plugin: unknown plugin")` path's effective behavior (nothing happens) without inventing a throw nothing calls for yet.
- **`load()` rejects**: caught, recorded, re-thrown internally but swallowed at the public `openFeature` boundary (returns `null`) - a caller that wants to react to a failure reads `featureState(name).status === "failed"`, matching how nothing in this spec's own scope needs to *display* an error (no screen exists yet).

## Testing strategy

`tests/features.test.js` (new): a hand-built mock manifest per test (`{ load: () => new Promise(...) }`, sometimes delayed with a manually-resolved promise to control ordering) - FEATURE-001 through FEATURE-004 from requirements.md, plus: `featureState` for an unregistered/never-opened name; `closeFeature` on an already-`ready` feature (open toggles, `status` untouched); opening an already-open, already-`ready` feature a second time (idempotent, no second `load()` call).

`node --test tests/*.test.js` passes; no `build.mjs`/`compiler` involvement at all (no YAML, no capability mapping - nothing calls `openFeature` from the generated application yet).

## What this deliberately does not do

See requirements.md's Scope boundaries: no sample editor, no Nibbles, no generator, no screen, no richer host interface than what this spec's own mock feature needs.
