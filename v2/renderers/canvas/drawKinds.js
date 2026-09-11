// How each kind of component is painted and measured on canvas (spec 009).
//
// A component type declares a *draw kind* in runtime/componentTypes.js; this
// table is the one place that turns a kind into pixels. Adding a type that
// looks like an existing one needs nothing here. Adding a type that looks new
// needs one entry, and the renderer's dispatch does not change.
//
// Every entry has the same two members:
//   draw(ctx, assets, style, rect, label, state, node) -> resolution|null
//   measure(assets, style, label)                      -> { width, height }
// `style` is a compiled skin style (spec 008) and `state` is the controller's
// state plus `highlighted`, exactly as buttonSkin.js expects them.
//
// Spec 014 adds two members to `state` that are not interaction flags,
// because a kind that draws a number or a thumb needs them and the renderer
// is the only place that can resolve them:
//   state.value   the node's current numeric value (a slider, a spin box)
//   state.scroll  { extent, offset } for a viewport, so it can draw a thumb
// `stateFlags` ignores both, so nothing about state resolution changes.

import { drawButton, drawStyledBackground, stateFlags } from "./buttonSkin.js";
import { resolveStateAsset, styleStateName } from "../../runtime/skinModel.js";
import { thumbMetrics } from "../../runtime/scrollbar.js";
import { STEPPER_WIDTH, boundsOf } from "../../runtime/valueController.js";

const MIN_CONTROL_HEIGHT = 20;
const SPRITE_GAP = 4;
const MIN_SLIDER_THUMB = 10;

/** How far along its range a value sits, 0 to 1. */
function progressOf(value, bounds) {
    const span = bounds.max - bounds.min;
    if (!span) return 0;
    const numeric = Number.isFinite(Number(value)) ? Number(value) : bounds.min;
    return Math.min(Math.max((numeric - bounds.min) / span, 0), 1);
}

/**
 * The style a thumb or a stepper half is drawn with. `thumbStyle` names a
 * variant of the `button` type, exactly as a radioGroup's `itemStyle` names a
 * variant of `radioItem`, so a skin can restyle a thumb without new artwork.
 */
function thumbStyleOf(assets, style) {
    return assets.styleFor ? assets.styleFor("button", (style && style.thumbStyle) || "default") : style;
}

// `state` may be a controller state object or a state name, so the workbench
// can ask for one specific state and the renderer can pass what it has.
function flagsOf(state) {
    return typeof state === "string" ? state : stateFlags(state || {});
}

function labelFont(assets, style) {
    return assets.fontFor ? assets.fontFor(style && style.label && style.label.font) : assets.font;
}

function textSize(assets, style, label) {
    const font = labelFont(assets, style);
    return { width: font.getTextWidth(label), height: font.charHeight };
}

/** A leaf that only carries text: the pre-009 default measurement. */
function measureText(assets, style, label) {
    const { width, height } = textSize(assets, style, label);
    return { width: width + 4, height: Math.max(height + 4, MIN_CONTROL_HEIGHT) };
}

/** A leaf drawn as a control, with room for its artwork's insets. */
function measureControl(assets, style, label) {
    const { width, height } = textSize(assets, style, label);
    return { width: width + 16, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
}

function writeLabel(ctx, assets, style, rect, label) {
    const font = labelFont(assets, style);
    if (!font || !label) return;
    const offsetX = (style && style.label && style.label.offsetX) || 0;
    const offsetY = (style && style.label && style.label.offsetY) || 0;
    font.write(ctx, label, rect.x + offsetX, rect.y + Math.floor((rect.height - font.charHeight) / 2) + offsetY);
}

export const DRAW_KINDS = {
    /**
     * A container: its style's artwork behind whatever its children draw,
     * plus a scrollbar thumb when the renderer reported an overflowing
     * content extent for it (spec 014: this is how a viewport shows how far
     * down its content it is).
     */
    background: {
        draw(ctx, assets, style, rect, label, state) {
            const resolution = drawStyledBackground(ctx, assets, style, rect, flagsOf(state));
            const scroll = state && state.scroll;
            if (scroll) {
                const metrics = thumbMetrics(rect, scroll.extent, scroll.offset);
                if (metrics) {
                    ctx.save();
                    ctx.fillStyle = "rgba(0,0,0,0.35)";
                    ctx.fillRect(metrics.track.x, metrics.track.y, metrics.track.width, metrics.track.height);
                    ctx.restore();
                    drawStyledBackground(ctx, assets, thumbStyleOf(assets, style), metrics.thumb, flagsOf(state));
                }
            }
            return resolution;
        },
        measure: measureText
    },

    /** A control: artwork per visual state, with the style's label on top. */
    backgroundLabel: {
        draw(ctx, assets, style, rect, label, state) {
            return drawButton(ctx, assets, rect, label, state || {}, style);
        },
        measure: measureControl
    },

    /** Text only, at the style's label offsets. */
    label: {
        draw(ctx, assets, style, rect, label) {
            writeLabel(ctx, assets, style, rect, label);
            return null;
        },
        measure: measureText
    },

    /**
     * Artwork at its natural size with the label beside it, which is how a
     * checkbox or a radio dot is drawn: the sprite is not stretched, so the
     * style's insets are ignored on purpose.
     */
    spriteLabel: {
        draw(ctx, assets, style, rect, label, state) {
            const resolution = resolveStateAsset(style, flagsOf(state));
            const asset = resolution.asset ? assets.skin.getAsset(resolution.asset) : null;
            const font = labelFont(assets, style);
            let x = rect.x;
            if (asset) {
                const y = rect.y + Math.max(Math.floor((rect.height - asset.height) / 2), 0);
                ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, x, y, asset.width, asset.height);
                x += asset.width + SPRITE_GAP;
            }
            if (font && label) {
                font.write(ctx, label, x, rect.y + Math.floor((rect.height - font.charHeight) / 2));
            }
            if (state && state.focused) {
                ctx.strokeStyle = (style && style.focusColor) || "#ffcc00";
                ctx.lineWidth = 1;
                ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(rect.width - 1, 0), Math.max(rect.height - 1, 0));
            }
            return { ...resolution, drawn: Boolean(asset) };
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            const normal = resolveStateAsset(style, "normal");
            const asset = normal.asset && assets.skin ? assets.skin.getAsset(normal.asset) : null;
            const spriteWidth = asset ? asset.width + SPRITE_GAP : 0;
            const spriteHeight = asset ? asset.height : 0;
            return { width: spriteWidth + width + 4, height: Math.max(height, spriteHeight) + 4 };
        }
    },

    /**
     * A horizontal track with a thumb at the value's position, and the value
     * itself as text where the style asks for it. The thumb is drawn from the
     * style's `thumbStyle`, so no new artwork is needed.
     */
    slider: {
        draw(ctx, assets, style, rect, label, state, node) {
            const flags = flagsOf(state);
            const resolution = drawStyledBackground(ctx, assets, style, rect, flags);
            const bounds = boundsOf(node);
            const inset = (style && style.insets && style.insets.left) || 0;
            const trackX = rect.x + inset;
            const trackWidth = Math.max(rect.width - inset * 2, 0);
            const thumbWidth = Math.min(Math.max(MIN_SLIDER_THUMB, Math.round(rect.height - 4)), trackWidth);
            const travel = Math.max(trackWidth - thumbWidth, 0);
            const thumb = {
                x: Math.round(trackX + travel * progressOf(state && state.value, bounds)),
                y: rect.y + 2,
                width: thumbWidth,
                height: Math.max(rect.height - 4, 1)
            };
            drawStyledBackground(ctx, assets, thumbStyleOf(assets, style), thumb, flags);
            writeLabel(ctx, assets, style, rect, label);
            return resolution;
        },
        measure(assets, style, label) {
            const { height } = textSize(assets, style, label);
            return { width: (style && style.width) || 120, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
        }
    },

    /**
     * A numeric readout with a stepper column on the right: a `+` half above
     * a `-` half, both drawn from the style's `thumbStyle`. The two glyphs are
     * in the skin's only font, so no artwork is needed here either.
     */
    spinBox: {
        draw(ctx, assets, style, rect, label, state) {
            const flags = flagsOf(state);
            const resolution = drawStyledBackground(ctx, assets, style, rect, flags);
            const stepperWidth = Math.min(STEPPER_WIDTH, Math.max(rect.width - 8, 0));
            const readout = { ...rect, width: Math.max(rect.width - stepperWidth, 0) };
            writeLabel(ctx, assets, style, readout, label);
            if (stepperWidth <= 0) return resolution;

            const thumbStyle = thumbStyleOf(assets, style);
            const half = Math.floor(rect.height / 2);
            const up = { x: rect.x + rect.width - stepperWidth, y: rect.y, width: stepperWidth, height: half };
            const down = { x: up.x, y: rect.y + half, width: stepperWidth, height: rect.height - half };
            const font = labelFont(assets, style);
            for (const [box, glyph] of [[up, "+"], [down, "-"]]) {
                drawStyledBackground(ctx, assets, thumbStyle, box, flags);
                if (font) {
                    font.write(ctx, glyph,
                        box.x + Math.floor((box.width - font.getTextWidth(glyph)) / 2),
                        box.y + Math.floor((box.height - font.charHeight) / 2));
                }
            }
            return resolution;
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            return { width: Math.max((style && style.width) || 0, width + STEPPER_WIDTH + 12), height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
        }
    },

    /** A grouping node with no artwork of its own; its children draw themselves. */
    none: {
        draw() {
            return null;
        },
        measure: measureText
    },

    /**
     * Anything the renderer cannot draw: a dashed box naming the type, so an
     * unsupported or unregistered component is visible and inspectable rather
     * than silently missing (spec 005 design.md).
     */
    placeholder: {
        draw(ctx, assets, style, rect, label, state, node) {
            ctx.save();
            ctx.setLineDash([3, 2]);
            ctx.strokeStyle = "#e0c060";
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(rect.width - 1, 0), Math.max(rect.height - 1, 0));
            ctx.restore();
            const text = `${node ? node.type : "?"}: ${label}`;
            const clipped = text.length > 24 ? text.slice(0, 23) + "…" : text;
            assets.font.write(ctx, clipped, rect.x + 3, rect.y + Math.floor((rect.height - assets.font.charHeight) / 2));
            return null;
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            return { width: Math.max(width + 16, 60), height: Math.max(height + 12, 24) };
        }
    }
};

/** The kind's implementation, falling back to the placeholder for an unknown kind. */
export function drawKind(name) {
    return DRAW_KINDS[name] || DRAW_KINDS.placeholder;
}

export { styleStateName };
