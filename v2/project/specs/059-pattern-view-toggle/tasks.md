# 059 — Tasks

Status: done.

- [x] Re-read `controlPanel.js`'s own toggle buttons and `patternPanel.js`'s own `EVENT.showView` handler, and `mainPanel.js`'s own child order (visualiser above both views) - confirmed the real placement decision this spec turns on.
- [x] Confirmed empirically, via `node -e` against `compiler/recipes.js`, that `setPatternView` resolves via the existing `set-value` recipe with no new vocabulary.
- [x] `components/multitrackPanel.yaml` renamed to `components/patternViewPanel.yaml`, restructured (scopes always visible, two mutually-exclusive children).
- [x] `app.yaml`: reference updated.
- [x] `components/controlBar.yaml`: new `patternViewGroup` radioGroup.
- [x] `tests/multitrackScreen.test.js` removed, replaced by `tests/patternViewScreen.test.js`.
- [x] `tests/server.test.js`, `tests/yaml.test.js`: fixed.
- [x] `node compiler/generate.js`/`node build.mjs app`: confirmed (no new warnings; three new, expected loose ends - one `mocked-command` more than first estimated, see below).
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen rendered in a browser (same recorded reason every spec since 019 has given) - verified by reading the compiled outline/loose ends back, confirming the command empirically before authoring, and a layout-integration test.

## Evidence

- `node compiler/generate.js`: 15 warnings, 0 errors - unchanged.
- `node build.mjs app`: loose ends 90, up from 87 - one `mocked-command` (`pattern-view.set`, deliberate, see requirements.md) *and* two `inert-control` entries (`patternViewGroup`'s own two radio items) - the same established, expected category every new `radioGroup`'s own items already carry (specs 049/050), not accounted for in the design sketch's own "exactly one" estimate.
- `tests/patternViewScreen.test.js`: 7 tests (replacing `tests/multitrackScreen.test.js`'s own 6) - default (`""`) and explicit (`"Column view"`) both show `patternGrid`; `"Row view"` shows `multitrackView` instead; the whole area (including `scopesView`) is absent under Nibbles; `scopesView` stays present and above whichever sub-view is active on both sides of the toggle; the whole area still sits between `editPad` and `songPatternList`.
- `tests/server.test.js`/`tests/yaml.test.js`: the renamed file, repositioned alphabetically; the shifted content index.
- Full suite: `node --test tests/*.test.js` -> 866/866 passing (865 before this spec, -6 removed + 7 new = +1).

## Found while doing it

- **The loose-ends estimate in design.md's own sketch ("exactly one new... mocked-command") undercounted by two** - a new `radioGroup`'s own items each get their own `inert-control` entry regardless of whether the group's own command is mapped (the established category specs 049/050 already recorded), which the design sketch did not anticipate before running the real build. Corrected here rather than left as a stale prediction: 90 loose ends, not 88.
- No other surprises - the toggle's own command derivation, the `visibleWhen`/`oneOf` multi-value list, and the restructured panel's own layout all matched the design sketch exactly on the first compile and the first test run.

## Known limits

Same as requirements.md's own Scope boundaries: no classic-grid mute/solo/FX header, no piano, no real capability for the toggle. No browser verification occurred in this environment.
