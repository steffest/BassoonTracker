// Waveform-view geometry (spec 041), shared by the "waveformView" draw kind
// and runtime/waveformController.js so drawing and hit-testing can never
// disagree about where a sample index is - the same reason
// patternGridGeometry.js/fileBrowserGeometry.js are shared by their own
// draw kind and controller.
//
// Pure: no canvas, no domain/ import - plain geometry over a rect and a
// {zoomStart, zoomLength} window, testable with numbers alone.

export const MIN_ZOOM_LENGTH = 16; // samples - a floor so zooming in can never collapse the view to nothing
const EDGE_HIT_PIXELS = 5; // matches script/plugins/sampleeditor/waveform.js's own `Math.abs(x - markerX) < 5`

/** Clamps a requested {zoomStart, zoomLength} window into a valid one for `sampleLength` samples. */
export function clampZoom(zoomStart, zoomLength, sampleLength) {
    if (!(sampleLength > 0)) return { zoomStart: 0, zoomLength: 0 };
    const length = Math.min(Math.max(zoomLength, MIN_ZOOM_LENGTH), sampleLength);
    const start = Math.min(Math.max(zoomStart, 0), Math.max(0, sampleLength - length));
    return { zoomStart: start, zoomLength: length };
}

/**
 * The sample index a pixel x (in the same coordinate space as `rect`) falls
 * on, given the current window - matches waveform.js's own
 * `index = zoomStart + i * (zoomLength / width)`.
 */
export function pixelToSampleIndex(rect, pixelX, zoomStart, zoomLength) {
    if (!rect || rect.width <= 0) return zoomStart;
    const step = zoomLength / rect.width;
    return Math.round(zoomStart + (pixelX - rect.x) * step);
}

/** The pixel x a sample index draws at - the exact inverse of pixelToSampleIndex. */
export function sampleIndexToPixel(rect, index, zoomStart, zoomLength) {
    if (!rect) return 0;
    if (!(zoomLength > 0)) return rect.x;
    const step = rect.width / zoomLength;
    return rect.x + (index - zoomStart) * step;
}

/**
 * Which selection edge (if any) a pixel x is within EDGE_HIT_PIXELS of.
 * @param {{start: number, length: number}} selection
 * @returns {"start"|"end"|null}
 */
export function edgeAt(rect, pixelX, selection, zoomStart, zoomLength) {
    if (!selection || !selection.length) return null;
    const startPixel = sampleIndexToPixel(rect, selection.start, zoomStart, zoomLength);
    const endPixel = sampleIndexToPixel(rect, selection.start + selection.length, zoomStart, zoomLength);
    if (Math.abs(pixelX - startPixel) < EDGE_HIT_PIXELS) return "start";
    if (Math.abs(pixelX - endPixel) < EDGE_HIT_PIXELS) return "end";
    return null;
}
