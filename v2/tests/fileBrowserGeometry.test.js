import { test } from "node:test";
import assert from "node:assert/strict";
import { ROW_HEIGHT, RICH_ROW_HEIGHT, contentHeight, clampOffset, rowIndexAt, visibleRowRange } from "../renderers/canvas/fileBrowserGeometry.js";

const rect = { x: 10, y: 20, width: 100, height: 64 }; // 4 rows visible at ROW_HEIGHT=16

test("contentHeight is rowCount * ROW_HEIGHT, never negative", () => {
    assert.equal(contentHeight(10), 10 * ROW_HEIGHT);
    assert.equal(contentHeight(0), 0);
    assert.equal(contentHeight(-5), 0);
});

test("clampOffset floors at 0 and ceilings at content-minus-rect-height", () => {
    assert.equal(clampOffset(-100, 20, 64), 0);
    const max = contentHeight(20) - 64;
    assert.equal(clampOffset(10_000, 20, 64), max);
    assert.equal(clampOffset(max - 1, 20, 64), max - 1);
});

test("clampOffset against zero rows is always 0, never negative", () => {
    assert.equal(clampOffset(50, 0, 64), 0);
    assert.equal(clampOffset(-50, 0, 64), 0);
});

test("rowIndexAt resolves the first and last row exactly at the boundary", () => {
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 }, 0, 10), 0);
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + ROW_HEIGHT - 1 }, 0, 10), 0);
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + ROW_HEIGHT }, 0, 10), 1);
});

test("rowIndexAt returns null above the first row, past the last, or outside the rect", () => {
    assert.equal(rowIndexAt(rect, { x: 15, y: 19 }, 0, 10), null, "above the rect entirely");
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + 10 * ROW_HEIGHT }, 0, 10), null, "past the last row");
    assert.equal(rowIndexAt(rect, { x: 200, y: 25 }, 0, 10), null, "outside the rect horizontally");
    assert.equal(rowIndexAt(rect, { x: 15, y: 25 }, 0, 0), null, "no rows at all");
});

test("rowIndexAt accounts for a scroll offset that is not a multiple of the row height", () => {
    // offset = 10px into row 0 (10 < ROW_HEIGHT); a point at the rect's own
    // top now lands 10px into row 0, i.e. still row 0.
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 }, 10, 10), 0);
    // a point ROW_HEIGHT - 10 + 1 down lands just past row 0's boundary -> row 1.
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + (ROW_HEIGHT - 10) }, 10, 10), 1);
});

test("visibleRowRange covers exactly the rows a rect can show at a given offset", () => {
    assert.deepEqual(visibleRowRange(rect, 0, 10), { first: 0, last: 4 });
    assert.deepEqual(visibleRowRange(rect, ROW_HEIGHT * 2, 10), { first: 2, last: 6 });
    // near the end, `last` is clamped to rowCount, not the rect's own capacity.
    assert.deepEqual(visibleRowRange(rect, ROW_HEIGHT * 8, 10), { first: 8, last: 10 });
});

test("visibleRowRange is empty for zero rows or no rect", () => {
    assert.deepEqual(visibleRowRange(rect, 0, 0), { first: 0, last: 0 });
    assert.deepEqual(visibleRowRange(null, 0, 10), { first: 0, last: 0 });
});

// Spec 080 (deep-parity-audit item 7): a richRows fileBrowser passes its own
// taller row height through every one of these functions - hit-testing and
// scrolling must never disagree with the taller rows the draw kind actually
// paints.
test("every geometry function accepts an explicit rowHeight, defaulting to ROW_HEIGHT", () => {
    assert.equal(contentHeight(10, RICH_ROW_HEIGHT), 10 * RICH_ROW_HEIGHT);
    assert.notEqual(RICH_ROW_HEIGHT, ROW_HEIGHT, "the two constants must actually differ for this test to mean anything");

    const richMax = contentHeight(20, RICH_ROW_HEIGHT) - 64;
    assert.equal(clampOffset(10_000, 20, 64, RICH_ROW_HEIGHT), richMax);
    assert.notEqual(richMax, contentHeight(20) - 64, "a richRows clamp must differ from the plain-row clamp");

    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + RICH_ROW_HEIGHT }, 0, 10, RICH_ROW_HEIGHT), 1);
    assert.equal(rowIndexAt(rect, { x: 15, y: 20 + RICH_ROW_HEIGHT - 1 }, 0, 10, RICH_ROW_HEIGHT), 0);

    assert.deepEqual(visibleRowRange(rect, 0, 10, RICH_ROW_HEIGHT), { first: 0, last: Math.ceil(64 / RICH_ROW_HEIGHT) });
});
