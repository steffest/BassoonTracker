# 008 — Skin assets, component styles and the skin editor

Date: 2026-09-10. Kind: feature. Status: specified. Builds on 005 (compiler, outline, canvas renderer, workbench) and 007 (generated app and bundle).

## Purpose

Today a v2 skin asset is a name in one opaque sprite sheet: `renderers/canvas/assets.js` hardcodes `skin.getSprite("button_inlay")`, the font's atlas coordinates and the 9-slice insets, and nothing records which artwork file that name came from. An author cannot see, from the workbench, which PNG draws the Play button, and cannot change it without editing renderer code.

This spec makes artwork a first-class, traceable part of the authored application:

- every skin asset is one source PNG file, referenced by name from YAML;
- development loads those single PNGs directly, so replacing artwork needs no build step;
- the release keeps today's shape, one bundled PNG plus one map file, generated from exactly the referenced sources;
- how a component *looks* per visual state becomes authored data (a **style**), not renderer code;
- a component in `app.yaml` links to a style variant by name (`style: play`), and the workbench shows that link in both directions;
- the workbench gains a section for reading and setting a style's properties, and the component library renders every variant in every state.

## Decisions (user, 2026-09-10)

- Each skin asset traces to its own source PNG file. Dev time loads the single PNGs through the skin loader; build/compile time bundles them into one PNG plus a map file, as is the case now.
- Render behavior for the canvas renderer is editable from the workbench: the YAML links a component to a button *type* (e.g. `play`), and a separate workbench section sets that type's properties, including the background PNG per state (normal, active, active_hover, ...).
- The workbench links a button type to its graphical representation description.
- The component library render includes all varieties.

## User stories and acceptance

- **SKN-001 — Asset traceability:** As an author, every skin asset names exactly one source PNG, and I can see which file and which YAML line. Acceptance: the compiled skin lists each asset with its source file path and every authoring site that referenced it; the workbench shows the file name for each state and opens the referencing YAML line; an asset with no matching PNG produces a source-located `unknown-skin-asset` warning and renders a visible placeholder rather than failing.
- **SKN-002 — Development-time single PNGs:** As an author, the running preview loads individual PNGs. Acceptance: `app.html`, `preview-app.html` and the workbench preview request one `assets/skin/src/<name>.png` per referenced asset and no sprite sheet; replacing a PNG on disk and reloading shows the new artwork with no build step and no regeneration; a failed image load is reported once and leaves the rest of the UI drawable.
- **SKN-003 — Build-time bundle:** As a developer, `node v2/build.mjs skin` packs exactly the referenced assets into one PNG and one JSON map. Acceptance: the map lists every asset with `x/y/width/height` matching the source PNG's dimensions; the generated app (`v2/app/`) and bundle (`v2/dist/`) load the atlas and request no `src/` PNG; rendering is pixel-identical to development mode; the packer is plain Node with no dependency; `build.mjs app` and `dist` run it as part of the build.
- **SKN-004 — Authored component styles:** As an author, a style says how one component type looks: description, 9-slice insets, default size, label placement, and one asset per visual state, with `extends` to derive a variant from another. Acceptance: `skin/default.yaml` defines `button/default`, `button/play`, `button/record`, `panel/default`, `radioItem/default` and the small font; a variant that extends another inherits every unspecified property; unknown properties and unknown state names produce source-located warnings and are ignored.
- **SKN-005 — Component to style link:** As an author, I write `style: play` on a button in `controlBar.yaml` and that button uses the play artwork. Acceptance: the node in the outline carries `style: { type, variant }` plus the source range of the `style:` line; an unknown variant warns (`unknown-style-variant`) and falls back to that type's `default`; a component with no `style:` uses `default`.
- **SKN-006 — Style-driven drawing:** As a developer, the canvas renderer takes its pixels from the style, not from constants. Acceptance: state resolution follows one documented chain (disabled → active+pressed → active+hover → active → pressed → hover → normal, each falling back to the next); a state with its own asset draws that asset with no tint; a state without one keeps today's tint/dim/offset over `normal`, and the workbench says which of the two happened.
- **SKN-007 — Skin section in the workbench:** As an author, a Skin tab lists every style by type and variant with its description, shows each state's PNG preview, asset name and source file, and lets me set a state's PNG from the available sources. Acceptance: choosing a PNG rewrites exactly that scalar in the buffer for `skin/default.yaml`, marks it unsaved, and Save & Refresh regenerates and repaints the preview; a state the style does not define yet can be added the same way; nothing is written without an explicit save; the panel is read-only on a static host, like the editor.
- **SKN-008 — Component library shows all varieties:** As an author, I see every variant of a component in every visual state, drawn by the live renderer. Acceptance: the Skin tab renders a variant × state matrix using the same draw function as the application; the State gallery uses the selected node's own variant; the details panel shows the selected node's style with links to its YAML definition and to the Skin tab; each cell reports whether it used a dedicated asset or a fallback effect.
- **SKN-009 — No regressions:** Acceptance: the existing unit suite passes; the spec 003 preview (`preview.html`, `outline.json`, `renderers/canvas/mount.js`), which has no authored skin, keeps working through a documented built-in fallback; a missing or unreadable `skin/default.yaml` warns and falls back to that same built-in skin rather than failing the compile.

## Non-functional requirements

No new runtime or build dependency: the PNG decoder/encoder/packer is project-owned plain Node, adapted from the parent repository's `skin/generate.js` with provenance recorded. Source PNGs live under `v2/assets/skin/src/` (copies, with provenance), because all v2 edits stay inside `v2`. The runtime loads no compiler or packer code, and loose mode is a development path only: the generated app and the bundle always use the atlas. Style data is authored YAML under `project/specs/application/current/`, so the existing file tree, editor, lint, save, conflict and hash machinery apply unchanged.

## Scope boundaries

In scope: skin YAML source and compilation, asset traceability, loose and atlas loading, style-driven button/panel/label/radio-item drawing, the packer, build wiring, the workbench Skin section with per-state PNG selection, the variant × state library render, documentation and tests.

Out of scope: multiple selectable skins at runtime, per-user theming, editing the artwork itself, sprite-sheet hot reload, a DOM renderer's stylesheet equivalent, animated or state-transitioned assets, reverse synchronization from generated code to YAML (deferred by spec 005), and full property editing for every component type (spec 002's schema work).
