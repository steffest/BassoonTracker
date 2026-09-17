# 051 — Tasks

Status: done.

- [x] Read `multitrack.js` (803 lines), `dawtrack.js` (449 lines), `trackControl.js` (115 lines) in full before scoping.
- [x] `domain/song/index.js`: `getInstrumentAt`, `moveNote`, `getRawNoteName` (found necessary at implementation time - see "Found while doing it").
- [x] `domain/playback/index.js`: `getFineTuneForNote`, `getFineTuneForPeriod`, `getFtNotePeriod` (found necessary at implementation time - see below), `usesLinearFrequency`, `getTickTiming`, `emulatesProtracker1OffsetBug`, `setTrackVolumes`.
- [x] `domain/playback/engine/audio.js`: `me.setTrackVolumes` (one additive function).
- [x] `domain/arrangement/index.js` (new). No `README.md` - `domain/nibbles/` (spec 047) established that not every domain folder needs one; this module's own header comment carries the provenance/boundary note instead.
- [x] `tests/song.test.js`, `tests/playback.test.js` (extended); `tests/arrangement.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no YAML/`capabilities.js` change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - unit tests against real fixtures for the segmentation math (including two real fixtures, `.mod` and `.xm`, mirroring spec 050's own precedent), and against the real engine's own `FilterChain` objects for the mute/solo volume effect (a `.volumeValue()` read-back, not a fake).

## Evidence

- `node compiler/generate.js`: 16 warnings, 0 errors - unchanged, this spec authors no YAML. `node build.mjs app`: loose ends unchanged at 88.
- `tests/song.test.js`: 4 new tests (31 total, up from 27) - `getInstrumentAt`, `getRawNoteName`'s own index-before-period priority, `moveNote`'s move+undo+redo and its empty-source no-op.
- `tests/playback.test.js`: 4 new tests (19 total, up from 15) - the four small forwards (verified against the real engine's own `Audio` methods directly, not re-derived by hand), `getFtNotePeriod`'s real/out-of-range branches, format-dependent `usesLinearFrequency`/`getTickTiming`/`emulatesProtracker1OffsetBug`, and `setTrackVolumes`'s all four volume combinations read back from the real, live `FilterChain`s a loaded fixture already constructed.
- `tests/arrangement.test.js`: 12 new tests - block boundaries and sticky-instrument carry-forward, an out-of-range pattern/empty track, `0C` and FastTracker volume-column overrides (against `wizballalt.mod` and `sin.xm` respectively - ARR-001's own two-fixture requirement), effect flattening, the sample-length cap and its cross-note accumulation (ARR-001), an enabled loop never being capped, `moveNote` forwarding, and the full mute/solo interaction table including the preserved quirk (ARR-004/005/006).
- Full suite: `node --test tests/*.test.js` -> 748/748 passing (728 before this spec + 20 new).

## Found while doing it

- **`getNoteName`'s placeholder question (design.md's own open item) resolved by reading `multitrack.js:749-754` directly**: it returns `""` for an unnamed cell, never `formatNoteName`'s own `"---"`/`"???"` placeholders - ported as `domain/song/index.js#getRawNoteName`, a new sibling to `formatNoteName` rather than a variant of it, since the two also differ in a second, more surprising way (next finding).
- **A real, confirmed v1 quirk found while writing `getRawNoteName`'s own test, not assumed from reading the source alone**: `_getNoteName` checks `note.index` before `note.period`, *unconditionally of tracker mode* - unlike `formatNoteName`, which branches on `Tracker.inFTMode()` first. Because `Note#setPeriod` always back-fills `note.index` too (`FTPeriods[period]`), a ProTracker note's own arrangement-view label is actually resolved through the FT note table, not the period table, even though the same note's classic-grid label goes through the period table instead - two real, different display paths for the same cell, both faithfully ported, neither "fixed" to agree with the other. The test's own first draft assumed the two functions would agree and failed (`'C-5' !== 'C-3'`) before this was traced.
- **A real, confirmed compiler-adjacent lesson from hand-deriving expected values, not a code bug**: `getFineTuneForPeriod(period, finetune)` performs a real table lookup (`periodNoteTable[period].tune[8+finetune]`) even when `finetune === 0`, which can shift the period by a fraction and therefore the resulting sample-rate/step-count - a hand-traced "finetune 0 changes nothing" assumption in the sample-length-cap test's own first draft was off by one step because of this, fixed by computing the test's own expected values through the same already-independently-tested `getFineTuneForPeriod`/`getSampleRateForPeriod`/`getTickTiming` forwards `getPerTrackBlocks` itself composes, rather than re-deriving the arithmetic by hand a second time.
- **One more small, additive `domain/playback/index.js` forward found necessary partway through implementation, not anticipated in design.md**: `getFtNotePeriod(noteIndex)`, a guarded `FTNotes[noteIndex]` lookup - `instrument.getPeriodForNote()` (an existing, already-ported instrument method) looked at first like it could replace the whole FT-mode period branch outright, but it has no existence guard of its own and would throw on an out-of-range note index the way v1's own `_getSampleLengthInSteps` explicitly guards against; reimplementing the guarded version directly needed this one extra forward instead.
- **All of wizballalt.mod's own 31 instruments loop**, and `sin.xm`'s one instrument does too - neither fixture has a naturally non-looping sample to test the length-cap branch against. Rather than adding a new fixture, the cap test temporarily disables a real instrument's own loop and replaces its sample data with a larger synthetic array (both mutations are process-local and invisible to later tests, since `beforeEach` reloads the fixture from scratch every time - confirmed by checking `Tracker.processFile` constructs new instrument objects on every call, the same guarantee `tests/playback.test.js`'s own "loading a second module replaces the first" test already established).
- **Test isolation gap found while writing the first `getPerTrackBlocks` test**: `wizballalt.mod` is real music - every track already carries real notes throughout pattern 0, so a test that only *adds* notes at chosen rows does not get the block count it expects (5 blocks, not the 3 intended). Fixed by clearing the track first (`domain/song#clearTrack`) in every test that counts or indexes blocks by position, not just the ones that seemed likely to collide.

## Known limits

Same as requirements.md's own Scope boundaries: no interactive leaf (`multitrackView`), no live oscilloscope, no waveform thumbnails, no per-track control-strip drawing, no classic-grid mute/solo header, no screen wiring. No browser verification occurred in this environment.
