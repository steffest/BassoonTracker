# 009 — Component registry

Date: 2026-09-10. Kind: feature. Status: specified. Builds on 005 (compiler, outline, canvas renderer, workbench), 007 (emitter) and 008 (skin styles). Delivers the half of spec [002](../002-component-authoring/requirements.md) that was never implemented: a machine-readable component contract.

## Purpose

Adding a component type to v2 currently means editing six hardcoded lists that do not know about each other:

| where | what |
|---|---|
| `compiler/convert.js` | `SUPPORTED_TYPES`, `STYLED_TYPES`, `RESERVED_KEYS`, and a per-type `if` chain |
| `compiler/emit.js` | a five-way ternary picking the runtime factory |
| `runtime/genericLayout.js` | `isRow()`, which special-cases `radioGroup` |
| `renderers/canvas/mountGeneric.js` | `INTERACTIVE_TYPES`, the draw chain, the measure chain |
| `runtime/components.js` | one exported factory per type |
| `workbench/stateGallery.js` | its own copy of `INTERACTIVE_TYPES` |

The v1 application needs about thirty more types than the four v2 renders. At six edit sites each, with no contract to check an authored property against, that is the single largest obstacle to porting. Two smaller consequences are already visible: an unknown key on a leaf component silently becomes a bogus child node with a misleading diagnostic, and a type the project has *planned* (`menu`, `spinBox`, both already authored in the current source) is indistinguishable from a typo.

This spec makes the component catalogue one declaration per type, read by everything else.

## Decisions

- The registry is code, not authored YAML. It describes what the runtime can do, so a YAML declaration could not make the renderer able to draw a type. Appearance stays authored (spec 008's skin), usage stays authored (`app.yaml`); the *contract* is code. It lives in `runtime/` beside `skinModel.js`, so the compiler and the renderer share it without the renderer importing the YAML parser.
- A type may be declared without being implemented. That is how a planned type is recorded, and it is what `menu` and `spinBox` become: their properties are validated and documented, and the renderer draws its existing placeholder.
- Adding a type must not require editing the compiler, the emitter, the layout engine, the renderer's dispatch or the workbench. A type whose visuals are new still needs one draw function, and a type with artwork still needs skin styles; both are single-purpose files.

## User stories and acceptance

- **CMP-001 — One declaration per type:** As a developer, each component type is described once: prose description, whether it is implemented, whether it contains children and how they are authored, whether it carries skin artwork, whether it is interactive, its layout direction, its draw kind, its runtime factory, and its authorable properties with kinds and descriptions. Acceptance: the registry is the only place any of those facts appear; a unit test asserts every implemented type has a draw kind, a factory and a style type, and that no property name collides with the universal ones.
- **CMP-002 — The compiler validates against the contract:** As an author, a mistyped property on a component is reported as a mistyped property. Acceptance: an unknown key on a leaf component produces one `unknown-component-property` warning naming the type and the key, at that key's source range, and produces no child node; a container's unknown keys remain named child slots, exactly as `app.yaml` authors them today; `unsupported-component` distinguishes "declared but not implemented yet" from "no such type", and the message says which.
- **CMP-003 — Every consumer reads the registry:** As a developer, the six lists above are gone. Acceptance: `SUPPORTED_TYPES`, `STYLED_TYPES`, `RESERVED_KEYS`, `INTERACTIVE_TYPES` (both copies), `isRow`'s type check and the emitter's factory ternary are replaced by registry lookups; the compiled outline, the generated app and the rendering are unchanged for the current source.
- **CMP-004 — Adding a type is one file:** As a developer, I add a component type by adding a registry entry. Acceptance: a test greps the source tree for the type name added by this spec and asserts it appears only in the registry, the skin document, the tests and the documentation, and in no compiler, runtime, renderer or workbench module.
- **CMP-005 — The catalogue is visible in the workbench:** As an author, a Components tab lists every registered type with its description, status, container shape, styling, interactivity, properties and the application nodes using it. Acceptance: every registry entry appears; each property shows its kind and description; selecting a type lists its instances and can select one in the preview; a type with skin styles links to the Skin tab; the tab is read-only and works on a static host.
- **CMP-006 — A new type proves the seam:** As a developer, `checkbox` is added through the registry alone. Acceptance: it compiles, validates its properties, resolves a skin style, draws its on and off artwork from the authored skin, takes part in the variant library, and appears in the catalogue, with no type-specific code outside the registry and one draw kind.
- **CMP-007 — No regressions:** Acceptance: the unit suite passes; the compiled outline for the current source is identical except for the new diagnostics and registry-derived fields; the browser scenarios from spec 008 still pass.

## Non-functional requirements

No new dependency. The registry is data plus pure functions, with no DOM, no filesystem and no parser, so it is testable in plain Node and safe for the shipped application. Diagnostics stay warnings: an unknown type or property must never fail a compile. The generated app keeps importing named factories, so its readability is unaffected.

## Scope boundaries

In scope: the registry, its adoption by the compiler, emitter, layout engine, canvas renderer, runtime factories and workbench, the property-validation diagnostic, the catalogue tab, `checkbox` as the proof, and documentation.

Out of scope: implementing `menu`, `spinBox`, `listbox` or any other declared type; an authored `layout.direction`; the overlay, z-order and clipping work those types need; editing properties from the workbench (the catalogue is read-only, as spec 002's property editing remains pending); YAML-authored type declarations; the DOM renderer.
