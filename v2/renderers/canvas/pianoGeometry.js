// pianoView's own pure geometry (spec 061), ported exactly from
// script/src/ui/app/pianoView.js's getKeyAtPoint (86-123) and the two
// tiling loops inside renderInternal (175-233).
//
// A "key" in this file is always the piano's own widget-relative value
// (0 for a miss, else the 1-based semitone-plus-widget-octave index
// getKeyAtPoint itself returns) - the caller (runtime/pianoController.js)
// adds domain/song#getCurrentOctave()*12 to reach the combined index
// domain/playback#previewNoteOn/previewNoteOff and isPreviewNoteActive all
// expect (see requirements.md's own note on why that combined format
// matters - it is resolveNote's own internal index space, spec 060).

export const KEY_WIDTH = 64;
export const KEY_OVERLAP = 4;
export const KEY_SIZE_X = KEY_WIDTH - KEY_OVERLAP; // 60
export const KEY_TOP = 30;
export const BLACK_KEY_WIDTH = 48;

// Semitone offset for each of an octave's 7 white keys (C, D, E, F, G, A, B).
export const WHITE_KEY_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
// One entry per half-white-key-width sub-column across an octave (13 of
// them, indices 0-13 inclusive below since v1 clamps subKey to 0..12) -
// odd indices are black keys; -1 marks the two seams with none (between
// E/F and B/C), where the white key beneath shows through instead.
export const BLACK_KEY_OFFSETS = [-1, 1, 0, 3, 0, -1, 0, 6, 0, 8, 0, 10, 0, -1];

/**
 * @param {{x:number,y:number}} local point relative to the piano's own top-left
 * @param {{width:number,height:number}} rect the piano's own content rect
 * @returns {number} 0 for a miss, else the widget-relative key (1-based)
 */
export function keyAtPoint(local, rect) {
    let key = -1;
    const octaveWidth = KEY_SIZE_X * 7;
    const x = local.x;
    const y = local.y;
    const keyX = x % octaveWidth;
    const keyOctave = Math.floor(x / octaveWidth);
    const keyHeight = rect.height - KEY_TOP;
    const bKeyHeight = Math.floor(keyHeight / 1.7);

    if (y >= 0) {
        if (y > bKeyHeight + KEY_TOP) {
            const keyIndex = Math.floor(keyX / KEY_SIZE_X);
            key = WHITE_KEY_OFFSETS[keyIndex] + keyOctave * 12;
        } else {
            const subKeyWidth = KEY_SIZE_X / 2;
            const margin = subKeyWidth / 2;
            let subKey = Math.floor((keyX - margin) / subKeyWidth);
            if (subKey < 0) subKey = 0;
            if (subKey > 12) subKey = 12;

            if (subKey % 2 === 0) {
                const keyIndex = subKey / 2;
                key = WHITE_KEY_OFFSETS[keyIndex];
            } else {
                key = BLACK_KEY_OFFSETS[subKey];
                if (key < 0) {
                    const keyIndex = Math.floor(keyX / KEY_SIZE_X);
                    key = WHITE_KEY_OFFSETS[keyIndex];
                }
            }
            key += keyOctave * 12;
        }
    }
    return key + 1;
}

/**
 * The visible white/black key rects for drawing (renderInternal's own two
 * tiling loops), each tagged with the *combined* index (widget-relative
 * key + baseOctave*12 + the tile's own octave offset) `isPreviewNoteActive`
 * expects - the same value the render loop computes for its `keyDown[]`
 * lookup in v1.
 *
 * @param {{width:number,height:number}} rect
 * @param {number} baseOctave domain/song#getCurrentOctave()'s current value
 */
export function keyRectsFor(rect, baseOctave) {
    const keyHeight = rect.height - KEY_TOP;
    const bKeyHeight = Math.floor(keyHeight / 1.7);

    const white = [];
    let keyX = 0;
    let counter = 0;
    while (keyX < rect.width) {
        const thisOctave = Math.floor(counter / 7);
        const octaveIndex = counter % 7;
        const index = (baseOctave + thisOctave) * 12 + WHITE_KEY_OFFSETS[octaveIndex] + 1;
        white.push({ index, left: keyX, top: KEY_TOP, width: KEY_WIDTH, height: keyHeight });
        counter++;
        keyX += KEY_SIZE_X;
    }

    const black = [];
    let bkeyX = KEY_WIDTH - BLACK_KEY_WIDTH / 2 - 2;
    counter = 0;
    while (bkeyX < rect.width) {
        const thisOctave = Math.floor(counter / 7);
        const octaveIndex = counter % 7;
        if (octaveIndex !== 2 && octaveIndex !== 6) {
            const index = (baseOctave + thisOctave) * 12 + BLACK_KEY_OFFSETS[(octaveIndex * 2) + 1] + 1;
            black.push({ index, left: bkeyX, top: KEY_TOP, width: BLACK_KEY_WIDTH, height: bKeyHeight });
        }
        counter++;
        bkeyX += KEY_SIZE_X;
    }

    return { white, black };
}
