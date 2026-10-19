// Node constructors for generated application modules (spec 007).
//
// The compiler's outline and the generated `app/ui/*.js` modules describe
// the same tree; these constructors are how the generated (or hand-written)
// JavaScript builds it without a JSON document. They produce plain objects
// in the shape renderers/canvas/mountGeneric.js already understands, plus
// the function-valued hooks the outline cannot express:
//   highlightedWhen(state) -> boolean   drives the "highlighted" visual state
//   disabledWhen(state) -> boolean      drives the disabled state automatically,
//                                       synced after every state change (spec 015)
//   onActivate(app)                     runs when the control is activated
//   on: { click, change, doubleClick, secondaryClick, submit, escape, enter }
//                                       one hook per gesture (spec 014, extended
//                                       by spec 015's submit/escape/enter);
//                                       `onActivate` is the click alias
// `style` names a skin variant for the node's own component type (spec 008);
// the renderer resolves it against the loaded skin and falls back to the
// type's "default" variant when it is absent.
// Labels follow the authoring convention: "song, s" is an ordered list of
// alternatives, longest/preferred first.

import { componentType } from "./componentTypes.js";

const AUTO = { mode: "auto" };

function labelVariants(label, fallback) {
    if (Array.isArray(label)) return label.map(String);
    if (typeof label === "string") return label.split(",").map(s => s.trim()).filter(Boolean);
    return fallback ? [String(fallback)] : [];
}

/**
 * Builds one node of any registered component type (spec 009). The emitter
 * calls this by type name, so adding a component type needs no new factory
 * here; the named helpers below stay as conveniences for hand-written trees.
 *
 * @param {string} type a type from runtime/componentTypes.js
 * @param {object} [props] `label`, `name`, `layout`, `style`, `shortKey`, `color`, `labelMinWidths`,
 *   `id`, every other property the type declares (a slider's `min`/`max`/`step`),
 *   plus the `highlightedWhen`/`onActivate`/`on` hooks
 * @param {object[]} [children]
 */
export function component(type, props = {}, children = []) {
    const out = {
        id: props.id ?? null,
        type,
        definitionName: props.name ?? null,
        labelVariants: labelVariants(props.label, props.name),
        layout: props.layout ? { ...props.layout, width: props.layout.width || AUTO, height: props.layout.height || AUTO, ...(props.layout.direction ? { direction: props.layout.direction } : {}), ...(props.layout.resizable ? { resizable: props.layout.resizable } : {}) } : { width: AUTO, height: AUTO },
        shortKey: props.shortKey ?? null,
        tooltip: props.tooltip ?? null,
        // Spec 098: per-instance label-alternative thresholds, the same
        // universal property the compiler carries (v1's own setLabels).
        labelMinWidths: props.labelMinWidths ?? null,
        field: props.field ?? null,
        color: props.color ?? null,
        children,
        bindings: [],
        supported: true,
        source: props.source ?? null,
        refSource: null,
        style: { type, variant: typeof props.style === "string" && props.style ? props.style : "default" }
    };
    // Every other property this type declares, carried through generically so
    // that registering a property is all it takes to author one (spec 014).
    const entry = componentType(type);
    for (const property of Object.keys(entry ? entry.properties : {})) {
        if (property in out) continue;
        if (props[property] === undefined || props[property] === null) continue;
        out[property] = props[property];
    }
    if (typeof props.highlightedWhen === "function") out.highlightedWhen = props.highlightedWhen;
    // Command enablement (spec 015): the mechanism spec 011 flagged as owed.
    // Not authorable from YAML yet — there is no document state worth
    // disabling a control on until P6 — but available to hand-written trees
    // and generated-app glue, exactly where highlightedWhen started.
    if (typeof props.disabledWhen === "function") out.disabledWhen = props.disabledWhen;
    if (typeof props.onActivate === "function") out.onActivate = props.onActivate;
    if (props.on && typeof props.on === "object") out.on = props.on;
    if (props.doc) out.doc = String(props.doc);
    // Spec 025: both are universal properties, present only when authored,
    // exactly as the compiler's own output carries them - so a generated
    // application's hand-written glue can use either the same way authored
    // YAML does.
    if (props.breakpoints) out.breakpoints = props.breakpoints;
    if (props.visibleWhen) out.visibleWhen = props.visibleWhen;
    return out;
}

/** A container. `layout` accepts `{ width: {mode}, height: {mode, size}, resizable }` exactly as the compiler resolves it. */
export function panel(props, children = []) { return component("panel", props, children); }
/** A horizontal group of mutually exclusive `radioItem`s. */
export function radioGroup(props, items = []) { return component("radioGroup", props, items); }
export function radioItem(props) { return component("radioItem", props, []); }
export function button(props) { return component("button", props, []); }
export function label(props) { return component("label", props, []); }

/**
 * Assigns deterministic ids to nodes that have none, mirroring the compiler's
 * identity rule (ancestry + name, else type + first label, occurrence suffix
 * on collision), so hand-written trees and generated trees look the same to
 * the renderer, the trace log and the workbench.
 */
export function ensureIds(root, parentId = null) {
    if (!root.id) {
        const local = root.definitionName || `${root.type}${root.labelVariants[0] ? "." + root.labelVariants[0] : ""}`;
        root.id = parentId ? `${parentId}.${local}` : local;
    }
    const seen = new Map();
    for (const child of root.children || []) {
        ensureIds(child, root.id);
        const count = (seen.get(child.id) || 0) + 1;
        seen.set(child.id, count);
        if (count > 1) child.id = `${child.id}#${count}`;
    }
    return root;
}
