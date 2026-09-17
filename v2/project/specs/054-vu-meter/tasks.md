# 054 — Tasks

Status: done.

- [x] Read `vumeter.js` (135 lines) in full, and `menu.js`'s own `vumeter.connect(Audio.cutOffVolume)` call site, before scoping.
- [x] Confirmed, by reading `compiler/convert.js#convertReference`, that `app.yaml`'s own `volume meter: volumemeter` resolves against a component *file* (`components/volumemeter.yaml`), not a type name - the real reason this has stayed an `unresolved-component-reference` warning since the shell was first authored.
- [x] `domain/playback/index.js`: `getMasterScopeData`, `ensureMasterScopeAnalysers` (private), `masterScopeAnalysers` cleared in `reset()`.
- [x] `renderers/canvas/vuMeterGeometry.js` (new).
- [x] `runtime/vuMeterController.js` (new).
- [x] `runtime/behaviors.js`: registers `vuMeter`.
- [x] `runtime/componentTypes.js`: `volumeMeter` type entry.
- [x] `renderers/canvas/drawKinds.js`: `volumeMeter` draw kind.
- [x] `project/specs/application/current/components/volumemeter.yaml` (new) - explicit numeric `layout: {width: 160, height: 16}`, not the bare `fixed` keyword (found necessary at implementation time - see design.md).
- [x] `tests/vuMeterGeometry.test.js`, `tests/vuMeterController.test.js`, `tests/volumeMeterView.test.js` (all new); `tests/playback.test.js` (extended).
- [x] Three pre-existing tests fixed (found broken by the new resolution, not by any bug): `tests/compiler.test.js` (×2 assertions in one test), `tests/emit.test.js`, `tests/server.test.js`.
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`: `unresolved-component-reference "volumemeter"` gone (16 -> 15 warnings, diffed).
- [x] `node build.mjs app`: loose ends checked and dropped (88 -> 87).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only. Pure geometry unit tests, a minimal controller test, a fake-canvas draw test, and a before/after diff of the compiler's own warning count - the first spec in this port to close a *standing* warning rather than only avoiding new ones.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - down from 16; `unresolved-component-reference "volumemeter"` is gone, nothing else changed.
- `node build.mjs app`: loose ends 87, down from 88.
- `tests/vuMeterGeometry.test.js`: 5 new tests - `dynamicRange` against silence/one-sided/full-scale buffers, `dotCountFor`, `zoneFor`'s three boundaries, `litDotCount`'s clamps, `LEVEL_SCALE`'s own value and that it is not applied inside `dynamicRange`.
- `tests/vuMeterController.test.js`: 4 new tests - hover/focus/blur, every other input type a confirmed no-op, `setDisabled`'s transition/no-transition, seeded `disabled`.
- `tests/volumeMeterView.test.js`: 5 new tests - registry declaration (including `ticks: true`), `measure()`, draw-never-throws with silent (always-128) data, draw-never-throws with a real loaded song, and all three zone colors appearing across a full-width strip.
- `tests/playback.test.js`: 1 new test - `getMasterScopeData` connects `Audio.cutOffVolume` to a splitter exactly once across repeated calls (confirmed by the connections list's own length staying flat after the first call), returning real per-channel byte data.
- Full suite: `node --test tests/*.test.js` -> 797/797 passing (782 before this spec + 15 new).

## Found while doing it

- **A real compiler warning traded for a worse one, caught immediately by re-running the generator rather than assuming success**: authoring `components/volumemeter.yaml` with `layout: {width: fixed, height: fixed}` (the bare keyword, the shape every other specialized leaf's own placement uses) replaced the one `unresolved-component-reference` warning with *two* new `layout-default-fallback` ones - `resolveLayoutFields` only has a fallback size for a `styled: true` type with a skin entry, or one of four hardcoded types (`panel`/`button`/`radioGroup`/`label`); `volumeMeter` is none of those, and grepping `skin/default.yaml` confirmed no prior specialized leaf appears there either - each instead sidesteps this by using `width: fill, height: fill`, which needs no default at all. `top`'s own row gives `volumemeter` a genuinely fixed slot beside `menu`/`notifications`, so `fill` was not the right fit the way it is for a leaf with a whole panel to itself. Fixed by authoring the actual numbers (`160`/`16`) directly instead of the keyword - self-sufficient, no default lookup, no warning.
- **Three pre-existing tests broke from the resolution itself, not from any bug**: `tests/compiler.test.js` had two assertions pinning the *unresolved* state exactly (`unresolved-component-reference === 1`, and the placeholder node's own id, which changes from the slot key `"main.top.volume meter"` to the resolved component's own authored name `"main.top.volumemeter"` once it is real) - both updated to assert the *resolved* state instead; `tests/emit.test.js`'s own loose-end category count dropped by one now that the volume meter is a real rendered node, not a placeholder; `tests/server.test.js`'s own file listing gained the new file. The same "hardcoded exact-state" class of break every restructuring spec in this port has hit at least once.

## Known limits

Same as requirements.md's own Scope boundaries: no skin-atlas sprites, no v1-exact 500x16px size, no true VU ballistics beyond the analyser's own smoothing. No browser verification occurred in this environment.
