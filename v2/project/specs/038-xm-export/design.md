# 038 — Design

## Overview

```
domain/moduleExport/binaryWriter.js   extended: createBinaryWriter(buffer, bigEndian = true)
domain/moduleExport/fasttracker.js    write() -> ArrayBuffer, ported from
                                       script/src/fileformats/fasttracker.js#write (311-553)
domain/moduleExport/index.js          exportModule() branches on Tracker.inFTMode()
domain/playback/engine/tracker.js     + getBPM(), + getAmigaSpeed() (additive, not a divergence)
```

## `domain/moduleExport/binaryWriter.js`

Already extended (see spec 037's own module, now generalized): `createBinaryWriter(arrayBuffer, bigEndian = true)`, `littleEndian = !bigEndian`, threaded into `writeUint`/`writeWord`'s own `DataView` calls. `protracker.js`'s existing call site is unchanged (implicit `true`); `fasttracker.js`'s calls `createBinaryWriter(new ArrayBuffer(fileSize), false)`.

## `domain/moduleExport/fasttracker.js`

```js
import Tracker from "../playback/engine/tracker.js";
import { createBinaryWriter } from "./binaryWriter.js";

const TRACKER_VERSION = "dev"; // window.versionNumber has no v2 equivalent - matches spec 037's own writeXI research

function instrumentSize(instrument) {
    if (instrument && instrument.hasSamples()) {
        return instrument.samples.reduce((size, sample) => size + 243 + 40 + sample.length * (sample.bits === 16 ? 2 : 1), 0);
    }
    return 29;
}

/** Shared by write() and a later sample-export spec's own writeXI port - v1 hand-duplicates this block twice; this port does not. */
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
        file.writeUByte(0);
        file.writeStringSection(sample.name || "", 22);
    });
    instrument.samples.forEach(sample => {
        let prev = 0;
        for (let i = 0; i < sample.length; i++) {
            const raw = sample.bits === 16
                ? Math.max(-32768, Math.min(32767, Math.round(sample.data[i] * 32768)))
                : Math.round(sample.data[i] * 127);
            let delta = raw - prev;
            prev = raw;
            if (sample.bits === 16) {
                if (delta < -32768) delta += 65536; else if (delta > 32767) delta -= 65536;
                file.writeWord(delta);
            } else {
                if (delta < -128) delta += 256; else if (delta > 127) delta -= 256;
                file.writeByte(delta);
            }
        }
    });
}

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
    file.writeByte(4);
    file.writeByte(1);

    file.writeDWord(276);
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
        file.writeDWord(9);
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
            const volumeEnvelopeType = (instrument.volumeEnvelope.enabled ? 1 : 0) + (instrument.volumeEnvelope.sustain ? 2 : 0) + (instrument.volumeEnvelope.loop ? 4 : 0);
            const panningEnvelopeType = (instrument.panningEnvelope.enabled ? 1 : 0) + (instrument.panningEnvelope.sustain ? 2 : 0) + (instrument.panningEnvelope.loop ? 4 : 0);

            file.writeDWord(243);
            file.writeStringSection(instrument.name, 22);
            file.writeUByte(0);
            file.writeWord(instrument.samples.length);
            file.writeDWord(40);
            for (let si = 0; si < 96; si++) file.writeUByte(instrument.sampleNumberForNotes[si] || 0);
            for (let si = 0; si < 12; si++) { const p = instrument.volumeEnvelope.points[si] || [0, 0]; file.writeWord(p[0]); file.writeWord(p[1]); }
            for (let si = 0; si < 12; si++) { const p = instrument.panningEnvelope.points[si] || [0, 0]; file.writeWord(p[0]); file.writeWord(p[1]); }
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
            file.writeWord(0);

            writeInstrumentSamples(file, instrument);
        } else {
            file.writeDWord(29);
            file.writeStringSection(instrument ? instrument.name : "", 22);
            file.writeUByte(0);
            file.writeWord(0);
        }
    }

    return { buffer: file.buffer };
}
```

Deliberate departures from a literal line-for-line port, each harmless and noted:

- **`instrument.numberOfSamples = instrument.samples.length` (v1's own mutating side effect) is not reproduced** - `instrument.samples.length` is read directly wherever v1 reads its own just-assigned copy. Nothing else in the engine reads `numberOfSamples` back (confirmed by grep before writing this), so this is a strict simplification, not a behavior change.
- **The instrument/sample-writing block is `writeInstrumentSamples()`**, one function instead of v1's own two, hand-duplicated copies (`write`/`writeXI`) - see requirements.md's Decisions.
- **No file-size truncation warning for >31 instruments** - that is `protracker.js`'s own, MOD-specific ceiling (31 slots); XM's own instrument count ceiling is a `writeWord` (65535), so `instruments.length - 1` never needs the same guard `write()`'s MOD sibling has.

## `domain/moduleExport/index.js`

```js
import { write as writeMod } from "./protracker.js";
import { write as writeXm } from "./fasttracker.js";

export async function exportModule(app) {
    const { buffer, truncated } = Tracker.inFTMode() ? writeXm() : writeMod();
    // ...unchanged download trigger below, truncated only ever set by writeMod()...
}
```

`writeXm()` never returns `truncated` (nothing in the XM format needs it); `index.js`'s own `if (truncated && ...)` check already tolerates `undefined` (falsy), so no branch is needed there either.

## `domain/playback/engine/tracker.js`

```js
me.getBPM = function(){ return bpm; };
me.getAmigaSpeed = function(){ return ticksPerStep; };
```

Placed beside the existing `getPatternLength`/`getTrackCount` getters; see requirements.md's Decisions for why this is additive, not a fourth divergence.

## Data models

None new.

## Error handling

Unchanged from spec 037: a missing song is not specially guarded (nothing dispatches `file.save` before a module is loaded).

## Testing strategy

- **`tests/binaryWriter.test.js`** (extended): `createBinaryWriter(buffer, false)` writes the opposite byte order from the default, for both `writeUint` and `writeWord` (XM-002).
- **`tests/moduleExport.test.js`** (extended): a full round trip against a real XM fixture (`sin.xm`, already in `tests/fixtures/`) - title, channel count, instrument names/envelope points/counts/sustain/loop settings/vibrato, per-sample volume/finetune/loop/relative-note/panning, and every pattern cell's index/instrument/volumeEffect/effect/param, all compared exactly (XM-001). The existing "XM mode is a no-op" test is replaced with one asserting a real XM export happens instead (XM-003) - MOD's own no-regression case (the round trip from spec 037) is unaffected and re-run unchanged.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` succeed (no YAML/capabilities.js change at all).

## What this deliberately does not do

See requirements.md's Scope boundaries: no `writeXI`, no sample/playlist/MP3 export, no save/export screen, no bit-packed pattern encoding, no pingpong-loop handling.
