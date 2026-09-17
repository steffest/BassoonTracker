import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import {
    createEngine, handleMissedDeadline, setScreenRefresh, loadModule, STATE_FIELDS, reset,
    getFineTuneForNote, getFineTuneForPeriod, getFtNotePeriod, usesLinearFrequency,
    getTickTiming, emulatesProtracker1OffsetBug, setTrackVolumes, getTrackScopeData, getMasterScopeData,
    setBPM, setSongTitle
} from "../domain/playback/index.js";
import { applyPersistedSettings } from "../domain/settings/index.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";
import { proxyUrl } from "../domain/providers/index.js";

// Spec 012: the adapted v1 sequencer, exercised in plain Node.
//
// This is only possible because of the two divergences the adaptation made:
// the engine no longer creates an audio context at import, and its clock is
// v2's rather than a browserified bundle that touches the window object. It
// is also the first automated test of this engine's behaviour that has ever
// existed on either side of the project, so it deliberately asserts the
// musical facts of each fixture rather than just "it did not throw".

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

let Tracker;
let Audio;
let context;

before(() => {
    context = createSilentContext({ recordAutomation: true });
    ({ Tracker, Audio } = createEngine(context));
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

test("loads a ProTracker module and reports its structure", async () => {
    const song = await load("wizballalt.mod");
    assert.equal(song.title.trim(), "wizball");
    assert.equal(song.channels, 4);
    assert.equal(Tracker.getTrackCount(), 4);
    assert.equal(Tracker.inFTMode(), false, "a .mod plays in ProTracker mode");

    assert.ok(song.patterns.length >= 1, "at least one pattern");
    assert.equal(song.length, 1, "one position in the song order");
    assert.ok(Array.isArray(song.patternTable) && song.patternTable.length >= song.length, "with a pattern order table");
    assert.equal(Tracker.getPatternLength(), 64, "64 rows, as ProTracker always has");

    const pattern = song.patterns[0];
    assert.equal(pattern.length, 64);
    assert.equal(pattern[0].length, 4, "one note per channel per row");
    for (const note of pattern[0]) {
        assert.equal(typeof note.period, "number");
        assert.equal(typeof note.index, "number");
        assert.equal(typeof note.effect, "number");
        assert.equal(typeof note.param, "number");
    }
    assert.ok(pattern[0].some(note => note.period > 0), "the first row plays something");

    const used = song.instruments.filter(instrument => instrument && instrument.sample && instrument.sample.length);
    assert.ok(used.length >= 4, `${used.length} instruments carry sample data`);
    for (const instrument of used) {
        assert.ok(instrument.sample.data.length > 0, `${instrument.name} has decoded sample data`);
        // v1 converts 8-bit sample data by dividing by 127 rather than 128, so
        // the values reach 1.008 rather than 1.0 and Web Audio clamps the
        // difference. Asserted as observed rather than as it "should" be: this
        // is the behaviour the port has to reproduce.
        assert.ok(
            instrument.sample.data.every(value => value >= -1.01 && value <= 1.01),
            "sample data is float, normalised to roughly minus one to one"
        );
    }
});

test("loads a FastTracker module through the other loader and note table", async () => {
    const song = await load("sin.xm");
    assert.equal(Tracker.inFTMode(), true, "an .xm switches the engine to FastTracker mode");
    assert.ok(song.channels >= 1);
    assert.ok(song.patterns.length >= 1);
    assert.ok(song.instruments.length >= 1);
    const instrument = song.instruments.find(i => i && i.sample && i.sample.data.length);
    assert.ok(instrument, "at least one instrument has sample data");
    assert.equal(typeof instrument.volumeEnvelope, "object", "XM instruments carry envelopes");
});

test("a module with an effect keeps that effect in its pattern data", async () => {
    const song = await load("sin-vibrato.mod");
    const effects = new Set();
    for (const pattern of song.patterns) {
        for (const row of pattern) {
            for (const note of row) {
                if (note.effect) effects.add(note.effect);
            }
        }
    }
    assert.ok(effects.size > 0, `the module uses effects: ${[...effects].sort((a, b) => a - b).join(", ")}`);
    assert.ok(effects.has(4), "including 4, vibrato, which is what this fixture is for");
});

// --- Spec 051: small additive forwards over existing engine math, plus the
// one new function (setTrackVolumes), needed by domain/arrangement/index.js
// so it never imports domain/playback/engine/ directly.

test("getFineTuneForNote/getFineTuneForPeriod forward to the engine's own Audio math exactly", async () => {
    await load("sin.xm");
    assert.equal(getFineTuneForNote(40, 4), Audio.getFineTuneForNote(40, 4));
    await load("wizballalt.mod");
    assert.equal(getFineTuneForPeriod(214, 4), Audio.getFineTuneForPeriod(214, 4));
});

test("getFtNotePeriod resolves a real FT note and returns null out of range", async () => {
    await load("sin.xm");
    assert.equal(typeof getFtNotePeriod(40), "number");
    assert.ok(getFtNotePeriod(40) > 0);
    assert.equal(getFtNotePeriod(9999), null);
});

test("usesLinearFrequency/getTickTiming/emulatesProtracker1OffsetBug reflect the loaded format", async () => {
    await load("wizballalt.mod");
    assert.equal(typeof usesLinearFrequency(), "boolean");
    assert.equal(emulatesProtracker1OffsetBug(), true, "ProTracker modules emulate the offset bug");
    const timing = getTickTiming();
    assert.equal(timing.ticksPerStep, Tracker.getProperties().ticksPerStep);
    assert.equal(timing.tickTime, Tracker.getProperties().tickTime);

    await load("sin.xm");
    assert.equal(emulatesProtracker1OffsetBug(), false, "FastTracker modules do not");
});

test("setTrackVolumes: no solo anywhere mutes exactly the muted tracks; a solo silences everyone else regardless of their own mute flag", async () => {
    await load("wizballalt.mod");
    // Audio.filterChains only ever grows across this file's own shared engine
    // (each track-count change adds chains, never removes them), so this
    // reads the real, current count rather than assuming a fixed one.
    const count = Audio.filterChains.length;
    assert.ok(count >= 4);
    const readAll = () => Audio.filterChains.map(chain => chain.volumeValue());
    const flags = (onIndexes) => Array.from({ length: count }, (_, i) => onIndexes.includes(i));

    setTrackVolumes(flags([1]), flags([]));
    assert.deepEqual(readAll(), Array.from({ length: count }, (_, i) => (i === 1 ? 0 : 70)), "no solo: only the muted track is silent");

    setTrackVolumes(flags([]), flags([1]));
    assert.deepEqual(readAll(), Array.from({ length: count }, (_, i) => (i === 1 ? 70 : 0)), "a solo silences every other track, muted or not");

    setTrackVolumes(flags([1]), flags([1]));
    assert.deepEqual(readAll(), Array.from({ length: count }, () => 0), "a track flagged both muted and soloed at once is silent too - mute wins even for the soloed track itself, matching v1's own updateTrackVolumes() exactly");

    setTrackVolumes(flags([]), flags([]));
    assert.deepEqual(readAll(), Array.from({ length: count }, () => 70), "back to normal with nothing muted or soloed");
});

test("getTrackScopeData: lazily creates and connects one analyser per track, growing (never shrinking) on demand, and fills the target every call", async () => {
    await load("wizballalt.mod"); // 4 tracks
    const target = new Uint8Array(256);
    const data0 = getTrackScopeData(0, target);
    assert.equal(data0, target, "the same array is filled and returned");
    assert.ok(target.every(v => v === 128), "the silent context's own stub reports silence (128)");

    const before = Audio.filterChains.length;
    const outOfRange = getTrackScopeData(before + 5, target);
    assert.equal(outOfRange, null, "no analyser exists yet for a track past the current count");

    // A second call for an in-range track does not recreate the analyser
    // array from scratch - growing, not resetting, on demand.
    const again = getTrackScopeData(0, target);
    assert.equal(again, target);
});

test("getMasterScopeData: taps the mix's own final output (Audio.cutOffVolume), connecting once, returning real per-channel data every call", async () => {
    await load("wizballalt.mod");
    const left = new Uint8Array(32), right = new Uint8Array(32);
    const first = getMasterScopeData(left, right);
    assert.equal(first.left, left);
    assert.equal(first.right, right);
    assert.ok(left.every(v => v === 128) && right.every(v => v === 128), "the silent context's own stub reports silence on both channels");

    // Audio.cutOffVolume's own connections list grows by exactly one (the
    // splitter) across repeated calls - confirming the connection is made
    // once, not once per call.
    const connectionsAfterFirst = Audio.cutOffVolume.connections.length;
    getMasterScopeData(left, right);
    getMasterScopeData(left, right);
    assert.equal(Audio.cutOffVolume.connections.length, connectionsAfterFirst, "no new connection on repeated calls");
});

test("loading a second module replaces the first, and the engine stays consistent", async () => {
    await load("wizballalt.mod");
    const first = Tracker.getSong().title.trim();
    await load("sin.xm");
    const second = Tracker.getSong();
    assert.notEqual(second.title.trim(), first);
    assert.equal(Tracker.isPlaying(), false, "loading does not start playback");
    assert.equal(Tracker.getCurrentSongPosition(), 0, "and rewinds to the start");
});

test("playing schedules audio against the context and stopping silences it", async () => {
    await load("wizballalt.mod");
    const before = context.started.length;

    Tracker.playSong();
    assert.equal(Tracker.isPlaying(), true);

    // The clock is v2's scheduler: it fires on its own timer once the audio
    // clock has reached the deadline, so the test advances the fake clock and
    // gives the timer a moment. This exercises the scheduler and the sequencer
    // together, which is the pairing the adaptation actually changed.
    context.advance(0.3);
    await new Promise(resolve => setTimeout(resolve, 80));

    assert.ok(context.started.length > before, `${context.started.length - before} sources started on the first batch`);
    const scheduled = context.started.slice(before);
    assert.ok(scheduled.every(entry => entry.when >= 0), "every source starts at an absolute audio-clock time");
    // The batch covers a window rather than a single note: that window is the
    // lookahead, and it is what keeps audio timing independent of the UI.
    const whens = scheduled.map(entry => entry.when);
    assert.ok(Math.max(...whens) - Math.min(...whens) > 0.05, `the batch spans ${(Math.max(...whens) - Math.min(...whens)).toFixed(3)}s of audio time`);
    assert.ok(Math.max(...whens) > 0.2, "and reaches past the deadline that triggered it");

    const states = Tracker.getTimeStates ? Tracker.getTimeStates() : null;
    if (states) assert.ok(states.length > 0, "the position ring was filled for the UI to sample");

    Tracker.stop();
    assert.equal(Tracker.isPlaying(), false);
});

test("the sequencer writes automation rather than sampling the clock itself", async () => {
    await load("wizballalt.mod");
    context.automation.length = 0;
    Tracker.playSong();
    context.advance(0.3);
    await new Promise(resolve => setTimeout(resolve, 80));
    Tracker.stop();

    assert.ok(context.automation.length > 0, "parameters were automated");
    const timed = context.automation.filter(entry => entry.method === "setValueAtTime" || entry.method === "linearRampToValueAtTime");
    assert.ok(timed.length > 0, "with absolute-time methods");
    assert.ok(
        timed.every(entry => typeof entry.args[1] === "number" && entry.args[1] >= 0),
        "each carries an absolute audio-clock time, which is why the UI's frame rate cannot affect timing"
    );
});

test("tempo is readable and settable, and the song's own speed is applied", async () => {
    await load("wizballalt.mod");
    const properties = Tracker.getProperties();
    assert.equal(typeof properties.ticksPerStep, "number");
    assert.equal(typeof properties.tickTime, "number");
    assert.ok(properties.ticksPerStep > 0 && properties.tickTime > 0);

    const original = properties.tickTime;
    Tracker.setBPM(250);
    assert.ok(Tracker.getProperties().tickTime < original, "a faster tempo means a shorter tick");
    Tracker.setBPM(125);
});

// --- spec 032: "Screen refresh" - the manual capability and the automatic
// missed-deadline throttle, both writers of the same shared field ----------

function fakeApp() {
    const store = new Map();
    return { app: { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) }, log: () => {} }, store };
}

/**
 * Runs `fn` with `performance.now()` deterministic, starting well past the
 * cooldown window so "the very first call" tests are not at the mercy of
 * how long this test file's own process has actually been running -
 * `handleMissedDeadline`'s cooldown is measured against `lastThrottleEscalation`,
 * which `reset()` sets to 0, and a short-lived test process can easily have
 * `performance.now() <= 2000` this early, which v1's own equivalent
 * (`nowFunction`, preferring `performance.now()` too) has the same
 * theoretical edge case for - not a bug to work around, but not something
 * this test should be at the mercy of either.
 */
function withFakeClock(start, fn) {
    const originalNow = performance.now;
    let now = start;
    performance.now = () => now;
    try {
        fn(delta => { now += delta; });
    } finally {
        performance.now = originalNow;
    }
}

test("setScreenRefresh maps a label to its own list index, and an unrecognized one to 0", () => {
    const { app, store } = fakeApp();
    assert.equal(setScreenRefresh(app, { value: "Smooth" }), 0);
    assert.equal(store.get(STATE_FIELDS.screenRefresh), 0);
    assert.equal(setScreenRefresh(app, { value: "Economical" }), 2);
    assert.equal(setScreenRefresh(app, { value: "Low CPU" }), 3);
    assert.equal(setScreenRefresh(app, { value: "nonesuch" }), 0);
    assert.equal(setScreenRefresh(app), 0, "no detail at all");
});

// --- spec 033: setScreenRefresh also persists, through domain/settings/ ---

test("setScreenRefresh persists its index through domain/settings/, sharing STATE_FIELDS.screenRefresh's own key", () => {
    const { app } = fakeApp();
    const fakeStorage = createFakeStorage();
    setScreenRefresh(app, { value: "Economical" }, fakeStorage);
    const seeded = applyPersistedSettings({ [STATE_FIELDS.screenRefresh]: "" }, fakeStorage);
    assert.equal(seeded[STATE_FIELDS.screenRefresh], 2);
});

// --- spec 034: loadModule retries through the v2 API's proxy -------------

test("loadModule retries a network-level fetch failure through the proxy, then loads normally", async () => {
    reset();
    const fixtureBytes = new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
    const target = "https://example.com/wizballalt.mod";
    const calls = [];
    const originalFetch = globalThis.fetch;
    const originalAudioContext = globalThis.AudioContext;
    globalThis.fetch = async url => {
        calls.push(url);
        if (url === target) throw new TypeError("Failed to fetch");
        return { ok: true, arrayBuffer: async () => fixtureBytes };
    };
    // ensureEngine() requires a global AudioContext constructor to exist
    // even though app.audioContext (supplied below) is what actually gets
    // used - a plain Node process has neither, so a placeholder satisfies
    // the existence check without ever being instantiated.
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
    try {
        const { app } = fakeApp();
        app.audioContext = context;
        const state = await loadModule(app, target);
        assert.equal(state.title, "wizball");
        assert.deepEqual(calls, [target, proxyUrl(target)]);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalAudioContext === undefined) delete globalThis.AudioContext;
        else globalThis.AudioContext = originalAudioContext;
        reset();
    }
});

// --- spec 050: ft-mode.active, the FT-only side panel's own disabledWhen --

test("loadModule publishes ft-mode.active, correctly, for both a .mod and a .xm fixture", async () => {
    reset();
    const modBytes = new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
    const xmBytes = new Uint8Array(readFileSync(join(FIXTURES, "sin.xm"))).buffer;
    const originalFetch = globalThis.fetch;
    const originalAudioContext = globalThis.AudioContext;
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
    try {
        globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => modBytes });
        const { app, store } = fakeApp();
        app.audioContext = context;
        await loadModule(app, "https://example.com/wizballalt.mod");
        assert.equal(store.get(STATE_FIELDS.ftMode), false, "a .mod loads in ProTracker mode");

        reset();
        globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => xmBytes });
        const second = fakeApp();
        second.app.audioContext = context;
        await loadModule(second.app, "https://example.com/sin.xm");
        assert.equal(second.store.get(STATE_FIELDS.ftMode), true, "a .xm loads in FastTracker mode");
    } finally {
        globalThis.fetch = originalFetch;
        if (originalAudioContext === undefined) delete globalThis.AudioContext;
        else globalThis.AudioContext = originalAudioContext;
        reset();
    }
});

// --- spec 071: BPM/title capabilities, and loadModule's own extended
// resync into domain/song's own display state ------------------------------

test("setBPM sets the real tempo and republishes it", () => {
    reset();
    const { app, store } = fakeApp();
    const context = createSilentContext({ recordAutomation: true });
    createEngine(context);
    setBPM(app, { value: 140 });
    assert.equal(store.get(STATE_FIELDS.bpm), 140);
});

test("setSongTitle sets the real song title and republishes song.title", () => {
    reset();
    const context = createSilentContext({ recordAutomation: true });
    const { Tracker } = createEngine(context);
    Tracker.init();
    const { app, store } = fakeApp();
    setSongTitle(app, { value: "my song" });
    assert.equal(Tracker.getSong().title, "my song");
    assert.equal(store.get(STATE_FIELDS.title), "my song");
});

test("loadModule also publishes song.bpm and domain/song's own display state (current pattern, instrument index, song length/repeat, pattern length, both row lists)", async () => {
    reset();
    const modBytes = new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
    const originalFetch = globalThis.fetch;
    const originalAudioContext = globalThis.AudioContext;
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
    try {
        globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => modBytes });
        const { app, store } = fakeApp();
        app.audioContext = context;
        await loadModule(app, "https://example.com/wizballalt.mod");
        assert.ok(store.has(STATE_FIELDS.bpm));
        for (const field of ["current-pattern.value", "instrument-index.value", "song-length.value", "song-repeat.value", "pattern-length.value"]) {
            assert.ok(store.has(field), `${field} was published`);
        }
        assert.ok(store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList.list"));
        assert.ok(store.get("rows.main.normalMainView.songProperties.songPropertiesDefault.songPropertiesLayout.instrumentGroup.instrumentList"));
    } finally {
        globalThis.fetch = originalFetch;
        if (originalAudioContext === undefined) delete globalThis.AudioContext;
        else globalThis.AudioContext = originalAudioContext;
        reset();
    }
});

test("handleMissedDeadline escalates immediately from a fresh state, then respects the cooldown", () => {
    reset();
    const { app, store } = fakeApp();
    withFakeClock(10000, advance => {
        handleMissedDeadline(app, 0.1);
        assert.equal(store.get(STATE_FIELDS.screenRefresh), 1, "the first missed deadline always escalates");

        advance(1);
        handleMissedDeadline(app, 0.1);
        assert.equal(store.get(STATE_FIELDS.screenRefresh), 1, "a second one inside the cooldown does nothing");

        advance(2001);
        handleMissedDeadline(app, 0.1);
        assert.equal(store.get(STATE_FIELDS.screenRefresh), 2, "a third, past the cooldown, escalates again");
    });
});

test("handleMissedDeadline never escalates past its own cap", () => {
    reset();
    const { app, store } = fakeApp();
    withFakeClock(10000, advance => {
        for (let i = 0; i < 8; i++) {
            handleMissedDeadline(app, 0.1);
            advance(2001); // past the cooldown every time, so every call escalates
        }
        assert.equal(store.get(STATE_FIELDS.screenRefresh), 4, "capped at 4, one past the UI's own highest manual option");
    });
});

test("handleMissedDeadline and setScreenRefresh share the same field - a manual choice survives until the next missed deadline, and vice versa", () => {
    reset();
    const { app, store } = fakeApp();
    setScreenRefresh(app, { value: "Normal" });
    assert.equal(store.get(STATE_FIELDS.screenRefresh), 1);

    withFakeClock(10000, () => {
        handleMissedDeadline(app, 0.1);
        assert.equal(store.get(STATE_FIELDS.screenRefresh), 2, "escalates from whatever the manual choice left it at");
    });
});

test("handleMissedDeadline does nothing without a usable app context", () => {
    reset();
    assert.doesNotThrow(() => handleMissedDeadline(undefined, 0.1));
    assert.doesNotThrow(() => handleMissedDeadline({}, 0.1));
});
