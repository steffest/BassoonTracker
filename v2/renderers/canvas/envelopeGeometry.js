// Envelope-view geometry (spec 056), shared by the "envelopeView" draw kind
// and runtime/envelopeController.js so drawing and hit-testing can never
// disagree about where a point is. Ported from script/src/ui/envelope.js's
// own coordinate math (onResize/onHover, 31-75).
//
// Pure: no canvas, no domain/ import - plain geometry over a rect and a
// fixed 324x64 logical grid, testable with numbers alone.

export const LOGICAL_WIDTH = 324;
export const LOGICAL_HEIGHT = 64;
export const HIT_RADIUS = 6;

/**
 * Ported from envelope.js#onHover's own x/y lines (43-44) - logical y is
 * measured from the rect's own bottom, the opposite of screen-pixel y
 * (an envelope's own value increases upward).
 * @param {{x:number,y:number}} local rect-relative pixel coordinates
 * @param {{width:number,height:number}} rect
 */
export function toLogical(local, rect) {
    const xScale = rect.width / LOGICAL_WIDTH;
    const yScale = rect.height / LOGICAL_HEIGHT;
    return {
        x: Math.round(local.x / xScale),
        y: Math.round((rect.height - local.y) / yScale)
    };
}

/** Inverse of toLogical, for the draw kind - shared so drawing and hit-testing can never disagree. Returns rect-relative pixel coordinates. */
export function toPixel(point, rect) {
    const xScale = rect.width / LOGICAL_WIDTH;
    const yScale = rect.height / LOGICAL_HEIGHT;
    return {
        x: point[0] * xScale,
        y: rect.height - point[1] * yScale
    };
}

/**
 * Ported from envelope.js#onHover's own loop (47-66) - the first point (in
 * index order) within a HIT_RADIUS box of `logical`, or -1.
 * @param {Array<[number,number]>} points
 * @param {number} count
 * @param {{x:number,y:number}} logical
 */
export function pointAt(points, count, logical) {
    for (let i = 0; i < count; i++) {
        const point = points[i] || [0, 0];
        if (Math.abs(logical.x - point[0]) < HIT_RADIUS && Math.abs(logical.y - point[1]) < HIT_RADIUS) return i;
    }
    return -1;
}
