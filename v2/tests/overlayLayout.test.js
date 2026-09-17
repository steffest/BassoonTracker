import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";
import { COMPONENT_TYPES } from "../runtime/componentTypes.js";

// Spec 020: the one new mechanism this cluster needs - an overlay's presence
// becomes a runtime fact (`options.overlayOpen`) instead of always being
// present the way spec 013/015's own throwaway test type was, and an overlay
// can be positioned against another node's rect (`node.anchor`) instead of
// always being centred.

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };
function node(type, id, layout = {}, children = [], extra = {}) {
    return { id, type, definitionName: id, labelVariants: [id], layout: { ...AUTO, ...layout }, children, bindings: [], supported: true, source: null, ...extra };
}
const measure = () => ({ width: 40, height: 10 });

function withOverlayType(name, entry, run) {
    COMPONENT_TYPES[name] = entry;
    try { return run(); } finally { delete COMPONENT_TYPES[name]; }
}
const OVERLAY_TYPE = {
    description: "A throwaway overlay type for spec 020's layout tests.",
    implemented: true, container: { childrenIn: "content" }, styled: false,
    interactive: false, selection: null, direction: "column",
    layer: "overlay", modal: true, draw: "none", authoredIn: null, properties: {}
};

test("overlayOpen defaults to true, keeping every pre-020 caller's behaviour", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testOverlay020", "popup", { width: { mode: "fixed", size: 80 }, height: { mode: "fixed", size: 40 } })
        ]);
        const { overlays, rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.deepEqual(overlays, ["popup"]);
        assert.ok(rects.get("popup"));
    });
});

test("a closed overlay (overlayOpen returns false) is absent from overlays, rects and clips - it and its subtree", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testOverlay020", "popup", {}, [node("label", "inside")])
        ]);
        const { overlays, rects, clips } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, {
            overlayOpen: () => false
        });
        assert.deepEqual(overlays, [], "not reported as an active overlay");
        assert.equal(rects.get("popup"), undefined);
        assert.equal(clips.get("popup"), undefined);
        assert.equal(rects.get("inside"), undefined, "its subtree gets no rect either");
        assert.ok(rects.get("root"), "the rest of the tree is laid out as normal");
    });
});

test("overlayOpen is evaluated per node, so one overlay can be open while a sibling is closed", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testOverlay020", "open"),
            node("testOverlay020", "closed")
        ]);
        const { overlays } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, {
            overlayOpen: n => n.id === "open"
        });
        assert.deepEqual(overlays, ["open"]);
    });
});

test("an overlay with no anchor is still centred, exactly as spec 013 left it", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testOverlay020", "popup", { width: { mode: "fixed", size: 80 }, height: { mode: "fixed", size: 40 } })
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.deepEqual(rects.get("popup"), { x: 60, y: 30, width: 80, height: 40 });
    });
});

test("an anchored overlay positions below its target, and flips above when below would overflow", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const below = node("panel", "root", { height: { mode: "fill" } }, [
            node("panel", "trigger", { width: { mode: "fixed", size: 40 }, height: { mode: "fixed", size: 20 } }),
            node("testOverlay020", "popup", { width: { mode: "fixed", size: 60 }, height: { mode: "fixed", size: 30 } }, [], { anchor: { targetId: "trigger", edge: "below" } })
        ]);
        const { rects } = computeGenericLayout(below, { width: 200, height: 100 }, measure);
        const trigger = rects.get("trigger");
        assert.deepEqual(rects.get("popup"), { x: trigger.x, y: trigger.y + trigger.height, width: 60, height: 30 });

        // Now put the trigger near the bottom of a short viewport, so "below" overflows.
        const flipped = node("panel", "root", { height: { mode: "fill" } }, [
            node("panel", "spacer", { height: { mode: "fixed", size: 60 } }),
            node("panel", "trigger", { width: { mode: "fixed", size: 40 }, height: { mode: "fixed", size: 20 } }),
            node("testOverlay020", "popup", { width: { mode: "fixed", size: 60 }, height: { mode: "fixed", size: 30 } }, [], { anchor: { targetId: "trigger", edge: "below" } })
        ]);
        const result = computeGenericLayout(flipped, { width: 200, height: 100 }, measure);
        const flippedTrigger = result.rects.get("trigger");
        const popup = result.rects.get("popup");
        assert.equal(popup.y, flippedTrigger.y - 30, "flipped above, since below would run past the viewport");
    });
});

test("an anchored overlay's cross axis is clamped so it never runs off either side", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        // A row layout puts the trigger far enough right that anchoring a
        // wide popup at its exact x would run off the right edge.
        const tree = node("panel", "root", { height: { mode: "fill" }, direction: "row" }, [
            node("panel", "spacer", { width: { mode: "fixed", size: 150 } }),
            node("panel", "trigger", { width: { mode: "fixed", size: 20 }, height: { mode: "fixed", size: 20 } }),
            node("testOverlay020", "popup", { width: { mode: "fixed", size: 150 }, height: { mode: "fixed", size: 30 } }, [], { anchor: { targetId: "trigger", edge: "below" } })
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        const popup = rects.get("popup");
        assert.equal(popup.x, 200 - 150, "shifted left just enough to stay inside the viewport");
        assert.ok(popup.x >= 0 && popup.x + popup.width <= 200);
    });
});

test("right/left anchoring swaps the axes the same way", () => {
    withOverlayType("testOverlay020", OVERLAY_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" }, width: { mode: "fixed", size: 200 } }, [
            node("panel", "trigger", { width: { mode: "fixed", size: 40 }, height: { mode: "fixed", size: 20 } }),
            node("testOverlay020", "flyout", { width: { mode: "fixed", size: 60 }, height: { mode: "fixed", size: 30 } }, [], { anchor: { targetId: "trigger", edge: "right" } })
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        const trigger = rects.get("trigger");
        const flyout = rects.get("flyout");
        assert.equal(flyout.x, trigger.x + trigger.width, "opens to the right when it fits");
        assert.equal(flyout.y, trigger.y);
    });
});
