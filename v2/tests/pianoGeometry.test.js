import { test } from "node:test";
import assert from "node:assert/strict";
import { keyAtPoint, keyRectsFor, WHITE_KEY_OFFSETS, BLACK_KEY_OFFSETS } from "../renderers/canvas/pianoGeometry.js";

// Spec 061: pianoView's own pure geometry, ported from pianoView.js's
// getKeyAtPoint (86-123) and renderInternal's two tiling loops (175-233).
// Hand-verified with node -e against real numbers before writing these
// assertions (see design.md).

const RECT = { width: 500, height: 150 };
const BASE_OCTAVE = 2;

test("keyRectsFor tiles white/black keys across the rect's own width, each tagged with the combined index", () => {
    const { white, black } = keyRectsFor(RECT, BASE_OCTAVE);
    assert.equal(white.length, 9);
    assert.equal(black.length, 6);
    assert.deepEqual(white[0], { index: 25, left: 0, top: 30, width: 64, height: 120 });
    assert.deepEqual(black[0], { index: 26, left: 38, top: 30, width: 48, height: 70 });
    // the second octave tile's own first white key (C) is 12 combined-index steps up
    assert.equal(white[7].index, white[0].index + 12);
});

test("keyAtPoint on a white key's own rect resolves to the same combined index keyRectsFor already tags it with", () => {
    const { white, black } = keyRectsFor(RECT, BASE_OCTAVE);
    for (const key of white) {
        const local = { x: key.left + 10, y: key.top + key.height - 20 };
        const widgetRelative = keyAtPoint(local, RECT);
        assert.equal(widgetRelative + BASE_OCTAVE * 12, key.index);
    }
    for (const key of black) {
        const local = { x: key.left + 10, y: key.top + 10 };
        const widgetRelative = keyAtPoint(local, RECT);
        assert.equal(widgetRelative + BASE_OCTAVE * 12, key.index);
    }
});

test("a miss (y < 0) returns 0", () => {
    assert.equal(keyAtPoint({ x: 10, y: -5 }, RECT), 0);
});

test("the two no-black-key seams (E/F, B/C) fall through to the white key beneath, in black-key territory", () => {
    // octaveIndex 2 (E/F) and 6 (B/C) are the seams - BLACK_KEY_OFFSETS marks
    // them -1 at odd sub-column indices 5 and 13.
    assert.equal(BLACK_KEY_OFFSETS[5], -1);
    assert.equal(BLACK_KEY_OFFSETS[13], -1);

    // sub-column 5 spans keyX roughly [165,195) (subKeyWidth=30, margin=15,
    // subKey = floor((keyX-15)/30) === 5 => keyX in [165,195)); pick a point
    // inside black-key territory (y small) that lands there.
    const local = { x: 170, y: 10 };
    const key = keyAtPoint(local, RECT);
    assert.notEqual(key, 0);
    // Falls through to the white key beneath: keyIndex = floor(keyX/60) = 2 (E)
    assert.equal(key - 1, WHITE_KEY_OFFSETS[2]);
});
