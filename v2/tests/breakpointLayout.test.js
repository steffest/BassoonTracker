import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 025: a declared breakpoint mechanism - the first of control panel
// prerequisites spec 022 named - replacing v1's hand-written per-pixel
// cascade (script/src/ui/app/layout.js) with `node.breakpoints`, a compiled
// `{ maxWidth, layout }` list the layout pass merges onto a node's own
// layout when the viewport is at or under that width. Pure geometry, tested
// the same way spec 013/021's own layout mechanisms are.

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };
function node(type, id, layout = {}, children = [], extra = {}) {
    return { id, type, definitionName: id, labelVariants: [id], layout: { ...AUTO, ...layout }, children, bindings: [], supported: true, source: null, ...extra };
}
const measure = () => ({ width: 40, height: 10 });

test("a breakpoint's layout override applies once the viewport is at or under its maxWidth", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "bar", { height: { mode: "fixed", size: 40 } }, [], {
            breakpoints: [{ maxWidth: 650, layout: { height: { mode: "fixed", size: 80 } } }]
        })
    ]);
    const wide = computeGenericLayout(tree, { width: 900, height: 200 }, measure);
    assert.equal(wide.rects.get("bar").height, 40, "above the threshold, the node's own layout applies unchanged");

    const narrow = computeGenericLayout(tree, { width: 600, height: 200 }, measure);
    assert.equal(narrow.rects.get("bar").height, 80, "at or under maxWidth, the breakpoint's override wins");
});

test("exactly at maxWidth counts as matching (\"at or under\"), one pixel above does not", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "bar", { height: { mode: "fixed", size: 40 } }, [], {
            breakpoints: [{ maxWidth: 650, layout: { height: { mode: "fixed", size: 80 } } }]
        })
    ]);
    assert.equal(computeGenericLayout(tree, { width: 650, height: 200 }, measure).rects.get("bar").height, 80);
    assert.equal(computeGenericLayout(tree, { width: 651, height: 200 }, measure).rects.get("bar").height, 40);
});

test("the narrowest matching breakpoint wins, mirroring v1's own cascade narrowing further at smaller widths", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "bar", { height: { mode: "fixed", size: 40 } }, [], {
            breakpoints: [
                { maxWidth: 820, layout: { height: { mode: "fixed", size: 60 } } },
                { maxWidth: 650, layout: { height: { mode: "fixed", size: 80 } } },
                { maxWidth: 512, layout: { height: { mode: "fixed", size: 100 } } }
            ]
        })
    ]);
    assert.equal(computeGenericLayout(tree, { width: 900, height: 200 }, measure).rects.get("bar").height, 40, "wider than every breakpoint");
    assert.equal(computeGenericLayout(tree, { width: 800, height: 200 }, measure).rects.get("bar").height, 60, "only the 820 one matches");
    assert.equal(computeGenericLayout(tree, { width: 600, height: 200 }, measure).rects.get("bar").height, 80, "820 and 650 both match; 650 is narrower and wins");
    assert.equal(computeGenericLayout(tree, { width: 400, height: 200 }, measure).rects.get("bar").height, 100, "all three match; 512 is narrowest");
});

test("a breakpoint only overrides the fields it authored, leaving the rest of the node's own layout alone", () => {
    const tree = node("panel", "root", { height: { mode: "fill" }, direction: "row" }, [
        node("panel", "a", { width: { mode: "fixed", size: 40 }, height: { mode: "fixed", size: 20 } }, [], {
            breakpoints: [{ maxWidth: 650, layout: { direction: "column" } }]
        })
    ]);
    const narrow = computeGenericLayout(tree, { width: 600, height: 200 }, measure);
    const rect = narrow.rects.get("a");
    assert.equal(rect.width, 40, "width untouched - the breakpoint only named direction");
    assert.equal(rect.height, 20, "height untouched too");
});

test("no breakpoints (the pre-025 case) behaves exactly as before", () => {
    const tree = node("panel", "root", { height: { mode: "fixed", size: 30 } }, [node("label", "a"), node("label", "b")]);
    const { rects } = computeGenericLayout(tree, { width: 300, height: 100 }, measure);
    assert.equal(rects.get("a").y, rects.get("b").y, "a fixed-height container still reads as a row by default");
});

test("a breakpoint's own direction override is what a viewport-width-dependent row/column switch needs", () => {
    // The shape the control panel itself will eventually want: two rows of
    // buttons above a width threshold, one row below it.
    const tree = node("panel", "controlBar", { height: { mode: "fixed", size: 40 } }, [node("button", "a"), node("button", "b")], {
        breakpoints: [{ maxWidth: 650, layout: { direction: "column" } }]
    });
    const wide = computeGenericLayout(tree, { width: 900, height: 100 }, measure);
    assert.equal(wide.rects.get("a").y, wide.rects.get("b").y, "row above the threshold");
    const narrow = computeGenericLayout(tree, { width: 600, height: 100 }, measure);
    assert.notEqual(narrow.rects.get("a").y, narrow.rects.get("b").y, "column at/under it");
});

// Spec 075: maxHeight alongside maxWidth - v1's own hand-written cascade
// mixes both kinds of threshold freely (the piano section's own real
// `me.height<800`/`me.height<650`), so the mechanism needed a second
// dimension, not a second mechanism.

test("a breakpoint's own maxHeight threshold works the same way maxWidth does, keyed off the viewport's own height", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "piano", { height: { mode: "fixed", size: 200 } }, [], {
            breakpoints: [{ maxHeight: 800, layout: { height: { mode: "fixed", size: 150 } } }]
        })
    ]);
    const tall = computeGenericLayout(tree, { width: 900, height: 900 }, measure);
    assert.equal(tall.rects.get("piano").height, 200, "above the threshold, unchanged");
    const short = computeGenericLayout(tree, { width: 900, height: 800 }, measure);
    assert.equal(short.rects.get("piano").height, 150, "at or under maxHeight, the override wins - width is irrelevant here");
});

test("v1's own real two-step piano cascade (800 then 650) narrows further exactly like a maxWidth cascade does", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "piano", { height: { mode: "fixed", size: 200 } }, [], {
            breakpoints: [
                { maxHeight: 800, layout: { height: { mode: "fixed", size: 150 } } },
                { maxHeight: 650, layout: { height: { mode: "fixed", size: 100 } } }
            ]
        })
    ]);
    assert.equal(computeGenericLayout(tree, { width: 900, height: 900 }, measure).rects.get("piano").height, 200, "taller than every breakpoint");
    assert.equal(computeGenericLayout(tree, { width: 900, height: 700 }, measure).rects.get("piano").height, 150, "only the 800 one matches");
    assert.equal(computeGenericLayout(tree, { width: 900, height: 600 }, measure).rects.get("piano").height, 100, "both match; 650 is the more specific one and wins");
});

test("maxWidth and maxHeight on two different breakpoint entries for the same node combine independently", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "bar", { height: { mode: "fixed", size: 40 }, direction: "row" }, [], {
            breakpoints: [
                { maxWidth: 650, layout: { direction: "column" } },
                { maxHeight: 300, layout: { height: { mode: "fixed", size: 20 } } }
            ]
        })
    ]);
    const wideShort = computeGenericLayout(tree, { width: 900, height: 200 }, measure);
    assert.equal(wideShort.rects.get("bar").height, 20, "the maxHeight breakpoint applies regardless of width");
    const narrowTall = computeGenericLayout(tree, { width: 600, height: 900 }, measure);
    // direction isn't independently assertable from a rect alone here, but confirms neither breakpoint crashes/interferes with the other's own unrelated field.
    assert.equal(narrowTall.rects.get("bar").height, 40, "the maxWidth breakpoint (direction only) leaves height alone");
});
