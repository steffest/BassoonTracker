// The MOD writer (spec 037), ported from
// script/src/fileformats/protracker.js#write (204-328). Reads
// domain/playback/engine's own live Tracker singleton directly - the second
// documented exception to that folder's own "index.js only" rule, alongside
// domain/song/index.js's (see domain/playback/README.md and
// domain/moduleExport/README.md).

import Tracker from "../playback/engine/tracker.js";
import { createBinaryWriter } from "./binaryWriter.js";

const MAX_INSTRUMENTS = 31;
const MAX_SAMPLE_LENGTH = 131070; // 0xFFFF words - a MOD sample header's own ceiling

/**
 * @returns {{ buffer: ArrayBuffer, truncated: boolean }} `truncated` is true
 *   when the song has more than 31 instrument slots (v1's own limit, shown
 *   there as a UI dialog this port has no equivalent surface for yet).
 */
export function write() {
    const song = Tracker.getSong();
    const instruments = Tracker.getInstruments();
    const trackCount = Tracker.getTrackCount();
    const patternLength = Tracker.getPatternLength();
    const truncated = instruments.length > 32; // matches v1's own check, protracker.js:223

    let highestPattern = 0;
    for (let i = 0; i < 128; i++) highestPattern = Math.max(highestPattern, song.patternTable[i] || 0);

    let fileSize = 20 + 31 * 30 + 1 + 1 + 128 + 4;
    fileSize += (highestPattern + 1) * (trackCount * 256);
    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument) fileSize += Math.min(instrument.sample.length, MAX_SAMPLE_LENGTH);
    }

    const file = createBinaryWriter(new ArrayBuffer(fileSize));

    file.writeStringSection(song.title, 20);

    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument) {
            // Reset to the first sample in case this instrument came from an
            // XM file (multi-sample) - MOD has exactly one sample per slot.
            instrument.setSampleIndex(0);
            instrument.sample.length = Math.min(instrument.sample.length, MAX_SAMPLE_LENGTH);

            file.writeStringSection(instrument.name, 22);
            file.writeWord(instrument.sample.length >> 1);
            file.writeUByte(instrument.sample.finetune);
            file.writeUByte(instrument.sample.volume);
            file.writeWord(instrument.sample.loop.start >> 1);
            file.writeWord(instrument.sample.loop.length >> 1);
        } else {
            file.clear(30);
        }
    }

    file.writeUByte(song.length);
    file.writeUByte(127); // the restart byte - present, unused by any player, matching v1

    for (let i = 0; i < 128; i++) file.writeUByte(song.patternTable[i] || 0);

    file.writeString(trackCount === 8 ? "8CHN" : "M.K.");

    for (let i = 0; i <= highestPattern; i++) {
        const patternData = song.patterns[i];
        for (let step = 0; step < patternLength; step++) {
            const row = patternData[step];
            for (let channel = 0; channel < trackCount; channel++) {
                const cell = row && row[channel];
                if (!cell) {
                    file.writeUint(0);
                    continue;
                }
                let uIndex = 0;
                let lIndex = cell.instrument;
                if (lIndex > 15) {
                    uIndex = 16; // matches protracker.js's own "why 16 and not 1" comment, ported as-is
                    lIndex = cell.instrument - 16;
                }
                file.writeUint((uIndex << 24) + (cell.period << 16) + (lIndex << 12) + (cell.effect << 8) + cell.param);
            }
        }
    }

    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument && instrument.sample.data && instrument.sample.length) {
            for (let j = 0; j < instrument.sample.length; j++) {
                // Matches the engine's own /127 load-side convention
                // (domain/playback/README.md's own documented divergence),
                // not /128 - preserved for round-trip fidelity.
                file.writeByte(Math.round((instrument.sample.data[j] || 0) * 127));
            }
        }
    }

    return { buffer: file.buffer, truncated };
}
