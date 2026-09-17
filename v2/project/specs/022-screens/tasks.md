# 022 — Tasks

- [x] Read all six v1 screens' actual source; record the inventory table in requirements.md.
- [x] `compiler/recipes.js`: relax `toggle-generic` (`on click` optional); add `verb-action` (clear/copy/paste/insert/delete/increment/decrement).
- [x] `tests/recipes.test.js` (new): both changes, plus a check that the specific toggle recipes are not shadowed and an unrecognized verb still reports unresolved.
- [x] `components/infoBar.yaml`, `components/editPad.yaml`, `components/optionsPanel.yaml`, `components/songPatternList.yaml`; wired into `app.yaml` (`infoBar` replaces the ad hoc `statusBar` panel).
- [x] `node --test "v2/tests/*.test.js"` passes; `node v2/build.mjs app`/`dist` succeed; loose ends reviewed by hand (every new command a real mocked-command, none an unresolved reference).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec, including the two deferred screens and why.
