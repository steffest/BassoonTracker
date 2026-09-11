import { test } from "node:test";
import assert from "node:assert/strict";
import { panel, button, radioGroup, radioItem, label, ensureIds } from "../runtime/components.js";
import { createAppState } from "../runtime/appState.js";

test("constructors produce renderer-shaped nodes with comma label variants and function hooks", () => {
    const predicate = () => true;
    const activate = () => {};
    const node = button({ id: "x", label: "instrument, instr, ins, i", shortKey: "F5", highlightedWhen: predicate, onActivate: activate });
    assert.equal(node.type, "button");
    assert.deepEqual(node.labelVariants, ["instrument", "instr", "ins", "i"]);
    assert.equal(node.shortKey, "F5");
    assert.equal(node.highlightedWhen, predicate);
    assert.equal(node.onActivate, activate);
    assert.deepEqual(node.layout, { width: { mode: "auto" }, height: { mode: "auto" } });
    assert.equal(node.supported, true);
    assert.deepEqual(node.bindings, []);
    const withLayout = panel({ id: "p", layout: { width: { mode: "fill" }, resizable: "horizontal" } }, [node]);
    assert.deepEqual(withLayout.layout, { width: { mode: "fill" }, height: { mode: "auto" }, resizable: "horizontal" });
    assert.equal(withLayout.children[0], node);
    assert.equal(label({ label: ["a", "b"] }).labelVariants.join(","), "a,b");
    assert.deepEqual(radioItem({ name: "song" }).labelVariants, ["song"], "name is the label fallback");
    assert.equal(radioGroup({}).children.length, 0);
});

test("ensureIds mirrors the compiler identity rule and suffixes collisions", () => {
    const root = panel({ name: "main" }, [
        panel({ name: "bar" }, [button({ label: "Play" }), button({ label: "Play" }), radioGroup({}, [radioItem({ name: "song" })])])
    ]);
    ensureIds(root);
    assert.equal(root.id, "main");
    assert.equal(root.children[0].id, "main.bar");
    assert.deepEqual(root.children[0].children.map(c => c.id), ["main.bar.button.Play", "main.bar.button.Play#2", "main.bar.radioGroup"]);
    assert.equal(root.children[0].children[2].children[0].id, "main.bar.radioGroup.song");
    // explicit ids are preserved and idempotent
    const again = ensureIds(root);
    assert.equal(again.children[0].children[1].id, "main.bar.button.Play#2");
});

test("createAppState adds whole-store change notifications on top of the spec-003 store", () => {
    const state = createAppState({ "a.b": 1, c: false });
    const seen = [];
    const off = state.onAnyChange((path, value) => seen.push([path, value]));
    let fieldSeen = 0;
    state.subscribe("a.b", () => { fieldSeen += 1; });
    state.set("a.b", 2);
    state.set("a.b", 2);
    state.set("c", true);
    assert.deepEqual(seen, [["a.b", 2], ["c", true]]);
    assert.equal(fieldSeen, 1);
    assert.deepEqual(state.getState(), { "a.b": 2, c: true });
    off();
    state.set("c", false);
    assert.equal(seen.length, 2);
    assert.throws(() => state.set("unknown", 1), /unknown field/);
});
