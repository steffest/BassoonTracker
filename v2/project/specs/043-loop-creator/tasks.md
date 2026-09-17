# 043 — Tasks

Status: done.

- [x] Read `loopCreator.js` in full (848 lines) before designing.
- [x] `domain/sampleEditor/loopCreator.js` (new): state model, `recomputeMaxes`, `nearestZeroCrossing`, `computeLayers`/`applyPreview`, `openLoopCreator`, the eleven absolute setters, `applyLoopPreset`, `saveLoopCreator`, `cancelLoopCreator`.
- [x] `domain/song/index.js`: `applySampleDiff` gains the optional `action.loop` restore, fixing v1's own dead undo fields.
- [x] `tests/loopCreator.test.js` (new).
- [x] `tests/song.test.js` (extended): two tests for the `action.loop` mechanism directly.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler/capabilities.js change).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no UI exists yet to reach this module - matching spec 039/040's own precedent). Most of the state model and DSP is exercised against small, hand-computable synthetic instrument objects (not a real fixture, since LOOP-002 through LOOP-004 need exact, hand-traceable numbers a real MOD sample's own arbitrary data cannot give); `saveLoopCreator`'s own undo/redo round trip needs the real engine, since it registers against `domain/song`'s shared history.

## Evidence

- `tests/loopCreator.test.js`: 19/19 passing - `openLoopCreator`'s two branches (existing usable loop kept; no usable loop seeds a default and applies Cross Fade automatically, both for "disabled" and "too short" reasons) plus its own early-return guard; a hand-traced `computeLayers`/`applyPreview` test asserting the exact blended value at each of the three affected sample indices (0.525, 0.55, 0.6125), plus an idempotence check (a same-value recompute never compounds); every setter's own clamp, including a loop-length shrink that re-derives a region's max and clamps an already-too-large region down to fit; all four presets (including the deliberate no-op `0`) matching v1's own nine-value table exactly; `saveLoopCreator`'s undo/redo round trip restoring data and loop bounds together; `cancelLoopCreator`'s immediate restore with nothing registered; both functions' own no-op-when-not-open guards.
- `tests/song.test.js`: 2 new tests (27 total, up from 25) - a SAMPLE-kind action's optional `loop` field restores `instrument.sample.loop.start`/`.length` in sync with the data on both undo and redo; a SAMPLE-kind action with no `loop` field leaves the loop bounds untouched, confirming the extension is fully backward-compatible with every existing caller (the four spec-040 operations).
- Full suite: `node --test tests/*.test.js` → 596/596 passing (575 before this spec + 19 + 2).
- `node build.mjs app`: 78 loose ends, unchanged (no YAML/compiler/capabilities.js touched - this spec is headless, matching spec 039/040's own precedent exactly).
- `node --check` passed on both new/touched source files and both new/touched test files before the suite ran.

## Found while doing it

- **A genuine, confirmed bug in v1's own undo path**, not merely a stylistic difference: `loopCreator.js#saveLoop` sets `editAction.loopStart`/`.loopLength` expecting the undo/redo replay to restore them, but `waveform.js`'s own `EVENT.commandProcessSample` handler only ever reads those two fields for its `CUT`/`PASTE` branches - never `REPLACE`, the one kind `saveLoop()` itself uses (confirmed by reading the full handler, not assumed). Undoing "Create Loop" in v1 reverts the sample data but leaves the loop bounds exactly where the loop-creation session left them, silently out of sync with the reverted audio. Fixed here: `domain/song/index.js#applySampleDiff` gained one small, optional, fully backward-compatible extension (`action.loop`), and `saveLoopCreator()` is the first (and, for now, only) caller to supply it.
- **`snapMarkersToZero()` is dead code in v1** - fully implemented (defined at `loopCreator.js:590-601`) but never called from anywhere in the file: not wired to the "Snap to zero" checkbox (whose own `onToggle` just flips a flag `onDrag` reads later), not wired to any button or menu item. Confirmed by grepping the whole file for its own name. Not ported.
- **`me.setLoopStart`/`me.setLoopLength` (the spinbox-driven setters) and the mouse-drag marker handlers apply `snapToZero` asymmetrically in v1** - only the drag handlers do. This looked like it might be an oversight worth "fixing" at first glance, until tracing both call sites confirmed it is deliberate and consistent (a typed-in exact value should never silently snap elsewhere; only an imprecise drag gesture benefits from snapping) - ported faithfully, recorded rather than silently "improved" away.
- **`maxHeadSize` and `maxLoopEndSize` are always numerically identical** (`recomputeMaxes`'s own two formulas, `min(loopLength, loopStart)` and `min(loopStart, loopLength)`, are the same expression under `min`'s commutativity) - not a bug, just a property of the math worth knowing before hand-picking test fixture numbers meant to distinguish the two (the preset tests read both values back live rather than assuming they differ).

## Known limits

The interactive drag-based waveform overlay (eight independent drag targets, its own hit-testing and drawing), the menu-bar controls (title, Apply/Cancel, snap checkbox, presets dropdown), zoom sync, and reactive instrument-change handling are all deliberately out of scope - see requirements.md. Nothing here is reachable from any UI yet - headless only. No browser verification occurred in this environment.
