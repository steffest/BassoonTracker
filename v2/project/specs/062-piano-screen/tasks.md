# 062 — Tasks

- [x] `domain/song/index.js`: `applyOctaveChange(app, detail)`.
- [x] `capabilities.js`: `current-octave.set` mapping.
- [x] `components/pianoPanel.yaml` (new): header row (octave spinbox, close button) + `pianoView`.
- [x] `app.yaml`: `main.content` gains `pianoPanel` after `nibblesPanel`.
- [x] `tests/pianoScreen.test.js` (new); `tests/song.test.js` extended for `applyOctaveChange`.
- [x] **Found and fixed a real, confirmed, pre-existing bug**: `runtime/genericLayout.js#isVisible` compared a live `stateValueOf` value directly against `oneOf` (always strings, per `compiler/yaml.js`'s own string-only scalar type), so a real JS boolean field (`piano.active`, `domain/settings#applyToggle`'s own shape) could never satisfy `oneOf: [true]` (compiled to the string `"true"`). Fixed by coercing the live value to a string before comparing. `nibbles-info-visible.value` (spec 049) had the identical, previously untested shape - confirmed broken there too before the fix, via a direct `computeGenericLayout` check. Regression test added in `tests/viewVisibility.test.js` (spec 025's own home for `visibleWhen` tests).
- [x] `piano.toggle`/`piano.active` turned out to be **already wired to a real, pre-existing capability** (`domain/settings/index.js#togglePiano`, a persisted `SETTINGS.showPiano`-equivalent toggle, predating this session) - not a generated mock as first assumed; zero new loose ends from this spec at all (90, unchanged).
- [x] `node --test tests/*.test.js` passes (893, up from 884: 4 new files/extensions + the regression test).
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unchanged (15 warnings, 90 loose ends).
- [x] Update `v2/project/progress.md`, `010-port-roadmap/tasks.md`, `specs/index.md`.
