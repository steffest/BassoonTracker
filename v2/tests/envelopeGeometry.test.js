import { test } from "node:test";
import assert from "node:assert/strict";
import { toLogical, toPixel, pointAt, LOGICAL_WIDTH, LOGICAL_HEIGHT, HIT_RADIUS } from "../renderers/canvas/envelopeGeometry.js";

// Spec 056: the envelope view's own coordinate/hit-test math, ported from
// script/src/ui/envelope.js's own onResize/onHover.

// rect chosen 1:1 (width===LOGICAL_WIDTH, height===LOGICAL_HEIGHT) so a
// logical unit equals a pixel, making every position below hand-derivable.
const rect = { x: 0, y: 0, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

test("toLogical flips y from the rect's own bottom - an envelope's value increases upward", () => {
    assert.deepEqual(toLogical({ x: 0, y: 0 }, rect), { x: 0, y: LOGICAL_HEIGHT });
    assert.deepEqual(toLogical({ x: 0, y: LOGICAL_HEIGHT }, rect), { x: 0, y: 0 });
    assert.deepEqual(toLogical({ x: 162, y: 32 }, rect), { x: 162, y: 32 });
});

test("toPixel is the inverse of toLogical over a range of rects and points", () => {
    for (const size of [{ width: 324, height: 64 }, { width: 500, height: 120 }, { width: 100, height: 20 }]) {
        const r = { x: 5, y: 7, ...size };
        for (const point of [[0, 0], [162, 32], [324, 64], [50, 10]]) {
            const px = toPixel(point, r);
            const back = toLogical({ x: px.x, y: px.y }, r);
            assert.equal(Math.round(back.x), point[0], `x round-trips for ${JSON.stringify(point)} at ${JSON.stringify(size)}`);
            assert.equal(Math.round(back.y), point[1], `y round-trips for ${JSON.stringify(point)} at ${JSON.stringify(size)}`);
        }
    }
});

test("pointAt finds a hit within HIT_RADIUS and returns -1 for a miss", () => {
    const points = [[10, 10], [100, 40]];
    assert.equal(pointAt(points, 2, { x: 10, y: 10 }), 0, "exact hit");
    assert.equal(pointAt(points, 2, { x: 10 + HIT_RADIUS - 1, y: 10 }), 0, "just inside the box");
    assert.equal(pointAt(points, 2, { x: 10 + HIT_RADIUS, y: 10 }), -1, "exactly at the box's own edge is a miss (strict <)");
    assert.equal(pointAt(points, 2, { x: 200, y: 200 }), -1, "far away");
});

test("pointAt only considers the first `count` points, and returns the first-in-order match when two boxes overlap", () => {
    const points = [[10, 10], [12, 10], [200, 10]];
    assert.equal(pointAt(points, 3, { x: 11, y: 10 }), 0, "point 0's own box already covers this - first in order wins");
    assert.equal(pointAt(points, 1, { x: 200, y: 10 }), -1, "point 2 exists in the array but count excludes it");
});

test("pointAt tolerates a missing point at an index below count (defensive, matching v1's own `|| [0,0]` guard)", () => {
    const points = [[10, 10]];
    points[1] = undefined;
    assert.doesNotThrow(() => pointAt(points, 2, { x: 0, y: 0 }));
    assert.equal(pointAt(points, 2, { x: 2, y: 2 }), 1, "falls back to [0,0] for the missing slot");
});
