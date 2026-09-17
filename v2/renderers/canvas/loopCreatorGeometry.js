// Pure geometry backing the loop creator's own interactive overlay (spec
// 044): where each of its eleven drag targets sits, and which one (if any)
// a point falls on. Ported from script/plugins/sampleeditor/loopCreator.js's
// own hitTarget/blendToY (119-190). Reuses waveformGeometry.js's own
// pixel<->sample-index conversion (the same math, just under a different
// name there - handleXfromSample) rather than duplicating it; this module
// adds only what the loop creator needs on top: the eleven-target hit test
// and the vertical blend-line-to-pixel mapping.

import { sampleIndexToPixel } from "./waveformGeometry.js";

export const HANDLE_HIT_X = 4;   // v1's own HANDLE_W
export const HANDLE_BAR_HEIGHT = 32; // v1's own HANDLE_H
export const MARKER_HIT_X = 6;   // v1's own MARKER_HIT
export const BLEND_HIT_Y = 6;
export const BLEND_MARGIN = 10;

/** The pixel y a blend value (0-1) draws its own center line at - ported from loopCreator.js#blendToY (128-130). */
export function blendToY(blend, waveHeight) {
    return BLEND_MARGIN + (1 - blend) * (waveHeight - BLEND_MARGIN * 2);
}

/**
 * Which of the loop creator's eleven drag targets (if any) a point falls
 * on - ported from loopCreator.js#hitTarget (132-190), same priority order
 * (the orig-blend triangles first, then the size handles, then the blend
 * center lines, then the loop markers last).
 *
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {{x:number,y:number}} point x is absolute (matching
 *   sampleIndexToPixel's own convention), y is rect-relative (0 at the top
 *   of the drawing area) - the caller's own guard against a negative y
 *   (v1's own onDragStart/onHover check this before ever calling hitTarget
 *   at all, not inside it) is expected to have already run.
 * @param {object} state {loopStart, loopEnd, tailSize, headSize,
 *   loopEndSize, blendTail, blendHead, blendLoopEnd, origBlendTail,
 *   origBlendHead, origBlendLoopEnd, zoomStart, zoomLength}
 * @returns {string|null} one of "origTail"/"origHead"/"origLoopEnd"/
 *   "tail"/"head"/"loopEnd"/"blendTail"/"blendHead"/"blendLoopEnd"/
 *   "markerStart"/"markerEnd", or null.
 */
export function hitLoopTarget(rect, point, state) {
    if (!rect || !(rect.width > 0) || !(state.zoomLength > 0)) return null;
    const {
        loopStart, loopEnd, tailSize, headSize, loopEndSize,
        blendTail, blendHead, blendLoopEnd,
        origBlendTail, origBlendHead, origBlendLoopEnd,
        zoomStart, zoomLength
    } = state;
    const waveH = rect.height;
    const x = point.x, y = point.y;
    const at = index => sampleIndexToPixel(rect, index, zoomStart, zoomLength);

    if (tailSize > 0) {
        const x0 = at(loopStart), x1 = at(loopStart + tailSize);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(origBlendTail, waveH)) <= BLEND_HIT_Y) return "origTail";
    }
    if (headSize > 0) {
        const x0 = at(loopEnd - headSize), x1 = at(loopEnd);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(origBlendHead, waveH)) <= BLEND_HIT_Y) return "origHead";
    }
    if (loopEndSize > 0) {
        const x0 = at(loopStart - loopEndSize), x1 = at(loopStart);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(origBlendLoopEnd, waveH)) <= BLEND_HIT_Y) return "origLoopEnd";
    }

    const handleMidY = Math.floor(waveH / 2);
    const handleTop = handleMidY - Math.floor(HANDLE_BAR_HEIGHT / 2);
    const handleBot = handleTop + HANDLE_BAR_HEIGHT;
    if (y >= handleTop && y <= handleBot) {
        if (Math.abs(x - at(loopStart + tailSize)) <= HANDLE_HIT_X) return "tail";
        if (Math.abs(x - at(loopEnd - headSize)) <= HANDLE_HIT_X) return "head";
        if (Math.abs(x - at(loopStart - loopEndSize)) <= HANDLE_HIT_X) return "loopEnd";
    }

    if (tailSize > 0) {
        const x0 = at(loopStart), x1 = at(loopStart + tailSize);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(blendTail, waveH)) <= BLEND_HIT_Y) return "blendTail";
    }
    if (headSize > 0) {
        const x0 = at(loopEnd - headSize), x1 = at(loopEnd);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(blendHead, waveH)) <= BLEND_HIT_Y) return "blendHead";
    }
    if (loopEndSize > 0) {
        const x0 = at(loopStart - loopEndSize), x1 = at(loopStart);
        if (x >= x0 && x <= x1 && Math.abs(y - blendToY(blendLoopEnd, waveH)) <= BLEND_HIT_Y) return "blendLoopEnd";
    }

    if (Math.abs(x - at(loopStart)) <= MARKER_HIT_X) return "markerStart";
    if (Math.abs(x - at(loopEnd)) <= MARKER_HIT_X) return "markerEnd";

    return null;
}

/** Whether a drag target moves a value vertically (a blend line) or horizontally (a marker/size handle) - ported from loopCreator.js#cursorForTarget (695-701), for a later spec's own dynamic cursor hinting (not wired yet - see requirements.md). */
export function isVerticalLoopTarget(hit) {
    return hit === "blendTail" || hit === "blendHead" || hit === "blendLoopEnd" ||
        hit === "origTail" || hit === "origHead" || hit === "origLoopEnd";
}
