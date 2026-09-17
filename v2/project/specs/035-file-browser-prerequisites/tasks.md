# 035 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Re-read `script/src/ui/diskOperations.js` and `script/src/ui/components/listbox.js` (both in full) before designing, to confirm the mechanism gap precisely rather than assume it from spec 010's own roadmap wording.
- [x] `renderers/canvas/fileBrowserGeometry.js` (new, pure): `ROW_HEIGHT`, `ICON_SIZE`, `INDENT_WIDTH`, `contentHeight`, `clampOffset`, `rowIndexAt`, `visibleRowRange`.
- [x] `runtime/fileBrowserController.js` (new): `createFileBrowserController`, `rowsFieldOf`.
- [x] `runtime/behaviors.js`: registered `rowList` -> `createFileBrowserController` (named apart from the `fileBrowser` type so the type-name-branch scanning test stays meaningful).
- [x] `runtime/componentTypes.js`: `fileBrowser` registered - leaf, no `clips`, behavior `"rowList"`, draw kind `"fileBrowser"`, one property (`field`).
- [x] `renderers/canvas/drawKinds.js`: `fileBrowser` draw kind - visible-slice row rendering, per-row indent/icon/info, selection tint, scrollbar track.
- [x] `renderers/canvas/mountGeneric.js` (additive only): `contextFor()`'s new `"rowList"` branch; `visualStateOf()`'s new `"rowList"` branch; `applyScroll()`'s field-selection and trace extended to include `"rowList"`; the authoring-preview mock-state seeder's new `"rowList"` branch (selection defaults to `-1`, not `0`, since a fileBrowser starts with no rows).
- [x] `tests/fileBrowserGeometry.test.js` (new, 8 cases).
- [x] `tests/fileBrowser.test.js` (new, 15 cases: registry, controller, draw kind).
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler change; loose-ends count unchanged at 76 - `fileBrowser` is declared but authored nowhere yet, exactly as `menu`/`spinBox` once were).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

No screen authored, no browser available in this environment (same recorded reason as every spec since 019) - verified the same way specs 013/015/020/030 verified their own mechanisms: pure geometry tests, a controller exercised with synthetic input (no mount), and the draw kind exercised with a fake canvas context (the `patternGrid.test.js`/`listbox.test.js` convention). `mountGeneric.js`'s own three additive touches are covered indirectly (the controller/draw-kind tests exercise the same code paths those touches feed) plus a careful hand read-through, matching the same long-standing, explicitly-recorded gap (no direct test coverage of the mount/interaction wiring itself) every prior spec since 014 has left.

## Evidence

`node --test tests/*.test.js`: 487 tests, all passing, up from 464 (8 new in `tests/fileBrowserGeometry.test.js`; 15 new in `tests/fileBrowser.test.js`).

`node build.mjs app`: succeeds, exit 0. `app/LOOSE-ENDS.md`'s item count unchanged at 76 - `fileBrowser` is a declared, implemented type with no authored instance anywhere yet, so nothing about the build's diagnostics changes. `node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch every spec since 019 has recorded; unrelated to this work.

## Found while doing it

- **The obvious design (reuse `listController.js`/`scrollInfoOf()` as-is) does not work**, for a reason only visible by tracing three call sites in `mountGeneric.js` together: `itemIndexAt()` walks real child nodes (none exist for this leaf) and `scrollInfoOf()`'s extent comes from `genericLayout.js`'s child-stacking (also none). Both would silently resolve to `null`/`0` for a childless node, breaking scrolling and selection alike rather than throwing - the kind of gap that would only surface once a real screen tried to use it. Traced and recorded in design.md before writing any code, rather than discovered by a failing test later.
- **A real naming collision, caught by the existing scanning test, not by reasoning ahead of time.** The controller's behavior name was originally going to be `"fileBrowser"`, matching the type name (as most other types' behavior names do *not* - patternGrid's is `"grid"`, precisely to avoid this). `tests/componentTypes.test.js`'s "no module outside the registry branches on a component type name" test caught it immediately: not just in the intended `mountGeneric.js` code, but in a plain explanatory comment in `behaviors.js` that happened to contain the literal string `behavior === "fileBrowser"` - the regex-based scan does not distinguish code from comments, which is a real, useful property of that test's design (it wouldn't be foolproof otherwise, but it is remarkably good at catching accidental collisions no matter where they are written). Renamed the behavior to `"rowList"` and rewrote the comment to avoid the literal pattern entirely.
- **Row selection under a non-zero scroll offset needed the geometry to be checked, not assumed** - an early draft of the controller test asserted that scrolling to the very end and clicking the rect's own top edge would select the *last* row; the actual, correct behavior (confirmed against `rowIndexAt`'s own math) is that it selects the first row of the last visible *page*, which is a different, smaller index whenever the content height is not an exact multiple of the rect's own height. Fixed the test's own expectation, not the implementation, once the arithmetic was worked through by hand.
- **Everything else matched design.md going in**: the draw kind's icon-column reservation (so a mixed list of iconned and icon-less rows still lines up), the `applyScroll()` trace's own special case for a fileBrowser (which arrives already clamped by its controller, unlike a viewport/listbox whose trace reads a `layoutResult` entry that would never exist for this leaf), and the authoring-preview mock-state seeder's `-1` default (rather than listbox's own `0`, which would wrongly claim a still-empty list's first row) all needed no revision once written.

## Known limits

No screen exists to mount a real `fileBrowser` yet - everything here is verified against synthetic rows/rects, not a real loaded catalog. No browser verification occurred in this environment - the same recorded gap every spec since 019 has left, and, as with patternGrid before it, the most important one to close before trusting the mechanism's actual on-screen behavior. `mountGeneric.js`'s own interaction wiring (as opposed to the controller/geometry/draw-kind functions it calls) has no direct automated test coverage, matching every prior spec's own recorded gap there.
