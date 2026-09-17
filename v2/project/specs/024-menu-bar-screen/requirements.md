# 024 — the menu bar screen

Date: 2026-09-11. Kind: feature. Status: specified. Implements the fifth of P5's six named screens - the one spec 022 deferred and spec 023 unblocked: "the menu bar needs `menu` itself promoted from a placeholder first." That promotion is done; this spec authors the actual content.

## Purpose

`script/src/ui/app/menu.js` builds v1's real File/Edit/View/Help bar: four top-level items, each a `Submenu`, with "Edit" nesting a fifth, "Clear" (Track/Pattern/Song/Instruments). `app.yaml`'s own `top` panel already had a `menu:` node - added early, before `menu` existed, as a two-item compiler-testing fixture (`item1`/`action1`, `item2`/`action2`) wrapped in a one-off "File" submenu by spec 023 so that fixture would keep demonstrating an unresolved action reference once `menu` actually rendered. This spec replaces that placeholder with the real File/Edit/View/Help content, read from `app_menu.js` directly rather than reconstructed from memory.

## User stories and acceptance

- **MENUBAR-001 — The real menu bar is authored:** As a user, the top bar shows File, Edit, View and Help; each opens its own submenu with v1's own item labels; Edit's own "Clear" opens a further nested flyout of Clear Track/Pattern/Song/Instruments. Acceptance: the compiled tree has all four top-level items and Clear's own nesting, verified by a compiler test; `node build.mjs app` succeeds.
- **MENUBAR-002 — Every command a prior screen already introduced is shared, not duplicated:** As an author, `Clear Track`/`Clear Pattern` reuse the exact command names (`track.clear`/`pattern.clear`) spec 022's edit pad already established, rather than inventing parallel ones; `Clear Song`/`Clear Instruments` extend the same `verb-action` recipe (spec 022) to two subjects it did not happen to need before. Acceptance: `track.clear`/`pattern.clear` appear as a single mocked command each, reachable from two different authored places.
- **MENUBAR-003 — No regressions:** Acceptance: the unit suite passes; every other screen and mechanism (specs 013-023) is unaffected; `node build.mjs app`/`dist` succeed to the same extent they did before this spec.

## Non-functional requirements

No new component type, draw kind, or runtime mechanism - spec 023 already built everything authoring a real nested menu needs. This is pure authoring, like spec 022's four screens, with the same expectation that most of the bar's individual commands (`new file`, `show options`, `undo`, ...) have no existing recipe or capability and are legitimately reported as unresolved, exactly as `action1`/`action2` always were - a real menu with two dozen commands is not an opportunity to invent two dozen new recipes for commands nothing can execute yet.

## Scope boundaries

In scope: `app.yaml`'s `menu:` node, replaced with the real File/Edit/View/Help/Clear content.

Out of scope, unchanged from spec 022's own boundaries: the vumeter and the Key/Midi indicators (already present in `app.yaml` as `volume meter`/`notification light` placeholders, neither this spec's concern); the control panel (still needs a declared breakpoint mechanism and a view-routing concept, per spec 022); real behavior behind any authored command (P6/P9); hover-driven submenu switching and arrow-key navigation (spec 023's own recorded gaps). Browser verification: not performed, for the same reason specs 019-023 recorded none.
