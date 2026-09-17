# 037 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Read `editor.js`'s `buildBinary`/`save`, `protracker.js#write`, `fasttracker.js`'s `write`/`writeXI`, `riffWave.js`, `playlist.js`, and `filesystem.js`'s full `BinaryStream` in full before scoping (a dedicated research pass), rather than trusting the roadmap's own "XI, WAV, playlists, container formats" framing.
- [x] `domain/moduleExport/binaryWriter.js` (new, pure): a write-only, big-endian binary cursor.
- [x] `domain/moduleExport/protracker.js` (new): `write()` - the MOD writer.
- [x] `domain/moduleExport/index.js` (new): `exportModule(app)` - the capability.
- [x] `domain/moduleExport/README.md` (new): boundary, provenance, scope.
- [x] `domain/playback/README.md`: recorded the second documented exception (alongside `domain/song`'s).
- [x] `compiler/recipes.js`: `save` added to the `verb-action` recipe's verb list.
- [x] `capabilities.js`: `file.save` mapped.
- [x] `tests/binaryWriter.test.js` (new, 7 cases).
- [x] `tests/moduleExport.test.js` (new, 3 cases: full round-trip against a real fixture, >31-instrument truncation, XM-mode no-op).
- [x] `tests/recipes.test.js` (extended): `save`/`file.save` added to the existing one-shot-verb case table.
- [x] `tests/domainBoundary.test.js` (extended): the engine-import exception list now covers `domain/moduleExport/{index,protracker}.js`, and that folder is walked like `domain/song`'s own.
- [x] `node compiler/generate.js`: `saveFile`'s own `unresolved-action-reference` warning is gone (27 → 26).
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`: succeeds; `saveFile` leaves `app/LOOSE-ENDS.md`'s unresolved-action-reference list (79 → 78); the generated `app/actions/fileSave.js` imports `domain/moduleExport/index.js#exportModule`, confirmed by reading it directly.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019). The actual browser download trigger (`URL.createObjectURL`/`<a download>`) is never exercised - `write()`'s own pure byte production is what the round-trip test verifies, by loading the written bytes back through the real, already-tested read path (`Tracker.processFile`) rather than asserting on raw bytes directly.

## Evidence

`node --test tests/*.test.js`: 505 tests, all passing, up from 495 (7 new in `tests/binaryWriter.test.js`, 3 new in `tests/moduleExport.test.js`, 1 case added to an existing `tests/recipes.test.js` table).

`node compiler/generate.js`: 26 warnings, down from 27 - `saveFile` no longer unresolved. `node build.mjs app`: succeeds, exit 0; `app/LOOSE-ENDS.md` 79 → 78 items. `node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch every spec since 019 has recorded, unrelated to this work.

## Found while doing it

- **The roadmap's own framing of "the format write path" did not survive contact with the source.** P9's design sketch names "XI, WAV, the playlist formats, and the container formats" as if MOD/XM export were somehow already out of scope; reading `editor.js` found the opposite - `Editor.save`/`buildBinary` is a real, fully-working, currently-unaddressed feature, and the single most direct thing to check "exports are readable by v1" against. Scoped this spec to it for exactly that reason, recording the correction in requirements.md rather than silently reordering the roadmap's own words.
- **"The container formats" (the sketch's own phrase) turned out to have no write-side referent at all** - `zip`/`gzip` in v1 are exclusively used to open an archive on load, confirmed by reading `fileformats/detect.js` and `tracker.js`'s own `processFile`. Recorded as a correction, not carried forward into a future spec's scope by mistake.
- **A second, dead MP3 code path** (`editor.js#renderToMp3`, dynamically importing `lamejs` from a CDN) exists alongside the real, already-documented `BassoonProvider.renderFile` path - unreachable from any authored screen, and contradicts the port's own no-CDN rule outright. Recorded so a later MP3-export spec does not mistake it for a second thing to port.
- **Everything the writer itself needed was already present in the ported engine** - confirmed by grepping `domain/playback/engine/tracker.js`/`models/instrument.js` for every method `protracker.js#write()` calls (`getSong`, `getInstruments`, `getTrackCount`, `getPatternLength`, `inFTMode`, `setSampleIndex`) before writing a line of the port, rather than discovering a gap mid-implementation. One initial false alarm (a mistyped grep made `setSampleIndex` look absent) was caught by a byte-for-byte diff against `player/src/models/instrument.js` before it became a real blocker.
- **The round-trip test is stronger evidence than a byte-for-byte comparison against v1's own output would have been**: rather than asserting on raw exported bytes (fragile, and not actually what "readable by v1" means), it loads the *written* bytes back through the real, already-tested read path (`Tracker.processFile`) and compares the resulting in-memory song to the original - title, instrument metadata, the pattern table, and every pattern cell's instrument/period/effect/param, all exactly, on the first real fixture tried.

## Known limits

XM export, sample export (WAV/RAW/XI), playlist export, MP3 export, and a save/export screen all remain out of scope - see requirements.md. No browser verification occurred in this environment (the same recorded gap every spec since 019 has left); the actual `Blob`/`URL.createObjectURL`/`<a download>` trigger in `exportModule` has never been exercised outside a real browser.
