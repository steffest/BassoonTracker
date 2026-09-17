# 017 — Leaf types: icon, image, animSprite

Date: 2026-09-11. Kind: feature. Status: specified. Implements the first implementing cluster of package **P5** of spec [010](../010-port-roadmap/requirements.md), the port roadmap, following spec [016](../016-catalogue-declarations/requirements.md)'s declaration pass.

## Purpose

Spec 016 declared fifteen remaining v1 types with contracts and `implemented: false`. Its design.md put the dependency order in writing: simple leaves first, since they need no new mechanism (or, for one of them, the smallest piece of new mechanism in the whole list). This spec promotes three of those fifteen to `implemented: true`: `image` (a named sprite, drawn plain or stretched), `icon` (the same drawing, under the property name a listbox row template will want), and `animSprite` (a frame strip stepped on a timer).

`numberDisplay`, the fourth type spec 016's design.md grouped with these as "simple", turned out not to be: it is a real editable control (bounds, a caret, digit filtering) whose controller reuse is explicitly an open question in its own contract. Promoting it alongside three leaf types that draw a picture and nothing else would have buried a real design decision inside a spec framed as "the easy ones." It is left for its own spec, a scope correction recorded here rather than silently done.

## Scope decision

`icon` and `image` are the same operation - draw a named skin asset, plain or stretched, with optional alignment - under two different authored names, so they share one draw kind (`renderers/canvas/drawKinds.js`'s `image`). Nothing about the registry's dispatch needed to change for that: a draw kind is already named once per type and looked up generically.

`animSprite` needed one real piece of new mechanism: v2's renderer redraws on state changes and input, and has never had a per-frame animation clock. `runtime/animationClock.js` is that clock - pure arithmetic, no timer, no DOM - and it is driven by the same generic idea a value control's field or a viewport's scroll offset already use: the current frame lives in the node's bound `field`, so the draw kind reads it exactly the way a slider's draw kind reads its value, and nothing outside `runtime/componentTypes.js`'s registry has to know `animSprite` exists to do it. A new registry flag, `animated: true`, says which types the renderer's clock owns; it is deliberately independent of `interactive`, since a frame counter takes no pointer or keyboard input at all.

## User stories and acceptance

- **LEAF-001 — An image draws a named sprite:** As an author, `type: image, src: some_asset` draws that asset, centred by default (or aligned by `horizontalAlign`/`verticalAlign`) or stretched to fill with `scale: stretch`. Acceptance: both alignment modes and the stretch mode draw at the coordinates v1's own `UIImage` would use; an unresolvable `src` draws nothing and does not throw; the measured natural size is the asset's own size when one resolves, a small fixed fallback otherwise.
- **LEAF-002 — An icon is the same thing under its own name:** As an author, `type: icon, icon: some_asset` draws identically to `image`, reading the `icon` property instead of `src`. Acceptance: both types resolve through the same draw kind; a hand-built tree using either property draws the same asset.
- **LEAF-003 — An animated sprite steps through its frames on its own:** As an author, `type: animSprite, sprite: a_strip, frames: n, field: some.field` cycles through `n` frames left to right in the named strip, at `frameDelay` milliseconds per frame (default 120), for as long as the node is mounted, with no action or rule driving it. Acceptance: the current frame is clamped to `[0, frames-1]`; a large elapsed time (a backgrounded tab, a slow frame) catches up by the correct whole number of steps rather than skipping or drifting; the clock runs only while at least one `animSprite` node exists in the mounted tree, and stops on dispose.
- **LEAF-004 — No regressions:** Acceptance: the unit suite passes; every earlier draw kind's `measure()` still works with the extra `node` argument it now receives but does not have to use; the compiled outline's existing nodes do not change shape; `node build.mjs app` still succeeds with the same loose-ends count, since nothing in `app.yaml` authors any of these three yet.

## Non-functional requirements

`runtime/animationClock.js` is pure and DOM-free, unit-tested without a browser, matching every other timing module in `runtime/` (the pointer router's double-click window, the playback scheduler's lookahead). The renderer owns the one `requestAnimationFrame` loop and only starts it when a mounted tree actually has an animated node. No component type is named outside the registry: `mountGeneric.js`'s animation-clock code filters on `isAnimatedType()`, never on a type name.

## Scope boundaries

In scope: `image`, `icon`, `animSprite`, the shared `image` draw kind, the animation clock, and the `measure()` signature's new (optional, backward-compatible) `node` parameter.

Out of scope: `numberDisplay` (its own spec, see above), any compiler-side registration of an authored `src`/`icon`/`sprite` value into a real skin's asset list (`compiler/skin.js` only tracks assets a style's `states:` block or a font references today; an `image`/`icon`/`animSprite` instance names an asset directly, which is a real gap but a consequence-free one until a screen actually authors one - recorded as a known limit, not fixed here), and any authored use in `app.yaml`.
