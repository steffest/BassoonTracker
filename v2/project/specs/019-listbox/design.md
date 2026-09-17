# 019 — Design

## The registry entry

```js
listbox: {
    implemented: true,
    container: { childrenIn: "items" },
    styled: false,
    interactive: true,
    behavior: "list",
    direction: "column",
    clips: true,
    cursor: "default",
    draw: "listbox",
    properties: { field: {...}, reorderable: {...} }
}
```

`clips: true` is the whole reason this spec needed no change to `runtime/genericLayout.js` at all: `clipsContent()` already gates on that generic flag, not on `node.type === "viewport"`, so a listbox's items are laid out, translated by a scroll offset and clipped by `layoutViewport()` exactly as a viewport's content already is. `styled: false` matches `knob`'s precedent - no skin artwork exists for a listbox's own chrome (a backing, a selected-row tint, a scrollbar), so it is drawn with plain canvas primitives.

## Two fields, not one: selection and scroll must not collide

A viewport's single `field` holds its scroll offset. A listbox needs two numbers - which item is selected, and how far it is scrolled - and only one of them, the selection, is meant to be authored state an action can read. Giving both purposes to one `field` would mean dragging the list to scroll it silently overwrites its selection (or the reverse), which is not what v1 did either: `_visibleIndex` (scroll) and `_selectedIndex` (selection) were always two separate private fields on the same `ListBox` instance, and only the selected index was ever exposed (`getSelectedIndex()`/`onChange`).

`runtime/listController.js`'s `scrollFieldOf(node)` returns `` `scroll.${node.id}` `` - derived from the node's own id, never authored, so it cannot collide with whatever `field` the author wrote (or with `valueFieldOf`'s own derived fallback, `` `value.${id}` ``, if `field` is omitted). Every place that used to read/write a viewport's scroll offset through `node.field` now branches on the node's behavior name first:

```js
// mountGeneric.js, four call sites: relayout()'s scrollOffset callback,
// scrollInfoOf(), applyScroll(), and the private mock-state seeding loop.
const field = behaviorNames.get(node.id) === "list" ? scrollFieldOf(node) : node.field;
```

`compiler/emit.js` declares both fields for a generated application's state store: the selection at `valueFieldOf(node)` (the same resolution a value control's field already gets, so a listbox with no authored `field` still works, exactly as an unbound slider does) and the scroll offset at `scrollFieldOf(node)`, both seeded to `0`.

## Selection: click-to-select on a listbox whose items usually cannot click at all

`radioGroup`'s selection works because every `radioItem` is itself `interactive: true` and dispatches its own click, which `mountGeneric.js`'s `dispatch()` already special-cases ("a click on an `exclusiveWithinParent` node sets its group's field"). A listbox's items are ordinary nodes of *any* type (LST-004), so most have no controller and would never receive a click at all under the pre-019 routing: `handlePointerDown`/`handlePointerMove` only ever fed a gesture to a node that itself had a controller, and captured the gesture on that exact node's id.

The fix generalizes routing, not selection: `controllableTarget(hitId)` walks the hit node's ancestry (`ancestryChain`) for the nearest id (including itself) that has a controller, and every pointer-down/move site now routes through it instead of the raw hit id:

```js
function controllableTarget(hitId) {
    if (!hitId || controllers.has(hitId)) return hitId;
    const chain = ancestryChain(root, hitId) || [];
    for (let i = chain.length - 2; i >= 0; i--) if (controllers.has(chain[i])) return chain[i];
    return hitId;
}
```

This is the same "bubble to whatever can handle it" rule a native `<select>`'s options or a native `<button>`'s inner `<span>` give their contents for free, expressed generically: it returns the hit id unchanged whenever that id already has a controller (every pre-019 type: no behavior change) or nothing in its ancestry does (a click on a plain, uncontained background: also no behavior change). The only new case is a hit node with no controller of its own but an ancestor that has one - which, before this spec, could only be a `panel` (never interactive) - and now can also be a listbox item.

Once routing reaches the listbox, `contextFor()`'s existing per-behavior extras (already how a `"value"` node gets its bounds and a `"scroll"` node gets its extent/offset) gain a `"list"` branch that also resolves which authored item, if any, the original point landed inside:

```js
function itemIndexAt(node, point) {
    for (let i = 0; i < (node.children || []).length; i++) {
        const rect = rectOf(node.children[i].id);
        if (rect && pointIsInside(rect, point)) return i;
    }
    return null;
}
```

This is a direct rect scan over the listbox's own children, not another call into `hitTestPoint()` - it only ever needs to ask "which of *my* children", never "what is under the pointer across the whole tree", and it naturally excludes a scrolled-off item without any extra bookkeeping, because that item's laid-out rect (translated by the scroll offset, from `layoutViewport()`) is already outside the listbox's own box.

`runtime/listController.js`'s `"pointerdown"` case captures the resolved `itemIndex` (alongside the scrollbar-drag anchor state it already needs, copied from `scrollController.js`'s own `anchor` shape); its `"pointerup"` case reports that index as `value` only when the gesture never became a drag (`!input.dragged`), which is how `feed()`'s existing `applyValue(node, result.value)` branch dispatches the listbox's `change` action - no new mechanism there either.

## Drawing: an unstyled backing, a selected-row tint, and a shared scrollbar thumb

`renderers/canvas/mountGeneric.js`'s `visualStateOf()` gains a `"list"` branch mirroring `"scroll"`'s (`extent`/`offset` for the thumb) plus the selected item's absolute rect, resolved the same way `itemIndexAt` is *not* needed to resolve it: the renderer already knows every child's rect from `layoutResult`, so it looks the selected child up directly by index rather than hit-testing for it.

`renderers/canvas/drawKinds.js`'s `listbox` draw kind draws, in order: a translucent dark backing over its own rect; the selected row's tint, clipped to the listbox's own box with an explicit `ctx.clip()` (not the renderer's outer per-node clip, which is a no-op here since the listbox's own clip already equals its own rect - the selected item's rect can be *outside* that box when scrolled off, and without this inner clip its tint would paint outside the list); and a scrollbar thumb via a new shared `drawScrollThumb(ctx, assets, style, rect, state)`, factored out of `background`'s existing inline viewport-thumb code so a viewport and a listbox can never draw a thumb differently. `background`'s own behaviour is unchanged - the refactor moves code, it does not change what either draws.

## What this deliberately does not do

- **No drag-to-reorder, up/down buttons, `centerSelection`, custom row rendering or hover-row tint.** See requirements.md's scope decision.
- **No change to `radioGroup`/`radioItem`'s own selection path**, `dispatch()`'s `exclusiveWithinParent` branch, or any other interactive type's routing - `controllableTarget()` only changes outcomes for a hit node that has no controller but an ancestor that does, a case no pre-019 type creates.
- **No browser verification.** This environment has no Playwright/Chromium install (checked directly: `node -e "require.resolve('playwright')"` fails, no `chromium`/`chromium-browser` binary on PATH). Every prior P5 spec (013-018) verified its interaction mechanism against a real, rendered browser; this one is verified by the unit suite plus a direct `computeGenericLayout()` integration test proving the clip/scroll math end-to-end, and by `node build.mjs app` still succeeding. That is a real gap against this project's own established verification bar, not a substitute for it, and is recorded as such rather than described as equivalent.
