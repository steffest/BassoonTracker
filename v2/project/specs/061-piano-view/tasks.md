# 061 — Tasks

- [x] `renderers/canvas/pianoGeometry.js`: constants, `keyAtPoint`, `keyRectsFor` - verified empirically before tests.
- [x] `runtime/pianoController.js`: `createPianoController`.
- [x] `runtime/componentTypes.js`: `pianoView` type.
- [x] `runtime/behaviors.js`: `piano` -> `createPianoController`.
- [x] `renderers/canvas/drawKinds.js`: `pianoView` entry + `pianoGeo` import.
- [x] `tests/pianoGeometry.test.js`, `tests/pianoController.test.js`, `tests/pianoView.test.js`.
- [x] `node --test tests/*.test.js` passes (884, up from 870).
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed unaffected (15 warnings, 90 loose ends).
- [x] Update `v2/project/progress.md`, `010-port-roadmap/tasks.md`, `specs/index.md`.
