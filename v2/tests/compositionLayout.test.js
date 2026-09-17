import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";
import { COMPONENT_TYPES } from "../runtime/componentTypes.js";

// Spec 021: the one new mechanism this cluster needs - a container whose
// children are conditionally absent from layout, for two non-overlay cases.
// A tabPanel shows exactly one item's subtree (`activeTab`); a collapsible
// container shows all of its children or none (`collapsed`). Both reuse the
// same "no rect at all" effect spec 020's closed overlay already has.

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };
function node(type, id, layout = {}, children = [], extra = {}) {
    return { id, type, definitionName: id, labelVariants: [id], layout: { ...AUTO, ...layout }, children, bindings: [], supported: true, source: null, ...extra };
}
const measure = () => ({ width: 40, height: 10 });

function withType(name, entry, run) {
    COMPONENT_TYPES[name] = entry;
    try { return run(); } finally { delete COMPONENT_TYPES[name]; }
}
const TABBED_TYPE = {
    description: "A throwaway tabbed type for spec 021's layout tests.",
    implemented: true, container: { childrenIn: "items" }, styled: false,
    interactive: true, selection: null, direction: "column",
    tabHeader: { height: 20 }, draw: "none", authoredIn: null, properties: {}
};
const COLLAPSIBLE_TYPE = {
    description: "A throwaway collapsible type for spec 021's layout tests.",
    implemented: true, container: { childrenIn: "content" }, styled: false,
    interactive: true, selection: null, direction: "column",
    collapsible: true, draw: "none", authoredIn: null, properties: {}
};

// --- tabPanel-like layout ----------------------------------------------------

test("only the active item's subtree gets a rect; every other item gets none at all", () => {
    withType("testTabs021", TABBED_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testTabs021", "tabs", { height: { mode: "fixed", size: 80 } }, [
                node("panel", "one", {}, [node("label", "oneLabel")]),
                node("panel", "two", {}, [node("label", "twoLabel")]),
                node("panel", "three", {}, [node("label", "threeLabel")])
            ])
        ]);
        const { rects, clips } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { activeTab: () => 1 });
        assert.ok(rects.get("two"), "the active item has a rect");
        assert.ok(rects.get("twoLabel"), "and so do its own children");
        assert.equal(rects.get("one"), undefined, "an inactive item has no rect");
        assert.equal(rects.get("oneLabel"), undefined, "nor do its children");
        assert.equal(rects.get("three"), undefined);
        assert.ok(clips.get("two"), "the active item still gets a clip");
        assert.equal(clips.get("one"), undefined);
    });
});

test("the active item is laid out below the reserved header strip", () => {
    withType("testTabs021", TABBED_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testTabs021", "tabs", { height: { mode: "fixed", size: 80 } }, [
                node("panel", "one", { height: { mode: "fill" } })
            ])
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { activeTab: () => 0 });
        const tabs = rects.get("tabs");
        const one = rects.get("one");
        assert.equal(tabs.height, 80);
        assert.equal(one.y, tabs.y + 20, "below the 20px header this throwaway type declares");
        assert.equal(one.height, 60, "filling the remaining height");
    });
});

test("activeTab defaults to 0, and an out-of-range or negative index clamps to a valid one", () => {
    withType("testTabs021", TABBED_TYPE, () => {
        const tree = node("testTabs021", "tabs", { width: { mode: "fixed", size: 200 }, height: { mode: "fixed", size: 80 } }, [
            node("panel", "a"), node("panel", "b"), node("panel", "c")
        ]);
        const noOption = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.ok(noOption.rects.get("a"), "defaults to the first item with no activeTab option at all");

        const negative = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { activeTab: () => -5 });
        assert.ok(negative.rects.get("a"), "a negative index clamps to the first item");

        const tooFar = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { activeTab: () => 99 });
        assert.ok(tooFar.rects.get("c"), "an out-of-range index clamps to the last item");
    });
});

test("a tabbed node with no items lays out cleanly (no crash, no rects to give)", () => {
    withType("testTabs021", TABBED_TYPE, () => {
        const tree = node("testTabs021", "empty", { width: { mode: "fixed", size: 200 }, height: { mode: "fixed", size: 80 } }, []);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.ok(rects.get("empty"), "the tabbed node itself still gets a rect");
    });
});

// --- collapsible layout -------------------------------------------------------

test("a collapsed container's children get no rect at all; the container's own rect is unaffected", () => {
    withType("testCollapse021", COLLAPSIBLE_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testCollapse021", "section", { height: { mode: "fixed", size: 60 } }, [node("label", "body")])
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { collapsed: () => true });
        assert.ok(rects.get("section"), "the container itself keeps its own authored rect");
        assert.equal(rects.get("section").height, 60);
        assert.equal(rects.get("body"), undefined, "its content has no rect while collapsed");
    });
});

test("collapsed defaults to false, so content lays out normally with no collapsed option at all", () => {
    withType("testCollapse021", COLLAPSIBLE_TYPE, () => {
        const tree = node("testCollapse021", "section", { height: { mode: "fixed", size: 60 } }, [node("label", "body")]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
        assert.ok(rects.get("body"), "not collapsed by default, matching v1's own always-showing behaviour");
    });
});

test("collapsed is evaluated per node, so one collapsible sibling can be collapsed while another is not", () => {
    withType("testCollapse021", COLLAPSIBLE_TYPE, () => {
        const tree = node("panel", "root", { height: { mode: "fill" } }, [
            node("testCollapse021", "open", {}, [node("label", "openBody")]),
            node("testCollapse021", "shut", {}, [node("label", "shutBody")])
        ]);
        const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { collapsed: n => n.id === "shut" });
        assert.ok(rects.get("openBody"));
        assert.equal(rects.get("shutBody"), undefined);
    });
});
