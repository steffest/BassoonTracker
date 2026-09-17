# 057 — Tasks

Status: done.

- [x] Re-read `sampleView.js`'s own `EnvelopePanel` usage (13, 245-249, 640-728, 960-980) - found it is not dead code (a first, wrong assumption from grepping only `script/src/ui/`, corrected before scoping further).
- [x] Confirmed empirically, via `node -e` against `compiler/recipes.js`, every one of the sixteen new actions' own derived command name, and the six new `highlighted-when-active` aliases' own derived mock field - before writing any YAML.
- [x] `compiler/recipes.js`: two new verbs (`add`/`remove`); six new `CONDITION_FIELD_ALIASES` entries.
- [x] `domain/sampleEditor/index.js`: twelve new `STATE_FIELDS`; `publishEnvelopeFields` (private); `envelopeCapabilities` factory (private); sixteen new exports; `publishInstrumentFields` extended (a real bug found and fixed here - see below).
- [x] `capabilities.js`: sixteen new command mappings.
- [x] `project/specs/application/current/components/sampleEditPanel.yaml`: new `envelopeRow`.
- [x] `tests/recipes.test.js` (extended), `tests/sampleEditor.test.js` (extended), `tests/envelopeScreen.test.js` (new).
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed (no new warnings; all sixteen commands real, not mocked).
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back, confirming every command empirically before authoring, and unit tests against the real engine.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - unchanged; the sixteen new actions/six new rules introduced none of their own (confirmed empirically before authoring, then confirmed again by an unchanged run after).
- `node build.mjs app`: loose ends unchanged at 87; `grep -i envelope app/LOOSE-ENDS.md` returns nothing - none of the sixteen new commands is a `mocked-command`.
- `tests/recipes.test.js`: 3 new tests - the two new verbs, the fourteen other actions resolving through the existing `set-value` recipe with no new vocabulary, the six new aliases.
- `tests/sampleEditor.test.js`: 7 new tests - enable toggling and republishing only its own type's fields; add/remove's disabled-envelope no-op and its own re-clamp republish; sustain/loop toggle+spinbox capabilities; the panning envelope's own eight capabilities addressing `panningEnvelope` only, independent of any volume call; `publishInstrumentFields`'s own twelve envelope fields, including the no-instrument all-falsy default (a real bug found and fixed here, see below).
- `tests/envelopeScreen.test.js`: 4 new tests - both `envelopeView` nodes present and sized whenever `sampleEditNormalView` is visible, absent under a sub-view, and sitting alongside `ftOnlyRow` with both panels' own header/side controls present too.
- Full suite: `node --test tests/*.test.js` -> 849/849 passing (835 before this spec + 14 new, after also fixing the one pre-existing "checkbox"-word false positive this spec's own new comment tripped).

## Found while doing it

- **`script/src/ui/envelope.js`/`envelopePanel.js` are not dead code** - the first grep of this spec (limited to `script/src/ui/`) found nothing importing either file and nearly led to treating specs 055/056 as porting an abandoned feature. Widening the search found `script/plugins/sampleeditor/sampleView.js` (the real, live sample editor this whole port's P10 work has been based on throughout) imports and instantiates `EnvelopePanel` twice. Corrected before scoping this spec any further, not after.
- **A real, confirmed bug in `publishInstrumentFields`, found by a test with an intentionally adversarial ordering, not by inspection**: the "no instrument" branch has its own early `return;`, so the two new `publishEnvelopeFields` calls - added directly after the "has instrument" branch's own last line - never ran at all once an instrument became unselected, leaving all twelve envelope fields silently stale at whatever they were the last time a real instrument was selected. Found by a test that toggles a real envelope field, switches to instrument slot 0 (no instrument), republishes, and asserts the field actually returns to its own all-falsy default - it did not, on the first run. Fixed by restructuring the two branches with an `else` and moving both `publishEnvelopeFields` calls after the whole if/else, unconditional either way (safe, since `getEnvelope`'s own no-instrument default is already all-falsy).
- **The identical "checkbox"-word false positive `tests/componentTypes.test.js`'s own scanning test has now caught four times** (specs 042, 045, 049, and this spec's own first-draft comment in `compiler/recipes.js`) - fixed the same way every time: reworded to "toggle controls."

## Known limits

Same as requirements.md's own Scope boundaries: no `isMaximized`/`moreExpanded`, no v1-exact column positions, no scopes/piano, no classic-grid screen. No browser verification occurred in this environment.
