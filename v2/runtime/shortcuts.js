// The declared shortcut table (spec 015 INT-015): a component's `shortKey`
// activates it from anywhere, not only while it is focused. Pure parsing and
// matching, no DOM, so it is unit-testable exactly like runtime/pointerRouter.js.
//
// v1 folds every modifier into one `isMetaKeyDown` boolean. Here Ctrl, Shift,
// Alt and Meta are matched independently, so "Ctrl+S" and "Ctrl+Shift+S" are
// two different shortcuts rather than one collapsing into the other.

const MODIFIER_ALIASES = {
    ctrl: "ctrl", control: "ctrl",
    shift: "shift",
    alt: "alt", option: "alt",
    meta: "meta", cmd: "meta", command: "meta", win: "meta"
};

// A few names authors are likely to type that do not match `KeyboardEvent.key`.
const KEY_ALIASES = {
    esc: "Escape",
    del: "Delete",
    ins: "Insert",
    return: "Enter",
    space: " ",
    spacebar: " ",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight"
};

function normalizeKey(key) {
    if (!key) return "";
    if (key.length === 1) return key.toLowerCase();
    const alias = KEY_ALIASES[key.toLowerCase()];
    if (alias) return alias.length === 1 ? alias.toLowerCase() : alias;
    return key;
}

/**
 * @param {string} spec e.g. "Ctrl+Shift+S", "Escape", "F5"
 * @returns {{ key: string, ctrl: boolean, shift: boolean, alt: boolean, meta: boolean }|null}
 */
export function parseShortcut(spec) {
    if (typeof spec !== "string" || !spec.trim()) return null;
    const parts = spec.split("+").map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const modifiers = { ctrl: false, shift: false, alt: false, meta: false };
    let key = null;
    for (const part of parts) {
        const modifier = MODIFIER_ALIASES[part.toLowerCase()];
        if (modifier) { modifiers[modifier] = true; continue; }
        key = part; // the last non-modifier token wins if more than one appears
    }
    if (key === null) return null;
    return { key: normalizeKey(key), ...modifiers };
}

/**
 * @param {{key:string, ctrl:boolean, shift:boolean, alt:boolean, meta:boolean}} parsed
 * @param {{key:string, ctrlKey:boolean, shiftKey:boolean, altKey:boolean, metaKey:boolean}} event
 */
export function matchesShortcut(parsed, event) {
    if (!parsed || !event) return false;
    return normalizeKey(event.key) === parsed.key
        && Boolean(event.ctrlKey) === parsed.ctrl
        && Boolean(event.shiftKey) === parsed.shift
        && Boolean(event.altKey) === parsed.alt
        && Boolean(event.metaKey) === parsed.meta;
}

/** A stable string key for a parsed shortcut, used as the table's Map key. */
export function shortcutSignature(parsed) {
    if (!parsed) return null;
    return `${parsed.ctrl ? "ctrl+" : ""}${parsed.shift ? "shift+" : ""}${parsed.alt ? "alt+" : ""}${parsed.meta ? "meta+" : ""}${parsed.key}`;
}

/**
 * Builds the shortcut table from every node's `shortKey`. The first
 * registration of a given combination wins; a later duplicate is reported
 * with `onDuplicate` rather than silently overwriting or throwing, because
 * this runs at mount time against an already-compiled outline.
 *
 * @param {Array<{id:string, shortKey?: string|null}>} nodes
 * @param {(signature: string, existingId: string, duplicateId: string) => void} [onDuplicate]
 * @returns {Map<string, string>} signature -> node id
 */
export function buildShortcutTable(nodes, onDuplicate) {
    const table = new Map();
    for (const node of nodes) {
        if (!node || !node.shortKey) continue;
        const parsed = parseShortcut(node.shortKey);
        if (!parsed) continue;
        const signature = shortcutSignature(parsed);
        if (table.has(signature)) {
            if (typeof onDuplicate === "function") onDuplicate(signature, table.get(signature), node.id);
            continue;
        }
        table.set(signature, node.id);
    }
    return table;
}

/**
 * @param {Map<string, string>} table from buildShortcutTable
 * @param {{key:string, ctrlKey:boolean, shiftKey:boolean, altKey:boolean, metaKey:boolean}} event
 * @returns {string|null} the node id the event's combination is bound to
 */
export function matchShortcutTable(table, event) {
    const parsed = { key: normalizeKey(event.key), ctrl: Boolean(event.ctrlKey), shift: Boolean(event.shiftKey), alt: Boolean(event.altKey), meta: Boolean(event.metaKey) };
    const signature = shortcutSignature(parsed);
    return table.get(signature) || null;
}
