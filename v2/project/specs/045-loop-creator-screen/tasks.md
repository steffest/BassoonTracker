# 045 — Tasks

Status: done.

- [x] Re-read `sampleView.js`'s own `openLoopCreator`/menu-hide wiring (148-153, 637) and `loopCreator.js`'s own menu-bar strip (`setControlsVisible`, 545-588, 626-643) before scoping.
- [x] `domain/sampleEditor/index.js`: `openLoopCreator`, `saveLoopCreator`, `cancelLoopCreator`, `toggleSnapToZero`, `setLoopPreset` - thin wrappers over spec 043's own session functions, each also managing the new `loop-creator.mode` field.
- [x] `compiler/recipes.js`: `verb-action` gains two more verbs (`open`, `cancel`); `CONDITION_FIELD_ALIASES` gains one entry (`snap to zero`).
- [x] `capabilities.js`: five new command mappings.
- [x] `project/specs/application/current/components/sampleEditPanel.yaml`: restructured - the existing content wrapped in a `visibleWhen`-gated `sampleEditNormalView`, a new "Create Loop" button, and a new `loopCreatorPanel` (menu bar + `loopCreatorView`) shown only while `loop-creator.mode` is `"open"`.
- [x] `tests/recipes.test.js` (extended): the two new verbs, the snap-to-zero alias.
- [x] `tests/sampleEditor.test.js` (extended): all five new capability functions against the real `wizballalt.mod` fixture.
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the real outline (the command/field table in design.md, read back) and no unexpected new warnings.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back (spec 036/042's own "confirm empirically" precedent) and by unit tests against a real loaded fixture for every new capability function, mirroring `tests/sampleEditor.test.js`'s own existing convention.

## Evidence

- `node compiler/generate.js`: 25 warnings, 0 errors, none naming `sampleEditPanel.yaml` or any of this spec's own new nodes - all pre-existing app.yaml gaps (unresolved action references for still-unallocated commands, the two unresolved notification-light rules, the volume-meter placeholder). Read back `app-outline.json` directly to confirm all five authored bindings' own `command`/`mockField` strings match design.md's table exactly.
- `node build.mjs app`: loose ends rose from 78 to 82, by exactly the four new `inert-control` entries for the presets `radioGroup`'s own four items (`Select`/`Fade in Head`/`Fade out Tail`/`Cross Fade`) - the same universal, unrelated-to-mapping category every other authored `radioGroup`'s items already carry (e.g. the file-operations target group, the tracker-mode group). None of the five new commands appear as `mocked-command`.
- `tests/recipes.test.js`: 2 new tests (up from 6) - the `open`/`cancel` verb additions, the snap-to-zero alias agreement.
- `tests/sampleEditor.test.js`: 7 new tests (34 total, up from 27) - `openLoopCreator`'s mode-field transition and its own no-current-instrument guard, `saveLoopCreator`'s undo registration and mode-close, `cancelLoopCreator`'s immediate restore and mode-close, both save/cancel's harmless no-op-when-nothing-open case, `toggleSnapToZero`'s flip/explicit-value paths, and all four preset labels (plus "Select" and an unrecognized label, both no-ops).
- Full suite: `node --test tests/*.test.js` -> 637/637 passing (628 before this spec + 9 new: 2 in recipes.test.js, 7 in sampleEditor.test.js).

## Found while doing it

This spec's own requirements.md/design.md had already been written (and the implementation itself - the YAML, the five capability functions, the compiler/capability wiring - had already been made) in an earlier pass; this pass picked the work up, verified it against the real test suite, and found two real regressions the earlier pass's own work had introduced but never run tests against:

- **`tests/componentTypes.test.js`'s "adding a component type touches only the registry"** flagged `compiler/recipes.js`'s own new comment for containing the literal word "checkbox" in prose (describing the "Snap to zero" control), the same class of false positive spec 042's own tasks.md already recorded once for a different comment. Reworded to "toggle control", matching spec 042's own precedent exactly.
- **`tests/emit.test.js`'s "a reserved host hook is wired into the app context, not into an action module"** asserted no action-module file path matched `/^actions\/.*[Oo]pen/`, meant to confirm a host hook (`host.openFiles`) produces no action module of its own. That assertion coincidentally also matched the real, legitimately authored `openLoopCreator` command's own derived file name (`actions/loopCreatorOpen.js`) once this spec's own YAML was live - a genuine, if narrow, test-design flaw exposed only once a real command's name happened to contain "open". Fixed generally, not by special-casing this one collision: the assertion now compares the full `actions/` file set between the host-hook run and the baseline run, so it can never again collide with an authored command's own name.
- No screen authored by this spec was previously covered by any capability-level test at all (`tests/sampleEditor.test.js` had zero references to `loop-creator`/`snapToZero`/`loopPreset` before this pass) - the nine tests above are new, not pre-existing.

## Known limits

Same as requirements.md's own Scope boundaries: no `dropdown`-based presets (a `radioGroup` is used instead - see Decisions and assumptions), no live cursor hinting or zoom sync with the plain waveform view (already spec 044's own), no color-key legend, and the presets `radioGroup`'s own selected item is never synced back to reflect live state once an individual value is dragged away from an exact preset. No browser verification occurred in this environment.
