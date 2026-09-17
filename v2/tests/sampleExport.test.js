import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import { writeXI } from "../domain/moduleExport/fasttracker.js";
import { writeWav, writeRaw } from "../domain/moduleExport/sample.js";
import { exportSample, setSampleExportFormat, exportSampleSelection } from "../domain/moduleExport/index.js";

// Spec 064: sample export (WAV/RAW/XI), continuing package P9 following
// specs 037/038 (module export). Exercised against the real sin.xm fixture's
// own instrument 1 (a real, enabled volume envelope - the same fixture
// tests/envelopeController.test.js already uses), the same convention every
// prior moduleExport/sampleEditor test file already follows.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

async function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    await Tracker.processFile(buffer, name);
}

function assertClose(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) <= tolerance, message || `${actual} not within ${tolerance} of ${expected}`);
}

function assertCloseArray(actual, expected, tolerance) {
    assert.equal(actual.length, expected.length, "sample data length");
    for (let i = 0; i < expected.length; i++) assertClose(actual[i], expected[i], tolerance, `index ${i}: ${actual[i]} vs ${expected[i]}`);
}

// --- WAV -----------------------------------------------------------------

function readWavHeader(buffer) {
    const view = new DataView(buffer);
    return {
        riff: String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)),
        chunkSize: view.getUint32(4, true),
        wave: String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)),
        fmt: String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)),
        fmtSize: view.getUint32(16, true),
        audioFormat: view.getUint16(20, true),
        channels: view.getUint16(22, true),
        sampleRate: view.getUint32(24, true),
        byteRate: view.getUint32(28, true),
        blockAlign: view.getUint16(32, true),
        bitsPerSample: view.getUint16(34, true),
        data: String.fromCharCode(view.getUint8(38), view.getUint8(39), view.getUint8(40), view.getUint8(41)),
        dataSize: view.getUint32(42, true)
    };
}

test("writeWav(8) produces a valid RIFF/WAVE header and decodable 8-bit PCM", () => {
    const data = [-1, -0.5, 0, 0.5, 1]; // odd length, exercises the trailing pad byte
    const { buffer } = writeWav(data, 8);
    const header = readWavHeader(buffer);

    assert.equal(header.riff, "RIFF");
    assert.equal(header.wave, "WAVE");
    assert.equal(header.fmt, "fmt ");
    assert.equal(header.fmtSize, 18);
    assert.equal(header.audioFormat, 1);
    assert.equal(header.channels, 1);
    assert.equal(header.sampleRate, 8000);
    assert.equal(header.byteRate, 8000);
    assert.equal(header.blockAlign, 1);
    assert.equal(header.bitsPerSample, 8);
    assert.equal(header.data, "data");
    assert.equal(header.dataSize, 5);
    assert.equal(buffer.byteLength, 46 + 6, "odd-length data gets one trailing pad byte");

    const view = new DataView(buffer);
    const decoded = [];
    for (let i = 0; i < 5; i++) decoded.push((view.getUint8(46 + i) - 127.5) / 127.5);
    assertCloseArray(decoded, data, 1 / 127.5);
});

test("writeWav(16) produces a valid RIFF/WAVE header and decodable 16-bit PCM", () => {
    const data = [-1, -0.25, 0, 0.25, 1, 0.9]; // even length, no pad byte
    const { buffer } = writeWav(data, 16);
    const header = readWavHeader(buffer);

    assert.equal(header.sampleRate, 8000);
    assert.equal(header.byteRate, 16000);
    assert.equal(header.blockAlign, 2);
    assert.equal(header.bitsPerSample, 16);
    assert.equal(header.dataSize, 12);
    assert.equal(buffer.byteLength, 46 + 12);

    const view = new DataView(buffer);
    const decoded = [];
    for (let i = 0; i < data.length; i++) decoded.push(view.getInt16(46 + i * 2, true) / 32767);
    assertCloseArray(decoded, data, 1 / 32767);
});

// --- RAW -------------------------------------------------------------------

test("writeRaw writes every sample point, none dropped, no leading pad (v1's own defect fixed)", () => {
    const data = [-1, -0.5, 0, 0.5, 1, 0.75, -0.75];
    const { buffer } = writeRaw(data);

    assert.equal(buffer.byteLength, data.length, "no 2-byte pad, no truncation");

    const view = new DataView(buffer);
    const decoded = [];
    for (let i = 0; i < data.length; i++) decoded.push(view.getInt8(i) / 127);
    assertCloseArray(decoded, data, 1 / 127);
    assert.notEqual(view.getInt8(0), 0, "the first byte is real data, not v1's own leading zero pad");
});

// --- XI ----------------------------------------------------------------

/**
 * A test-local mirror of script/src/fileformats/fasttracker.js#loadXI
 * (555-678) - v2's ported engine never gained an XI reader (not in this
 * port's scope, see requirements.md), so this exists only to verify
 * writeXI's own output, not as production code.
 */
function parseXI(buffer) {
    const view = new DataView(buffer);
    let index = 0;
    const readString = len => {
        let s = "";
        for (let i = 0; i < len; i++) {
            const c = view.getUint8(index + i);
            if (c !== 0) s += String.fromCharCode(c);
        }
        index += len;
        return s;
    };
    const readByte = () => { const v = view.getInt8(index); index += 1; return v; };
    const readUByte = () => { const v = view.getUint8(index); index += 1; return v; };
    const readWord = () => { const v = view.getUint16(index, true); index += 2; return v; };
    const readShort = () => { const v = view.getInt16(index, true); index += 2; return v; };
    const readDWord = () => { const v = view.getUint32(index, true); index += 4; return v; };
    const skip = n => { index += n; };

    const signature = readString(21);
    assert.equal(signature, "Extended Instrument: ");
    const name = readString(22);
    skip(1); // 0x1A
    skip(20); // tracker name block
    skip(2); // format version

    for (let i = 0; i < 96; i++) readUByte(); // sampleNumberForNotes, not asserted

    const volumeRaw = [];
    for (let i = 0; i < 24; i++) volumeRaw.push(readWord());
    const panningRaw = [];
    for (let i = 0; i < 24; i++) panningRaw.push(readWord());

    const volumeCount = readUByte();
    const panningCount = readUByte();
    const volumeSustainPoint = readUByte();
    const volumeLoopStartPoint = readUByte();
    const volumeLoopEndPoint = readUByte();
    const panningSustainPoint = readUByte();
    const panningLoopStartPoint = readUByte();
    const panningLoopEndPoint = readUByte();
    const volumeType = readUByte();
    const panningType = readUByte();
    const vibratoType = readUByte();
    const vibratoSweep = readUByte();
    const vibratoDepth = readUByte();
    const vibratoRate = readUByte();
    const fadeout = readWord();
    skip(22);
    const numberOfSamples = readWord();

    const points = raw => {
        const pts = [];
        for (let i = 0; i < 12; i++) pts.push([raw[i * 2], raw[i * 2 + 1]]);
        return pts;
    };

    const volumeEnvelope = {
        points: points(volumeRaw), count: volumeCount,
        sustainPoint: volumeSustainPoint, loopStartPoint: volumeLoopStartPoint, loopEndPoint: volumeLoopEndPoint,
        enabled: (volumeType & 1) !== 0, sustain: (volumeType & 2) !== 0, loop: (volumeType & 4) !== 0
    };
    const panningEnvelope = {
        points: points(panningRaw), count: panningCount,
        sustainPoint: panningSustainPoint, loopStartPoint: panningLoopStartPoint, loopEndPoint: panningLoopEndPoint,
        enabled: (panningType & 1) !== 0, sustain: (panningType & 2) !== 0, loop: (panningType & 4) !== 0
    };

    const headers = [];
    for (let i = 0; i < numberOfSamples; i++) {
        const length = readDWord();
        const loopStart = readDWord();
        const loopLength = readDWord();
        const volume = readUByte();
        const finetuneX = readByte();
        const type = readUByte();
        const panning = readUByte() - 128;
        const relativeNote = readByte();
        readByte(); // reserved
        const sampleName = readString(22);
        headers.push({ length, loopStart, loopLength, volume, finetuneX, type, panning, relativeNote, name: sampleName });
    }

    const samples = headers.map(header => {
        const bits = (header.type & 16) !== 0 ? 16 : 8;
        const scale = bits === 16 ? 2 : 1;
        const length = header.length / scale;
        const loopEnabled = (header.type & 15) !== 0;

        const data = [];
        let prev = 0;
        if (bits === 16) {
            for (let i = 0; i < length; i++) {
                let b = readShort() + prev;
                if (b < -32768) b += 65536; else if (b > 32767) b -= 65536;
                prev = b;
                data.push(b / 32768);
            }
        } else {
            for (let i = 0; i < length; i++) {
                let b = readByte() + prev;
                if (b < -128) b += 256; else if (b > 127) b -= 256;
                prev = b;
                data.push(b / 127);
            }
        }

        return {
            name: header.name, volume: header.volume, finetuneX: header.finetuneX,
            panning: header.panning, relativeNote: header.relativeNote,
            loopStart: header.loopStart / scale, loopLength: header.loopLength / scale, loopEnabled,
            length, bits, data
        };
    });

    return {
        name, numberOfSamples, volumeEnvelope, panningEnvelope,
        vibrato: { type: vibratoType, sweep: vibratoSweep, depth: vibratoDepth, rate: vibratoRate },
        fadeout, samples
    };
}

test("writeXI round-trips a real instrument exactly: header, envelopes, vibrato and per-sample metadata/data", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);
    const instrumentIndex = song.getCurrentInstrumentIndex();
    const instrument = Tracker.getInstrument(instrumentIndex);
    assert.equal(instrument.volumeEnvelope.enabled, true, "sanity: this fixture's own real, enabled envelope");

    const { buffer } = writeXI(instrumentIndex);
    const decoded = parseXI(buffer);

    assert.equal(decoded.name, instrument.name);
    assert.equal(decoded.numberOfSamples, instrument.samples.length);
    assert.equal(decoded.fadeout, instrument.fadeout || 0);

    assert.equal(decoded.volumeEnvelope.count, instrument.volumeEnvelope.count || 0);
    assert.equal(decoded.volumeEnvelope.sustainPoint, instrument.volumeEnvelope.sustainPoint || 0);
    assert.equal(decoded.volumeEnvelope.loopStartPoint, instrument.volumeEnvelope.loopStartPoint || 0);
    assert.equal(decoded.volumeEnvelope.loopEndPoint, instrument.volumeEnvelope.loopEndPoint || 0);
    assert.equal(decoded.volumeEnvelope.enabled, Boolean(instrument.volumeEnvelope.enabled));
    assert.equal(decoded.volumeEnvelope.sustain, Boolean(instrument.volumeEnvelope.sustain));
    assert.equal(decoded.volumeEnvelope.loop, Boolean(instrument.volumeEnvelope.loop));
    assert.deepEqual(decoded.volumeEnvelope.points, Array.from({ length: 12 }, (_, i) => instrument.volumeEnvelope.points[i] || [0, 0]));

    assert.equal(decoded.panningEnvelope.enabled, Boolean(instrument.panningEnvelope.enabled));
    assert.deepEqual(decoded.panningEnvelope.points, Array.from({ length: 12 }, (_, i) => instrument.panningEnvelope.points[i] || [0, 0]));

    assert.deepEqual(decoded.vibrato, {
        type: instrument.vibrato.type || 0, sweep: instrument.vibrato.sweep || 0,
        depth: instrument.vibrato.depth || 0, rate: instrument.vibrato.rate || 0
    });

    assert.equal(decoded.samples.length, instrument.samples.length);
    instrument.samples.forEach((sample, i) => {
        const decodedSample = decoded.samples[i];
        assert.equal(decodedSample.name, sample.name || "");
        assert.equal(decodedSample.volume, sample.volume);
        assert.equal(decodedSample.finetuneX, sample.finetuneX);
        assert.equal(decodedSample.panning, sample.panning || 0);
        assert.equal(decodedSample.relativeNote, sample.relativeNote || 0);
        assert.equal(decodedSample.bits, sample.bits);
        assert.equal(decodedSample.length, sample.length);
        assert.equal(decodedSample.loopEnabled, sample.loop.length > 2 && Boolean(sample.loop.enabled));
        if (decodedSample.loopEnabled) {
            assert.equal(decodedSample.loopStart, sample.loop.start);
            assert.equal(decodedSample.loopLength, sample.loop.length);
        }
        assertCloseArray(decodedSample.data, sample.data, sample.bits === 16 ? 1 / 32768 : 1 / 127);
    });
});

test("writeXI returns null for a nonexistent instrument index", async () => {
    await load("sin.xm");
    assert.equal(writeXI(999), null);
});

// --- exportSample capability --------------------------------------------

test("exportSample downloads the right extension for each format", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        await exportSample(app, "wav8");
        await exportSample(app, "wav16");
        await exportSample(app, "raw8");
        await exportSample(app, "xi");
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 4);
    assert.ok(logs[0].detail.name.endsWith(".wav"));
    assert.ok(logs[1].detail.name.endsWith(".wav"));
    assert.ok(logs[2].detail.name.endsWith(".sample"));
    assert.ok(logs[3].detail.name.endsWith(".xi"));
    logs.forEach(entry => assert.equal(entry.command, "sample.export"));
});

test("exportSample no-ops with no current instrument", async () => {
    await load("sin.xm");
    // Force an out-of-range instrument index the way the fixture never has.
    const original = Tracker.getCurrentInstrumentIndex;
    Tracker.getCurrentInstrumentIndex = () => 999;
    try {
        await assert.doesNotReject(exportSample({}, "wav8"));
    } finally {
        Tracker.getCurrentInstrumentIndex = original;
    }
});

// --- setSampleExportFormat / exportSampleSelection (spec 067) --------------

test("exportSampleSelection dispatches to whatever format the radioGroup last selected", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        setSampleExportFormat(app, { value: "XI" });
        await exportSampleSelection(app);
        setSampleExportFormat(app, { value: "RAW 8-bit" });
        await exportSampleSelection(app);
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 2);
    assert.ok(logs[0].detail.name.endsWith(".xi"));
    assert.ok(logs[1].detail.name.endsWith(".sample"));
});

test("setSampleExportFormat defaults to wav8 for an unrecognized label", async () => {
    await load("sin.xm");
    song.setCurrentInstrumentIndex(1);

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        setSampleExportFormat(app, { value: "nonsense" });
        await exportSampleSelection(app);
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 1);
    assert.ok(logs[0].detail.name.endsWith(".wav"));
    assert.equal(logs[0].detail.format, "wav8");
});
