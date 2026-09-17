// The lazy feature registry (spec 039), opening package P10. A metadata-only
// table (name -> { load: () => Promise<Module> }) plus a small per-feature
// state machine - idle/loading/ready/failed, and open/closed as a second,
// independent flag - so a feature's own module is imported at most once
// (deduplicated while in flight, cached forever once ready) and its own
// "shown" state can still be toggled after that, exactly the split spec 010's
// own design sketch asked for ("disposal separate from module caching").
//
// Ported in spirit, not in code, from script/plugins/{registry,loader}.js:
// v1's own loader already gives retry-after-failure and in-flight
// deduplication for free, just by falling through the same two `if` checks
// either way - this port makes both checks (and the "closed while loading"
// guard v1 never needed) explicit instead of accidental.
//
// No sample editor, no Nibbles - see requirements.md. Verified against a
// hand-built mock feature only; a real tenant is a later spec's own.

const registry = new Map(); // name -> manifest ({ load })
const records = new Map();  // name -> { status, open, instance, error, loading }

/** @param {{ load: () => Promise<any> }} manifest metadata only - `load` must not run until openFeature() calls it. */
export function registerFeature(name, manifest) {
    registry.set(name, manifest);
}

function recordFor(name) {
    if (!records.has(name)) records.set(name, { status: "idle", open: false, instance: null, error: null, loading: null });
    return records.get(name);
}

/**
 * @param {string} name a name passed to registerFeature
 * @param {(instance: any) => void} [onReady] called with the loaded instance
 *   once the feature is open - skipped if closeFeature() ran before the load
 *   (or an already-cached resolution) settled.
 * @returns {Promise<any|null>} the instance, or null if unregistered, failed,
 *   or closed before ready.
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
        try {
            const instance = await record.loading;
            if (record.open && onReady) onReady(instance);
            return record.open ? instance : null;
        } catch {
            return null; // the first opener's own catch already recorded "failed"
        }
    }

    // idle or failed: start a fresh load - this is the one place v1's own
    // loader retries by accident (falling through both `if`s); here it is
    // the explicit, only remaining branch.
    record.status = "loading";
    record.open = true;
    record.error = null;
    record.loading = manifest.load().then(
        module => {
            record.status = "ready";
            record.instance = module && module.default !== undefined ? module.default : module;
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
        return null;
    }
}

/** Marks a feature closed. The loaded module, if any, stays cached - only "open" changes. */
export function closeFeature(name) {
    const record = records.get(name);
    if (record) record.open = false;
}

/** @returns {{status: "idle"|"loading"|"ready"|"failed", open: boolean}} */
export function featureState(name) {
    const record = records.get(name);
    return record ? { status: record.status, open: record.open } : { status: "idle", open: false };
}

/** Test/harness entry points: not part of any real application path. */
export function resetFeature(name) {
    records.delete(name);
}
export function resetAllFeatures() {
    records.clear();
}
