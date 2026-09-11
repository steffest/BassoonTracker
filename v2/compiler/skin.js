// Compiles one authored skin document (spec 008) into the model the canvas
// renderer, the generated app and the workbench's Skin tab all read.
//
// The whole point is traceability: a style state names an asset, an asset
// name *is* the base name of a PNG under v2/assets/skin/src, and every
// reference keeps the source range it was authored at. Nothing here loads or
// decodes an image; `listAssets` is an optional dependency so the same code
// runs in the browser (where no directory listing exists) and in Node.

import { mapGet, scalarValue } from "./yaml.js";
import { STYLE_STATES, BUILTIN_SKIN, normalizeInsets, ATLAS_FILES } from "../runtime/skinModel.js";

// The vocabulary, the built-in fallback skin and the two pure lookups live in
// runtime/skinModel.js so the renderer can share them without importing the
// YAML parser. Re-exported here because the compiler is where callers expect
// to find them.
export { STYLE_STATES, STATE_CHAINS, BUILTIN_SKIN, ATLAS_FILES, lookupStyle, styleLayoutDefaults, resolveStateAsset, styleStateName } from "../runtime/skinModel.js";

const STYLE_PROPERTIES = new Set(["description", "extends", "insets", "width", "height", "label", "focusColor", "states", "itemStyle", "thumbStyle"]);
const LABEL_PROPERTIES = new Set(["align", "offsetX", "offsetY", "pressedOffset", "font"]);
const FONT_PROPERTIES = new Set(["description", "asset", "offsetX", "offsetY", "charWidth", "charHeight", "spaceWidth", "margin", "lineSpacing", "charsPerLine", "chars", "onlyUpperCase"]);
const LABEL_ALIGNMENTS = new Set(["left", "center", "right"]);
const INSET_SIDES = ["left", "top", "right", "bottom"];

const ASSET_DIR = "src";

function numberOr(node, fallback, onInvalid) {
    const text = scalarValue(node);
    if (text === null) return fallback;
    const value = Number(text);
    if (!Number.isFinite(value)) {
        onInvalid?.(text);
        return fallback;
    }
    return value;
}

function booleanOr(node, fallback) {
    const text = scalarValue(node);
    if (text === null) return fallback;
    return /^(true|yes|on)$/i.test(text.trim());
}

/**
 * @param {object} options
 * @param {string} options.name the skin name (file base name under skin/)
 * @param {string} options.file the source path, e.g. "skin/default.yaml"
 * @param {object} options.root the parsed YAML document root
 * @param {(severity: string, code: string, message: string, file: string, range: object|null) => void} options.addDiagnostic
 * @param {(() => string[])|undefined} [options.listAssets] available source PNG base names; omit to skip existence checks
 * @returns {object} the compiled skin model
 */
export function compileSkin({ name, file, root, addDiagnostic, listAssets }) {
    const warn = (code, message, range) => addDiagnostic("warning", code, message, file, range || null);
    const available = typeof listAssets === "function" ? new Set(listAssets()) : null;
    const assetUses = new Map(); // asset name -> { name, file, usedBy: [] }

    function useAsset(assetName, range, context) {
        if (!assetName) return null;
        let entry = assetUses.get(assetName);
        if (!entry) {
            entry = { name: assetName, file: `${ASSET_DIR}/${assetName}.png`, usedBy: [] };
            assetUses.set(assetName, entry);
            if (available && !available.has(assetName)) {
                warn("unknown-skin-asset", `skin asset "${assetName}" (${context}) has no source file at assets/skin/${ASSET_DIR}/${assetName}.png`, range);
                entry.missing = true;
            }
        }
        entry.usedBy.push({ file, range: range || null });
        return assetName;
    }

    const declaredName = scalarValue(mapGet(root, "name"));
    if (declaredName && declaredName !== name) {
        warn("skin-name-mismatch", `skin document declares name "${declaredName}" but is loaded as "${name}"`, mapGet(root, "name").range);
    }

    // --- fonts ---------------------------------------------------------
    const fonts = {};
    const fontsNode = mapGet(root, "fonts");
    if (fontsNode && fontsNode.kind === "map") {
        for (const entry of fontsNode.entries) {
            const fontNode = entry.valueNode;
            if (fontNode.kind !== "map") {
                warn("unknown-style-property", `font "${entry.key}" is not a mapping`, fontNode.range);
                continue;
            }
            for (const prop of fontNode.entries) {
                if (!FONT_PROPERTIES.has(prop.key)) warn("unknown-style-property", `unknown font property "${prop.key}" on font "${entry.key}"`, prop.keyRange);
            }
            const assetNode = mapGet(fontNode, "asset");
            const font = {
                name: entry.key,
                description: scalarValue(mapGet(fontNode, "description")),
                asset: useAsset(scalarValue(assetNode), assetNode ? assetNode.range : fontNode.range, `font ${entry.key}`),
                offsetX: numberOr(mapGet(fontNode, "offsetX"), 0),
                offsetY: numberOr(mapGet(fontNode, "offsetY"), 0),
                charWidth: numberOr(mapGet(fontNode, "charWidth"), 6),
                charHeight: numberOr(mapGet(fontNode, "charHeight"), 6),
                spaceWidth: numberOr(mapGet(fontNode, "spaceWidth"), 6),
                margin: numberOr(mapGet(fontNode, "margin"), 0),
                lineSpacing: numberOr(mapGet(fontNode, "lineSpacing"), 0),
                charsPerLine: numberOr(mapGet(fontNode, "charsPerLine"), 42),
                chars: scalarValue(mapGet(fontNode, "chars")) || BUILTIN_SKIN.fonts.small.chars,
                onlyUpperCase: booleanOr(mapGet(fontNode, "onlyUpperCase"), false),
                source: { file, range: fontNode.range }
            };
            if (!font.asset) warn("unknown-skin-asset", `font "${entry.key}" has no asset`, fontNode.range);
            fonts[entry.key] = font;
        }
    }
    if (Object.keys(fonts).length === 0) {
        warn("missing-skin-font", `skin "${name}" defines no fonts; using the built-in small font`, root.range);
        fonts.small = { ...BUILTIN_SKIN.fonts.small, source: null };
        useAsset(fonts.small.asset, root.range, "built-in small font");
    }

    // --- styles --------------------------------------------------------
    const raw = new Map(); // "type/variant" -> { type, variant, node, parsed }
    const stylesNode = mapGet(root, "styles");
    if (stylesNode && stylesNode.kind === "map") {
        for (const typeEntry of stylesNode.entries) {
            if (typeEntry.valueNode.kind !== "map") {
                warn("unknown-style-property", `styles.${typeEntry.key} is not a mapping of variants`, typeEntry.valueNode.range);
                continue;
            }
            for (const variantEntry of typeEntry.valueNode.entries) {
                if (variantEntry.valueNode.kind !== "map") {
                    warn("unknown-style-property", `style ${typeEntry.key}/${variantEntry.key} is not a mapping`, variantEntry.valueNode.range);
                    continue;
                }
                raw.set(`${typeEntry.key}/${variantEntry.key}`, {
                    type: typeEntry.key,
                    variant: variantEntry.key,
                    node: variantEntry.valueNode,
                    parsed: parseStyle(typeEntry.key, variantEntry.key, variantEntry.valueNode)
                });
            }
        }
    } else {
        warn("missing-skin-styles", `skin "${name}" defines no styles; using the built-in ones`, root.range);
    }

    function parseStyle(type, variant, node) {
        for (const prop of node.entries) {
            if (!STYLE_PROPERTIES.has(prop.key)) warn("unknown-style-property", `unknown style property "${prop.key}" on ${type}/${variant}`, prop.keyRange);
        }

        const insetsNode = mapGet(node, "insets");
        let insets = null;
        if (insetsNode) {
            if (insetsNode.kind === "map") {
                insets = { left: 0, top: 0, right: 0, bottom: 0 };
                for (const side of INSET_SIDES) insets[side] = numberOr(mapGet(insetsNode, side), 0, text => warn("unknown-style-property", `insets.${side} on ${type}/${variant} is not a number ("${text}")`, insetsNode.range));
                for (const prop of insetsNode.entries) {
                    if (!INSET_SIDES.includes(prop.key)) warn("unknown-style-property", `unknown insets side "${prop.key}" on ${type}/${variant}`, prop.keyRange);
                }
            } else {
                insets = normalizeInsets(numberOr(insetsNode, 0, text => warn("unknown-style-property", `insets on ${type}/${variant} is not a number ("${text}")`, insetsNode.range)));
            }
        }

        const labelNode = mapGet(node, "label");
        let label = null;
        if (labelNode && labelNode.kind === "map") {
            for (const prop of labelNode.entries) {
                if (!LABEL_PROPERTIES.has(prop.key)) warn("unknown-style-property", `unknown label property "${prop.key}" on ${type}/${variant}`, prop.keyRange);
            }
            const align = scalarValue(mapGet(labelNode, "align"));
            if (align && !LABEL_ALIGNMENTS.has(align)) warn("unknown-style-property", `unsupported label.align "${align}" on ${type}/${variant}`, mapGet(labelNode, "align").range);
            label = {};
            if (align && LABEL_ALIGNMENTS.has(align)) label.align = align;
            if (mapGet(labelNode, "offsetX")) label.offsetX = numberOr(mapGet(labelNode, "offsetX"), 0);
            if (mapGet(labelNode, "offsetY")) label.offsetY = numberOr(mapGet(labelNode, "offsetY"), 0);
            if (mapGet(labelNode, "pressedOffset")) label.pressedOffset = numberOr(mapGet(labelNode, "pressedOffset"), 0);
            const font = scalarValue(mapGet(labelNode, "font"));
            if (font) {
                if (!fonts[font]) warn("unknown-style-property", `label.font "${font}" on ${type}/${variant} is not defined in fonts`, mapGet(labelNode, "font").range);
                else label.font = font;
            }
        } else if (labelNode) {
            warn("unknown-style-property", `label on ${type}/${variant} is not a mapping`, labelNode.range);
        }

        const statesNode = mapGet(node, "states");
        const states = {};
        if (statesNode && statesNode.kind === "map") {
            for (const stateEntry of statesNode.entries) {
                if (!STYLE_STATES.includes(stateEntry.key)) {
                    warn("unknown-style-state", `unknown visual state "${stateEntry.key}" on ${type}/${variant}; known states are ${STYLE_STATES.join(", ")}`, stateEntry.keyRange);
                    continue;
                }
                const assetName = scalarValue(stateEntry.valueNode);
                if (!assetName) {
                    warn("unknown-skin-asset", `state "${stateEntry.key}" on ${type}/${variant} names no asset`, stateEntry.valueNode.range);
                    continue;
                }
                useAsset(assetName, stateEntry.valueNode.range, `${type}/${variant} ${stateEntry.key}`);
                states[stateEntry.key] = { asset: assetName, source: { file, range: stateEntry.valueNode.range }, inherited: false };
            }
        } else if (statesNode && !(statesNode.kind === "scalar" && statesNode.value === null)) {
            // A `states:` key with nothing under it is what removing the last
            // override leaves behind; that is empty, not malformed.
            warn("unknown-style-property", `states on ${type}/${variant} is not a mapping`, statesNode.range);
        }

        return {
            description: scalarValue(mapGet(node, "description")),
            extends: scalarValue(mapGet(node, "extends")),
            itemStyle: scalarValue(mapGet(node, "itemStyle")),
            thumbStyle: scalarValue(mapGet(node, "thumbStyle")),
            insets,
            width: mapGet(node, "width") ? numberOr(mapGet(node, "width"), null) : null,
            height: mapGet(node, "height") ? numberOr(mapGet(node, "height"), null) : null,
            focusColor: scalarValue(mapGet(node, "focusColor")),
            label,
            states,
            statesRange: statesNode && statesNode.kind === "map" ? { file, range: statesNode.range } : null,
            source: { file, range: node.range }
        };
    }

    // Expand `extends` within a type, depth-first, guarding against cycles.
    const resolved = new Map();
    function resolveStyle(key, chain) {
        if (resolved.has(key)) return resolved.get(key);
        const entry = raw.get(key);
        if (!entry) return null;
        const { type, variant, parsed } = entry;

        let base = null;
        if (parsed.extends) {
            const baseKey = `${type}/${parsed.extends}`;
            if (chain.includes(baseKey)) {
                warn("unresolved-style-extends", `style ${key} extends itself through ${[...chain, baseKey].join(" -> ")}; the base is ignored`, parsed.source.range);
            } else if (!raw.has(baseKey)) {
                warn("unresolved-style-extends", `style ${key} extends "${parsed.extends}", which ${type} does not define`, parsed.source.range);
            } else {
                base = resolveStyle(baseKey, [...chain, key]);
            }
        }

        const states = {};
        if (base) {
            for (const [state, value] of Object.entries(base.states)) states[state] = { ...value, inherited: true };
        }
        for (const [state, value] of Object.entries(parsed.states)) states[state] = value;

        const style = {
            type,
            variant,
            description: parsed.description ?? (base ? base.description : null),
            extends: parsed.extends || null,
            insets: parsed.insets || (base ? base.insets : normalizeInsets(0)),
            width: parsed.width ?? (base ? base.width : null),
            height: parsed.height ?? (base ? base.height : null),
            focusColor: parsed.focusColor ?? (base ? base.focusColor : null),
            itemStyle: parsed.itemStyle ?? (base ? base.itemStyle : null),
            thumbStyle: parsed.thumbStyle ?? (base ? base.thumbStyle : null),
            label: { align: "left", offsetX: 0, offsetY: 0, pressedOffset: 0, font: Object.keys(fonts)[0], ...(base ? base.label : {}), ...(parsed.label || {}) },
            states,
            statesSource: parsed.statesRange,
            source: parsed.source
        };
        resolved.set(key, style);
        return style;
    }
    for (const key of raw.keys()) resolveStyle(key, [key]);

    const styles = {};
    for (const [key, style] of resolved) {
        const [type] = key.split("/");
        styles[type] = styles[type] || {};
        styles[type][style.variant] = style;
    }
    // A type with variants but no `default` cannot answer an unstyled node.
    for (const [type, variants] of Object.entries(styles)) {
        if (!variants.default) warn("missing-style-default", `styles.${type} has no "default" variant; unstyled ${type} nodes fall back to the built-in one`, stylesNode ? stylesNode.range : root.range);
    }
    for (const [type, variants] of Object.entries(BUILTIN_SKIN.styles)) {
        if (!styles[type]) styles[type] = { ...variants };
        else if (!styles[type].default) styles[type].default = variants.default;
    }

    return {
        name,
        builtin: false,
        mode: "loose",
        description: scalarValue(mapGet(root, "description")),
        source: { file, range: root.range },
        atlas: { ...ATLAS_FILES },
        assets: [...assetUses.values()].sort((a, b) => a.name.localeCompare(b.name)),
        fonts,
        styles
    };
}
