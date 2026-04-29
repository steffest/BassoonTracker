//https://github.com/sebpiq/WAAClock/

import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";

;(function(e, t, n){function i(n, s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("'"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0; s<n.length; s++)i(n[s]);return i})({1:[function(require, module, exports){
    var WAAClock = require('./lib/WAAClock')

    module.exports = WAAClock
    if (typeof window !== 'undefined') window.WAAClock = WAAClock

},{"./lib/WAAClock":2}],3:[function(require,module,exports){
// shim for using process in browser

    var process = module.exports = {};

    process.nextTick = (function () {
        var canSetImmediate = typeof window !== 'undefined'
            && window.setImmediate;
        var canPost = typeof window !== 'undefined'
                && window.postMessage && window.addEventListener
            ;

        if (canSetImmediate) {
            return function (f) { return window.setImmediate(f) };
        }

        if (canPost) {
            var queue = [];
            window.addEventListener('message', function (ev) {
                var source = ev.source;
                if ((source === window || source === null) && ev.data === 'process-tick') {
                    ev.stopPropagation();
                    if (queue.length > 0) {
                        var fn = queue.shift();
                        fn();
                    }
                }
            }, true);

            return function nextTick(fn) {
                queue.push(fn);
                window.postMessage('process-tick', '*');
            };
        }

        return function nextTick(fn) {
            setTimeout(fn, 0);
        };
    })();

    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];

    process.binding = function (name) {
        throw new Error('');
    }

// TODO(shtylman)
    process.cwd = function () { return '/' };
    process.chdir = function (dir) {
        throw new Error('');
    };

},{}],2:[function(require,module,exports){
    var process=require("__browserify_process");var isBrowser = (typeof window !== 'undefined')

    if (isBrowser && !AudioContext)
        throw new Error('')

    var CLOCK_DEFAULTS = {
        toleranceLate: 0.10,
        toleranceEarly: 0.001
    }

    var clockWorkletName = 'waaclock-processor-' + Math.random().toString(36).slice(2)
    var CLOCK_WORKLET_PROCESSOR = [
        'class WAAClockProcessor extends AudioWorkletProcessor {',
        '    constructor() {',
        '        super();',
        '        this.frameCount = 0;',
        '        this.tickFrames = 256;',
        '    }',
        '    process(inputs, outputs) {',
        '        var output = outputs[0];',
        '        var frameLength = output && output[0] ? output[0].length : 128;',
        '        this.frameCount += frameLength;',
        '        if (this.frameCount >= this.tickFrames) {',
        '            this.frameCount %= this.tickFrames;',
        '            this.port.postMessage(0);',
        '        }',
        '        return true;',
        '    }',
        '}',
        'registerProcessor("' + clockWorkletName + '", WAAClockProcessor);'
    ].join('\n')

    var clockWorkletUrl = null

    function getClockWorkletUrl() {
        if (!clockWorkletUrl) {
            var blob = new Blob([CLOCK_WORKLET_PROCESSOR], {type: 'application/javascript'})
            clockWorkletUrl = URL.createObjectURL(blob)
        }
        return clockWorkletUrl
    }

    function canUseAudioWorklet(context) {
        return isBrowser
            && context
            && context.audioWorklet
            && typeof context.audioWorklet.addModule === 'function'
            && typeof AudioWorkletNode !== 'undefined'
            && typeof Blob !== 'undefined'
            && typeof URL !== 'undefined'
            && typeof URL.createObjectURL === 'function'
    }

// ==================== Event ==================== //
    var Event = function(clock, deadline, func) {
        this.clock = clock
        this.func = func
        this.repeatTime = null
        this.toleranceLate = CLOCK_DEFAULTS.toleranceLate
        this.toleranceEarly = CLOCK_DEFAULTS.toleranceEarly
        this._armed = false
        this._latestTime = null
        this._earliestTime = null
        this.schedule(deadline)
    }

// Unschedules the event
    Event.prototype.clear = function() {
        this.clock._removeEvent(this)
        return this
    }

// Sets the event to repeat every `time` seconds.
    Event.prototype.repeat = function(time) {
        if (time === 0)
            throw new Error('')
        this.repeatTime = time
        return this
    }

// Sets the time tolerance of the event.
// The event will be executed in the interval `[deadline - early, deadline + late]`
// If the clock fails to execute the event in time, the event will be dropped.
    Event.prototype.tolerance = function(values) {
        if (typeof values.late === 'number')
            this.toleranceLate = values.late
        if (typeof values.early === 'number')
            this.toleranceEarly = values.early
        this._update()
        return this
    }

// Returns true if the event is repeated, false otherwise
    Event.prototype.isRepeated = function() { return this.repeatTime !== null }

// Schedules the event to be ran before `deadline`.
// If the time is within the event tolerance, we handle the event immediately
    Event.prototype.schedule = function(deadline) {
        this._armed = true
        this.deadline = deadline
        this._update()
        if (this.clock.context.currentTime >= this._earliestTime) {
            this.clock._removeEvent(this)
            this._execute()
        }
    }

// Executes the event
    Event.prototype._execute = function() {
        this._armed = false
        if (this.clock.context.currentTime < this._latestTime)
            this.func(this);
        else {
            //if (this.onexpired) this.onexpired(this)
			console.warn('event expired');
            if (EventBus) EventBus.trigger(EVENT.clockEventExpired);
        }
        // In the case `schedule` is called inside `func`, we need to avoid
        // overrwriting with yet another `schedule`
        if (this._armed === false && this.isRepeated())
            this.schedule(this.deadline + this.repeatTime)
    };

// This recalculates some cached values and re-insert the event in the clock's list
// to maintain order.
    Event.prototype._update = function() {
        this._latestTime = this.deadline + this.toleranceLate
        this._earliestTime = this.deadline - this.toleranceEarly
        this.clock._removeEvent(this)
        this.clock._insertEvent(this)
    }

// ==================== WAAClock ==================== //
    var WAAClock = module.exports = function(context, opts) {
        var self = this
        opts = opts || {}
        this.toleranceEarly = opts.toleranceEarly || CLOCK_DEFAULTS.toleranceEarly
        this.toleranceLate = opts.toleranceLate || CLOCK_DEFAULTS.toleranceLate
        this.context = context
        this._events = []
        this._started = false
    }

// ---------- Public API ---------- //
// Schedules `func` to run after `delay` seconds.
    WAAClock.prototype.setTimeout = function(func, delay) {
        return this._createEvent(func, this._absTime(delay))
    }

// Schedules `func` to run before `deadline`.
    WAAClock.prototype.callbackAtTime = function(func, deadline) {
        return this._createEvent(func, deadline)
    }

// Stretches `deadline` and `repeat` of all scheduled `events` by `ratio`, keeping
// their relative distance to `tRef`. In fact this is equivalent to changing the tempo.
    WAAClock.prototype.timeStretch = function(tRef, events, ratio) {
        var self = this
            , currentTime = self.context.currentTime

        events.forEach(function(event) {
            if (event.isRepeated()) event.repeat(event.repeatTime * ratio)

            var deadline = tRef + ratio * (event.deadline - tRef)
            // If the deadline is too close or past, and the event has a repeat,
            // we calculate the next repeat possible in the stretched space.
            if (event.isRepeated()) {
                while (currentTime >= deadline - event.toleranceEarly)
                    deadline += event.repeatTime
            }
            event.schedule(deadline)


        })
        return events
    }

// ---------- Private ---------- //

// Removes all scheduled events and starts the clock
    WAAClock.prototype.start = function() {
        if (this._started === false) {
            this._started = true
            this._events = []
            this._startId = (this._startId || 0) + 1

            if (canUseAudioWorklet(this.context)) {
                this._startAudioWorklet(this._startId)
            } else {
                this._startScriptProcessor()
            }
        }
    }

    WAAClock.prototype._startAudioWorklet = function(startId) {
        var self = this
        this._workletPending = true

        this._workletBootstrapTimer = setInterval(function() {
            if (self._started && self._workletPending)
                process.nextTick(function() { self._tick() })
        }, 25)

        if (!this._workletModulePromise)
            this._workletModulePromise = this.context.audioWorklet.addModule(getClockWorkletUrl())

        this._workletModulePromise.then(function() {
            if (!self._started || self._startId !== startId) return

            self._clearWorkletBootstrapTimer()
            self._workletPending = false
            self._clockNode = new AudioWorkletNode(self.context, clockWorkletName, {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [1]
            })
            self._clockNode.port.onmessage = function () {
                process.nextTick(function() { self._tick() })
            }
            self._clockNode.connect(self.context.destination)
            process.nextTick(function() { self._tick() })
        }).catch(function(error) {
            if (!self._started || self._startId !== startId) return

            self._clearWorkletBootstrapTimer()
            self._workletPending = false
            if (typeof console !== 'undefined' && console.warn)
                console.warn('WAAClock AudioWorklet unavailable, falling back to ScriptProcessorNode', error)
            self._startScriptProcessor()
        })
    }

    WAAClock.prototype._startScriptProcessor = function() {
        var self = this
        var bufferSize = 256
        // We have to keep a reference to the node to avoid garbage collection
        this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1)
        this._clockNode.connect(this.context.destination)
        this._clockNode.onaudioprocess = function () {
            process.nextTick(function() { self._tick() })
        }
    }

    WAAClock.prototype._clearWorkletBootstrapTimer = function() {
        if (this._workletBootstrapTimer) {
            clearInterval(this._workletBootstrapTimer)
            this._workletBootstrapTimer = null
        }
    }

// Stops the clock
    WAAClock.prototype.stop = function() {
        if (this._started === true) {
            this._started = false
            this._startId = (this._startId || 0) + 1
            this._workletPending = false
            this._clearWorkletBootstrapTimer()
            if (this._clockNode) {
                if (this._clockNode.port) this._clockNode.port.onmessage = null
                this._clockNode.disconnect()
                this._clockNode = null
            }
        }
    }

// This function is ran periodically, and at each tick it executes
// events for which `currentTime` is included in their tolerance interval.
    WAAClock.prototype._tick = function() {
        var event = this._events.shift()

        while(event && event._earliestTime <= this.context.currentTime) {
            event._execute()
            event = this._events.shift()
        }

        // Put back the last event
        if(event) this._events.unshift(event)
    }

// Creates an event and insert it to the list
    WAAClock.prototype._createEvent = function(func, deadline) {
        var event = new Event(this, deadline, func)
        event.tolerance({late: this.toleranceLate, early: this.toleranceEarly})
        return event
    }

// Inserts an event to the list
    WAAClock.prototype._insertEvent = function(event) {
        this._events.splice(this._indexByTime(event._earliestTime), 0, event)
    }

// Removes an event from the list
    WAAClock.prototype._removeEvent = function(event) {
        var ind = this._events.indexOf(event)
        if (ind !== -1) this._events.splice(ind, 1)
    }

// Returns the index of the first event whose deadline is >= to `deadline`
    WAAClock.prototype._indexByTime = function(deadline) {
        // performs a binary search
        var low = 0
            , high = this._events.length
            , mid
        while (low < high) {
            mid = Math.floor((low + high) / 2)
            if (this._events[mid]._earliestTime < deadline)
                low = mid + 1
            else high = mid
        }
        return low
    }

// Converts from relative time to absolute time
    WAAClock.prototype._absTime = function(relTime) {
        return relTime + this.context.currentTime
    }

// Converts from absolute time to relative time
    WAAClock.prototype._relTime = function(absTime) {
        return absTime - this.context.currentTime
    }
},{"__browserify_process":3}]},{},[1])
;

export default WAAClock;
