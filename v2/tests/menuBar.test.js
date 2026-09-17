import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, drawKindOf, isImplemented, isInteractiveType } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { compileApplication } from "../compiler/convert.js";

// Spec 023: menu bar prerequisites. `menu` promoted from a placeholder;
// `menuTrigger` (new, synthesized-only) is what a menu's own top-level item
// or a submenu's own nested item becomes when its authored type is itself
// `submenu` - see tests/overlaySynthesis.test.js for the wrapping itself.

// --- registry ----------------------------------------------------------------

test("menu is implemented, draws nothing of its own, and wraps its flyout-shaped items", () => {
    const entry = componentType("menu");
    assert.equal(entry.implemented, true);
    assert.equal(entry.interactive, false, "its synthesized menuTrigger children are interactive, not menu itself");
    assert.equal(entry.direction, "row");
    assert.equal(entry.wrapsFlyoutItems, true);
    assert.equal(entry.exclusiveOverlayChildren, true);
    assert.equal(drawKindOf("menu"), "none");
    assert.deepEqual(entry.container, { childrenIn: "items" });
    assert.equal(isInteractiveType("menu"), false);
});

test("menuTrigger is implemented, synthesized-only, reuses dropdown's own \"disclose\" behavior", () => {
    const entry = componentType("menuTrigger");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "nothing authors one directly");
    assert.equal(behaviorOf("menuTrigger"), "disclose");
    assert.equal(drawKindOf("menuTrigger"), "menuTrigger");
    assert.equal(entry.styled, false);
});

test("submenu is now wrappable and exclusive too, alongside menu", () => {
    const entry = componentType("submenu");
    assert.equal(entry.isMenuFlyout, true, "a submenu item is itself a wrappable flyout, for nesting");
    assert.equal(entry.wrapsFlyoutItems, true, "a submenu's own items may also nest");
    assert.equal(entry.exclusiveOverlayChildren, true);
    // Unrelated to this spec, still true: submenu's own mechanism is unchanged.
    assert.equal(entry.modal, true);
    assert.equal(entry.dismissOnOutsideClick, true);
});

test("menu is no longer a still-declared placeholder", () => {
    assert.equal(isImplemented("menu"), true);
    assert.notEqual(drawKindOf("menu"), "placeholder");
});

// --- draw kind (shallow, matching overlayTypes.test.js's own pattern) --------

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        fillRect: (...a) => calls.push(["fillRect", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: s => (s || "").length * 4, write: () => {}, charHeight: 8 } };
}

test("menuTrigger draws its label, with a hover/pressed tint and no tint when idle", () => {
    const rect = { x: 0, y: 0, width: 80, height: 24 };
    const idle = fakeCtx();
    drawKind("menuTrigger").draw(idle, fakeAssets(), null, rect, "File", {});
    assert.equal(idle.calls.filter(c => c[0] === "fillRect").length, 0, "no tint while idle");

    const hovered = fakeCtx();
    drawKind("menuTrigger").draw(hovered, fakeAssets(), null, rect, "File", { hover: true });
    assert.equal(hovered.calls.filter(c => c[0] === "fillRect").length, 1);
});

test("menuTrigger measures wider than its label, for padding", () => {
    const size = drawKind("menuTrigger").measure(fakeAssets(), null, "File");
    assert.ok(size.width > 4 * "File".length);
});

// --- compiler integration: real nested authoring, exactly as written -------

function memoryReadFile(files) {
    return path => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null);
}

test("a menu authored with nested submenu items compiles as real, recursively nested nodes", () => {
    const files = {
        "app.yaml": [
            "app:",
            "  ui:",
            "    main:",
            "      type: panel",
            "      content:",
            "        - type: menu",
            "          items:",
            "            - label: File",
            "              type: submenu",
            "              items:",
            "                - type: label",
            "                  label: New",
            "            - label: Edit",
            "              type: submenu",
            "              items:",
            "                - type: label",
            "                  label: Cut",
            "                - label: Clear",
            "                  type: submenu",
            "                  items:",
            "                    - type: label",
            "                      label: Clear Track",
            ""
        ].join("\n")
    };
    const result = compileApplication("app.yaml", memoryReadFile(files));
    const menu = result.root.children[0];
    assert.equal(menu.supported, true);
    assert.equal(menu.type, "menu");
    assert.equal(menu.children.length, 2, "File and Edit, as real child nodes");
    const [file, edit] = menu.children;
    assert.equal(file.type, "submenu");
    assert.equal(file.supported, true);
    assert.equal(file.children[0].labelVariants[0], "New");
    assert.equal(edit.children[1].type, "submenu", "Edit's own \"Clear\" item is itself a submenu, nested two deep");
    assert.equal(edit.children[1].children[0].labelVariants[0], "Clear Track");
});
