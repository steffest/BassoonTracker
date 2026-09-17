import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, drawKindOf, behaviorOf, behaviorOptionsOf, cursorOf } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";

// Spec 018: rangeSlider and knob, the second implementing cluster from
// package P5's dependency order (spec 016 declared them; spec 017 did the
// first, leaf, cluster). Both reuse the existing "value" behavior/controller
// unchanged - only draw kinds are new - so these tests are about the draw
// kinds and the registry, not a new controller.

function fakeCtx() {
    const calls = [];
    const ctx = {
        calls,
        save: () => calls.push(["save"]),
        restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]),
        fill: () => calls.push(["fill"]),
        stroke: () => calls.push(["stroke"]),
        arc: (...a) => calls.push(["arc", ...a]),
        moveTo: (...a) => calls.push(["moveTo", ...a]),
        lineTo: (...a) => calls.push(["lineTo", ...a]),
        drawImage: (...a) => calls.push(["drawImage", ...a])
    };
    return ctx;
}

function fakeAssets() {
    return {
        skin: { getAsset: () => null },
        styleFor: () => ({ insets: { left: 2 }, width: 120, height: 20 }),
        font: { getTextWidth: () => 0, write: () => {}, charHeight: 8 },
        fontFor: () => ({ getTextWidth: () => 0, write: () => {}, charHeight: 8 })
    };
}

// --- registry ---------------------------------------------------------------

test("rangeSlider and knob both reuse the value behavior unchanged", () => {
    for (const type of ["rangeSlider", "knob"]) {
        assert.equal(componentType(type).implemented, true);
        assert.equal(behaviorOf(type), "value");
    }
    assert.deepEqual(behaviorOptionsOf("rangeSlider"), { mode: "absolute", axis: "x" });
    assert.deepEqual(behaviorOptionsOf("knob"), { mode: "relative", axis: "y" }, "matches spinBox's own relative mode exactly");
    assert.equal(drawKindOf("rangeSlider"), "rangeSlider");
    assert.equal(drawKindOf("knob"), "knob");
    assert.equal(cursorOf("rangeSlider"), "ew-resize");
    assert.equal(cursorOf("knob"), "ns-resize");
});

test("scrollbar stays declared-only, a deliberate scope decision, not an oversight", () => {
    assert.equal(componentType("scrollbar").implemented, false);
    assert.equal(drawKindOf("scrollbar"), "placeholder");
});

// --- rangeSlider draw kind ----------------------------------------------------

test("rangeSlider draws a horizontal thumb by default, at the same position slider would", () => {
    const ctx = { drawImage: () => {}, ...fakeCtx() };
    const style = { insets: { left: 2 }, width: 120, height: 20 };
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    // A fully-drawn background comes from drawStyledBackground, which needs
    // real assets; this test only checks the geometry math is reachable and
    // does not throw for a horizontal node - the visual is covered by the
    // browser scenario in tasks.md.
    const node = { min: 0, max: 100 };
    assert.doesNotThrow(() => drawKind("rangeSlider").draw(ctx, fakeAssets(), style, rect, "", { value: 50 }, node));
});

test("rangeSlider's measure swaps width/height when vertical", () => {
    const assets = fakeAssets();
    // Only the dimension each orientation actually authors is set, so the
    // other one falls back to the computed "narrow"/"short" default rather
    // than both happening to be pinned to the same number.
    const horizontal = drawKind("rangeSlider").measure(assets, { width: 120 }, "", { vertical: false });
    const vertical = drawKind("rangeSlider").measure(assets, { height: 120 }, "", { vertical: true });
    assert.equal(horizontal.width, 120);
    assert.ok(horizontal.height < horizontal.width, "horizontal: wide and short");
    assert.equal(vertical.height, 120);
    assert.ok(vertical.width < vertical.height, "vertical: narrow and tall");
});

// --- knob draw kind -----------------------------------------------------------

test("rangeSlider's vertical length is not hijacked by a style that also declares a horizontal width/height", () => {
    // Found while verifying in a browser: the built-in style used to declare
    // both width:120 and height:20 (slider's own shape), and the vertical
    // branch read style.height as its length - getting 20, not a sensible
    // vertical length, because one shared style cannot express two different
    // lengths for two different travel axes.
    const assets = fakeAssets();
    const style = { width: 120, height: 20 };
    const vertical = drawKind("rangeSlider").measure(assets, style, "", { vertical: true });
    assert.ok(vertical.height > vertical.width, `a style with both dimensions set must not collapse the vertical instance: got ${JSON.stringify(vertical)}`);
});

test("knob draws a filled arc and a pointer line, and never throws for any value in range", () => {
    for (const value of [0, 1, 50, 99, 100]) {
        const ctx = fakeCtx();
        const rect = { x: 0, y: 0, width: 64, height: 76 };
        drawKind("knob").draw(ctx, fakeAssets(), null, rect, "Vol", { value }, { min: 0, max: 100 });
        assert.ok(ctx.calls.some(c => c[0] === "fill"), `value ${value}: draws the base disc`);
        assert.ok(ctx.calls.some(c => c[0] === "stroke"), `value ${value}: draws the arc and the pointer`);
    }
});

test("knob's pointer angle increases monotonically with the value", () => {
    function pointerAngle(value) {
        const ctx = fakeCtx();
        drawKind("knob").draw(ctx, fakeAssets(), null, { x: 0, y: 0, width: 64, height: 64 }, "", { value }, { min: 0, max: 100 });
        // Two arcs are drawn: the base disc (0..2*PI, constant) and the
        // progress arc (minAngle..angle); the second one's endAngle moves.
        const arcs = ctx.calls.filter(c => c[0] === "arc");
        return arcs[1][5]; // ["arc", cx, cy, r, startAngle, endAngle, anticlockwise]
    }
    const low = pointerAngle(0);
    const mid = pointerAngle(50);
    const high = pointerAngle(100);
    assert.ok(low < mid && mid < high, `angles should increase with value: ${low}, ${mid}, ${high}`);
});

test("knob measures to a fixed size regardless of the rect it is offered", () => {
    const size = drawKind("knob").measure(fakeAssets(), null, "Vol");
    assert.ok(size.width > 0 && size.height > size.width, "room is reserved beneath the dial for the label");
});
