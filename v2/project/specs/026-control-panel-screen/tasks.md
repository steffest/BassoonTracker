# 026 — Tasks

- [x] Re-read `script/src/ui/app/controlPanel.js` against the already-authored `components/controlBar.yaml`; confirmed SongControl/mod-xm/track-view/track-count were already ported, and the File Operations/Options/Sample Edit switch plus the width breakpoint were the only gaps.
- [x] `components/controlBar.yaml`: `breakpoints:` (maxWidth 650 → column, taller fixed height) on its own top-level panel; a new named `topViewGroup` radioGroup (File Operations/Options/Sample Edit, `variant: buttons`, `actions: - change: setTopView`).
- [x] `components/optionsPanel.yaml`: `visibleWhen: { field: top-view.value, oneOf: [Options, ""] }`.
- [x] `components/fileOperationsPanel.yaml`, `components/sampleEditPanel.yaml` (new): minimal placeholders, each gated on its own `oneOf` value; wired into `app.yaml`.
- [x] Found and fixed a real gap in spec 025's own delivery: `compiler/emit.js`'s module-owning-container code path never emitted `breakpoints`/`visibleWhen` (only the inline-child path did) - fixed in both places; regression test added.
- [x] `tests/compiler.test.js`: real-app.yaml assertions for `controlBar`'s breakpoints and the three panels' `visibleWhen`.
- [x] `tests/emit.test.js`: a generated, module-owning node (`controlBar`, `optionsPanel`) carries both properties through to a real generated application, not only the authoring preview.
- [x] `tests/yaml.test.js`, `tests/server.test.js`: position/count assertions moved by the new content updated (the song/pattern radioGroup found by its own content instead of by position; `app.yaml`'s content-item count; the two new component files added to the exact file listing).
- [x] `node --test "v2/tests/*.test.js"` passes; `node build.mjs app` succeeds (`top-view.set` newly mocked, everything else unchanged); `node build.mjs dist` still blocked only by the pre-existing esbuild version mismatch on this machine.
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec - all six of P5's named screens are now authored.
