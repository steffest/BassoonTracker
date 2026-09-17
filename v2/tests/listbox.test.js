import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, cursorOf, drawKindOf, isStyledType } from "../runtime/componentTypes.js";
import { createListController, scrollFieldOf } from "../runtime/listController.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";

// Spec 019: listbox, the first implemented container-with-selection from
// package P5's dependency order (spec 016 declared it; rangeSlider/knob were
// spec 018's cluster). Its own controller (behavior "list") combines
// click-to-select with the wheel/drag/thumb scrolling a viewport already has,
// reusing genericLayout.js's `clips` mechanism unchanged - these tests cover
// the registry, the layout integration and the new controller; the draw kind
// is checked the same shallow way rangeSlider/knob's are (valueControls.test.js).

// --- registry ----------------------------------------------------------------

test("listbox is implemented, reuses viewport's clip mechanism, and has its own controller", () => {
    const entry = componentType("listbox");
    assert.equal(entry.implemented, true);
    assert.equal(entry.clips, true, "the same generic flag a viewport sets, not a name check");
    assert.equal(entry.styled, false, "no skin artwork exists for a listbox's own chrome");
    assert.equal(behaviorOf("listbox"), "list");
    assert.equal(cursorOf("listbox"), "default");
    assert.equal(drawKindOf("listbox"), "listbox");
    assert.equal(isStyledType("listbox"), false);
    assert.deepEqual(entry.container, { childrenIn: "items" }, "items are ordinary children, no forced sub-type (spec 016)");
});

test("scrollFieldOf derives a name that cannot collide with an authored selection field", () => {
    assert.equal(scrollFieldOf({ id: "songList" }), "scroll.songList");
    assert.equal(scrollFieldOf({}), null);
});

// --- layout integration (genericLayout.js needed no changes for this) --------

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };
function node(type, id, layout = {}, children = [], extra = {}) {
    return { id, type, definitionName: id, labelVariants: [id], layout: { ...AUTO, ...layout }, children, bindings: [], supported: true, source: null, ...extra };
}
const measure = () => ({ width: 40, height: 10 });

test("a listbox clips and scrolls its items exactly as a viewport clips its content", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("listbox", "songs", { height: { mode: "fixed", size: 30 } }, [
            node("label", "a"), node("label", "b"), node("label", "c"), node("label", "d")
        ])
    ]);
    const { clips, rects, extents, offsets } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, {
        scrollOffset: n => (n.id === "songs" ? 12 : 0)
    });

    const box = rects.get("songs");
    assert.equal(box.height, 30);
    assert.equal(extents.get("songs").height, 4 * 10 + 3 * 4, "four 10px rows plus three 4px gaps");
    assert.equal(offsets.get("songs"), 12, "the requested offset, clamped to the overflow");
    assert.deepEqual(clips.get("a"), clips.get("songs"), "items inherit the listbox's own clip");
    assert.ok(rects.get("a").y < rects.get("songs").y, "scrolled up out of view, not dropped");
});

// --- the "list" controller ----------------------------------------------------

const RECT = { x: 0, y: 0, width: 100, height: 40 };
const EXTENT = { width: 100, height: 100 }; // overflows RECT, so it can scroll

test("a plain press-and-release on an item selects it", () => {
    const controller = createListController();
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, extent: EXTENT, offset: 0, itemIndex: 2 });
    const result = controller.handle({ type: "pointerup", dragged: false });
    assert.equal(result.value, 2);
    assert.equal(result.changed, true);
    assert.equal(result.scrollTo, null);
});

test("a drag scrolls instead of selecting, and never reports a value", () => {
    const controller = createListController();
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, extent: EXTENT, offset: 0, itemIndex: 2 });
    controller.handle({ type: "dragstart" });
    const dragged = controller.handle({ type: "drag", delta: { x: 0, y: -20 }, rect: RECT, extent: EXTENT, offset: 0 });
    assert.equal(dragged.scrollTo, 20, "dragging up reveals content below, the same convention scrollController uses");
    assert.equal(dragged.value, null);
    const released = controller.handle({ type: "pointerup", dragged: true });
    assert.equal(released.value, null, "a drag never selects, matching a native list");
});

test("the wheel scrolls and stops at either end without swallowing it", () => {
    const controller = createListController();
    const down = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, extent: EXTENT, offset: 0 });
    assert.equal(down.handled, true);
    assert.ok(down.scrollTo > 0);
    const atTop = controller.handle({ type: "wheel", deltaY: -1, rect: RECT, extent: EXTENT, offset: 0 });
    assert.equal(atTop.handled, false, "already at the top; an ancestor should get the wheel instead");
});

test("disabled blocks selection and scrolling alike", () => {
    const controller = createListController({ disabled: true });
    const down = controller.handle({ type: "pointerdown", point: { x: 0, y: 0 }, rect: RECT, extent: EXTENT, offset: 0, itemIndex: 0 });
    assert.equal(down.blocked, "disabled");
    const wheel = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, extent: EXTENT, offset: 0 });
    assert.equal(wheel.blocked, "disabled");
});

// --- draw kind -----------------------------------------------------------------

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), rect: (...a) => calls.push(["rect", ...a]),
        clip: () => calls.push(["clip"]), fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 } };
}

test("listbox measures to a fixed default size", () => {
    assert.deepEqual(drawKind("listbox").measure(), { width: 160, height: 120 });
});

test("listbox draws a backing rect, the selected row's tint (clipped to its own box), and never throws with no selection", () => {
    const rect = { x: 10, y: 10, width: 100, height: 60 };
    assert.doesNotThrow(() => drawKind("listbox").draw(fakeCtx(), fakeAssets(), null, rect, "", {}));

    const ctx = fakeCtx();
    const state = { selectedItemRect: { x: 12, y: 12, width: 96, height: 10 } };
    drawKind("listbox").draw(ctx, fakeAssets(), null, rect, "", state);
    assert.ok(ctx.calls.some(c => c[0] === "clip"), "the selected tint is clipped to the listbox's own box");
    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the backing and the selected row are both filled");
});

test("listbox draws a scrollbar track when state.scroll overflows, sharing viewport's own metrics", () => {
    const ctx = fakeCtx();
    const rect = { x: 0, y: 0, width: 100, height: 30 };
    const state = { scroll: { extent: { width: 100, height: 90 }, offset: 20 } };
    // The thumb itself goes through drawStyledBackground, which draws nothing
    // without a real skin asset (checked elsewhere); the track is drawn
    // directly by drawScrollThumb and is what this test can assert on without
    // a real skin.
    assert.doesNotThrow(() => drawKind("listbox").draw(ctx, fakeAssets(), null, rect, "", state));
    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the backing and the track are both filled");
});

test("listbox draws no scrollbar when state.scroll's content fits (thumbMetrics returns null)", () => {
    const ctx = fakeCtx();
    const rect = { x: 0, y: 0, width: 100, height: 30 };
    const state = { scroll: { extent: { width: 100, height: 20 }, offset: 0 } };
    drawKind("listbox").draw(ctx, fakeAssets(), null, rect, "", state);
    assert.equal(ctx.calls.filter(c => c[0] === "fillRect").length, 1, "only the backing; no track for content that fits");
});
