import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";

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
