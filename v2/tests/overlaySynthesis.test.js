import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeOverlayChildren } from "../runtime/overlaySynthesis.js";
import { ensureIds, component } from "../runtime/components.js";

// Spec 020: a dropdown's popup and a modal dialog's OK/Cancel/input are not
// authored - v1's own constructors build them; this is the equivalent pure
// restructuring pass, run once per mount. Pure inputs/outputs, no DOM.

test("a dropdown's items are lifted into a synthesized dropdownPopup child, sharing its field", () => {
    const tree = ensureIds(component("dropdown", { name: "sample" }, [
        component("label", { name: "one" }),
        component("label", { name: "two" })
    ]));
    synthesizeOverlayChildren(tree);

    assert.equal(tree.children.length, 1, "the dropdown's sole child is now the popup");
    const popup = tree.children[0];
    assert.equal(popup.type, "dropdownPopup");
    assert.equal(popup.children.length, 2, "the original items moved, not copied-and-kept");
    assert.equal(popup.children[0].definitionName, "one");
    assert.ok(tree.field, "a field is assigned even when not authored");
    assert.equal(popup.field, tree.field, "the popup shares the exact same field as its owning dropdown");
});

test("a dropdown's own authored field is preserved and shared, not overwritten", () => {
    const tree = ensureIds(component("dropdown", { name: "sample", field: "chosen.sample" }, [component("label", { name: "one" })]));
    synthesizeOverlayChildren(tree);
    assert.equal(tree.field, "chosen.sample");
    assert.equal(tree.children[0].field, "chosen.sample");
});

test("a modalDialog gets exactly the synthetic children its ok/cancel/input declare, in order", () => {
    const none = ensureIds(component("modalDialog", { name: "plain" }));
    synthesizeOverlayChildren(none);
    assert.deepEqual(none.children, [], "no ok/cancel/input declared, so no synthetic children");

    const full = ensureIds(component("modalDialog", { name: "confirm", ok: "yes", cancel: "yes", input: "yes" }));
    synthesizeOverlayChildren(full);
    assert.equal(full.children.length, 3);
    assert.equal(full.children[0].type, "button");
    assert.equal(full.children[0].dialogResult, "ok");
    assert.equal(full.children[1].type, "button");
    assert.equal(full.children[1].dialogResult, "cancel");
    assert.equal(full.children[2].type, "inputbox");
    assert.ok(full.children[2].field, "the input has somewhere to write its value");
});

test("a modalDialog with only ok gets only an ok button, appended after any authored content", () => {
    const tree = ensureIds(component("modalDialog", { name: "notice", ok: "yes" }, [component("label", { name: "message" })]));
    synthesizeOverlayChildren(tree);
    assert.equal(tree.children.length, 2);
    assert.equal(tree.children[0].definitionName, "message", "authored content stays first");
    assert.equal(tree.children[1].dialogResult, "ok");
});

test("a plain panel is left untouched", () => {
    const tree = ensureIds(component("panel", { name: "root" }, [component("label", { name: "a" })]));
    const before = JSON.stringify(tree);
    synthesizeOverlayChildren(tree);
    assert.equal(JSON.stringify(tree), before);
});

test("synthesis recurses into nested containers", () => {
    const tree = ensureIds(component("panel", { name: "root" }, [
        component("dropdown", { name: "nested" }, [component("label", { name: "item" })])
    ]));
    synthesizeOverlayChildren(tree);
    const dropdown = tree.children[0];
    assert.equal(dropdown.children[0].type, "dropdownPopup");
});

// Spec 023: a menu's own top-level items, and a submenu's own nested items,
// are wrapped into a synthesized menuTrigger whenever their authored type is
// itself submenu - the same "one authored node becomes two" idea, run in the
// opposite direction from a dropdown's popup.

test("a menu's submenu-typed items are each wrapped into a menuTrigger, anchored below (menu is a row)", () => {
    const tree = ensureIds(component("menu", { name: "bar" }, [
        component("submenu", { name: "file", label: "File" }, [component("label", { name: "new" })]),
        component("label", { name: "about" })
    ]));
    synthesizeOverlayChildren(tree);

    assert.equal(tree.children.length, 2, "still one child per authored item");
    const [file, about] = tree.children;
    assert.equal(file.type, "menuTrigger", "the submenu-typed item is wrapped");
    assert.equal(file.popupEdge, "below", "menu's own items open below - it is a row");
    assert.deepEqual(file.labelVariants, ["File"], "the trigger shows the original item's own label");
    assert.equal(file.children.length, 1);
    assert.equal(file.children[0].type, "submenu", "the original node is kept, unchanged, as the trigger's synthesized child");
    assert.equal(file.children[0].children[0].definitionName, "new", "its own authored items are untouched");
    assert.equal(about.type, "label", "an item that is not itself a submenu is left exactly as authored");
});

test("a submenu's own submenu-typed items are wrapped too, anchored to the right (a submenu is a column)", () => {
    const tree = ensureIds(component("submenu", { name: "edit" }, [
        component("label", { name: "cut" }),
        component("submenu", { name: "clear", label: "Clear" }, [component("label", { name: "clearTrack" })])
    ]));
    synthesizeOverlayChildren(tree);

    const [cut, clear] = tree.children;
    assert.equal(cut.type, "label", "a plain command item is untouched");
    assert.equal(clear.type, "menuTrigger");
    assert.equal(clear.popupEdge, "right", "nested inside a column-oriented submenu");
    assert.equal(clear.children[0].type, "submenu");
    assert.equal(clear.children[0].children[0].definitionName, "clearTrack", "recursion reaches the doubly-nested item");
});

test("a menuTrigger's own id is derived from the wrapped node's, so it cannot collide", () => {
    const tree = ensureIds(component("menu", { name: "bar" }, [component("submenu", { name: "file" }, [])]));
    synthesizeOverlayChildren(tree);
    const trigger = tree.children[0];
    assert.equal(trigger.id, `${trigger.children[0].id}.trigger`);
});
