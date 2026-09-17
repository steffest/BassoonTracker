# 051 — Design

## Overview

```
domain/song/index.js (extended)
  getInstrumentAt(index) -> Tracker.getInstrument(index)
  moveNote(srcTrack, srcStep, dstTrack, dstStep) -> {moved: boolean}

domain/playback/index.js (extended)
  getFineTuneForNote(noteIndex, finetune)
  getFineTuneForPeriod(period, finetune)
  usesLinearFrequency()
  getTickTiming() -> {ticksPerStep, tickTime}
  emulatesProtracker1OffsetBug()
  setTrackVolumes(muteFlags, soloFlags)   // delegates to engine/audio.js's new me.setTrackVolumes

domain/playback/engine/audio.js (one additive function)
  me.setTrackVolumes = function(muteFlags, soloFlags) { ... }   // parameterized port of updateTrackVolumes()

domain/arrangement/index.js (new)
  getPerTrackBlocks(pattern) -> [[{startStep,endStep,instrument,name,volume}, ...], ...]
  getPerTrackEffects(pattern) -> [[{step,effect,param}, ...], ...]
  moveNote(srcTrack, srcStep, dstTrack, dstStep) -> forwards to song.moveNote
  setTrackMute(track, muted) / setTrackSolo(track, soloed)
  toggleTrackMute(track) / toggleTrackSolo(track)
  getTrackMuteSolo(track) -> {mute, solo}
```

## `domain/song/index.js` additions

```js
/** Spec 051: an arbitrary instrument by index, not only the current one - domain/arrangement's own block segmentation needs a row's own instrument, whichever one that is. */
export function getInstrumentAt(index) {
    return Tracker.getInstrument(index);
}

/**
 * Ported from multitrack.js#_moveNote (587-623). One undo/redo step covering
 * both cells, the same noteAction()/addDiff() shape every other mutation
 * here already uses - just two diffs instead of one, at two different
 * positions, which applyPatternDiff already replays correctly (it iterates
 * action.data, keyed by its own {track, row}).
 */
export function moveNote(srcTrack, srcStep, dstTrack, dstStep) {
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const srcNote = patternData[srcStep] && patternData[srcStep][srcTrack];
    if (!srcNote || (!srcNote.period && !srcNote.index)) return { moved: false };

    const action = scopedAction(EDITACTION.NOTE, pattern, "Move Note");
    const dstRow = patternData[dstStep] || (patternData[dstStep] = []);
    const dstNote = dstRow[dstTrack] || new Note();
    dstRow[dstTrack] = dstNote;

    const srcDiff = addDiff(action, srcTrack, srcStep, srcNote);
    const dstDiff = addDiff(action, dstTrack, dstStep, dstNote);

    const srcData = duplicateNote(srcNote);
    populateNote(dstNote, srcData);
    srcNote.clear();

    srcDiff.to = duplicateNote(srcNote);
    dstDiff.to = duplicateNote(dstNote);
    history.registerEdit(action);

    setCurrentTrack(dstTrack);
    setCurrentPatternPos(dstStep);
    return { moved: true };
}
```

`EDITACTION.NOTE` (not a new `MOVE` kind) since `CELL_DIFF_KINDS` in `editHistory.js` already replays any of `NOTE`/`RANGE`/`TRACK`/`PATTERN` identically (a plain list of position diffs) - no editHistory.js change needed at all.

## `domain/playback/index.js` additions

```js
export function getFineTuneForNote(noteIndex, finetune) {
    return Audio.getFineTuneForNote(noteIndex, finetune);
}
export function getFineTuneForPeriod(period, finetune) {
    return Audio.getFineTuneForPeriod(period, finetune);
}
export function usesLinearFrequency() {
    return Tracker.useLinearFrequency;
}
export function getTickTiming() {
    const props = Tracker.getProperties();
    return { ticksPerStep: props.ticksPerStep, tickTime: props.tickTime };
}
export function emulatesProtracker1OffsetBug() {
    return SETTINGS.emulateProtracker1OffsetBug;
}
export function setTrackVolumes(muteFlags, soloFlags) {
    Audio.setTrackVolumes(muteFlags, soloFlags);
}
```

`SETTINGS` becomes a new import from `./engine/enum.js` in this file only (`domain/playback/index.js` already imports from `./engine/*` throughout - this is not a new exception, just a new named import from a module already crossed).

## `domain/playback/engine/audio.js` addition

```js
// Spec 051: a parameterized port of the module's own former inline
// updateTrackVolumes() logic (v1's audio.js:182-201) - v2 never ported the
// EVENT.trackStateChange listener that used to drive it (nothing triggered
// it before this spec), and domain/arrangement is now the single owner of
// mute/solo bookkeeping, so this takes the two flag arrays as parameters
// instead of reading module-private trackMuteState/trackSoloState arrays
// this file never had reason to keep.
me.setTrackVolumes = function(muteFlags, soloFlags) {
    var count = filterChains.length;
    var anySolo = false;
    for (var i = 0; i < count; i++) if (soloFlags[i]) anySolo = true;

    for (var j = 0; j < count; j++) {
        if (filterChains[j]) {
            var vol;
            if (anySolo) vol = (soloFlags[j] && !muteFlags[j]) ? 70 : 0;
            else vol = muteFlags[j] ? 0 : 70;
            filterChains[j].volumeValue(vol);
        }
    }
};
```

Added next to `me.setStereoSeparation` (an existing function of the same "iterate `filterChains`" shape), inside the same IIFE closure - no new export from the file, since `me` is already what `Audio` (the module's default export) is.

## `domain/arrangement/index.js`

```js
import * as song from "../song/index.js";
import { getFineTuneForNote, getFineTuneForPeriod, getSampleRateForPeriod, usesLinearFrequency, getTickTiming, emulatesProtracker1OffsetBug, setTrackVolumes } from "../playback/index.js";

const trackMute = [];
const trackSolo = [];

function applyVolumes() {
    setTrackVolumes(trackMute, trackSolo);
}

export function getTrackMuteSolo(track) {
    return { mute: !!trackMute[track], solo: !!trackSolo[track] };
}

/** Ported from dawtrack.js's muteButton.onClick (138-144) - no wasSolo cascade, matching v1's own quirk (requirements.md ARR-006). */
export function setTrackMute(track, muted) {
    trackMute[track] = !!muted;
    if (trackMute[track]) trackSolo[track] = false;
    applyVolumes();
}

/** Ported from dawtrack.js's soloButton.onClick (130-137) + the shared trackStateChange handler's own solo/wasSolo cascade (audio.js:149-163). */
export function setTrackSolo(track, soloed) {
    const wasSolo = !!trackSolo[track];
    trackSolo[track] = !!soloed;
    if (trackSolo[track]) trackMute[track] = false;

    const trackCount = song.getTrackCount();
    if (trackSolo[track]) {
        for (let i = 0; i < trackCount; i++) {
            if (i !== track) { trackMute[i] = true; trackSolo[i] = false; }
        }
    } else if (wasSolo) {
        for (let i = 0; i < trackCount; i++) {
            if (i !== track) { trackMute[i] = false; trackSolo[i] = false; }
        }
    }
    applyVolumes();
}

export function toggleTrackMute(track) {
    setTrackMute(track, !trackMute[track]);
    return !!trackMute[track];
}

export function toggleTrackSolo(track) {
    setTrackSolo(track, !trackSolo[track]);
    return !!trackSolo[track];
}

export function moveNote(srcTrack, srcStep, dstTrack, dstStep) {
    return song.moveNote(srcTrack, srcStep, dstTrack, dstStep);
}

/** Ported from multitrack.js#_getNoteName (749-754). */
export function getNoteName(note) {
    if (!note) return "";
    /* FT: FTNotes[note.index]; PT: periodNoteTable[note.period] - through song.formatNoteName's own table access is display-only and returns "---"/"???" placeholders this needs to suppress instead (v1 returns "" for no name, not a placeholder) - reimplemented directly against the two tables via one new domain/song forward, getRawNoteName(note), rather than reusing formatNoteName's placeholder-producing behavior. */
}

/** Ported from multitrack.js#_buildPerTrackBlocks (639-729) + #_getSampleLengthInSteps (756-802). */
export function getPerTrackBlocks(pattern) {
    // walks song.getPattern(pattern) once per track; see full listing at
    // implementation time - the v1 algorithm above is followed exactly,
    // substituting: Tracker.getInstrument -> song.getInstrumentAt,
    // Tracker.inFTMode() -> song.inFTMode(), Tracker.useLinearFrequency ->
    // usesLinearFrequency(), Audio.getFineTuneFor{Note,Period} -> the two
    // forwards above, Audio.getSampleRateForPeriod -> getSampleRateForPeriod
    // (already existed, spec 046), Tracker.getProperties() -> getTickTiming(),
    // SETTINGS.emulateProtracker1OffsetBug -> emulatesProtracker1OffsetBug().
}

export function getPerTrackEffects(pattern) {
    // walks song.getPattern(pattern) once per track; direct, no engine math.
}
```

`getNoteName`'s exact placeholder question (`""` vs `"---"`/`"???"`) is resolved empirically at implementation time by reading `multitrack.js:749-754` byte-for-byte, not guessed here; whichever shape it needs, it stays a pure function over the two note tables, reached only through one new thin `domain/song` forward (`getRawNoteName`) if `formatNoteName`'s own placeholder behavior turns out unsuitable, since `domain/arrangement` may not import `domain/playback/engine/` directly either.

## Data models

Per-track block: `{startStep, endStep, instrument, name, volume}` - `volume` is 0-100, matching v1's own scale exactly (not the note model's own 0-64 range). Per-track effect: `{step, effect, param}`. Neither is published to `app.state` - like `domain/nibbles`'s own internal game state, these are read directly by a future controller/draw kind, never through a bound `field` (no screen exists yet to bind one).

`trackMute`/`trackSolo` are plain sparse arrays indexed by track number, growing lazily (`array[track] = value`) - no `trackCountChange` handling needed, unlike v1's own pre-sized arrays, since a lazily-grown array has no fixed length to keep in sync.

## Error handling

- **`moveNote` from an empty source cell**: returns `{moved: false}`, registers nothing - matches v1's own guard (`if (!srcNote || (!srcNote.period && !srcNote.index)) return;`).
- **`getPerTrackBlocks`/`getPerTrackEffects` with no loaded pattern**: `song.getPattern(pattern)` returns `undefined` for an out-of-range index the same way `Tracker.getSong().patterns[index]` already does; both functions return `[]` immediately, matching v1's own `if (!patternData) return [];` guard in both source functions.
- **`setTrackSolo`/`setTrackMute` for a track index beyond the current track count**: harmless - the sparse arrays simply grow; `applyVolumes()`'s own loop is bounded by `filterChains.length` (the real engine's own track count) in `engine/audio.js#setTrackVolumes`, so an out-of-range flag is stored but never read back into an audible effect until a real track exists at that index.

## Testing strategy

- **`tests/song.test.js`** (extended): `getInstrumentAt` against a real fixture; `moveNote` - move, undo, redo (both cells restored exactly), and the empty-source no-op.
- **`tests/playback.test.js`** (extended): the five new forwards, each against a real fixture and a hand-computed expected value (`getFineTuneForNote`/`getFineTuneForPeriod` against a known note/finetune pair already used elsewhere in this port's own fixtures; `usesLinearFrequency`/`emulatesProtracker1OffsetBug` for both a `.mod` and a `.xm` fixture; `getTickTiming` against the fixture's own known tempo).
- **`tests/playbackAudio.test.js`** or an extension of an existing engine-level test (confirmed at implementation time against what already exists): `setTrackVolumes` against a fake `FilterChain`-shaped array (an object exposing only `volumeValue(v)`, recording calls) - all four combinations from `updateTrackVolumes()`'s own two branches (no solo anywhere / this track soloed / another track soloed / this track muted while soloed elsewhere).
- **`tests/arrangement.test.js`** (new): `getPerTrackBlocks`/`getPerTrackEffects` against `wizballalt.mod` (ProTracker) and a real `.xm` fixture (FastTracker), covering sticky-instrument carry-forward, volume-column/`0C` overrides in both modes, sample-offset carry-forward under the offset-bug emulation, and a sample-length cap only when the sample has no enabled loop (ARR-001/002); `setTrackMute`/`setTrackSolo`/`toggleTrackMute`/`toggleTrackSolo`'s own interaction table (ARR-004), including the two-tracks-solo-in-sequence case and the preserved mute-while-soloed quirk (ARR-006); `moveNote` forwarding correctly to `song.moveNote`.
- `node --test tests/*.test.js` passes. This spec touches no YAML/`capabilities.js`, so `node compiler/generate.js`/`node build.mjs app` are confirmed unaffected by an unchanged run, the same precedent specs 039/040/043/047 already established.

## What this deliberately does not do

See requirements.md's Scope boundaries: no interactive leaf (`multitrackView`), no live oscilloscope, no waveform thumbnails, no per-track control-strip drawing, no classic-grid mute/solo header, no screen wiring.
