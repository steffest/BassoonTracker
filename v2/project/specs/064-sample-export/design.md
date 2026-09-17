# 064 — Design

## Overview

```
domain/moduleExport/fasttracker.js
  + writeXI(instrumentIndex)   new export, reuses the existing, unexported
                               writeInstrumentSamples() helper (spec 038)

domain/moduleExport/sample.js (new)
  writeWav(sampleData, bits)  ported from script/src/audio/riffWave.js#encodeRIFFsample
  writeRaw(sampleData)        the RAW 8-bit branch, defect fixed (see requirements.md)

domain/moduleExport/index.js
  + exportSample(app, format) the sample-export capability, dispatches to
                               writeXI/writeWav/writeRaw
  + downloadBuffer(buffer, name)  factored out of exportModule, now shared
```

## `domain/moduleExport/fasttracker.js#writeXI`

Added below `writeInstrumentSamples()`/above `write()`, sharing both the module's existing `TRACKER_VERSION` constant and the `writeInstrumentSamples` helper - no new imports.

```js
/**
 * Ported from script/src/fileformats/fasttracker.js#writeXI (680-809). Its
 * own per-sample header/data block is byte-for-byte the same shape
 * writeInstrumentSamples() (spec 038) already ports for write() - confirmed
 * by diffing both v1 blocks side by side - so this function only writes the
 * fixed 298-byte instrument header write() does not have, then delegates.
 */
export function writeXI(instrumentIndex) {
    const instrument = Tracker.getInstrument(instrumentIndex);
    if (!instrument) return null;

    const samples = instrument.samples || [];
    let fileSize = 298;
    for (const sample of samples) fileSize += 40 + sample.length * (sample.bits === 16 ? 2 : 1);

    const file = createBinaryWriter(new ArrayBuffer(fileSize), false);

    file.writeStringSection("Extended Instrument: ", 21);
    file.writeStringSection(instrument.name || "", 22);
    file.writeByte(0x1A);
    file.writeStringSection(`BassoonTracker ${TRACKER_VERSION}`, 20);
    file.writeWord(0x0102);

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
    file.fill(0, 22);
    file.writeWord(samples.length);

    writeInstrumentSamples(file, instrument);

    return { buffer: file.buffer };
}
```

`fileSize`'s base (298) is the sum of every fixed write call above, confirmed by hand-adding v1's own field widths (21+22+1+20+2+96+48+48+8+2+4+2+22+2 = 298) rather than trusted from v1's own "298 (278 + 20 extra reserved bytes vs original estimate)" comment alone - that comment records v1's own estimate history, not a padding gap; every byte allocated is a byte written.

## `domain/moduleExport/sample.js` (new)

```js
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
    file.writeWord(1);  // PCM
    file.writeWord(1);  // mono
    file.writeDWord(SAMPLE_RATE);
    file.writeDWord(byteRate);
    file.writeWord(Math.floor(bits / 8));
    file.writeWord(bits);
    file.writeWord(0);  // padding, matching v1's own extra fmt word
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
 * The RAW 8-bit branch of script/src/ui/diskOp_Save.js (101-113), with its
 * confirmed defect fixed rather than ported - see requirements.md. Every
 * sample point is written, none dropped, no leading pad.
 */
export function writeRaw(sampleData) {
    const file = createBinaryWriter(new ArrayBuffer(sampleData.length), false);
    for (let i = 0; i < sampleData.length; i++) {
        file.writeByte(Math.round((sampleData[i] || 0) * 127));
    }
    return { buffer: file.buffer };
}
```

## `domain/moduleExport/index.js`

```js
import { write as writeMod } from "./protracker.js";
import { write as writeXm, writeXI } from "./fasttracker.js";
import { writeWav, writeRaw } from "./sample.js";

function downloadBuffer(buffer, name) {
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

export async function exportModule(app) {
    const isXm = Tracker.inFTMode();
    const { buffer, truncated } = isXm ? writeXm() : writeMod();
    if (truncated && app && app.log) app.log("file.save", { warning: "more than 31 instruments; only the first 31 were exported" });
    const name = fileName(isXm ? "xm" : "mod");
    downloadBuffer(buffer, name);
    if (app && app.log) app.log("file.save", { name });
}

function instrumentBaseName(instrument, instrumentIndex) {
    const raw = (instrument && instrument.name) || `sample-${instrumentIndex}`;
    return raw.replace(/ /g, "-").replace(/\W/g, "") || `sample-${instrumentIndex}`;
}

/**
 * The sample-export capability (spec 064), ported from
 * script/src/ui/diskOp_Save.js's sample-export branch (82-131). Not wired to
 * any YAML/capabilities.js entry yet - see requirements.md's own recorded
 * decision; a later "save/export screen" spec is expected to call this.
 */
export async function exportSample(app, format) {
    const instrumentIndex = Tracker.getCurrentInstrumentIndex();
    const instrument = Tracker.getInstrument(instrumentIndex);
    if (!instrument) return;
    const baseName = instrumentBaseName(instrument, instrumentIndex);

    if (format === "xi") {
        const result = writeXI(instrumentIndex);
        if (!result) return;
        const name = `${baseName}.xi`;
        downloadBuffer(result.buffer, name);
        if (app && app.log) app.log("sample.export", { name, format });
        return;
    }

    const sample = instrument.sample;
    if (!sample || !sample.data) return;

    let result;
    let extension;
    if (format === "wav16") { result = writeWav(sample.data, 16); extension = "wav"; }
    else if (format === "raw8") { result = writeRaw(sample.data); extension = "sample"; }
    else { result = writeWav(sample.data, 8); extension = "wav"; } // "wav8", and the default

    const name = `${baseName}.${extension}`;
    downloadBuffer(result.buffer, name);
    if (app && app.log) app.log("sample.export", { name, format });
}
```

`fileName()` and the `Tracker` import are unchanged from spec 037/038; only `exportModule`'s own inline Blob/anchor block moves into `downloadBuffer()`, called identically from both capabilities.

## Data models

Nothing new - `writeXI` reads exactly the same `instrument.samples[]` shape `write()` already does; `writeWav`/`writeRaw` read a plain `{data: number[], bits}` sample, the same shape `domain/sampleEditor/processing.js` already operates on.

## Error handling

- **`writeXI` with no instrument at that index**: returns `null` (matches `write()`'s own `truncated`-style "nothing to report" contract loosely; `exportSample` checks for it and no-ops, matching v1's own `if (!instrument){ if (next) next(null); return; }`).
- **`exportSample` with no current sample/no data**: no-ops, matching v1's own `if (sample){ ... }` guard around the WAV/RAW branches (`diskOp_Save.js:99`).
- **An unrecognized `format`**: falls through to the `writeWav(..., 8)` branch, matching `diskOp_Save.js`'s own default-selected radio item ("wav 8 bit", `active:true`).

## Testing strategy

- **`tests/sampleExport.test.js`** (new):
  - `writeWav`: both bit depths, asserting every RIFF/fmt/data header field via a raw `DataView` over the returned buffer (not a decoder - the header itself is the thing under test) plus decoded-sample-data tolerance checks; the odd-length trailing pad byte.
  - `writeRaw`: buffer length equals `sampleData.length` exactly (the defect's own regression guard), decoded data within 8-bit rounding tolerance, first byte is real data, not a zero pad.
  - `writeXI`: against `sin.xm`'s real instrument 1 (volume envelope enabled, per `tests/envelopeController.test.js`'s own comment). A test-local `readXI(buffer)` function, hand-written from `script/src/fileformats/fasttracker.js#loadXI`'s own field order (existing v1 source, not invented), decodes the header and delta-encoded sample data back; asserted against the *source* instrument's own live fields directly (name, envelope points/count/sustain/loop, vibrato, fadeout, per-sample volume/finetuneX/panning/relativeNote/loop bounds/data), the same "assert against the real object, not a hardcoded expectation" shape `tests/moduleExport.test.js`'s own `xmInstrumentFacts` helper already uses.
  - `exportSample`: the same `document`/`URL.createObjectURL`/`URL.revokeObjectURL` stub `tests/moduleExport.test.js`'s own `exportModule` test already uses, one case per `format` value, asserting the logged `name`'s extension and that no exception is thrown when no instrument/sample exists.
- `node --test tests/*.test.js` passes; `node compiler/generate.js`/`node build.mjs app`/`dist` unaffected (no YAML/compiler/capabilities.js touched).

## What this deliberately does not do

See requirements.md's Scope boundaries: no playlist/MP3 export, no save/export screen, no Dropbox target, no `.xi` reader in production code (the test-local parser exists only to verify this spec's own writer).
