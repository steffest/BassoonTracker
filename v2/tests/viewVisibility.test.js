import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 025: `visibleWhen` - the second of control panel prerequisites spec
// 022 named, generalizing v1's EVENT.showView view-routing (four independent
// listeners, each owning its own region, switching on a shared vocabulary of
// view-name strings) to a plain state-gated visibility any node can declare,
// rather than a fixed set of named regions. A node whose `visibleWhen` does
// not match the current state is absent from layout entirely - no rect, no
// clip, and (by construction, since nothing downstream ever sees a rect for
// it) no draw and no hit - exactly like a closed overlay or a collapsed
// container's content already are.

const AUTO = { width: { mode: "auto" }, height: { mode: "auto" } };
function node(type, id, layout = {}, children = [], extra = {}) {
    return { id, type, definitionName: id, labelVariants: [id], layout: { ...AUTO, ...layout }, children, bindings: [], supported: true, source: null, ...extra };
}
const measure = () => ({ width: 40, height: 10 });

test("a node whose visibleWhen field does not match is absent from layout entirely - it and its subtree", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "diskOps", {}, [node("label", "loadButton")], { visibleWhen: { field: "view.top", oneOf: ["diskop_load", "diskop_save"] } })
    ]);
    const hidden = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => "main" });
    assert.equal(hidden.rects.get("diskOps"), undefined);
    assert.equal(hidden.rects.get("loadButton"), undefined, "its own children get no rect either");

    const shown = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => "diskop_load" });
    assert.ok(shown.rects.get("diskOps"));
    assert.ok(shown.rects.get("loadButton"));
});

test("with no stateValueOf supplied at all, visibleWhen never matches (the field reads as undefined)", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("label", "a", {}, [], { visibleWhen: { field: "view.top", oneOf: ["main"] } })
    ]);
    const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure);
    assert.equal(rects.get("a"), undefined);
});

test("a node with no visibleWhen at all is unaffected - the pre-025 case", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [node("label", "a")]);
    const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => "anything" });
    assert.ok(rects.get("a"));
});

test("visibleWhen is resolved per node, so two siblings gated on the same field can show independently", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "top", {}, [], { visibleWhen: { field: "view.top", oneOf: ["main", "topmain"] } }),
        node("panel", "diskOps", {}, [], { visibleWhen: { field: "view.top", oneOf: ["diskop_load"] } })
    ]);
    const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: field => (field === "view.top" ? "topmain" : undefined) });
    assert.ok(rects.get("top"), "\"topmain\" is one of top's own oneOf values");
    assert.equal(rects.get("diskOps"), undefined, "but not one of diskOps's");
});

test("independent regions (v1's own top/bottom split) compose from two separate fields", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "topRegion", {}, [], { visibleWhen: { field: "view.top", oneOf: ["main"] } }),
        node("panel", "bottomRegion", {}, [], { visibleWhen: { field: "view.bottom", oneOf: ["main"] } })
    ]);
    const values = { "view.top": "options", "view.bottom": "main" };
    const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: f => values[f] });
    assert.equal(rects.get("topRegion"), undefined, "the top region switched away from main");
    assert.ok(rects.get("bottomRegion"), "the bottom region is untouched by the top region's own state");
});

test("an invisible node does not reserve space: a visible sibling still gets the full container", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("panel", "box", { height: { mode: "fixed", size: 30 }, direction: "column" }, [
            node("label", "hidden", { height: { mode: "fixed", size: 20 } }, [], { visibleWhen: { field: "v", oneOf: ["yes"] } }),
            node("label", "shown", { height: { mode: "fill" } })
        ])
    ]);
    const { rects } = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => "no" });
    assert.equal(rects.get("hidden"), undefined);
    // The visible label alone fills the column's inner height (30 - 2*4 padding).
    assert.equal(rects.get("shown").height, 22);
});

// Spec 062: a real, confirmed bug found while placing the piano's own
// piano.active-gated panel. compiler/yaml.js has no boolean/number literal
// type at all - every scalar is a plain string, so `oneOf: [true]` compiles
// to the string "true", not the JS boolean true. A field driven by a real
// capability (domain/settings#applyToggle's own `next`, e.g. piano.active)
// can genuinely hold a JS boolean, unlike a generated mock's own
// string-labeled toggle - so the live value must be coerced to a string
// before comparing. nibbles-info-visible.value (spec 049) has had this
// identical, previously untested shape since it was authored.
test("visibleWhen matches a real JS boolean value against a string oneOf entry (oneOf: [true] compiles to the string \"true\")", () => {
    const tree = node("panel", "root", { height: { mode: "fill" } }, [
        node("label", "a", {}, [], { visibleWhen: { field: "piano.active", oneOf: ["true"] } })
    ]);
    const hidden = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => false });
    assert.equal(hidden.rects.get("a"), undefined);

    const shown = computeGenericLayout(tree, { width: 200, height: 100 }, measure, { stateValueOf: () => true });
    assert.ok(shown.rects.get("a"), "a real boolean true matches the string \"true\" oneOf entry");
});
