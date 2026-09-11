# 009 — Implementation

Status: implemented and verified 2026-09-10.

## Phase 1 — The registry

- [x] `runtime/componentTypes.js`: eight entries, `UNIVERSAL_PROPERTIES`, and the lookups (`componentType`, `isKnownType`, `isImplemented`, `isContainer`, `childSlot`, `isStyledType`, `isInteractiveType`, `interactiveTypeNames`, `typeDirection`, `selectionModeOf`, `ownsModule`, `drawKindOf`, `knownProperty`, `acceptedKeys`, `isAnyKnownKey`, `typeEntries`). Data and pure functions; it imports nothing.
- [x] `tests/componentTypes.test.js`: entry completeness, drawability, the lookups, property classification, ordering, and the two seam tests.

## Phase 2 — The compiler reads it

- [x] `convert.js`: `SUPPORTED_TYPES`, `STYLED_TYPES` and `RESERVED_KEYS` deleted; children from `childSlot` (including a container whose items become a declared child type, and `menu`'s item actions); every key classified; `unknown-component-property`; `unsupported-component` split into "declared but not rendered yet" and "not a registered component type"; styling asked of the registry.
- [x] `emit.js`: one generic `component(type, props, children)` call per node, so the emitter keeps no type list; `ownsModule` and `selectionModeOf` replace its `panel`/`radioItem` checks.
- [x] `runtime/components.js`: `component()` exported as the general factory, the five named helpers kept for hand-written trees.

## Phase 3 — Layout and renderer read it

- [x] `runtime/genericLayout.js`: `typeDirection` first, the documented fixed-height default second.
- [x] `renderers/canvas/drawKinds.js`: `background`, `backgroundLabel`, `label`, `spriteLabel`, `none`, `placeholder`, each owning both its drawing and its measurement.
- [x] `renderers/canvas/mountGeneric.js`: draw and measure through the kind table; interactivity and radio selection from the registry.

## Phase 4 — Catalogue and the proof

- [x] `workbench/componentCatalogue.js` and the fourth tool tab; the details panel's `type:` row.
- [x] `stateGallery.js` and `skinEditor.js` read the registry instead of naming types; the Skin tab's library cells are drawn by each type's own draw kind.
- [x] `checkbox`: one registry entry, the shared `spriteLabel` kind, skin styles over the `checkbox_on`/`checkbox_off` artwork already present, plus a built-in fallback style.

## Phase 5 — Documentation and acceptance

- [x] `project/documentation/components.md`, plus the documentation index, specs index, product steering, `AGENTS.md`, `compiler.md`, `interactive-workbench.md`, `skin.md`, `component-authoring.md` and `project/progress.md`.
- [x] Full unit suite, full build, browser acceptance.

## Evidence

`node --test "v2/tests/*.test.js"`: 138 tests, 136 passing, 2 skipped (the pre-existing Windows symlink skips), up from 125/123 before this spec. Nine new registry tests and four new compiler tests.

**The outline did not change.** Regenerating after Phase 2 produced a byte-identical tree (19,730 bytes), the same thirteen diagnostics with the same codes, files, lines and order, and an identical compiled skin. Two messages were reworded on purpose, both for a declared-but-unimplemented type.

**The seam is tested, not asserted.** Two tests scan every module under `compiler/`, `runtime/`, `renderers/` and `workbench/` plus `build.mjs` and `server.mjs`:

- no module compares a `.type` against a registry type name (`renderers/canvas/mount.js` excluded: it renders spec 003's fixed template over schema-version-1 `outline.json`, whose node types belong to that schema);
- the type this spec added is named in no compiler, runtime, renderer or workbench module;
- `SUPPORTED_TYPES`, `RESERVED_KEYS`, `STYLED_TYPES` and a literal `INTERACTIVE_TYPES` set stay gone.

Both failed when first written, which is how three real leftovers were found: the emitter's `panel`/`radioItem` branches, the gallery's radio caption, and the Skin tab's hardcoded initial type. All three became declared properties (`container.ownModule`, `selection`) or registry-ordered lookups.

Browser run, 18 checks in one new scenario, all passing, plus the six spec 008 scenarios re-run at 72 checks:

| what | result |
|---|---|
| catalogue lists the registry | all eight types, planned ones marked, instance counts shown, "8 registered types, 6 implemented" |
| the new type | reads as implemented, describes its leaf/styled/interactive/`spriteLabel` contract, lists its universal properties, draws its own sample, links to the Skin tab, reports zero instances |
| container shapes | `panel` names `content:` plus named slots, `radioGroup` says each item becomes a `radioItem` and lays out as a row |
| a planned type | badge says "declared, not rendered yet" and its `min`/`max`/`step` contract is still listed |
| details panel | `type: button` with a working "show in Components" |
| the new type's artwork | `checkbox_off`/`checkbox_on` per state, every state cell draws, on differs from off |
| regressions | the app, generated app and bundle draw the Play region at exactly the pre-009 pixel values |

## Found while building

- **A NUL byte in a string literal.** `workbench/skinEditor.js` held `"\0none"` where `" none"` was intended, which made the file read as binary to every text tool while working correctly at runtime. Replaced with an unambiguous `"__none__"` sentinel. It surfaced only because the seam test greps the source tree.
- **Three type-name branches that had nothing to do with types.** The emitter's "which containers get their own module", the radio items' "selection is exclusive within the parent", and the gallery's caption for it. Each is now a declared property, so a future tab strip or toggle group inherits the behavior instead of needing a branch.
- **Untyped nodes needed the old permissive rule kept deliberately.** A node with no `type:` has no contract, so its keys cannot be validated. Two draft versions of the property check regressed `app.yaml`'s notification lights (a `color:` key became a bogus child) before the rule was made explicit: with a contract, validate; without one, behave exactly as before.

## Known limits

The catalogue is read-only; property editing is still spec 002's pending work. `menu` and `spinBox` are declared, not implemented, and the types they need (overlay and z-order for one, drag and wheel and key repeat for the other) are the next structural gaps, not registry work. `renderers/canvas/mount.js` keeps its own type names for the spec 003 document. Nothing in the current application authors a `checkbox`, so its artwork is verified through the catalogue, the Skin tab's library and the unit tests rather than in the running app.
