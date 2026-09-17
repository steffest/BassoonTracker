# 023 — Design

## The structural finding, before any code

v1's `Menu.setItems()` creates a `Submenu` and adds it as a child of `this._submenuParent` (the menu's own *parent*, usually the top toolbar panel) - never as a child of the clicked button. The button (drawn inline, part of `Menu.render()`) and the `Submenu` (a whole separate `UIElement`) are linked only by `item.subMenu`, a plain object reference. This is why "author a menu item directly as `type: submenu`" - the obvious first idea, since `submenu` already exists and already does everything a flyout needs - cannot work as stated: spec 013 excludes every `layer: "overlay"` node from in-flow layout entirely (a closed overlay gets no rect at all, spec 020), so a bare `submenu` item would never have anywhere to show its own "File" button, open or closed.

The fix keeps the idea (author the item as `type: submenu`, since that already gives it the right contract - its own `items:`, its own modal/overlay mechanism) and adds exactly what v1's two-object design supplies for free: a separate, in-flow, clickable trigger. `runtime/overlaySynthesis.js` builds it, the same way it already builds a dropdown's popup - one authored node becomes two synthesized ones - just in the opposite direction: there, the popup is new and the items move into it; here, the *trigger* is new and the original `submenu` node moves under it, unchanged.

## The wrapping

`wrapsFlyoutItems: true` (a new registry fact, set on `menu` and `submenu`) says "when this container synthesizes, look at its own children for anything whose type declares `isMenuFlyout`" (a second new fact, set only on `submenu`) "and wrap it." `synthesizeMenuTriggers(node)` does the wrapping: for each such child, it builds a `menuTrigger` carrying the child's own label/tooltip/source, gives it a derived id (`${child.id}.trigger`, so it can never collide with the child's own), sets one instance property (`popupEdge`, decided once here from the *wrapping* container's own row/column direction - "below" for `menu`'s row, "right" for `submenu`'s column, mirroring the same authored-direction-then-declared-direction order `runtime/genericLayout.js`'s own `isRow()` uses, without importing it, since this module has no rect to lay out), and makes the original child its sole synthesized child.

`overlaySynthesis.js`'s own `visit()` recurses into every node's children *after* synthesizing that node, so a `menuTrigger`'s synthesized child (still `type: submenu`) is visited in turn, and if *that* submenu declares `wrapsFlyoutItems` (it does), its own children get exactly the same treatment - which is how "Edit > Clear > Clear Track" (three levels) needs no recursion-depth-specific code at all, just the one rule applied wherever it matches.

Nothing about this touches `synthesizeDropdown`/`synthesizeModalDialog` (spec 020) or their own gating; `wrapsFlyoutItems`/`isMenuFlyout` are independent facts, checked separately, in the same `visit()` pass.

## Reusing "disclose" instead of adding a controller

A `menuTrigger`'s own click is exactly `dropdown`'s own closed-control click: a plain press/release/Enter/Space activation whose *meaning* (open/close a synthesized popup, anchored to itself) already exists as the `"disclose"` behavior name (spec 020, aliasing the plain button controller). `menuTrigger` simply declares `behavior: "disclose"` too - no new controller file, no new behavior name.

Two small, additive changes to `mountGeneric.js`'s existing "disclose" activation branch cover what a dropdown's own click never needed:

- **`node.popupEdge || "below"`** replaces the hardcoded `"below"` the branch already passed to `toggleOverlay`. A dropdown never sets `popupEdge`, so it is unaffected; a `menuTrigger` always does (set once, at synthesis time, never re-derived per click - a `menuTrigger`'s own parent never changes after mounting).
- **Exclusive sibling-closing**, gated on the *parent's* own `exclusiveOverlayChildren` fact: before opening, look at the activating node's siblings (the parent's other children); if a sibling's own synthesized popup is open, close it. A lone `dropdown` sitting in an ordinary panel has a parent that never sets this fact, so the loop finds nothing to close and the branch is a no-op for every `dropdown` that predates this spec - verified by the existing spec 020 tests continuing to pass unchanged.

`textOf()` gained one guard for the same sharing: `dropdownSelectedLabel()` (spec 020) only applies when `node.field` is set, which is true for every dropdown (synthesis always assigns one) and never true for a `menuTrigger` (it has nothing to select), so a menu item now falls through to its own plain authored label instead of asking a dropdown-shaped question with nothing to answer it.

## Why `compiler/convert.js` needed no change

`menu`'s contract changes from spec 016's placeholder-only `{ childrenIn: "items", itemActions: true }` to the same bare `{ childrenIn: "items" }` `listbox`/`dropdown`/`submenu` already use (`itemActions` only ever existed so a *declared-but-undrawn* type's item actions could be validated without inventing real nodes - exactly `menu`'s own situation before this spec, and still exactly right for any future type in that position). With the bare shape, an item authored `{ label: File, type: submenu, items: [...] }` already goes through `convertContentItem()` → `convertComponentMap()`, which resolves `type: submenu`, looks up *its* contract (also bare `{ childrenIn: "items" }`), and recurses into its own `items:` - the exact same call the top-level `menu`'s own items already made. Nesting to any depth is a consequence of that one shape being reused, not a new code path.

## What this deliberately does not do

See requirements.md's scope boundaries: the menu bar screen itself, hover-driven switching between open top-level submenus, arrow-key navigation. One more, found while designing rather than assumed: v1's `Menu.onHover` also *switches* an already-open submenu to the hovered item with no click at all (`if (this._activeIndex >= 0 && this._activeIndex !== selectedIndex) this.activateSubmenu(selectedIndex)`); this spec's click-only mechanism does not attempt that continuous case, recorded above as its own gap rather than silently narrowed.
