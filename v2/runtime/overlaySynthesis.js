// Overlay synthesis (spec 020): a dropdown's popup and a modal dialog's
// OK/Cancel/input are not authored - v1's own Dropdown and ModalDialog build
// them in their constructors, not from markup, and v2's compiled tree is
// static, so the equivalent here is a pure, one-time restructuring pass run
// once per mount, right after `ensureIds()`, in
// renderers/canvas/mountGeneric.js. That means it runs identically for the
// authoring preview and a generated application, since both mount through
// that one file, and it needs nothing from the compiler.
//
// Not idempotent by design: running this twice over the same tree would
// duplicate the synthetic children, exactly as calling `ensureIds()` twice
// would re-suffix ids. Callers run it once.

import { valueFieldOf } from "./valueController.js";
import { componentType } from "./componentTypes.js";

/** A synthetic node, in the same shape `runtime/components.js`'s `component()` produces. */
function synthetic(type, extra = {}) {
    return {
        id: null,
        type,
        definitionName: null,
        labelVariants: [],
        layout: { width: { mode: "auto" }, height: { mode: "auto" } },
        shortKey: null,
        tooltip: null,
        field: null,
        color: null,
        children: [],
        bindings: [],
        supported: true,
        source: null,
        refSource: null,
        style: { type, variant: "default" },
        ...extra
    };
}

/**
 * Lifts a dropdown's authored items into a new `dropdownPopup` child, which
 * is where they are actually laid out and hit-tested (spec 013's overlay
 * layer). The popup shares the dropdown's own `field` (falling back to the
 * same derived name `valueFieldOf` would give the dropdown), set explicitly
 * on both nodes, so the closed control and the open popup always agree on
 * which item is selected without either looking the other up by id.
 */
function synthesizeDropdown(node) {
    const field = node.field || valueFieldOf(node);
    node.field = field;
    const items = node.children;
    node.children = [synthetic("dropdownPopup", {
        id: `${node.id}.popup`,
        definitionName: "popup",
        field,
        children: items
    })];
}

/**
 * Appends one synthetic child per declared part (spec 020 design.md): a
 * `button` per `ok`/`cancel`, each carrying a plain `dialogResult` data
 * property (not a hook - nothing here is a closure) that
 * renderers/canvas/mountGeneric.js reads generically to know which result a
 * click reports, and an `inputbox` for `input`, read back the same way any
 * other bound field is.
 */
function synthesizeModalDialog(node) {
    const children = [];
    if (node.ok) children.push(synthetic("button", { id: `${node.id}.ok`, definitionName: "ok", labelVariants: ["OK"], dialogResult: "ok" }));
    if (node.cancel) children.push(synthetic("button", { id: `${node.id}.cancel`, definitionName: "cancel", labelVariants: ["Cancel"], dialogResult: "cancel" }));
    if (node.input) children.push(synthetic("inputbox", { id: `${node.id}.input`, definitionName: "input", field: `${node.id}.input` }));
    node.children = [...(node.children || []), ...children];
}

/**
 * Wraps every child whose type declares `isMenuFlyout` (spec 023: so far only
 * `submenu`) into a synthesized `menuTrigger` - a plain, in-flow, interactive
 * node that stays exactly where the wrapped item was, keeps its own label,
 * and holds the original node (unchanged - still `layer: "overlay"`/`modal`,
 * still authored the same way) as its sole synthesized child. This is the
 * same "one authored node becomes a flow trigger plus an overlay child" idea
 * `synthesizeDropdown` already uses, run in the opposite direction: there the
 * popup is new and the items move into it; here the trigger is new and the
 * original node moves under it.
 *
 * `popupEdge` (an instance property, read generically by
 * renderers/canvas/mountGeneric.js's existing "disclose" activation, the same
 * way `node.vertical` overrides rangeSlider's axis) is "below" for a menu's
 * own row of top-level items and "right" for one nested inside an
 * already-open (column) submenu - decided once, here, from the *wrapping*
 * container's own declared `direction`, never re-derived per click.
 */
function synthesizeMenuTriggers(node) {
    // Mirrors runtime/genericLayout.js's own row/column resolution order
    // (authored direction, then the type's declared one) without importing
    // it, since that module is layout-only and this one has no rect to lay
    // out - only the choice of edge is shared.
    const entry = componentType(node.type);
    const authoredDirection = node.layout && node.layout.direction;
    const rowWise = authoredDirection ? authoredDirection === "row" : (entry && entry.direction) === "row";
    const edge = rowWise ? "below" : "right";
    node.children = (node.children || []).map(child => {
        const childEntry = componentType(child.type);
        if (!childEntry || !childEntry.isMenuFlyout) return child;
        return synthetic("menuTrigger", {
            id: `${child.id}.trigger`,
            definitionName: child.definitionName,
            labelVariants: child.labelVariants,
            tooltip: child.tooltip,
            source: child.source,
            popupEdge: edge,
            children: [child]
        });
    });
}

/**
 * patternGrid's own synthesized overlay (spec 030 GRID-007): one `submenu`
 * child of four static command items (Clear/Cut/Copy/Paste), visually and
 * behaviorally an ordinary flyout (spec 020's `flyout` behavior: hover-to-
 * preview, click-to-execute, closes after). Each item carries a plain
 * `selectionCommand` data property instead of an `actions` binding - the
 * same shape `dialogResult` already is on a modal dialog's synthesized
 * OK/Cancel (`synthesizeModalDialog` above) - because nothing authored these
 * either; `renderers/canvas/mountGeneric.js`'s own "grid" behavior opens
 * this popup directly (there is no click-to-disclose trigger for it), and
 * its `activated` handling reads `selectionCommand` the same way it already
 * reads `dialogResult`.
 */
function synthesizeSelectionMenu(node) {
    node.children = [synthetic("submenu", {
        id: `${node.id}.selectionMenu`,
        definitionName: "selectionMenu",
        children: ["Clear", "Cut", "Copy", "Paste"].map(label => synthetic("label", {
            id: `${node.id}.selectionMenu.${label.toLowerCase()}`,
            definitionName: label.toLowerCase(),
            labelVariants: [label],
            selectionCommand: label.toLowerCase()
        }))
    })];
}

/**
 * @param {object} root the mounted tree, after `ensureIds()`
 * @returns {object} `root`, mutated in place, for convenience at the call site
 */
export function synthesizeOverlayChildren(root) {
    function visit(node) {
        const entry = componentType(node.type);
        // Gated on registry facts, never a type name (spec 009's own rule,
        // enforced by componentTypes.test.js's scanning test): `synthesizes`
        // says *what shape* of synthetic children a type itself gets;
        // `wrapsFlyoutItems` says whether *its children* get wrapped.
        const kind = entry && entry.synthesizes;
        if (kind === "popup") synthesizeDropdown(node);
        else if (kind === "dialogParts") synthesizeModalDialog(node);
        else if (kind === "selectionMenu") synthesizeSelectionMenu(node);
        if (entry && entry.wrapsFlyoutItems) synthesizeMenuTriggers(node);
        for (const child of node.children || []) visit(child);
    }
    visit(root);
    return root;
}
