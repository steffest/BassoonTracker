# 061 — Design

## Overview

```
renderers/canvas/pianoGeometry.js (new, pure)
  KEY_WIDTH=64, KEY_OVERLAP=4, KEY_SIZE_X=60, KEY_TOP=30, BLACK_KEY_WIDTH=48
  WHITE_KEY_OFFSETS=[0,2,4,5,7,9,11], BLACK_KEY_OFFSETS (14 entries, odd=black/-1=seam)
  keyAtPoint(local, rect) -> widget-relative key (0 = miss)
  keyRectsFor(rect, baseOctave) -> { white: [...], black: [...] }, each { index, left, top, width, height }
    where index is already the combined index (matches previewNoteOn/Off's own space)

runtime/pianoController.js (new)
  createPianoController(options) - pointerdown/drag/pointerup
  combinedIndexAt(input) = keyAtPoint(...) + song.getCurrentOctave()*12
  pressAt(input): resolves index; no-op if 0 or === heldKey; else previewNoteOff(heldKey), previewNoteOn(index)
  release(): previewNoteOff(heldKey) if held

runtime/componentTypes.js: pianoView type (behavior "piano", draw "pianoView")
runtime/behaviors.js: piano -> createPianoController
renderers/canvas/drawKinds.js: pianoView entry (white keys, black keys, highlight via isPreviewNoteActive)
```

No YAML/`capabilities.js` - not yet placed (spec 062's own).

## Verified geometry (empirical, `node -e` before writing tests)

`rect = {width:500, height:150}`, `baseOctave: 2`:
- `keyRectsFor` produces 9 white keys, 6 black keys; `white[0].index === 25`, `black[0].index === 26`.
- `keyAtPoint` at the center of `white[0]`'s own rect returns `1`; `1 + baseOctave*12 === 25`, matching `white[0].index` exactly.
- `keyAtPoint` at the center of `black[0]`'s own rect returns `2`; `2 + baseOctave*12 === 26`, matching `black[0].index`.
- `keyAtPoint({x:10, y:-5}, rect)` (a miss, `y < 0`) returns `0`.

## Testing strategy

- **`tests/pianoGeometry.test.js`** (new): the white/black hit-test regions (including the two no-black-key seams falling through to the white key beneath), the miss case, and `keyRectsFor`'s own tiling/index math against the hand-verified values above.
- **`tests/pianoController.test.js`** (new, mocking `domain/playback`'s `previewNoteOn`/`previewNoteOff`/`isPreviewNoteActive` is unnecessary - call the real functions against a loaded fixture, the same way `tests/scopesController.test.js` calls the real `domain/arrangement`): pointerdown plays; drag to a different key note-offs the old and note-ons the new; drag to the *same* key is a no-op (PIANO-003); pointerup releases; disabled ignores all pointer input.
- **`tests/pianoView.test.js`** (new, mirrors `tests/scopesView.test.js`/`envelopeView.test.js`'s own draw-kind-through-`computeGenericLayout`-or-direct-call convention): a held key (via the real `previewNoteOn`) draws with the "active" fill; an unheld one does not.
- `node --test tests/*.test.js` passes. `node compiler/generate.js`/`node build.mjs app`: unaffected (no YAML touched).
