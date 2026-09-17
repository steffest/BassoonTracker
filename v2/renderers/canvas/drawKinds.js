// How each kind of component is painted and measured on canvas (spec 009).
//
// A component type declares a *draw kind* in runtime/componentTypes.js; this
// table is the one place that turns a kind into pixels. Adding a type that
// looks like an existing one needs nothing here. Adding a type that looks new
// needs one entry, and the renderer's dispatch does not change.
//
// Every entry has the same two members:
//   draw(ctx, assets, style, rect, label, state, node) -> resolution|null
//   measure(assets, style, label, node)                -> { width, height }
// `style` is a compiled skin style (spec 008) and `state` is the controller's
// state plus `highlighted`, exactly as buttonSkin.js expects them. `measure`'s
// `node` (spec 017) exists only so a kind whose natural size depends on an
// asset (`image`, `icon`) can resolve one; every other kind still ignores it.
//
// Spec 014 adds two members to `state` that are not interaction flags,
// because a kind that draws a number or a thumb needs them and the renderer
// is the only place that can resolve them:
//   state.value   the node's current numeric value (a slider, a spin box)
//   state.scroll  { extent, offset } for a viewport, so it can draw a thumb
// Spec 017 adds a third, for any non-interactive type with a bound `field`
// that is not one of the above (so far, only `animSprite`'s frame index):
//   state.fieldValue   the raw value of node.field, read generically -
//                      nothing here or in mountGeneric.js names animSprite
// `stateFlags` ignores all three, so nothing about state resolution changes.

import { drawButton, drawStyledBackground, stateFlags } from "./buttonSkin.js";
import { resolveStateAsset, styleStateName } from "../../runtime/skinModel.js";
import { thumbMetrics } from "../../runtime/scrollbar.js";
import { STEPPER_WIDTH, boundsOf } from "../../runtime/valueController.js";
import { componentType } from "../../runtime/componentTypes.js";
import * as song from "../../domain/song/index.js";
import * as sampleEditor from "../../domain/sampleEditor/index.js";
import { getLoopCreatorState, getLoopCreatorLayers } from "../../domain/sampleEditor/loopCreator.js";
import { BLEND_MARGIN, HANDLE_BAR_HEIGHT as LOOP_HANDLE_BAR_HEIGHT } from "./loopCreatorGeometry.js";
import { LINE_HEIGHT, GUTTER_WIDTH, visibleTrackCount, trackSlotX, columnRect } from "./patternGridGeometry.js";
import { drawCachedText, drawCachedLineNumber } from "./patternGridGlyphs.js";
import { ROW_HEIGHT as FILE_BROWSER_ROW_HEIGHT, ICON_SIZE, INDENT_WIDTH, contentHeight, visibleRowRange } from "./fileBrowserGeometry.js";
import { sampleIndexToPixel } from "./waveformGeometry.js";
import * as nibbles from "../../domain/nibbles/index.js";
import * as arrangement from "../../domain/arrangement/index.js";
import * as mt from "./multitrackGeometry.js";
import * as playback from "../../domain/playback/index.js";
import * as vuGeo from "./vuMeterGeometry.js";
import * as envelope from "../../domain/sampleEditor/envelope.js";
import * as envGeo from "./envelopeGeometry.js";
import * as scopesGeo from "./scopesGeometry.js";
import * as pianoGeo from "./pianoGeometry.js";

const MIN_CONTROL_HEIGHT = 20;
const SPRITE_GAP = 4;
const MIN_SLIDER_THUMB = 10;
// rangeSlider (spec 018): the length along its travel axis, whichever axis
// that is. A skin style's own width/height cannot express "the length when
// vertical vs. when horizontal" for one shared style, so this is a constant
// rather than read from the style for the vertical case; see design.md.
const RANGE_SLIDER_LENGTH = 120;
// knob (spec 018): the same sweep v1's own rotary control uses, in radians.
const KNOB_MIN_ANGLE = -230 * Math.PI / 180;
const KNOB_MAX_ANGLE = 50 * Math.PI / 180;
const KNOB_SIZE = 64;
const KNOB_LABEL_HEIGHT = 12;
// dropdown (spec 020): width set aside for the closed control's own arrow, and
// how many rows its popup shows before it has to scroll, matching v1's own
// _arrowWidth/_maxVisibleItems.
const DROPDOWN_ARROW_WIDTH = 16;
const DROPDOWN_POPUP_MAX_ROWS = 8;
const DROPDOWN_ROW_HEIGHT = 22;
// submenu (spec 020): row height and the ">" glyph's reserved width, matching
// v1's own _itemHeight/nested-item affordance.
const SUBMENU_ROW_HEIGHT = 26;
const SUBMENU_ARROW_WIDTH = 16;
// modalDialog (spec 020): panel sizing, matching v1's own _layout().
const MODAL_MIN_HEIGHT = 20;
const MODAL_MAX_HEIGHT = 200;
const MODAL_MIN_WIDTH = 380;
// collapsePanel (spec 021): the chevron's reserved width, matching a small glyph.
const COLLAPSE_CHEVRON_WIDTH = 14;
const TAB_HEADER_FALLBACK_HEIGHT = 24;

/** The reserved header strip's height for a tabPanel-like node (spec 021), read from the same registry fact runtime/genericLayout.js uses. */
function tabHeaderHeightOf(node) {
    const entry = node && componentType(node.type);
    return (entry && entry.tabHeader && entry.tabHeader.height) || TAB_HEADER_FALLBACK_HEIGHT;
}

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

/**
 * A scrollbar thumb over a track, from `state.scroll` (spec 014: {extent,
 * offset}, set by the renderer for any behavior that scrolls). Shared by
 * `background` (a viewport) and `listbox` (spec 019), so the two can never
 * draw a thumb differently.
 */
function drawScrollThumb(ctx, assets, style, rect, state) {
    const scroll = state && state.scroll;
    if (!scroll) return;
    const metrics = thumbMetrics(rect, scroll.extent, scroll.offset);
    if (!metrics) return;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(metrics.track.x, metrics.track.y, metrics.track.width, metrics.track.height);
    ctx.restore();
    drawStyledBackground(ctx, assets, thumbStyleOf(assets, style), metrics.thumb, flagsOf(state));
}

/**
 * The named skin asset an `image`/`icon`/`animSprite` node points at (spec
 * 017): `src` for image, `icon` for icon, or an explicit name for animSprite,
 * whose property is `sprite` rather than either. Not a style-state lookup -
 * these types have no interaction states, only a directly authored name.
 */
function imageAsset(assets, node, explicitName) {
    const name = explicitName || (node && (node.src || node.icon));
    if (!name || !assets || !assets.skin) return null;
    return assets.skin.getAsset(name);
}

/** Zero-padded uppercase hex, for patternGrid's instrument/effect/param columns (spec 030). */
function formatHex(value, length) {
    let text = (value || 0).toString(16).toUpperCase();
    while (text.length < length) text = "0" + text;
    return text;
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

/** loopCreatorView (spec 044): one blend layer's own waveform shape, plotted only over its own limited sample range - ported from loopCreator.js#drawLayer (519-537). */
function drawLoopBlendLayer(ctx, layerData, sampleStart, at, rect, waveH, lineColor, fillColor) {
    const S = layerData.length;
    if (S === 0) return;
    const startX = at(sampleStart);
    const endX = at(sampleStart + S);
    const pxW = endX - startX;
    if (pxW <= 0) return;
    const mid = rect.y + waveH / 2;
    const maxAmp = waveH / 2 - 2;
    ctx.fillStyle = fillColor;
    ctx.fillRect(startX, rect.y, pxW, waveH);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < pxW; i++) {
        const v = layerData[Math.floor((i / pxW) * S)] * -maxAmp;
        if (i === 0) ctx.moveTo(startX + i, mid + v);
        else ctx.lineTo(startX + i, mid + v);
    }
    ctx.stroke();
}

/** loopCreatorView (spec 044): one blend-volume/orig-volume line, a filled triangle with its wide (loud) end toward whichever side is louder - ported from loopCreator.js#drawBlendLine (490-517). `wideAtStart` picks which end that is, exactly as each of v1's own six call sites (429-449) does. */
function drawLoopBlendLine(ctx, blend, sampleStart, sampleEnd, at, rectY, waveH, colorBase, active, wideAtStart) {
    if (sampleEnd <= sampleStart) return;
    const x0 = at(sampleStart), x1 = at(sampleEnd);
    if (x1 <= x0) return;
    const y = Math.round(rectY + BLEND_MARGIN + (1 - blend) * (waveH - BLEND_MARGIN * 2));
    const hh = 4;
    ctx.beginPath();
    if (wideAtStart) {
        ctx.moveTo(x0, y - hh);
        ctx.lineTo(x0, y + hh);
        ctx.lineTo(x1, y);
    } else {
        ctx.moveTo(x1, y - hh);
        ctx.lineTo(x1, y + hh);
        ctx.lineTo(x0, y);
    }
    ctx.closePath();
    ctx.fillStyle = colorBase + (active ? " 0.85)" : " 0.55)");
    ctx.fill();
    ctx.strokeStyle = colorBase + (active ? " 1.0)" : " 0.9)");
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.stroke();
}

/** loopCreatorView (spec 044): one blend-size handle - ported from loopCreator.js#drawHandle (481-488). */
function drawLoopHandle(ctx, x, midY, color, active) {
    const hh = LOOP_HANDLE_BAR_HEIGHT;
    const top = midY - Math.floor(hh / 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = active ? 1 : 0.7;
    ctx.fillRect(x - 2, top, 4, hh);
    ctx.globalAlpha = 1;
}

// multitrackView (spec 052): the sixteen instrument-tint colors, ported
// from dawtrack.js's own COLORS (33-38) - the port's own flat-fill
// simplification (no waveform thumbnail, see requirements.md's Decisions)
// still colors a block by its own instrument the same way v1's own does.
const MULTITRACK_COLORS = [
    "#4a9eff", "#ff6b6b", "#4ecdc4", "#ffd93d",
    "#a8e6cf", "#f8b500", "#95e1d3", "#ff8b94",
    "#6bc5ff", "#ffaa6b", "#84d4c0", "#ffe57a",
    "#c9b1ff", "#ff9eb5", "#a8d8ea", "#fee140"
];

/** Ported from dawtrack.js#buildCache's own colorIndex line (318). */
function multitrackColorFor(instrument) {
    const index = instrument > 0 ? (instrument - 1) % MULTITRACK_COLORS.length : 14;
    return MULTITRACK_COLORS[index];
}

/** multitrackView's own header ruler - ported from multitrack.js#_renderBlockCanvas's own step-label loop (454-471), simplified to one fixed label density rather than v1's own zoom-dependent stepEvery ladder. */
function drawMultitrackRuler(ctx, assets, rect, patternLength, pixelsPerStep, scrollX) {
    ctx.fillStyle = "rgb(7, 17, 30)";
    ctx.fillRect(rect.x + mt.CTRL_WIDTH, rect.y, rect.width - mt.CTRL_WIDTH, mt.HEADER_HEIGHT);
    ctx.fillStyle = "rgb(5, 15, 26)";
    ctx.fillRect(rect.x, rect.y, mt.CTRL_WIDTH, mt.HEADER_HEIGHT);

    for (let s = 0; s <= patternLength; s += 16) {
        const x = rect.x + mt.stepToX(s, pixelsPerStep, scrollX);
        if (x < rect.x + mt.CTRL_WIDTH || x >= rect.x + rect.width) continue;
        ctx.fillStyle = "rgba(140,200,255,0.8)";
        ctx.fillRect(x, rect.y + mt.HEADER_HEIGHT - 7, 1, 7);
        if (assets.font) assets.font.write(ctx, String(s), x + 2, rect.y + mt.HEADER_HEIGHT - 8 - assets.font.charHeight);
    }
    ctx.fillStyle = "rgba(70,120,190,0.3)";
    ctx.fillRect(rect.x + mt.CTRL_WIDTH, rect.y, 1, rect.height);
}

/** The playhead - ported from multitrack.js#_drawCursor (515-528), the triangle omitted (a flat simplification). */
function drawMultitrackPlayhead(ctx, rect, pixelsPerStep, scrollX) {
    const pos = song.getCurrentPatternPos();
    const x = rect.x + mt.stepToX(pos, pixelsPerStep, scrollX);
    if (x < rect.x + mt.CTRL_WIDTH || x >= rect.x + rect.width) return;
    ctx.fillStyle = "rgba(255,210,50,0.8)";
    ctx.fillRect(x, rect.y + mt.HEADER_HEIGHT, 1, rect.height - mt.HEADER_HEIGHT);
}

/** One lane's own block/effects area - a flat-fill simplification of dawtrack.js#buildCache (261-397), see requirements.md's Decisions. */
function drawMultitrackLane(ctx, assets, rect, laneTop, laneHeight, track, pattern, scrollX, pixelsPerStep) {
    const contentX = rect.x + mt.CTRL_WIDTH;
    const contentW = rect.width - mt.CTRL_WIDTH;
    const effectH = Math.min(16, Math.max(0, Math.floor(laneHeight * 0.3)));
    const blockAreaH = laneHeight - effectH;

    ctx.fillStyle = track % 2 === 0 ? "rgb(16,25,40)" : "rgb(20,30,50)";
    ctx.fillRect(contentX, laneTop, contentW, blockAreaH);
    if (effectH > 0) {
        ctx.fillStyle = track % 2 === 0 ? "rgb(8,15,28)" : "rgb(11,18,32)";
        ctx.fillRect(contentX, laneTop + blockAreaH, contentW, effectH);
    }

    for (let s = 0; s <= 64; s += 16) {
        const x = rect.x + mt.stepToX(s, pixelsPerStep, scrollX);
        if (x < contentX || x >= rect.x + rect.width) continue;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x, laneTop, 1, laneHeight);
    }

    const blocks = arrangement.getPerTrackBlocks(pattern)[track] || [];
    for (const block of blocks) {
        const bx = rect.x + mt.stepToX(block.startStep, pixelsPerStep, scrollX);
        const bw = (block.endStep - block.startStep) * pixelsPerStep;
        const cx = Math.max(bx, contentX);
        const cw = Math.min(bx + bw, rect.x + rect.width) - cx;
        if (cw <= 0) continue;
        ctx.fillStyle = multitrackColorFor(block.instrument);
        ctx.globalAlpha = 0.65;
        ctx.fillRect(cx, laneTop + 2, cw, blockAreaH - 4);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.strokeRect(cx + 0.5, laneTop + 2.5, Math.max(0, cw - 1), Math.max(0, blockAreaH - 5));
        if (assets.font && cw > 18) {
            assets.font.write(ctx, block.name || "", cx + 4, laneTop + 4);
        }
    }

    if (effectH > 0) {
        const effects = arrangement.getPerTrackEffects(pattern)[track] || [];
        for (const eff of effects) {
            const ex = rect.x + mt.stepToX(eff.step, pixelsPerStep, scrollX);
            if (ex < contentX || ex >= rect.x + rect.width) continue;
            if (assets.font) {
                const text = eff.effect.toString(16).toUpperCase() + ("0" + eff.param.toString(16).toUpperCase()).slice(-2);
                assets.font.write(ctx, text, ex + 1, laneTop + blockAreaH + 1);
            }
        }
    }
}

/** The control strip's own three buttons - ported from dawtrack.js#createTrackControls (97-187), flat rectangles rather than the scale-9 background image (see requirements.md's Decisions). */
function drawMultitrackControls(ctx, assets, rect, laneTop, laneHeight, track) {
    const contentX = rect.x;
    ctx.fillStyle = track % 2 === 0 ? "rgb(10,18,32)" : "rgb(14,22,40)";
    ctx.fillRect(contentX, laneTop, mt.CTRL_WIDTH, laneHeight);

    const muteSolo = arrangement.getTrackMuteSolo(track);
    const buttons = [
        { key: "solo", label: "S", active: muteSolo.solo, color: "rgba(90,200,120,0.9)" },
        { key: "mute", label: "M", active: muteSolo.mute, color: "rgba(220,90,90,0.9)" },
        { key: "record", label: "R", active: false, color: "rgba(220,90,90,0.9)" }
    ];
    for (const button of buttons) {
        const r = mt.controlButtonRect(button.key, laneHeight);
        ctx.fillStyle = button.active ? button.color : "rgba(255,255,255,0.12)";
        ctx.fillRect(contentX + r.x, laneTop + r.y, r.width, r.height);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeRect(contentX + r.x + 0.5, laneTop + r.y + 0.5, r.width - 1, r.height - 1);
        if (assets.font) {
            assets.font.write(ctx, button.label, contentX + r.x + Math.floor(r.width / 2) - 3, laneTop + r.y + Math.floor(r.height / 2) - Math.floor(assets.font.charHeight / 2));
        }
    }

    // The live oscilloscope - ported from dawtrack.js#drawScopeTo (407-437).
    const midY = laneTop + laneHeight / 2;
    const scopeX = contentX + mt.SCOPE_LEFT;
    ctx.beginPath();
    if (!muteSolo.mute) {
        const data = arrangement.getTrackScopeData(track, MULTITRACK_SCOPE_BUFFER);
        ctx.strokeStyle = "rgba(100,220,80,0.65)";
        if (data) {
            const sliceW = mt.SCOPE_WIDTH / data.length;
            for (let j = 0; j < data.length; j++) {
                const v = data[j] / 128.0;
                const x = scopeX + j * sliceW;
                const y = laneTop + v * laneHeight / 2;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        } else {
            ctx.moveTo(scopeX, midY);
            ctx.lineTo(scopeX + mt.SCOPE_WIDTH - 1, midY);
        }
    } else {
        ctx.strokeStyle = "rgba(100,220,80,0.25)";
        ctx.moveTo(scopeX, midY);
        ctx.lineTo(scopeX + mt.SCOPE_WIDTH - 1, midY);
    }
    ctx.stroke();
}

const MULTITRACK_SCOPE_BUFFER = new Uint8Array(256);
/** scopesView's own reused buffer (spec 058) - a second one, not shared with MULTITRACK_SCOPE_BUFFER above, since both could in principle be drawn (and read) in the same frame. */
const SCOPES_BUFFER = new Uint8Array(256);

/** The drag ghost while moving a note - ported from multitrack.js#_drawDragGhost (549-585), the instrument-name label kept, the block's own length shown at the target. */
function drawMultitrackDragGhost(ctx, assets, rect, dragNote, pattern, scrollX, scrollY, pixelsPerStep, trackHeight) {
    const blocks = arrangement.getPerTrackBlocks(pattern)[dragNote.sourceTrack] || [];
    const block = mt.findBlockAt(blocks, dragNote.sourceStep);
    const lengthSteps = block ? block.endStep - block.startStep : 1;

    const gx = rect.x + mt.stepToX(dragNote.targetStep, pixelsPerStep, scrollX);
    const gy = rect.y + mt.HEADER_HEIGHT + dragNote.targetTrack * trackHeight - scrollY;
    const gw = Math.max(4, lengthSteps * pixelsPerStep - 2);
    const gh = Math.max(4, trackHeight - 4);
    if (gy + gh < rect.y + mt.HEADER_HEIGHT || gy >= rect.y + rect.height) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x + mt.CTRL_WIDTH, rect.y + mt.HEADER_HEIGHT, rect.width - mt.CTRL_WIDTH, rect.height - mt.HEADER_HEIGHT);
    ctx.clip();
    ctx.fillStyle = "rgba(255,220,50,0.45)";
    ctx.fillRect(gx, gy + 2, gw, gh);
    ctx.strokeStyle = "#ffd232";
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy + 2, gw, gh);
    if (assets.font && block) assets.font.write(ctx, block.name || "", gx + 4, gy + 5);
    ctx.restore();
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
            drawScrollThumb(ctx, assets, style, rect, state);
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
     * slider's track-and-thumb generalized to an optional vertical axis
     * (spec 018), read from `node.vertical`, the same way the controller
     * itself reads it. Horizontal and vertical are otherwise the same
     * artwork and the same `progressOf` math, just swapped which axis travels.
     */
    rangeSlider: {
        draw(ctx, assets, style, rect, label, state, node) {
            const flags = flagsOf(state);
            const resolution = drawStyledBackground(ctx, assets, style, rect, flags);
            const bounds = boundsOf(node);
            const inset = (style && style.insets && style.insets.left) || 0;
            const progress = progressOf(state && state.value, bounds);
            const thumbStyle = thumbStyleOf(assets, style);
            if (node && node.vertical) {
                const trackY = rect.y + inset;
                const trackHeight = Math.max(rect.height - inset * 2, 0);
                const thumbHeight = Math.min(Math.max(MIN_SLIDER_THUMB, Math.round(rect.width - 4)), trackHeight);
                const travel = Math.max(trackHeight - thumbHeight, 0);
                // Bottom-to-top, the same convention valueAtPosition uses for a vertical drag.
                const thumb = { x: rect.x + 2, y: Math.round(trackY + travel * (1 - progress)), width: Math.max(rect.width - 4, 1), height: thumbHeight };
                drawStyledBackground(ctx, assets, thumbStyle, thumb, flags);
            } else {
                const trackX = rect.x + inset;
                const trackWidth = Math.max(rect.width - inset * 2, 0);
                const thumbWidth = Math.min(Math.max(MIN_SLIDER_THUMB, Math.round(rect.height - 4)), trackWidth);
                const travel = Math.max(trackWidth - thumbWidth, 0);
                const thumb = { x: Math.round(trackX + travel * progress), y: rect.y + 2, width: thumbWidth, height: Math.max(rect.height - 4, 1) };
                drawStyledBackground(ctx, assets, thumbStyle, thumb, flags);
            }
            writeLabel(ctx, assets, style, rect, label);
            return resolution;
        },
        measure(assets, style, label, node) {
            const { height } = textSize(assets, style, label);
            const thickness = Math.max(height + 8, MIN_CONTROL_HEIGHT);
            if (node && node.vertical) return { width: thickness, height: RANGE_SLIDER_LENGTH };
            return { width: (style && style.width) || RANGE_SLIDER_LENGTH, height: thickness };
        }
    },

    /**
     * A rotary 0-100 control (spec 018), drawn with canvas primitives - an
     * arc gauge and a pointer line - rather than skin artwork, since no
     * rotary sprite exists in the built-in skin. The label draws beneath it,
     * matching v1's own layout.
     */
    knob: {
        draw(ctx, assets, style, rect, label, state, node) {
            const bounds = boundsOf(node);
            const progress = progressOf(state && state.value, bounds);
            const disabled = Boolean(state && state.disabled);
            const size = Math.max(Math.min(rect.width, rect.height - (label ? KNOB_LABEL_HEIGHT : 0)), 8);
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + size / 2;
            const radius = size / 2 - 2;
            const minAngle = KNOB_MIN_ANGLE, span = KNOB_MAX_ANGLE - KNOB_MIN_ANGLE;
            const angle = minAngle + progress * span;
            ctx.save();
            ctx.fillStyle = disabled ? "rgba(120,120,120,0.5)" : "rgba(60,90,140,0.9)";
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = disabled ? "rgba(170,170,170,0.6)" : "rgba(130,200,255,0.9)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(radius - 4, 1), minAngle, angle, false);
            ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * Math.max(radius - 4, 1), cy + Math.sin(angle) * Math.max(radius - 4, 1));
            ctx.stroke();
            ctx.restore();
            if (label) {
                const font = labelFont(assets, style);
                if (font) font.write(ctx, label, rect.x + Math.max(Math.floor((rect.width - font.getTextWidth(label)) / 2), 0), rect.y + size);
            }
            return { drawn: true };
        },
        measure() {
            return { width: KNOB_SIZE, height: KNOB_SIZE + KNOB_LABEL_HEIGHT };
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

    /**
     * One line of editable text: the style's background, the current text (or
     * a dimmed placeholder while empty), a translucent selection highlight,
     * and a caret, both only while focused (spec 015).
     */
    inputbox: {
        draw(ctx, assets, style, rect, label, state, node) {
            const flags = flagsOf(state);
            const resolution = drawStyledBackground(ctx, assets, style, rect, flags);
            const font = labelFont(assets, style);
            const offsetX = (style && style.label && style.label.offsetX) || 4;
            const textX = rect.x + offsetX;
            const textY = rect.y + Math.floor((rect.height - font.charHeight) / 2);
            const caret = state && typeof state.caret === "number" ? state.caret : null;
            const selectionStart = state && typeof state.selectionStart === "number" ? state.selectionStart : null;
            if (label) {
                if (state && state.focused && selectionStart !== null && selectionStart !== caret) {
                    const from = Math.min(caret, selectionStart);
                    const to = Math.max(caret, selectionStart);
                    const selX = textX + font.getTextWidth(label.slice(0, from));
                    const selWidth = font.getTextWidth(label.slice(from, to));
                    ctx.save();
                    ctx.fillStyle = "rgba(120,170,255,0.35)";
                    ctx.fillRect(selX, rect.y + 2, selWidth, Math.max(rect.height - 4, 0));
                    ctx.restore();
                }
                font.write(ctx, label, textX, textY);
            } else if (node && node.placeholder) {
                ctx.save();
                ctx.globalAlpha = 0.4;
                font.write(ctx, node.placeholder, textX, textY);
                ctx.restore();
            }
            if (state && state.focused && caret !== null) {
                const caretX = Math.round(textX + font.getTextWidth((label || "").slice(0, caret)));
                ctx.save();
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillRect(caretX, rect.y + 3, 1, Math.max(rect.height - 6, 0));
                ctx.restore();
            }
            return resolution;
        },
        measure(assets, style, label) {
            const { height } = textSize(assets, style, label || "");
            return { width: (style && style.width) || 140, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
        }
    },

    /**
     * A named sprite, drawn at natural size (centred, or aligned by
     * horizontalAlign/verticalAlign) or stretched to fill (spec 017). `icon`
     * shares this kind: both are "draw this named asset", differing only in
     * which property names it (`src` vs `icon`).
     */
    image: {
        draw(ctx, assets, style, rect, label, state, node) {
            const asset = imageAsset(assets, node);
            if (!asset) return null;
            if (node && node.scale === "stretch") {
                ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, rect.x, rect.y, rect.width, rect.height);
                return { asset: asset.name, drawn: true };
            }
            let x = rect.x + Math.max(Math.floor((rect.width - asset.width) / 2), 0);
            let y = rect.y + Math.max(Math.floor((rect.height - asset.height) / 2), 0);
            if (node && node.horizontalAlign === "right") x = rect.x + Math.max(rect.width - asset.width, 0);
            else if (node && node.horizontalAlign === "left") x = rect.x;
            if (node && node.verticalAlign === "top") y = rect.y;
            ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, x, y, asset.width, asset.height);
            return { asset: asset.name, drawn: true };
        },
        measure(assets, style, label, node) {
            const asset = imageAsset(assets, node);
            return asset ? { width: asset.width, height: asset.height } : { width: 14, height: 14 };
        }
    },

    /**
     * A frame strip stepped by the renderer's animation clock (spec 017): the
     * source rect's x offset is `frame * (asset.width / frames)`, so the
     * strip is laid out left to right in one sprite sheet, exactly as v1's
     * `UIAnimsprite` reads it.
     */
    animSprite: {
        draw(ctx, assets, style, rect, label, state, node) {
            const asset = imageAsset(assets, node, node && node.sprite);
            if (!asset) return null;
            const frames = Math.max(1, Math.floor((node && node.frames) || 1));
            const frameWidth = asset.width / frames;
            const frame = Math.min(Math.max((state && state.fieldValue) || 0, 0), frames - 1);
            ctx.drawImage(asset.image, asset.x + frame * frameWidth, asset.y, frameWidth, asset.height, rect.x, rect.y, rect.width, rect.height);
            return { asset: asset.name, drawn: true, frame };
        },
        measure(assets, style, label, node) {
            const asset = imageAsset(assets, node, node && node.sprite);
            const frames = Math.max(1, Math.floor((node && node.frames) || 1));
            return asset ? { width: Math.round(asset.width / frames), height: asset.height } : { width: 14, height: 14 };
        }
    },

    /**
     * A scrollable list (spec 019). Its authored `items` are real child nodes
     * and paint themselves through the normal per-node draw pass, exactly
     * like a panel's content - this kind only draws what an item cannot draw
     * for itself: a dark backing (no skin artwork exists for a listbox, so
     * this is plain canvas, like knob), the selected row's tint (given as an
     * absolute rect by the renderer, since only it knows where a child
     * landed), and a scrollbar thumb, shared with a viewport's own.
     */
    listbox: {
        draw(ctx, assets, style, rect, label, state) {
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            const selected = state && state.selectedItemRect;
            if (selected) {
                ctx.beginPath();
                ctx.rect(rect.x, rect.y, rect.width, rect.height);
                ctx.clip();
                ctx.fillStyle = "rgba(110,150,230,0.28)";
                ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
            }
            ctx.restore();
            drawScrollThumb(ctx, assets, style, rect, state);
            return { drawn: true };
        },
        measure() {
            return { width: 160, height: 120 };
        }
    },

    /**
     * The note grid (spec 030): the specialized-component contract. Reads
     * domain/song directly (not `state`/a bound field - `state` here only
     * carries the controller's own `startTrack`, the horizontal scroll
     * window) and draws only the rows/tracks the viewport can show, with the
     * current pattern position always centered vertically. Ported from
     * script/src/ui/app/components/patternView.js's own render() (per-track
     * chrome, VU meters and the FX panel are a different spec's - see
     * requirements.md's scope decision).
     */
    patternGrid: {
        draw(ctx, assets, style, rect, label, state, node) {
            const currentSong = song.getSong();
            if (!currentSong) return null; // v1's own early-out, patternView.js:195

            const ftMode = song.inFTMode();
            const trackCount = song.getTrackCount();
            const patternLength = song.getPatternLength();
            const pattern = song.getPattern(song.getCurrentPattern());
            if (!pattern) return null;

            const startTrack = (state && state.startTrack) || 0;
            const visible = visibleTrackCount(rect.width, ftMode);
            const currentPos = song.getCurrentPatternPos();
            const currentTrack = song.getCurrentTrack();
            const currentColumn = song.getCurrentTrackPosition();
            const selection = song.getSelectionRange();

            let visibleRows = Math.max(1, Math.floor(rect.height / LINE_HEIGHT));
            if (visibleRows % 2 === 0) visibleRows = Math.max(1, visibleRows - 1);
            const topRows = Math.floor(visibleRows / 2);
            const centerY = rect.y + Math.floor((rect.height - LINE_HEIGHT) / 2);

            const font = assets.font;
            const greenFont = assets.fontFor ? assets.fontFor("green") : font;
            const orangeFont = assets.fontFor ? assets.fontFor("orange") : font;

            ctx.save();
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.clip();

            ctx.fillStyle = "rgba(20,20,20,0.6)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.fillStyle = "rgba(200,150,70,0.18)";
            ctx.fillRect(rect.x, centerY, rect.width, LINE_HEIGHT);

            for (let offset = -topRows; offset <= topRows; offset++) {
                const row = currentPos + offset;
                if (row < 0 || row >= patternLength) continue;
                const y = centerY + offset * LINE_HEIGHT;
                drawCachedLineNumber(ctx, font, row, rect.x + 2, y);

                const stepRow = pattern[row];
                for (let slot = 0; slot < visible; slot++) {
                    const trackIndex = startTrack + slot;
                    if (trackIndex >= trackCount) break;
                    const note = stepRow ? stepRow[trackIndex] : null;
                    const trackX = rect.x + trackSlotX(slot, ftMode);

                    if (selection && row >= selection.top && row <= selection.bottom
                        && trackIndex >= selection.left && trackIndex <= selection.right) {
                        ctx.fillStyle = "rgba(110,150,230,0.28)";
                        ctx.fillRect(trackX, y, columnRect(ftMode ? 7 : 5, ftMode).x + columnRect(ftMode ? 7 : 5, ftMode).width, LINE_HEIGHT);
                    }

                    drawCachedText(ctx, font, song.formatNoteName(note), trackX + columnRect(0, ftMode).x, y);
                    drawCachedText(ctx, greenFont, note ? formatHex(note.instrument, 2) : "..", trackX + columnRect(1, ftMode).x, y);
                    if (ftMode) {
                        drawCachedText(ctx, font, note && note.volumeEffect ? formatHex(note.volumeEffect, 2) : "..", trackX + columnRect(3, ftMode).x, y);
                    }
                    const effectColumn = ftMode ? 5 : 3;
                    const effectText = note && (note.effect || note.param) ? formatHex(note.effect, 1) + formatHex(note.param, 2) : "...";
                    drawCachedText(ctx, orangeFont, effectText, trackX + columnRect(effectColumn, ftMode).x, y);

                    if (trackIndex === currentTrack && row === currentPos) {
                        const col = columnRect(currentColumn, ftMode);
                        ctx.fillStyle = "rgba(220,220,220,0.3)";
                        ctx.fillRect(trackX + col.x, centerY, col.width, LINE_HEIGHT);
                    }
                }
            }
            ctx.restore();

            drawScrollThumb(ctx, assets, style, rect, {
                ...state,
                scroll: { extent: { width: rect.width, height: patternLength * LINE_HEIGHT }, offset: currentPos * LINE_HEIGHT }
            });
            if (trackCount > visible) {
                const barWidth = Math.max(12, Math.floor((rect.width - GUTTER_WIDTH) * (visible / trackCount)));
                const travel = Math.max(rect.width - GUTTER_WIDTH - barWidth, 0);
                const barX = rect.x + GUTTER_WIDTH + Math.floor(travel * (startTrack / Math.max(1, trackCount - visible)));
                ctx.save();
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.fillRect(rect.x + GUTTER_WIDTH, rect.y + rect.height - 4, rect.width - GUTTER_WIDTH, 4);
                ctx.fillStyle = "rgba(255,255,255,0.35)";
                ctx.fillRect(barX, rect.y + rect.height - 4, barWidth, 4);
                ctx.restore();
            }
            return { drawn: true };
        },
        measure() {
            return { width: 300, height: 200 };
        }
    },

    /**
     * fileBrowser (spec 035): the specialized-component contract's second
     * leaf. Unlike patternGrid, its rows come from `state.rows` (a plain
     * array a capability publishes, resolved generically by
     * mountGeneric.js's visualStateOf - this draw kind names no domain
     * module), so the same node can show a local file list, a remote
     * catalog page, or anything else shaped like a row. Draws only the
     * visible slice (`visibleRowRange`), indented by each row's own `level`,
     * with an optional icon (resolved the same way `image`'s own draw kind
     * resolves an explicit asset name) and an optional right-aligned info
     * string (a file size, an item count - always short, per v1's own rows).
     */
    fileBrowser: {
        draw(ctx, assets, style, rect, label, state) {
            const rows = (state && state.rows) || [];
            const offset = (state && state.offset) || 0;
            const selectedIndex = state ? state.selectedIndex : -1;
            const font = assets.font;

            ctx.save();
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.clip();
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const { first, last } = visibleRowRange(rect, offset, rows.length);
            for (let i = first; i < last; i++) {
                const row = rows[i];
                if (!row) continue;
                const y = rect.y + i * FILE_BROWSER_ROW_HEIGHT - offset;
                if (i === selectedIndex) {
                    ctx.fillStyle = "rgba(110,150,230,0.28)";
                    ctx.fillRect(rect.x, y, rect.width, FILE_BROWSER_ROW_HEIGHT);
                }
                let x = rect.x + 2 + (row.level || 0) * INDENT_WIDTH;
                if (row.icon) {
                    const asset = imageAsset(assets, null, row.icon);
                    if (asset) ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, x, y + 1, ICON_SIZE, ICON_SIZE);
                    // Reserve the icon's own column even when its asset failed
                    // to resolve, so text never jitters row to row.
                    x += ICON_SIZE + 3;
                }
                if (font) {
                    font.write(ctx, row.title || "", x, y + 2);
                    if (row.info) {
                        const infoX = rect.x + rect.width - font.getTextWidth(row.info) - 4;
                        font.write(ctx, row.info, Math.max(x, infoX), y + 2);
                    }
                }
            }
            ctx.restore();

            drawScrollThumb(ctx, assets, style, rect, { scroll: { extent: { width: rect.width, height: contentHeight(rows.length) }, offset } });
            return { drawn: true };
        },
        measure() {
            return { width: 200, height: 140 };
        }
    },

    /**
     * waveformView (spec 041): the specialized-component contract's third
     * leaf. Reads the current instrument (domain/song) and the current
     * selection (domain/sampleEditor) directly - this draw kind names no
     * bound field, the same way patternGrid's own draw kind names no
     * domain/song field either. `state.zoomStart`/`state.zoomLength` come
     * from the controller (mountGeneric.js's visualStateOf merges
     * `controller.state` in generically for every behavior, so nothing here
     * or in mountGeneric.js needs to name this type to pass them through).
     * One sample per pixel column, no min/max envelope downsampling - a
     * faithfully-ported v1 limitation (waveform.js:840-915), not fixed here.
     */
    waveformView: {
        draw(ctx, assets, style, rect, label, state) {
            const instrument = song.getCurrentInstrument();
            const data = instrument && instrument.sample ? instrument.sample.data : null;
            const length = data ? data.length : 0;

            ctx.save();
            ctx.fillStyle = "rgb(13, 19, 27)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const mid = rect.y + Math.floor(rect.height / 2);
            const quarter = Math.floor(rect.height / 4);
            ctx.strokeStyle = "rgba(0, 200, 180, 0.5)";
            ctx.beginPath();
            ctx.moveTo(rect.x, mid);
            ctx.lineTo(rect.x + rect.width, mid);
            ctx.stroke();
            ctx.strokeStyle = "rgba(0, 200, 180, 0.2)";
            ctx.beginPath();
            ctx.moveTo(rect.x, mid + quarter);
            ctx.lineTo(rect.x + rect.width, mid + quarter);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rect.x, mid - quarter);
            ctx.lineTo(rect.x + rect.width, mid - quarter);
            ctx.stroke();

            if (length > 0 && rect.width > 0) {
                const zoomStart = (state && state.zoomStart) || 0;
                const zoomLength = (state && state.zoomLength) || length;

                const selection = sampleEditor.getSampleSelection();
                if (selection.length) {
                    const x1 = sampleIndexToPixel(rect, selection.start, zoomStart, zoomLength);
                    const x2 = sampleIndexToPixel(rect, selection.start + selection.length, zoomStart, zoomLength);
                    const left = Math.max(rect.x, Math.min(x1, x2));
                    const right = Math.min(rect.x + rect.width, Math.max(x1, x2));
                    if (right > left) {
                        ctx.fillStyle = "rgba(110,150,230,0.28)";
                        ctx.fillRect(left, rect.y, right - left, rect.height);
                    }
                }

                const step = zoomLength / rect.width;
                const maxHeight = rect.height / 2 - 2;
                ctx.strokeStyle = "rgba(120, 255, 50, 0.5)";
                ctx.beginPath();
                for (let i = 0; i < rect.width; i++) {
                    const index = Math.floor(zoomStart + i * step);
                    const value = index >= 0 && index < length ? data[index] : 0;
                    const y = mid - value * maxHeight;
                    if (i === 0) ctx.moveTo(rect.x + i, y);
                    else ctx.lineTo(rect.x + i, y);
                }
                ctx.stroke();
            }
            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 300, height: 140 };
        }
    },

    /**
     * loopCreatorView (spec 044): the specialized-component contract's
     * fourth leaf. Reads domain/sampleEditor/loopCreator.js (spec 043's own
     * state model and DSP) directly - no bound field, matching every other
     * specialized leaf's own draw kind. `state.zoomStart`/`state.zoomLength`/
     * `state.dragging` come from the controller the same generic way
     * waveformView's own zoom does. v1's own loop creator never draws the
     * sample's overall waveform shape at all (loopCreator.js#drawWave,
     * 379-479) - only the three blend layers, each over its own limited
     * sample range, plus the loop markers/handles/blend lines - so neither
     * does this draw kind.
     */
    loopCreatorView: {
        draw(ctx, assets, style, rect, label, state) {
            const s = getLoopCreatorState();

            ctx.save();
            ctx.fillStyle = "rgb(13, 19, 27)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            if (!(s.dataLen > 0) || rect.width <= 0) {
                ctx.restore();
                return { drawn: true };
            }

            const zoomStart = (state && state.zoomStart) || 0;
            const zoomLength = (state && state.zoomLength) || s.dataLen;
            const at = index => sampleIndexToPixel(rect, index, zoomStart, zoomLength);
            const waveH = rect.height;
            const dragging = state && state.dragging;

            const lsX = at(s.loopStart), leX = at(s.loopEnd);
            ctx.fillStyle = "rgba(100, 130, 220, 0.10)";
            ctx.fillRect(Math.min(lsX, leX), rect.y, Math.abs(leX - lsX), waveH);

            const layers = getLoopCreatorLayers();
            drawLoopBlendLayer(ctx, layers.tailLayer, s.loopStart, at, rect, waveH, "rgba(0,210,230,0.85)", "rgba(0,210,230,0.13)");
            drawLoopBlendLayer(ctx, layers.loopEndLayer, s.loopEnd - s.headSize, at, rect, waveH, "rgba(255,140,50,0.85)", "rgba(255,140,50,0.13)");
            drawLoopBlendLayer(ctx, layers.headModLayer, s.loopStart - s.loopEndSize, at, rect, waveH, "rgba(180,80,255,0.85)", "rgba(180,80,255,0.13)");

            ctx.fillStyle = "rgba(241, 220, 71, 0.9)";
            ctx.fillRect(lsX, rect.y, dragging === "markerStart" ? 2 : 1, waveH);
            ctx.fillRect(leX, rect.y, dragging === "markerEnd" ? 2 : 1, waveH);

            drawLoopBlendLine(ctx, s.blendTail, s.loopStart, s.loopStart + s.tailSize, at, rect.y, waveH, "rgba(0,210,230,", dragging === "blendTail", true);
            drawLoopBlendLine(ctx, s.blendHead, s.loopEnd - s.headSize, s.loopEnd, at, rect.y, waveH, "rgba(255,140,50,", dragging === "blendHead", false);
            drawLoopBlendLine(ctx, s.blendLoopEnd, s.loopStart - s.loopEndSize, s.loopStart, at, rect.y, waveH, "rgba(180,80,255,", dragging === "blendLoopEnd", false);
            drawLoopBlendLine(ctx, s.origBlendTail, s.loopStart, s.loopStart + s.tailSize, at, rect.y, waveH, "rgba(120,255,50,", dragging === "origTail", false);
            drawLoopBlendLine(ctx, s.origBlendHead, s.loopEnd - s.headSize, s.loopEnd, at, rect.y, waveH, "rgba(120,255,50,", dragging === "origHead", true);
            drawLoopBlendLine(ctx, s.origBlendLoopEnd, s.loopStart - s.loopEndSize, s.loopStart, at, rect.y, waveH, "rgba(120,255,50,", dragging === "origLoopEnd", true);

            const handleMidY = rect.y + Math.floor(waveH / 2);
            drawLoopHandle(ctx, at(s.loopStart + s.tailSize), handleMidY, "rgba(0,210,230,0.95)", dragging === "tail");
            if (s.maxHeadSize > 0) drawLoopHandle(ctx, at(s.loopEnd - s.headSize), handleMidY, "rgba(255,140,50,0.95)", dragging === "head");
            if (s.maxLoopEndSize > 0) drawLoopHandle(ctx, at(s.loopStart - s.loopEndSize), handleMidY, "rgba(180,80,255,0.95)", dragging === "loopEnd");

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 300, height: 140 };
        }
    },

    /**
     * nibblesGrid (spec 047): the specialized-component contract's fifth
     * leaf. Reads domain/nibbles/index.js directly - a fixed 40x15 grid,
     * scaled to whatever pixel-per-cell size fits `rect` (the cell *count*
     * is fixed, not the drawn size - see requirements.md's Decisions), the
     * same "fit available space" idea patternGrid's row height and
     * waveformView's one-sample-per-pixel already use.
     */
    nibblesGrid: {
        draw(ctx, assets, style, rect) {
            ctx.save();
            ctx.fillStyle = "#000";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const cellSize = Math.max(1, Math.floor(Math.min(rect.width / nibbles.GRID_WIDTH, rect.height / nibbles.GRID_HEIGHT)));
            for (let y = 0; y < nibbles.GRID_HEIGHT; y++) {
                for (let x = 0; x < nibbles.GRID_WIDTH; x++) {
                    const cell = nibbles.getCellView(x, y);
                    if (cell.kind === "empty") continue;
                    ctx.fillStyle = cell.kind === "wall" ? `rgb(${cell.color})`
                        : cell.kind === "snake" ? (cell.age > 1 ? "rgba(255,255,255,0.6)" : "#fff")
                        : "#ffcc00"; // food
                    ctx.fillRect(rect.x + x * cellSize, rect.y + y * cellSize, cellSize - 1, cellSize - 1);
                }
            }

            // Ported from nibbles.js's own drawGrid()/drawBorder() (618-651) -
            // a pure drawing choice, no gameplay effect (spec 049).
            const gridWidth = nibbles.GRID_WIDTH * cellSize, gridHeight = nibbles.GRID_HEIGHT * cellSize;
            if (nibbles.getShowGrid()) {
                ctx.strokeStyle = "#3d4c6e";
                ctx.beginPath();
                for (let x = 0; x <= nibbles.GRID_WIDTH; x++) {
                    ctx.moveTo(rect.x + x * cellSize, rect.y);
                    ctx.lineTo(rect.x + x * cellSize, rect.y + gridHeight);
                }
                for (let y = 0; y <= nibbles.GRID_HEIGHT; y++) {
                    ctx.moveTo(rect.x, rect.y + y * cellSize);
                    ctx.lineTo(rect.x + gridWidth, rect.y + y * cellSize);
                }
                ctx.stroke();
            } else {
                ctx.strokeStyle = "#53638f";
                ctx.strokeRect(rect.x, rect.y, gridWidth, gridHeight);
            }

            if (nibbles.getState() !== nibbles.GAME_STATE.PLAYING) {
                ctx.fillStyle = "rgba(0,0,0,0.3)";
                ctx.fillRect(rect.x, rect.y, gridWidth, gridHeight);
            }

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: nibbles.GRID_WIDTH * 10, height: nibbles.GRID_HEIGHT * 10 };
        }
    },

    /**
     * multitrackView (spec 052): the port's sixth specialized-component
     * leaf. Reads domain/song and domain/arrangement (spec 051's own
     * headless engine) directly - no bound field, the same contract every
     * other specialized leaf's own draw kind already has.
     * `state.scrollX`/`scrollY`/`pixelsPerStep`/`dragMode`/`dragNote` come
     * from the controller the same generic way `waveformView`'s own
     * `zoomStart`/`zoomLength` already does. Blocks draw as a flat
     * instrument-tinted rectangle (no waveform thumbnail, no scale-9 panel
     * image - see requirements.md's Decisions); the header ruler and
     * per-lane control strip/oscilloscope are drawn every call, since
     * mountGeneric.js's own coalesced-draw loop (spec 032) already redraws
     * only when something is dirty.
     */
    multitrackView: {
        draw(ctx, assets, style, rect, label, state) {
            ctx.save();
            ctx.fillStyle = "rgb(9, 13, 19)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const scrollX = (state && state.scrollX) || 0;
            const scrollY = (state && state.scrollY) || 0;
            const pixelsPerStep = (state && state.pixelsPerStep) || 14;
            const dragMode = state && state.dragMode;
            const dragNote = state && state.dragNote;

            const trackCount = song.getTrackCount();
            const patternLength = song.getPatternLength();
            const pattern = song.getCurrentPattern();
            const trackHeight = mt.trackHeightFor(rect);

            if (rect.height > mt.HEADER_HEIGHT && trackCount > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(rect.x, rect.y + mt.HEADER_HEIGHT, rect.width, rect.height - mt.HEADER_HEIGHT);
                ctx.clip();

                const firstTrack = Math.max(0, Math.floor(scrollY / trackHeight));
                const topClip = scrollY - firstTrack * trackHeight;
                for (let t = firstTrack; t < trackCount; t++) {
                    const laneTop = rect.y + mt.HEADER_HEIGHT + (t - firstTrack) * trackHeight - topClip;
                    if (laneTop >= rect.y + rect.height) break;
                    drawMultitrackLane(ctx, assets, rect, laneTop, trackHeight, t, pattern, scrollX, pixelsPerStep);
                    drawMultitrackControls(ctx, assets, rect, laneTop, trackHeight, t);
                }
                ctx.restore();
            }

            drawMultitrackRuler(ctx, assets, rect, patternLength, pixelsPerStep, scrollX);
            drawMultitrackPlayhead(ctx, rect, pixelsPerStep, scrollX);

            if (dragMode === "note" && dragNote) {
                drawMultitrackDragGhost(ctx, assets, rect, dragNote, pattern, scrollX, scrollY, pixelsPerStep, trackHeight);
            }

            const hMetrics = mt.hScrollbarMetrics(rect, patternLength, pixelsPerStep, scrollX);
            if (hMetrics) {
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.fillRect(hMetrics.x, hMetrics.y, hMetrics.width, hMetrics.height);
            }
            const vMetrics = mt.vScrollbarMetrics(rect, trackCount, trackHeight, scrollY);
            if (vMetrics) {
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.fillRect(vMetrics.x, vMetrics.y, vMetrics.width, vMetrics.height);
            }

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 500, height: 200 };
        }
    },

    /**
     * volumeMeter (spec 054): the port's seventh specialized-component
     * leaf. Reads domain/playback directly - no bound field. Two rows of
     * flat-colored dots (green/yellow/red by zoneFor), each row lit up to
     * `litDotCount` - the same lit/unlit contrast v1's own two pre-rendered
     * canvases give, without the skin-atlas sprite images (see
     * requirements.md's Decisions).
     */
    volumeMeter: {
        draw(ctx, assets, style, rect) {
            const leftBuf = new Uint8Array(32);
            const rightBuf = new Uint8Array(32);
            const data = playback.getMasterScopeData(leftBuf, rightBuf);
            const dots = vuGeo.dotCountFor(rect.width);
            const rowH = Math.max(1, Math.floor((rect.height - 4) / 2));

            function drawRow(buffer, y) {
                const lit = data ? vuGeo.litDotCount(vuGeo.dynamicRange(buffer) * vuGeo.LEVEL_SCALE, dots) : 0;
                for (let i = 0; i < dots; i++) {
                    const zone = vuGeo.zoneFor(i, dots);
                    const color = zone === "red" ? "200,60,60" : zone === "yellow" ? "210,190,60" : "70,200,90";
                    ctx.fillStyle = `rgba(${color},${i < lit ? 0.95 : 0.25})`;
                    ctx.fillRect(rect.x + i * (vuGeo.DOT_WIDTH + vuGeo.DOT_MARGIN), y, vuGeo.DOT_WIDTH, rowH);
                }
            }
            drawRow(leftBuf, rect.y);
            drawRow(rightBuf, rect.y + rowH + 4);
            return { drawn: true };
        },
        measure() {
            return { width: 160, height: 16 };
        }
    },

    /**
     * envelopeView (spec 056): the port's eighth specialized-component
     * leaf. Reads domain/sampleEditor/envelope.js directly - no bound
     * field. `state.envelopeType`/`state.activeIndex` come from the
     * controller the same generic way `waveformView`'s own `zoomStart`/
     * `zoomLength` already does.
     */
    envelopeView: {
        draw(ctx, assets, style, rect, label, state) {
            ctx.save();
            ctx.fillStyle = "rgb(13, 19, 27)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const envelopeType = (state && state.envelopeType) || "volume";
            if (envelopeType === "panning") {
                ctx.strokeStyle = "#4a7c92";
                ctx.setLineDash([1, 2]);
                const midY = rect.y + Math.floor(rect.height / 2);
                ctx.beginPath();
                ctx.moveTo(rect.x, midY);
                ctx.lineTo(rect.x + rect.width, midY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            const env = envelope.getEnvelope(envelopeType);
            if (!env.count) {
                ctx.restore();
                return { drawn: true };
            }

            const activeIndex = state && typeof state.activeIndex === "number" ? state.activeIndex : -1;
            ctx.strokeStyle = env.enabled ? "rgba(120,255,50,0.5)" : "rgba(120,120,180,0.5)";
            ctx.beginPath();
            for (let i = 0; i < env.count; i++) {
                const point = env.points[i];
                if (!point) continue;
                const px = envGeo.toPixel(point, rect);
                if (i === 0) ctx.moveTo(rect.x + px.x, rect.y + px.y);
                else ctx.lineTo(rect.x + px.x, rect.y + px.y);
            }
            ctx.stroke();

            for (let i = 0; i < env.count; i++) {
                const point = env.points[i];
                if (!point) continue;
                const px = envGeo.toPixel(point, rect);
                const size = i === activeIndex ? 6 : 4;
                ctx.fillStyle = i === activeIndex ? "#FFFFFF" : (env.enabled ? "#D2861B" : "#546888");
                const h = size / 2;
                ctx.fillRect(rect.x + px.x - h, rect.y + px.y - h, size, size);
            }

            if (env.enabled) {
                const drawLine = x => {
                    ctx.setLineDash([1, 2]);
                    ctx.beginPath();
                    ctx.moveTo(rect.x + x, rect.y);
                    ctx.lineTo(rect.x + x, rect.y + rect.height);
                    ctx.stroke();
                };
                const sustainPoint = env.points[env.sustainPoint];
                if (env.sustain && sustainPoint) {
                    ctx.strokeStyle = "#67b6d2";
                    drawLine(envGeo.toPixel(sustainPoint, rect).x);
                }
                if (env.loop) {
                    ctx.strokeStyle = "#d2b637";
                    const loopStart = env.points[env.loopStartPoint];
                    const loopEnd = env.points[env.loopEndPoint];
                    if (loopStart) drawLine(envGeo.toPixel(loopStart, rect).x);
                    if (loopEnd) drawLine(envGeo.toPixel(loopEnd, rect).x);
                }
            }

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 324, height: 64 };
        }
    },

    /**
     * scopesView (spec 058): the port's ninth specialized-component leaf.
     * Reads domain/song/domain/arrangement directly - no bound field.
     * Ported from visualiser.js's own _modeTracksRender (118-177),
     * including its own amplitude boost (_analyserAmp = 1.5, confirmed
     * live, not dead, before porting it) and its own asymmetric centering
     * (offsetY) that comes with it.
     */
    scopesView: {
        draw(ctx, assets, style, rect) {
            ctx.save();
            ctx.fillStyle = "rgb(9, 13, 19)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const trackCount = song.getTrackCount();
            const amp = 1.5;
            const offsetY = 0.5 - 0.5 * amp; // fraction of cell height - ported from _analyserAmp's own offsetY (149-152)

            for (let i = 0; i < trackCount; i++) {
                const pos = scopesGeo.cellRect(i, trackCount, rect);
                const muteSolo = arrangement.getTrackMuteSolo(i);
                const data = muteSolo.mute ? null : arrangement.getTrackScopeData(i, SCOPES_BUFFER);

                ctx.strokeStyle = "rgba(120,255,50,0.5)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (data) {
                    const sliceWidth = pos.lineWidth / data.length;
                    for (let j = 0; j < data.length; j++) {
                        const v = data[j] / 128.0;
                        const wx = rect.x + pos.lineLeft + j * sliceWidth;
                        const wy = rect.y + pos.top + (v * amp / 2 + offsetY) * pos.height;
                        if (j === 0) ctx.moveTo(wx, wy);
                        else ctx.lineTo(wx, wy);
                    }
                } else {
                    const wy = rect.y + pos.top + pos.height / 2;
                    ctx.moveTo(rect.x + pos.lineLeft, wy);
                    ctx.lineTo(rect.x + pos.lineLeft + pos.lineWidth - 1, wy);
                }
                ctx.stroke();

                if (muteSolo.mute) {
                    ctx.fillStyle = "rgba(34,49,85,0.5)";
                    ctx.fillRect(rect.x + pos.left, rect.y + pos.top, pos.width, pos.height);
                }
            }

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 320, height: 80 };
        }
    },

    /**
     * pianoView (spec 061): the port's tenth specialized-component leaf.
     * Reads domain/song#getCurrentOctave/domain/playback#isPreviewNoteActive
     * directly - no bound field. Ported from pianoView.js's own
     * renderInternal (175-233): white keys tiled first, black keys layered
     * on top, both using the exact combined index format previewNoteOn/Off
     * and isPreviewNoteActive expect (pianoGeometry.js's own keyRectsFor).
     */
    pianoView: {
        draw(ctx, assets, style, rect) {
            ctx.save();
            ctx.fillStyle = "rgb(13, 19, 27)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            const baseOctave = song.getCurrentOctave();
            const { white, black } = pianoGeo.keyRectsFor(rect, baseOctave);

            for (const key of white) {
                ctx.fillStyle = playback.isPreviewNoteActive(key.index) ? "#8fd0ff" : "#f4f6f8";
                ctx.fillRect(rect.x + key.left, rect.y + key.top, key.width, key.height);
                ctx.strokeStyle = "#1c2733";
                ctx.strokeRect(rect.x + key.left + 0.5, rect.y + key.top + 0.5, key.width - 1, key.height - 1);
            }
            for (const key of black) {
                ctx.fillStyle = playback.isPreviewNoteActive(key.index) ? "#2f6f9c" : "#111820";
                ctx.fillRect(rect.x + key.left, rect.y + key.top, key.width, key.height);
            }

            ctx.restore();
            return { drawn: true };
        },
        measure() {
            return { width: 480, height: 150 };
        }
    },

    /**
     * A dropdown's closed control (spec 020): the style's background, the
     * selected item's label (resolved by the renderer, since it lives in the
     * synthesized popup child - this kind just draws whatever `label` string
     * it is given, exactly like backgroundLabel), and a small triangle whose
     * shade follows the disabled state.
     */
    dropdown: {
        draw(ctx, assets, style, rect, label, state) {
            const flags = flagsOf(state);
            const resolution = drawStyledBackground(ctx, assets, style, rect, flags);
            const labelRect = { ...rect, width: Math.max(rect.width - DROPDOWN_ARROW_WIDTH, 0) };
            writeLabel(ctx, assets, style, labelRect, label);
            const disabled = Boolean(state && state.disabled);
            const cx = rect.x + rect.width - DROPDOWN_ARROW_WIDTH / 2;
            const cy = rect.y + Math.floor(rect.height / 2);
            ctx.save();
            ctx.fillStyle = disabled ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)";
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 2);
            ctx.lineTo(cx + 4, cy - 2);
            ctx.lineTo(cx, cy + 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return resolution;
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            return { width: width + 16 + DROPDOWN_ARROW_WIDTH, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
        }
    },

    /**
     * A dropdown's popup (spec 020): the exact same drawing listbox itself
     * uses (a dark backing, the selected row's tint, a scrollbar thumb) -
     * called directly rather than re-derived, since the only difference
     * between a listbox and a dropdown's popup is where the layout pass put
     * the box, not how it is painted.
     */
    dropdownPopup: {
        draw(ctx, assets, style, rect, label, state, node) {
            return DRAW_KINDS.listbox.draw(ctx, assets, style, rect, label, state, node);
        },
        measure(assets, style, label, node) {
            const rows = Math.min(DROPDOWN_POPUP_MAX_ROWS, Math.max(1, (node && node.children && node.children.length) || 1));
            return { width: DRAW_KINDS.listbox.measure(assets, style, label, node).width, height: rows * DROPDOWN_ROW_HEIGHT + 4 };
        }
    },

    /**
     * A submenu's flyout (spec 020): items draw themselves through the
     * ordinary per-node pass (they are plain child nodes, exactly as a
     * listbox's are), so this kind only draws what an item cannot draw for
     * itself - a translucent tint on the row the controller is currently
     * hovering (`state.hoverItemRect`, resolved by the renderer the same way
     * listbox's `state.selectedItemRect` is), a dimmed fill over a disabled
     * row (`state.itemDisabled`, one boolean per child, same resolution), a
     * dividing line between rows, and a ">" after any item whose own
     * `subItems` the author set, even though nothing opens a nested flyout
     * yet - the affordance is real and worth drawing even before it is wired.
     */
    submenu: {
        draw(ctx, assets, style, rect, label, state, node) {
            ctx.save();
            ctx.fillStyle = "rgba(20,20,24,0.92)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            const hover = state && state.hoverItemRect;
            if (hover) {
                ctx.fillStyle = "rgba(255,255,255,0.15)";
                ctx.fillRect(rect.x, hover.y, rect.width, hover.height);
            }
            const itemDisabled = (state && state.itemDisabled) || [];
            const children = (node && node.children) || [];
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            children.forEach((child, index) => {
                if (itemDisabled[index]) {
                    ctx.fillStyle = "rgba(0,0,0,0.4)";
                    ctx.fillRect(rect.x, rect.y + index * SUBMENU_ROW_HEIGHT, rect.width, SUBMENU_ROW_HEIGHT);
                }
                if (Array.isArray(child.subItems) && assets.font) {
                    const y = rect.y + index * SUBMENU_ROW_HEIGHT;
                    assets.font.write(ctx, ">", rect.x + rect.width - SUBMENU_ARROW_WIDTH, y + Math.floor((SUBMENU_ROW_HEIGHT - assets.font.charHeight) / 2));
                }
                if (index > 0) {
                    const y = rect.y + index * SUBMENU_ROW_HEIGHT;
                    ctx.beginPath();
                    ctx.moveTo(rect.x, y + 0.5);
                    ctx.lineTo(rect.x + rect.width, y + 0.5);
                    ctx.stroke();
                }
            });
            ctx.restore();
            return { drawn: true };
        },
        measure(assets, style, label, node) {
            const rows = Math.max(1, (node && node.children && node.children.length) || 1);
            return { width: 160, height: rows * SUBMENU_ROW_HEIGHT };
        }
    },

    /**
     * A modal dialog (spec 020): a translucent backdrop over the whole
     * overlay rect, a centred panel sized and positioned exactly as v1's own
     * `_layout()` computed it, and the message text - split on "/" into
     * lines, a leading "*" selecting emphasis, matching v1's own convention
     * (both renderers draw with the one font the built-in skin has; v1's own
     * font-size switch on "*" has no v2 equivalent per spec 010's decision to
     * carry a smaller authored skin). The synthesized OK/Cancel/input
     * children draw themselves through the ordinary per-node pass, which
     * already draws an overlay's own children after itself (spec 013).
     */
    modalDialog: {
        draw(ctx, assets, style, rect, label, state, node) {
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            const panelHeight = Math.min(MODAL_MAX_HEIGHT, Math.max(MODAL_MIN_HEIGHT, rect.height - 20));
            const panelWidth = Math.max(Math.floor(rect.width / 2), Math.min(MODAL_MIN_WIDTH, rect.width));
            const panel = {
                x: rect.x + Math.floor((rect.width - panelWidth) / 2),
                y: rect.y + Math.floor((rect.height - panelHeight) / 2),
                width: panelWidth,
                height: panelHeight
            };
            ctx.fillStyle = "rgba(40,40,48,0.96)";
            ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1);
            ctx.restore();
            const font = assets.font;
            const text = (node && node.text) || "";
            if (text && font) {
                let textY = panel.y + 20;
                text.split("/").forEach(line => {
                    const clean = line.startsWith("*") ? line.slice(1) : line;
                    const textX = panel.x + Math.floor((panel.width - font.getTextWidth(clean)) / 2);
                    font.write(ctx, clean, textX, textY);
                    textY += 12;
                });
            }
            return { drawn: true, panel };
        },
        measure() {
            return { width: MODAL_MIN_WIDTH, height: MODAL_MAX_HEIGHT };
        }
    },

    /**
     * A tabPanel's own header strip (spec 021): equal-width slots across the
     * declared `tabHeader.height`, one per item, each showing that item's own
     * label and filled differently when it is the active index
     * (`state.activeIndex`, resolved by the renderer the same way listbox's
     * `state.selectedItemRect` is). The content area below draws nothing
     * here - the active item's own children paint through the ordinary
     * per-node pass, exactly as a modalDialog's synthesized children do.
     */
    tabPanel: {
        draw(ctx, assets, style, rect, label, state, node) {
            const items = (node && node.children) || [];
            const height = tabHeaderHeightOf(node);
            if (items.length === 0) return { drawn: false };
            const activeIndex = state && Number.isFinite(state.activeIndex) ? state.activeIndex : 0;
            const tabWidth = rect.width / items.length;
            const font = assets.font;
            items.forEach((item, index) => {
                const x = rect.x + index * tabWidth;
                ctx.save();
                ctx.fillStyle = index === activeIndex ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.35)";
                ctx.fillRect(x, rect.y, tabWidth, height);
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.strokeRect(x + 0.5, rect.y + 0.5, Math.max(tabWidth - 1, 0), Math.max(height - 1, 0));
                ctx.restore();
                const text = (item.labelVariants && item.labelVariants[0]) || item.definitionName || "";
                if (text && font) {
                    const textX = x + Math.max(Math.floor((tabWidth - font.getTextWidth(text)) / 2), 2);
                    font.write(ctx, text, textX, rect.y + Math.floor((height - font.charHeight) / 2));
                }
            });
            return { drawn: true };
        },
        measure() {
            return { width: 200, height: 24 + 100 };
        }
    },

    /**
     * A collapsePanel's header (spec 021): a plain background over its own
     * full rect, its own label, and a chevron reflecting `state.collapsed`
     * (resolved by the renderer from the bound field). Its content, when
     * shown, draws through the ordinary per-node pass, like any other
     * container's - this kind only draws what a plain container cannot.
     */
    collapsePanel: {
        draw(ctx, assets, style, rect, label, state) {
            ctx.save();
            ctx.fillStyle = "rgba(20,20,24,0.85)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();
            const font = assets.font;
            const collapsed = Boolean(state && state.collapsed);
            if (font) {
                font.write(ctx, collapsed ? "▸" : "▾", rect.x + 4, rect.y + Math.floor((MIN_CONTROL_HEIGHT - font.charHeight) / 2));
                if (label) font.write(ctx, label, rect.x + COLLAPSE_CHEVRON_WIDTH, rect.y + Math.floor((MIN_CONTROL_HEIGHT - font.charHeight) / 2));
            }
            return { drawn: true };
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            return { width: width + COLLAPSE_CHEVRON_WIDTH + 8, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
        }
    },

    /**
     * A menu/submenu's own synthesized trigger (spec 023): a plain label
     * over a translucent hover/pressed tint from its own button-controller
     * state (`disclose`, the same controller a dropdown's closed control
     * uses) - no skin artwork exists for this yet, the same choice `knob`/
     * `submenu`/`collapsePanel` already made.
     */
    menuTrigger: {
        draw(ctx, assets, style, rect, label, state) {
            const flags = state || {};
            if (flags.pressed || flags.hover) {
                ctx.save();
                ctx.fillStyle = flags.pressed ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.15)";
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                ctx.restore();
            }
            const font = assets.font;
            if (font && label) font.write(ctx, label, rect.x + 8, rect.y + Math.floor((rect.height - font.charHeight) / 2));
            return { drawn: true };
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label);
            return { width: width + 20, height: Math.max(height + 10, MIN_CONTROL_HEIGHT) };
        }
    },

    /**
     * A digit-padded numeric readout (spec 027): the label it is given is
     * already the padded string (`mountGeneric.js`'s `textOf()` resolves it,
     * the same way it resolves a dropdown's selected-item label), so this
     * kind only draws it, a caret at `state.caret` while focused (static,
     * not blinking - the same simplification spec 015 already made for
     * `inputbox`'s own caret), and a disabled dim. No skin artwork exists for
     * this yet, the same choice `knob`/`listbox`/`submenu` already made.
     */
    numberDisplay: {
        draw(ctx, assets, style, rect, label, state) {
            ctx.save();
            ctx.fillStyle = state && state.focused ? "rgba(70,60,20,0.85)" : "rgba(20,20,24,0.85)";
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();
            const font = assets.font;
            const text = label || "";
            // Matches mountGeneric.js's own charIndexAt(), which starts its
            // scan from this exact style.label.offsetX - so a click maps to
            // the same character the caret is drawn at.
            const offsetX = (style && style.label && style.label.offsetX) || 4;
            if (font && text) {
                font.write(ctx, text, rect.x + offsetX, rect.y + Math.floor((rect.height - font.charHeight) / 2));
                if (state && state.focused && Number.isFinite(state.caret)) {
                    const caretX = rect.x + offsetX + font.getTextWidth(text.slice(0, state.caret));
                    ctx.save();
                    ctx.fillStyle = "rgba(255,201,65,0.85)";
                    ctx.fillRect(Math.round(caretX), rect.y + 3, 1, Math.max(rect.height - 6, 0));
                    ctx.restore();
                }
            }
            if (state && state.disabled) {
                ctx.save();
                ctx.fillStyle = "rgba(34,49,85,0.6)";
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                ctx.restore();
            }
            return { drawn: true };
        },
        measure(assets, style, label) {
            const { width, height } = textSize(assets, style, label || "");
            return { width: width + 8, height: Math.max(height + 8, MIN_CONTROL_HEIGHT) };
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
