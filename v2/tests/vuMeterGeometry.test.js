import { test } from "node:test";
import assert from "node:assert/strict";
import { dynamicRange, dotCountFor, zoneFor, litDotCount, DOT_WIDTH, DOT_MARGIN, LEVEL_SCALE } from "../renderers/canvas/vuMeterGeometry.js";

// Spec 054: the VU meter's own dynamic-range and dot-zone math, ported from
// script/src/ui/app/components/vumeter.js.

test("dynamicRange: silence is 0, a one-sided spike and a full-scale spread compute exactly", () => {
    assert.equal(dynamicRange(new Uint8Array(32).fill(128)), 0, "no signal at all");

    const oneSided = new Uint8Array(32).fill(128);
    oneSided[5] = 0;
    assert.equal(dynamicRange(oneSided), (128 - 0) / 255);

    const fullScale = new Uint8Array(32).fill(128);
    fullScale[0] = 0;
    fullScale[1] = 255;
    assert.equal(dynamicRange(fullScale), 1);
});

test("dotCountFor matches width / (DOT_WIDTH + DOT_MARGIN), floored, never negative", () => {
    assert.equal(dotCountFor(160), Math.floor(160 / (DOT_WIDTH + DOT_MARGIN)));
    assert.equal(dotCountFor(0), 0);
    assert.equal(dotCountFor(-10), 0);
});

test("zoneFor: green below 1/3, yellow from 1/3 to 1/1.5, red from there on - v1's own thresholds exactly", () => {
    const total = 12;
    assert.equal(zoneFor(0, total), "green");
    assert.equal(zoneFor(3, total), "green", "just under total/3 (4)");
    assert.equal(zoneFor(4, total), "yellow", "total/3 exactly");
    assert.equal(zoneFor(7, total), "yellow", "just under total/1.5 (8)");
    assert.equal(zoneFor(8, total), "red", "total/1.5 exactly");
    assert.equal(zoneFor(11, total), "red");
});

test("litDotCount clamps at both ends and floors mid-range", () => {
    assert.equal(litDotCount(0, 10), 0);
    assert.equal(litDotCount(1, 10), 10);
    assert.equal(litDotCount(1.5, 10), 10, "clamped above 1");
    assert.equal(litDotCount(-0.5, 10), 0, "clamped below 0");
    assert.equal(litDotCount(0.55, 10), 5);
});

test("LEVEL_SCALE is v1's own fudge factor (Math.E - 1), applied by the caller, not inside dynamicRange", () => {
    assert.equal(LEVEL_SCALE, Math.E - 1);
    const buffer = new Uint8Array(32).fill(128);
    buffer[0] = 0;
    assert.equal(dynamicRange(buffer), (128 - 0) / 255, "dynamicRange itself is unscaled");
});
