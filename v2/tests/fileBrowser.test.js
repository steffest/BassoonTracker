import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, cursorOf, drawKindOf, isStyledType } from "../runtime/componentTypes.js";
import { createFileBrowserController, rowsFieldOf } from "../runtime/fileBrowserController.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { ROW_HEIGHT } from "../renderers/canvas/fileBrowserGeometry.js";

// Spec 035: fileBrowser, the specialized-component contract's second leaf
// after patternGrid - a scrollable, hierarchical list whose rows are runtime
// data (an unbounded, lazily-expanded remote catalog listing cannot be
// authored YAML the way listbox's own items are). Verified against a
// hand-built row array, with no screen authored yet - the same precedent
// specs 013/015/020/030 already set for their own mechanisms.

// --- registry ----------------------------------------------------------------

test("fileBrowser is a specialized leaf with its own behavior and draw kind", () => {
    const entry = componentType("fileBrowser");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.notEqual(entry.clips, true, "opts out of genericLayout's child-based extent, like patternGrid");
    assert.equal(behaviorOf("fileBrowser"), "rowList");
    assert.equal(drawKindOf("fileBrowser"), "fileBrowser");
    assert.equal(cursorOf("fileBrowser"), "default");
    assert.equal(isStyledType("fileBrowser"), false);
    assert.deepEqual(Object.keys(entry.properties), ["field"]);
});

test("rowsFieldOf derives a name that cannot collide with the selection field", () => {
    assert.equal(rowsFieldOf({ id: "catalog" }), "rows.catalog");
    assert.equal(rowsFieldOf({}), null);
});

// --- the "rowList" controller -------------------------------------------------

const RECT = { x: 0, y: 0, width: 100, height: 4 * ROW_HEIGHT }; // 4 rows visible
const ROWS = Array.from({ length: 10 }, (_, i) => ({ title: `row ${i}`, level: 0 }));

test("a plain press-and-release on a row selects it", () => {
    const controller = createFileBrowserController();
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, rows: ROWS, offset: 0 });
    const result = controller.handle({ type: "pointerup", dragged: false });
    assert.equal(result.value, 0);
    assert.equal(result.changed, true);
    assert.equal(result.scrollTo, null);
});

test("clicking the second visible row selects index 1, not 0", () => {
    const controller = createFileBrowserController();
    controller.handle({ type: "pointerdown", point: { x: 5, y: ROW_HEIGHT + 2 }, rect: RECT, rows: ROWS, offset: 0 });
    const result = controller.handle({ type: "pointerup", dragged: false });
    assert.equal(result.value, 1);
});

test("a drag scrolls instead of selecting, and never reports a value", () => {
    const controller = createFileBrowserController();
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, rows: ROWS, offset: 0 });
    controller.handle({ type: "dragstart" });
    const dragged = controller.handle({ type: "drag", delta: { x: 0, y: -20 }, rect: RECT, rows: ROWS, offset: 0 });
    assert.equal(dragged.scrollTo, 20, "dragging up reveals content below, the same convention scrollController/listController use");
    assert.equal(dragged.value, null);
    const released = controller.handle({ type: "pointerup", dragged: true });
    assert.equal(released.value, null, "a drag never selects, matching listController.js's own rule");
});

test("the wheel scrolls and clamps at both ends without swallowing it past them", () => {
    const controller = createFileBrowserController();
    const down = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, rows: ROWS, offset: 0 });
    assert.equal(down.handled, true);
    assert.ok(down.scrollTo > 0);

    const maxOffset = ROWS.length * ROW_HEIGHT - RECT.height;
    const atBottom = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, rows: ROWS, offset: maxOffset });
    assert.equal(atBottom.handled, false, "already at the bottom; an ancestor should get the wheel instead");

    const atTop = controller.handle({ type: "wheel", deltaY: -1, rect: RECT, rows: ROWS, offset: 0 });
    assert.equal(atTop.handled, false, "already at the top");
});

test("wheel scrolling never fires for an empty rows array", () => {
    const controller = createFileBrowserController();
    const result = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, rows: [], offset: 0 });
    assert.equal(result.handled, false);
    assert.equal(result.scrollTo, null);
});

test("disabled blocks selection and scrolling alike", () => {
    const controller = createFileBrowserController({ disabled: true });
    const down = controller.handle({ type: "pointerdown", point: { x: 0, y: 0 }, rect: RECT, rows: ROWS, offset: 0 });
    assert.equal(down.blocked, "disabled");
    const wheel = controller.handle({ type: "wheel", deltaY: 1, rect: RECT, rows: ROWS, offset: 0 });
    assert.equal(wheel.blocked, "disabled");
});

test("blur clears hover, pressed and dragging together, and drops any pending anchor", () => {
    const controller = createFileBrowserController();
    controller.handle({ type: "pointerenter" });
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, rows: ROWS, offset: 0 });
    const blurred = controller.handle({ type: "blur" });
    assert.ok(blurred.transitions.some(t => t.field === "focused" && t.to === false));
    const released = controller.handle({ type: "pointerup", dragged: false });
    assert.equal(released.value, null, "the anchor was cleared by blur, so a stray pointerup selects nothing");
});

test("a scrolled offset shifts which row a click at the rect's own top lands on", () => {
    const controller = createFileBrowserController();
    // Scrolled to the very end, the rect's own top edge shows the first of
    // the last-visible-page's rows, not row 0.
    const maxOffset = ROWS.length * ROW_HEIGHT - RECT.height;
    const firstVisibleAtMax = Math.floor(maxOffset / ROW_HEIGHT);
    controller.handle({ type: "pointerdown", point: { x: 5, y: 5 }, rect: RECT, rows: ROWS, offset: maxOffset });
    const result = controller.handle({ type: "pointerup", dragged: false });
    assert.equal(result.value, firstVisibleAtMax);
});

// --- the draw kind ------------------------------------------------------------

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), rect: (...a) => calls.push(["rect", ...a]),
        clip: () => calls.push(["clip"]), fillRect: (...a) => calls.push(["fillRect", ...a]),
        drawImage: (...a) => calls.push(["drawImage", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets(getAsset = () => null) {
    const writes = [];
    return {
        skin: { getAsset },
        styleFor: () => null,
        font: { getTextWidth: text => (text || "").length * 6, write: (ctx, text, x, y) => writes.push({ text, x, y }), charHeight: 8, writes }
    };
}

test("fileBrowser measures to a fixed default size", () => {
    assert.deepEqual(drawKind("fileBrowser").measure(), { width: 200, height: 140 });
});

test("fileBrowser draws only the visible rows, never throws for zero rows, and never throws for a huge row count", () => {
    assert.doesNotThrow(() => drawKind("fileBrowser").draw(fakeCtx(), fakeAssets(), null, RECT, "", { rows: [] }));

    const assets = fakeAssets();
    const manyRows = Array.from({ length: 10_000 }, (_, i) => ({ title: `row ${i}`, level: 0 }));
    drawKind("fileBrowser").draw(fakeCtx(), assets, null, RECT, "", { rows: manyRows, offset: 0, selectedIndex: -1 });
    assert.equal(assets.font.writes.length, 4, "only the 4 rows the rect can actually show are ever written");
});

test("fileBrowser indents by level and skips the icon when its asset does not resolve, without breaking column alignment", () => {
    const assets = fakeAssets(); // getAsset always returns null - no icon resolves
    const ctx = fakeCtx();
    const rows = [{ title: "root", level: 0 }, { title: "child", level: 1, icon: "module" }];
    assert.doesNotThrow(() => drawKind("fileBrowser").draw(ctx, assets, null, RECT, "", { rows, offset: 0, selectedIndex: -1 }));
    assert.equal(ctx.calls.some(c => c[0] === "drawImage"), false, "no asset resolved, so nothing is blitted");
    assert.equal(assets.font.writes.length, 2);
    assert.ok(assets.font.writes[1].x > assets.font.writes[0].x, "the deeper row's title starts further right, by level and by its own reserved icon column");
});

test("fileBrowser highlights the selected row and tolerates an out-of-range selectedIndex", () => {
    const rows = [{ title: "a", level: 0 }, { title: "b", level: 0 }];
    const ctx = fakeCtx();
    drawKind("fileBrowser").draw(ctx, fakeAssets(), null, RECT, "", { rows, offset: 0, selectedIndex: 1 });
    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the backing and the selected row are both filled");

    assert.doesNotThrow(() => drawKind("fileBrowser").draw(fakeCtx(), fakeAssets(), null, RECT, "", { rows, offset: 0, selectedIndex: 99 }));
});

test("fileBrowser draws a scrollbar track when the rows overflow the rect", () => {
    const ctx = fakeCtx();
    const rows = Array.from({ length: 20 }, (_, i) => ({ title: `row ${i}`, level: 0 }));
    drawKind("fileBrowser").draw(ctx, fakeAssets(), null, RECT, "", { rows, offset: 20, selectedIndex: -1 });
    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the backing and the scrollbar track are both filled");
});
