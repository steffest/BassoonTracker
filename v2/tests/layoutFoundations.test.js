import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";
import { hitTestPoint } from "../runtime/hitTest.js";
import { COMPONENT_TYPES } from "../runtime/componentTypes.js";

// Spec 013: clipping, scroll viewports, the overlay layer and authored
// direction. All pure geometry, so it is tested without a canvas.
//
// The overlay and modal fields have no component type using them yet
// (dropdown, menu, modalDialog and tooltip are package P5), so these tests
// declare a throwaway type the way a future package would, and remove it
// again. That keeps the mechanism honest without inventing a type this spec
// does not deliver.

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };

function node(type, id, layout = {}, children = [], extra = {}) {
    return {
        id,
        type,
        definitionName: id,
        labelVariants: [id],
        layout: { ...AUTO, ...layout },
        children,
        bindings: [],
        supported: true,
        source: null,
        ...extra
    };
}

// Every leaf is 40 x 10 unless it says otherwise, which keeps the sums easy.
const measure = () => ({ width: 40, height: 10 });

function withType(name, entry, run) {
    COMPONENT_TYPES[name] = entry;
    try {
        return run();
    } finally {
        delete COMPONENT_TYPES[name];
    }
}

test("every node gets a clip, and only a clipping type narrows it", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("label", "a"),
        node("panel", "inner", {}, [node("label", "b")])
    ]);
    const { clips, rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);

    assert.deepEqual(clips.get("root"), { x: 0, y: 0, width: 200, height: 100 }, "the root's clip is the viewport");
    assert.deepEqual(clips.get("a"), clips.get("root"), "a panel does not clip, so its children inherit the viewport");
    assert.deepEqual(clips.get("b"), clips.get("root"));
    assert.ok(rects.get("b"), "and every node still has a rect");
});

test("a viewport clips its content to its own box", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("viewport", "scroller", { height: { mode: "fixed", size: 30 } }, [
            node("label", "one"),
            node("label", "two"),
            node("label", "three"),
            node("label", "four")
        ])
    ]);
    const { clips, rects, extents } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);

    const box = rects.get("scroller");
    assert.equal(box.height, 30);
    assert.deepEqual(clips.get("scroller"), box, "the viewport clips to itself");
    assert.deepEqual(clips.get("one"), box, "and its children are clipped to it");

    // Four 10px rows with 4px gaps: 10*4 + 4*3 = 52, taller than the box.
    // The width is the viewport's own inner width: 200 less the root panel's
    // padding, less the viewport's own.
    assert.deepEqual(extents.get("scroller"), { width: 184, height: 52 });
    assert.ok(rects.get("four").y + rects.get("four").height > box.y + box.height, "the last row overflows, rather than being shrunk to fit");
});

test("a viewport offsets its content by its bound field, clamped to the content", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("viewport", "scroller", { height: { mode: "fixed", size: 30 } }, [
            node("label", "one"),
            node("label", "two"),
            node("label", "three"),
            node("label", "four")
        ], { field: "list.scroll" })
    ]);
    const viewport = { width: 200, height: 100 };

    const unscrolled = computeGenericLayout(tree, viewport, measure);
    const scrolled = computeGenericLayout(tree, viewport, measure, { scrollOffset: () => 20 });
    assert.equal(scrolled.rects.get("one").y, unscrolled.rects.get("one").y - 20, "content moves up by the offset");
    assert.equal(scrolled.offsets.get("scroller"), 20);

    const overscrolled = computeGenericLayout(tree, viewport, measure, { scrollOffset: () => 9999 });
    const maximum = 52 - (30 - 8); // content height minus the padded box
    assert.equal(overscrolled.offsets.get("scroller"), maximum, "an absurd offset is clamped, so the content cannot be lost");

    const negative = computeGenericLayout(tree, viewport, measure, { scrollOffset: () => -50 });
    assert.equal(negative.offsets.get("scroller"), 0);
});

test("a clipped-away control cannot be hit where it is not visible", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("viewport", "scroller", { height: { mode: "fixed", size: 20 } }, [
            node("button", "visible"),
            node("button", "hidden")
        ])
    ]);
    const { rects, clips } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
    const order = ["root", "scroller", "visible", "hidden"].map(id => ({ id, rect: rects.get(id), clip: clips.get(id) }));

    const visible = rects.get("visible");
    assert.equal(hitTestPoint(order, { x: visible.x + 2, y: visible.y + 2 }), "visible");

    // The second row starts past the 20px box, so its rect lies outside its
    // clip. The sample point is a few pixels in, because the clip's bounds are
    // inclusive and its very first row of pixels still counts as inside.
    const hidden = rects.get("hidden");
    const box = rects.get("scroller");
    assert.ok(hidden.y + hidden.height > box.y + box.height, "the second row really does extend past the viewport edge");
    // The click falls through to whatever really is visible there, which is
    // the panel behind the viewport, and never to the clipped-away control.
    assert.equal(hitTestPoint(order, { x: hidden.x + 2, y: hidden.y + 6 }), "root", "the click lands on what is visible there");
});

test("an overlay is laid out against the viewport, not against its parent", () => {
    withType("testOverlay", {
        description: "A throwaway overlay type for the layout tests.",
        implemented: true, container: { childrenIn: "content" }, styled: false,
        interactive: false, selection: null, direction: "column",
        layer: "overlay", draw: "none", authoredIn: null, properties: {}
    }, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("panel", "small", { height: { mode: "fixed", size: 20 } }, [
                node("testOverlay", "popup", { width: { mode: "fixed", size: 80 }, height: { mode: "fixed", size: 40 } }, [node("label", "inside")])
            ])
        ]);
        const { rects, clips, overlays } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);

        assert.deepEqual(overlays, ["popup"], "the overlay is reported separately from the flow");
        const popup = rects.get("popup");
        assert.deepEqual(popup, { x: 60, y: 30, width: 80, height: 40 }, "centred in the viewport");
        assert.ok(popup.height > rects.get("small").height, "and free of its parent's 20px box");
        assert.deepEqual(clips.get("popup"), { x: 0, y: 0, width: 200, height: 100 }, "clipped only by the viewport");
        assert.ok(rects.get("inside"), "its own children are laid out inside it");
    });
});

test("overlays are reported in declared order, which is their paint order", () => {
    withType("testOverlay", {
        description: "A throwaway overlay type for the layout tests.",
        implemented: true, container: null, styled: false, interactive: false,
        selection: null, direction: null, layer: "overlay", draw: "none",
        authoredIn: null, properties: {}
    }, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testOverlay", "first"),
            node("label", "content"),
            node("testOverlay", "second")
        ]);
        const { overlays, rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.deepEqual(overlays, ["first", "second"]);
        assert.ok(rects.get("content"), "the flow content is still laid out");
        assert.equal(rects.get("content").y, 4, "and the overlays took no space in it");
    });
});

test("authored direction wins over the type's, which wins over the fixed-height rule", () => {
    const children = () => [node("label", "a"), node("label", "b")];

    // Pre-013 rule: a fixed-height container reads as a row.
    const byRule = computeGenericLayout(
        node("panel", "root", { height: { mode: "fixed", size: 30 } }, children()),
        { width: 200, height: 100 }, measure
    );
    assert.equal(byRule.rects.get("a").y, byRule.rects.get("b").y, "side by side");

    // Authored direction overrides it.
    const authored = computeGenericLayout(
        node("panel", "root", { height: { mode: "fixed", size: 60 }, direction: "column" }, children()),
        { width: 200, height: 100 }, measure
    );
    assert.notEqual(authored.rects.get("a").y, authored.rects.get("b").y, "stacked");
    assert.equal(authored.rects.get("a").x, authored.rects.get("b").x);

    // A radioGroup declares "row" in the registry, so it is a row even with an
    // auto height, where the fixed-height rule would have said column.
    const declared = computeGenericLayout(
        node("radioGroup", "group", {}, [node("radioItem", "one"), node("radioItem", "two")]),
        { width: 200, height: 100 }, measure
    );
    assert.equal(declared.rects.get("one").y, declared.rects.get("two").y);
});

test("the layout result is complete for every node, so no caller walks ancestors", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("viewport", "scroller", { height: { mode: "fixed", size: 40 } }, [node("label", "deep")])
    ]);
    const { rects, clips } = computeGenericLayout(tree, { width: 120, height: 80 }, measure);
    for (const id of ["root", "scroller", "deep"]) {
        assert.ok(rects.get(id), `${id} has a rect`);
        assert.ok(clips.get(id), `${id} has a clip`);
    }
});
