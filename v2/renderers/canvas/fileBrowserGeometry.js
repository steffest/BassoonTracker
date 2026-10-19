// File-browser geometry (spec 035), shared by the "fileBrowser" draw kind
// and runtime/fileBrowserController.js so drawing and hit-testing can never
// disagree about where a row is - the same reason patternGridGeometry.js is
// shared by patternGrid's own draw kind and gridController.js.
//
// Pure: no canvas, no domain/ import, no mockState - plain geometry over a
// row count and a rect, testable with numbers alone.

export const ROW_HEIGHT = 16;
// Spec 080: a "richRows" fileBrowser (deep-parity-audit item 7 - the
// sidebar's own Songs/Samples/Playlists rows) draws two lines (title, then
// a dimmed subtitle) instead of one, so it needs more vertical room per
// row. Every geometry function below takes the row height actually in
// effect as a parameter (defaulting to the plain-row constant above) rather
// than assuming it - the same reason patternGrid's own geometry never
// hardcodes LINE_HEIGHT into a shared helper either.
export const RICH_ROW_HEIGHT = 30;
export const ICON_SIZE = 14;
export const INDENT_WIDTH = 12;

/** Total scrollable content height for `rowCount` rows. */
export function contentHeight(rowCount, rowHeight = ROW_HEIGHT) {
    return Math.max(0, rowCount) * rowHeight;
}

/** Clamps a requested scroll offset to what `rowCount` rows in `rectHeight` actually allow. */
export function clampOffset(offset, rowCount, rectHeight, rowHeight = ROW_HEIGHT) {
    const max = Math.max(0, contentHeight(rowCount, rowHeight) - Math.max(0, rectHeight));
    return Math.min(Math.max(0, Math.round(offset) || 0), max);
}

/**
 * Which row index a point (in the same coordinate space as `rect`) falls in,
 * given the current (already-clamped) scroll offset - or null above the
 * first row, past the last, or with no rows at all.
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {{x:number,y:number}} point
 */
export function rowIndexAt(rect, point, offset, rowCount, rowHeight = ROW_HEIGHT) {
    if (!rect || !point || rowCount <= 0) return null;
    if (point.x < rect.x || point.x > rect.x + rect.width) return null;
    if (point.y < rect.y || point.y > rect.y + rect.height) return null;
    const localY = point.y - rect.y + offset;
    if (localY < 0) return null;
    const index = Math.floor(localY / rowHeight);
    return index >= 0 && index < rowCount ? index : null;
}

/** The first and last (exclusive) row index visible in `rect` at `offset` - what the draw kind iterates. */
export function visibleRowRange(rect, offset, rowCount, rowHeight = ROW_HEIGHT) {
    if (!rect || rowCount <= 0) return { first: 0, last: 0 };
    const first = Math.max(0, Math.floor(offset / rowHeight));
    const last = Math.min(rowCount, Math.ceil((offset + rect.height) / rowHeight));
    return { first, last };
}
