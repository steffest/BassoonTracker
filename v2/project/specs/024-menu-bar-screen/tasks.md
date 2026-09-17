# 024 — Tasks

- [x] Re-read `script/src/ui/app/menu.js`'s `setItems()` call directly; author `app.yaml`'s `menu:` node from it (File/Edit/View/Help, Edit's own nested Clear).
- [x] `tests/compiler.test.js`: the `action1`/`action2`-specific assertion generalized (the fixture those two items exercised now lives inside the real menu bar's own unresolved commands, not a two-item placeholder).
- [x] `node --test "v2/tests/*.test.js"` passes; `node build.mjs app` succeeds - `track.clear`/`pattern.clear` shared with `editPad.yaml`, `song.clear`/`instruments.clear`/`piano.toggle` newly mocked, everything else legitimately unresolved; `node build.mjs dist` still blocked only by the pre-existing esbuild version mismatch on this machine.
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; note that only the control panel remains of P5's six named screens.
