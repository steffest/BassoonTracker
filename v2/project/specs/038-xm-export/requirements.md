# 038 — XM export

Date: 2026-09-13. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 037 (module export: MOD). Closes the one gap spec 037 deliberately left open: exporting while `Tracker.inFTMode()` is true.

## Purpose

Spec 037 shipped MOD export and made XM mode a clean, logged no-op rather than a silently-wrong `.mod` file - deliberately, since `FastTracker().write()` is roughly twice `ProTracker().write()`'s own size and touches instrument envelopes, vibrato and delta-encoded multi-sample data the MOD writer never has to. Having read `script/src/fileformats/fasttracker.js#write` in full for this spec (311-553, beyond the `writeXI`-only reading spec 037's own research pass did), this spec ports it, completing module export for both formats v2 already loads.

## What v1 actually does (read from source, not assumed)

- **`FastTracker().write(next)`** (`fasttracker.js:311-553`) writes: a 60-byte identifier/title/tracker-name block (`"Extended Module: "` + 20-byte title + `0x1A` + `"BassoonTracker " + version` + a fixed minor/major format version `4.1`, not the running application's own version - `window.versionNumber` has no v2 equivalent, so this reads `"dev"`, exactly as `writeXI` already does for the same field, per spec 037's own research); a 276-byte header (song length, a **hardcoded restart position of 0** - v1 never round-trips whatever it loaded, a faithful simplification, not a bug to fix; channel count; pattern/instrument counts; the linear-frequency flag; the *current* tempo/BPM); a fixed 256-byte pattern table (always all 256 slots, even past the song's own length); then, per pattern, a 9-byte header (packing type always `0` - XM's "uncompressed" mode, never producing the bit-packed short form the loader already parses) followed by one uncompressed 5-byte quintuple (`index`/`instrument`/`volumeEffect`/`effect`/`param`) per note; then, per instrument slot, either a 29-byte "empty instrument" header (no samples) or a 243-byte instrument header (name, sample count, volume/panning envelope points/counts/types, vibrato, fadeout) followed by one 40-byte sample header and its own delta-encoded PCM data per sample (`delta = current - previous`, 8- or 16-bit, matching what the already-ported loader's own running accumulator undoes).
- **Little-endian**, unlike MOD: `new BinaryStream(arrayBuffer, false)` (`bigEndian: false`) - the entire opposite byte order from `protracker.js#write`'s own `true`. `domain/moduleExport/binaryWriter.js` (spec 037) only ever wrote big-endian, since MOD was its only consumer; this is a real, load-bearing difference to get right, not a detail to gloss over.
- **Two fields the write path needs that the ported, playback-only engine never exposed**: the song's current tempo (`Tracker.getBPM()`) and speed (`Tracker.getAmigaSpeed()`). Both getters exist in `script/src/tracker.js` (one line each, reading a private `bpm`/`ticksPerStep` variable `player/src/tracker.js` already tracks internally for its own scheduling) but were never part of the playback-only subset spec 012 ported, since nothing in playback ever needed to read them back out. Confirmed by grepping `domain/playback/engine/tracker.js` for both names before writing this spec, not assumed.
- **`writeXI`'s own instrument/sample-writing block (`fasttracker.js:680-809`, already read for spec 037's research) is a near-duplicate of `write()`'s own** - same envelope/vibrato fields, same 40-byte sample header, same delta-encoding loop, hand-copied rather than shared in v1. Recorded again here as a real, pre-existing v1 duplication a v2 port can avoid without inventing anything v1 doesn't already do twice.

## Decisions and assumptions

- **`domain/moduleExport/binaryWriter.js` gains a `littleEndian` mode**, not a second writer module. v1's own `BinaryStream` already has exactly this as a one-flag choice at construction (`bigEndian`); `createBinaryWriter(arrayBuffer, false)` is the same flag, not a new concept, and `protracker.js`'s own existing call (`createBinaryWriter(new ArrayBuffer(fileSize))`, implicitly big-endian) is unchanged.
- **Two small, additive getters land on the ported `Tracker`**: `getBPM`/`getAmigaSpeed`, ported verbatim from `script/src/tracker.js`'s own one-line implementations. This is not a fourth *divergence* (`domain/playback/README.md`'s own count is about behavior that differs from `player/src`; nothing here changes what already exists) - it is a small, honestly-recorded addition of read access to state the engine already privately tracks, for a new consumer. Recorded in `domain/playback/README.md` rather than silently added.
- **The instrument/sample-writing block is factored into one shared internal function**, `writeInstrumentSamples()` in `domain/moduleExport/fasttracker.js`, rather than hand-duplicated the way v1's own `write`/`writeXI` are. Nothing outside this spec calls it yet (a later sample-export spec, porting `writeXI` itself, is the second, real caller) - it is not exported, so this stays an internal tidiness improvement, not new public API surface built ahead of a need.
- **`exportModule` (spec 037) branches on format instead of stopping at XM.** `domain/moduleExport/index.js#exportModule` calls the MOD writer when `!Tracker.inFTMode()` and the XM writer when it is, exactly mirroring `Editor.buildBinary`'s own `type` branch - the capability's own shape does not change, only what it dispatches to.
- **Tempo/speed are written as read, never recomputed.** `Tracker.getBPM()`/`getAmigaSpeed()` return whatever the song's *current* playback state holds (which may differ from the *loaded* module's own original header value, if the user has changed tempo since loading) - matching v1's own `write()` exactly, which reads the same live getters, not a stored "original" value.

## User stories and acceptance

- **XM-001 — XM export re-serializes the loaded song exactly.** `domain/moduleExport/fasttracker.js#write(Tracker)` produces bytes that `domain/playback/engine/fileformats/fasttracker.js`'s own **read** function (via `Tracker.processFile`, the same real read path every other test in this suite already uses) loads back, reporting the same title, channel count, instrument count/names, per-instrument envelope points/counts/sustain/loop settings and vibrato, per-sample metadata (volume, finetune, loop points, relative note, panning) and pattern data (note index/instrument/volume-effect/effect/param) as the original. Acceptance: a round-trip unit test against a real XM fixture.
- **XM-002 — Little-endian, verified independently of the round trip.** `binaryWriter.test.js` gains cases proving `createBinaryWriter(buffer, false)` writes the opposite byte order from the default, so a round trip that happened to work for other reasons cannot hide a byte-order mistake.
- **XM-003 — `exportModule` now handles both formats.** Loading a `.mod` still exports via the MOD writer (spec 037, unchanged); loading a `.xm` now exports via the XM writer instead of logging a "not supported" no-op. Acceptance: `tests/moduleExport.test.js`'s own XM-mode test is replaced with one asserting a real export happens, matching the MOD test's own shape.
- **XM-004 — No regressions.** Full unit suite passes; `node build.mjs app`/`dist` succeed; MOD export (spec 037) is unaffected.

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No YAML/compiler/capabilities.js change - `file.save` already dispatches to `exportModule`; this spec only extends what that function does internally.

## Scope boundaries

In scope: `domain/moduleExport/fasttracker.js`, `domain/moduleExport/binaryWriter.js`'s little-endian mode, `domain/playback/engine/tracker.js`'s two new getters, `domain/moduleExport/index.js`'s format branch, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **`writeXI` (sample/instrument export)** - shares real logic with this spec's own `writeInstrumentSamples()` helper, deliberately factored so a later spec can reuse it; not implemented here.
- **Sample export (WAV/RAW), playlist export, MP3 export, a save/export screen** - unchanged from spec 037's own scope boundaries.
- **XM's own bit-packed ("compressed") pattern encoding on write** - v1 never produces it either (`packingType` is always `0`); not invented here.
- **Pingpong loops** - v1's own `write()` carries a `// TODO` at exactly this point (unrolled instead, matching how the engine already handles them elsewhere); not solved by this port.
