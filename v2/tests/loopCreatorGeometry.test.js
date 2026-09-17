import { test } from "node:test";
import assert from "node:assert/strict";
import { blendToY, hitLoopTarget, isVerticalLoopTarget, BLEND_MARGIN } from "../renderers/canvas/loopCreatorGeometry.js";

// Spec 044: the loop creator overlay's own eleven-target hit test. rect/zoom
// are chosen 1:1 (zoomLength === rect.width, zoomStart 0) so a sample index
// equals its own pixel x, making every position below hand-derivable.

const rect = { x: 0, y: 0, width: 220, height: 60 };

// loop [100, 200); tail region [100,120) - handle at 120; head region
// [185,200) - handle at 185; loopEnd region [90,100) - handle at 90. Every
// orig-blend value is 1 and every blend value is 0.1, so blendToY puts the
// three orig lines at y=10 and the three blend lines at y=46 - far enough
// apart (36px, well past the 6px hit tolerance either side) that an
// orig/blend pair sharing the same x-range can never both match one point.
const state = {
    loopStart: 100, loopEnd: 200,
    tailSize: 20, headSize: 15, loopEndSize: 10,
    blendTail: 0.1, blendHead: 0.1, blendLoopEnd: 0.1,
    origBlendTail: 1, origBlendHead: 1, origBlendLoopEnd: 1,
    zoomStart: 0, zoomLength: 220
};

const ORIG_Y = blendToY(1, rect.height);   // 10
const BLEND_Y = blendToY(0.1, rect.height); // 46

test("blendToY runs 1 (loud) at BLEND_MARGIN down to 0 (quiet) at height-BLEND_MARGIN, inverted", () => {
    assert.equal(blendToY(1, 60), BLEND_MARGIN);
    assert.equal(blendToY(0, 60), 60 - BLEND_MARGIN);
    assert.equal(blendToY(0.5, 60), (BLEND_MARGIN + (60 - BLEND_MARGIN)) / 2);
});

test("hitLoopTarget resolves each of the eleven targets at its own hand-derived position", () => {
    assert.equal(hitLoopTarget(rect, { x: 110, y: ORIG_Y }, state), "origTail");
    assert.equal(hitLoopTarget(rect, { x: 190, y: ORIG_Y }, state), "origHead");
    assert.equal(hitLoopTarget(rect, { x: 95, y: ORIG_Y }, state), "origLoopEnd");

    assert.equal(hitLoopTarget(rect, { x: 120, y: 30 }, state), "tail");
    assert.equal(hitLoopTarget(rect, { x: 185, y: 30 }, state), "head");
    assert.equal(hitLoopTarget(rect, { x: 90, y: 30 }, state), "loopEnd");

    assert.equal(hitLoopTarget(rect, { x: 105, y: BLEND_Y }, state), "blendTail");
    assert.equal(hitLoopTarget(rect, { x: 192, y: BLEND_Y }, state), "blendHead");
    assert.equal(hitLoopTarget(rect, { x: 97, y: BLEND_Y }, state), "blendLoopEnd");

    assert.equal(hitLoopTarget(rect, { x: 100, y: 55 }, state), "markerStart");
    assert.equal(hitLoopTarget(rect, { x: 200, y: 55 }, state), "markerEnd");
});

test("hitLoopTarget returns null well away from every target", () => {
    assert.equal(hitLoopTarget(rect, { x: 150, y: 50 }, state), null);
});

test("hitLoopTarget checks the orig-blend triangles before the size handles, and the handles before the blend center lines - v1's own priority order", () => {
    // At the tail handle's own x (120), a point could also fall inside
    // blendTail's own x-range - the handle must win since it is checked
    // first (loopCreator.js#hitTarget, 132-190).
    assert.equal(hitLoopTarget(rect, { x: 120, y: 30 }, state), "tail");
});

test("hitLoopTarget degrades to null for a zero-width rect or a zero-length zoom window", () => {
    assert.equal(hitLoopTarget({ ...rect, width: 0 }, { x: 100, y: 50 }, state), null);
    assert.equal(hitLoopTarget(rect, { x: 100, y: 50 }, { ...state, zoomLength: 0 }), null);
    assert.equal(hitLoopTarget(null, { x: 100, y: 50 }, state), null);
});

test("isVerticalLoopTarget is true for the six blend/orig lines and false for markers/handles/null", () => {
    for (const hit of ["blendTail", "blendHead", "blendLoopEnd", "origTail", "origHead", "origLoopEnd"]) {
        assert.equal(isVerticalLoopTarget(hit), true, hit);
    }
    for (const hit of ["markerStart", "markerEnd", "tail", "head", "loopEnd", null]) {
        assert.equal(isVerticalLoopTarget(hit), false, hit);
    }
});
