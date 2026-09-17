// Ported from script/src/ui/app/components/patternView.js's own `_range`/
// `_rangeNormalized`/`_rangeCopy` fields - a rectangular block selection
// (arbitrary rows x contiguous tracks) distinct from the edit cursor, plus
// the one clipboard it and domain/song/index.js's block operations share.
// Pure: no Tracker/Note import, so it is testable with plain numbers and no
// loaded song, the same way editHistory.js is.

/**
 * Sorts a {start:{row,track}, end:{row,track}} pair into a normalized
 * rectangle, regardless of which corner a drag started from.
 * v1's own _normalizeRange (patternView.js:761-772).
 */
export function normalizeRange(range) {
    if (!range) return null;
    const { start, end } = range;
    return {
        top: Math.min(start.row, end.row),
        bottom: Math.max(start.row, end.row),
        left: Math.min(start.track, end.track),
        right: Math.max(start.track, end.track)
    };
}

export function createSelectionState() {
    let range = null;
    let clipboard = null;

    return {
        getRange: () => range,
        setRange: (next) => { range = next; },
        getClipboard: () => clipboard,
        setClipboard: (next) => { clipboard = next; }
    };
}
