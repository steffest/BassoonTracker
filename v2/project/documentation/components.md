# Component types: the registry

Status: implemented and verified 2026-09-10 (spec [009](../specs/009-component-registry/requirements.md): [requirements](../specs/009-component-registry/requirements.md), [design](../specs/009-component-registry/design.md), [tasks](../specs/009-component-registry/tasks.md)). Delivers the component contract spec [002](../specs/002-component-authoring/requirements.md) specified.

`runtime/componentTypes.js` is the one description of every component type. The compiler, the layout engine, the canvas renderer, the runtime factories, the emitter and the workbench all read it, and none of them keeps a list of type names.

## Adding a type

1. Add an entry to `COMPONENT_TYPES`.
2. If it looks like nothing that exists, add one draw kind to `renderers/canvas/drawKinds.js`.
3. If it has artwork, add its styles to the authored skin ([skin.md](skin.md)).

That is the whole procedure, and a test enforces it: `tests/componentTypes.test.js` asserts that no module outside the registry compares a `.type` against a type name, and that the type spec 009 added (`checkbox`) is named nowhere else.

## An entry

```js
checkbox: {
    description: "An on/off box with a label beside it. ...",
    implemented: true,        // false records a planned type
    container: null,          // or { childrenIn, childType, namedSlots, ownModule, itemActions }
    styled: true,             // the skin defines artwork for this type
    interactive: true,        // the renderer gives it a behavior controller
    behavior: "button",       // which controller, from runtime/behaviors.js
    behaviorOptions: {},      // passed straight to that controller's factory
    cursor: "pointer",        // the CSS cursor shown over it
    selection: null,          // or "exclusiveWithinParent" for radio behavior
    direction: null,          // a container's main axis: "row", "column", or null
    clips: false,             // whether it clips its content to its own box
    draw: "spriteLabel",      // a kind in renderers/canvas/drawKinds.js
    authoredIn: null,         // where instances come from, if not authored directly
    properties: {}            // this type's own contract, beyond the universal ones
}
```

`UNIVERSAL_PROPERTIES` declares what every component accepts once: `type`, `name`, `label`, `variant`, `style`, `layout`, `rule`, `rules`, `actions`, `action`, `description`. A property `kind` (`text`, `number`, `key`, `color`, `boolean`, `reference`, `prose`, `map`) is documentation for the catalogue. One exception since spec 014: a property declared as a `number` is converted to one on the way to the node, and a value that is not a number warns as `non-numeric-property`, because the renderer must not have to guess whether it is holding `4` or `"4"`.

## What each field decides

| field | who reads it |
|---|---|
| `implemented` | the compiler (`supported`, and which `unsupported-component` message), the renderer (placeholder), the catalogue |
| `container` | the compiler: whether children come from `content:` or `items:`, what an item becomes, whether other keys are named child slots, whether the emitter gives it its own module |
| `styled` | the compiler: whether to resolve a skin style for the node. Only for a type that is also implemented, so a planned type reports no artwork diagnostics |
| `interactive` | the renderer and the State gallery: whether the node gets a behavior controller |
| `behavior`, `behaviorOptions` | the renderer, through the behavior table: `button`, `value` or `scroll` ([interaction.md](interaction.md)). An interactive type that names none gets `button` |
| `cursor` | the renderer: the CSS cursor shown over this type |
| `clips`, `layer`, `modal` | the layout engine: whether it cuts its content off, and whether it is out of flow ([layout.md](layout.md)) |
| `selection` | the renderer and the emitter: `exclusiveWithinParent` is radio behavior, which stays UI state until an action gives it a command |
| `direction` | the layout engine, ahead of its documented fixed-height default |
| `draw` | the canvas renderer, through the draw-kind table |
| `properties` | the compiler's property validation, and the catalogue |

## Registered types

| type | status | container | styled | behavior | draw |
|---|---|---|---|---|---|
| `panel` | implemented | `content:` plus named slots, own module | yes | none | `background` |
| `button` | implemented | leaf | yes | `button` | `backgroundLabel` |
| `label` | implemented | leaf | yes | none | `label` |
| `viewport` | implemented | `content:` plus named slots, column, clips | yes | `scroll` | `background` |
| `radioGroup` | implemented | `items:` of `radioItem`, row | yes, chooses `itemStyle` | none | `none` |
| `radioItem` | implemented | leaf, authored in `radioGroup.items` | yes | `button`, exclusive within its parent | `backgroundLabel` |
| `checkbox` | implemented | leaf | yes | `button` | `spriteLabel` |
| `slider` | implemented | leaf | yes | `value`, absolute along x | `slider` |
| `spinBox` | implemented | leaf | yes | `value`, relative along y, with a stepper | `spinBox` |
| `menu` | declared | `items:`, item actions resolved | no | none | placeholder |

A **declared** type is one the project intends to render. Its properties are validated and documented and its actions are resolved, and the renderer draws the dashed placeholder. That is how the roughly thirty types the v1 port needs can be recorded with their contracts before any of them is implemented, and it is why `menu`, already authored in the current source, is not indistinguishable from a typo.

`spinBox` was such a type until spec [014](../specs/014-pointer-interaction/requirements.md) gave it the drag and wheel input it was waiting for; the authored one in the control bar became a working control with no change to the YAML.

## Draw kinds

`renderers/canvas/drawKinds.js` maps a kind to how it paints *and* how it measures, so those two can never disagree.

| kind | draws |
|---|---|
| `background` | the style's 9-slice for the state |
| `backgroundLabel` | that, plus the style's label placement |
| `label` | text only |
| `spriteLabel` | the state's artwork at its natural size, label beside it |
| `slider` | a track, a thumb from the style's `thumbStyle`, and the value as text |
| `spinBox` | a readout and a stepper column, both from `thumbStyle` |
| `none` | nothing; children draw themselves |
| `placeholder` | the dashed box naming the type |

## Property validation

Every authored key on a component is classified as a universal property, one of the type's own, its child slot, or a mistake.

- On a **leaf**, an unknown key is a `unknown-component-property` warning at that key, listing what the type accepts. Before spec 009 it silently became a child node and produced a misleading `unresolved-component-reference`.
- On a **container with named slots** (`panel`), an unknown key is a named child, which is how `app.yaml` authors `top:` with `menu`, `volume meter` and `notifications` as sibling keys.
- On a node with **no contract** (no `type:`, or a type the registry does not know), keys are left alone and the node keeps its own "no declared type" warning. There is nothing to validate against, and inventing warnings there would be noise.

## Generated code

The emitter calls one factory by type name:

```js
component("button", { id: "main.controlBar.button.Play", label: "Play", style: "play" })
```

`runtime/components.js` exports that `component(type, props, children)` plus the named helpers (`panel`, `button`, `label`, `radioGroup`, `radioItem`) for hand-written trees. The named helpers are conveniences, not a registration point: a newly registered type needs no factory of its own.

Every property the type declares is carried through generically, by both the factory and the emitter, so registering a property is all it takes to author *and* generate one. A slider's `min`, `max` and `step` arrived that way. Behaviour bound to an event goes in `on`:

```js
component("spinBox", { id: "...", style: "big", min: 1, max: 32, on: { change: (app, detail) => ... } })
```

## Known limits

The catalogue is read-only. The registry is code, so changing a contract is a code change, and property *editing* from the workbench remains spec 002's pending work.

Corrected 2026-09-10: this section used to end by noting that `renderers/canvas/mount.js` still branched on its own type names. That renderer was spec 003's, and spec [011](../specs/011-retire-spec003-pipeline/requirements.md) deleted it the same day; the sentence outlived the file. No module branches on a component type name today, and `tests/componentTypes.test.js` asserts it with no exclusions.
