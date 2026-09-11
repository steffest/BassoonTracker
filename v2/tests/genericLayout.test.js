import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";

function leaf(id, overrides = {}) {
    return {
        id,
        type: "button",
        layout: { width: { mode: "auto" }, height: { mode: "auto" } },
        children: [],
        ...overrides
    };
}

function panel(id, children, layout = { width: { mode: "fill" }, height: { mode: "fill" } }) {
    return { id, type: "panel", layout, children };
}

const fixedMeasure = () => ({ width: 40, height: 20 });

test("stacks panel children vertically with padding and gaps", () => {
    const root = panel("root", [
        leaf("a", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } }),
        leaf("b", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } })
    ]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 100 }, fixedMeasure);
    const a = rects.get("a");
    const b = rects.get("b");
    assert.equal(a.y, 4);
    assert.equal(a.height, 10);
    assert.equal(b.y, a.y + a.height + 4);
    assert.equal(a.width, 92); // 100 - 2*padding
});

test("fill-height children share remaining space equally", () => {
    const root = panel("root", [
        leaf("fixed", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } }),
        leaf("fillA", { layout: { width: { mode: "fill" }, height: { mode: "fill" } } }),
        leaf("fillB", { layout: { width: { mode: "fill" }, height: { mode: "fill" } } })
    ]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 100 }, fixedMeasure);
    // total height 100, padding 4+4=8, fixed 10, 2 gaps of 4 = 8 -> remaining 74, split into 2 => 37 each
    assert.equal(rects.get("fillA").height, 37);
    assert.equal(rects.get("fillB").height, 37);
});

test("radioGroup lays its children out in a row using their intrinsic width", () => {
    const root = { id: "group", type: "radioGroup", layout: { width: { mode: "auto" }, height: { mode: "auto" } }, children: [leaf("x"), leaf("y")] };
    const { rects } = computeGenericLayout(root, { width: 200, height: 40 }, fixedMeasure);
    const x = rects.get("x");
    const y = rects.get("y");
    assert.equal(x.y, y.y);
    assert.equal(y.x, x.x + x.width + 4);
    assert.equal(x.width, 40);
});

test("an auto-height container sizes to the sum of its children", () => {
    const inner = panel("inner", [leaf("a"), leaf("b")], { width: { mode: "fill" }, height: { mode: "auto" } });
    const root = panel("root", [inner]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 200 }, fixedMeasure);
    // inner intrinsic height = padding(8) + 2*leafHeight(20) + gap(4) = 52
    assert.equal(rects.get("inner").height, 52);
});

test("leaf nodes with no children are placed but not recursed into", () => {
    const root = panel("root", [leaf("only")]);
    const { rects } = computeGenericLayout(root, { width: 50, height: 50 }, fixedMeasure);
    assert.ok(rects.has("only"));
    assert.equal(rects.size, 2);
});
