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
    // The real menu bar (spec 023's prerequisite work made this authorable)
    // has plenty of commands no recipe covers yet ("new file", "show
    // options", ...); this only pins that they are reported, not which ones.
    // Spec 063 resolved three of these (randomSong/randomSongXM/randomPlayList
    // via a new "random" verb-action verb), lowering the threshold here from
    // 10 - a real, expected drop, not a regression.
    assert.ok(counts["unresolved-action-reference"] >= 7, "the menu bar's own commands have no action file or matching recipe yet");
    assert.ok(messages.some(m => m.includes('"newFile"')) && messages.some(m => m.includes('"undo"')));
    // Spec 054: components/volumemeter.yaml now exists, resolving what was
    // this suite's own one standing unresolved-component-reference.
    assert.ok(!counts["unresolved-component-reference"], "volumemeter now has a component file (spec 054)");
    assert.ok(counts["unsupported-component"] >= 2, "both notification lights are not yet rendered");
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
    assert.equal(byId.get("main.normalMainView.patternSection.patternSectionDefault.infoBar.song title").style.type, "label");
    for (const node of nodes) {
        if (node.supported === false) continue;
        if (node.type === "radioGroup" || ["panel", "button", "radioItem", "label"].includes(node.type)) {
            assert.ok(node.style, `${node.id} (${node.type}) resolves to a style`);
            assert.ok(result.skin.styles[node.style.type][node.style.variant], `${node.id} names a style the skin defines`);
        }
    }
    // Every asset the skin references exists as a source PNG, and the state
    // that names it keeps its source range. Spec 071: an image/icon node's
    // own src/icon (compiler/convert.js's own registerImageAssetUses) is
    // also a real "use," authored in whichever component file the node
    // itself lives in - not skin/default.yaml, the only file every use
    // could come from before any image/icon node was ever placed.
    for (const asset of result.skin.assets) {
        assert.match(asset.file, /^src\/.+\.png$/);
        assert.ok(asset.usedBy.length >= 1);
        assert.ok(asset.usedBy.every(use => /\.yaml$/.test(use.file) && use.range));
    }

    assert.equal(byId.get("main.top.menu").supported, true, "menu is implemented as of spec 023");
    assert.equal(byId.get("main.top.menu.submenu.File").type, "submenu", "a menu item authored as type: submenu compiles as a real child node");
    // Spec 024: the real menu bar, read from script/src/ui/app/menu.js -
    // File/Edit/View/Help, with Edit's own "Clear" nested a level deeper.
    for (const label of ["File", "Edit", "View", "Help"]) {
        assert.equal(byId.get(`main.top.menu.submenu.${label}`).type, "submenu", label);
    }
    const clear = byId.get("main.top.menu.submenu.Edit.submenu.Clear");
    assert.equal(clear.type, "submenu", "Clear is itself a nested submenu, two levels under the menu bar");
    assert.deepEqual(clear.children.map(c => c.bindings[0].command), ["track.clear", "pattern.clear", "song.clear", "instruments.clear"]);
    // Clear Track/Pattern share the exact command names editPad.yaml's own
    // buttons already use (spec 022), so both authored places run the same
    // generated action module, not two parallel ones.
    assert.equal(byId.get("main.top.menu.submenu.Edit.submenu.Clear.label.Clear Track").bindings[0].command, "track.clear");
    // Spec 054: components/volumemeter.yaml now exists, so this resolves to
    // a real node - under its own authored name, not the "volume meter"
    // slot key it is referenced by.
    assert.equal(byId.get("main.top.volumemeter").supported, true);
    assert.equal(byId.get("main.normalMainView.patternSection.patternSectionDefault.infoBar.button.More info").labelVariants.join(" "), "More info");
    assert.equal(byId.get("main.normalMainView.songProperties").layout.resizable, "horizontal");

    // Spec 025's two control-panel prerequisites, put to real use for the
    // first time: controlBar's own breakpoint (a declared, not hand-written,
    // cascade) and the song-properties switch/optionsPanel's visibleWhen
    // pair (the generalized replacement for v1's EVENT.showView). Spec
    // 070's own UI-alignment pass (step 6) replaced the original single,
    // mutually-exclusive topViewGroup radioGroup with three independent
    // toggle buttons, matching v1's own real three-Checkboxbutton shape
    // (confirmed live: File Operations and Sample Edit can both be open at
    // once, which one shared radioGroup command could never express).
    assert.deepEqual(byId.get("main.controlBar").breakpoints, [{ maxWidth: 650, layout: { height: { mode: "fixed", size: 160 }, direction: "column" } }]);
    const commandOf = node => node.bindings.find(b => b.kind === "command");
    const fileOperationsButton = byId.get("main.controlBar.topViewButtons.fileOperationsButton");
    assert.equal(commandOf(fileOperationsButton).command, "file-operations-view.toggle");
    const optionsButton = byId.get("main.controlBar.topViewButtons.optionsButton");
    assert.equal(commandOf(optionsButton).command, "options-view.toggle");
    const sampleEditButton = byId.get("main.controlBar.topViewButtons.sampleEditButton");
    assert.equal(commandOf(sampleEditButton).command, "sample-edit-panel.toggle");
    assert.deepEqual(byId.get("main.normalMainView.songProperties.optionsPanel").visibleWhen, { field: "song-properties-view.value", oneOf: ["Options"] }, "shown only when explicitly chosen - not by default (fixed for real visual parity with v1, which opens with no control-panel section shown at all)");
    assert.deepEqual(byId.get("main.normalMainView.songProperties.fileOperationsPanel").visibleWhen, { field: "song-properties-view.value", oneOf: ["File Operations"] });
    assert.deepEqual(byId.get("main.normalMainView.songProperties.nibblesPanel").visibleWhen, { field: "song-properties-view.value", oneOf: ["Nibbles"] });
    assert.deepEqual(byId.get("main.normalMainView.patternSection.sampleEditPanel").visibleWhen, { field: "pattern-section-view.value", oneOf: ["Sample Edit"] });

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
    // `tooltip` (the component type, not spec 015's plain-text hover
    // mechanism) is a standing example of a type whose contract is recorded
    // before it can be drawn; `slider` is implemented, and carries its own
    // declared property. Both are read from the registry, so the only thing
    // this test pins is the *rule*, not which types happen to be finished -
    // `menu` was this example before spec 023 promoted it.
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: tooltip",
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
    assert.ok(messages.some(m => /"tooltip" is declared but not rendered yet/.test(m)));
    assert.ok(messages.some(m => /"doesNotExist" is not a registered component type/.test(m)));
    assert.ok(!result.diagnostics.some(d => d.code === "unknown-component-property"), "min is part of the slider's declared contract");
    assert.equal(implemented.min, 1, "and it reaches the node");
    assert.equal(declared.style, undefined, "artwork is not resolved for a type that is not drawn");
});

test("spec 016: a declared-but-not-drawn type still checks its contract, not only menu", () => {
    // CAT-002: the unknown-property diagnostic has to work for one of the
    // still-placeholder types (spec 027 promoted numberDisplay to
    // implemented, so this now uses scrollbar, proving the mechanism is
    // general rather than something that happens to be wired up for one
    // particular type.
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: scrollbar",
            "          field: sample.name",
            "          selectedIndex: 0",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const scrollbar = result.root.children[0];
    assert.equal(scrollbar.supported, false, "declared but not implemented");
    assert.equal(scrollbar.field, "sample.name", "the declared property still reaches the node");
    const warnings = result.diagnostics.filter(d => d.code === "unknown-component-property");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /"scrollbar" has no property "selectedIndex"/);
    assert.match(warnings[0].message, /it accepts .*field/, "the message lists scrollbar's actual contract");
});

test("spec 020: submenu's items compile as real child nodes with their own bindings, unlike menu's item-actions-only shape", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: submenu",
            "          items:",
            "            - type: label",
            "              label: Open",
            "              actions:",
            "                - click: toggleplay",
            "            - type: label",
            "              label: Quit",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const submenu = result.root.children[0];
    assert.equal(submenu.supported, true, "implemented as of spec 020");
    assert.equal(submenu.children.length, 2, "items are real children, not merged into the submenu's own bindings");
    assert.equal(submenu.children[0].labelVariants[0], "Open");
    assert.equal(submenu.bindings.length, 0, "unlike menu's placeholder shape, the container itself carries no item bindings");
    // The item's own `actions:` is resolved against *its own* node, proving
    // it is a real per-item node rather than menu's collapsed-onto-the-
    // parent shape - "toggleplay" has no supporting actions/ file in this
    // minimal fixture, so it stays unresolved, but the diagnostic still
    // names the item's own id, not the submenu's.
    const unresolved = result.diagnostics.find(d => d.code === "unresolved-action-reference");
    assert.ok(unresolved, "the item's actions: was actually looked at");
    assert.equal(unresolved.nodeId, submenu.children[0].id, "attributed to the item, not the submenu container");
});

test("spec 021: buttonGroup's items are independent, full-treatment nodes, unlike radioGroup's forced-childType shape", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: buttonGroup",
            "          items:",
            "            - type: button",
            "              label: Play",
            "              actions:",
            "                - click: toggleplay",
            "            - type: button",
            "              label: Stop",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const group = result.root.children[0];
    assert.equal(group.supported, true, "implemented as of spec 021");
    assert.equal(group.children.length, 2, "items are real children");
    assert.equal(group.children[0].type, "button", "each item keeps whatever type it was authored as, unlike radioGroup forcing radioItem");
    assert.equal(group.bindings.length, 0, "the group itself carries no item bindings");
    const unresolved = result.diagnostics.find(d => d.code === "unresolved-action-reference");
    assert.equal(unresolved.nodeId, group.children[0].id, "the item's own actions: is attributed to the item, not the group");
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
