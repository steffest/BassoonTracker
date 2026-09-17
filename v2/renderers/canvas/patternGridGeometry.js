// Pattern-grid geometry (spec 030), shared by the "patternGrid" draw kind
// and runtime/gridController.js so drawing and hit-testing can never
// disagree about where a cell is - the same reason runtime/scrollbar.js is
// shared by a thumb's drawing, dragging and cursor.
//
// Ported from script/src/ui/app/components/patternView.js's own pixel
// constants (_lineHeight, cursorWidth1/cursorWidth3, textWidth), but scoped
// to this one file instead of v1's global `Layout` singleton - nothing else
// in v2 needs a tracker-specific column layout, and v1's condensed-font/
// breakpoint variants of these numbers are not carried forward (see
// requirements.md's scope decision).
//
// Pure: no canvas, no domain/ import - plain geometry, testable with
// numbers alone.

export const LINE_HEIGHT = 13;
export const GUTTER_WIDTH = 24;
export const TRACK_MARGIN = 4;

const NOTE_WIDTH = 30;
const INSTRUMENT_WIDTH = 20;
const VOLUME_WIDTH = 20;
const EFFECT_WIDTH = 30;

/** The columns a track's cursor can land on, in order, and each one's local {x, width}. */
function columnTable(ftMode) {
    const columns = [{ x: 0, width: NOTE_WIDTH }];
    let x = NOTE_WIDTH;
    columns.push({ x, width: INSTRUMENT_WIDTH / 2 });
    columns.push({ x: x + INSTRUMENT_WIDTH / 2, width: INSTRUMENT_WIDTH / 2 });
    x += INSTRUMENT_WIDTH;
    if (ftMode) {
        columns.push({ x, width: VOLUME_WIDTH / 2 });
        columns.push({ x: x + VOLUME_WIDTH / 2, width: VOLUME_WIDTH / 2 });
        x += VOLUME_WIDTH;
    }
    columns.push({ x, width: EFFECT_WIDTH / 3 });
    columns.push({ x: x + EFFECT_WIDTH / 3, width: EFFECT_WIDTH / 3 });
    columns.push({ x: x + (EFFECT_WIDTH * 2) / 3, width: EFFECT_WIDTH / 3 });
    return columns;
}

/** One track's total width, note through param, FastTracker's extra volume column included when `ftMode`. */
export function trackWidth(ftMode) {
    const columns = columnTable(ftMode);
    const last = columns[columns.length - 1];
    return last.x + last.width;
}

/** One track's full horizontal step, including the margin to its neighbour - what a pixel delta divides by to become a track count. */
export function trackStep(ftMode) {
    return trackWidth(ftMode) + TRACK_MARGIN;
}

/** How many whole tracks fit in `width` after the line-number gutter. */
export function visibleTrackCount(width, ftMode) {
    return Math.max(1, Math.floor((width - GUTTER_WIDTH + TRACK_MARGIN) / trackStep(ftMode)));
}

/** The local x a visible track slot (0-based, left to right) starts at. */
export function trackSlotX(visibleIndex, ftMode) {
    return GUTTER_WIDTH + visibleIndex * trackStep(ftMode);
}

/**
 * Which absolute track index a local point falls in, or null when it is in
 * the line-number gutter or past the last visible track.
 * @param {{width:number,height:number}} rect the grid's own box
 * @param {{x:number,y:number}} local a point relative to rect's origin
 */
export function trackIndexAt(rect, local, trackCount, startTrack, ftMode) {
    if (local.x < GUTTER_WIDTH) return null;
    const visible = visibleTrackCount(rect.width, ftMode);
    const slot = Math.floor((local.x - GUTTER_WIDTH) / trackStep(ftMode));
    if (slot < 0 || slot >= visible) return null;
    const track = startTrack + slot;
    if (track < 0 || track >= trackCount) return null;
    return track;
}

/** The cursor highlight's local {x, width} for one track's given column (0-based, per domain/song's getStepsPerTrack()). */
export function columnRect(column, ftMode) {
    const columns = columnTable(ftMode);
    return columns[Math.min(Math.max(column, 0), columns.length - 1)];
}
