# 048 — Tasks

Status: done.

- [x] Read `script/src/ui/app/appMainPanel.js`'s own `pluginRenderHook`/`_hideMain`/`_showMain` (245-300, 470-503) in full before scoping - found the real gap this spec exists to close.
- [x] `compiler/recipes.js`: `verb-action` gains one more verb, `"show"` (resolves `showMain` for the first time; also resolves three pre-existing, still-unmapped siblings as a recorded side effect).
- [x] `domain/nibbles/index.js`: `openNibblesView`, `showMain`.
- [x] `capabilities.js`: two new command mappings.
- [x] `project/specs/application/current/app.yaml`: `fileOperationsPanel`/`optionsPanel`/`sampleEditPanel`/`editPad`/`songPatternList`/`songProperties` wrapped in a new `normalMainView`; a new placeholder `nibblesPanel` sibling; the View menu's `nibbles` action renamed `openNibbles`.
- [x] `tests/recipes.test.js` (extended): the `show` verb and its side effect; `openNibbles`.
- [x] `tests/nibbles.test.js` (extended): `openNibblesView`/`showMain` capability tests.
- [x] `tests/nibblesMainView.test.js` (new): a `computeGenericLayout()` integration test against the real, live `app.yaml`.
- [x] Fixed four pre-existing tests whose own hardcoded node ids/messages assumed the pre-spec tree shape (`tests/compiler.test.js` x2, `tests/emit.test.js` x2, `tests/yaml.test.js` x1) - found by running the full suite, not assumed from reading the diff alone.
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command table, read back) and the loose-ends delta.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified with `computeGenericLayout()` directly against the real compiled `app.yaml`, mirroring spec 019's own "no Playwright" convention, plus reading the compiled outline back for the two new commands (spec 036/042/045/046/047's own "confirm empirically" precedent).

## Evidence

- `node compiler/generate.js`: 16 warnings (down from 25 - nine `unresolved-action-reference` entries resolved: `showMain`/`openNibbles` properly mapped, `showOptions`/`showFileOperations`/`showSampleEditor`/`showStats`/`showAbout`/`showHelp`/`showGithub` now resolve to a command but remain unmapped). 0 errors, none on the six wrapped regions.
- Read back `app-outline.json`: `nibbles.open`/`main.show` both resolve with no field, exactly matching design.md's table; `main.normalMainView`'s and `main.nibblesPanel`'s own `visibleWhen` both read `main-view.value`, with `oneOf: [""]`/`oneOf: [nibbles]` respectively.
- `node build.mjs app`: loose ends 80 (down from 82) - `app/LOOSE-ENDS.md` confirms `nibbles.open`/`main.show` are absent entirely (properly mapped) and seven new `mocked-command` entries appeared for the pre-existing, still-unmapped `show*` siblings (a recorded side effect, not a regression - each was already a loose end, just a different kind).
- `tests/recipes.test.js`: 2 new tests (12 total, up from 10) - the `show` verb (and its three-sibling side effect), `openNibbles`.
- `tests/nibbles.test.js`: 2 new tests (17 total, up from 15) - `openNibblesView`/`showMain`.
- `tests/nibblesMainView.test.js`: 6 new tests, against the real compiled `app.yaml` - presence/absence under both `main-view.value` states, the menu/control/info bars unaffected either way, and `fileOperationsPanel`/`sampleEditPanel` still independently gated by their own `top-view.value` (spec 025/026's own mechanism, untouched).
- Full suite: `node --test tests/*.test.js` -> 700/700 passing (690 before this spec + 10 new, offset by fixing 5 pre-existing assertions broken by the real tree-shape change - see Found while doing it).
- `node build.mjs dist` still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded.

## Found while doing it

- **The core finding, made before any code was written**: re-reading `appMainPanel.js`'s own `_hideMain()` in full (not just `pluginRenderHook`'s own handler) showed Nibbles hides the instrument list, the song list, *both pattern panels* and the title/BPM/repeat controls - v1's own `AppMainPanel`'s entire content - not the smaller region `top-view.value` (spec 025/026) already gates. Confirmed by reading `_hideMain()`'s own thirteen-line method body directly rather than inferring scope from the `pluginRenderHook` handler's own four-line body alone.
- **A test bug in this spec's own first draft, caught by running the layout test rather than trusting the design sketch**: `computeGenericLayout`'s `stateValueOf` mock returning JS `undefined` for an unset field is not the same as the real running application's own seeded initial value, `""` - `["", ].includes(undefined)` is `false`, so an early draft of `tests/nibblesMainView.test.js` found `normalMainView` itself absent even in the "normal" case, and every one of the six wrapped regions along with it. Fixed by seeding `main-view.value` to `""` explicitly in the test's own mock, matching how `runtime/appState.js` really seeds it.
- **A second test-design mistake, also caught by running the test rather than assuming**: the same draft assumed all six wrapped regions would get a rect together whenever `main-view.value` is `""`, forgetting that three of them (`fileOperationsPanel`/`optionsPanel`/`sampleEditPanel`) already carry their *own*, older `visibleWhen` on `top-view.value` (spec 025/026) - unaffected by this spec's own wrapper, and still independently gating them. Fixed by asserting only what each region's own pre-existing condition actually allows, plus a dedicated test proving the two mechanisms compose (an ancestor's `visibleWhen` and a descendant's own, both must hold).
- **A real, expected (not a bug) side effect measured, not assumed**: nesting the six regions one level deeper costs exactly one more panel's own padding (`runtime/genericLayout.js`'s own `PADDING`, 4px per side) on any `width: fill` control among them - `editPad`'s own resolved width dropped from what a naive "should be pixel-identical" expectation predicted (1200) to the real, correct value (1184), matching `controlBar`'s own width (1192, one padding level under `main`) minus one more padding level. The design sketch's own first-draft acceptance wording ("byte-identical") was corrected in `requirements.md` to describe this precisely, rather than leaving a subtly wrong claim standing - the same class of nesting cost spec 045's own `sampleEditNormalView` wrapper already introduced for its own contents, unremarked at the time.
- **Five pre-existing tests broken by the real tree-shape change, found only by running the full suite**, not by re-reading the diff: `tests/compiler.test.js` (two node-id lookups assumed `main.optionsPanel`/`main.songProperties`/etc. as direct children; one message-content check assumed `"showAbout"` stayed unresolved, which the new `"show"` verb resolves), `tests/emit.test.js` (two more direct-child id lookups), `tests/yaml.test.js` (a hardcoded top-level item count and per-index scalar-reference list). All five updated to the new, correct shape; none hid a real regression once traced.

## Known limits

Same as requirements.md's own Scope boundaries: no real screen content behind `nibblesPanel` (a placeholder only - spec 049's own), no feature-registry wiring (Nibbles' own domain code is already part of the main bundle regardless, via `nibblesGrid`'s own eager import in `drawKinds.js`/`nibblesController.js` - a real, already-existing, port-wide limitation shared by every specialized leaf, not fixed by this spec or the next one), `showOptions`/`showFileOperations`/`showSampleEditor` left unmapped (now `mocked-command` loose ends rather than `unresolved-action-reference` ones). No browser verification occurred in this environment.
