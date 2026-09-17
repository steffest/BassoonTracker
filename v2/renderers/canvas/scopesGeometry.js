// Scopes-view geometry (spec 058), shared by the "scopesView" draw kind and
// runtime/scopesController.js so drawing and hit-testing can never disagree
// about where a track's own cell is. Ported from
// script/src/ui/app/components/visualiser.js's own _setAnalyserPositions
// (179-203) and onClick's own hit test (96-108).
//
// Pure: no canvas, no domain/ import - plain geometry over a rect and a
// track count, testable with numbers alone.

/**
 * One track's own cell rect - up to four tracks in a single row; beyond
 * four, two rows (`cols = ceil(trackCount/2)`, each cell's own height
 * halved). The second row's own `top` is `rect.height - cellHeight`, the
 * exact expression v1 itself writes, not merely the value it happens to
 * equal once cells are exactly half-height.
 */
export function cellRect(index, trackCount, rect) {
    let cols = trackCount;
    let cellHeight = rect.height;
    if (trackCount > 4) {
        cols = Math.ceil(trackCount / 2);
        cellHeight = rect.height / 2;
    }
    const cellWidth = rect.width / Math.max(1, cols);
    let left = index * cellWidth;
    let top = 0;
    if (index >= cols) {
        left = (index - cols) * cellWidth;
        top = rect.height - cellHeight;
    }
    return {
        left: Math.floor(left),
        top: Math.floor(top),
        width: Math.floor(cellWidth),
        height: Math.floor(cellHeight),
        lineLeft: Math.ceil(left + cellWidth / 70),
        lineWidth: Math.floor(cellWidth - cellWidth / 30)
    };
}

/** Ported from onClick's own strict-inequality hit test (100-105) - a point exactly on a cell's own edge misses, matching v1 exactly. */
export function hitTest(local, trackCount, rect) {
    for (let i = 0; i < trackCount; i++) {
        const pos = cellRect(i, trackCount, rect);
        if (local.x > pos.left && local.x < pos.left + pos.width && local.y > pos.top && local.y < pos.top + pos.height) return i;
    }
    return -1;
}
