# 049 — Tasks

Status: done.

- [x] Re-read `nibbles.js`'s own `GameControls()` (682-1207) in full before scoping.
- [x] `compiler/recipes.js`: one new `verb-action` verb (`start`); two new `CONDITION_FIELD_ALIASES` entries (`wrap`, `grid`).
- [x] `runtime/componentTypes.js`: `button` gains a `field` property (the renderer's own generic text resolution already supported it; this is the first authored use).
- [x] `domain/nibbles/index.js`: `getShowGrid`/`setShowGrid`, `resetToIdle`, `publishStatus` (exported for testing) + the observation loop (`startObservingStatus`/`stopObservingStatus`, private), `startNibbles`, `toggleWrap`, `toggleGrid`, `setNibblesDifficulty`, `toggleHighScoreView`; `openNibblesView`/`showMain` (spec 048) extended.
- [x] `renderers/canvas/drawKinds.js`: `nibblesGrid` gains grid-lines-vs-border drawing.
- [x] `capabilities.js`: five new command mappings.
- [x] `project/specs/application/current/app.yaml`: `nibblesPanel`'s own placeholder (spec 048) replaced with the real screen (game view + high-score view, both `visibleWhen`-gated on a new `nibbles-view.value`).
- [x] `tests/recipes.test.js` (extended): `start`; the `wrap`/`grid` aliases; `setDifficulty`/`toggleHighScoreView` resolving via existing verbs.
- [x] `tests/nibbles.test.js` (extended): every new capability, `resetToIdle`'s own "always fresh on reopen" behavior, `publishStatus`.
- [x] `tests/nibblesGridView.test.js` (extended): grid-lines-vs-border drawing.
- [x] `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command table, read back) and the loose-ends delta.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline back (spec 036/042/045/046/048's own "confirm empirically" precedent) and by unit tests against the real engine for every new capability, including the observation loop's own step function called directly (mirroring `domain/playback/index.js#startObserving`'s own untested-by-real-rAF precedent - Node has no `requestAnimationFrame` at all, so `startObservingStatus` itself is a guarded no-op in this environment, confirmed rather than assumed).

## Evidence

- `node compiler/generate.js`: 16 warnings, 0 errors, unchanged - none on any node this spec added.
- Read back `app-outline.json`: all seven bindings across the five new commands match design.md's table exactly (`nibbles.start`/no field; `wrap.toggle`/`wrap.active`; `grid.toggle`/`grid.active`; `difficulty.set`/`difficulty.value`; `high-score-view.toggle`/`high-score-view.active`, bound from both the HighScore and Back buttons).
- `node build.mjs app`: loose ends rose from 80 to 84, entirely from the four new difficulty `radioGroup` items' own `inert-control` entries - the same established, expected category every other authored `radioGroup`'s items already carry regardless of whether the group's own command is mapped (confirmed, not assumed, by grepping the generated file). None of the five new commands appear as `mocked-command`; `app/actions/{nibblesStart,wrapToggle,gridToggle,difficultySet,highScoreViewToggle}.js` all import the real `domain/nibbles/index.js` export, confirmed by listing the directory.
- `tests/recipes.test.js`: 3 new tests (15 total, up from 12).
- `tests/nibbles.test.js`: 9 new tests (26 total, up from 17).
- `tests/nibblesGridView.test.js`: 2 new tests (8 total, up from 6).
- Full suite: `node --test tests/*.test.js` -> 714/714 passing (700 before this spec + 14 new).
- `node build.mjs dist` still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded.

## Found while doing it

- **A real registry gap, found by the compiler's own warning, not assumed**: authoring `field:` on a `button` (for the screen's own single state-dependent primary button) produced an `unknown-component-property` warning - `runtime/componentTypes.js`'s own `button` entry never declared `field` in its `properties`, even though `renderers/canvas/mountGeneric.js#textOf` already resolves it generically for *any* type (confirmed by reading that function, not assumed from the warning alone - `label` was simply the only type to have exercised and therefore documented it before now). Fixed by declaring it on `button` too, matching `label`'s own exact wording - a real, accurate registry addition documenting existing renderer behavior, not a workaround.
- **The identical "checkbox" false-positive `tests/componentTypes.test.js` has now caught three times** (specs 042, 045, this one): a new `compiler/recipes.js` comment describing the Wrap/Grid toggle controls used the literal word "checkboxes," tripping the scanning test that forbids any source file outside a small allowlist from naming the `checkbox` component type by its bare word. Reworded to "toggle controls," the exact fix specs 042/045 already used for the same mistake - this project's own established lesson (avoid a component type's own bare name in prose, in any file the scan walks) evidently still needs relearning per spec rather than becoming an automatic habit; recorded here plainly rather than glossed over.
- **A real design question resolved by reading `runtime/genericLayout.js#isVisible` before assuming, not after**: `nibbles-info-visible.value` is authored as a boolean field compared with `oneOf: [true]` - the first boolean (not string-label) use of `visibleWhen` in this whole port. `isVisible()`'s own `oneOf.includes(value)` check needed no special-casing for this (confirmed by reading it, not by trial and error), so no new mechanism was needed - only the first exercise of an already general one.
- **`domain/nibbles/highscores.js#getHighScores` has no injectable-storage seam through the screen's own capability layer** (`toggleHighScoreView` always reads the real default storage) - discovered while writing a test meant to prove "rows past the real table's own length are blank," which turned out to be untestable through the capability itself (a fresh, never-written store is always v1's own ten-entry seed table, never fewer). Rather than adding a needless seam nothing else requires, the test was rewritten to verify the real, always-true case exactly (all ten of v1's own seed entries, formatted correctly) - the fewer-than-ten case remains covered by `tests/nibblesHighscores.test.js`'s own existing, directly-injectable test of `getHighScores(storage)` itself.

## Known limits

Same as requirements.md's own Scope boundaries: no bespoke `col1`-`col5` breakpoint layout, no high-score sprite thumbnails or two-column layout, no new-high-score name-entry dialog, no "SKIP"/"TRITON" cheat codes, no decorative sprites, no feature-registry wiring (unchanged from spec 048's own recorded limitation). The difficulty `radioGroup`'s own selected item does not visually reflect the real default or any later choice on load - a pre-existing, already-recorded limitation (spec 033), not introduced or regressed here. No browser verification occurred in this environment.
