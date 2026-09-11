import { drawScale9 } from "./scale9.js";
import { resolveStateAsset, STATE_EFFECTS, STYLE_STATES, BUILTIN_SKIN } from "../../runtime/skinModel.js";

// One place that turns a component's *state* into pixels, shared by the live
// generic renderer (mountGeneric.js), the workbench's State gallery and the
// Skin tab's variant library, so an illustrated "pressed" looks exactly like
// a real one.
//
// Spec 008 moved the artwork decision into the authored skin: which asset
// draws which state, the 9-slice insets, the label placement and the focus
// colour all come from the style passed in. The tints spec 003/005 hardcoded
// survive as *fallback effects*, applied only where the style has no artwork
// of its own for the state being drawn, so a half-authored skin still looks
// like the old button and the workbench can say which of the two happened.

/** Kept for callers that enumerate the pre-spec-008 fixture set. */
export const BUTTON_VISUAL_STATES = ["default", "hover", "pressed", "focused", "disabled"];

export { STYLE_STATES, resolveStateAsset };

/** The interaction flags a controller state maps to, ignoring focus. */
export function stateFlags(state = {}) {
    return {
        disabled: Boolean(state.disabled),
        pressed: Boolean(state.pressed) && !state.disabled,
        hover: Boolean(state.hover) && !state.disabled,
        active: Boolean(state.highlighted)
    };
}

function defaultStyle(assets, type) {
    if (assets && typeof assets.styleFor === "function") return assets.styleFor(type);
    return (BUILTIN_SKIN.styles[type] || BUILTIN_SKIN.styles.button).default;
}

/** Dashed outline plus the missing asset's name, so absent artwork is visible rather than invisible. */
export function drawMissingArtwork(ctx, rect, assetName, font) {
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = "#e06060";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(rect.width - 1, 0), Math.max(rect.height - 1, 0));
    ctx.restore();
    if (font && assetName) {
        const text = `?${assetName}`;
        font.write(ctx, text.length > 14 ? text.slice(0, 13) + "." : text, rect.x + 2, rect.y + 1);
    }
}

/**
 * Draws a style's background for one visual state and reports what it used.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} assets from loadCanvasAssets()
 * @param {object} style a compiled style
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {object|string} flags `{hover,pressed,disabled,active}` or a state name
 * @returns {object} the resolution from resolveStateAsset(), plus `drawn`
 */
export function drawStyledBackground(ctx, assets, style, rect, flags) {
    const resolution = resolveStateAsset(style, flags);
    const asset = resolution.asset ? assets.skin.getAsset(resolution.asset) : null;
    if (asset) {
        drawScale9(ctx, asset.image, asset, style.insets, rect.x, rect.y, rect.width, rect.height);
    } else if (resolution.asset) {
        drawMissingArtwork(ctx, rect, resolution.asset, assets.font);
    }
    for (const name of resolution.effects) {
        const effect = STATE_EFFECTS[name];
        if (!effect) continue;
        ctx.fillStyle = effect.fill;
        ctx.fillRect(rect.x + effect.inset, rect.y + effect.inset, Math.max(rect.width - effect.inset * 2, 0), Math.max(rect.height - effect.inset * 2, 0));
    }
    return { ...resolution, drawn: Boolean(asset) };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} assets from loadCanvasAssets()
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @param {string} label
 * @param {{ hover?: boolean, pressed?: boolean, focused?: boolean, disabled?: boolean, highlighted?: boolean }} [state]
 * @param {object} [style] the compiled style to draw with; defaults to the skin's button/default
 * @returns {object} which asset drew it and which fallback effects were applied
 */
export function drawButton(ctx, assets, rect, label, state = {}, style = null) {
    const resolved = style || defaultStyle(assets, "button");
    const resolution = drawStyledBackground(ctx, assets, resolved, rect, stateFlags(state));

    const labelStyle = resolved.label || {};
    const font = assets.fontFor ? assets.fontFor(labelStyle.font) : assets.font;
    if (font && label) {
        const offset = state.pressed && !state.disabled ? (labelStyle.pressedOffset || 0) : 0;
        const textWidth = font.getTextWidth(label);
        let tx = rect.x + (labelStyle.offsetX || 0);
        if (labelStyle.align === "center") tx = rect.x + Math.floor((rect.width - textWidth) / 2) + (labelStyle.offsetX || 0);
        else if (labelStyle.align === "right") tx = rect.x + rect.width - textWidth - (labelStyle.offsetX || 0);
        const ty = rect.y + Math.floor((rect.height - font.charHeight) / 2) + (labelStyle.offsetY || 0);
        font.write(ctx, label, tx + offset, ty + offset);
    }

    if (state.focused) {
        ctx.strokeStyle = resolved.focusColor || "#ffcc00";
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(rect.width - 1, 0), Math.max(rect.height - 1, 0));
    }
    return resolution;
}

/**
 * A short human sentence for one resolution, used as a caption in the
 * workbench so a cell explains itself.
 */
export function describeResolution(resolution) {
    if (!resolution.asset) return `${resolution.state}: no artwork`;
    const parts = [`${resolution.state}: ${resolution.asset}`];
    if (resolution.fallbackFrom) parts.push(`via ${resolution.fallbackFrom}`);
    if (resolution.effects.length) parts.push(`+${resolution.effects.join("+")}`);
    else if (!resolution.fallbackFrom) parts.push("own artwork");
    if (resolution.inherited) parts.push("inherited");
    return parts.join(" ");
}
