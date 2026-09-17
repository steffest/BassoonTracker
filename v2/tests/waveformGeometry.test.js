import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_ZOOM_LENGTH, clampZoom, pixelToSampleIndex, sampleIndexToPixel, edgeAt } from "../renderers/canvas/waveformGeometry.js";

const rect = { x: 10, y: 0, width: 100, height: 50 };

test("clampZoom floors zoomLength at MIN_ZOOM_LENGTH and ceilings at the sample's own length", () => {
    assert.deepEqual(clampZoom(0, 1, 1000), { zoomStart: 0, zoomLength: MIN_ZOOM_LENGTH });
    assert.deepEqual(clampZoom(0, 10_000, 1000), { zoomStart: 0, zoomLength: 1000 });
});

test("clampZoom keeps zoomStart within [0, sampleLength - zoomLength]", () => {
    assert.deepEqual(clampZoom(-50, 100, 1000), { zoomStart: 0, zoomLength: 100 });
    assert.deepEqual(clampZoom(5000, 100, 1000), { zoomStart: 900, zoomLength: 100 });
});

test("clampZoom against a zero or negative sample length collapses to an empty window", () => {
    assert.deepEqual(clampZoom(0, 100, 0), { zoomStart: 0, zoomLength: 0 });
    assert.deepEqual(clampZoom(0, 100, -5), { zoomStart: 0, zoomLength: 0 });
});

test("pixelToSampleIndex/sampleIndexToPixel are exact inverses across the whole window", () => {
    const zoomStart = 100;
    const zoomLength = 200;
    for (const pixelX of [rect.x, rect.x + 25, rect.x + rect.width - 1]) {
        const index = pixelToSampleIndex(rect, pixelX, zoomStart, zoomLength);
        const roundTripPixel = sampleIndexToPixel(rect, index, zoomStart, zoomLength);
        assert.ok(Math.abs(roundTripPixel - pixelX) < 3, `pixel ${pixelX} -> index ${index} -> pixel ${roundTripPixel}`);
    }
});

test("pixelToSampleIndex/sampleIndexToPixel degrade gracefully with no rect or a zero-length window", () => {
    assert.equal(pixelToSampleIndex(null, 50, 0, 100), 0);
    assert.equal(pixelToSampleIndex(rect, 50, 0, 0), 0, "zoomLength 0 - step is 0, so every pixel maps to zoomStart");
    assert.equal(sampleIndexToPixel(null, 10, 0, 100), 0);
    assert.equal(sampleIndexToPixel(rect, 10, 0, 0), rect.x);
});

test("edgeAt finds the start edge, the end edge, or neither, within the same 5px tolerance v1 uses", () => {
    const zoomStart = 0;
    const zoomLength = 100; // 1:1 with rect.width
    const selection = { start: 20, length: 30 }; // start pixel = rect.x+20, end pixel = rect.x+50
    assert.equal(edgeAt(rect, rect.x + 20, selection, zoomStart, zoomLength), "start");
    assert.equal(edgeAt(rect, rect.x + 22, selection, zoomStart, zoomLength), "start", "within tolerance");
    assert.equal(edgeAt(rect, rect.x + 50, selection, zoomStart, zoomLength), "end");
    assert.equal(edgeAt(rect, rect.x + 35, selection, zoomStart, zoomLength), null, "well inside the selection, not near either edge");
});

test("edgeAt is null when there is no selection at all", () => {
    assert.equal(edgeAt(rect, rect.x + 20, { start: 0, length: 0 }, 0, 100), null);
    assert.equal(edgeAt(rect, rect.x + 20, null, 0, 100), null);
});
