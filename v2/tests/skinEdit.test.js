import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSkin } from "../compiler/skin.js";
import { parseYamlDocument } from "../compiler/yaml.js";
import { setStateAsset, clearStateAsset, replaceRange } from "../workbench/skinEdit.js";
import { resolveStateAsset } from "../runtime/skinModel.js";

// Spec 008: the Skin tab sets artwork by splicing the exact scalar the
// compiler located, never by re-emitting YAML from a model. These are the
// text edits behind the pickers: comments, key order and unrelated lines must
// survive, and the result must compile back to the intended value.

const DOCUMENT = `name: default
# A comment that must survive every edit.
styles:
  button:
    default:
      description: Base button.
      insets: 5
      states:
        normal: button_inlay
        pressed: button_inlay_active

    play:
      extends: default
      description: Play button.
      states:
        hover: button_hover_green

    bare:
      extends: default
      description: No states of its own.
`;

function compile(text) {
    const { root, errors } = parseYamlDocument(text, "skin/default.yaml");
    assert.deepEqual(errors, [], "fixture must parse");
    return compileSkin({ name: "default", file: "skin/default.yaml", root, addDiagnostic: () => {} });
}

function stateAsset(text, variant, state) {
    const style = compile(text).styles.button[variant];
    return style.states[state] ? style.states[state].asset : null;
}

test("replaces the asset of a state the style declares itself", () => {
    const skin = compile(DOCUMENT);
    const result = setStateAsset(DOCUMENT, skin.styles.button.default, "normal", "button_light");
    assert.equal(result.action, "replaced");
    assert.equal(result.line, 9);
    assert.equal(stateAsset(result.text, "default", "normal"), "button_light");
    assert.equal(stateAsset(result.text, "default", "pressed"), "button_inlay_active", "the sibling state is untouched");
    assert.ok(result.text.includes("# A comment that must survive every edit."));
    assert.equal(result.text.split("\n").length, DOCUMENT.split("\n").length, "no line is added or removed");
    // Only the scalar changed: the rest of the document is byte-identical.
    assert.equal(result.text.replace("button_light", "button_inlay"), DOCUMENT);
});

test("inserts an override into a style's own states block for an inherited state", () => {
    const skin = compile(DOCUMENT);
    const play = skin.styles.button.play;
    assert.equal(play.states.normal.inherited, true, "normal comes from the base");
    const result = setStateAsset(DOCUMENT, play, "normal", "play_green");
    assert.equal(result.action, "inserted");
    assert.equal(stateAsset(result.text, "play", "normal"), "play_green", "the override wins over the inherited value");
    assert.equal(stateAsset(result.text, "default", "normal"), "button_inlay", "the base is not touched");
    assert.equal(stateAsset(result.text, "play", "hover"), "button_hover_green");
    const inserted = result.text.split("\n")[result.line - 1];
    assert.equal(inserted, "        normal: play_green", "indented like its siblings");
});

test("adds a states block to a style that has none", () => {
    const skin = compile(DOCUMENT);
    const result = setStateAsset(DOCUMENT, skin.styles.button.bare, "active", "button_inlay_green");
    assert.equal(result.action, "created-block");
    assert.equal(stateAsset(result.text, "bare", "active"), "button_inlay_green");
    assert.equal(stateAsset(result.text, "bare", "normal"), "button_inlay", "still inherits the rest");
    assert.match(result.text, /    bare:\n      extends: default\n      description: No states of its own\.\n      states:\n        active: button_inlay_green/);
});

test("clearing a state removes the whole line and falls back again", () => {
    const skin = compile(DOCUMENT);
    const result = clearStateAsset(DOCUMENT, skin.styles.button.play, "hover");
    assert.equal(result.action, "removed");
    assert.equal(stateAsset(result.text, "play", "hover"), null, "the override is gone from the style");
    const play = compile(result.text).styles.button.play;
    const hover = resolveStateAsset(play, { hover: true });
    assert.equal(hover.asset, "button_inlay", "drawing falls back through the chain to normal");
    assert.deepEqual(hover.effects, ["hoverTint"], "and the tint comes back with it");
    assert.equal(result.text.split("\n").length, DOCUMENT.split("\n").length - 1);
    assert.ok(!result.text.includes("button_hover_green"));
});

test("clearing an inherited or absent state changes nothing", () => {
    const skin = compile(DOCUMENT);
    assert.deepEqual(clearStateAsset(DOCUMENT, skin.styles.button.play, "normal"), { text: DOCUMENT, action: "unchanged", line: null });
    assert.deepEqual(clearStateAsset(DOCUMENT, skin.styles.button.play, "disabled"), { text: DOCUMENT, action: "unchanged", line: null });
});

test("edits compose: three pickers in a row leave one valid document", () => {
    let text = DOCUMENT;
    for (const [variant, state, asset] of [["default", "normal", "button_light"], ["play", "active", "button_inlay_green"], ["bare", "hover", "button_hover_green"]]) {
        const skin = compile(text);
        text = setStateAsset(text, skin.styles.button[variant], state, asset).text;
    }
    const skin = compile(text);
    assert.equal(skin.styles.button.default.states.normal.asset, "button_light");
    assert.equal(skin.styles.button.play.states.active.asset, "button_inlay_green");
    assert.equal(skin.styles.button.bare.states.hover.asset, "button_hover_green");
    assert.ok(text.includes("# A comment that must survive every edit."));
    assert.deepEqual(parseYamlDocument(text, "skin/default.yaml").errors, []);
});

test("refuses to edit a style with no source location", () => {
    assert.throws(() => setStateAsset(DOCUMENT, { type: "button", variant: "builtin", states: {} }, "normal", "x"), /no source location/);
});

test("refuses a stale source location instead of corrupting the document", () => {
    const skin = compile(DOCUMENT);
    // A buffer that moved on since the generation the ranges came from: the
    // range now spans different text, so the edit must refuse.
    const moved = DOCUMENT.replace("      insets: 5" + String.fromCharCode(10), "");
    assert.throws(() => setStateAsset(moved, skin.styles.button.default, "normal", "button_light"), /stale source location/);
    assert.throws(() => clearStateAsset(moved, skin.styles.button.play, "hover"), /stale source location/);
    // The insertion path checks the shape of the block it appends to.
    const brokenBlock = DOCUMENT.replace("        hover: button_hover_green", "        hover:");
    assert.throws(() => setStateAsset(brokenBlock, skin.styles.button.play, "normal", "play_green"), /stale source location/);
});

test("replaceRange splices exactly the recorded range", () => {
    const text = "a: one\nb: two\n";
    const { root } = parseYamlDocument(text, "x.yaml");
    const range = root.entries[1].valueNode.range;
    assert.equal(replaceRange(text, range, "three"), "a: one\nb: three\n");
});
