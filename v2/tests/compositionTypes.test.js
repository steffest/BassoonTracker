import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, cursorOf, drawKindOf, isStyledType, isImplemented } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { BUILTIN_SKIN } from "../runtime/skinModel.js";

// Spec 021: tabPanel, collapsePanel and buttonGroup, package P5's fifth and
// (per spec 016's own dependency order) last implementing cluster before the
// authored screens. Registry facts first (mirroring overlayTypes.test.js's
// own pattern), then a shallow draw-kind smoke test.

// --- registry ----------------------------------------------------------------

test("tabPanel is implemented, reuses listbox's own controller under its own behavior name, and declares a header height", () => {
    const entry = componentType("tabPanel");
    assert.equal(entry.implemented, true);
    assert.equal(entry.styled, false, "no artwork exists for it yet, same as listbox/submenu");
    assert.deepEqual(entry.tabHeader, { height: 24 });
    assert.equal(behaviorOf("tabPanel"), "tabs");
    assert.equal(drawKindOf("tabPanel"), "tabPanel");
    assert.equal(isStyledType("tabPanel"), false);
    assert.deepEqual(entry.container, { childrenIn: "items" });
    assert.equal(entry.properties.field.kind, "reference");
});

test("collapsePanel is implemented, real collapse behavior, its own behavior name", () => {
    const entry = componentType("collapsePanel");
    assert.equal(entry.implemented, true);
    assert.equal(entry.collapsible, true);
    assert.equal(behaviorOf("collapsePanel"), "collapsible");
    assert.equal(cursorOf("collapsePanel"), "pointer");
    assert.equal(drawKindOf("collapsePanel"), "collapsePanel");
    assert.deepEqual(entry.container, { childrenIn: "content" });
    assert.equal(entry.properties.field.kind, "reference");
});

test("buttonGroup is implemented, plain items (no forced childType), draws nothing of its own", () => {
    const entry = componentType("buttonGroup");
    assert.equal(entry.implemented, true);
    assert.equal(entry.interactive, false, "buttonGroup itself has no controller; its buttons do");
    assert.equal(behaviorOf("buttonGroup"), null);
    assert.equal(drawKindOf("buttonGroup"), "none");
    assert.deepEqual(entry.container, { childrenIn: "items" }, "spec 016's guessed childType: \"button\" is dropped");
    assert.equal(entry.direction, "row");
});

test("none of the three are checked as still-declared placeholders any more", () => {
    for (const type of ["tabPanel", "collapsePanel", "buttonGroup"]) {
        assert.equal(isImplemented(type), true, type);
        assert.notEqual(drawKindOf(type), "placeholder", type);
    }
});

test("neither tabPanel nor collapsePanel needs a built-in fallback style (styled: false)", () => {
    assert.equal(BUILTIN_SKIN.styles.tabPanel, undefined);
    assert.equal(BUILTIN_SKIN.styles.collapsePanel, undefined);
});

// --- draw kinds (shallow, matching overlayTypes.test.js's own pattern) -------

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        strokeRect: (...a) => calls.push(["strokeRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: s => (s || "").length * 4, write: () => {}, charHeight: 8 } };
}

test("tabPanel draws an equal-width slot per item and highlights the active one, without throwing", () => {
    const rect = { x: 0, y: 0, width: 120, height: 24 };
    const node = { children: [{ labelVariants: ["Song"] }, { labelVariants: ["Pattern"] }, { labelVariants: ["Sample"] }] };
    assert.doesNotThrow(() => drawKind("tabPanel").draw(fakeCtx(), fakeAssets(), null, rect, "", { activeIndex: 1 }, node));
    const ctx = fakeCtx();
    drawKind("tabPanel").draw(ctx, fakeAssets(), null, rect, "", { activeIndex: 1 }, node);
    assert.equal(ctx.calls.filter(c => c[0] === "fillRect").length, 3, "one filled slot per item");
});

test("tabPanel draws nothing for an empty item list, without throwing", () => {
    const ctx = fakeCtx();
    const resolution = drawKind("tabPanel").draw(ctx, fakeAssets(), null, { x: 0, y: 0, width: 100, height: 24 }, "", {}, { children: [] });
    assert.equal(resolution.drawn, false);
    assert.equal(ctx.calls.length, 0);
});

test("collapsePanel draws its background and a chevron that flips with state.collapsed", () => {
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    assert.doesNotThrow(() => drawKind("collapsePanel").draw(fakeCtx(), fakeAssets(), null, rect, "Options", {}));
    const expanded = drawKind("collapsePanel").draw(fakeCtx(), fakeAssets(), null, rect, "Options", { collapsed: false });
    const collapsed = drawKind("collapsePanel").draw(fakeCtx(), fakeAssets(), null, rect, "Options", { collapsed: true });
    assert.equal(expanded.drawn, true);
    assert.equal(collapsed.drawn, true);
});

test("collapsePanel measures wider than its label, to leave room for the chevron", () => {
    const size = drawKind("collapsePanel").measure(fakeAssets(), null, "Options");
    assert.ok(size.width > 4 * "Options".length);
    assert.ok(size.height >= 20);
});

test("buttonGroup (\"none\" kind) draws nothing itself", () => {
    const ctx = fakeCtx();
    const resolution = drawKind("none").draw(ctx, fakeAssets(), null, { x: 0, y: 0, width: 100, height: 20 }, "", {});
    assert.equal(resolution, null);
    assert.equal(ctx.calls.length, 0);
});
