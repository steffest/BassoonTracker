# 019 — Implementation

Status: implemented and verified 2026-09-11, with one known verification gap (no browser run - see below).

- [x] `runtime/listController.js` (new): the `"list"` behavior - click-to-select plus wheel/drag/thumb-to-scroll, modeled on `scrollController.js`'s anchor/metrics shape with a selection outcome added. `scrollFieldOf(node)` - where a listbox's scroll offset lives, always derived, never authored.
- [x] `runtime/behaviors.js`: `list: createListController` added to the one name -> factory table.
- [x] `runtime/componentTypes.js`: `listbox` promoted to `implemented: true` (`behavior: "list"`, `clips: true`, `styled: false`, `cursor: "default"`, `draw: "listbox"`); description and `field`/`reorderable` docs updated to say what is and is not wired.
- [x] `renderers/canvas/drawKinds.js`: `drawScrollThumb()` factored out of `background`'s existing inline thumb code (no behavior change to `background`); new `listbox` draw kind (backing, clipped selected-row tint, shared thumb).
- [x] `renderers/canvas/mountGeneric.js`: `controllableTarget()` (bubble a pointer gesture to the nearest ancestor with a controller) used in `handlePointerDown`/`handlePointerMove`; `itemIndexAt()` (which authored child a point lands inside); `"list"` branches added to `contextFor()`, `visualStateOf()`, `scrollInfoOf()`, `applyScroll()`, and `relayout()`'s `scrollOffset` callback, all keyed off `behaviorNames.get(node.id)`, never a type name; the private mock-state seeding loop seeds both of a listbox's fields.
- [x] `compiler/emit.js`: a `"list"`-behavior node's selection field (`valueFieldOf`) and derived scroll field (`scrollFieldOf`) are both declared in a generated application's state, seeded to `0`.
- [x] `tests/listbox.test.js` (new, 11 cases): registry facts, a direct `computeGenericLayout()` check that a listbox clips/scrolls its items exactly as a viewport does, the controller's click-vs-drag/wheel/disabled cases, and the draw kind's measure/backing/selected-tint/scrollbar-track behavior against fake canvas/asset stubs.
- [x] `tests/componentTypes.test.js`: `listbox` removed from the "still declared, not implemented" list (spec 016/017/018/019 comment updated to match).

## Evidence

`node --test "v2/tests/*.test.js"`: 210 tests, all passing, up from 199.

`node v2/build.mjs app`: succeeds, 24 loose ends, unchanged - nothing in `app.yaml` authors a listbox yet, so no generated module or state field it would add shows up in this count.

**No browser verification.** Checked directly in this environment: `node -e "require.resolve('playwright')"` fails (`MODULE_NOT_FOUND`), and no `chromium`/`chromium-browser` binary is on `PATH`. Every P5 spec before this one (013-018) verified its interaction mechanism - drag, wheel, double-click, the vertical `rangeSlider`'s geometry bug - against a real, rendered browser; none of that happened here. What did happen instead: a direct `computeGenericLayout()` test (`tests/listbox.test.js`) proving four items in a fixed-height listbox produce the same clip/extent/offset shape spec 013's own viewport test proves, and unit-level controller tests exercising the exact input sequences a real pointer would produce (press-then-release-in-place selects; press-then-drag scrolls and never selects; wheel stops at either end). This is real coverage of the logic, but it is not the same claim as "clicked a real canvas in a real browser and the right item got selected," and the gap is recorded here rather than papered over.

## Found while doing it

- **Reusing `viewport`'s single scroll `field` for a listbox would have been a real bug, caught by reasoning through the design before writing any code, not by a failing test afterward.** A viewport's `field` is its only piece of state; a listbox needs two (selection, scroll position), and only one is meant to be externally readable/writable state. The two-field split (`field` for selection, `scrollFieldOf(node)` derived and unauthored for scroll) was designed in from the start for exactly this reason - see design.md's "Two fields, not one".
- **The pointer-routing generalization was the one piece of this spec that could not be scoped down.** A listbox's items are ordinary nodes of any type by design (spec 016's own decision, upheld here per LST-004), which means most items have no controller, which means the pre-019 "feed the gesture to whatever the hit-test found" routing would silently do nothing for a click on a bare `label` item. There was no smaller version of `controllableTarget()` that would have made LST-001/LST-004 both true; the alternative would have been forcing every item to be individually interactive, which spec 016 explicitly declined to require.
- **Everything else matched the plan going in**: the `clips: true` reuse needed no `genericLayout.js` change at all (confirmed by reading it before writing anything, not discovered by a failing test), and `drawScrollThumb`'s extraction from `background` was a pure move, verified by the full suite passing unchanged for every pre-existing `background`/viewport test.

## Known limits

Drag-to-reorder, dedicated up/down buttons, custom per-row rendering, `centerSelection` mode and hover-row tinting are all deliberately not implemented (requirements.md's scope decision). Nothing in `app.yaml` authors a listbox yet. No browser verification occurred in this environment (see "Evidence" above) - this is this spec's most significant open item, and should be the first thing re-checked once a Playwright-capable environment is available, ahead of trusting the interaction model for a real screen.
