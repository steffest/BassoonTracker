# 055 — Tasks

Status: done.

- [x] Read `envelope.js` (239 lines) and `envelopePanel.js` (258 lines) in full before scoping; confirmed the envelope data model is already fully ported (`domain/playback/engine/models/instrument.js`, `engine/fileformats/fasttracker.js#processEnvelope`).
- [x] `domain/sampleEditor/envelope.js` (new): `getEnvelope`, `setPoint`, `addPoint`, `removePoint`, `setEnabled`, `setSustain`, `setSustainPoint`, `setLoop`, `setLoopStart`, `setLoopEnd`.
- [x] `tests/envelope.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (no YAML/`capabilities.js` change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - unit tests against a real loaded `.xm` fixture for the parts that need real envelope data, and hand-built instrument-shaped objects for the rest.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - unchanged. `node build.mjs app`: loose ends unchanged at 87.
- `tests/envelope.test.js`: 16 new tests - `getEnvelope`'s three shapes (no instrument, a fresh never-parsed envelope, a real `.xm`'s own real envelope with sustain and no loop); `setPoint`'s clamp for the first/a middle/the last point, and its out-of-range no-op; `addPoint`'s append/reuse/no-reposition/edge-of-canvas branches and its disabled-envelope no-op; `removePoint`'s floor-of-2 and its own re-clamp; the shared re-clamp exercised directly through `setSustainPoint`/`setLoopStart`/`setLoopEnd` too; the three plain toggles' own no-side-effect guarantee.
- Full suite: `node --test tests/*.test.js` -> 813/813 passing (797 before this spec + 16 new).

## Found while doing it

- **Two of the test suite's own first-draft expectations were wrong, caught immediately by running them, not by misreading the source**: a "clamped at the previous point's own x" case passed `x=10` against a `minX` of `0` - which is *above* the floor, so nothing should clamp at all (fixed by passing a genuinely out-of-range `x=-10` instead); and a "reused point gets repositioned" case expected the reused point's own `y` to reset to `32` the way a *brand-new* point's does - re-reading `envelopePanel.js:47-50` shows the reuse branch only ever reassigns `nextPoint[0]` (`x`), never touching `y` at all, so the fixture's own reused point kept its original `y` after being moved (fixed the test's own expected value, not the ported code).
- **`Tracker.getCurrentInstrument()` for the unused instrument slot 0 is `undefined`, not an "empty" instrument object** - the first draft of the "no current instrument" test tried to read `.sample.data.length` off it to confirm the setup, which threw; fixed by asserting the accessor is `undefined` directly, the actual condition `getEnvelope`'s own `if (!instrument)` guard is written against.

## Known limits

Same as requirements.md's own Scope boundaries: no interactive leaf, no surrounding panel, no screen wiring, no instrument-property undo. No browser verification occurred in this environment.
