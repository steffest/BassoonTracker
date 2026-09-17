# 026 — the control panel screen

Date: 2026-09-11. Kind: feature. Status: specified. Implements the sixth and last of P5's six named screens, unblocked by spec 025's two prerequisites (a declared breakpoint mechanism, `visibleWhen`). With this spec, every screen the roadmap named for P5 is authored.

## Purpose

`script/src/ui/app/controlPanel.js` is mostly already ported: `components/controlBar.yaml` already authors its `SongControl` (Play/Record/song-pattern radio, spec 005-era), its mod/xm tracker-mode buttons, its 4/8/12/16 track-view buttons, and its track-count spin box - all read and compared line-for-line against the real file for this spec, not assumed. What v1's file has and v2's did not, until now, is the three-way File Operations/Options/Sample Edit switch (`_buttonFileOperations`/`_buttonOptions`/`_buttonSampleEdit`, each toggling `EVENT.showView`) and the width-driven `controlPanelButtonLayout` cascade (`full`/`condensed`/`2row`) - exactly the two things spec 022 flagged as missing and spec 025 built the mechanism for.

## User stories and acceptance

- **CTRLPANEL-001 — A three-way view switch, using `visibleWhen` for real:** As a user, a `radioGroup` (File Operations / Options / Sample Edit) sits in the control bar; picking one shows the matching panel and hides the other two. Acceptance: the already-authored `optionsPanel` (spec 022) is shown by picking "Options" (or by default, matching its prior always-visible behaviour); two new small placeholder panels (`fileOperationsPanel`, `sampleEditPanel` - real disk-operations/sample-editor screens are P9/P10's own work, out of scope here) demonstrate the other two.
- **CTRLPANEL-002 — A real breakpoint, using the new mechanism for real:** As a user, the control bar's own row of controls stacks into a column below 650px width, matching v1's own `"2row"` threshold. Acceptance: verified directly against the compiled tree and by the existing layout-pass tests (spec 025); no new mechanism needed.
- **CTRLPANEL-003 — No regressions:** Acceptance: the unit suite passes (with the small number of position/count assertions the new content moves updated, not the rule each one tests); `node build.mjs app`/`dist` succeed to the same extent as before; the mechanism reaches a *generated* application, not only the authoring preview.

## Non-functional requirements

No new component type, draw kind, or runtime mechanism. Authoring surfaced one real gap in spec 025's own delivery: `compiler/emit.js` had two separate node-construction code paths (one for a node inline inside its parent's own module, one for a container that owns its own module), and only the first carried `breakpoints`/`visibleWhen` through to a generated application - the authoring preview (which mounts the compiled outline directly) never exercised the second path, so the gap was invisible until a real module-owning container (`controlBar`, `optionsPanel`) actually used either property. Fixed as part of this spec, with a dedicated regression test.

## Scope boundaries

In scope: `components/controlBar.yaml`'s new top-view `radioGroup` and its own `breakpoints:`; `components/optionsPanel.yaml`'s new `visibleWhen:`; two new small components (`fileOperationsPanel.yaml`, `sampleEditPanel.yaml`), each a one-line placeholder gated on the same switch; the `compiler/emit.js` fix described above.

Out of scope: real disk-operations and sample-editor screens (P9/P10); v1's exact remaining breakpoint values (`maxVisibleTracks`'s three steps, the `"condensed"` layout state, the `prefered` 5-/3-column grid switch) - none of them apply to anything v2 has authored yet, and inventing content for them now would be shaping the mechanism to a guess, the same reasoning spec 025 itself already recorded; hover/animation-level fidelity to v1's own checkbox-button toggle behaviour (this spec's switch is an ordinary `radioGroup`, which does not support "click the active choice again to deselect" - an accepted simplification, not an oversight). Browser verification: not performed, for the same reason specs 019-025 recorded none.
