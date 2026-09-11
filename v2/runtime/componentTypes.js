// The component catalogue (spec 009): one declaration per component type,
// read by the compiler, the layout engine, the canvas renderer, the runtime
// factories, the emitter and the workbench. Before this file each of those
// kept its own hardcoded list of type names, so adding a type meant six
// edits and nothing could check an authored property against a contract.
//
// It lives in runtime/ for the same reason skinModel.js does: the compiler
// and the renderer both need it, and the renderer must not import the
// compiler (its YAML parser never ships to the application). Data plus pure
// functions only: no DOM, no filesystem, no parser.
//
// Adding a type means adding an entry here. A type whose appearance is new
// also needs one draw kind in renderers/canvas/drawKinds.js, and a type with
// artwork needs styles in the authored skin. Nothing else.

/**
 * Properties every component accepts, declared once. `kind` is documentation
 * for the workbench catalogue, not a coercion: values are read exactly as
 * they are today.
 */
export const UNIVERSAL_PROPERTIES = {
    type: { kind: "reference", description: "The component type, which selects the contract below." },
    name: { kind: "text", description: "Identity within its parent. Also the fallback label." },
    label: { kind: "text", description: "Label text. Comma-separated alternatives are ordered longest/preferred first." },
    variant: { kind: "reference", description: "Skin style variant for this component's own type (spec 008)." },
    style: { kind: "reference", description: "Accepted alias of variant." },
    layout: { kind: "map", description: "width and height of fill/fixed/a number, and resizable of horizontal/vertical." },
    rule: { kind: "prose", description: "One rule, by name or as prose, interpreted into a binding where the vocabulary allows." },
    rules: { kind: "prose", description: "A sequence of rules, same interpretation as rule." },
    actions: { kind: "prose", description: "Event-to-action mapping, an action name, or inline prose." },
    action: { kind: "prose", description: "Accepted alias of actions." },
    description: { kind: "prose", description: "Prose documentation for this component. Not rendered." }
};

/**
 * @typedef {object} ComponentTypeEntry
 * @property {string} description prose shown in the workbench catalogue
 * @property {boolean} implemented false records a planned type: its properties are
 *   validated and documented, and the renderer draws its placeholder
 * @property {null|{ childrenIn: "content"|"items", childType?: string, namedSlots?: boolean, itemActions?: boolean }} container
 *   how children are authored; null for a leaf, which makes an unknown key a
 *   property mistake instead of a child
 * @property {boolean} styled whether the skin defines artwork for this type
 * @property {boolean} interactive whether the renderer gives it a behavior controller
 * @property {string} [behavior] which controller, from runtime/behaviors.js; an
 *   interactive type that names none gets "button" (spec 014)
 * @property {object} [behaviorOptions] passed straight to that behavior's factory
 * @property {string} [cursor] the CSS cursor keyword shown over this type (spec 014)
 * @property {null|"row"|"column"} direction a container's main axis; null keeps the
 *   documented default (a fixed-height container is one row, anything else a column)
 * @property {boolean} [clips] whether the node clips its content to its own box (spec 013)
 * @property {"flow"|"overlay"} [layer] "overlay" takes the node out of flow, painted
 *   above the tree and hit-tested before it (spec 013)
 * @property {boolean} [modal] an overlay that swallows input outside itself (spec 013)
 * @property {null|"exclusiveWithinParent"} selection how activating one instance
 *   affects its siblings; "exclusiveWithinParent" is radio behavior, which is UI
 *   state until an action gives it a command
 * @property {string} draw a kind in renderers/canvas/drawKinds.js
 * @property {string|null} authoredIn where instances come from, when not authored directly
 * @property {Record<string, { kind: string, description: string }>} properties this type's own contract
 */

/** @type {Record<string, ComponentTypeEntry>} */
export const COMPONENT_TYPES = {
    panel: {
        description: "A container that groups other components. Draws the skin's panel artwork behind them and contributes no behavior of its own.",
        implemented: true,
        container: { childrenIn: "content", namedSlots: true, ownModule: true },
        styled: true,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "background",
        authoredIn: null,
        properties: {
            color: { kind: "color", description: "Authored colour hint. Carried on the node; the skin decides the artwork." }
        }
    },

    button: {
        description: "A push button. Triggers an action when activated by pointer or keyboard, and can be lit by a visual-state rule. Its appearance per state comes from its skin style variant.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "backgroundLabel",
        authoredIn: null,
        properties: {
            shortKey: { kind: "key", description: "Keyboard shortcut. Recorded on the node; binding shortcuts is not implemented yet." }
        }
    },

    label: {
        description: "Static text drawn in one of the skin's fonts. No background artwork and no behavior.",
        implemented: true,
        container: null,
        styled: true,
        interactive: false,
        selection: null,
        direction: null,
        cursor: "default",
        draw: "label",
        authoredIn: null,
        properties: {
            text: { kind: "text", description: "The text to draw. A content item authored as `- text: ...` becomes one of these." },
            field: { kind: "reference", description: "A state field to draw the value of, instead of static text. The field becomes part of the application's state." }
        }
    },

    viewport: {
        description: "A clipping box that scrolls its content. Its children are laid out at their natural size, translated by the scroll offset its bound state field holds, and cut off at the viewport's edge. The wheel, a drag on its background and a drag on its scrollbar all move that offset; a viewport with no bound field is simply a clipping box and passes the wheel on.",
        implemented: true,
        container: { childrenIn: "content", namedSlots: true },
        styled: true,
        interactive: true,
        behavior: "scroll",
        selection: null,
        direction: "column",
        clips: true,
        cursor: "grab",
        draw: "background",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "A state field holding the vertical scroll offset in pixels. Clamped to the content extent, so a bad value cannot lose the content." }
        }
    },

    radioGroup: {
        description: "A row of mutually exclusive choices. Draws no artwork itself; its style variant chooses, through itemStyle, which radioItem style its choices are drawn with.",
        implemented: true,
        container: { childrenIn: "items", childType: "radioItem" },
        styled: true,
        interactive: false,
        selection: null,
        direction: "row",
        cursor: "default",
        draw: "none",
        authoredIn: null,
        properties: {}
    },

    radioItem: {
        description: "One choice in a radio group. Stays lit while selected. Selection is UI state only until a rule or action gives it a command.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: "exclusiveWithinParent",
        direction: null,
        cursor: "pointer",
        draw: "backgroundLabel",
        authoredIn: "radioGroup.items",
        properties: {}
    },

    checkbox: {
        description: "An on/off box with a label beside it. Its artwork is drawn at its natural size rather than stretched, its on state comes from a visual-state rule, and clicking it runs its action.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "button",
        selection: null,
        direction: null,
        cursor: "pointer",
        draw: "spriteLabel",
        authoredIn: null,
        properties: {}
    },

    menu: {
        description: "A menu of options or actions the user can select from. Declared so its item actions are resolved and reported; rendering it needs the overlay and z-order layer v2 does not have yet, so it draws a placeholder.",
        implemented: false,
        container: { childrenIn: "items", itemActions: true },
        styled: false,
        interactive: false,
        selection: null,
        direction: null,
        draw: "placeholder",
        authoredIn: null,
        properties: {}
    },

    slider: {
        description: "A horizontal track holding one bounded number. Pressing jumps to the pressed position, dragging follows the pointer, and the wheel moves one step per notch. The value lives in the bound state field, not in the component.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "absolute", axis: "x" },
        selection: null,
        direction: null,
        cursor: "ew-resize",
        draw: "slider",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value. Written on every change and read back as the authority for what the control shows." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            step: { kind: "number", description: "Granularity. Every value is snapped to it. Defaults to 1." }
        }
    },

    spinBox: {
        description: "A numeric readout with a stepper column. Pressing the upper or lower half of the stepper moves one step, dragging the readout moves continuously, and the wheel moves one step per notch. The value lives in the bound state field.",
        implemented: true,
        container: null,
        styled: true,
        interactive: true,
        behavior: "value",
        behaviorOptions: { mode: "relative", axis: "y", stepper: true },
        selection: null,
        direction: null,
        cursor: "ns-resize",
        draw: "spinBox",
        authoredIn: null,
        properties: {
            field: { kind: "reference", description: "The state field holding the value. Written on every change and read back as the authority for what the control shows." },
            min: { kind: "number", description: "Lowest value. Defaults to 0." },
            max: { kind: "number", description: "Highest value. Defaults to 100." },
            step: { kind: "number", description: "Increment per press of the stepper and per wheel notch. Defaults to 1." }
        }
    }
};

/** @returns {ComponentTypeEntry|null} */
export function componentType(type) {
    return (type && Object.prototype.hasOwnProperty.call(COMPONENT_TYPES, type) && COMPONENT_TYPES[type]) || null;
}

export function isKnownType(type) {
    return Boolean(componentType(type));
}

/** A declared type the renderer can actually draw. */
export function isImplemented(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.implemented);
}

export function isContainer(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.container);
}

/** How this type's children are authored, or null for a leaf. */
export function childSlot(type) {
    const entry = componentType(type);
    return entry && entry.container ? entry.container : null;
}

/** Artwork is only resolved for a type that both declares it and can be drawn. */
export function isStyledType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.styled && entry.implemented);
}

export function isInteractiveType(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.interactive && entry.implemented);
}

/**
 * Which controller this type gets (spec 014). An interactive type that names
 * no behavior gets "button", so every type that predates behaviors keeps its
 * controller without an entry of its own.
 * @returns {string|null} null for a type with no behavior at all
 */
export function behaviorOf(type) {
    const entry = componentType(type);
    if (!entry || !entry.interactive || !entry.implemented) return null;
    return entry.behavior || "button";
}

/** The options that behavior factory receives. Opaque to the renderer. */
export function behaviorOptionsOf(type) {
    const entry = componentType(type);
    return (entry && entry.behaviorOptions) || {};
}

/** The CSS cursor keyword shown over this type. */
export function cursorOf(type) {
    const entry = componentType(type);
    return (entry && entry.cursor) || "default";
}

export function interactiveTypeNames() {
    return Object.keys(COMPONENT_TYPES).filter(isInteractiveType);
}

/** A container's main axis, or null to use the renderer's documented default. */
export function typeDirection(type) {
    const entry = componentType(type);
    return (entry && entry.direction) || null;
}

/** How activating one instance affects its siblings, or null. */
export function selectionModeOf(type) {
    const entry = componentType(type);
    return (entry && entry.selection) || null;
}

/** Whether this type is the structural container the emitter gives its own module. */
export function ownsModule(type) {
    const entry = componentType(type);
    return Boolean(entry && entry.container && entry.container.ownModule);
}

export function drawKindOf(type) {
    const entry = componentType(type);
    return entry ? entry.draw : "placeholder";
}

/**
 * Whether `key` is something this type accepts. Returns what it is, so a
 * caller can tell a property from a child slot from a mistake.
 * @returns {{ known: boolean, where: "universal"|"type"|"childSlot"|null }}
 */
export function knownProperty(type, key) {
    if (Object.prototype.hasOwnProperty.call(UNIVERSAL_PROPERTIES, key)) return { known: true, where: "universal" };
    const entry = componentType(type);
    if (entry && Object.prototype.hasOwnProperty.call(entry.properties, key)) return { known: true, where: "type" };
    if (entry && entry.container && entry.container.childrenIn === key) return { known: true, where: "childSlot" };
    return { known: false, where: null };
}

/**
 * Whether `key` names a property or child slot of *any* registered type.
 * Used where a single-key mapping has to be read as either a named child
 * slot or a property of an anonymous component, before its type is known.
 */
export function isAnyKnownKey(key) {
    if (Object.prototype.hasOwnProperty.call(UNIVERSAL_PROPERTIES, key)) return true;
    return Object.values(COMPONENT_TYPES).some(entry =>
        Object.prototype.hasOwnProperty.call(entry.properties, key) || (entry.container && entry.container.childrenIn === key));
}

/** Every property this type accepts, for a diagnostic message or the catalogue. */
export function acceptedKeys(type) {
    const entry = componentType(type);
    const own = entry ? Object.keys(entry.properties) : [];
    const slot = entry && entry.container ? [entry.container.childrenIn] : [];
    return [...Object.keys(UNIVERSAL_PROPERTIES), ...own, ...slot];
}

/** `[name, entry]` pairs, implemented types first, for the workbench catalogue. */
export function typeEntries() {
    return Object.entries(COMPONENT_TYPES).sort((a, b) => (a[1].implemented === b[1].implemented ? a[0].localeCompare(b[0]) : a[1].implemented ? -1 : 1));
}
