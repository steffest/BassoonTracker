# 060 — Piano preview (the live-audio note-preview engine)

Date: 2026-09-15. Kind: feature. Status: specified. Opens the piano arc, P11's own last remaining surface - deliberately deferred across specs 051-059 because, unlike every other surface this package built, it needs a mechanism this port has never built at all: triggering a real, audible note from a click rather than from the sequencer's own scheduler.

## Purpose

`pianoView.js` (v1) is a virtual keyboard: click or drag across it and the current instrument sounds, at the clicked note, live - independent of whether the song is playing. Nothing in v2 does this yet. `domain/song`'s own keyboard note entry (spec 031) resolves a note and *records* it into the pattern; it never plays anything. This spec builds the missing half: given a key index, resolve the note and actually sound it, using machinery (`instrument.play`/`instrument.noteOff`) that was ported wholesale with the rest of the sequencer but has sat unused until now.

## What v1 actually does (read from source, not assumed)

**`script/src/ui/input.js#handleNoteOn`/`handleNoteOff` (734-907)**, the shared handler for both real keyboard typing and piano clicks/drags:

- Resolves `index` (already `key + octave*12` combined - see design.md) to a note the same way `domain/song/keyboardNotes.js#resolveNote` already does (that module was ported from this exact algorithm, spec 031).
- When recording, has a second branch that writes into the pattern instead of/as well as playing (`Editor.putNote`/`putNoteParam`) - **out of scope here**, see Decisions.
- When `doPlay && note`: looks up the current instrument; if it has multiple samples, `setSampleForNoteIndex` picks the right one for this note and, if that sample has its own `relativeNote` transpose, re-resolves the period from `FTNotes` at the shifted index. Then `Audio.checkState()` (resumes a suspended context) and `instrument.play(note.index, note.period, volume, track, effects)`. The returned handle is tagged `.instrument` and **`.isKey = true`** - the latter matters: `instrument.noteOff`'s own non-FT branch silently no-ops unless `isKey` is set (`noteInfo.isKey && noteInfo.volume`, `instrument.js:123-127`), a real, easy-to-miss requirement, confirmed by reading `noteOff`'s own body, not assumed. Stored per-key (`keyDown[index]`) so a second note-on for an already-sounding key is a no-op, and so note-off can find it again.
- `handleNoteOff`: unless `SETTINGS.sustainKeyboardNotes` (v1's own default `false`, `script/src/enum.js:515`, never exposed as a UI toggle in v1 either - **not modeled here**, see Decisions), stops the note (`instrument.noteOff(context.currentTime, keyDown[index])`, or `.source.stop()` if there is no `.instrument`) and clears the per-key slot. A trailing MIDI-registration side effect (`register && ...`) only ever fires for real MIDI input, never for a mouse/touch-driven piano click - **out of scope**, moot for this surface.

## Decisions and assumptions

- **Recording is out of scope.** `handleNoteOn`'s record branch (`Editor.putNote`/`putNoteParam`) is a second, independent feature of the same v1 function. v2's own real keyboard note entry (`runtime/gridController.js`, spec 031) already records without ever previewing audio - an existing, already-accepted asymmetry. This spec closes the reverse gap for the piano (preview without recording) rather than building a third, combined mechanism neither existing surface needs yet. Recorded as a real, freely-buildable follow-up if ever wanted, not silently dropped.
- **No sustain toggle.** `SETTINGS.sustainKeyboardNotes` is `false` in v1 and was never a user-facing option there either - this spec always stops a note on release, unconditionally.
- **Reuses `domain/song/keyboardNotes.js#resolveNote` directly, with `octave: 0`.** The piano's own key index (built in spec 061) is already fully combined (`key + widgetOctave*12 + currentOctave*12`, ported from `pianoView.js#getKeyAtPoint`/`onDown`) - i.e. already in `resolveNote`'s own internal `index` variable's space, not its `offset` parameter's space. `resolveNote(offset, octave, ftMode, tables)` computes `index = octave*12 + offset` (except the `offset === 0` OFF override) - passing `octave: 0` makes `index === offset` exactly, reproducing the same math with no double-count and no change to `keyboardNotes.js` itself. Confirmed empirically not needed beyond re-reading the existing function - the arithmetic is exact for any `offset >= 1`, which is all the piano's own key layout ever produces (it has no OFF key).
- **Lives in `domain/playback/index.js`**, not `domain/song`: this is audio-side-effect work (`Audio.checkState`, `instrument.play`/`noteOff`), the same class of capability `transportToggle`/`openFiles` already are, not document mutation. `domain/song/keyboardNotes.js#resolveNote` is imported directly - it is already documented as a pure, dependency-free module reusable from anywhere (`keyboardNotes.js`'s own header comment), so this is not a boundary violation the way importing `domain/song/index.js` itself would be.
- **`app` is optional and trailing, used only to bootstrap the audio context.** Every other controller-invoked domain call in this port (`arrangement.toggleTrackMute(index)`, spec 058) takes no `app`/host context - controllers are never handed one (confirmed: `mountGeneric.js` threads no `app` into any controller). `previewNoteOn(index, app)` still needs *some* way to reach `ensureEngine`'s lazy audio-context bootstrap (the same one `transportToggle`/`openFiles` use) the first time it is ever called, possibly before the song was ever played - so `app` is accepted as a second, optional argument, forwarded only to `ensureEngine`. A real controller call site never supplies it (`previewNoteOn(index)`; `ensureEngine(undefined)` falls back to a plain `new AudioContext()`, exactly the production behavior wanted); tests supply a fake `app` carrying `domain/playback/silentContext.js`'s stub, the same shape `loadModule`'s own existing tests already use (`tests/playback.test.js`'s "retries a network-level fetch failure" test).
- **Per-key dedup and bookkeeping is a private `Map`** (piano key index -> the played note handle), mirroring v1's own `keyDown[]` array exactly: a second `previewNoteOn` for an already-sounding key is a no-op (matches v1's `if (keyDown[index]) return;`).

## User stories and acceptance

- **PREVIEW-001 — Playing a resolvable note.** Given a loaded song with a real instrument selected, `previewNoteOn(index)` for a key that resolves to a real note plays it (asserted via the silent context's own `started`/`automation` recording - `context.started` gains an entry) and returns `true`.
- **PREVIEW-002 — Dedup.** A second `previewNoteOn` for the same still-sounding index is a no-op, returns `false`, and does not start a second sound.
- **PREVIEW-003 — Note-off silences it.** `previewNoteOff(index)` for a sounding key silences it (a `linearRampToValueAtTime(0, ...)` on the note's own volume gain, confirmed via recorded automation) and frees the slot, so a subsequent `previewNoteOn` for the same index plays again.
- **PREVIEW-004 — No instrument, no note.** With no current instrument (or a slot with no note-worthy resolution, e.g. an out-of-range index), `previewNoteOn` is a no-op, returns `false`, starts nothing.
- **PREVIEW-005 — `isPreviewNoteActive`** reports exactly the keys with an active, unreleased preview, for spec 061's own key-highlight rendering.
- **PREVIEW-006 — FastTracker relative-note transpose.** For an instrument whose selected sample has a nonzero `relativeNote`, the period actually played reflects `FTNotes` at the shifted index, not the original - ported from `handleNoteOn`'s own re-resolution, confirmed against a real multi-sample FT fixture rather than assumed.

## Non-functional requirements

- Headless verification only, against `domain/playback/silentContext.js` (no browser audio in this environment, the same recorded reason every spec since 019 has given).

## Scope boundaries

In scope: `domain/playback/index.js`'s three new exports (`previewNoteOn`, `previewNoteOff`, `isPreviewNoteActive`) and their own tests.

Out of scope, recorded rather than silently dropped:

- Recording via piano clicks (see Decisions).
- The piano's own interactive leaf (key hit-testing/drawing/drag) - spec 061.
- Screen placement (the toggle panel, close button, octave spinbox) - spec 062.
- Wiring this same mechanism into real QWERTY keyboard entry (`runtime/gridController.js`) - a real, pre-existing, already-accepted gap this spec does not extend to.
