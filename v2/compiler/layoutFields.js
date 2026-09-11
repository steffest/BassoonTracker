// Independent layout fields (spec 005 requirements/design: width/height of
// fill|fixed|<number>, resizable: horizontal|vertical). Fixed dimensions
// without an explicit number come from a component/theme default; a
// missing default produces a warning rather than an invented requirement,
// but this delivery still needs *something* to render, so it falls back to
// a documented generic size and says so in the warning.

const RESIZABLE_VALUES = ["horizontal", "vertical"];
const DIRECTION_VALUES = ["row", "column"];

// Last-resort defaults for a "fixed" dimension with no explicit number.
// Spec 008 made the authored skin the primary source (a style's width/height,
// passed in as `defaults`); these remain for a type the skin says nothing
// about, and are this delivery's documented values, not values read from YAML.
const COMPONENT_DEFAULTS = {
    panel: { height: 28 },
    button: { width: 80, height: 24 },
    radioGroup: { height: 24 },
    label: { height: 20 }
};

const FALLBACK_DEFAULT = { width: 100, height: 24 };

function resolveDimension(type, dimension, rawValue, warnings, nodeLabel, defaults) {
    if (rawValue === undefined || rawValue === null) return { mode: "auto" };
    if (rawValue === "fill") return { mode: "fill" };
    const numeric = Number(rawValue);
    if (rawValue === "fixed" || Number.isFinite(numeric)) {
        if (Number.isFinite(numeric) && rawValue !== "fixed") {
            return { mode: "fixed", size: numeric };
        }
        const componentDefault = defaults?.[type]?.[dimension] ?? COMPONENT_DEFAULTS[type]?.[dimension];
        if (componentDefault !== undefined) {
            return { mode: "fixed", size: componentDefault };
        }
        warnings.push(`no ${dimension} default for component type "${type}" (${nodeLabel}); using fallback ${FALLBACK_DEFAULT[dimension]}px`);
        return { mode: "fixed", size: FALLBACK_DEFAULT[dimension] };
    }
    warnings.push(`unsupported layout.${dimension} value "${rawValue}" on ${nodeLabel}; treating as auto`);
    return { mode: "auto" };
}

/**
 * @param {string} type the node's component type, used to look up a default fixed size
 * @param {{width?: string|number, height?: string|number, resizable?: string}} raw
 * @param {string} nodeLabel identifies the node in warning text (id or source path)
 * @param {Record<string, {width?: number, height?: number}>} [defaults] per-type sizes from
 *   the authored skin (`compiler/skin.js` styleLayoutDefaults), preferred over the table above
 * @returns {{ layout: object, warnings: string[] }}
 */
export function resolveLayoutFields(type, raw, nodeLabel, defaults) {
    const warnings = [];
    const layout = {
        width: resolveDimension(type, "width", raw?.width, warnings, nodeLabel, defaults),
        height: resolveDimension(type, "height", raw?.height, warnings, nodeLabel, defaults)
    };
    // Spec 013: an authored direction beats the component type's declared one,
    // which beats the renderer's fixed-height default.
    if (raw?.direction !== undefined && raw?.direction !== null) {
        if (DIRECTION_VALUES.includes(raw.direction)) {
            layout.direction = raw.direction;
        } else {
            warnings.push(`unsupported layout.direction value "${raw.direction}" on ${nodeLabel}`);
        }
    }
    if (raw?.resizable !== undefined && raw?.resizable !== null) {
        if (RESIZABLE_VALUES.includes(raw.resizable)) {
            layout.resizable = raw.resizable;
        } else {
            warnings.push(`unsupported layout.resizable value "${raw.resizable}" on ${nodeLabel}`);
        }
    }
    return { layout, warnings };
}
