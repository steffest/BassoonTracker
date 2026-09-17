import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceSprites, anyFrameChanged } from "../runtime/animationClock.js";
import { componentType, isAnimatedType, drawKindOf, behaviorOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";

// Spec 017: the first implemented cluster from package P5's declared-not-
// drawn list (spec 016) - icon, image and animSprite, plus the animation
// clock animSprite needed and nothing else in v2 had.

// --- runtime/animationClock.js (pure) --------------------------------------

test("advanceSprites steps once per frameDelay and carries the remainder", () => {
    // The caller (mountGeneric.js) re-supplies each sprite's static frames/
    // frameDelay every call, since the clock's own output only carries the
    // per-sprite state (id, frame, elapsed); this mirrors that.
    const sprite = { id: "a", frames: 4, frameDelay: 100 };
    let result = advanceSprites([{ ...sprite, frame: 0, elapsed: 0 }], 40);
    assert.deepEqual(result, [{ id: "a", frame: 0, elapsed: 40 }], "under one frameDelay: no step yet, time carried");
    result = advanceSprites([{ ...sprite, ...result[0] }], 65); // 40 + 65 = 105 -> one step, 5ms remainder
    assert.deepEqual(result, [{ id: "a", frame: 1, elapsed: 5 }]);
});

test("advanceSprites wraps around the frame count and can catch up multiple steps in one call", () => {
    const sprite = { id: "a", frame: 3, elapsed: 0, frames: 4, frameDelay: 100 };
    const result = advanceSprites([sprite], 250); // 2.5 steps -> 2 whole steps
    assert.equal(result[0].frame, (3 + 2) % 4, "wraps rather than going out of range");
    assert.equal(result[0].elapsed, 50);
});

test("advanceSprites treats frames <= 1 as never advancing, and a non-finite delay as the default", () => {
    assert.equal(advanceSprites([{ id: "a", frame: 0, frames: 1, frameDelay: 100 }], 10000)[0].frame, 0);
    const result = advanceSprites([{ id: "a", frame: 0, frames: 2, frameDelay: 0 }], 130);
    assert.ok(result[0].frame === 0 || result[0].frame === 1, "a non-positive delay falls back to the documented default rather than dividing by zero or looping forever");
});

test("anyFrameChanged compares by id, not by array position", () => {
    const before = [{ id: "a", frame: 0 }, { id: "b", frame: 2 }];
    assert.equal(anyFrameChanged(before, [{ id: "a", frame: 0 }, { id: "b", frame: 2 }]), false);
    assert.equal(anyFrameChanged(before, [{ id: "a", frame: 1 }, { id: "b", frame: 2 }]), true);
});

// --- runtime/componentTypes.js ---------------------------------------------

test("icon, image and animSprite are implemented with the expected shape", () => {
    for (const type of ["icon", "image"]) {
        assert.equal(componentType(type).implemented, true);
        assert.equal(drawKindOf(type), "image");
        assert.equal(behaviorOf(type), null, `${type} takes no input`);
        assert.equal(cursorOf(type), "default");
        assert.equal(isAnimatedType(type), false);
    }
    assert.equal(drawKindOf("animSprite"), "animSprite");
    assert.equal(isAnimatedType("animSprite"), true);
    assert.equal(isAnimatedType("image"), false, "animated is a distinct flag from interactive/behavior");
    assert.equal(componentType("animSprite").properties.field.kind, "reference");
});

// --- renderers/canvas/drawKinds.js -----------------------------------------

/** A minimal fake asset lookup: one wide "strip" asset plus recording of names asked for. */
function fakeAssets(assetsByName) {
    const requested = [];
    return {
        requested,
        skin: {
            getAsset(name) {
                requested.push(name);
                return assetsByName[name] || null;
            }
        }
    };
}

/** Records drawImage calls; nothing else in these two draw kinds touches ctx. */
function fakeCtx() {
    const calls = [];
    return { calls, drawImage: (...args) => calls.push(args) };
}

test("image draws its named asset centred by default, and reads src or icon", () => {
    const asset = { name: "thing", image: "IMG", x: 5, y: 6, width: 10, height: 10 };
    const assets = fakeAssets({ thing: asset });
    const ctx = fakeCtx();
    const rect = { x: 0, y: 0, width: 20, height: 20 };
    const resolution = drawKind("image").draw(ctx, assets, null, rect, null, {}, { src: "thing" });
    assert.equal(resolution.drawn, true);
    assert.deepEqual(ctx.calls[0], ["IMG", 5, 6, 10, 10, 5, 5, 10, 10], "centred: (20-10)/2 = 5 on both axes");

    ctx.calls.length = 0;
    drawKind("image").draw(ctx, assets, null, rect, null, {}, { icon: "thing" });
    assert.equal(ctx.calls.length, 1, "icon's own property name (icon) resolves the same asset");
});

test("image respects scale: stretch and horizontal/vertical alignment", () => {
    const asset = { name: "thing", image: "IMG", x: 0, y: 0, width: 10, height: 10 };
    const assets = fakeAssets({ thing: asset });
    const rect = { x: 2, y: 2, width: 30, height: 30 };

    let ctx = fakeCtx();
    drawKind("image").draw(ctx, assets, null, rect, null, {}, { src: "thing", scale: "stretch" });
    assert.deepEqual(ctx.calls[0], ["IMG", 0, 0, 10, 10, 2, 2, 30, 30], "stretched to the full rect");

    ctx = fakeCtx();
    drawKind("image").draw(ctx, assets, null, rect, null, {}, { src: "thing", horizontalAlign: "right", verticalAlign: "top" });
    assert.deepEqual(ctx.calls[0], ["IMG", 0, 0, 10, 10, 22, 2, 10, 10], "right edge (2+30-10) and top (2)");
});

test("image draws nothing (no throw) when the asset cannot be resolved", () => {
    const assets = fakeAssets({});
    const ctx = fakeCtx();
    const resolution = drawKind("image").draw(ctx, assets, null, { x: 0, y: 0, width: 10, height: 10 }, null, {}, { src: "missing" });
    assert.equal(resolution, null);
    assert.equal(ctx.calls.length, 0);
});

test("image measures to the asset's natural size, or a small fallback when unresolved", () => {
    const assets = fakeAssets({ thing: { name: "thing", width: 40, height: 12 } });
    assert.deepEqual(drawKind("image").measure(assets, null, null, { src: "thing" }), { width: 40, height: 12 });
    assert.deepEqual(drawKind("image").measure(assets, null, null, { src: "missing" }), { width: 14, height: 14 });
});

test("animSprite draws the frame the state's fieldValue names, from a strip laid out left to right", () => {
    // A 4-frame, 40px-wide strip: each frame is 10px.
    const asset = { name: "walk", image: "IMG", x: 100, y: 0, width: 40, height: 10 };
    const assets = fakeAssets({ walk: asset });
    const ctx = fakeCtx();
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    const node = { sprite: "walk", frames: 4 };

    drawKind("animSprite").draw(ctx, assets, null, rect, null, { fieldValue: 2 }, node);
    assert.deepEqual(ctx.calls[0], ["IMG", 100 + 2 * 10, 0, 10, 10, 0, 0, 10, 10], "frame 2 starts 20px into the strip");

    ctx.calls.length = 0;
    drawKind("animSprite").draw(ctx, assets, null, rect, null, { fieldValue: 99 }, node);
    assert.equal(ctx.calls[0][1], 100 + 3 * 10, "an out-of-range fieldValue is clamped to the last frame, not read past the strip");
});

test("animSprite measures one frame's width, from the strip and the declared frame count", () => {
    const assets = fakeAssets({ walk: { name: "walk", width: 40, height: 10 } });
    assert.deepEqual(drawKind("animSprite").measure(assets, null, null, { sprite: "walk", frames: 4 }), { width: 10, height: 10 });
});
