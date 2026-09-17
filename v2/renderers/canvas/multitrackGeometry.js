// Multitrack-view geometry (spec 052), shared by the "multitrackView" draw
// kind and runtime/multitrackController.js so drawing and hit-testing can
// never disagree about where a lane, a block, a scrollbar thumb or a
// control-strip button is - the same reason patternGridGeometry.js/
// waveformGeometry.js/loopCreatorGeometry.js are shared by their own draw
// kind and controller.
//
// Ported from script/src/ui/app/components/multitrack.js's own formulas
// (_getTrackHeight, _getMaxScrollX/Y, _applyHorizontal/VerticalThumbDelta,
// _updateScrollbars, onDragStart's own region dispatch) and dawtrack.js's
// own control-button layout (panel.setTrackHeight, 164-177).
//
// Pure: no canvas, no domain/ import - plain geometry over a rect and a
// few counts, testable with numbers alone.

export const HEADER_HEIGHT = 20;
export const SCROLLBAR_SIZE = 16;
export const MIN_TRACK_H = 24;
export const CTRL_WIDTH = 220;
export const MIN_PPS = 4;
export const MAX_PPS = 128;
export const SCOPE_LEFT = 36;
export const SCOPE_WIDTH = 132;
/** Replaces v1's own Layout.visibleTracks (a breakpoint-driven setting with no v2 equivalent yet) - see requirements.md's Decisions. */
export const DEFAULT_VISIBLE_TRACKS = 4;
const BUTTON_SIZE = 26;

export function trackHeightFor(rect, visibleTracks = DEFAULT_VISIBLE_TRACKS) {
    const available = rect.height - HEADER_HEIGHT;
    return Math.max(MIN_TRACK_H, Math.floor(available / Math.max(1, visibleTracks)));
}

export function stepToX(step, pixelsPerStep, scrollX) {
    return CTRL_WIDTH + step * pixelsPerStep - scrollX;
}
export function xToStep(localX, pixelsPerStep, scrollX) {
    return Math.floor((scrollX + localX - CTRL_WIDTH) / pixelsPerStep);
}
export function trackAtY(localY, scrollY, trackHeight) {
    return Math.floor((scrollY + localY - HEADER_HEIGHT) / trackHeight);
}
export function localTrackY(localY, scrollY, track, trackHeight) {
    return scrollY + localY - HEADER_HEIGHT - track * trackHeight;
}

export function maxScrollX(rect, patternLength, pixelsPerStep) {
    return Math.max(0, patternLength * pixelsPerStep - (rect.width - CTRL_WIDTH));
}
export function maxScrollY(rect, trackCount, trackHeight) {
    return Math.max(0, trackCount * trackHeight - (rect.height - HEADER_HEIGHT));
}
export function clampScrollX(x, rect, patternLength, pixelsPerStep) {
    return Math.max(0, Math.min(maxScrollX(rect, patternLength, pixelsPerStep), x));
}
export function clampScrollY(y, rect, trackCount, trackHeight) {
    return Math.max(0, Math.min(maxScrollY(rect, trackCount, trackHeight), y));
}

/** Ported from multitrack.js#_applyHorizontalThumbDelta (399-411). */
export function applyHorizontalThumbDelta(deltaX, startScrollX, rect, patternLength, pixelsPerStep) {
    const contentW = rect.width - CTRL_WIDTH;
    const totalW = patternLength * pixelsPerStep;
    if (totalW <= contentW) return startScrollX;
    const thumbW = Math.max(SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
    const thumbRangeX = contentW - thumbW;
    if (thumbRangeX <= 0) return startScrollX;
    return clampScrollX(startScrollX + deltaX * (totalW - contentW) / thumbRangeX, rect, patternLength, pixelsPerStep);
}

/** Ported from multitrack.js#_applyVerticalThumbDelta (413-425). */
export function applyVerticalThumbDelta(deltaY, startScrollY, rect, trackCount, trackHeight) {
    const contentH = rect.height - HEADER_HEIGHT;
    const totalMaxScrollY = maxScrollY(rect, trackCount, trackHeight);
    if (totalMaxScrollY <= 0) return startScrollY;
    const totalH = trackCount * trackHeight;
    const thumbH = Math.max(SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
    const thumbRangeY = contentH - thumbH;
    if (thumbRangeY <= 0) return startScrollY;
    return clampScrollY(startScrollY + deltaY * totalMaxScrollY / thumbRangeY, rect, trackCount, trackHeight);
}

/** Ported from multitrack.js#_updateScrollbars (485-501) - geometry only, no drawing. Null when the content fits (nothing to drag). */
export function hScrollbarMetrics(rect, patternLength, pixelsPerStep, scrollX) {
    const contentW = rect.width - CTRL_WIDTH;
    const totalW = patternLength * pixelsPerStep;
    if (totalW <= contentW || contentW <= 0) return null;
    const thumbW = Math.max(SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
    const maxThumbX = contentW - thumbW;
    const thumbX = CTRL_WIDTH + Math.floor((scrollX / (totalW - contentW)) * maxThumbX);
    return { x: rect.x + thumbX, y: rect.y + rect.height - SCROLLBAR_SIZE, width: thumbW, height: SCROLLBAR_SIZE };
}

/** Ported from multitrack.js#_updateScrollbars (502-512) - geometry only, no drawing. Null when the content fits. */
export function vScrollbarMetrics(rect, trackCount, trackHeight, scrollY) {
    const contentH = rect.height - HEADER_HEIGHT;
    const totalMaxScrollY = maxScrollY(rect, trackCount, trackHeight);
    if (totalMaxScrollY <= 0) return null;
    const totalH = trackCount * trackHeight;
    const thumbH = Math.max(SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
    const maxThumbY = contentH - thumbH;
    const thumbY = HEADER_HEIGHT + Math.floor((scrollY / totalMaxScrollY) * maxThumbY);
    return { x: rect.x + rect.width - SCROLLBAR_SIZE, y: rect.y + thumbY, width: SCROLLBAR_SIZE, height: thumbH };
}

/**
 * Which region of the leaf a point falls on - ported from multitrack.js's
 * own onDragStart (215-255), minus the note-vs-timeline decision inside
 * "lane" (the caller's own, since it needs domain data this pure module
 * does not import).
 * @param {{x:number,y:number}} local rect-relative
 * @param {{width:number,height:number}} rect
 * @returns {"vscrollbar"|"hscrollbar"|"ruler"|"controls"|"lane"|null}
 */
export function hitRegion(local, rect) {
    if (local.x >= rect.width - SCROLLBAR_SIZE && local.y >= HEADER_HEIGHT) return "vscrollbar";
    if (local.y >= rect.height - SCROLLBAR_SIZE && local.x >= CTRL_WIDTH) return "hscrollbar";
    if (local.y < HEADER_HEIGHT && local.x >= CTRL_WIDTH) return "ruler";
    if (local.x < CTRL_WIDTH && local.y >= HEADER_HEIGHT) return "controls";
    if (local.x >= CTRL_WIDTH) return "lane";
    return null;
}

/** Ported from multitrack.js#_getNoteBlockAt (536-547), against an already-fetched per-track block array. */
export function findBlockAt(blocks, step) {
    if (!blocks) return null;
    for (const block of blocks) {
        if (step >= block.startStep && step < block.endStep) return block;
    }
    return null;
}

/** Ported from dawtrack.js#panel.setTrackHeight (164-177) - three 26x26 buttons, evenly spaced, at the strip's own right edge. */
export function controlButtonRect(button, trackHeight) {
    const buttonSpace = Math.floor((trackHeight - BUTTON_SIZE * 3) / 4);
    const order = { solo: 0, mute: 1, record: 2 };
    const index = order[button];
    const x = CTRL_WIDTH - BUTTON_SIZE - 7;
    const y = buttonSpace * (index + 1) + BUTTON_SIZE * index;
    return { x, y, width: BUTTON_SIZE, height: BUTTON_SIZE };
}

/** Which control-strip button (if any) a row-local point falls on. */
export function controlButtonAt(localX, localY, trackHeight) {
    for (const button of ["solo", "mute", "record"]) {
        const r = controlButtonRect(button, trackHeight);
        if (localX >= r.x && localX <= r.x + r.width && localY >= r.y && localY <= r.y + r.height) return button;
    }
    return null;
}
