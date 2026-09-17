# 038 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Read `script/src/fileformats/fasttracker.js#write` (311-553) in full before writing anything, beyond the `writeXI`-only reading spec 037's own research pass did.
- [x] `domain/moduleExport/binaryWriter.js`: `createBinaryWriter(arrayBuffer, bigEndian = true)`, `littleEndian` threaded into `writeUint`/`writeWord`; `writeLong`/`writeDWord` aliases added (matching v1's own `readLong = readDWord = readUint` convention - a real gap found only when `fasttracker.js` tried to call `writeDWord` and it did not exist).
- [x] `domain/playback/engine/tracker.js`: `getBPM()`, `getAmigaSpeed()` (additive, not a divergence); `domain/playback/README.md` updated.
- [x] `domain/moduleExport/fasttracker.js` (new): `write()`, with a shared internal `writeInstrumentSamples()` helper (not exported - a later sample-export spec's own real second caller).
- [x] `domain/moduleExport/index.js`: branches on `Tracker.inFTMode()` between the MOD and XM writers; `fileName()` now takes the real format's own extension (a small, deliberate fix to v1's own hardcoded-`.mod` fallback bug).
- [x] `domain/moduleExport/README.md`: updated for the second writer.
- [x] `tests/binaryWriter.test.js` (extended, +1): little-endian byte order, proven independently of the round trip.
- [x] `tests/moduleExport.test.js` (extended): a full XM round trip against a real fixture (`sin.xm`); the old "no-op in FT mode" test replaced with one asserting `exportModule` actually dispatches to the XM writer and produces a `.xm`-named download.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/capabilities.js change; loose ends unchanged at 78).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019). The XM round trip is the load-bearing test: written bytes reloaded through the real, already-tested XM read path (`Tracker.processFile`), not a raw-byte comparison. `exportModule`'s own dispatch test is the first in this suite to reach all the way through the DOM-touching download trigger, stubbed minimally (`document.createElement`, `URL.createObjectURL`/`revokeObjectURL`) rather than skipped.

## Evidence

`node --test tests/*.test.js`: 507 tests, all passing, up from 505 (1 new in `tests/binaryWriter.test.js`; `tests/moduleExport.test.js`'s own XM-mode test replaced with two: a full round trip, and `exportModule`'s own dispatch/extension-naming behavior).

`node build.mjs app`: succeeds, exit 0. Loose ends unchanged at 78 (no YAML/capabilities.js touched - `file.save` already dispatched here since spec 037). `node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch every spec since 019 has recorded, unrelated to this work.

## Found while doing it

- **`writeDWord`/`writeLong` were missing from `binaryWriter.js` entirely** - `protracker.js` (spec 037) only ever calls `writeUint` directly, so the gap stayed invisible until `fasttracker.js` (which, like v1's own source, calls `writeDWord` throughout) hit it immediately as a real `TypeError`. Fixed by adding the same alias v1's own `BinaryStream` already has for reads (`readLong = readDWord = readUint`), mirrored for writes - not a new concept, a missed one.
- **v1's own `getFileName()` has a real, easily-avoidable defect**: it hardcodes a `.mod` extension for the no-filename fallback regardless of format, so a brand-new XM song saved before ever being given a name would download as `"<title>.mod"` despite being XM content. Fixed here (the fallback now takes the real format's own extension) - the same kind of call spec 034 made fixing `hippo.js`'s own crash, not a behavior worth preserving.
- **The `numberOfSamples` mutation in v1's own `write()`** (`instrument.numberOfSamples = instrument.samples.length`) turned out to be dead weight once confirmed nothing else reads it back - grepped the whole engine before deciding, rather than assuming a "found while doing it" write-up needed to reproduce every side effect a mechanical port might carry over.
- **Everything else matched design.md going in**: the shared `writeInstrumentSamples()` helper needed no revision once the exact field order was copied from the already-read `writeXI` (spec 037's research) and confirmed identical to `write()`'s own inline version; the round trip passed on the first real fixture tried, with no byte-order or field-order surprises.

## Known limits

`writeXI` (sample/instrument export), pingpong loops, and XM's own bit-packed pattern encoding remain out of scope - see requirements.md. No browser verification occurred in this environment (the same recorded gap every spec since 019 has left); the actual `Blob`/`URL.createObjectURL`/`<a download>` trigger has only ever been exercised against a minimal Node-side stub, not a real browser.
