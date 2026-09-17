# 019 — listbox

Date: 2026-09-11. Kind: feature. Status: specified. Implements the third implementing cluster of package **P5** of spec [010](../010-port-roadmap/requirements.md), the port roadmap, following spec [017](../017-leaf-types/requirements.md)'s leaf cluster and spec [018](../018-value-controls/requirements.md)'s value-control cluster.

## Purpose

`listbox` (`script/src/ui/components/listbox.js`, 399 lines) is spec 016's own description of it: "the largest of the fifteen; real screens need it" - the song list, the sample list, the disk browser all need a scrollable, selectable list before they can be authored. It is also the roadmap's "first real container-with-selection": unlike `rangeSlider`/`knob`, which reused an existing controller unchanged, a listbox holds authored children (`container: { childrenIn: "items" }`, already declared by spec 016) and must select one of them, which no existing type does in quite this shape - `radioGroup`/`radioItem` selects between children too, but every `radioItem` is itself interactive; a listbox's items are ordinary nodes of any type (spec 016 left the child shape deliberately unconstrained), most with no controller of their own.

## Scope decision

Three things v1's listbox does are deliberately not carried forward as behavior, all flagged rather than silently dropped:

- **Drag-to-reorder.** The `reorderable` property stays declared and validated (spec 016 already gave it a contract), but nothing in this spec wires it to a behavior. Reordering needs a real backing list to reorder *of*, and populating a listbox from data is P6's document-model job, not this one's - wiring drag-to-reorder ahead of that would be shaping the mechanism to a guess.
- **Its own up/down buttons.** v1 draws two small buttons that nudge `_visibleIndex` by one row. Once wheel, background-drag and thumb-drag all scroll the same box (LST-002 below), a redundant pair of buttons is a nicety, not a requirement the roadmap's own screens need to exist.
- **Custom per-row rendering, `centerSelection` mode and hover-row tinting.** v1's `itemRenderFunction`/`centerSelection` have no v2 equivalent need yet (items are real child nodes that draw themselves), and per-row hover tint would need a second piece of geometry tracking beyond the selected row's; the selected row's own tint is implemented, hover's is not.

None of these three block the roadmap's next screens from being authored; each is a real gap and is recorded as one in design.md/tasks.md, not implied to be finished.

## User stories and acceptance

- **LST-001 — Clicking an item selects it:** As an author, `type: listbox, field: some.field, items: [...]` puts the clicked item's index (0-based, in authored order) into `field` and dispatches that listbox's `change` action, the same mechanism a slider's value change already uses. Acceptance: a plain press-and-release on any item, including a non-interactive one (a bare `label`), selects it; a drag never selects.
- **LST-002 — The list scrolls by wheel, background-drag and a thumb, exactly as a viewport does:** As an author, a listbox taller-than-its-content needs no extra property to scroll - it reuses `genericLayout.js`'s existing `clips` mechanism (the same generic flag a `viewport` sets, not a name check) unchanged. Acceptance: the wheel, dragging the list's own background, and dragging its scrollbar thumb all move the same offset; an offset that would lose the content is clamped, exactly as a viewport's already is.
- **LST-003 — Scrolling can never disturb the selection:** As an author, `field` holds only the selected index; the scroll position is not authored state and lives at a name derived from the node's own id, so no gesture that moves the list can also silently change what is selected, and vice versa. Acceptance: dragging/wheeling the list changes only its scroll offset; clicking an item changes only `field`.
- **LST-004 — Items are ordinary nodes of any type:** As an author, an `items:` entry can be any registered type (a `label`, a `panel` with children, an `icon` beside a `label`) - spec 016's decision not to invent a `listItem` sub-type is upheld, not revisited. Acceptance: a click on any point inside an authored item, interactive or not, reaches the listbox that contains it.
- **LST-005 — No regressions:** Acceptance: the unit suite passes; `viewport`'s own scrolling, `radioGroup`/`radioItem`'s own selection, and every other interactive type's click/drag/wheel routing are unchanged, since the routing change this spec makes only takes effect when a hit node has no controller of its own but an ancestor does - the case that did not exist before this spec.

## Non-functional requirements

No change to `runtime/genericLayout.js`: the clip/scroll/overflow mechanism spec 013 built and generalized already gates on a plain `clips` boolean, so declaring it for `listbox` is enough. The one generalization this spec does make to `renderers/canvas/mountGeneric.js` - routing a pointer gesture to the nearest ancestor with a controller instead of requiring the exact hit node to have one - is gated on "does a controller exist here", never on a component type name, and is a no-op for every type that predates this spec (a hit node that already has its own controller, or has no controllable ancestor at all, is routed exactly as before).

## Scope boundaries

In scope: `listbox`'s own controller (click-to-select, wheel/drag/thumb-to-scroll), its draw kind, the pointer-routing generalization LST-004 needs, and the emitter/preview state-field wiring for a generated application.

Out of scope: drag-to-reorder, dedicated up/down buttons, custom per-row rendering, `centerSelection` mode, hover-row tinting, and any authored use in `app.yaml` (nothing currently authors a listbox). Browser verification: not performed - this environment has no Playwright/Chromium install (checked; see tasks.md), so verification here is the unit suite plus a direct `computeGenericLayout()`/controller-level integration test, not a real-browser interaction scenario as specs 013-018 had.
