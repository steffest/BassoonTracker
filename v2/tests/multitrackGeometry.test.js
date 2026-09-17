import { test } from "node:test";
import assert from "node:assert/strict";
import * as geo from "../renderers/canvas/multitrackGeometry.js";

// Spec 052: the interactive multitrack view's own pure geometry - shared by
// its draw kind and controller, ported from multitrack.js's own formulas.

test("trackHeightFor fits the default visible-track count, floored at MIN_TRACK_H", () => {
    const rect = { x: 0, y: 0, width: 500, height: 20 + 4 * 40 };
    assert.equal(geo.trackHeightFor(rect), 40);
    const tiny = { x: 0, y: 0, width: 500, height: 20 + 4 * 5 };
    assert.equal(geo.trackHeightFor(tiny), geo.MIN_TRACK_H);
});

test("stepToX/xToStep are inverse over the control-strip offset and scroll", () => {
    assert.equal(geo.stepToX(10, 14, 0), geo.CTRL_WIDTH + 140);
    assert.equal(geo.xToStep(geo.CTRL_WIDTH + 140, 14, 0), 10);
    assert.equal(geo.xToStep(geo.stepToX(25, 14, 50), 14, 50), 25);
});

test("trackAtY/localTrackY are inverse over the header offset and scroll", () => {
    const th = 40;
    assert.equal(geo.trackAtY(geo.HEADER_HEIGHT + 85, 0, th), 2);
    assert.equal(geo.localTrackY(geo.HEADER_HEIGHT + 85, 0, 2, th), 5);
});

test("maxScrollX/Y and clampScrollX/Y match a hand-computed content/viewport ratio", () => {
    const rect = { x: 0, y: 0, width: geo.CTRL_WIDTH + 100, height: geo.HEADER_HEIGHT + 100 };
    assert.equal(geo.maxScrollX(rect, 64, 14), 64 * 14 - 100);
    assert.equal(geo.clampScrollX(-5, rect, 64, 14), 0);
    assert.equal(geo.clampScrollX(999999, rect, 64, 14), geo.maxScrollX(rect, 64, 14));

    assert.equal(geo.maxScrollY(rect, 8, 40), 8 * 40 - 100);
    assert.equal(geo.clampScrollY(-5, rect, 8, 40), 0);
    assert.equal(geo.clampScrollY(999999, rect, 8, 40), geo.maxScrollY(rect, 8, 40));
});

test("maxScrollX/Y are zero when the content fits the viewport", () => {
    const rect = { x: 0, y: 0, width: geo.CTRL_WIDTH + 10000, height: geo.HEADER_HEIGHT + 10000 };
    assert.equal(geo.maxScrollX(rect, 64, 14), 0);
    assert.equal(geo.maxScrollY(rect, 4, 40), 0);
});

test("hScrollbarMetrics/vScrollbarMetrics are null when the content fits, and place a thumb proportionally otherwise", () => {
    const fits = { x: 0, y: 0, width: geo.CTRL_WIDTH + 10000, height: geo.HEADER_HEIGHT + 10000 };
    assert.equal(geo.hScrollbarMetrics(fits, 64, 14, 0), null);
    assert.equal(geo.vScrollbarMetrics(fits, 4, 40, 0), null);

    const rect = { x: 100, y: 200, width: geo.CTRL_WIDTH + 200, height: geo.HEADER_HEIGHT + 200 };
    const total = geo.maxScrollX(rect, 64, 14) + 200;
    const h0 = geo.hScrollbarMetrics(rect, 64, 14, 0);
    const hMax = geo.hScrollbarMetrics(rect, 64, 14, geo.maxScrollX(rect, 64, 14));
    assert.ok(h0 && hMax);
    assert.equal(h0.x, rect.x + geo.CTRL_WIDTH, "at scroll 0, the thumb starts at the track's own left edge");
    assert.ok(hMax.x > h0.x, "scrolled all the way, the thumb moves right");
    assert.equal(h0.y, rect.y + rect.height - geo.SCROLLBAR_SIZE);

    const v0 = geo.vScrollbarMetrics(rect, 20, 40, 0);
    const vMax = geo.vScrollbarMetrics(rect, 20, 40, geo.maxScrollY(rect, 20, 40));
    assert.ok(v0 && vMax);
    assert.equal(v0.y, rect.y + geo.HEADER_HEIGHT);
    assert.ok(vMax.y > v0.y);
    assert.equal(v0.x, rect.x + rect.width - geo.SCROLLBAR_SIZE);
});

test("applyHorizontalThumbDelta/applyVerticalThumbDelta move the scroll offset by the track/thumb ratio, clamped", () => {
    const rect = { x: 0, y: 0, width: geo.CTRL_WIDTH + 100, height: geo.HEADER_HEIGHT + 100 };
    const moved = geo.applyHorizontalThumbDelta(10, 0, rect, 64, 14);
    assert.ok(moved > 0, "dragging the thumb right scrolls right");
    assert.equal(geo.applyHorizontalThumbDelta(999999, 0, rect, 64, 14), geo.maxScrollX(rect, 64, 14), "clamped at the max");
    assert.equal(geo.applyHorizontalThumbDelta(10, 0, rect, 1, 14), 0, "no-op when the content already fits");

    const movedY = geo.applyVerticalThumbDelta(10, 0, rect, 20, 40);
    assert.ok(movedY > 0);
    assert.equal(geo.applyVerticalThumbDelta(999999, 0, rect, 20, 40), geo.maxScrollY(rect, 20, 40));
    assert.equal(geo.applyVerticalThumbDelta(10, 0, rect, 2, 40), 0, "no-op when the content already fits");
});

test("hitRegion resolves all five regions and their own priority at shared edges", () => {
    const rect = { x: 0, y: 0, width: geo.CTRL_WIDTH + 200, height: geo.HEADER_HEIGHT + 200 };

    // vscrollbar takes priority over hscrollbar in the shared bottom-right corner
    assert.equal(geo.hitRegion({ x: rect.width - 1, y: rect.height - 1 }, rect), "vscrollbar");
    assert.equal(geo.hitRegion({ x: rect.width - geo.SCROLLBAR_SIZE - 5, y: rect.height - 1 }, rect), "hscrollbar");
    assert.equal(geo.hitRegion({ x: geo.CTRL_WIDTH + 10, y: 5 }, rect), "ruler");
    assert.equal(geo.hitRegion({ x: 10, y: 40 }, rect), "controls");
    assert.equal(geo.hitRegion({ x: geo.CTRL_WIDTH + 10, y: 40 }, rect), "lane");
    assert.equal(geo.hitRegion({ x: 10, y: 5 }, rect), null, "the control strip's own header corner matches nothing");
});

test("findBlockAt resolves the block containing a step, or null between/outside blocks", () => {
    const blocks = [{ startStep: 0, endStep: 4 }, { startStep: 10, endStep: 20 }];
    assert.equal(geo.findBlockAt(blocks, 0), blocks[0]);
    assert.equal(geo.findBlockAt(blocks, 3), blocks[0]);
    assert.equal(geo.findBlockAt(blocks, 4), null, "step 4 is between blocks - block 0's own endStep is exclusive");
    assert.equal(geo.findBlockAt(blocks, 15), blocks[1]);
    assert.equal(geo.findBlockAt(blocks, 999), null);
    assert.equal(geo.findBlockAt(null, 0), null);
});

test("controlButtonAt resolves each of the three buttons and a miss", () => {
    const th = 80;
    const soloRect = geo.controlButtonRect("solo", th);
    const muteRect = geo.controlButtonRect("mute", th);
    const recordRect = geo.controlButtonRect("record", th);

    assert.equal(geo.controlButtonAt(soloRect.x + 5, soloRect.y + 5, th), "solo");
    assert.equal(geo.controlButtonAt(muteRect.x + 5, muteRect.y + 5, th), "mute");
    assert.equal(geo.controlButtonAt(recordRect.x + 5, recordRect.y + 5, th), "record");
    assert.equal(geo.controlButtonAt(0, 0, th), null, "the strip's own top-left corner is not a button");

    // The three buttons never overlap
    assert.ok(soloRect.y + soloRect.height <= muteRect.y);
    assert.ok(muteRect.y + muteRect.height <= recordRect.y);
});
