// The skin vocabulary shared by the compiler, the canvas renderer, the
// generated application and the workbench (spec 008): which visual states
// exist, how a state falls back to a less specific one, what the built-in
// fallback skin is, and the two pure lookups that turn a component type and
// a set of interaction flags into one asset name.
//
// It lives in runtime/ on purpose. The renderer must not import
// compiler/skin.js, which pulls in the YAML parser that never ships to the
// application; this module is data plus pure functions, with no DOM, no
// filesystem and no parser, so both sides can share it and it is testable in
// plain Node.

/**
 * Visual states a style may define artwork for. `active` is the
 * highlighted/on state that a "highlighted when ... is active" rule drives;
 * focus is drawn as a ring, not as artwork.
 */
export const STYLE_STATES = ["normal", "hover", "pressed", "disabled", "active", "active_hover", "active_pressed"];

/** For each state, the states whose artwork may stand in for it, best first. */
export const STATE_CHAINS = {
    normal: ["normal"],
    hover: ["hover", "normal"],
    pressed: ["pressed", "normal"],
    disabled: ["disabled", "normal"],
    active: ["active", "normal"],
    active_hover: ["active_hover", "active", "normal"],
    active_pressed: ["active_pressed", "pressed", "active", "normal"]
};

/**
 * Overlays the renderer applies when the artwork it found does not itself
 * express part of the requested state. These are spec 005's tints, kept so a
 * style that only defines `normal` still looks like the old button.
 */
export const STATE_EFFECTS = {
    hoverTint: { fill: "rgba(255,255,255,0.15)", inset: 0, description: "white 15% wash for an un-arted hover" },
    darken: { fill: "rgba(0,0,0,0.3)", inset: 0, description: "black 30% wash for an un-arted pressed" },
    activeWash: { fill: "rgba(80,140,0,0.55)", inset: 2, description: "green wash for an un-arted active/highlighted" },
    dim: { fill: "rgba(0,0,0,0.45)", inset: 0, description: "black 45% wash for an un-arted disabled" }
};

/** Where `node v2/build.mjs skin` writes the packed atlas, relative to assets/skin/. */
export const ATLAS_FILES = { sheet: "generated/atlas.png", map: "generated/atlas.json" };

export function normalizeInsets(value) {
    if (value && typeof value === "object") return { left: 0, top: 0, right: 0, bottom: 0, ...value };
    const size = Number(value) || 0;
    return { left: size, top: size, right: size, bottom: size };
}

function builtinStyle(type, style) {
    return {
        type,
        variant: "default",
        description: style.description || null,
        extends: null,
        insets: normalizeInsets(style.insets ?? 0),
        width: style.width ?? null,
        height: style.height ?? null,
        focusColor: style.focusColor ?? null,
        itemStyle: style.itemStyle ?? null,
        thumbStyle: style.thumbStyle ?? null,
        label: { align: "left", offsetX: 0, offsetY: 0, pressedOffset: 0, font: "small", ...(style.label || {}) },
        states: Object.fromEntries(Object.entries(style.states || {}).map(([state, asset]) => [state, { asset, source: null, inherited: false }])),
        statesSource: null,
        source: null,
        builtin: true
    };
}

/**
 * The skin used when no skin document exists (a `missing-skin` compile) or
 * when a caller asks for artwork with no model at all. It reproduces exactly
 * what `assets.js` hardcoded before spec 008 and reads the older
 * whole-application sprite sheet that sits beside the per-asset folder.
 * Spec 003's renderer, its first consumer, was retired by spec 011; this
 * stays because a half-authored skin must still draw.
 */
export const BUILTIN_SKIN = Object.freeze({
    name: "builtin",
    builtin: true,
    mode: "atlas",
    description: "Built-in fallback skin: the pre-spec-008 hardcoded sprite names, read from the legacy whole-application sprite sheet.",
    source: null,
    atlas: { sheet: "spritesheet_v6.png", map: "spritemap_v6.json" },
    assets: [
        { name: "font", file: null, usedBy: [] },
        { name: "button_inlay", file: null, usedBy: [] },
        { name: "button_inlay_active", file: null, usedBy: [] },
        { name: "button_inlay_green", file: null, usedBy: [] },
        { name: "panel_dark", file: null, usedBy: [] },
        { name: "checkbox_off", file: null, usedBy: [] },
        { name: "panel_inset_dark", file: null, usedBy: [] },
        { name: "checkbox_on", file: null, usedBy: [] }
    ],
    fonts: {
        small: {
            name: "small",
            description: "Compact uppercase 6x6 font, copied from script/src/ui/font.js.",
            asset: "font",
            offsetX: 1, offsetY: 1,
            charWidth: 6, charHeight: 6, spaceWidth: 6,
            margin: 0, lineSpacing: 0, charsPerLine: 42,
            chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,-_#/&@$+^!",
            onlyUpperCase: true,
            source: null
        }
    },
    styles: {
        panel: { default: builtinStyle("panel", { insets: 2, height: 28, states: { normal: "panel_dark" } }) },
        button: { default: builtinStyle("button", { insets: 5, width: 80, height: 24, focusColor: "#ffcc00", label: { align: "center", pressedOffset: 1 }, states: { normal: "button_inlay", pressed: "button_inlay_active", active: "button_inlay_green" } }) },
        viewport: { default: builtinStyle("viewport", { insets: 2, states: { normal: "panel_dark" }, description: "A clipping box, drawn like a panel." }) },
        radioGroup: { default: builtinStyle("radioGroup", { height: 24, itemStyle: "default", description: "Container for exclusive choices; draws nothing itself." }) },
        radioItem: { default: builtinStyle("radioItem", { insets: 5, width: 80, height: 24, focusColor: "#ffcc00", label: { align: "center", pressedOffset: 1 }, states: { normal: "button_inlay", pressed: "button_inlay_active", active: "button_inlay_green" } }) },
        label: { default: builtinStyle("label", { height: 20, label: { align: "left", offsetX: 2 } }) },
        slider: { default: builtinStyle("slider", { insets: 2, width: 120, height: 20, thumbStyle: "default", states: { normal: "panel_dark" }, description: "A track with a draggable thumb; thumbStyle says which button style draws the thumb." }) },
        spinBox: { default: builtinStyle("spinBox", { insets: 2, width: 60, height: 24, thumbStyle: "default", label: { align: "left", offsetX: 4 }, states: { normal: "panel_dark" }, description: "A numeric readout with a stepper column drawn from thumbStyle." }) },
        checkbox: { default: builtinStyle("checkbox", { height: 20, focusColor: "#ffcc00", label: { align: "left" }, states: { normal: "checkbox_off", active: "checkbox_on" } }) }
    }
});

/**
 * Looks a style up by component type and variant, falling back to the type's
 * `default` and then to the built-in one, so the renderer always has
 * something to draw with.
 *
 * @param {object} skin a compiled skin model (or the built-in one)
 * @param {string} type component type, e.g. "button"
 * @param {string|null} [variant] the authored `style:` value
 * @returns {{ style: object, resolvedVariant: string, requested: string, found: boolean }}
 */
export function lookupStyle(skin, type, variant) {
    const requested = variant || "default";
    const byType = (skin && skin.styles && skin.styles[type]) || null;
    if (byType && byType[requested]) return { style: byType[requested], resolvedVariant: requested, requested, found: true };
    if (byType && byType.default) return { style: byType.default, resolvedVariant: "default", requested, found: false };
    const builtin = BUILTIN_SKIN.styles[type] || BUILTIN_SKIN.styles.button;
    return { style: builtin.default, resolvedVariant: "default", requested, found: false };
}

/** The canonical state name for a set of interaction flags. */
export function styleStateName(flags = {}) {
    if (flags.disabled) return "disabled";
    if (flags.active && flags.pressed) return "active_pressed";
    if (flags.active && flags.hover) return "active_hover";
    if (flags.active) return "active";
    if (flags.pressed) return "pressed";
    if (flags.hover) return "hover";
    return "normal";
}

// Which overlays a stand-in asset still needs: one per aspect of the
// requested state that the winning state does not itself express.
function effectsFor(state, from) {
    if (state === "disabled") return from === "disabled" ? [] : ["dim"];
    const covers = part => Boolean(from && from.includes(part));
    const effects = [];
    if (state.includes("active") && !covers("active")) effects.push("activeWash");
    if (state.includes("pressed") && !covers("pressed")) effects.push("darken");
    if (state.includes("hover") && !covers("hover")) effects.push("hoverTint");
    return effects;
}

/**
 * Resolves which asset draws a control, following that state's fallback
 * chain, and reports how it got there so a caller can explain the pixels
 * rather than guess at them.
 *
 * @param {object} style a compiled style
 * @param {object|string} flags `{ hover, pressed, disabled, active }`, or a state name directly
 * @returns {{ state: string, from: string|null, asset: string|null, source: object|null,
 *   inherited: boolean, fallbackFrom: string|null, effects: string[] }}
 */
export function resolveStateAsset(style, flags = {}) {
    const state = typeof flags === "string" ? flags : styleStateName(flags);
    const chain = STATE_CHAINS[state] || ["normal"];
    const states = (style && style.states) || {};
    for (const candidate of chain) {
        const entry = states[candidate];
        if (entry && entry.asset) {
            return {
                state,
                from: candidate,
                asset: entry.asset,
                source: entry.source || null,
                inherited: Boolean(entry.inherited),
                fallbackFrom: candidate === state ? null : candidate,
                effects: effectsFor(state, candidate)
            };
        }
    }
    return { state, from: null, asset: null, source: null, inherited: false, fallbackFrom: null, effects: effectsFor(state, null) };
}

/** Per-type default sizes for `compiler/layoutFields.js`, taken from a skin. */
export function styleLayoutDefaults(skin) {
    const defaults = {};
    for (const [type, variants] of Object.entries((skin && skin.styles) || {})) {
        const style = variants.default || Object.values(variants)[0];
        if (!style) continue;
        const entry = {};
        if (typeof style.width === "number") entry.width = style.width;
        if (typeof style.height === "number") entry.height = style.height;
        if (Object.keys(entry).length) defaults[type] = entry;
    }
    return defaults;
}
