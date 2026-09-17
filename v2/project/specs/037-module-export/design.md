# 037 — Design

## Overview

```
domain/moduleExport/binaryWriter.js   a new, write-only BinaryStream (new v2 code)
domain/moduleExport/protracker.js     write(Tracker) -> ArrayBuffer, ported from
                                       script/src/fileformats/protracker.js#write
domain/moduleExport/index.js          exportModule(app) - the capability
domain/moduleExport/README.md

compiler/recipes.js    "save" added to the verb-action recipe's verb list
capabilities.js        "file.save" -> domain/moduleExport/index.js#exportModule
```

## `domain/moduleExport/binaryWriter.js`

Ported from `script/src/filesystem.js:57-218`, write-side only - the read half stays exactly where it already is (`domain/playback/engine/filesystem.js`), unduplicated, since export never reads.

```js
export function createBinaryWriter(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    const length = arrayBuffer.byteLength;
    let index = 0;

    function setIndex(value) {
        if (value === undefined) return;
        index = Math.min(Math.max(value, 0), length - 1);
    }

    return {
        get index() { return index; },
        get buffer() { return arrayBuffer; },
        goto(value) { setIndex(value); },
        jump(value) { setIndex(index + value); },
        writeByte(value, position) { setIndex(position); dataView.setInt8(index, value); index++; },
        writeUByte(value, position) { setIndex(position); dataView.setUint8(index, value); index++; },
        writeUint(value, position) { setIndex(position); dataView.setUint32(index, value, false); index += 4; },
        writeWord(value, position) { setIndex(position); dataView.setUint16(index, value, false); index += 2; },
        writeString(value, position) {
            setIndex(position);
            for (let i = 0; i < value.length; i++) dataView.setUint8(index + i, value.charCodeAt(i));
            index += value.length;
        },
        fill(value, count) { for (let i = 0; i < count; i++) this.writeByte(value || 0); },
        clear(count) { this.fill(0, count); },
        writeStringSection(value, max, padValue, position) {
            setIndex(position);
            max = max || 1;
            value = (value || "").substr(0, max);
            this.writeString(value);
            this.fill(padValue || 0, max - value.length);
        }
    };
}
```

`writeUint`/`writeWord` are big-endian (`false` for `DataView`'s own `littleEndian` argument), matching `protracker.js`'s own `new BinaryStream(arrayBuffer, true)` call (`true` there means `bigEndian`, per that constructor's own `littleEndian = !bigEndian` inversion) - MOD's own multi-byte fields are big-endian, unlike XI/XM's little-endian ones (`riffWave.js`/`fasttracker.js` both construct with `false`). A later spec porting those needs a little-endian writer too; not invented ahead of that need here (`writeLong`/`writeDWord` aliases and a `bigEndian` constructor flag are exactly the kind of generality with one caller this project's conventions avoid adding early).

## `domain/moduleExport/protracker.js`

```js
// Ported from script/src/fileformats/protracker.js#write (204-328). Reads
// domain/playback/engine's own live Tracker singleton directly - the second
// documented exception to that folder's own "index.js only" rule, alongside
// domain/song/index.js's (see domain/playback/README.md).

import Tracker from "../playback/engine/tracker.js";
import { createBinaryWriter } from "./binaryWriter.js";

const MAX_INSTRUMENTS = 31;

export function write() {
    const song = Tracker.getSong();
    const instruments = Tracker.getInstruments();
    const trackCount = Tracker.getTrackCount();
    const patternLength = Tracker.getPatternLength();

    let highestPattern = 0;
    for (let i = 0; i < 128; i++) highestPattern = Math.max(highestPattern, song.patternTable[i] || 0);

    let fileSize = 20 + 31 * 30 + 1 + 1 + 128 + 4 + (highestPattern + 1) * trackCount * 256;
    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument) fileSize += Math.min(instrument.sample.length, 131070);
    }

    const truncated = instruments.length - 1 > MAX_INSTRUMENTS; // slot 0 is unused, matching v1
    const file = createBinaryWriter(new ArrayBuffer(fileSize));

    file.writeStringSection(song.title, 20);
    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument) {
            instrument.setSampleIndex(0);
            instrument.sample.length = Math.min(instrument.sample.length, 131070);
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
    file.writeUByte(127);
    for (let i = 0; i < 128; i++) file.writeUByte(song.patternTable[i] || 0);
    file.writeString(trackCount === 8 ? "8CHN" : "M.K.");

    for (let i = 0; i <= highestPattern; i++) {
        const patternData = song.patterns[i];
        for (let step = 0; step < patternLength; step++) {
            const row = patternData[step];
            for (let channel = 0; channel < trackCount; channel++) {
                const cell = row && row[channel];
                if (!cell) { file.writeUint(0); continue; }
                let uIndex = 0, lIndex = cell.instrument;
                if (lIndex > 15) { uIndex = 16; lIndex = cell.instrument - 16; }
                file.writeUint((uIndex << 24) + (cell.period << 16) + (lIndex << 12) + (cell.effect << 8) + cell.param);
            }
        }
    }

    for (let i = 1; i <= MAX_INSTRUMENTS; i++) {
        const instrument = instruments[i];
        if (instrument && instrument.sample.data && instrument.sample.length) {
            for (let j = 0; j < instrument.sample.length; j++) {
                file.writeByte(Math.round((instrument.sample.data[j] || 0) * 127));
            }
        }
    }

    return { buffer: file.buffer, truncated };
}
```

`truncated` is returned rather than shown in a dialog (no such surface exists here); `domain/moduleExport/index.js` logs it instead. Every read (`Tracker.getSong()`, `.getInstruments()`, `.getTrackCount()`, `.getPatternLength()`, `instrument.setSampleIndex(0)`, `instrument.sample.*`) is a method the ported engine (spec 012) already has, confirmed by reading `domain/playback/engine/tracker.js`/`models/instrument.js` before writing this, not assumed.

## `domain/moduleExport/index.js`

```js
import Tracker from "../playback/engine/tracker.js";
import { write } from "./protracker.js";

function fileName() {
    const song = Tracker.getSong();
    if (!song) return "new.mod";
    return song.filename || (song.title ? song.title.replace(/ /g, "-").replace(/\W/g, "") + ".mod" : "new.mod");
}

export async function exportModule(app) {
    if (Tracker.inFTMode()) {
        if (app && app.log) app.log("file.save", { error: "XM export is not supported yet" });
        return;
    }
    const { buffer, truncated } = write();
    if (truncated && app && app.log) app.log("file.save", { warning: "more than 31 instruments; only the first 31 were exported" });

    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(url);
    if (app && app.log) app.log("file.save", { name: a.download });
}
```

The download trigger is plain browser API (`Blob`/`URL.createObjectURL`/a synthetic `<a>` click), the same shape `script/src/filesystem.js#saveFile` already is - not v1-specific logic to port, so it is written directly rather than wrapped in a ported-and-diverged function.

## `compiler/recipes.js`

```js
code: "verb-action",
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
```

`actionNameAsProse("saveFile")` → `"save file"` → verb `"save"`, subject `"file"` → command `"file.save"`, `mockField: null` (a one-shot action, nothing to cycle) - exactly the shape `capabilities.js` maps below. No other recipe changes; every existing verb-action command (`track.clear`, `pattern.copy`, ...) is unaffected, confirmed by the existing `compiler.test.js` suite passing unchanged.

## `capabilities.js`

```js
"file.save": { module: "./domain/moduleExport/index.js", export: "exportModule" }
```

## Data models

None new - `ArrayBuffer`/`Blob`, and the existing `song`/`instrument` shapes `domain/playback/engine/` already defines.

## Error handling

- **XM mode**: EXPORT-004, a clean no-op with a log line, not a wrong file.
- **More than 31 instrument slots**: EXPORT-002, truncates and logs, matching v1's own truncation (minus its dialog).
- **No song loaded** (`Tracker.getSong()` is falsy): `fileName()` falls back to `"new.mod"`; `write()` itself is not reachable in practice with no song (nothing dispatches `file.save` before a module is loaded, matching every other capability's own assumption that its command is only ever reachable after the relevant state exists) - not specially guarded beyond `fileName()`'s own fallback.

## Testing strategy

- **`tests/moduleExport.test.js`** (new): the full round trip (EXPORT-001) - load a real fixture via `Tracker.processFile`, call `write()`, then `Tracker.processFile()` the *written* bytes back and compare title/instrument fields/pattern data/song length between the two in-memory songs; the >31-instrument truncation (EXPORT-002, a hand-built or trimmed fixture); the XM-mode no-op (EXPORT-004, a fake `app.log` asserting the message and that no bytes were produced).
- **`tests/binaryWriter.test.js`** (new, pure): each write method against a small buffer, byte for byte (a `DataView` read-back), including `writeStringSection`'s own truncate-and-pad behavior and the big-endian byte order MOD needs.
- **`compiler/recipes.js`'s existing test file** (extended): `interpretAction("save file")` resolves to `{command: "file.save", mockField: null}`; every existing verb-action case still resolves unchanged.
- `node compiler/generate.js`: `saveFile`'s own `unresolved-action-reference` warning is gone. `node --test tests/*.test.js` passes. `node build.mjs app`/`dist` succeed; `saveFile` leaves `app/LOOSE-ENDS.md`'s unresolved-action-reference list, and its own generated `app/actions/saveFile.js` (or whatever name the emitter derives) imports `domain/moduleExport/index.js#exportModule`.

## What this deliberately does not do

See requirements.md's Scope boundaries: no XM export, no sample export, no playlist export, no MP3 export, no save/export screen, no Dropbox/local save target.
