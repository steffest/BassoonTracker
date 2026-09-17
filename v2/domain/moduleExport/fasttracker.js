// The XM writer (spec 038), ported from
// script/src/fileformats/fasttracker.js#write (311-553). Reads
// domain/playback/engine's own live Tracker singleton directly - the same
// documented exception domain/moduleExport/protracker.js already uses (see
// domain/playback/README.md and domain/moduleExport/README.md).

import Tracker from "../playback/engine/tracker.js";
import { createBinaryWriter } from "./binaryWriter.js";

// window.versionNumber has no v2 equivalent (same finding as spec 037's own
// writeXI research); v1's own fallback is "dev".
const TRACKER_VERSION = "dev";

function instrumentSize(instrument) {
    if (instrument && instrument.hasSamples()) {
        return instrument.samples.reduce((size, sample) => size + 243 + 40 + sample.length * (sample.bits === 16 ? 2 : 1), 0);
    }
    return 29; // an "empty instrument" header - matches write()'s own else-branch size
}

/**
 * The sample-header-then-sample-data block, shared by write() and (a later
 * spec's own) writeXI - v1 hand-duplicates this exact logic in both
 * fasttracker.js#write and #writeXI; this port does not.
 */
function writeInstrumentSamples(file, instrument) {
    instrument.samples.forEach(sample => {
        const sampleType = (sample.loop.length > 2 && sample.loop.enabled ? 1 : 0) + (sample.bits === 16 ? 16 : 0);
        const byteScale = sample.bits === 16 ? 2 : 1;
        file.writeDWord(sample.length * byteScale);
        file.writeDWord(sample.loop.start * byteScale);
        file.writeDWord(sample.loop.length * byteScale);
        file.writeUByte(sample.volume);
        file.writeByte(sample.finetuneX);
        file.writeUByte(sampleType);
        file.writeUByte((sample.panning || 0) + 128);
        file.writeUByte(sample.relativeNote || 0);
        file.writeUByte(0); // reserved
        file.writeStringSection(sample.name || "", 22);
    });

    instrument.samples.forEach(sample => {
        let prev = 0;
        for (let i = 0; i < sample.length; i++) {
            let raw;
            let delta;
            if (sample.bits === 16) {
                raw = Math.max(-32768, Math.min(32767, Math.round(sample.data[i] * 32768)));
                delta = raw - prev;
                prev = raw;
                if (delta < -32768) delta += 65536;
                else if (delta > 32767) delta -= 65536;
                file.writeWord(delta);
            } else {
                raw = Math.round(sample.data[i] * 127);
                delta = raw - prev;
                prev = raw;
                if (delta < -128) delta += 256;
                else if (delta > 127) delta -= 256;
                file.writeByte(delta);
            }
        }
    });
}

/**
 * Ported from script/src/fileformats/fasttracker.js#writeXI (680-809), spec
 * 064. Its own per-sample header/data block is byte-for-byte the same shape
 * writeInstrumentSamples() above already ports for write() (confirmed by
 * diffing both v1 blocks side by side) - this function only writes the
 * fixed 298-byte instrument header write() does not have, then delegates.
 * @returns {{ buffer: ArrayBuffer } | null}
 */
export function writeXI(instrumentIndex) {
    const instrument = Tracker.getInstrument(instrumentIndex);
    if (!instrument) return null;

    const samples = instrument.samples || [];
    let fileSize = 298; // the whole fixed header (confirmed by hand-adding every field's width)
    for (const sample of samples) fileSize += 40 + sample.length * (sample.bits === 16 ? 2 : 1);

    const file = createBinaryWriter(new ArrayBuffer(fileSize), false);

    file.writeStringSection("Extended Instrument: ", 21);
    file.writeStringSection(instrument.name || "", 22);
    file.writeByte(0x1A);
    file.writeStringSection(`BassoonTracker ${TRACKER_VERSION}`, 20);
    file.writeWord(0x0102); // XI format version 1.02

    for (let si = 0; si < 96; si++) file.writeUByte(instrument.sampleNumberForNotes[si] || 0);

    const volumeEnvelopeType = (instrument.volumeEnvelope.enabled ? 1 : 0)
        + (instrument.volumeEnvelope.sustain ? 2 : 0)
        + (instrument.volumeEnvelope.loop ? 4 : 0);
    const panningEnvelopeType = (instrument.panningEnvelope.enabled ? 1 : 0)
        + (instrument.panningEnvelope.sustain ? 2 : 0)
        + (instrument.panningEnvelope.loop ? 4 : 0);

    for (let si = 0; si < 12; si++) {
        const point = instrument.volumeEnvelope.points[si] || [0, 0];
        file.writeWord(point[0]);
        file.writeWord(point[1]);
    }
    for (let si = 0; si < 12; si++) {
        const point = instrument.panningEnvelope.points[si] || [0, 0];
        file.writeWord(point[0]);
        file.writeWord(point[1]);
    }

    file.writeUByte(instrument.volumeEnvelope.count || 0);
    file.writeUByte(instrument.panningEnvelope.count || 0);
    file.writeUByte(instrument.volumeEnvelope.sustainPoint || 0);
    file.writeUByte(instrument.volumeEnvelope.loopStartPoint || 0);
    file.writeUByte(instrument.volumeEnvelope.loopEndPoint || 0);
    file.writeUByte(instrument.panningEnvelope.sustainPoint || 0);
    file.writeUByte(instrument.panningEnvelope.loopStartPoint || 0);
    file.writeUByte(instrument.panningEnvelope.loopEndPoint || 0);
    file.writeUByte(volumeEnvelopeType);
    file.writeUByte(panningEnvelopeType);
    file.writeUByte(instrument.vibrato.type || 0);
    file.writeUByte(instrument.vibrato.sweep || 0);
    file.writeUByte(instrument.vibrato.depth || 0);
    file.writeUByte(instrument.vibrato.rate || 0);
    file.writeWord(instrument.fadeout || 0);
    file.fill(0, 22); // 22 reserved bytes, matching write()'s own instrument-header padding
    file.writeWord(samples.length);

    writeInstrumentSamples(file, instrument);

    return { buffer: file.buffer };
}

/** @returns {{ buffer: ArrayBuffer }} */
export function write() {
    const song = Tracker.getSong();
    const instruments = Tracker.getInstruments();
    const trackCount = Tracker.getTrackCount();

    let highestPattern = 0;
    for (let i = 0; i < 128; i++) highestPattern = Math.max(highestPattern, song.patternTable[i] || 0);

    let fileSize = 60 + 276;
    for (let i = 0; i <= highestPattern; i++) {
        if (song.patterns[i]) fileSize += 9 + song.patterns[i].length * trackCount * 5;
    }
    for (let i = 1; i < instruments.length; i++) fileSize += instrumentSize(instruments[i]);

    const file = createBinaryWriter(new ArrayBuffer(fileSize), false);

    file.writeStringSection("Extended Module: ", 17);
    file.writeStringSection(song.title, 20);
    file.writeByte(26);
    file.writeStringSection(`BassoonTracker ${TRACKER_VERSION}`, 20);
    file.writeByte(4); // minor version
    file.writeByte(1); // major version

    file.writeDWord(276); // header size
    file.writeWord(song.length);
    file.writeWord(0); // restart position - v1 never round-trips this either
    file.writeWord(trackCount);
    file.writeWord(highestPattern + 1);
    file.writeWord(instruments.length - 1);
    file.writeWord(Tracker.useLinearFrequency ? 1 : 0);
    file.writeWord(Tracker.getAmigaSpeed());
    file.writeWord(Tracker.getBPM());

    for (let i = 0; i < 256; i++) file.writeUByte(song.patternTable[i] || 0);

    for (let i = 0; i <= highestPattern; i++) {
        const pattern = song.patterns[i];
        const patternLength = pattern ? pattern.length : 0;

        file.writeDWord(9); // pattern header size
        file.writeUByte(0); // packing type - always uncompressed, matching v1
        file.writeWord(patternLength);
        file.writeWord(patternLength * trackCount * 5);

        if (pattern) {
            for (let step = 0; step < patternLength; step++) {
                const row = pattern[step];
                for (let channel = 0; channel < trackCount; channel++) {
                    const note = row[channel] || {};
                    file.writeUByte(note.index || 0);
                    file.writeUByte(note.instrument || 0);
                    file.writeUByte(note.volumeEffect || 0);
                    file.writeUByte(note.effect || 0);
                    file.writeUByte(note.param || 0);
                }
            }
        }
    }

    for (let i = 1; i < instruments.length; i++) {
        const instrument = instruments[i];
        if (instrument && instrument.hasSamples()) {
            const volumeEnvelopeType = (instrument.volumeEnvelope.enabled ? 1 : 0)
                + (instrument.volumeEnvelope.sustain ? 2 : 0)
                + (instrument.volumeEnvelope.loop ? 4 : 0);
            const panningEnvelopeType = (instrument.panningEnvelope.enabled ? 1 : 0)
                + (instrument.panningEnvelope.sustain ? 2 : 0)
                + (instrument.panningEnvelope.loop ? 4 : 0);

            file.writeDWord(243); // instrument header size
            file.writeStringSection(instrument.name, 22);
            file.writeUByte(0); // instrument type
            file.writeWord(instrument.samples.length);
            file.writeDWord(40); // sample header size

            for (let si = 0; si < 96; si++) file.writeUByte(instrument.sampleNumberForNotes[si] || 0);
            for (let si = 0; si < 12; si++) {
                const point = instrument.volumeEnvelope.points[si] || [0, 0];
                file.writeWord(point[0]);
                file.writeWord(point[1]);
            }
            for (let si = 0; si < 12; si++) {
                const point = instrument.panningEnvelope.points[si] || [0, 0];
                file.writeWord(point[0]);
                file.writeWord(point[1]);
            }

            file.writeUByte(instrument.volumeEnvelope.count || 0);
            file.writeUByte(instrument.panningEnvelope.count || 0);
            file.writeUByte(instrument.volumeEnvelope.sustainPoint || 0);
            file.writeUByte(instrument.volumeEnvelope.loopStartPoint || 0);
            file.writeUByte(instrument.volumeEnvelope.loopEndPoint || 0);
            file.writeUByte(instrument.panningEnvelope.sustainPoint || 0);
            file.writeUByte(instrument.panningEnvelope.loopStartPoint || 0);
            file.writeUByte(instrument.panningEnvelope.loopEndPoint || 0);
            file.writeUByte(volumeEnvelopeType);
            file.writeUByte(panningEnvelopeType);
            file.writeUByte(instrument.vibrato.type || 0);
            file.writeUByte(instrument.vibrato.sweep || 0);
            file.writeUByte(instrument.vibrato.depth || 0);
            file.writeUByte(instrument.vibrato.rate || 0);
            file.writeWord(instrument.fadeout || 0);
            file.writeWord(0); // reserved

            writeInstrumentSamples(file, instrument);
        } else {
            file.writeDWord(29); // empty-instrument header size
            file.writeStringSection(instrument ? instrument.name : "", 22);
            file.writeUByte(0); // instrument type
            file.writeWord(0); // number of samples
        }
    }

    return { buffer: file.buffer };
}
