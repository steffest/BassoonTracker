// Bounded interaction trace collector (spec 005 IWB-008 / spec 002
// COMP-002 "Interaction log"). Workbench-only: the standalone preview never
// imports this module; renderers only *emit* trace events (over the iframe
// bridge) and this collector stores them.
//
// - Ring buffer of `capacity` entries with an explicit dropped-entry count,
//   so inspection cannot grow memory indefinitely and truncation is visible.
// - pause()/resume() stop and restart *capture*; entries arriving while
//   paused are counted separately from ring-buffer drops so "paused" is
//   never mistaken for "nothing happened".
// - Filtering is a view over the stored entries (entries(filter)); it never
//   discards anything. clear() resets entries and both counters.
// - Entries keep the emitter's sequence number and time when supplied (the
//   renderer stamps them at the input/transition/command boundaries, sharing
//   one monotonic origin, so ordering across boundaries is preserved even if
//   messages arrive batched); otherwise the collector assigns its own.

/**
 * @param {{ capacity?: number, now?: () => number }} [options]
 */
export function createTraceCollector(options = {}) {
    const capacity = Math.max(1, options.capacity ?? 500);
    const now = options.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const origin = now();
    let entries = [];
    let paused = false;
    let dropped = 0;
    let ignoredWhilePaused = 0;
    let localSeq = 0;
    const listeners = new Set();

    function notify() {
        listeners.forEach(fn => fn());
    }

    /**
     * @param {{ kind: string, instance?: string, renderer?: string, seq?: number, t?: number, [key: string]: any }} event
     * @returns {object|null} the stored entry, or null when capture is paused
     */
    function record(event) {
        if (paused) {
            ignoredWhilePaused += 1;
            notify();
            return null;
        }
        const entry = {
            ...event,
            seq: Number.isFinite(event.seq) ? event.seq : ++localSeq,
            t: Number.isFinite(event.t) ? event.t : now() - origin,
            receivedAt: now() - origin
        };
        entries.push(entry);
        if (entries.length > capacity) {
            entries.splice(0, entries.length - capacity);
            dropped += 1;
        }
        notify();
        return entry;
    }

    /**
     * @param {{ instance?: string|null, kinds?: string[]|null, renderer?: string|null }} [filter]
     */
    function view(filter = {}) {
        return entries.filter(e =>
            (!filter.instance || e.instance === filter.instance) &&
            (!filter.renderer || e.renderer === filter.renderer) &&
            (!filter.kinds || filter.kinds.length === 0 || filter.kinds.includes(e.kind)));
    }

    return {
        record,
        view,
        pause() { paused = true; notify(); },
        resume() { paused = false; notify(); },
        clear() { entries = []; dropped = 0; ignoredWhilePaused = 0; notify(); },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        get paused() { return paused; },
        get size() { return entries.length; },
        get capacity() { return capacity; },
        get dropped() { return dropped; },
        get ignoredWhilePaused() { return ignoredWhilePaused; },
        instances() { return [...new Set(entries.map(e => e.instance).filter(Boolean))].sort(); }
    };
}
