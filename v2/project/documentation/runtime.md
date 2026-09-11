# Runtime

Status: spec [003](../specs/003-live-workbench/requirements.md)'s runtime was **retired on 2026-09-10 by spec [011](../specs/011-retire-spec003-pipeline/requirements.md)**. What this document described (a JSON document validated and normalized into a fixed template, laid out by `runtime/layout.js` and drawn by `renderers/canvas/mount.js`, driven by a command registry) no longer exists. Spec 005's pipeline replaced it and is documented in [compiler.md](compiler.md) and [interactive-workbench.md](interactive-workbench.md).

This page now records what the runtime is, and keeps the provenance notes for the parts that survived.

## The runtime today

Everything under `v2/runtime/` is renderer-agnostic, DOM-free and unit-tested. Nothing here parses YAML: the compiler is a development-time tool.

| module | role |
|---|---|
| `componentTypes.js` | the component-type registry: what exists, what each accepts, how it is drawn (spec [009](../specs/009-component-registry/requirements.md), [components.md](components.md)) |
| `skinModel.js` | the skin vocabulary: visual states, their fallback chains, the built-in fallback skin, and the two pure style lookups (spec [008](../specs/008-skin-assets/requirements.md), [skin.md](skin.md)) |
| `components.js` | node constructors for generated and hand-written trees, plus the identity rule that mirrors the compiler's |
| `genericLayout.js` | measurement and layout for an arbitrary component tree: rows, columns, fill, fixed, auto, clips, viewports, overlays (spec [013](../specs/013-layout-foundations/requirements.md), [layout.md](layout.md)) |
| `hitTest.js` | pure hit-testing, ancestry chains, and pointer-to-logical mapping |
| `pointerRouter.js` | pure gesture recognition: capture, the drag threshold, the double-click window, secondary clicks (spec [014](../specs/014-pointer-interaction/requirements.md), [interaction.md](interaction.md)) |
| `behaviors.js` | the one table from a declared behavior name to a controller factory |
| `buttonController.js` | the `button` behavior: hover, pressed, focused, disabled, and what activates it |
| `valueController.js` | the `value` behavior: one bounded number moved by drag and wheel, plus the shared bounds and value-field resolution |
| `scrollController.js` | the `scroll` behavior: a viewport's requested offset from a wheel, a drag or its thumb |
| `scrollbar.js` | where a viewport's scrollbar and thumb are, shared by the draw kind, the controller and the cursor |
| `store.js` | a flat map of field path to value with per-field subscriptions |
| `appState.js` | the generated application's state: `store.js` plus a change notification for the renderer |
| `traceCollector.js` | a bounded ring buffer of interaction events for the workbench's Interaction log |

The canvas renderer sits in `v2/renderers/canvas/`: `mountGeneric.js` mounts a tree, `drawKinds.js` says how each kind of component paints and measures, `buttonSkin.js` resolves a visual state to artwork, `scale9.js` slices it, `skin.js` loads it, `assets.js` builds fonts and styles from the compiled skin, and `bitmapFont.js` blits glyphs.

## Provenance of the adapted code

Audited 2026-09-09 against `script/src/ui` (MIT, same repository; no separate header text found in the source files).

- `renderers/canvas/bitmapFont.js`: ported from `script/src/ui/components/bitmapfont.js`, trimmed to `generate`, `getTextWidth` and `write`. There is no `fillText` anywhere in v2's canvas code.
- `renderers/canvas/scale9.js`: reduced from `script/src/ui/components/scale9.js`'s `Scale9Panel` class to one `drawScale9()` function, stretch mode only. v1 uses the `repeatX`/`repeatY` tiling modes for slider tracks, which v2 will need when it ports those controls.
- `renderers/canvas/skin.js` and `assets/skin/`: artwork. Spec 008 replaced the two hardcoded atlas files with an authored skin: one source PNG per asset in development, one packed atlas in the release, and insets, label placement and font metrics read from `skin/default.yaml` rather than from constants. The legacy `assets/skin/{spritesheet_v6.png,spritemap_v6.json}` remain as the built-in fallback skin's artwork; the insets and "small" font metrics that fallback carries were copied from `script/src/ui/assets.js` and `script/src/ui/font.js`.
- `tools/skinAtlas.mjs`: adapted from the parent repository's `skin/generate.js` (PNG decode, shelf pack, scanline filter search, PNG encode).
- Deliberately not ported: the `UIElement` base class, the global `Assets`/`UI` singletons, `listbox.js`'s drag-reorder and scrollbar behaviour, and the application-wide animation loop in `ui.js`.

## What the retirement removed, and where it returns

Two capabilities existed only in the retired renderer. Both are recorded in spec [010](../specs/010-port-roadmap/design.md) so they are rebuilt deliberately.

- **Command enablement.** `runtime/commands.js` was a registry of commands that each answered whether they could run against the current state; the renderer drew a disabled control from it and the dispatcher refused to run one. The current pipeline dispatches through action bindings and lazy capability modules and has no equivalent. Spec 010's interaction and document-model packages need it back.
- **A semantic DOM layer.** `mount.js` positioned a real, visually transparent `<button>` over every control, which gave focus, accessible names, native Enter and Space activation and a `disabled` state for free, and it drew hover and focus back onto the canvas from those elements' events. `mountGeneric.js` has never had one: it uses a single focusable canvas with its own hit-testing and key handling. This is v2's whole accessibility story, and it currently does not have one. Spec 010's optional renderer package is where it returns.

## Verification

`node --test "v2/tests/*.test.js"`. The suite covers the modules above plus the compiler, the emitter, the skin, the atlas packer and the registry; the four test files whose subjects were retired went with them.
