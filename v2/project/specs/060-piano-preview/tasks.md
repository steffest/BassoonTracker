\# 060 — Tasks

- [ ] `domain/playback/index.js`: import `resolveNote` from `../song/keyboardNotes.js`; add `NOTEPERIOD` to the existing `./engine/enum.js` import.
- [ ] `previewNoteOn(index)`, `previewNoteOff(index)`, `isPreviewNoteActive(index)`, private `activeKeys` Map.
- [ ] `tests/piano.test.js`: PREVIEW-001..006 against a real fixture through `createSilentContext({ recordAutomation: true })`.
- [ ] `node --test tests/*.test.js` passes.
- [ ] `node compiler/generate.js`/`node build.mjs app`: confirm unaffected (no YAML/capabilities.js touched).
- [ ] Update `v2/project/progress.md`, `010-port-roadmap/tasks.md`, `specs/index.md`.
