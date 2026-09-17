import { test } from "node:test";
import assert from "node:assert/strict";
import { cellRect, hitTest } from "../renderers/canvas/scopesGeometry.js";

// Spec 058: the scopes' own per-track cell layout, ported from
// visualiser.js's own _setAnalyserPositions/onClick.

test("cellRect: up to four tracks sit in a single row, full height", () => {
    const rect = { x: 0, y: 0, width: 400, height: 80 };
    const cell0 = cellRect(0, 4, rect);
    const cell3 = cellRect(3, 4, rect);
    assert.deepEqual(cell0, { left: 0, top: 0, width: 100, height: 80, lineLeft: Math.ceil(100 / 70), lineWidth: Math.floor(100 - 100 / 30) });
    assert.equal(cell3.left, 300);
    assert.equal(cell3.top, 0);
    assert.equal(cell3.height, 80);
});

test("cellRect: beyond four tracks, two rows of half height, the second row's own top is rect.height - cellHeight", () => {
    const rect = { x: 0, y: 0, width: 300, height: 80 };
    // 6 tracks -> cols = ceil(6/2) = 3, cellHeight = 40
    const first = cellRect(0, 6, rect);
    const secondRowFirst = cellRect(3, 6, rect);
    assert.equal(first.height, 40);
    assert.equal(first.top, 0);
    assert.equal(secondRowFirst.left, 0);
    assert.equal(secondRowFirst.top, rect.height - 40);
    assert.equal(secondRowFirst.height, 40);

    const secondRowLast = cellRect(5, 6, rect);
    assert.equal(secondRowLast.left, 200);
    assert.equal(secondRowLast.top, 40);
});

test("cellRect: an odd track count still splits into ceil(n/2) columns", () => {
    const rect = { x: 0, y: 0, width: 300, height: 60 };
    // 5 tracks -> cols = ceil(5/2) = 3
    const secondRowFirst = cellRect(3, 5, rect);
    assert.equal(secondRowFirst.left, 0);
    assert.equal(secondRowFirst.top, 30);
});

test("hitTest: a point strictly inside a cell hits it; exactly on an edge misses (strict inequality, matching v1)", () => {
    const rect = { x: 0, y: 0, width: 400, height: 80 };
    assert.equal(hitTest({ x: 50, y: 40 }, 4, rect), 0);
    assert.equal(hitTest({ x: 150, y: 40 }, 4, rect), 1);
    assert.equal(hitTest({ x: 100, y: 40 }, 4, rect), -1, "exactly on the boundary between cell 0 and 1 misses both");
    assert.equal(hitTest({ x: 0, y: 40 }, 4, rect), -1, "exactly on the left edge misses");
});

test("hitTest: a point outside every cell (e.g. below all rows) misses", () => {
    const rect = { x: 0, y: 0, width: 300, height: 80 };
    assert.equal(hitTest({ x: 10, y: 999 }, 6, rect), -1);
});
