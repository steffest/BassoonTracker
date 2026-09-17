import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as envelope from "../domain/sampleEditor/envelope.js";

// Spec 055: the envelope editor's own engine, ported from
// script/src/ui/envelope.js and envelopePanel.js. Exercised against real
// loaded fixtures for anything reading real envelope data (a real .xm's
// own volume envelope is enabled with sustain, no loop; its panning
// envelope is disabled with neither) and hand-built instrument-shaped
// objects for the pure clamp/branch math.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

// --- ENV-001: getEnvelope's own safe, falsy-default shape ------------------

test("getEnvelope: no current instrument returns the all-falsy default shape", async () => {
    await load("wizballalt.mod");
    song.setCurrentInstrumentIndex(0); // slot 0 is unused - Tracker.getCurrentInstrument() is undefined there
    assert.equal(song.getCurrentInstrument(), undefined, "confirms this is genuinely no instrument, not skipped");
    assert.deepEqual(envelope.getEnvelope("volume"), { enabled: false, points: [], count: 0, sustain: false, sustainPoint: 0, loop: false, loopStartPoint: 0, loopEndPoint: 0 });
});

test("getEnvelope: a fresh (never-parsed) envelope reads its own construction defaults falsy-safe", async () => {
    await load("wizballalt.mod"); // ProTracker - no XM envelope data is ever parsed
    song.setCurrentInstrumentIndex(1);
    const v = envelope.getEnvelope("volume");
    assert.equal(v.enabled, false);
    assert.equal(v.sustain, false, "never set at all on this instrument - falsy-safe, not undefined");
    assert.equal(v.loop, false);
    assert.equal(v.sustainPoint, 0);
    assert.ok(Array.isArray(v.points) && v.points.length > 0, "the model's own default points array is still there");
});

test("getEnvelope: a real XM instrument's own real envelope data", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);
    const v = envelope.getEnvelope("volume");
    assert.equal(v.enabled, true);
    assert.equal(v.sustain, true);
    assert.equal(v.sustainPoint, 2);
    assert.equal(v.loop, false, "this fixture's own volume envelope has no loop bit set");
    assert.equal(v.count, 6);
    assert.deepEqual(v.points[0], [0, 48]);

    const p = envelope.getEnvelope("panning");
    assert.equal(p.enabled, false);
    assert.equal(p.sustain, false);
    assert.equal(p.loop, false);
});

// --- ENV-002: setPoint's own clamp -----------------------------------------

function fakeInstrument(points, overrides = {}) {
    return {
        volumeEnvelope: {
            enabled: true, points: points.map(p => [...p]), count: points.length,
            sustain: false, sustainPoint: 0, loop: false, loopStartPoint: 0, loopEndPoint: 0,
            ...overrides
        }
    };
}

function withInstrument(instrument, fn) {
    song.setCurrentInstrumentIndex(1);
    const real = Tracker.getInstrument(song.getCurrentInstrumentIndex());
    const original = real.volumeEnvelope;
    real.volumeEnvelope = instrument.volumeEnvelope;
    try {
        fn(real.volumeEnvelope);
    } finally {
        real.volumeEnvelope = original;
    }
}

test("setPoint: point 0 never moves horizontally, y clamps 0-64", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]]), env => {
        envelope.setPoint("volume", 0, 999, 999);
        assert.deepEqual(env.points[0], [0, 64], "x pinned to 0, y clamped to 64");
        envelope.setPoint("volume", 0, -50, -50);
        assert.deepEqual(env.points[0], [0, 0]);
    });
});

test("setPoint: a middle point clamps between its own immediate neighbors", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]]), env => {
        envelope.setPoint("volume", 1, 200, 30);
        assert.deepEqual(env.points[1], [100, 30], "clamped at the next point's own x (100)");
        envelope.setPoint("volume", 1, -10, 30);
        assert.deepEqual(env.points[1], [0, 30], "clamped at the previous point's own x (0)");
    });
});

test("setPoint: the last point clamps against MAX_X (324), not a next-point bound", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]]), env => {
        envelope.setPoint("volume", 2, 999, 30);
        assert.deepEqual(env.points[2], [324, 30]);
        envelope.setPoint("volume", 2, 10, 30);
        assert.deepEqual(env.points[2], [50, 30], "still floored by the previous point's own x (50)");
    });
});

test("setPoint: an out-of-range index or a missing point is a no-op, not a throw", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40]]), () => {
        assert.doesNotThrow(() => envelope.setPoint("volume", 99, 10, 10));
    });
});

// --- ENV-003: addPoint/removePoint -----------------------------------------

test("addPoint: appends a new point 10 units after the last one when count equals the array's own length", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40]]), env => {
        envelope.addPoint("volume");
        assert.equal(env.count, 3);
        assert.deepEqual(env.points[2], [60, 32]);
    });
});

test("addPoint: reuses an existing point past count instead of appending", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [40, 10]], { count: 2 }), env => {
        envelope.addPoint("volume");
        assert.equal(env.count, 3);
        assert.deepEqual(env.points[2], [60, 10], "x repositioned (it sat at/before the previous point's own x, 50) - y is untouched, unlike a brand-new point");
    });
});

test("addPoint: does not reposition a reused point that already sits strictly after the previous one", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [80, 10]], { count: 2 }), env => {
        envelope.addPoint("volume");
        assert.deepEqual(env.points[2], [80, 10], "left alone - already past the previous point's own x");
    });
});

test("addPoint: no-op past the edge-of-canvas guard (previous point's own x within 10 of 320)", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [315, 40]]), env => {
        envelope.addPoint("volume");
        assert.equal(env.count, 2, "unchanged - 315 + 10 is not < 320");
    });
});

test("addPoint/removePoint: both are no-ops on a disabled envelope", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]], { enabled: false }), env => {
        envelope.addPoint("volume");
        assert.equal(env.count, 3, "unchanged");
        envelope.removePoint("volume");
        assert.equal(env.count, 3, "unchanged");
    });
});

test("removePoint: decrements count only above the floor of 2", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]]), env => {
        envelope.removePoint("volume");
        assert.equal(env.count, 2);
        envelope.removePoint("volume");
        assert.equal(env.count, 2, "floored at 2, not 1");
    });
});

// --- ENV-004: the shared re-clamp -------------------------------------------

test("removePoint re-clamps sustainPoint/loopStartPoint/loopEndPoint down to the new count - 1", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]], { sustainPoint: 2, loopStartPoint: 2, loopEndPoint: 2 }), env => {
        envelope.removePoint("volume");
        assert.equal(env.count, 2);
        assert.equal(env.sustainPoint, 1);
        assert.equal(env.loopStartPoint, 1);
        assert.equal(env.loopEndPoint, 1);
    });
});

test("setSustainPoint/setLoopStart/setLoopEnd each re-clamp the same way directly", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]]), env => {
        envelope.setSustainPoint("volume", 99);
        assert.equal(env.sustainPoint, 2, "clamped to count - 1 (3 - 1)");
        envelope.setLoopStart("volume", 99);
        assert.equal(env.loopStartPoint, 2);
        envelope.setLoopEnd("volume", 99);
        assert.equal(env.loopEndPoint, 2);

        envelope.setSustainPoint("volume", -5);
        assert.equal(env.sustainPoint, 0, "floored at 0 too");
    });
});

// --- ENV-005: the three plain toggles ---------------------------------------

test("setEnabled/setSustain/setLoop toggle their own flag with no other side effect", async () => {
    await load("wizballalt.mod");
    withInstrument(fakeInstrument([[0, 32], [50, 40], [100, 20]], { sustainPoint: 1, loopStartPoint: 1, loopEndPoint: 1 }), env => {
        envelope.setEnabled("volume", true);
        assert.equal(env.enabled, true);
        assert.equal(env.count, 3, "untouched");

        envelope.setSustain("volume", true);
        assert.equal(env.sustain, true);
        assert.equal(env.sustainPoint, 1, "untouched - no re-clamp on the toggle itself");

        envelope.setLoop("volume", true);
        assert.equal(env.loop, true);
        assert.equal(env.loopStartPoint, 1, "untouched");
    });
});
