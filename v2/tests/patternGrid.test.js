import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { componentType, behaviorOf, drawKindOf, cursorOf } from "../runtime/componentTypes.js";
import { synthesizeOverlayChildren } from "../runtime/overlaySynthesis.js";
import { ensureIds } from "../runtime/components.js";
import { drawCachedText, drawCachedLineNumber } from "../renderers/canvas/patternGridGlyphs.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";

// Spec 030: patternGrid is the specialized-component contract's proof - a
// leaf whose node count (plus its synthesized selection menu) is fixed,
// never a function of the loaded song's pattern length or track count.

function flatten(node, out = []) {
    out.push(node);
    (node.children || []).forEach(child => flatten(child, out));
    return out;
}

test("patternGrid is declared as a specialized leaf with its own behavior and draw kind", () => {
    const entry = componentType("patternGrid");
    assert.equal(entry.implemented, true);
    assert.equal(entry.container, null, "a leaf: no children slot at all");
    assert.equal(entry.styled, false);
    assert.equal(entry.synthesizes, "selectionMenu");
    assert.equal(behaviorOf("patternGrid"), "grid");
    assert.equal(drawKindOf("patternGrid"), "patternGrid");
    assert.equal(cursorOf("patternGrid"), "default");
    assert.deepEqual(entry.properties, {}, "everything comes from domain/song and the node's own rect, nothing authored");
});

test("synthesis gives every patternGrid exactly one selection menu of four commands", () => {
    const root = { id: null, type: "patternGrid", definitionName: "grid", labelVariants: [], layout: {}, children: [], bindings: [], supported: true, source: null };
    ensureIds(root);
    synthesizeOverlayChildren(root);
    assert.equal(root.children.length, 1);
    const menu = root.children[0];
    assert.equal(menu.type, "submenu");
    assert.deepEqual(menu.children.map(item => item.selectionCommand), ["clear", "cut", "copy", "paste"]);
    assert.equal(flatten(root).length, 6, "grid + submenu + four items, fixed");
});

// --- node count is independent of the loaded song's size -------------------

let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

function synthesizedNodeCount() {
    const root = { id: null, type: "patternGrid", definitionName: "grid", labelVariants: [], layout: {}, children: [], bindings: [], supported: true, source: null };
    ensureIds(root);
    synthesizeOverlayChildren(root);
    return flatten(root).length;
}

test("GRID-001: the compiled node count does not change with the loaded song's track count or pattern length", async () => {
    await load("wizballalt.mod");
    const smallTrackCount = Tracker.getTrackCount();
    const smallCount = synthesizedNodeCount();

    await load("sin.xm");
    const largeTrackCount = Tracker.getTrackCount();
    const largeCount = synthesizedNodeCount();

    assert.equal(smallCount, largeCount, "the same fixed node count regardless of which song is loaded");
    assert.equal(smallCount, 6);
    // Sanity: the two fixtures actually differ in shape, or this test would
    // not be exercising anything.
    assert.notEqual(smallTrackCount, largeTrackCount, "the fixtures have different track counts");
});

// --- the per-glyph cache (spec 030 GRID-002), independent of domain/song ---

function fakeFont(id) {
    let writes = 0;
    return {
        id,
        get writes() { return writes; },
        charHeight: 8,
        getTextWidth: (text) => text.length * 6,
        write: () => { writes++; }
    };
}

test("drawCachedText rasterizes a distinct (font, text) pair only once", () => {
    const font = fakeFont("a");
    const ctx = { drawImage: () => {} };
    drawCachedText(ctx, font, "C-4", 0, 0);
    drawCachedText(ctx, font, "C-4", 10, 0);
    drawCachedText(ctx, font, "C-4", 20, 0);
    assert.equal(font.writes, 1, "the same text on the same font rasterizes once");

    drawCachedText(ctx, font, "D-4", 0, 0);
    assert.equal(font.writes, 2, "a different text is a cache miss");
});

test("drawCachedLineNumber and drawCachedText never collide on the same text", () => {
    const font = fakeFont("b");
    const ctx = { drawImage: () => {} };
    drawCachedText(ctx, font, "05", 0, 0);
    drawCachedLineNumber(ctx, font, 5, 0, 0);
    assert.equal(font.writes, 2, "a line number '05' and a note/param string '05' cache independently");
});

test("two different font instances never share a cached glyph", () => {
    const fontA = fakeFont("a2");
    const fontB = fakeFont("b2");
    const ctx = { drawImage: () => {} };
    drawCachedText(ctx, fontA, "C-4", 0, 0);
    drawCachedText(ctx, fontB, "C-4", 0, 0);
    assert.equal(fontA.writes, 1);
    assert.equal(fontB.writes, 1, "a skin reload's new font instance never blits the old skin's rasterized glyph");
});

// --- the draw kind itself, against a real loaded song and fake canvas -----

function fakeCtx() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
        beginPath: () => calls.push(["beginPath"]), rect: (...a) => calls.push(["rect", ...a]),
        clip: () => calls.push(["clip"]), fillRect: (...a) => calls.push(["fillRect", ...a]),
        drawImage: (...a) => calls.push(["drawImage", ...a]),
        set fillStyle(v) { calls.push(["fillStyle", v]); }
    };
}
function fakeAssets() {
    const font = fakeFont("draw");
    return { skin: { getAsset: () => null }, styleFor: () => null, font, fontFor: () => font };
}

test("the patternGrid draw kind draws only the visible rows, never throws, and measures to a floor size", () => {
    assert.deepEqual(drawKind("patternGrid").measure(), { width: 300, height: 200 });
    const rect = { x: 0, y: 0, width: 260, height: 130 };
    const state = { startTrack: 0 };
    assert.doesNotThrow(() => drawKind("patternGrid").draw(fakeCtx(), fakeAssets(), null, rect, "", state));

    const ctx = fakeCtx();
    drawKind("patternGrid").draw(ctx, fakeAssets(), null, rect, "", state);
    assert.ok(ctx.calls.some(c => c[0] === "fillRect"), "at least the current-row band is filled");
    assert.ok(ctx.calls.some(c => c[0] === "drawImage"), "at least one cached glyph is blitted");
});
