# 053 — Tasks

Status: done.

- [x] Read `controlPanel.js`'s own view-toggle buttons (97-177, 218-255) and confirmed, by grepping `app.yaml` and every pattern-adjacent component file, that the classic column-based pattern grid has never been authored into any screen - the real scoping decision this spec turns on.
- [x] `project/specs/application/current/components/multitrackPanel.yaml` (new).
- [x] `app.yaml`: `normalMainView.content` gains `multitrackPanel`, between `editPad` and `songPatternList`.
- [x] `tests/multitrackScreen.test.js` (new).
- [x] Two pre-existing tests fixed (found broken by the new sibling, not by any code change): `tests/server.test.js`'s own file listing, `tests/yaml.test.js`'s own positional index into `normalMainView`'s content.
- [x] `node compiler/generate.js`: no new warnings (diffed, not just re-checked at zero - still exactly 16).
- [x] `node build.mjs app`: loose ends unchanged at 88.
- [x] `node --test tests/*.test.js` passes.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only. A layout-integration test against the real, compiled `app.yaml`, mirroring spec 048's own `tests/nibblesMainView.test.js` convention.

## Evidence

- `node compiler/generate.js`: 16 warnings, 0 errors - unchanged; the new node introduces none of its own.
- `node build.mjs app`: loose ends unchanged at 88 - no command is authored, so no `mocked-command`/`unresolved-*` entry was possible.
- `tests/multitrackScreen.test.js`: 4 new tests - compiles cleanly; `multitrackPanel`/`multitrackView` both get a non-zero rect when `main-view.value` is `""`; both are absent when it is `"nibbles"`; `multitrackPanel` sits between `editPad` and `songPatternList` without disturbing either's own rect.
- Two pre-existing tests broken by the new sibling (not by any behavior change) and fixed: `tests/server.test.js`'s own alphabetical file-listing assertion (one line added), `tests/yaml.test.js`'s own positional index into `normalMainView`'s raw parsed content (shifted by one, one more index added) - the same class of "hardcoded position" break specs 048/049 each hit once before when a sibling was added or a tree was restructured.
- Full suite: `node --test tests/*.test.js` -> 782/782 passing (778 before this spec + 4 new).

## Found while doing it

- **The real scoping question, resolved before writing any YAML**: grepping `app.yaml` and every pattern-adjacent component file (`editPad.yaml`, `songPatternList.yaml`, `songProperties.yaml`) for `patternGrid` found nothing at all - the classic, column-based pattern grid (specs 030/031) has never been authored into any screen, a P7 gap this port has carried, unremarked in any later spec's own "not done" list, since spec 031 itself recorded it. This is why the row/column view toggle and the classic grid's own smaller mute/solo header could not be built here: there is nothing on the other side of that toggle, and nowhere to put that header, regardless of how much of P11's own multitrack work is finished.
- **No new mechanism was needed at all** - unlike Nibbles' own screen (spec 049), which needed several new *surrounding* ordinary controls around a leaf that draws only its own playing field, `multitrackView` already draws its own control strip, blocks, effects and live scope inline (spec 052) - the "screen" here really is just placement, confirmed by re-reading spec 052's own requirements.md before assuming a richer screen was needed.

## Known limits

Same as requirements.md's own Scope boundaries: no classic grid screen, no row/column toggle, no classic-grid mute/solo header, no View-menu entry, no scopes/VU meters. No browser verification occurred in this environment.
