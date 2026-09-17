# 061 — Piano view (the interactive leaf)

Date: 2026-09-15. Kind: feature. Status: specified.

## Purpose

Gives spec 060's own headless preview engine its interactive front end: `pianoView`, the port's tenth specialized-component leaf, following the same "engine, then interactive leaf" split this port has used throughout (loop creator 043/044, multitrack 051/052, envelope 055/056). Click or drag across a virtual, tiled-octave keyboard and the current instrument sounds; the pressed key(s) highlight.

## What v1 actually does (read from source, not assumed - `script/src/ui/app/pianoView.js`, 252 lines, in full)

- Fixed-size white keys (`keyWidth: 64`, `keyOverlap: 4`, drawn `keyWidth - keyOverlap` apart so neighbors overlap by 4px), tiled left to right to fill the panel's own width - however many octaves fit, not a fixed count. Black keys layered on top at 5 of each octave's 7 white-key seams (`keyMapBlack`'s own `-1` entries mark the two seams with no black key, between E/F and B/C).
- `getKeyAtPoint(x, y)`: a two-region hit test. Below `bKeyHeight + keyTop` is white-key territory (`floor(x_within_octave / keySizeX)` selects which of the 7). Above it is black-key territory: the octave's own width is split into 13 sub-columns (`keySizeX/2` each); odd sub-columns are black keys (or fall through to the white key beneath them, at the two `-1` seams), even sub-columns are the white key beneath. Returns a 1-based, per-visible-key-tile-relative index (0 for a miss).
- `onDown`/`onDrag` (identical bodies): resolve the point to a key; if it differs from whichever key was previously held, note-off the previous one and note-on the new one - so dragging across the keyboard glissandos, never double-triggering the same key twice in a row. The combined index handed to `Input.handleNoteOn`/`handleNoteOff` is `key + currentOctave*12` - already in `resolveNote`'s own internal index space (spec 060's own reuse of `resolveNote` with `octave: 0` depends on this).
- `onTouchUp`: releases whichever key is currently held.
- An octave `SpinBox` (range depends on tracker format: PT 1-3, FT 0-7 - already exactly `domain/song#getCurrentOctave`/`setCurrentOctave`'s own clamp, spec 031) and a close button (`COMMAND.togglePiano` - spec 062's concern, not this one's).
- Rendering highlights whichever keys are currently down (`EVENT.pianoNoteOn`/`pianoNoteOff`), using the same combined index format.

## Decisions and assumptions

- **`renderers/canvas/pianoGeometry.js`** (new, pure): the hit test and the per-key rect list for drawing, ported exactly - fixed pixel constants, no skin-driven sizing (matching every specialized leaf so far).
- **`runtime/pianoController.js`** (new): pointerdown/drag/pointerup, calling `domain/playback#previewNoteOn`/`previewNoteOff` directly (no `capabilities.js` mapping - the same self-contained shape `scopesController`/`multitrackController`'s own note-drag already have) and reading `domain/song#getCurrentOctave()`/`inFTMode()` fresh on every event (v1's own `octave` is a synced local copy of the same state; v2 has no need for a second copy - always reading the single source of truth is simpler and cannot drift).
- **The octave spinbox and close button are not this spec's concern** - screen wiring, spec 062. This spec's own component is the key grid alone (`pianoView`), matching how `envelopeView`/`multitrackView` were each built and left unplaced before their own screens arrived.
- **No dynamic width-driven octave count in the geometry itself** - `keyRectsFor` takes the node's own real rect (however wide the screen made it) and tiles as many octaves as fit, exactly like v1's own `while (keyX < me.width)` loop. No change needed for this port's own generic `width: fill` layout.

## User stories and acceptance

- **PIANO-001 — Hit-testing matches v1's own two-region math** for both white- and black-key territory, including the two no-black-key seams (octave-relative index 2, 6) falling through to the white key beneath, and a miss (`y < 0`) returning 0.
- **PIANO-002 — Click plays; drag glissandos; release stops.** A `pointerdown` on a key calls `previewNoteOn` with the correct combined index; a `drag` to a different key calls `previewNoteOff` on the old one and `previewNoteOn` on the new one; a `pointerup` calls `previewNoteOff` on whichever is held.
- **PIANO-003 — No double-trigger.** A `drag` event that resolves to the *same* key already held is a no-op (matches v1's own `key !== prevDown` guard).
- **PIANO-004 — Rendering highlights exactly the keys `isPreviewNoteActive` reports**, using the same combined-index format the controller computes.
- **PIANO-005 — Disabled leaf ignores pointer input entirely**, the same contract every other specialized leaf's controller already has.

## Non-functional requirements

- Headless verification only (`computeGenericLayout`/hand-built `input`/`rect` objects, no browser).

## Scope boundaries

In scope: `pianoGeometry.js`, `pianoController.js`, the `pianoView` component type/draw kind, and their own tests.

Out of scope, recorded rather than dropped: the octave spinbox, the close button, and screen placement (`piano.active`-gated panel) - spec 062. Recording notes into the pattern from a piano click (spec 060's own recorded exclusion, unchanged here).
