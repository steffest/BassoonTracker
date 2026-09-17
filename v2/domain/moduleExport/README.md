# Module export capability

Saving a MOD/XM module or the current instrument's sample, readable by v1. Specs [037](../../project/specs/037-module-export/requirements.md) (MOD), [038](../../project/specs/038-xm-export/requirements.md) (XM) and [064](../../project/specs/064-sample-export/requirements.md) (sample: WAV/RAW/XI), continuing package **P9** (persistence, providers, file operations) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md), following spec 036 (the disk-operation screen).

```
binaryWriter.js   a write-only binary cursor (new v2 code)
protracker.js     write() - the MOD writer, ported from script/src/fileformats/protracker.js
fasttracker.js    write() - the XM writer; writeXI() - the XI (instrument) writer;
                  both ported from script/src/fileformats/fasttracker.js
sample.js         writeWav(), writeRaw() - the current instrument's sample as a
                  standalone WAV or RAW file, ported from script/src/audio/riffWave.js
                  and script/src/ui/diskOp_Save.js's own inline RAW branch
index.js          the capabilities: exportModule(app) (wired to the File menu's "Save"),
                  exportSample(app, format) and exportSampleSelection(app) (the
                  save/export screen's own format-selection wrapper, spec 067),
                  dispatching to whichever writer matches the format requested
```

## The boundary

Only `index.js` may be imported from outside this folder. `index.js`, `protracker.js` and `fasttracker.js` all import `Tracker` directly from `domain/playback/engine/tracker.js` - a second documented exception to that folder's own "index.js only" rule, alongside `domain/song/index.js`'s (see `domain/playback/README.md`): the exported bytes have to come from the exact song/instrument objects the engine holds, not a copy. `sample.js` is the one exception to the exception: a sample encoder has nothing to do with a whole module, so it takes plain `{data, bits}` in rather than reading `Tracker` itself - `index.js#exportSample` is what reads `Tracker` and hands it the sample.

## Provenance

`protracker.js#write` is ported from `script/src/fileformats/protracker.js:204-328`, byte-for-byte the same output shape (title, 31 fixed-size instrument headers, song length/restart byte/pattern table, format magic, packed pattern data, raw 8-bit sample data). `fasttracker.js#write` is ported from `script/src/fileformats/fasttracker.js:311-553` (title/header block, a fixed 256-slot pattern table, uncompressed per-note quintuples, per-instrument envelope/vibrato blocks, per-sample delta-encoded PCM) - little-endian, unlike MOD, and reading two getters (`Tracker.getBPM()`/`getAmigaSpeed()`) spec 038 added to the ported engine for exactly this (see `domain/playback/README.md`'s own note: additive, not a divergence). Its own instrument/sample-writing block is one shared internal function, `writeInstrumentSamples()`, rather than v1's own two hand-duplicated copies (`write`/`writeXI`) - `fasttracker.js#writeXI` (spec 064) is that second, real caller, confirmed byte-for-byte identical to `write()`'s own usage by diffing both v1 blocks side by side; it only writes its own fixed 298-byte instrument header before delegating.

`sample.js#writeWav` is ported from `script/src/audio/riffWave.js#encodeRIFFsample` (mono, a hardcoded 8000Hz - an in-memory sample carries no rate of its own, matching v1's own comment). `sample.js#writeRaw` is ported from `script/src/ui/diskOp_Save.js`'s inline RAW 8-bit branch (101-113) with one real, confirmed defect fixed rather than preserved: v1's own version writes two leading zero bytes and silently drops the sample's own last two data points; `writeRaw` writes every sample point, none dropped, no leading pad (spec 064's requirements.md records the full finding).

`binaryWriter.js` is new v2 code, not a divergence of `domain/playback/engine/filesystem.js`'s read-only port: `player/src` never wrote anything, so there was nothing there to diverge from. `createBinaryWriter(arrayBuffer, bigEndian = true)` - the same one-flag choice v1's own `BinaryStream` constructor already has; MOD's own writer relies on the default, XM/XI/WAV/RAW all pass `false`.

## What this deliberately does not do

- **MP3/WAV whole-song render** - permanently out of scope, per the user's own direction (2026-09-15), superseding the port roadmap's own open decision 5 (which had reversed a prior "dropped" call to "a vendored encoder is accepted"); see the roadmap's own open decision 8. v1's own module-save panel offers this under "wav"/"mp3" options that look adjacent to `exportSample` but are not - `diskOp_Save.js`'s own handler calls `BassoonProvider.renderFile(...)`, an offline render of the *entire song's audio*, never built and now never to be (spec 067's own research found this while scoping the save/export screen).
- **XM's own bit-packed ("compressed") pattern encoding, and pingpong loops** - v1's own writer never produces the former and unrolls the latter (a `// TODO` in v1's own source); neither is solved here.
- **Dropbox as a save target** - permanently out of scope, per the user's own direction (2026-09-15); see the roadmap's own open decision 9. The browser's own download (`Blob`/`URL.createObjectURL`/a synthetic `<a>` click) is the only target this folder will ever have.
- **Reading a `.xi` file back into v2** - not in this port's scope (v2 loads `.mod`/`.xm` only); spec 064's own test verifies `writeXI` with a test-local parser, not production code.

Playlist export (PLS/M3U/JSON) lives in `domain/playlist/`, not here (spec 065); a save/export screen (spec 067, `components/fileOperationsPanel.yaml`'s own Load/Save toggle) now reaches `exportModule`, `exportSample` and `exportPlaylist` alike.
