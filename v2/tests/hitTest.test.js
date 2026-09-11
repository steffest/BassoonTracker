import { test } from "node:test";
import assert from "node:assert/strict";
import { hitTestPoint, ancestryChain, mapPointerToLogical } from "../runtime/hitTest.js";

test("returns the topmost (last-painted) node whose rect contains the point", () => {
    const nodes = [
        { id: "background", rect: { x: 0, y: 0, width: 100, height: 100 } },
        { id: "panel", rect: { x: 10, y: 10, width: 80, height: 80 } },
        { id: "button", rect: { x: 20, y: 20, width: 30, height: 20 } }
    ];
    assert.equal(hitTestPoint(nodes, { x: 25, y: 25 }), "button");
    assert.equal(hitTestPoint(nodes, { x: 15, y: 15 }), "panel");
    assert.equal(hitTestPoint(nodes, { x: 1, y: 1 }), "background");
});

test("returns null when the point hits nothing", () => {
    const nodes = [{ id: "panel", rect: { x: 10, y: 10, width: 20, height: 20 } }];
    assert.equal(hitTestPoint(nodes, { x: 200, y: 200 }), null);
});

test("skips nodes with no rect (e.g. a node that never got laid out)", () => {
    const nodes = [
        { id: "hidden", rect: undefined },
        { id: "visible", rect: { x: 0, y: 0, width: 50, height: 50 } }
    ];
    assert.equal(hitTestPoint(nodes, { x: 5, y: 5 }), "visible");
});

test("resolves the deepest node through three levels of nested references", () => {
    // Mirrors app.yaml -> controlBar -> radioGroup -> radioItem nesting.
    const nodes = [
        { id: "main", rect: { x: 0, y: 0, width: 500, height: 300 } },
        { id: "main.controlBar", rect: { x: 4, y: 4, width: 490, height: 28 } },
        { id: "main.controlBar.radioGroup", rect: { x: 8, y: 8, width: 100, height: 20 } },
        { id: "main.controlBar.radioGroup.song", rect: { x: 10, y: 10, width: 40, height: 16 } }
    ];
    assert.equal(hitTestPoint(nodes, { x: 20, y: 15 }), "main.controlBar.radioGroup.song");
    assert.equal(hitTestPoint(nodes, { x: 90, y: 15 }), "main.controlBar.radioGroup");
    assert.equal(hitTestPoint(nodes, { x: 300, y: 15 }), "main.controlBar");
});

test("ancestryChain returns the root-to-target id path for breadcrumbs", () => {
    const root = {
        id: "main",
        children: [
            { id: "main.top", children: [] },
            { id: "main.controlBar", children: [{ id: "main.controlBar.button.Play", children: [] }] }
        ]
    };
    assert.deepEqual(ancestryChain(root, "main.controlBar.button.Play"), ["main", "main.controlBar", "main.controlBar.button.Play"]);
    assert.deepEqual(ancestryChain(root, "main.top"), ["main", "main.top"]);
});

test("ancestryChain returns null for an id outside the tree", () => {
    const root = { id: "main", children: [{ id: "main.top", children: [] }] };
    assert.equal(ancestryChain(root, "nope"), null);
});

test("mapPointerToLogical is the identity when the bounding box matches the logical size", () => {
    const boundingRect = { left: 10, top: 20, width: 400, height: 300 };
    const point = mapPointerToLogical(110, 120, boundingRect, 400, 300);
    assert.deepEqual(point, { x: 100, y: 100 });
});

test("mapPointerToLogical corrects for a CSS-scaled bounding box (zoom/transform)", () => {
    // The canvas is 400x300 logical px but rendered at half size on screen.
    const boundingRect = { left: 0, top: 0, width: 200, height: 150 };
    const point = mapPointerToLogical(100, 75, boundingRect, 400, 300);
    assert.deepEqual(point, { x: 200, y: 150 });
});

test("mapPointerToLogical does not divide by zero for a collapsed bounding box", () => {
    const boundingRect = { left: 0, top: 0, width: 0, height: 0 };
    const point = mapPointerToLogical(5, 5, boundingRect, 400, 300);
    assert.deepEqual(point, { x: 5, y: 5 });
});
