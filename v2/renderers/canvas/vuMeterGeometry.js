// VU meter geometry (spec 054), shared by the "volumeMeter" draw kind - the
// dynamic-range and dot-zone math, ported from
// script/src/ui/app/components/vumeter.js.
//
// Pure: no canvas, no domain/ import - plain arithmetic over a byte buffer
// and two counts, testable with numbers alone.

export const DOT_WIDTH = 10;
export const DOT_MARGIN = 2;
/** v1's own fudge factor, applied once in _renderVU (109,111) - not inside _getDynamicRange itself. */
export const LEVEL_SCALE = Math.E - 1;

/** Ported from vumeter.js#_getDynamicRange (126-134) - unscaled, matching v1's own split between this and the LEVEL_SCALE multiply. */
export function dynamicRange(buffer) {
    let min = 128, max = 128;
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        if (v < min) min = v;
        else if (v > max) max = v;
    }
    return (max - min) / 255;
}

export function dotCountFor(width) {
    return Math.max(0, Math.floor(width / (DOT_WIDTH + DOT_MARGIN)));
}

/** Ported from vumeter.js#_buildVu's own zone thresholds (94-97). */
export function zoneFor(index, totalDots) {
    if (index >= totalDots / 1.5) return "red";
    if (index >= totalDots / 3) return "yellow";
    return "green";
}

/**
 * `range` is already LEVEL_SCALE-applied by the caller, matching v1's own
 * _renderVU. A whole-dot simplification of v1's own pixel-precise clip
 * (see requirements.md's Decisions) - dots light up to the level, not a
 * partially-lit final dot.
 */
export function litDotCount(range, totalDots) {
    return Math.max(0, Math.min(totalDots, Math.floor(range * totalDots)));
}
