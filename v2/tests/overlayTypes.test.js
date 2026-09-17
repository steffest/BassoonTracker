import { test } from "node:test";
import assert from "node:assert/strict";
import { componentType, behaviorOf, cursorOf, drawKindOf, isStyledType, isImplemented } from "../runtime/componentTypes.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { BUILTIN_SKIN } from "../runtime/skinModel.js";

// Spec 020: dropdown, submenu and modalDialog, package P5's fourth
// implementing cluster - the overlay-dependent trio spec 016 grouped
// together. Registry facts first (mirroring leafTypes.test.js/
// valueControls.test.js/listbox.test.js), then a shallow smoke test per draw
// kind, matching those specs' own "not a real-browser interaction scenario"
// depth (design.md/requirements.md record why: no Playwright in this
// environment).

// --- registry ----------------------------------------------------------------

test("dropdown is implemented, reuses the button controller under its own behavior name, and synthesizes a popup", () => {
    const entry = componentType("dropdown");
    assert.equal(entry.implemented, true);
    assert.equal(entry.styled, true, "a real control, should look like one even before a skin authors a variant");
    assert.equal(entry.synthesizes, "popup");
    assert.equal(behaviorOf("dropdown"), "disclose");
    assert.equal(cursorOf("dropdown"), "pointer");
    assert.equal(drawKindOf("dropdown"), "dropdown");
    assert.equal(isStyledType("dropdown"), true);
    assert.ok(BUILTIN_SKIN.styles.dropdown, "a built-in fallback style exists, so it draws with no authored skin");
    assert.deepEqual(entry.container, { childrenIn: "items" });
});

test("dropdownPopup is synthesized-only, reuses listbox's own \"list\" behavior, and dismisses on an outside click", () => {
    const entry = componentType("dropdownPopup");
    assert.equal(entry.implemented, true);
    assert.equal(entry.styled, false, "no artwork exists for it yet, same as listbox");
    assert.equal(behaviorOf("dropdownPopup"), "list");
    assert.equal(entry.layer, "overlay");
    assert.equal(entry.modal, true);
    assert.equal(entry.dismissOnOutsideClick, true);
    assert.equal(entry.clips, true);
    assert.equal(drawKindOf("dropdownPopup"), "dropdownPopup");
});

test("submenu is implemented with its own \"flyout\" behavior, modal and dismissable outside itself", () => {
    const entry = componentType("submenu");
    assert.equal(entry.implemented, true);
    assert.equal(behaviorOf("submenu"), "flyout");
    assert.equal(entry.layer, "overlay");
    assert.equal(entry.modal, true);
    assert.equal(entry.dismissOnOutsideClick, true);
    assert.deepEqual(entry.container, { childrenIn: "items" }, "plain items, like listbox - no itemActions shape now that it is really drawn");
    assert.equal(drawKindOf("submenu"), "submenu");
});

test("modalDialog is implemented, modal, synthesizes ok/cancel/input, and does not dismiss on an outside click", () => {
    const entry = componentType("modalDialog");
    assert.equal(entry.implemented, true);
    assert.equal(entry.layer, "overlay");
    assert.equal(entry.modal, true);
    assert.equal(entry.synthesizes, "dialogParts");
    assert.ok(!entry.dismissOnOutsideClick, "a real message dialog only closes via Escape/OK/Cancel, matching v1");
    assert.equal(behaviorOf("modalDialog"), null, "its own interactivity comes from its synthesized children, not itself");
    assert.equal(drawKindOf("modalDialog"), "modalDialog");
});

test("none of the four are checked as still-declared placeholders any more", () => {
    for (const type of ["dropdown", "submenu", "modalDialog", "dropdownPopup"]) {
        assert.equal(isImplemented(type), true, type);
        assert.notEqual(drawKindOf(type), "placeholder", type);
    }
});

// --- draw kinds (shallow, matching valueControls.test.js/listbox.test.js) ----

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), rect: (...a) => calls.push(["rect", ...a]),
        clip: () => calls.push(["clip"]), fillRect: (...a) => calls.push(["fillRect", ...a]),
        strokeRect: (...a) => calls.push(["strokeRect", ...a]),
        moveTo: (...a) => calls.push(["moveTo", ...a]), lineTo: (...a) => calls.push(["lineTo", ...a]),
        closePath: () => calls.push(["closePath"]), fill: () => calls.push(["fill"]),
        stroke: () => calls.push(["stroke"]),
        set fillStyle(v) { calls.push(["fillStyle", v]); },
        set strokeStyle(v) { calls.push(["strokeStyle", v]); },
        set lineWidth(v) { calls.push(["lineWidth", v]); }
    };
}
function fakeAssets() {
    return { skin: { getAsset: () => null }, styleFor: () => null, font: { getTextWidth: s => (s || "").length * 4, write: () => {}, charHeight: 8 } };
}

test("dropdown draws its background, the selected label and an arrow, without throwing", () => {
    const rect = { x: 0, y: 0, width: 100, height: 24 };
    assert.doesNotThrow(() => drawKind("dropdown").draw(fakeCtx(), fakeAssets(), null, rect, "Piano", {}));
    const ctx = fakeCtx();
    drawKind("dropdown").draw(ctx, fakeAssets(), null, rect, "Piano", { disabled: true });
    assert.ok(ctx.calls.some(c => c[0] === "fill"), "the arrow is always drawn, dimmed when disabled");
});

test("dropdown measures wider than its label, to leave room for the arrow", () => {
    const size = drawKind("dropdown").measure(fakeAssets(), null, "Piano");
    assert.ok(size.width > 4 * "Piano".length, "room for the arrow beyond the label's own text width");
    assert.ok(size.height >= 20);
});

test("dropdownPopup draws exactly like listbox (delegates to it)", () => {
    const rect = { x: 0, y: 0, width: 100, height: 60 };
    const state = { selectedItemRect: { x: 2, y: 2, width: 96, height: 10 } };
    const popupCalls = (() => { const ctx = fakeCtx(); drawKind("dropdownPopup").draw(ctx, fakeAssets(), null, rect, "", state); return ctx.calls; })();
    const listboxCalls = (() => { const ctx = fakeCtx(); drawKind("listbox").draw(ctx, fakeAssets(), null, rect, "", state); return ctx.calls; })();
    assert.deepEqual(popupCalls, listboxCalls);
});

test("dropdownPopup measures its width like listbox, but its height to the item count, capped at 8 rows", () => {
    const many = drawKind("dropdownPopup").measure(fakeAssets(), null, "", { children: new Array(20).fill({}) });
    const few = drawKind("dropdownPopup").measure(fakeAssets(), null, "", { children: new Array(3).fill({}) });
    assert.ok(many.height < 20 * 22, "capped rather than growing with the full item count");
    assert.ok(few.height < many.height);
});

test("submenu draws a hover tint, a disabled dim, and a \">\" for a subItems-bearing row, without throwing", () => {
    const rect = { x: 0, y: 0, width: 120, height: 78 };
    const node = { children: [{ id: "a" }, { id: "b", subItems: [{}] }, { id: "c" }] };
    const state = { hoverItemRect: { x: 0, y: 26, width: 120, height: 26 }, itemDisabled: [false, false, true] };
    assert.doesNotThrow(() => drawKind("submenu").draw(fakeCtx(), fakeAssets(), null, rect, "", state, node));
    const ctx = fakeCtx();
    drawKind("submenu").draw(ctx, fakeAssets(), null, rect, "", state, node);
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "at least the backing (and the hover tint / disabled dim) is filled");
});

test("submenu measures its height to the item count", () => {
    const size = drawKind("submenu").measure(fakeAssets(), null, "", { children: [{}, {}, {}] });
    assert.equal(size.height, 3 * 26);
});

test("modalDialog draws a backdrop, a centred panel and the message, split on \"/\", without throwing", () => {
    const rect = { x: 0, y: 0, width: 400, height: 300 };
    const node = { text: "*Delete this?/Are you sure" };
    const ctx = fakeCtx();
    const resolution = drawKind("modalDialog").draw(ctx, fakeAssets(), null, rect, "", {}, node);
    assert.ok(resolution.drawn);
    assert.ok(resolution.panel.width <= rect.width && resolution.panel.height <= rect.height, "the panel fits inside the overlay's own rect");
    assert.ok(ctx.calls.filter(c => c[0] === "fillRect").length >= 2, "the backdrop and the panel are both filled");
});

test("modalDialog draws nothing extra for a dialog with no text", () => {
    assert.doesNotThrow(() => drawKind("modalDialog").draw(fakeCtx(), fakeAssets(), null, { x: 0, y: 0, width: 400, height: 300 }, "", {}, {}));
});
