# 064 — Tasks

Status: done.

- [x] Read `script/src/ui/diskOp_Save.js` in full, `script/src/fileformats/fasttracker.js#writeXI` (already read for spec 038) and `script/src/audio/riffWave.js` in full before designing.
- [x] `domain/moduleExport/fasttracker.js`: `writeXI(instrumentIndex)`, reusing the existing `writeInstrumentSamples()` helper.
- [x] `domain/moduleExport/sample.js` (new): `writeWav(sampleData, bits)`, `writeRaw(sampleData)` (the RAW defect fixed, not ported).
- [x] `domain/moduleExport/index.js`: `exportSample(app, format)`; `downloadBuffer()` factored out of `exportModule` and shared.
- [x] `tests/sampleExport.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`: 12 warnings, unchanged.
- [x] `node build.mjs app`/`dist`: unaffected (88 loose ends, unchanged; no YAML/compiler/capabilities.js touched).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no UI exists yet to reach this capability - matching spec 037/038's own initial slices and every "engine first" spec since 039). `writeWav`/`writeRaw` are exercised against small, hand-picked arrays (not a real fixture) since the RIFF header fields and the RAW defect both need exact, hand-checkable byte offsets a real sample's own arbitrary data would obscure. `writeXI` is exercised against the real `sin.xm` fixture's own instrument 1 (a real, enabled volume envelope, per `tests/envelopeController.test.js`'s own established convention), decoded back with a test-local parser mirroring `fasttracker.js#loadXI` field-for-field, since v2's ported engine has no XI reader of its own (out of scope, see requirements.md) to round-trip through the real read path the way specs 037/038 could. `exportSample` reuses `tests/moduleExport.test.js`'s own `document`/`URL` stub convention.

## Evidence

- `tests/sampleExport.test.js`: 7/7 passing - `writeWav` at both bit depths (every RIFF/fmt/data header field asserted via a raw `DataView`, decoded sample data within each depth's own rounding tolerance, the odd-length trailing pad byte); `writeRaw` (exact length, no leading pad, decodable data - the regression guard for the found-and-fixed defect); `writeXI`'s full round trip (name, sample count, both envelopes' points/count/sustain/loop/enabled flags, vibrato, fadeout, and every per-sample volume/finetuneX/panning/relativeNote/loop-bounds/bits/length/data field, asserted against the source instrument's own live fields) plus its `null`-for-missing-instrument guard; `exportSample` dispatching all four formats to the right extension and no-oping with no current instrument.
- Full suite: `node --test tests/*.test.js` → 908/908 passing (901 before this spec + 7).
- `node compiler/generate.js`: 12 warnings, unchanged (no YAML touched).
- `node build.mjs app`: 88 loose ends, unchanged (no YAML/compiler/capabilities.js touched - this spec is headless, matching spec 037/038's own initial slices). `node build.mjs dist` succeeds.
- `node --check` passed on both new/touched source files and the new test file before the suite ran.

## Found while doing it

- **A genuine, confirmed defect in v1's own RAW 8-bit sample export**, not a stylistic quirk: `diskOp_Save.js`'s inline RAW branch (101-113) allocates `sample.length` bytes, writes two zero bytes first (`file.clear(2)`), then writes only `sample.length - 2` data bytes - a file of the promised length that starts with two spurious zero bytes and silently drops the sample's own last two data points. Traced the loop bounds and the preceding `clear(2)` together to confirm this is not an intentional word-alignment adjustment (the comment above it describes a rationale the code does not actually implement). Fixed rather than ported, per requirements.md's own recorded bar for this kind of finding (matching spec 034/037/040/043's own precedent).
- **`writeXI`'s own per-sample header/data block really is byte-for-byte identical to `write()`'s own `writeInstrumentSamples()` helper** (spec 038's own prediction, confirmed here rather than assumed) - `writeXI` needed nothing beyond its own 298-byte outer header before delegating straight to the existing, unexported helper, with zero new per-sample logic.
- **No authored YAML anywhere references sample export** - confirmed by running `node compiler/generate.js` before writing this spec's own requirements.md, not assumed from reading `capabilities.js` alone; this is the reason `exportSample` stays unwired here, the same "mechanism first" split used repeatedly across P9/P10/P11.

## Known limits

No save/export screen, no playlist/MP3 export, no Dropbox target, no `.xi` reader in production code - see requirements.md's Scope boundaries. Nothing here is reachable from any UI yet - headless only. No browser verification occurred in this environment.
