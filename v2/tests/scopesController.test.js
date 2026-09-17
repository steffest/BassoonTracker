import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import { createScopesController } from "../runtime/scopesController.js";
import { cellRect } from "../renderers/canvas/scopesGeometry.js";

// Spec 058: the "scopes" behavior. Exercised against the same real fixture
// tests/multitrackController.test.js already uses (4 tracks), since a click
// here calls domain/arrangement#toggleTrackMute directly, the identical
// mechanism spec 051/052 already established.

const RECT = { x: 0, y: 0, width: 400, height: 80 };
let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

beforeEach(async () => {
    const data = readFileSync(join(FIXTURES, "wizballalt.mod"));
    const buffer = new Uint8Array(data).buffer;
    await Tracker.processFile(buffer, "wizballalt.mod"); // 4 tracks
    for (let i = 0; i < song.getTrackCount(); i++) {
        arrangement.setTrackMute(i, false);
        arrangement.setTrackSolo(i, false);
    }
});

function point(local) {
    return { x: RECT.x + local.x, y: RECT.y + local.y };
}

test("pointerenter/leave and focus/blur set hover/focused", () => {
    const controller = createScopesController();
    controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.hover, true);
    controller.handle({ type: "pointerleave" });
    assert.equal(controller.state.hover, false);
    controller.handle({ type: "focus" });
    assert.equal(controller.state.focused, true);
    controller.handle({ type: "blur" });
    assert.equal(controller.state.focused, false);
});

test("a hit inside a real track's own cell toggles that track's mute, and only that one", () => {
    const controller = createScopesController();
    const cell1 = cellRect(1, song.getTrackCount(), RECT);
    const local = { x: cell1.left + 5, y: cell1.top + 5 };

    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(result.handled, true);
    assert.equal(arrangement.getTrackMuteSolo(1).mute, true);
    assert.equal(arrangement.getTrackMuteSolo(0).mute, false, "other tracks untouched");

    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(arrangement.getTrackMuteSolo(1).mute, false, "a second click toggles it back off");
});

test("a click outside every cell does nothing", () => {
    const controller = createScopesController();
    const local = { x: 0, y: 0 }; // exactly on the boundary - a miss (strict inequality)
    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(result.handled, false);
    for (let i = 0; i < song.getTrackCount(); i++) {
        assert.equal(arrangement.getTrackMuteSolo(i).mute, false);
    }
});

test("setDisabled blocks pointerdown", () => {
    const controller = createScopesController();
    controller.setDisabled(true);
    const cell0 = cellRect(0, song.getTrackCount(), RECT);
    const local = { x: cell0.left + 5, y: cell0.top + 5 };
    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(result.blocked, "disabled");
    assert.equal(arrangement.getTrackMuteSolo(0).mute, false);
});
