import { drawScale9 } from "./scale9.js";
import { resolveStateAsset, STATE_CHAINS, STATE_EFFECTS, STYLE_STATES, BUILTIN_SKIN, styleStateName } from "../../runtime/skinModel.js";

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

const isolatedScale9Assets = new WeakMap();

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
    if (style.fill) {
        ctx.fillStyle = style.fill;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (asset) {
        const ownerDocument = ctx.canvas?.ownerDocument;
        const isolate = candidate => {
            if (!style.metrics?.isolateScale9Source || !ownerDocument) return candidate;
            let drawable = isolatedScale9Assets.get(candidate);
            if (!drawable) {
                // Sampling a scaled sub-rectangle can differ by one channel
                // when the same sprite is packed at a different atlas x/y.
                // Copy it 1:1 first so loose and atlas modes scale from the
                // same local origin, as v1's extracted sprite does.
                const surface = ownerDocument.createElement("canvas");
                surface.width = candidate.width;
                surface.height = candidate.height;
                const surfaceCtx = surface.getContext("2d");
                surfaceCtx.imageSmoothingEnabled = false;
                surfaceCtx.drawImage(candidate.image, candidate.x, candidate.y, candidate.width, candidate.height, 0, 0, candidate.width, candidate.height);
                drawable = { image: surface, x: 0, y: 0, width: candidate.width, height: candidate.height };
                isolatedScale9Assets.set(candidate, drawable);
            }
            return drawable;
        };
        // Spec 098: v1's Button only clears its own canvas when it has *no*
        // background at all (script/src/ui/components/button.js:143), so a
        // state background is painted straight over whatever the previous
        // render left there - the normal one. Invisible for opaque artwork,
        // and the whole visible difference for artwork with a soft edge (the
        // "bar"/"bar_hover" pair the Options panel's close button uses is
        // transparent down its right column and along its bottom row). A
        // style authors this where its own artwork actually needs it.
        const sequence = [];
        if (style.metrics?.stateOverNormal && resolution.from && resolution.from !== "normal") {
            const base = resolveStateAsset(style, "normal");
            const baseAsset = base.asset ? assets.skin.getAsset(base.asset) : null;
            if (baseAsset) sequence.push(baseAsset);
        }
        sequence.push(asset);
        if (style.metrics?.isolateScale9Layer && ownerDocument) {
            const layer = ownerDocument.createElement("canvas");
            layer.width = rect.width;
            layer.height = rect.height;
            const layerCtx = layer.getContext("2d");
            layerCtx.imageSmoothingEnabled = Boolean(style.metrics?.scale9LayerSmoothing);
            for (const candidate of sequence) {
                const drawable = isolate(candidate);
                drawScale9(layerCtx, drawable.image, drawable, style.insets, 0, 0, rect.width, rect.height);
            }
            ctx.drawImage(layer, rect.x, rect.y);
        } else {
            for (const candidate of sequence) {
                const drawable = isolate(candidate);
                drawScale9(ctx, drawable.image, drawable, style.insets, rect.x, rect.y, rect.width, rect.height);
            }
        }
    } else if (resolution.asset) {
        drawMissingArtwork(ctx, rect, resolution.asset, assets.font);
    }
    for (const name of style.metrics?.suppressEffects ? [] : resolution.effects) {
        const effect = STATE_EFFECTS[name];
        if (!effect) continue;
        ctx.fillStyle = effect.fill;
        ctx.fillRect(rect.x + effect.inset, rect.y + effect.inset, Math.max(rect.width - effect.inset * 2, 0), Math.max(rect.height - effect.inset * 2, 0));
    }
    return { ...resolution, drawn: Boolean(asset) };
}

const artworkSuffix = state => state.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("");

/**
 * Resolves a natural-size artwork layer (for example `iconNormal` /
 * `iconActiveHover`) through the same state precedence as a style's
 * background. Layers deliberately do not inherit background tint effects:
 * they are independent authored pixels.
 */
export function resolveArtworkLayer(style, layer, flags = {}) {
    const state = typeof flags === "string" ? flags : styleStateName(flags);
    for (const candidate of STATE_CHAINS[state] || ["normal"]) {
        const asset = style?.artwork?.[`${layer}${artworkSuffix(candidate)}`];
        if (asset) return { state, from: candidate, asset, fallbackFrom: candidate === state ? null : candidate };
    }
    return { state, from: null, asset: null, fallbackFrom: null };
}

function drawNaturalLayer(ctx, assets, style, rect, state, layer) {
    const resolution = resolveArtworkLayer(style, layer, stateFlags(state));
    const asset = resolution.asset ? assets.skin.getAsset(resolution.asset) : null;
    if (!asset) {
        if (resolution.asset) drawMissingArtwork(ctx, rect, resolution.asset, assets.font);
        return { ...resolution, drawn: false };
    }
    const metrics = style.metrics || {};
    const pressedOffset = state.pressed && !state.disabled ? (metrics[`${layer}PressedOffset`] || 0) : 0;
    const leftInset = metrics[`${layer}LeftInset`];
    const rightInset = metrics[`${layer}RightInset`];
    const x = Number.isFinite(leftInset)
        ? rect.x + leftInset + (metrics[`${layer}OffsetX`] || 0) + pressedOffset
        : Number.isFinite(rightInset)
        ? rect.x + rect.width - asset.width - rightInset + (metrics[`${layer}OffsetX`] || 0) + pressedOffset
        : rect.x + Math.floor((rect.width - asset.width) / 2) + (metrics[`${layer}OffsetX`] || 0) + pressedOffset;
    const referenceHeight = Number.isFinite(metrics[`${layer}ReferenceHeight`])
        ? metrics[`${layer}ReferenceHeight`]
        : asset.height;
    const y = rect.y + Math.floor((rect.height - referenceHeight) / 2) + (metrics[`${layer}OffsetY`] || 0) + pressedOffset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, x, y, asset.width, asset.height);
    ctx.restore();
    return { ...resolution, drawn: true, rect: { x, y, width: asset.width, height: asset.height } };
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
    const ownerDocument = ctx.canvas?.ownerDocument;
    if (resolved.metrics?.isolateControlLayer && ownerDocument) {
        const layer = ownerDocument.createElement("canvas");
        layer.width = rect.width;
        layer.height = rect.height;
        const layerCtx = layer.getContext("2d");
        const localStyle = { ...resolved, metrics: { ...resolved.metrics, isolateControlLayer: 0 } };
        const result = drawButton(layerCtx, assets, { x: 0, y: 0, width: rect.width, height: rect.height }, label, state, localStyle);
        ctx.drawImage(layer, rect.x, rect.y);
        return { ...result, isolatedControlLayer: true };
    }
    const resolution = drawStyledBackground(ctx, assets, resolved, rect, stateFlags(state));
    const metrics = resolved.metrics || {};
    const dividerName = resolved.artwork && resolved.artwork.divider;
    const divider = dividerName ? assets.skin.getAsset(dividerName) : null;
    if (divider) {
        let drawable = divider;
        if (metrics.isolateDividerSource && ownerDocument) {
            drawable = isolatedScale9Assets.get(divider);
            if (!drawable) {
                const surface = ownerDocument.createElement("canvas");
                surface.width = divider.width;
                surface.height = divider.height;
                const surfaceCtx = surface.getContext("2d");
                surfaceCtx.imageSmoothingEnabled = false;
                surfaceCtx.drawImage(divider.image, divider.x, divider.y, divider.width, divider.height, 0, 0, divider.width, divider.height);
                drawable = { image: surface, x: 0, y: 0, width: divider.width, height: divider.height };
                isolatedScale9Assets.set(divider, drawable);
            }
        }
        const dividerHeight = Number.isFinite(metrics.dividerHeight) ? metrics.dividerHeight : divider.height;
        ctx.drawImage(drawable.image, drawable.x, drawable.y, drawable.width, drawable.height, rect.x, rect.y, rect.width, dividerHeight);
    }
    let icon = metrics.iconAfterLabel ? null : drawNaturalLayer(ctx, assets, resolved, rect, state, "icon");

    const labelStyle = resolved.label || {};
    const font = assets.fontFor ? assets.fontFor(labelStyle.font) : assets.font;
    if (font && label && !resolved.metrics?.iconOnly) {
        const offset = state.pressed && !state.disabled ? (labelStyle.pressedOffset || 0) : 0;
        const textWidth = Number.isFinite(resolved.metrics?.fixedLabelCellWidth)
            ? label.length * resolved.metrics.fixedLabelCellWidth
            : font.getTextWidth(label);
        let tx = rect.x + (labelStyle.offsetX || 0);
        if (labelStyle.align === "center") tx = rect.x + Math.floor((rect.width - textWidth) / 2) + (labelStyle.offsetX || 0);
        else if (labelStyle.align === "right") tx = rect.x + rect.width - textWidth - (labelStyle.offsetX || 0);
        const ty = rect.y + Math.floor((rect.height - font.charHeight) / 2) + (labelStyle.offsetY || 0) + (state.highlighted ? (labelStyle.activeOffsetY || 0) : 0);
        font.write(ctx, label, tx + offset, ty + offset);
    }

    // Some bitmap controls deliberately wash the already-rendered label and
    // background before placing their state glyph on top. The values remain
    // authored skin metrics so this is reusable composition, not a branch on
    // a component type, variant or id.
    if (state.highlighted && Number.isFinite(metrics.activeOverlayAlpha)) {
        ctx.fillStyle = `rgba(${metrics.activeOverlayR || 0},${metrics.activeOverlayG || 0},${metrics.activeOverlayB || 0},${metrics.activeOverlayAlpha})`;
        ctx.fillRect(rect.x, rect.y, Math.max(rect.width - (metrics.activeOverlayRightInset || 0), 0), rect.height);
    }
    if (metrics.iconAfterLabel) icon = drawNaturalLayer(ctx, assets, resolved, rect, state, "icon");

    if (state.focused && !resolved.metrics?.hideFocus) {
        ctx.strokeStyle = resolved.focusColor || "#ffcc00";
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(rect.width - 1, 0), Math.max(rect.height - 1, 0));
    }
    if (state.disabled && Number.isFinite(metrics.disabledOverlayAlpha)) {
        ctx.fillStyle = `rgba(${metrics.disabledOverlayR || 0},${metrics.disabledOverlayG || 0},${metrics.disabledOverlayB || 0},${metrics.disabledOverlayAlpha})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    const barGlyph = resolved.barGlyph;
    if (barGlyph) {
        const count = Math.max(0, Math.floor(barGlyph.count));
        const thickness = Math.max(0, Math.floor(barGlyph.thickness));
        const gap = Math.max(0, Math.floor(barGlyph.gap));
        const span = count * thickness + Math.max(count - 1, 0) * gap;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = barGlyph.color;
        if (barGlyph.orientation === "vertical") {
            const startX = rect.x + Math.floor((rect.width - span) / 2);
            const startY = rect.y + Math.floor(rect.height * barGlyph.startRatio);
            const extent = Math.floor(rect.height * barGlyph.extentRatio);
            for (let i = 0; i < count; i++) ctx.fillRect(startX + i * (thickness + gap), startY, thickness, extent);
        } else {
            const startX = rect.x + Math.floor(rect.width * barGlyph.startRatio);
            const startY = rect.y + Math.floor((rect.height - span) / 2);
            const extent = Math.floor(rect.width * barGlyph.extentRatio);
            for (let i = 0; i < count; i++) ctx.fillRect(startX, startY + i * (thickness + gap), extent, thickness);
        }
        ctx.restore();
    }
    return { ...resolution, layers: { icon } };
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
