# 009 — Design

## The registry

`runtime/componentTypes.js`, data plus pure lookups, in the shape the compiler, the layout engine, the renderer, the emitter and the workbench all need:

```js
export const COMPONENT_TYPES = {
    button: {
        description: "A push button ...",
        implemented: true,
        container: null,                  // or { childrenIn, childType, namedSlots }
        styled: true,                     // has skin artwork of its own
        interactive: true,                // gets a behavior controller
        direction: null,                  // container main axis: "row" | "column" | null (see below)
        draw: "backgroundLabel",          // a kind in renderers/canvas/drawKinds.js
        factory: "button",                // the runtime/components.js export
        properties: {
            shortKey: { kind: "key", description: "Keyboard shortcut ..." }
        }
    }
};
```

- **`container`** describes how children are authored: `childrenIn` is `"content"` (a sequence of components) or `"items"` (a sequence of the type's own item shape); `childType` names the type those items become (`radioGroup` items become `radioItem`); `namedSlots: true` allows the "any other mapping key is a child" form `app.yaml` uses for panels. A leaf type has `container: null`, and then an unknown key is a property mistake rather than a child.
- **`direction`** is the main axis for a container. `null` keeps the documented spec-005 default, where a fixed-height container reads as one toolbar row and anything else stacks as a column. `radioGroup` declares `"row"` outright, which is what removes the type check from `isRow()`.
- **`draw`** names a kind, not a function, so the registry stays free of rendering code and the browser-only draw functions stay out of the compiler.
- **`properties`** is the per-type contract. `UNIVERSAL_PROPERTIES` (type, name, label, variant, style, layout, rule, rules, actions, action, description) applies to every type and is declared once. A `kind` is documentation for the catalogue (`"text"`, `"number"`, `"key"`, `"color"`, `"boolean"`, `"reference"`), not a coercion: the compiler still reads values the way it does today.

Lookups: `componentType(name)`, `isKnownType`, `isImplemented`, `isContainer`, `childSlot`, `isStyledType`, `isInteractiveType`, `interactiveTypeNames`, `knownProperty(type, key)`, `typeEntries()`.

### Registered types

| type | status | container | styled | interactive | draw |
|---|---|---|---|---|---|
| `panel` | implemented | `content` + named slots | yes | no | `background` |
| `button` | implemented | leaf | yes | yes | `backgroundLabel` |
| `label` | implemented | leaf | yes | no | `label` |
| `radioGroup` | implemented | `items` of `radioItem`, row | yes (chooses `itemStyle`) | no | `none` |
| `radioItem` | implemented | leaf, authored inside `radioGroup.items` | yes | yes | `backgroundLabel` |
| `checkbox` | implemented (new) | leaf | yes | yes | `spriteLabel` |
| `menu` | declared | `items` | no | no | placeholder |
| `spinBox` | declared | leaf | no | no | placeholder |

`menu` and `spinBox` are declared because the current source already authors them. Declaring a type is not a promise to render it: `implemented: false` keeps today's placeholder and keeps style resolution switched off, so no artwork diagnostics appear for a type that draws none.

## Compiler

`convert.js` loses `SUPPORTED_TYPES`, `STYLED_TYPES` and `RESERVED_KEYS`, and its per-type `if` chain shrinks to two registry-driven steps:

1. **Children.** `childSlot(type)` says whether to read `content:` or `items:`, and what an item becomes. A `radioGroup`'s items keep their `itemStyle` cascade from spec 008. `menu`'s items keep their action references resolved, which is now expressed as `container.itemActions: true` rather than an `if (explicitType === "menu")`.
2. **Properties.** Every mapping key is classified: a universal property, a property this type declares, a child slot, or unknown. Unknown on a container with `namedSlots` stays a named child (`app.yaml`'s `top: { menu:…, volume meter:…, notifications:… }`). Unknown anywhere else produces `unknown-component-property` at the key's range, listing what the type does accept, and no node.

`unsupported-component` splits its message: a declared-but-unimplemented type says so and names the spec that will implement it; an unknown type says the name is not a registered component type. Both stay warnings with a placeholder, as before.

Style resolution asks the registry (`isStyledType` plus `isImplemented`) instead of its own set.

## Layout, renderer, runtime, emitter

- `runtime/genericLayout.js`: `isRow(node)` becomes `direction(node) === "row"`, where the registry answers first and the fixed-height default answers for `null`. Behaviour for the current source is unchanged.
- `renderers/canvas/drawKinds.js` (new): one function per draw kind, over the `assets`/`style` interface spec 008 established.

| kind | draws |
|---|---|
| `background` | the style's 9-slice for the state, nothing else |
| `backgroundLabel` | that, plus the style's label placement (today's `drawButton`) |
| `label` | text only, at the style's label offsets |
| `spriteLabel` | the state's artwork at its natural size, label beside it (`checkbox`) |
| `none` | nothing; the node is a container whose children draw themselves |
| `placeholder` | the dashed unsupported box (already in `mountGeneric`) |

  `mountGeneric.js` then dispatches through the table and asks the registry for interactivity and measurement, instead of naming types.
- `runtime/components.js`: one generic `component(type, props, children)` plus the named exports the emitter uses, derived from the registry so a new type's factory exists as soon as it is declared.
- `compiler/emit.js`: the factory name comes from the registry entry.

## Workbench

A fourth tool tab, **Components** (`workbench/componentCatalogue.js`), which is to types what the Skin tab is to artwork:

1. Every registered type, with status, description, container shape, styling and interactivity.
2. Its properties, each with kind and description, universal ones listed separately so a type's own contract is legible.
3. The application nodes using it, selectable in the preview.
4. A link to the Skin tab for a styled type, and to the State gallery for an interactive one.

`stateGallery.js` drops its private `INTERACTIVE_TYPES` in favour of `interactiveTypeNames()`.

## Proving the seam

`checkbox` is added as a registry entry, a `spriteLabel` draw kind and two skin states over the `checkbox_on`/`checkbox_off` artwork already in `assets/skin/src/`. A test then greps every module under `compiler/`, `runtime/`, `renderers/`, `workbench/` plus `build.mjs` and `server.mjs` for the string `checkbox`, and asserts it occurs only in the registry. That is the acceptance criterion for CMP-004 in executable form: if a future type needs a compiler branch, this test fails and says so.

No application node uses a checkbox yet, so its instances list is empty and its artwork is verified through the Skin tab's variant library and the unit tests. Authoring one into `app.yaml` is the author's call, not this spec's.

## Alternatives considered

- *Declaring types in YAML beside the skin.* Rejected: a declaration cannot make the renderer draw a type, so the contract and the implementation would drift, and the compiler would need a second source of truth for types it must special-case anyway. Recording a *planned* type is instead what `implemented: false` is for.
- *A plugin-style registration call (`registerComponentType(...)`) from each renderer.* Rejected: registration order would decide what the compiler knows, and the compiler must not import renderer code.
- *Deriving the property contract from the existing `components/UI/*.json` stubs.* Those three files were never loaded by anything; their prose is carried into the registry entries and the files are left in place rather than quietly deleted.
