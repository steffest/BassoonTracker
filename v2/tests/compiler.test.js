import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function realReadFile(relPath) {
    try {
        return readFileSync(join(CURRENT, relPath), "utf8");
    } catch {
        return null;
    }
}

function memoryReadFile(files) {
    return path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null);
}

function flatten(node, out = []) {
    out.push(node);
    node.children.forEach(child => flatten(child, out));
    return out;
}

function diagnosticCounts(diagnostics) {
    const counts = {};
    diagnostics.forEach(d => { counts[d.code] = (counts[d.code] || 0) + 1; });
    return counts;
}

test("compiles the real app.yaml graph into a supported tree with source-located warnings", () => {
    const result = compileApplication("app.yaml", realReadFile);
    assert.equal(result.hardFailure, false);

    // The application source is authored continuously, so this asserts the
    // *kinds* of finding the compiler must produce for it and locates each
    // subject by name - not how many of each the current draft happens to
    // have. Exact-count assertions live in the in-memory cases below.
    const counts = diagnosticCounts(result.diagnostics);
    const messages = result.diagnostics.map(d => d.message);
    assert.ok(!counts["yaml-syntax-error"], "no syntax errors expected from the current source tree");
    assert.ok(!counts["missing-skin"], "app.yaml names a skin document that exists");
    assert.ok(counts["unresolved-action-reference"] >= 2, "action1/action2 have no action file");
    assert.ok(messages.some(m => m.includes('"action1"')) && messages.some(m => m.includes('"action2"')));
    assert.equal(counts["unresolved-component-reference"], 1, "volumemeter has no component file");
    assert.ok(messages.some(m => m.includes('"volumemeter"')));
    assert.ok(counts["unsupported-component"] >= 3, "menu and both notification lights are not yet rendered");
    assert.ok(messages.some(m => m.includes('type "menu"')), "the menu is reported by type");
    assert.ok(counts["unresolved-rule"] >= 2, "both notification prose rules are unresolved");
    assert.equal(counts["ambiguous-duplicate-name"], 1, "both notification lights share the same authored key");

    for (const diagnostic of result.diagnostics) {
        assert.equal(typeof diagnostic.severity, "string");
        assert.equal(typeof diagnostic.code, "string");
        assert.equal(typeof diagnostic.message, "string");
        assert.ok(diagnostic.file, "every diagnostic names a source file");
    }

    const nodes = flatten(result.root);
    const byId = new Map(nodes.map(n => [n.id, n]));

    assert.equal(byId.get("main").type, "panel");
    assert.equal(byId.get("main.controlBar").supported, true);
    assert.equal(byId.get("main.controlBar.button.Play").type, "button");
    assert.deepEqual(byId.get("main.controlBar.button.Play").labelVariants, ["Play"]);
    const playBindings = byId.get("main.controlBar.button.Play").bindings;
    assert.equal(playBindings.some(b => b.command === "transport.toggle"), true);

    // Regression: `{ origin: "rule", ...result.binding }` must not let the
    // recipe's own `kind` (e.g. "visual-state") silently erase `origin` -
    // both the workbench's "contributing rules" panel and interact-mode
    // mock dispatch key off `origin`, not `kind`.
    const ruleBinding = playBindings.find(b => b.code === "highlighted-when-active");
    // The visual-state rule and the toggle action must meet on one mock
    // field, or Interact mode could never make the Play highlight follow the
    // Play command (Phase 4 regression).
    const playAction = playBindings.find(b => b.origin === "action");
    assert.equal(ruleBinding.mockField, playAction.mockField);
    assert.equal(ruleBinding.activeValue, "playing");
    assert.ok(playAction.mockValues.includes(ruleBinding.activeValue));
    assert.equal(ruleBinding.origin, "rule");
    assert.equal(ruleBinding.kind, "visual-state");
    const actionBinding = playBindings.find(b => b.code === "toggle-play-state");
    assert.equal(actionBinding.origin, "action");
    assert.equal(actionBinding.kind, "command");

    const recordNode = nodes.find(n => n.type === "button" && (n.labelVariants || []).includes("record"));
    const recordRule = recordNode.bindings.find(b => b.kind === "visual-state");
    assert.equal(recordRule.mockField, "record.active");
    assert.equal(recordRule.activeValue, true);

    // spec 008: every styled node resolves to a skin style, and a node that
    // names a variant keeps the source range of the line that named it.
    assert.equal(result.skin.name, "default");
    assert.equal(result.skin.mode, "loose");
    assert.deepEqual(byId.get("main.controlBar.button.Play").style.type, "button");
    assert.equal(byId.get("main.controlBar.button.Play").style.variant, "play");
    assert.equal(byId.get("main.controlBar.button.Play").style.source.file, "components/controlBar.yaml");
    assert.equal(byId.get("main.controlBar.button.record").style.variant, "record");
    assert.equal(byId.get("main").style.variant, "default");
    assert.equal(byId.get("main.statusBar.label.main status").style.type, "label");
    for (const node of nodes) {
        if (node.supported === false) continue;
        if (node.type === "radioGroup" || ["panel", "button", "radioItem", "label"].includes(node.type)) {
            assert.ok(node.style, `${node.id} (${node.type}) resolves to a style`);
            assert.ok(result.skin.styles[node.style.type][node.style.variant], `${node.id} names a style the skin defines`);
        }
    }
    // Every asset the skin references exists as a source PNG, and the state
    // that names it keeps its source range.
    for (const asset of result.skin.assets) {
        assert.match(asset.file, /^src\/.+\.png$/);
        assert.ok(asset.usedBy.length >= 1);
        assert.ok(asset.usedBy.every(use => use.file === "skin/default.yaml" && use.range));
    }

    assert.equal(byId.get("main.top.menu").supported, false);
    assert.equal(byId.get("main.top.volume meter").supported, false);
    assert.equal(byId.get("main.statusBar.label.main status").labelVariants.join(" "), "main status");
    assert.equal(byId.get("main.songProperties").layout.resizable, "horizontal");

    // Both notification lights collide on the same authored key and get a
    // deterministic occurrence suffix rather than being silently merged.
    const notificationIds = [...byId.keys()].filter(id => id.includes("notification light"));
    assert.deepEqual(notificationIds.sort(), [
        "main.top.notifications.notification light#1",
        "main.top.notifications.notification light#2"
    ]);
});

test("is deterministic: compiling the same source twice yields identical output", () => {
    const first = compileApplication("app.yaml", realReadFile);
    const second = compileApplication("app.yaml", realReadFile);
    assert.deepEqual(first.root, second.root);
    assert.deepEqual(first.diagnostics, second.diagnostics);
});

test("keeps previewing supported content when a component reference is unresolved", () => {
    const files = {
        "app.yaml": "app:\n  ui:\n    main:\n      type: panel\n      content:\n        - missingWidget\n        - widget:\n            type: label\n"
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.hardFailure, false);
    const [placeholder, supported] = result.root.children;
    assert.equal(placeholder.supported, false);
    assert.equal(placeholder.definitionName, "missingWidget");
    assert.equal(supported.supported, true);
    assert.equal(result.diagnostics.some(d => d.code === "unresolved-component-reference"), true);
});

// --- spec 009: the component registry ----------------------------------

test("an unknown key on a leaf component is reported as a property mistake, not a child", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: button",
            "          label: Play",
            "          labell: Playy",
            "          shortKey: Enter",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.hardFailure, false);
    const button = result.root.children[0];
    assert.equal(button.type, "button");
    assert.deepEqual(button.children, [], "the mistyped key did not become a child node");

    const warnings = result.diagnostics.filter(d => d.code === "unknown-component-property");
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].severity, "warning");
    assert.match(warnings[0].message, /"button" has no property "labell"/);
    assert.match(warnings[0].message, /it accepts .*shortKey/, "the message lists what the type does accept");
    assert.equal(warnings[0].range.start.line, 8, "located at the key itself");
    assert.ok(!result.diagnostics.some(d => d.code === "unresolved-component-reference"), "and not misreported as a missing component");
});

test("a container's other keys stay named child slots", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      color: yellow",
            "      statusBar:",
            "        type: label",
            "        label: ready",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.ok(!result.diagnostics.some(d => d.code === "unknown-component-property"), "color is a panel property and statusBar is a child");
    assert.equal(result.root.children.length, 1);
    assert.equal(result.root.children[0].definitionName, "statusBar");
    assert.equal(result.root.color, "yellow");
});

test("a declared type reads differently from an unregistered one", () => {
    // `menu` is the standing example of a type whose contract is recorded
    // before it can be drawn; `slider` is implemented, and carries its own
    // declared property. Both are read from the registry, so the only thing
    // this test pins is the *rule*, not which types happen to be finished.
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: menu",
            "        - type: slider",
            "          min: 1",
            "        - type: doesNotExist",
            "          label: Nope",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const [declared, implemented, unknown] = result.root.children;
    assert.equal(declared.supported, false, "a declared type is still not rendered until it is implemented");
    assert.equal(implemented.supported, true);
    assert.equal(unknown.supported, false);
    const messages = result.diagnostics.filter(d => d.code === "unsupported-component").map(d => d.message);
    assert.ok(messages.some(m => /"menu" is declared but not rendered yet/.test(m)));
    assert.ok(messages.some(m => /"doesNotExist" is not a registered component type/.test(m)));
    assert.ok(!result.diagnostics.some(d => d.code === "unknown-component-property"), "min is part of the slider's declared contract");
    assert.equal(implemented.min, 1, "and it reaches the node");
    assert.equal(declared.style, undefined, "artwork is not resolved for a type that is not drawn");
});

test("a type registered by spec 009 compiles with no compiler change", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: checkbox",
            "          label: Show key input",
            "          rule: highlighted when key input is active",
            ""
        ].join("\n"),
        "skin/default.yaml": [
            "name: default",
            "styles:",
            "  checkbox:",
            "    default:",
            "      states:",
            "        normal: checkbox_off",
            "        active: checkbox_on",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const checkbox = result.root.children[0];
    assert.equal(checkbox.supported, true);
    assert.equal(checkbox.style.type, "checkbox");
    assert.equal(checkbox.style.variant, "default");
    assert.equal(result.skin.styles.checkbox.default.states.normal.asset, "checkbox_off");
    assert.ok(checkbox.bindings.some(b => b.kind === "visual-state"), "its on state comes from a rule, like any other control");
    assert.ok(!result.diagnostics.some(d => d.code === "unsupported-component" || d.code === "unknown-component-property"));
});

test("reports a reference cycle as an error instead of recursing forever", () => {
    const files = {
        "app.yaml": "app:\n  ui:\n    main:\n      type: panel\n      content:\n        - cycleA\n",
        "components/cycleA.yaml": "name: cycleA\ntype: panel\ncontent:\n  - cycleB\n",
        "components/cycleB.yaml": "name: cycleB\ntype: panel\ncontent:\n  - cycleA\n"
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.hardFailure, false);
    assert.equal(result.diagnostics.some(d => d.code === "reference-cycle"), true);
});

test("a malformed app.yaml is a hard failure with no tree, not a partial mount", () => {
    const files = { "app.yaml": "app:\n  ui:\n main:\n      type: panel\n" };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.hardFailure, true);
    assert.equal(result.root, null);
    assert.ok(result.diagnostics.length > 0);
    assert.equal(result.diagnostics[0].severity, "error");
});

test("splits comma-separated labels into ordered variants on every labeled node type", () => {
    const files = {
        "app.yaml": "app:\n  ui:\n    main:\n      type: panel\n      content:\n        - type: button\n          label: instrument, instr, ins, i\n"
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.deepEqual(result.root.children[0].labelVariants, ["instrument", "instr", "ins", "i"]);
});
