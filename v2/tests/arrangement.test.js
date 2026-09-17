import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import { getFineTuneForPeriod, getSampleRateForPeriod, getTickTiming } from "../domain/playback/index.js";

// Spec 051: the multitrack arrangement view's headless engine, ported from
// script/src/ui/app/components/multitrack.js (per-track block/effect
// segmentation) and dawtrack.js/trackControl.js (the mute/solo rule).
// Exercised against a real loaded fixture, the same way tests/song.test.js
// and tests/playback.test.js already are, rather than hand-built fake
// pattern data - domain/arrangement never imports domain/playback/engine/
// directly, so any note it reads has to come from a real loaded song.

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

/** wizballalt.mod/sin.xm are real music - every track already has real notes scattered through it, so any test isolating specific rows has to clear the track first. */
function clearTrack(track) {
    song.setCurrentTrack(track);
    song.setCurrentPatternPos(0);
    song.clearTrack();
}

/** Writes a fully-specified note directly, bypassing putNote's own volume-column translation so effect/param/volumeEffect can be set independently of instrument/period/index. */
function setNote(track, row, { instrument = 0, period = 0, index, effect = 0, param = 0, volumeEffect = 0 } = {}) {
    song.setCurrentTrack(track);
    song.setCurrentPatternPos(row);
    song.putNote({ instrument, period, noteIndex: index });
    const note = Tracker.getSong().patterns[song.getCurrentPattern()][row][track];
    note.effect = effect;
    note.param = param;
    note.volumeEffect = volumeEffect;
    return note;
}

function resetTrackStates(count = 4) {
    for (let i = 0; i < count; i++) {
        arrangement.setTrackMute(i, false);
        arrangement.setTrackSolo(i, false);
    }
}

beforeEach(async () => {
    await load("wizballalt.mod"); // 4 tracks, every instrument loops - see the offset test for the one deliberately non-looped scenario
    song.clearHistory();
    song.setCurrentPattern(0);
    resetTrackStates();
});

// --- getPerTrackBlocks / getPerTrackEffects (ARR-001/002) -------------------

test("getPerTrackBlocks: block boundaries follow note-on cells, and a bare instrument-0 note keeps the previous (sticky) instrument", () => {
    clearTrack(0);
    setNote(0, 0, { instrument: 2, period: 214 });
    setNote(0, 10, { instrument: 0, period: 200 }); // sticky: keeps instrument 2
    setNote(0, 20, { instrument: 5, period: 180 }); // switches instrument, runs to pattern end (instrument 5 loops, so uncapped)

    const blocks = arrangement.getPerTrackBlocks(0)[0];
    assert.equal(blocks.length, 3);

    assert.deepEqual([blocks[0].startStep, blocks[0].endStep, blocks[0].instrument], [0, 10, 2]);
    assert.deepEqual([blocks[1].startStep, blocks[1].endStep, blocks[1].instrument], [10, 20, 2], "sticky instrument, not 0");
    assert.deepEqual([blocks[2].startStep, blocks[2].endStep, blocks[2].instrument], [20, 64, 5], "last block runs to the pattern's own end");

    assert.notEqual(blocks[0].name, "");
    assert.equal(blocks[0].volume, 50, "instrument 2's own default volume (32) scaled to 0-100 (32*100/64)");
    assert.equal(blocks[2].volume, 50, "instrument 5's own default volume (32) scaled the same way");
});

test("getPerTrackBlocks: an empty track and an empty/out-of-range pattern both return safely", () => {
    clearTrack(0);
    clearTrack(1);
    setNote(0, 0, { instrument: 2, period: 214 });
    const perTrack = arrangement.getPerTrackBlocks(0);
    assert.equal(perTrack.length, Tracker.getTrackCount());
    assert.deepEqual(perTrack[1], [], "track 1 has no notes at all");
    assert.deepEqual(arrangement.getPerTrackBlocks(999), [], "an out-of-range pattern returns an empty array, not a throw");
});

test("getPerTrackBlocks: a 0C (set volume) effect overrides the instrument's own default volume", () => {
    clearTrack(1);
    setNote(1, 5, { instrument: 16, period: 200, effect: 12, param: 16 }); // instrument 16's own default would be 48*100/64=75; 0C with param 16 forces 16*100/64=25
    const block = arrangement.getPerTrackBlocks(0)[1][0];
    assert.equal(block.volume, 25);
});

test("getPerTrackEffects: lists every nonzero effect/param cell per track, in row order", () => {
    clearTrack(3);
    setNote(3, 2, { instrument: 1, period: 214, effect: 4, param: 0x12 });
    setNote(3, 9, { instrument: 0, period: 0, effect: 0, param: 5 }); // param alone, no effect, still counts (v1's own `note.effect || note.param` check)

    const effects = arrangement.getPerTrackEffects(0)[3];
    assert.deepEqual(effects, [
        { step: 2, effect: 4, param: 0x12 },
        { step: 9, effect: 0, param: 5 }
    ]);
});

test("getPerTrackBlocks: a non-looped sample caps the block at its own playable length, and that cap carries forward (accumulating) to a later sticky-instrument row with no 9xx of its own", () => {
    const instrument = song.getInstrumentAt(16); // finetune 0 - stretched below so the arithmetic has room to differ
    instrument.sample.loop.enabled = false;
    instrument.sample.data = new Array(50000).fill(0);

    // Expected caps, derived the same way getPerTrackBlocks itself does
    // (composing the already-independently-tested playback forwards) rather
    // than hand-computed - getFineTuneForPeriod's own table lookup shifts
    // the period slightly even at finetune 0, which a hand calculation
    // missed on the first attempt here.
    const { ticksPerStep, tickTime } = getTickTiming();
    const stepDuration = ticksPerStep * tickTime;
    const capFor = (rawPeriod, offsetBytes) => {
        const period = getFineTuneForPeriod(rawPeriod, instrument.getFineTune());
        const rate = getSampleRateForPeriod(period);
        const remaining = Math.max(1, 50000 - Math.min(offsetBytes, 49999));
        return Math.max(1, Math.ceil(remaining / rate / stepDuration));
    };
    const ownOffset = 40 << 8;
    const carriedOffset = ownOffset * 2; // offsetCache.value ends doubled after processing its own 9xx row (design.md's own traced accumulation)

    clearTrack(2);
    setNote(2, 0, { instrument: 16, period: 214, effect: 9, param: 40 });
    setNote(2, 25, { instrument: 0, period: 200 }); // sticky instrument 16, no own 9xx - inherits the accumulated cache
    setNote(2, 50, { instrument: 5, period: 180 }); // instrument 5 loops - uncapped, runs to the pattern's own end

    const blocks = arrangement.getPerTrackBlocks(0)[2];
    const block0 = blocks.find(b => b.startStep === 0);
    const block1 = blocks.find(b => b.startStep === 25);
    const block2 = blocks.find(b => b.startStep === 50);

    assert.equal(block0.endStep, capFor(214, ownOffset), "capped by its own explicit offset, well short of the next note at row 25");
    assert.equal(block1.endStep, 25 + capFor(200, carriedOffset), "capped by the carried, accumulated offset, well short of the next note at row 50");
    assert.ok(block0.endStep < 25 && 25 + capFor(200, carriedOffset) < 50, "both caps are real - short of the next note, not coincidentally equal to it");
    assert.equal(block2.endStep, 64, "instrument 5 loops - never capped, runs to the pattern's own end");
});

test("getPerTrackBlocks: a note with an enabled loop is never length-capped even when a later note is far away", () => {
    clearTrack(0);
    setNote(0, 0, { instrument: 2, period: 214 }); // instrument 2 loops
    const block = arrangement.getPerTrackBlocks(0)[0][0];
    assert.equal(block.endStep, 64, "runs all the way to the pattern's own end");
});

// --- FT-mode volume-column override (ARR-001) -------------------------------

test("getPerTrackBlocks: FastTracker's own volume-column effect overrides the instrument's default volume", async () => {
    await load("sin.xm");
    song.clearHistory();
    song.setCurrentPattern(0);
    assert.equal(song.inFTMode(), true);
    clearTrack(0);

    setNote(0, 3, { instrument: 1, index: 40, volumeEffect: 48 }); // instrument 1's own default is 64*100/64=100; volumeEffect 48 -> (48-16)*100/64=50
    const block = arrangement.getPerTrackBlocks(0)[0][0];
    assert.equal(block.volume, 50);
});

// --- moveNote forwards to domain/song (ARR-003, exercised in full there) ---

test("moveNote forwards to domain/song's own undoable mutation", () => {
    setNote(0, 1, { instrument: 4, period: 200 });
    song.clearHistory();
    const result = arrangement.moveNote(0, 1, 1, 6);
    assert.equal(result.moved, true);
    assert.equal(Tracker.getSong().patterns[0][6][1].period, 200);
    assert.equal(song.canUndo(), true);
});

// --- Track mute/solo (ARR-004/005/006) --------------------------------------

test("setTrackSolo: soloing mutes every other track; un-soloing restores them", () => {
    arrangement.setTrackSolo(1, true);
    assert.deepEqual(arrangement.getTrackMuteSolo(0), { mute: true, solo: false });
    assert.deepEqual(arrangement.getTrackMuteSolo(1), { mute: false, solo: true });
    assert.deepEqual(arrangement.getTrackMuteSolo(2), { mute: true, solo: false });
    assert.deepEqual(arrangement.getTrackMuteSolo(3), { mute: true, solo: false });

    arrangement.setTrackSolo(1, false);
    for (let i = 0; i < 4; i++) {
        assert.deepEqual(arrangement.getTrackMuteSolo(i), { mute: false, solo: false }, `track ${i} restored`);
    }
});

test("setTrackSolo: soloing a second track hands solo off cleanly, un-soloing the second restores everyone", () => {
    arrangement.setTrackSolo(0, true);
    arrangement.setTrackSolo(2, true);
    assert.deepEqual(arrangement.getTrackMuteSolo(0), { mute: true, solo: false }, "track 0's own solo was cleared by track 2's own solo");
    assert.deepEqual(arrangement.getTrackMuteSolo(2), { mute: false, solo: true });
    assert.deepEqual(arrangement.getTrackMuteSolo(1), { mute: true, solo: false });

    arrangement.setTrackSolo(2, false);
    for (let i = 0; i < 4; i++) {
        assert.deepEqual(arrangement.getTrackMuteSolo(i), { mute: false, solo: false }, `track ${i} restored`);
    }
});

test("setTrackMute on a currently-soloed track clears only its own solo flag - no cascade (a preserved v1 quirk)", () => {
    arrangement.setTrackSolo(1, true); // mutes 0, 2, 3
    arrangement.setTrackMute(1, true); // v1's own onClick never passes wasSolo on this path
    assert.deepEqual(arrangement.getTrackMuteSolo(1), { mute: true, solo: false });
    assert.deepEqual(arrangement.getTrackMuteSolo(0), { mute: true, solo: false }, "still muted - no restore cascade");
    assert.deepEqual(arrangement.getTrackMuteSolo(2), { mute: true, solo: false }, "still muted - no restore cascade");
});

test("toggleTrackMute/toggleTrackSolo flip and return the new state", () => {
    assert.equal(arrangement.toggleTrackMute(0), true);
    assert.equal(arrangement.toggleTrackMute(0), false);
    assert.equal(arrangement.toggleTrackSolo(0), true);
    assert.equal(arrangement.toggleTrackSolo(0), false);
});
