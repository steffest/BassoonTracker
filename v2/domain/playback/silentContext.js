// A stub audio context (spec 012), so the engine can be loaded and inspected
// without a browser and without making a sound.
//
// It exists for two reasons. Node has no Web Audio, so module loading,
// pattern data and sequencing can only be unit-tested against something like
// this; and the parity harness needs to watch *what* the sequencer schedules
// without rendering it. Every node it hands out accepts the calls the engine
// makes and records nothing except, optionally, the parameter automation, so
// a test can assert on the schedule.
//
// This is v2 code, not an engine divergence: the engine still asks for a
// context and still does exactly what it always did with it.

class StubParam {
    constructor(name, value, log) {
        this.name = name;
        this.value = value;
        this.log = log;
    }
    _record(method, args) {
        if (this.log) this.log.push({ param: this.name, method, args });
        return this;
    }
    setValueAtTime(value, time) {
        this.value = value;
        return this._record("setValueAtTime", [value, time]);
    }
    linearRampToValueAtTime(value, time) {
        this.value = value;
        return this._record("linearRampToValueAtTime", [value, time]);
    }
    exponentialRampToValueAtTime(value, time) {
        this.value = value;
        return this._record("exponentialRampToValueAtTime", [value, time]);
    }
    setTargetAtTime(value, time, constant) {
        this.value = value;
        return this._record("setTargetAtTime", [value, time, constant]);
    }
    setValueCurveAtTime(values, time, duration) {
        return this._record("setValueCurveAtTime", [values, time, duration]);
    }
    cancelScheduledValues(time) {
        return this._record("cancelScheduledValues", [time]);
    }
    cancelAndHoldAtTime(time) {
        return this._record("cancelAndHoldAtTime", [time]);
    }
}

class StubNode {
    constructor(type, context, params = {}) {
        this.type = type;
        this.context = context;
        this.connections = [];
        for (const [name, value] of Object.entries(params)) {
            this[name] = new StubParam(`${type}.${name}`, value, context.automation);
        }
    }
    connect(target) {
        this.connections.push(target);
        return target;
    }
    disconnect() {
        this.connections = [];
    }
    start(when, offset, duration) {
        this.context.started.push({ node: this, when, offset, duration });
    }
    stop(when) {
        this.context.stopped.push({ node: this, when });
    }
    setPeriodicWave() {}
    addEventListener() {}
    removeEventListener() {}
    /** spec 052: enough of a real AnalyserNode for getTrackScopeData to be testable headlessly - silence, matching Web Audio's own time-domain convention (128 = zero signal). */
    getByteTimeDomainData(array) {
        if (array && typeof array.fill === "function") array.fill(128);
    }
}

class StubBuffer {
    constructor(channels, length, sampleRate) {
        this.numberOfChannels = channels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.duration = length / sampleRate;
        this._data = Array.from({ length: channels }, () => new Float32Array(length));
    }
    getChannelData(channel) {
        return this._data[channel];
    }
}

/**
 * @param {{ sampleRate?: number, recordAutomation?: boolean }} [options]
 * @returns {object} enough of a BaseAudioContext for the engine to run silently
 */
export function createSilentContext(options = {}) {
    const sampleRate = options.sampleRate || 44100;
    const context = {
        sampleRate,
        state: "running",
        currentTime: 0,
        /** Advances the clock, so a test can drive the scheduler deterministically. */
        advance(seconds) {
            context.currentTime += seconds;
            return context.currentTime;
        },
        /** Every `start()` and `stop()` the engine issued, in order. */
        started: [],
        stopped: [],
        /** Parameter automation, when asked for; otherwise null and unrecorded. */
        automation: options.recordAutomation ? [] : null,
        resume() {
            context.state = "running";
            return Promise.resolve();
        },
        suspend() {
            context.state = "suspended";
            return Promise.resolve();
        },
        close() {
            return Promise.resolve();
        },
        createGain: () => new StubNode("gain", context, { gain: 1 }),
        createStereoPanner: () => new StubNode("stereoPanner", context, { pan: 0 }),
        createPanner: () => new StubNode("panner", context),
        createBiquadFilter: () => new StubNode("biquadFilter", context, { frequency: 350, gain: 0, Q: 1, detune: 0 }),
        createBufferSource: () => new StubNode("bufferSource", context, { playbackRate: 1, detune: 0 }),
        createOscillator: () => new StubNode("oscillator", context, { frequency: 440, detune: 0 }),
        createDelay: () => new StubNode("delay", context, { delayTime: 0 }),
        createConvolver: () => new StubNode("convolver", context),
        createWaveShaper: () => new StubNode("waveShaper", context),
        createDynamicsCompressor: () => new StubNode("dynamicsCompressor", context, { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }),
        createAnalyser: () => new StubNode("analyser", context),
        createChannelMerger: () => new StubNode("channelMerger", context),
        createChannelSplitter: () => new StubNode("channelSplitter", context),
        createPeriodicWave: () => ({ real: null, imag: null }),
        createBuffer: (channels, length, rate) => new StubBuffer(channels, length, rate || sampleRate),
        decodeAudioData: () => Promise.reject(new Error("createSilentContext: decodeAudioData is not available headless"))
    };
    context.destination = new StubNode("destination", context);
    return context;
}
