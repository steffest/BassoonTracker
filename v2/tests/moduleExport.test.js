import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import { write } from "../domain/moduleExport/protracker.js";
import { write as writeXm } from "../domain/moduleExport/fasttracker.js";
import { exportModule } from "../domain/moduleExport/index.js";

// Specs 037 (MOD) and 038 (XM). Exercised against the real fixtures every
// other engine test already uses, since Tracker is a singleton and loading a
// module for real is the only way to get the exact live song/instrument
// objects each writer reads.

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

function cellFacts(cell) {
    return cell ? { instrument: cell.instrument, period: cell.period, effect: cell.effect, param: cell.param } : null;
}

test("write() round-trips a real fixture: title, instruments, pattern table and pattern data all survive exactly", async () => {
    const original = await load("wizballalt.mod");

    // Snapshot what matters before reloading replaces the singleton's own song.
    const before_ = {
        title: original.title,
        length: original.length,
        trackCount: Tracker.getTrackCount(),
        patternLength: Tracker.getPatternLength(),
        patternTable: [...original.patternTable],
        instruments: Tracker.getInstruments().map(instrument => instrument && {
            name: instrument.name,
            volume: instrument.sample.volume,
            finetune: instrument.sample.finetune,
            loopStart: instrument.sample.loop.start,
            loopLength: instrument.sample.loop.length,
            sampleLength: instrument.sample.length
        }),
        patterns: original.patterns.map(pattern => pattern.map(row => row.map(cellFacts)))
    };

    const { buffer, truncated } = write();
    assert.equal(truncated, false);

    const reloaded = await Tracker.processFile(buffer, "roundtrip.mod").then(() => Tracker.getSong());

    assert.equal(reloaded.title, before_.title);
    assert.equal(reloaded.length, before_.length);
    assert.equal(Tracker.getTrackCount(), before_.trackCount);
    assert.equal(Tracker.getPatternLength(), before_.patternLength);
    assert.deepEqual([...reloaded.patternTable], before_.patternTable);

    const reloadedInstruments = Tracker.getInstruments().map(instrument => instrument && {
        name: instrument.name,
        volume: instrument.sample.volume,
        finetune: instrument.sample.finetune,
        loopStart: instrument.sample.loop.start,
        loopLength: instrument.sample.loop.length,
        sampleLength: instrument.sample.length
    });
    assert.deepEqual(reloadedInstruments, before_.instruments);

    const reloadedPatterns = reloaded.patterns.map(pattern => pattern.map(row => row.map(cellFacts)));
    assert.deepEqual(reloadedPatterns, before_.patterns);
});

test("more than 31 instrument slots truncates, matching v1's own limit", async () => {
    await load("wizballalt.mod");
    const instruments = Tracker.getInstruments();
    const extra = { ...instruments[1] };
    instruments[32] = extra; // a 32nd real slot, beyond MOD's own 31-instrument ceiling

    const { truncated } = write();
    assert.equal(truncated, true);

    delete instruments[32];
});

// --- spec 038: XM export -----------------------------------------------

function xmCellFacts(cell) {
    return cell ? { index: cell.index, instrument: cell.instrument, volumeEffect: cell.volumeEffect, effect: cell.effect, param: cell.param } : null;
}

function xmInstrumentFacts(instrument) {
    if (!instrument) return null;
    return {
        name: instrument.name,
        fadeout: instrument.fadeout,
        vibrato: { ...instrument.vibrato },
        volumeEnvelope: { ...instrument.volumeEnvelope, points: instrument.volumeEnvelope.points.map(p => [...p]) },
        panningEnvelope: { ...instrument.panningEnvelope, points: instrument.panningEnvelope.points.map(p => [...p]) },
        samples: (instrument.samples || []).map(sample => ({
            name: sample.name,
            volume: sample.volume,
            finetuneX: sample.finetuneX,
            panning: sample.panning,
            relativeNote: sample.relativeNote,
            loopStart: sample.loop.start,
            loopLength: sample.loop.length,
            loopEnabled: sample.loop.enabled,
            length: sample.length,
            bits: sample.bits
        }))
    };
}

test("write() (XM) round-trips a real fixture: title, instruments, envelopes, samples and pattern data all survive exactly", async () => {
    const original = await load("sin.xm");
    assert.equal(Tracker.inFTMode(), true);

    const before_ = {
        title: original.title,
        length: original.length,
        trackCount: Tracker.getTrackCount(),
        patternTable: [...original.patternTable],
        instruments: Tracker.getInstruments().map(xmInstrumentFacts),
        patterns: original.patterns.map(pattern => pattern.map(row => row.map(xmCellFacts)))
    };

    const { buffer } = writeXm();

    const reloaded = await Tracker.processFile(buffer, "roundtrip.xm").then(() => Tracker.getSong());
    assert.equal(Tracker.inFTMode(), true, "still XM after reloading the exported bytes");

    assert.equal(reloaded.title, before_.title);
    assert.equal(reloaded.length, before_.length);
    assert.equal(Tracker.getTrackCount(), before_.trackCount);
    assert.deepEqual([...reloaded.patternTable], before_.patternTable);
    assert.deepEqual(Tracker.getInstruments().map(xmInstrumentFacts), before_.instruments);
    assert.deepEqual(reloaded.patterns.map(pattern => pattern.map(row => row.map(xmCellFacts))), before_.patterns);
});

test("exportModule dispatches to the XM writer while in FastTracker mode, and back to MOD afterward", async () => {
    await load("sin.xm");
    assert.equal(Tracker.inFTMode(), true);

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    // exportModule's own download trigger is plain browser API (Blob/
    // URL.createObjectURL/a synthetic <a> click) - this is the first test to
    // reach that far rather than stopping at write()'s own pure bytes, so a
    // minimal `document` stands in for the missing DOM in Node.
    globalThis.document = { createElement: () => ({ click() {} }) };
    try {
        await exportModule({ log: (command, detail) => logs.push({ command, detail }) });
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 1, "no truncation warning applies to XM, so exactly one log line");
    assert.equal(logs[0].command, "file.save");
    assert.ok(logs[0].detail.name.endsWith(".xm"), "the no-filename fallback uses the real format's own extension");

    await load("wizballalt.mod"); // restore ProTracker mode for any test that runs after this one
});
