import { test } from "node:test";
import assert from "node:assert/strict";
import {
    LINE_HEIGHT, GUTTER_WIDTH, TRACK_MARGIN,
    trackWidth, trackStep, visibleTrackCount, trackSlotX, trackIndexAt, columnRect
} from "../renderers/canvas/patternGridGeometry.js";

// Spec 030: pure pixel geometry shared by the patternGrid draw kind and
// runtime/gridController.js, so drawing and hit-testing can never disagree
// about where a cell is.

test("trackWidth grows by one column's worth in FastTracker mode", () => {
    const plain = trackWidth(false);
    const ft = trackWidth(true);
    assert.ok(ft > plain, "FT mode adds the volume column");
    assert.equal(trackStep(false), plain + TRACK_MARGIN);
});

test("visibleTrackCount fits as many whole tracks as the width allows", () => {
    const step = trackStep(false);
    const width = GUTTER_WIDTH + step * 3 + 2; // room for 3 full tracks, a sliver of a 4th
    assert.equal(visibleTrackCount(width, false), 3);
    assert.equal(visibleTrackCount(GUTTER_WIDTH, false), 1, "never reports fewer than one track");
});

test("trackSlotX places each visible slot one full step after the gutter", () => {
    const step = trackStep(false);
    assert.equal(trackSlotX(0, false), GUTTER_WIDTH);
    assert.equal(trackSlotX(2, false), GUTTER_WIDTH + step * 2);
});

test("trackIndexAt resolves a local point to the absolute track under it", () => {
    const rect = { x: 0, y: 0, width: GUTTER_WIDTH + trackStep(false) * 4, height: 100 };
    assert.equal(trackIndexAt(rect, { x: 5, y: 10 }, 8, 0, false), null, "the line-number gutter is not a track");
    assert.equal(trackIndexAt(rect, { x: GUTTER_WIDTH + 1, y: 10 }, 8, 0, false), 0);
    assert.equal(trackIndexAt(rect, { x: GUTTER_WIDTH + trackStep(false) + 1, y: 10 }, 8, 0, false), 1);
    assert.equal(trackIndexAt(rect, { x: GUTTER_WIDTH + trackStep(false) + 1, y: 10 }, 8, 5, false), 6, "startTrack shifts the window");
    assert.equal(trackIndexAt(rect, { x: 100000, y: 10 }, 8, 0, false), null, "past the last visible slot");
    assert.equal(trackIndexAt(rect, { x: GUTTER_WIDTH + 1, y: 10 }, 1, 0, false), 0);
});

test("columnRect gives each cursor column its own local {x, width}, clamped to the table's ends", () => {
    const note = columnRect(0, false);
    const last = columnRect(999, false);
    assert.equal(note.x, 0);
    assert.ok(last.x > note.x, "the last column sits to the right of the note column");
    assert.deepEqual(columnRect(-5, false), note, "clamps below zero to the first column");
});

test("FastTracker mode inserts a volume column between instrument and effect", () => {
    const insLo = columnRect(2, true);
    const volHi = columnRect(3, true);
    const fx = columnRect(5, true);
    assert.ok(volHi.x >= insLo.x + insLo.width);
    assert.ok(fx.x > volHi.x);
});

test("LINE_HEIGHT is a positive constant", () => {
    assert.ok(LINE_HEIGHT > 0);
});
