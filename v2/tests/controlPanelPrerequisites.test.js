import { test } from "node:test";
import assert from "node:assert/strict";
import { compileApplication } from "../compiler/convert.js";
import { UNIVERSAL_PROPERTIES } from "../runtime/componentTypes.js";

// Spec 025: the compiler side of both control-panel prerequisites - parsing
// `breakpoints:` and `visibleWhen:` into the plain data runtime/genericLayout.js
// reads (tests/breakpointLayout.test.js, tests/viewVisibility.test.js cover
// the layout pass itself).

function memoryReadFile(files) {
    return path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null);
}

test("both are declared universal properties, so authoring them is never an unknown-property warning", () => {
    assert.ok(UNIVERSAL_PROPERTIES.breakpoints);
    assert.ok(UNIVERSAL_PROPERTIES.visibleWhen);
});

test("breakpoints: compiles to a partial-override list, sorted or not - the layout pass finds the narrowest match itself", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      layout:",
            "        height: fixed",
            "      breakpoints:",
            "        - maxWidth: 820",
            "          layout:",
            "            width: fill",
            "        - maxWidth: 650",
            "          layout:",
            "            direction: column",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.hardFailure, false);
    assert.deepEqual(result.diagnostics.filter(d => d.severity === "error"), []);
    const main = result.root;
    assert.equal(main.breakpoints.length, 2);
    assert.equal(main.breakpoints[0].maxWidth, 820);
    assert.deepEqual(main.breakpoints[0].layout, { width: { mode: "fill" } }, "only the field this breakpoint named");
    assert.equal(main.breakpoints[1].maxWidth, 650);
    assert.deepEqual(main.breakpoints[1].layout, { direction: "column" });
});

test("a breakpoint with no numeric maxWidth is reported and dropped, not silently kept", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      breakpoints:",
            "        - layout:",
            "            direction: column",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.ok(result.diagnostics.some(d => d.code === "invalid-breakpoint"));
    assert.equal(result.root.breakpoints, undefined, "nothing usable was authored, so no list at all");
});

test("a node with no breakpoints: at all carries no breakpoints property, exactly as before", () => {
    const files = {
        "app.yaml": ["app:", "  ui:", "    main:", "      type: panel", ""].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.equal(result.root.breakpoints, undefined);
});

test("breakpoints retain authored positional fields instead of only dimensions and direction", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      breakpoints:",
            "        - maxWidth: 649",
            "          layout:",
            "            left: columnMargin",
            "            top: 42",
            "            gap: -1",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.deepEqual(result.root.breakpoints, [{
        maxWidth: 649,
        layout: { left: "columnMargin", top: 42, gap: -1 }
    }]);
});

test("implicit item children retain authored layout and registered numeric properties", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: radioGroup",
            "      items:",
            "        - label: 12",
            "          disabledBelowWidth: 725",
            "          layout:",
            "            width: 26",
            "            height: 16",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const item = result.root.children[0];
    assert.deepEqual(item.layout, {
        width: { mode: "fixed", size: 26 },
        height: { mode: "fixed", size: 16 }
    });
    assert.equal(item.disabledBelowWidth, 725);
});

test("visibleWhen: compiles to { field, oneOf }, oneOf accepting either a sequence or a bare scalar", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - name: diskOps",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.top",
            "            oneOf:",
            "              - diskop_load",
            "              - diskop_save",
            "        - name: help",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.top",
            "            oneOf: options",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const [diskOps, help] = result.root.children;
    assert.deepEqual(diskOps.visibleWhen, { field: "view.top", oneOf: ["diskop_load", "diskop_save"] });
    assert.deepEqual(help.visibleWhen, { field: "view.top", oneOf: ["options"] }, "a bare scalar becomes a one-item list");
});

test("visibleWhen: missing field or oneOf is reported and dropped", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      visibleWhen:",
            "        field: view.top",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    assert.ok(result.diagnostics.some(d => d.code === "invalid-visible-when"));
    assert.equal(result.root.visibleWhen, undefined);
});

test("a real, multi-region routing shape (v1's own top/bottom split) compiles as two independent fields", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - name: topMain",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.top",
            "            oneOf:",
            "              - main",
            "              - topmain",
            "        - name: diskOps",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.top",
            "            oneOf:",
            "              - diskop_load",
            "              - diskop_save",
            "        - name: bottomMain",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.bottom",
            "            oneOf:",
            "              - main",
            "              - bottommain",
            "        - name: multitrack",
            "          type: panel",
            "          visibleWhen:",
            "            field: view.bottom",
            "            oneOf: multitrack",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const byName = Object.fromEntries(result.root.children.map(c => [c.definitionName, c]));
    assert.equal(byName.topMain.visibleWhen.field, "view.top");
    assert.equal(byName.diskOps.visibleWhen.field, "view.top");
    assert.equal(byName.bottomMain.visibleWhen.field, "view.bottom");
    assert.equal(byName.multitrack.visibleWhen.field, "view.bottom");
});
