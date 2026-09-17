# 060 — Design

## Overview

```
domain/playback/index.js
  + import { resolveNote } from "../song/keyboardNotes.js"
  + import NOTEPERIOD alongside the existing EVENT/SETTINGS import from ./engine/enum.js
  + let activeKeys = new Map()   // piano key index -> played note handle
  + previewNoteOn(index)
  + previewNoteOff(index)
  + isPreviewNoteActive(index)
```

No YAML, no `capabilities.js` - headless, like specs 051/055.

## `previewNoteOn`/`previewNoteOff`/`isPreviewNoteActive`

```js
let activeKeys = new Map(); // spec 060

export function previewNoteOn(index, app) {
    if (activeKeys.has(index)) return false;
    ensureEngine(app);
    const note = resolveNote(index, 0, Tracker.inFTMode(), { notePeriod: NOTEPERIOD, ftNotes: FTNotes });
    if (!note) return false;
    const instrument = Tracker.getCurrentInstrument();
    if (!instrument) return false;
    if (note.index) {
        instrument.setSampleForNoteIndex(note.index);
        if (instrument.sample.relativeNote) {
            note.index += instrument.sample.relativeNote;
            const ftNote = FTNotes[note.index];
            if (ftNote) note.period = ftNote.period;
        }
    }
    Audio.checkState();
    const played = instrument.play(note.index, note.period, undefined, undefined, undefined);
    played.instrument = instrument;
    played.isKey = true; // instrument.noteOff's own non-FT branch no-ops without this - instrument.js:123
    activeKeys.set(index, played);
    return true;
}

export function previewNoteOff(index) {
    const played = activeKeys.get(index);
    if (played) {
        try {
            if (played.instrument) played.instrument.noteOff(context.currentTime, played);
            else if (played.source) played.source.stop();
        } catch {
            /* matches input.js#handleNoteOff's own empty catch */
        }
    }
    activeKeys.delete(index);
    return Boolean(played);
}

export function isPreviewNoteActive(index) {
    return activeKeys.has(index);
}
```

`ensureEngine(app)` (this module's own private helper, already used by `transportToggle`/`openFiles`/`loadModule`) is forwarded `previewNoteOn`'s own optional, trailing `app` - a real controller call site never supplies one (`previewNoteOn(index)`), and `ensureEngine(undefined)` already handles that (`app && app.audioContext ? app.audioContext : new Ctor()`), falling back to a real `new AudioContext()` exactly as production wants. Tests supply a fake `app` (`{ audioContext: <silent context> }`) so `ensureEngine` bootstraps against the same stub the rest of the suite uses, the same shape `tests/playback.test.js`'s own `loadModule` test already relies on.

`resolveNote(index, 0, ...)`: `keyboardNotes.js`'s own `resolveNote` computes `const index = offset === 0 ? 0 : octave * 12 + offset;` - with `octave: 0` this reduces to `index === offset` for every `offset >= 1` (and trivially for `offset === 0` too, the OFF override, which the piano's own key layout never produces - see requirements.md). So the piano's own combined index (spec 061) can be passed as `resolveNote`'s first argument unchanged.

## Testing strategy

`tests/piano.test.js` (new): `createEngine(createSilentContext({ recordAutomation: true }))`, load a real fixture (`sin.xm`, already used by `tests/envelope.test.js`/`tests/song.test.js` for its multi-sample FT instruments), select a real instrument, then:

- PREVIEW-001: a plausible key index plays (`context.started` gains a `bufferSource` entry); returns `true`.
- PREVIEW-002: a second call for the same still-sounding index returns `false`, `context.started` unchanged.
- PREVIEW-003: `previewNoteOff` schedules a ramp-to-zero on the note's own volume gain (found in `context.automation`); a subsequent `previewNoteOn` for the same index plays again (a second `started` entry).
- PREVIEW-004: no current instrument (a slot known to be blank) - `previewNoteOn` returns `false`, `context.started` unchanged.
- PREVIEW-005: `isPreviewNoteActive` true only while sounding.
- PREVIEW-006: no bundled fixture happens to ship a nonzero `relativeNote` (confirmed by inspecting every instrument/sample in all three fixtures), so the test hand-sets `instrument.samples[0].relativeNote = 12` on `sin.xm`'s own real, loaded instrument 1 (still real engine data, only the one field seeded, the same "hand-built instrument-shaped" precedent `tests/envelope.test.js`'s own header already documents). Confirmed empirically that `instrument.play`'s own `getPeriodForNote` (not `FTNotes[index].period` directly, and not whatever `previewNoteOn` passes as its own `notePeriod` argument - both are overwritten for FT-mode instruments, `instrument.js:27-30`) is what actually determines the played pitch, from the *shifted* `noteIndex` - so the right assertion compares relative results rather than reproducing that internal formula: playing key 37 with `relativeNote: 12` produces the exact same `source.playbackRate.value` as playing key 49 with `relativeNote: 0` (both resolve to the same internal noteIndex, 49) - and a different value than key 37 with `relativeNote: 0` (proving the shift is real, not coincidentally equal).

`node --test tests/*.test.js` passes; `node compiler/generate.js`/`node build.mjs app` unaffected (no YAML touched).
