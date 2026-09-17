// The lookahead clock the sequencer runs on (spec 012).
//
// It replaces the browserified WAAClock bundle the original engine vendored,
// which referenced the window object at module import and was patched to emit
// on v1's event bus. This is a v2-native implementation of the four things
// engine/tracker.js actually uses:
//
//   new Scheduler(context)              a clock over an AudioContext
//   clock.start() / clock.stop()        run and cancel everything
//   clock.setTimeout(fn, delay)         one event, fn(event) gets event.deadline
//   event.repeat(interval)              fire again every interval from the deadline
//   clock.timeStretch(now, [e], ratio)  rescale a pending deadline on a tempo change
//
// Note timing does not depend on this timer's precision. Every note, ramp,
// envelope point and effect is scheduled inside the callback with absolute
// audio-clock times, so the timer only has to run before the lookahead window
// empties. That is why replacing the clock is safe and rewriting the
// sequencer would not be.

const DEFAULT_TICK_MS = 20;
const DEFAULT_EARLY = 0.005;   // fire this far before the deadline, in seconds
const DEFAULT_LATE = 0.05;     // later than this counts as a missed deadline

class ScheduledEvent {
    /**
     * @param {Scheduler} clock
     * @param {(event: ScheduledEvent) => void} callback
     * @param {number} deadline absolute audio-clock time, in seconds
     */
    constructor(clock, callback, deadline) {
        this.clock = clock;
        this.callback = callback;
        this.deadline = deadline;
        this.interval = null;
        this.early = DEFAULT_EARLY;
        this.cleared = false;
    }

    /** Fire again every `interval` seconds, measured from each deadline. */
    repeat(interval) {
        this.interval = interval > 0 ? interval : null;
        return this;
    }

    /** WAAClock's surface. Only `early` affects anything here. */
    tolerance(values = {}) {
        if (typeof values.early === "number") this.early = values.early;
        return this;
    }

    clear() {
        this.cleared = true;
        this.clock._remove(this);
        return this;
    }
}

// The frame loop's own hook (spec 032): `engine/tracker.js:278`'s
// `clock = clock || new WAAClock(Audio.context)` passes no options and is
// v1-ported code this package keeps byte-identical (domain/playback/
// README.md's "nothing else" divergence rule), so a per-call option cannot
// be threaded through that call site. A module-level default fills the same
// role: registered once (domain/playback/index.js's `ensureEngine`), read by
// every `Scheduler` built afterward that does not pass its own option.
let defaultOnMissedDeadline = null;

/** @param {((lateBy: number) => void)|null} fn */
export function setDefaultOnMissedDeadline(fn) {
    defaultOnMissedDeadline = fn;
}

export default class Scheduler {
    /**
     * @param {BaseAudioContext} context the clock everything is measured against
     * @param {{ tickMs?: number, onMissedDeadline?: (lateBy: number) => void }} [options]
     *   `onMissedDeadline` replaces v1's global `clockEventExpired` event, so the
     *   decision to throttle belongs to whoever owns the frame loop. Falls back
     *   to `setDefaultOnMissedDeadline`'s own registration when omitted.
     */
    constructor(context, options = {}) {
        this.context = context;
        this.tickMs = options.tickMs || DEFAULT_TICK_MS;
        this.onMissedDeadline = options.onMissedDeadline || defaultOnMissedDeadline;
        this.events = [];
        this.timer = null;
        this.running = false;
    }

    get currentTime() {
        return this.context ? this.context.currentTime : 0;
    }

    start() {
        if (this.running) return this;
        this.running = true;
        const tick = () => {
            if (!this.running) return;
            this.tick();
            if (this.running) this.timer = setTimeout(tick, this.tickMs);
        };
        this.timer = setTimeout(tick, this.tickMs);
        return this;
    }

    /** Stops the timer and drops every pending event, as WAAClock's stop does. */
    stop() {
        this.running = false;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.events = [];
        return this;
    }

    /**
     * @param {(event: ScheduledEvent) => void} callback
     * @param {number} delay seconds from now
     */
    setTimeout(callback, delay) {
        const event = new ScheduledEvent(this, callback, this.currentTime + (delay || 0));
        this.events.push(event);
        return event;
    }

    /**
     * Rescales pending deadlines around `now`, which is how a tempo change
     * takes effect without rescheduling: at ratio 0.5 the next event arrives
     * twice as soon, and a repeating event's interval halves with it.
     */
    timeStretch(now, events, ratio) {
        for (const event of events || []) {
            if (!event || event.cleared) continue;
            event.deadline = now + (event.deadline - now) * ratio;
            if (event.interval) event.interval *= ratio;
        }
        return events;
    }

    /** Fires every event whose deadline has arrived. Exposed for tests. */
    tick() {
        const now = this.currentTime;
        // Sorted so a repeating event cannot starve one scheduled earlier, and
        // copied so a callback may add or clear events while it runs.
        const due = this.events
            .filter(event => !event.cleared && now >= event.deadline - event.early)
            .sort((a, b) => a.deadline - b.deadline);

        for (const event of due) {
            if (event.cleared) continue;
            const deadline = event.deadline;
            const lateBy = now - deadline;
            if (lateBy > DEFAULT_LATE && this.onMissedDeadline) this.onMissedDeadline(lateBy);
            if (!event.interval) this._remove(event);
            try {
                // The callback reads `event.deadline`, so it must still be the
                // deadline that just fired; the next one is set afterwards.
                // The callback may also change the interval (the sequencer
                // grows its lookahead that way), so it is read after the call.
                event.callback(event);
                if (event.interval && !event.cleared) event.deadline = deadline + event.interval;
            } catch (error) {
                // One failing step must not kill the clock and leave the audio
                // graph half-scheduled with no way to stop it.
                console.error("[v2 playback] scheduled step failed", error);
                event.clear();
            }
        }
        return due.length;
    }

    _remove(event) {
        const index = this.events.indexOf(event);
        if (index >= 0) this.events.splice(index, 1);
    }
}
