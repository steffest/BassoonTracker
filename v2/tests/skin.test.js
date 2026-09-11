import { test } from "node:test";
import assert from "node:assert/strict";
import { compileSkin } from "../compiler/skin.js";
import { compileApplication } from "../compiler/convert.js";
import { parseYamlDocument } from "../compiler/yaml.js";
import { BUILTIN_SKIN, lookupStyle, resolveStateAsset, styleStateName, styleLayoutDefaults, STYLE_STATES } from "../runtime/skinModel.js";

// Spec 008: the skin document compiles to a model that traces every visual
// state to one source PNG, expands `extends`, and reports what it could not
// resolve without ever failing the compile.

function compile(text, { listAssets, name = "default" } = {}) {
    const diagnostics = [];
    const { root, errors } = parseYamlDocument(text, `skin/${name}.yaml`);
    assert.deepEqual(errors, [], "fixture must be parseable");
    const skin = compileSkin({
        name,
        file: `skin/${name}.yaml`,
        root,
        addDiagnostic: (severity, code, message, file, range) => diagnostics.push({ severity, code, message, file, range }),
        listAssets
    });
    return { skin, diagnostics, codes: diagnostics.map(d => d.code) };
}

const MINIMAL = `name: default
description: Two variants sharing one base.
fonts:
  small:
    asset: font
    charWidth: 6
    charHeight: 6
styles:
  button:
    default:
      description: Base button.
      insets: 5
      width: 80
      height: 24
      label:
        align: center
        pressedOffset: 1
      states:
        normal: button_inlay
        pressed: button_inlay_active
    play:
      extends: default
      description: Play button.
      states:
        hover: button_hover_green
        active: button_inlay_green
`;

test("compiles styles, expands extends and marks inherited states", () => {
    const { skin, diagnostics } = compile(MINIMAL);
    assert.deepEqual(diagnostics, [], "a complete document produces no diagnostics");
    assert.equal(skin.name, "default");
    assert.equal(skin.mode, "loose", "development loads the individual PNGs");
    assert.equal(skin.description, "Two variants sharing one base.");

    const play = skin.styles.button.play;
    assert.equal(play.extends, "default");
    assert.equal(play.width, 80, "unspecified properties come from the base");
    assert.deepEqual(play.insets, { left: 5, top: 5, right: 5, bottom: 5 });
    assert.deepEqual(play.label, { align: "center", offsetX: 0, offsetY: 0, pressedOffset: 1, font: "small" });
    assert.equal(play.states.normal.asset, "button_inlay");
    assert.equal(play.states.normal.inherited, true, "inherited from the base");
    assert.equal(play.states.hover.asset, "button_hover_green");
    assert.equal(play.states.hover.inherited, false, "authored on this variant");
    assert.equal(play.states.hover.source.file, "skin/default.yaml");
    assert.ok(play.states.hover.source.range.start.line > 0);
});

test("an asset name traces to one source PNG and to every line that referenced it", () => {
    const { skin } = compile(MINIMAL);
    const inlay = skin.assets.find(a => a.name === "button_inlay");
    assert.equal(inlay.file, "src/button_inlay.png");
    assert.equal(inlay.usedBy.length, 1, "referenced once, by button/default normal");
    assert.equal(inlay.usedBy[0].file, "skin/default.yaml");
    assert.ok(inlay.usedBy[0].range.start.line > 0);
    assert.deepEqual(skin.assets.map(a => a.name).sort(), ["button_hover_green", "button_inlay", "button_inlay_active", "button_inlay_green", "font"]);
    for (const asset of skin.assets) assert.match(asset.file, /^src\/[a-z0-9_]+\.png$/i);
});

test("reports artwork with no source file without failing", () => {
    const { skin, codes, diagnostics } = compile(MINIMAL, { listAssets: () => ["font", "button_inlay"] });
    assert.equal(codes.filter(c => c === "unknown-skin-asset").length, 3, "button_inlay_active, button_hover_green and button_inlay_green are missing");
    assert.ok(diagnostics.every(d => d.severity === "warning"), "missing artwork never fails a build");
    assert.ok(diagnostics.every(d => d.range && d.file === "skin/default.yaml"), "each is located at the line that named it");
    assert.equal(skin.styles.button.default.states.pressed.asset, "button_inlay_active", "the reference is kept so the workbench can show it");
    assert.equal(skin.assets.find(a => a.name === "button_inlay_active").missing, true);
});

test("reports unknown states, unknown properties and a broken extends, and keeps the rest", () => {
    const { skin, codes } = compile(`name: default
styles:
  button:
    default:
      description: Base.
      wobble: 3
      states:
        normal: button_inlay
        sideways: button_inlay
    odd:
      extends: nothingHere
      label:
        colour: red
      states:
        normal: button_inlay
`);
    assert.ok(codes.includes("unknown-style-state"), "sideways is not a visual state");
    assert.ok(codes.includes("unknown-style-property"), "wobble and label.colour are not properties");
    assert.ok(codes.includes("unresolved-style-extends"), "nothingHere is not a variant of button");
    assert.ok(codes.includes("missing-skin-font"), "no fonts authored: the built-in one is used");
    assert.equal(skin.styles.button.default.states.normal.asset, "button_inlay", "valid content survives");
    assert.equal(skin.styles.button.odd.states.normal.asset, "button_inlay");
    assert.equal(skin.styles.button.odd.extends, "nothingHere", "the authored value is preserved as provenance");
    assert.equal(skin.fonts.small.charWidth, 6);
});

test("reports a self-referential extends chain instead of recursing", () => {
    const { skin, codes } = compile(`name: default
styles:
  button:
    a:
      extends: b
      states:
        normal: button_inlay
    b:
      extends: a
      states:
        pressed: button_inlay_active
`);
    assert.ok(codes.includes("unresolved-style-extends"));
    assert.ok(skin.styles.button.a && skin.styles.button.b);
});

test("a type with variants but no default falls back to the built-in style", () => {
    const { skin, codes } = compile(`name: default
styles:
  button:
    fancy:
      states:
        normal: button_inlay
`);
    assert.ok(codes.includes("missing-style-default"));
    assert.equal(skin.styles.button.default.builtin, true);
    assert.equal(lookupStyle(skin, "button", "nope").resolvedVariant, "default");
    assert.equal(lookupStyle(skin, "button", "fancy").found, true);
});

test("insets accept a single number or per-side keys", () => {
    const { skin } = compile(`name: default
styles:
  panel:
    default:
      insets:
        left: 1
        top: 2
        right: 3
        bottom: 4
      states:
        normal: panel_dark
`);
    assert.deepEqual(skin.styles.panel.default.insets, { left: 1, top: 2, right: 3, bottom: 4 });
});

test("resolveStateAsset follows the documented chain and only tints a stand-in", () => {
    const { skin } = compile(MINIMAL);
    const play = skin.styles.button.play;

    const hover = resolveStateAsset(play, { hover: true });
    assert.equal(hover.asset, "button_hover_green");
    assert.equal(hover.fallbackFrom, null);
    assert.deepEqual(hover.effects, [], "its own artwork needs no tint");

    const activeHover = resolveStateAsset(play, { active: true, hover: true });
    assert.equal(activeHover.state, "active_hover");
    assert.equal(activeHover.asset, "button_inlay_green", "falls back to the active artwork");
    assert.equal(activeHover.fallbackFrom, "active");
    assert.deepEqual(activeHover.effects, ["hoverTint"], "only the hover aspect is missing");

    const activePressed = resolveStateAsset(play, { active: true, pressed: true });
    assert.equal(activePressed.asset, "button_inlay_active", "the pressed artwork wins over the active one");
    assert.deepEqual(activePressed.effects, ["activeWash"]);

    const disabled = resolveStateAsset(play, { disabled: true });
    assert.equal(disabled.asset, "button_inlay");
    assert.deepEqual(disabled.effects, ["dim"]);

    const base = skin.styles.button.default;
    assert.deepEqual(resolveStateAsset(base, { hover: true }).effects, ["hoverTint"]);
    assert.deepEqual(resolveStateAsset(base, { pressed: true }).effects, [], "pressed has its own artwork");
    assert.deepEqual(resolveStateAsset(base, { active: true }).effects, ["activeWash"]);
    assert.equal(resolveStateAsset(base, "normal").asset, "button_inlay");

    const empty = { states: {} };
    const none = resolveStateAsset(empty, { hover: true });
    assert.equal(none.asset, null, "no artwork at all is reported, not invented");
    assert.equal(none.from, null);
});

test("styleStateName maps interaction flags to one state name", () => {
    assert.equal(styleStateName({}), "normal");
    assert.equal(styleStateName({ hover: true }), "hover");
    assert.equal(styleStateName({ pressed: true }), "pressed");
    assert.equal(styleStateName({ active: true }), "active");
    assert.equal(styleStateName({ active: true, hover: true }), "active_hover");
    assert.equal(styleStateName({ active: true, pressed: true }), "active_pressed");
    assert.equal(styleStateName({ disabled: true, active: true, hover: true }), "disabled", "disabled wins");
    for (const state of STYLE_STATES) assert.ok(resolveStateAsset(BUILTIN_SKIN.styles.button.default, state).state === state);
});

test("style sizes become the layout defaults for a fixed dimension", () => {
    const { skin } = compile(MINIMAL);
    const defaults = styleLayoutDefaults(skin);
    assert.deepEqual(defaults.button, { width: 80, height: 24 }, "authored sizes win");
    // Types the document says nothing about keep the built-in sizes, so a
    // half-authored skin still answers "fixed" for every supported type.
    assert.deepEqual(defaults.panel, styleLayoutDefaults(BUILTIN_SKIN).panel);
    assert.deepEqual(styleLayoutDefaults(BUILTIN_SKIN).panel, { height: 28 });
});

test("a missing skin document warns and falls back to the built-in skin", () => {
    const files = {
        "app.yaml": "app:\n  skin: nosuch\n  ui:\n    main:\n      type: panel\n      content:\n        - type: button\n          label: Go\n"
    };
    const result = compileApplication("app.yaml", path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null));
    assert.equal(result.hardFailure, false, "artwork can never break the application");
    assert.equal(result.diagnostics.filter(d => d.code === "missing-skin").length, 1);
    assert.equal(result.skin.builtin, true);
    assert.equal(result.skin.mode, "atlas", "the built-in skin reads the legacy sprite sheet");
    assert.equal(result.root.children[0].style.variant, "default");
});

test("a component names its style with variant or the style alias, and an unknown one warns", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: button",
            "          label: Play",
            "          variant: play",
            "        - type: button",
            "          label: Rec",
            "          style: play",
            "        - type: button",
            "          label: Nope",
            "          variant: doesNotExist",
            ""
        ].join("\n"),
        "skin/default.yaml": MINIMAL
    };
    const result = compileApplication("app.yaml", path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null));
    const [play, alias, unknown] = result.root.children;
    assert.equal(play.style.variant, "play");
    assert.equal(play.style.requested, "play");
    assert.equal(play.style.source.file, "app.yaml", "the line that asked for it is recorded");
    assert.equal(play.style.definition.file, "skin/default.yaml", "and so is where it is defined");
    assert.equal(alias.style.variant, "play", "`style:` is accepted as an alias of `variant:`");
    assert.equal(unknown.style.variant, "default", "an unknown variant draws with default");
    assert.equal(unknown.style.requested, "doesNotExist");
    const warning = result.diagnostics.find(d => d.code === "unknown-style-variant");
    assert.ok(warning && warning.message.includes("doesNotExist"));
    assert.equal(warning.severity, "warning");
    assert.ok(warning.range, "located at the line that named it");
});

test("a radioGroup variant chooses the style its items are drawn with", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: radioGroup",
            "          variant: buttons",
            "          items:",
            "            - name: one",
            "            - name: two",
            "              variant: default",
            ""
        ].join("\n"),
        "skin/default.yaml": `name: default
styles:
  radioGroup:
    default:
      itemStyle: default
    buttons:
      extends: default
      itemStyle: bold
  radioItem:
    default:
      states:
        normal: button_inlay
    bold:
      extends: default
      states:
        active: button_inlay_green
`
    };
    const result = compileApplication("app.yaml", path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null));
    const group = result.root.children[0];
    assert.equal(group.style.variant, "buttons");
    assert.equal(group.children[0].style.variant, "bold", "the group's itemStyle cascades to its items");
    assert.equal(group.children[0].style.inheritedFrom, "group");
    assert.equal(group.children[1].style.variant, "default", "an item may still name its own variant");
    assert.equal(group.children[1].style.inheritedFrom, null);
    assert.ok(!result.diagnostics.some(d => d.code === "unknown-style-variant"));
});
