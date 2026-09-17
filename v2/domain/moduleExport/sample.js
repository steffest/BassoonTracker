// Sample export (spec 064): the current instrument's sample as a standalone
// WAV or RAW file, alongside protracker.js/fasttracker.js's whole-module
// writers in this folder. Unlike those, a sample encoder has nothing to do
// with Tracker directly - it takes plain {data, bits} in, matching
// domain/sampleEditor/processing.js's own plain-array convention.

import { createBinaryWriter } from "./binaryWriter.js";

// v1's own comment, unchanged: an in-memory sample carries no rate of its
// own, so encodeRIFFsample always assumed 8000Hz - not a v2 regression.
const SAMPLE_RATE = 8000;

/** Ported from script/src/audio/riffWave.js#encodeRIFFsample (44-126). */
export function writeWav(sampleData, bits) {
    const length = bits === 16 ? sampleData.length * 2 : sampleData.length;
    const byteRate = bits === 16 ? SAMPLE_RATE * 2 : SAMPLE_RATE;
    const chunkLength = length % 2 === 1 ? length + 1 : length;

    const file = createBinaryWriter(new ArrayBuffer(46 + chunkLength), false);

    file.writeString("RIFF");
    file.writeDWord(38 + chunkLength);
    file.writeString("WAVE");
    file.writeString("fmt ");
    file.writeDWord(18);
    file.writeWord(1); // PCM
    file.writeWord(1); // mono
    file.writeDWord(SAMPLE_RATE);
    file.writeDWord(byteRate);
    file.writeWord(Math.floor(bits / 8));
    file.writeWord(bits);
    file.writeWord(0); // padding, matching v1's own extra fmt word
    file.writeString("data");
    file.writeDWord(length);

    if (bits === 16) {
        for (let i = 0; i < sampleData.length; i++) {
            file.writeWord(Math.max(-32768, Math.min(32767, Math.round(sampleData[i] * 32767))));
        }
    } else {
        for (let i = 0; i < sampleData.length; i++) {
            file.writeUByte(Math.max(0, Math.min(255, Math.round(sampleData[i] * 127.5 + 127.5))));
        }
    }
    if (length < chunkLength) file.writeUByte(0);

    return { buffer: file.buffer };
}

/**
 * The RAW 8-bit branch of script/src/ui/diskOp_Save.js (101-113), with a
 * confirmed defect fixed rather than ported: v1 allocates `sample.length`
 * bytes, writes two zero bytes first, then writes only `sample.length - 2`
 * data bytes - a file of the promised length that starts with two spurious
 * zero bytes and silently drops the sample's own last two data points, with
 * no reader relying on that shape (see requirements.md). Every sample point
 * is written here, none dropped, no leading pad.
 */
export function writeRaw(sampleData) {
    const file = createBinaryWriter(new ArrayBuffer(sampleData.length), false);
    for (let i = 0; i < sampleData.length; i++) {
        file.writeByte(Math.round((sampleData[i] || 0) * 127));
    }
    return { buffer: file.buffer };
}
