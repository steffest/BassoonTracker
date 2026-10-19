// Independent layout fields (spec 005 requirements/design: width/height of
// fill|fixed|<number>, resizable: horizontal|vertical). Fixed dimensions
// without an explicit number come from a component/theme default; a
// missing default produces a warning rather than an invented requirement,
// but this delivery still needs *something* to render, so it falls back to
// a documented generic size and says so in the warning.

const RESIZABLE_VALUES = ["horizontal", "vertical"];
export const EXTRA_LAYOUT_FIELDS = ["padding", "gap", "position", "left", "right", "top", "bottom", "offsetX", "offsetY", "widthOffset", "heightOffset", "horizontalFrame", "collapseEmpty", "distribute"];

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
    // v1's own real viewport-relative width (runtime/genericLayout.js's own
    // col2Width() - ported from script/src/ui/app/layout.js's "5-column"
    // system) - width only; a height authoring this is a mistake.
    if (["col1", "col1Minus5", "col2", "col2Exact", "col5", "col1Third", "col2HalfThird", "controlViewButton", "modeDisplay"].includes(rawValue) && dimension === "width") return { mode: rawValue };
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
    for (const key of EXTRA_LAYOUT_FIELDS) {
        const value = raw?.[key];
        if (value === undefined || value === null) continue;
        if (key === "position" && ["absolute", "viewport"].includes(value)) layout[key] = value;
        // Spec 098: v1 sizes an evenly divided row with an integer division
        // and simply leaves the remainder unused at the far end
        // (`Math.floor((width - margin * (cols + 1)) / cols)`,
        // script/src/ui/optionsPanel.js:276). The generic row divides the
        // same space as an exact fraction, which puts every column after the
        // first on a sub-pixel boundary. "floor" is that same integer
        // division, authored rather than special-cased.
        else if (key === "distribute" && value === "floor") layout[key] = value;
        else if (key === "horizontalFrame" && value === "patternTracks") layout[key] = value;
        else if (key === "collapseEmpty" && ["true", "false", true, false].includes(value)) layout[key] = String(value) === "true";
        else if (["left", "right"].includes(key) && ["columnMargin", "col2Left", "col3Left", "col4Left", "controlButtonsLeft", "modeButtonsLeft", "modeAuxButtonsLeft"].includes(value)) layout[key] = value;
        else if (key === "offsetX" && (value === "selfWidth" || /^\d+(?:\.\d+)?selfWidth$/.test(String(value)))) layout[key] = value;
        else if (!["position", "horizontalFrame", "collapseEmpty", "distribute"].includes(key) && Number.isFinite(Number(value)) && (key !== "padding" || Number(value) >= 0)) layout[key] = Number(value);
        else warnings.push(`unsupported layout.${key} value "${value}" on ${nodeLabel}`);
    }
    return { layout, warnings };
}
