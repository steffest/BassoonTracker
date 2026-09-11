// Scrollbar arithmetic (spec 014 INT-004). One pure function shared by the
// draw kind that paints the thumb, the controller that drags it and the
// renderer that picks the cursor, so the three can never disagree about
// where the thumb is.
//
// The clamp is not here: `runtime/genericLayout.js` clamps the offset to the
// content extent (spec 013), and every gesture goes through it.

/** Width of a viewport's scrollbar, in logical pixels. */
export const SCROLLBAR_WIDTH = 6;
/** Logical pixels one wheel notch scrolls. */
export const WHEEL_STEP = 24;
/** Shortest thumb that is still grabbable. */
export const MIN_THUMB = 12;

/**
 * Where a viewport's scrollbar and its thumb are.
 *
 * @param {{x:number,y:number,width:number,height:number}} rect the viewport's box
 * @param {{width:number,height:number}|null|undefined} extent its content size (layout `extents`)
 * @param {number} offset the applied scroll offset (layout `offsets`)
 * @returns {null | { track: object, thumb: object, overflow: number, ratio: number }}
 *   null when the content fits, which is also how a caller decides not to
 *   draw a thumb and not to show a grab cursor.
 */
export function thumbMetrics(rect, extent, offset) {
    if (!rect || !extent || rect.height <= 0) return null;
    const overflow = extent.height - rect.height;
    if (overflow <= 0) return null;

    const track = {
        x: rect.x + rect.width - SCROLLBAR_WIDTH,
        y: rect.y,
        width: SCROLLBAR_WIDTH,
        height: rect.height
    };
    const proportion = Math.min(rect.height / extent.height, 1);
    const height = Math.max(Math.round(track.height * proportion), Math.min(MIN_THUMB, track.height));
    const travel = Math.max(track.height - height, 0);
    const progress = overflow > 0 ? Math.min(Math.max(offset / overflow, 0), 1) : 0;
    const thumb = {
        x: track.x,
        y: track.y + Math.round(travel * progress),
        width: track.width,
        height
    };
    // Pixels of content per pixel of thumb travel: what a thumb drag multiplies by.
    const ratio = travel > 0 ? overflow / travel : 0;
    return { track, thumb, overflow, ratio };
}

/** Whether a point is in the scrollbar column of `rect`, thumb or not. */
export function isOnScrollbar(rect, point) {
    if (!rect || !point) return false;
    return point.x >= rect.x + rect.width - SCROLLBAR_WIDTH && point.x <= rect.x + rect.width
        && point.y >= rect.y && point.y <= rect.y + rect.height;
}
