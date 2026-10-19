import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGenericLayout } from "../runtime/genericLayout.js";

function leaf(id, overrides = {}) {
    return {
        id,
        type: "button",
        layout: { width: { mode: "auto" }, height: { mode: "auto" } },
        children: [],
        ...overrides
    };
}

function panel(id, children, layout = { width: { mode: "fill" }, height: { mode: "fill" } }) {
    return { id, type: "panel", layout, children };
}

const fixedMeasure = () => ({ width: 40, height: 20 });

test("stacks panel children vertically with padding and gaps", () => {
    const root = panel("root", [
        leaf("a", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } }),
        leaf("b", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } })
    ]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 100 }, fixedMeasure);
    const a = rects.get("a");
    const b = rects.get("b");
    assert.equal(a.y, 4);
    assert.equal(a.height, 10);
    assert.equal(b.y, a.y + a.height + 4);
    assert.equal(a.width, 92); // 100 - 2*padding
});

test("fill-height children share remaining space equally", () => {
    const root = panel("root", [
        leaf("fixed", { layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 10 } } }),
        leaf("fillA", { layout: { width: { mode: "fill" }, height: { mode: "fill" } } }),
        leaf("fillB", { layout: { width: { mode: "fill" }, height: { mode: "fill" } } })
    ]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 100 }, fixedMeasure);
    // total height 100, padding 4+4=8, fixed 10, 2 gaps of 4 = 8 -> remaining 74, split into 2 => 37 each
    assert.equal(rects.get("fillA").height, 37);
    assert.equal(rects.get("fillB").height, 37);
});

test("radioGroup lays its children out in a row using their intrinsic width", () => {
    const root = { id: "group", type: "radioGroup", layout: { width: { mode: "auto" }, height: { mode: "auto" } }, children: [leaf("x"), leaf("y")] };
    const { rects } = computeGenericLayout(root, { width: 200, height: 40 }, fixedMeasure);
    const x = rects.get("x");
    const y = rects.get("y");
    assert.equal(x.y, y.y);
    assert.equal(y.x, x.x + x.width + 4);
    assert.equal(x.width, 40);
});

test("an auto-height container sizes to the sum of its children", () => {
    const inner = panel("inner", [leaf("a"), leaf("b")], { width: { mode: "fill" }, height: { mode: "auto" } });
    const root = panel("root", [inner]);
    const { rects } = computeGenericLayout(root, { width: 100, height: 200 }, fixedMeasure);
    // inner intrinsic height = padding(8) + 2*leafHeight(20) + gap(4) = 52
    assert.equal(rects.get("inner").height, 52);
});

test("a \"col2\" width child in a row is sized from the viewport, matching v1's own real Layout.col2W formula (spec 083's own pixel-parity follow-up)", () => {
    // v1's own real script/src/ui/app/menu.js: `Math.max(Layout.col2W, 250)`;
    // script/src/ui/app/layout.js: col1W = floor((viewportWidth-27)/5),
    // col2W = col1W*2+4. At a 900px viewport: col1W=174, col2W=352 (the
    // floor never kicks in at this width).
    const root = { id: "top", type: "panel", layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 40 } }, children: [
        { id: "menuBar", type: "panel", layout: { width: { mode: "col2" }, height: { mode: "fixed", size: 26 } }, children: [] },
        leaf("rest", { layout: { width: { mode: "fill" }, height: { mode: "fill" } } })
    ] };
    const { rects } = computeGenericLayout(root, { width: 900, height: 100 }, fixedMeasure);
    assert.equal(rects.get("menuBar").width, 352);
});

test("a \"col2\" width never shrinks below v1's own real 250px floor at a narrow viewport", () => {
    const root = { id: "top", type: "panel", layout: { width: { mode: "fill" }, height: { mode: "fixed", size: 40 } }, children: [
        { id: "menuBar", type: "panel", layout: { width: { mode: "col2" }, height: { mode: "fixed", size: 26 } }, children: [] }
    ] };
    const { rects } = computeGenericLayout(root, { width: 100, height: 100 }, fixedMeasure);
    assert.equal(rects.get("menuBar").width, 250);
});

test("raw five-column banner formulas reproduce AppMainPanel's logo and tracker geometry", () => {
    for (const width of [620, 650, 820, 1000, 1440]) {
        const col1 = Math.floor((width - 27) / 5);
        const col5 = col1 * 5 + 16;
        const margin = Math.floor((width - col5) / 2);
        const root = panel("root", [
            leaf("logo", { layout: { position: "absolute", left: "columnMargin", top: 4, width: { mode: "col2Exact" }, height: { mode: "fixed", size: 50 } } }),
            leaf("tracker", { layout: { position: "absolute", left: "col3Left", top: 4, width: { mode: "col1" }, height: { mode: "fixed", size: 50 } } })
        ], { width: { mode: "fill" }, height: { mode: "fixed", size: 160 }, padding: 0, gap: 0 });
        const { rects } = computeGenericLayout(root, { width, height: 800 }, fixedMeasure);
        assert.deepEqual(rects.get("logo"), { x: margin, y: 4, width: col1 * 2 + 4, height: 50 });
        assert.deepEqual(rects.get("tracker"), { x: margin + 2 * (col1 + 4), y: 4, width: col1, height: 50 });
    }
});

test("five-column second and fourth edges reproduce the file-operation selector grid", () => {
    for (const width of [730, 820, 1000, 1440]) {
        const col1 = Math.floor((width - 27) / 5);
        const margin = Math.floor((width - (col1 * 5 + 16)) / 2);
        const root = panel("root", [
            leaf("second", { layout: { position: "absolute", left: "col2Left", top: 5, width: { mode: "col1" }, height: { mode: "fixed", size: 150 } } }),
            leaf("fourth", { layout: { position: "absolute", left: "col4Left", top: 5, width: { mode: "col2Exact" }, height: { mode: "fixed", size: 150 } } })
        ], { width: { mode: "fill" }, height: { mode: "fixed", size: 160 }, padding: 0, gap: 0 });
        const { rects } = computeGenericLayout(root, { width, height: 800 }, fixedMeasure);
        assert.equal(rects.get("second").x, margin + col1 + 4);
        assert.equal(rects.get("fourth").x, margin + 3 * (col1 + 4));
    }
});

test("five-column third modes and selfWidth offset reproduce v1 SongControl Play geometry", () => {
    const expected = new Map([
        [640, { x: 111, width: 104, mode: "col2HalfThird" }],
        [650, { x: 48, width: 41, mode: "col1Third" }],
        [820, { x: 59, width: 52, mode: "col1Third" }],
        [1000, { x: 71, width: 64, mode: "col1Third" }],
        [1440, { x: 101, width: 94, mode: "col1Third" }]
    ]);
    for (const [viewportWidth, want] of expected) {
        const root = panel("root", [
            leaf("play", { layout: {
                position: "absolute", left: "columnMargin", top: 4, offsetX: "selfWidth",
                width: { mode: want.mode }, height: { mode: "fixed", size: viewportWidth < 650 ? 34 : 32 }
            } })
        ], { width: { mode: "fill" }, height: { mode: "fixed", size: viewportWidth < 650 ? 80 : 40 }, padding: 0, gap: 0 });
        const { rects } = computeGenericLayout(root, { width: viewportWidth, height: 800 }, fixedMeasure);
        assert.deepEqual(rects.get("play"), { x: want.x, y: 4, width: want.width, height: viewportWidth < 650 ? 34 : 32 });
    }
});

test("a multiplied selfWidth offset reproduces v1 SongControl Record geometry", () => {
    const expected = new Map([
        [640, { x: 215, width: 104, mode: "col2HalfThird" }],
        [650, { x: 89, width: 41, mode: "col1Third" }],
        [820, { x: 111, width: 52, mode: "col1Third" }],
        [1000, { x: 135, width: 64, mode: "col1Third" }],
        [1440, { x: 195, width: 94, mode: "col1Third" }]
    ]);
    for (const [viewportWidth, want] of expected) {
        const root = panel("root", [
            leaf("record", { layout: {
                position: "absolute", left: "columnMargin", top: 4, offsetX: "2selfWidth",
                width: { mode: want.mode }, height: { mode: "fixed", size: viewportWidth < 650 ? 34 : 32 }
            } })
        ], { width: { mode: "fill" }, height: { mode: "fixed", size: viewportWidth < 650 ? 80 : 40 }, padding: 0, gap: 0 });
        const { rects } = computeGenericLayout(root, { width: viewportWidth, height: 800 }, fixedMeasure);
        assert.deepEqual(rects.get("record"), { x: want.x, y: 4, width: want.width, height: viewportWidth < 650 ? 34 : 32 });
    }
});

test("the compact play-sequence selector and later control-bar regions follow v1's responsive columns", () => {
    const expected = new Map([
        [650, { selectorWidth: 41, controlsLeft: 197, modeLeft: 329 }],
        [820, { selectorWidth: 52, controlsLeft: 169, modeLeft: 493 }],
        [1000, { selectorWidth: 64, controlsLeft: 205, modeLeft: 601 }],
        [1440, { selectorWidth: 94, controlsLeft: 293, modeLeft: 865 }]
    ]);
    for (const [viewportWidth, want] of expected) {
        const root = panel("root", [
            leaf("selector", { layout: { position: "absolute", left: "columnMargin", top: 4, width: { mode: "col1Third" }, height: { mode: "fixed", size: 32 } } }),
            leaf("views", { layout: { position: "absolute", left: "controlButtonsLeft", top: 4, width: { mode: viewportWidth < 820 ? "col1" : "col2" }, height: { mode: "fixed", size: 32 } } }),
            leaf("mode", { layout: { position: "absolute", left: "modeButtonsLeft", top: 4, width: { mode: "fixed", size: 60 }, height: { mode: "fixed", size: 32 } } })
        ], { width: { mode: "fill" }, height: { mode: "fixed", size: 40 }, padding: 0, gap: 0 });
        const { rects } = computeGenericLayout(root, { width: viewportWidth, height: 800 }, fixedMeasure);
        assert.deepEqual(rects.get("selector"), { x: 7, y: 4, width: want.selectorWidth, height: 32 });
        assert.equal(rects.get("views").x, want.controlsLeft);
        assert.equal(rects.get("mode").x, want.modeLeft);
    }
});

test("the channel spinbox uses v1's narrow two-thirds placement at 640px", () => {
    const root = panel("root", [
        leaf("channels", { layout: { position: "absolute", left: "modeButtonsLeft", top: 4, width: { mode: "fixed", size: 60 }, height: { mode: "fixed", size: 34 } } })
    ], { width: { mode: "fill" }, height: { mode: "fixed", size: 80 }, padding: 0, gap: 0 });
    const { rects } = computeGenericLayout(root, { width: 640, height: 800 }, fixedMeasure);
    assert.deepEqual(rects.get("channels"), { x: 356, y: 4, width: 60, height: 34 });
});

test("the patternTracks horizontal frame follows v1's sidebar boundary and visible-track offset", () => {
    const expected = [
        { width: 620, tracks: 4, x: 7, frameWidth: 606 },
        { width: 620, tracks: 8, x: 25, frameWidth: 588 },
        { width: 621, tracks: 4, x: 147, frameWidth: 466 },
        { width: 650, tracks: 4, x: 153, frameWidth: 490 },
        { width: 820, tracks: 8, x: 187, frameWidth: 626 },
        { width: 1000, tracks: 4, x: 205, frameWidth: 788 },
        { width: 1000, tracks: 8, x: 223, frameWidth: 770 },
        { width: 1440, tracks: 8, x: 293, frameWidth: 1140 }
    ];
    for (const item of expected) {
        const root = panel("root", [leaf("scopes", { layout: {
            width: { mode: "fill" }, height: { mode: "fixed", size: 66 }, horizontalFrame: "patternTracks"
        } })]);
        const { rects } = computeGenericLayout(root, { width: item.width, height: 800 }, fixedMeasure, {
            stateValueOf: field => field === "tracks.value" ? item.tracks : undefined
        });
        assert.equal(rects.get("scopes").x, item.x, `${item.width}px/${item.tracks} tracks left`);
        assert.equal(rects.get("scopes").width, item.frameWidth, `${item.width}px/${item.tracks} tracks width`);
    }
});

test("leaf nodes with no children are placed but not recursed into", () => {
    const root = panel("root", [leaf("only")]);
    const { rects } = computeGenericLayout(root, { width: 50, height: 50 }, fixedMeasure);
    assert.ok(rects.has("only"));
    assert.equal(rects.size, 2);
});
