import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import { createMultitrackController } from "../runtime/multitrackController.js";
import * as geo from "../renderers/canvas/multitrackGeometry.js";

// Spec 052: the "multitrack" behavior. Exercised against the same real
// fixture tests/song.test.js/tests/gridController.test.js already use,
// since - like "grid"/"waveform"/"loopCreator" - it reads/writes
// domain/song and domain/arrangement directly.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
// A realistic per-track height (90px, comfortably fitting the three
// 26px control-strip buttons) - a artificially short one (close to
// MIN_TRACK_H) reproduces the same button-overflow v1's own unclamped
// formula has at its own floor, not a scenario worth testing here.
const RECT = { x: 0, y: 0, width: geo.CTRL_WIDTH + 400, height: geo.HEADER_HEIGHT + 4 * 90 };

let Tracker;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
});

function load(name) {
    const data = readFileSync(join(FIXTURES, name));
    const buffer = new Uint8Array(data).buffer;
    return Tracker.processFile(buffer, name).then(() => Tracker.getSong());
}

function clearTrack(track) {
    song.setCurrentTrack(track);
    song.setCurrentPatternPos(0);
    song.clearTrack();
}

function setNote(track, row, { instrument = 0, period = 0 } = {}) {
    song.setCurrentTrack(track);
    song.setCurrentPatternPos(row);
    song.putNote({ instrument, period });
}

function point(local) {
    return { x: RECT.x + local.x, y: RECT.y + local.y };
}

function resetTrackStates() {
    for (let i = 0; i < song.getTrackCount(); i++) {
        arrangement.setTrackMute(i, false);
        arrangement.setTrackSolo(i, false);
    }
}

beforeEach(async () => {
    await load("wizballalt.mod");
    song.clearHistory();
    song.setCurrentPattern(0);
    song.setCurrentPatternPos(0);
    song.setCurrentTrack(0);
    resetTrackStates();
});

test("pointerenter/leave and focus/blur set hover/focused, and blur cancels any drag", () => {
    const controller = createMultitrackController();
    controller.handle({ type: "pointerenter" });
    assert.equal(controller.state.hover, true);
    controller.handle({ type: "pointerleave" });
    assert.equal(controller.state.hover, false);
    controller.handle({ type: "focus" });
    assert.equal(controller.state.focused, true);

    const local = { x: geo.CTRL_WIDTH + 5, y: 5 };
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(controller.state.dragMode, "seek");
    controller.handle({ type: "blur" });
    assert.equal(controller.state.focused, false);
    assert.equal(controller.state.dragMode, null);
});

test("a pointerdown in the header (ruler) seeks immediately, and a drag there keeps seeking", () => {
    const controller = createMultitrackController();
    const local = { x: geo.CTRL_WIDTH + 10 * 14, y: 5 }; // step 10 at the default 14px/step
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(song.getCurrentPatternPos(), 10);
    assert.equal(controller.state.dragMode, "seek");

    const local2 = { x: geo.CTRL_WIDTH + 20 * 14, y: 5 };
    controller.handle({ type: "drag", rect: RECT, point: point(local2), local: local2 });
    assert.equal(song.getCurrentPatternPos(), 20);
});

test("a pointerdown in the lane area with no note under it starts a timeline pan; wheel/drag scrolls horizontally", () => {
    clearTrack(0);
    const controller = createMultitrackController();
    const local = { x: geo.CTRL_WIDTH + 5 * 14, y: geo.HEADER_HEIGHT + 5 };
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(controller.state.dragMode, "timeline");

    const local2 = { x: local.x - 28, y: local.y }; // dragging left pans the view right (scrollX increases)
    controller.handle({ type: "drag", rect: RECT, point: point(local2), local: local2 });
    assert.equal(controller.state.scrollX, 28);

    controller.handle({ type: "pointerup" });
    assert.equal(controller.state.dragMode, null);
});

test("wheel scrolls vertically by default, horizontally when the shift axis dominates", () => {
    const controller = createMultitrackController();
    controller.handle({ type: "wheel", rect: RECT, deltaY: 20, deltaX: 0 });
    assert.equal(controller.state.scrollY, 0, "there is nothing to scroll vertically yet with only 4 tracks visible and 4 tracks total");

    controller.handle({ type: "wheel", rect: RECT, deltaY: 0, deltaX: -20 });
    assert.equal(controller.state.scrollX, 10);
});

test("wheel with the ctrl modifier zooms horizontally, recentering on the pointer's own step", () => {
    const controller = createMultitrackController();
    const local = { x: geo.CTRL_WIDTH + 140, y: 5 }; // step 10 at 14px/step
    controller.handle({ type: "wheel", rect: RECT, point: point(local), local, deltaY: 1, ctrlKey: true });
    assert.ok(controller.state.pixelsPerStep > 14, "zooming in increases pixels-per-step");

    // The same pattern step should still be under the same local x, within
    // the floor()-based rounding drift this same recentering math has in
    // v1's own multitrack.js#onMouseWheel too.
    const stepAtPointer = geo.xToStep(local.x, controller.state.pixelsPerStep, controller.state.scrollX);
    assert.ok(Math.abs(stepAtPointer - 10) <= 1, `expected step 10 (±1), got ${stepAtPointer}`);
});

test("dragging a note block moves it on release, calling arrangement.moveNote exactly once", () => {
    clearTrack(0);
    setNote(0, 2, { instrument: 3, period: 214 });
    song.clearHistory();

    const controller = createMultitrackController();
    const th = geo.trackHeightFor(RECT);
    const down = { x: geo.CTRL_WIDTH + 2 * 14 + 2, y: geo.HEADER_HEIGHT + 5 };
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    assert.equal(controller.state.dragMode, "note");
    assert.equal(controller.state.dragNote.sourceTrack, 0);
    assert.equal(controller.state.dragNote.sourceStep, 2);

    const dragTo = { x: geo.CTRL_WIDTH + 8 * 14 + 2, y: geo.HEADER_HEIGHT + th + 5 };
    controller.handle({ type: "drag", rect: RECT, point: point(dragTo), local: dragTo });
    assert.equal(controller.state.dragNote.targetStep, 8);
    assert.equal(controller.state.dragNote.targetTrack, 1);

    controller.handle({ type: "pointerup" });
    assert.equal(controller.state.dragMode, null);
    assert.equal(Tracker.getSong().patterns[0][8][1].period, 214, "the note moved");
    assert.equal(Tracker.getSong().patterns[0][2][0].period, 0, "the source cell cleared");
    assert.equal(song.canUndo(), true, "moveNote registered exactly one undo step");
});

test("releasing a note drag without moving it registers nothing", () => {
    clearTrack(0);
    setNote(0, 2, { instrument: 3, period: 214 });
    song.clearHistory();

    const controller = createMultitrackController();
    const down = { x: geo.CTRL_WIDTH + 2 * 14 + 2, y: geo.HEADER_HEIGHT + 5 };
    controller.handle({ type: "pointerdown", rect: RECT, point: point(down), local: down });
    controller.handle({ type: "pointerup" });
    assert.equal(song.canUndo(), false);
});

test("a pointerdown on the control strip's own solo/mute buttons calls the matching arrangement function for that lane's track", () => {
    const controller = createMultitrackController();
    const th = geo.trackHeightFor(RECT);
    const soloRect = geo.controlButtonRect("solo", th);
    const local = { x: soloRect.x + 5, y: geo.HEADER_HEIGHT + soloRect.y + 5 }; // track 0

    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(arrangement.getTrackMuteSolo(0).solo, true);
    assert.equal(controller.state.dragMode, null, "no drag starts from the control strip");

    // Un-solo track 0 first - soloing it already muted every other track by
    // cascade (ARR-004), which would make a second click on track 1's own
    // mute button toggle it back off rather than on.
    resetTrackStates();
    const muteRect = geo.controlButtonRect("mute", th);
    const localMute = { x: muteRect.x + 5, y: geo.HEADER_HEIGHT + th + muteRect.y + 5 }; // track 1
    controller.handle({ type: "pointerdown", rect: RECT, point: point(localMute), local: localMute });
    assert.equal(arrangement.getTrackMuteSolo(1).mute, true);
});

test("the record button calls setRecordHandler's own callback with the lane's track, defaulting to a no-op", () => {
    const controller = createMultitrackController();
    const th = geo.trackHeightFor(RECT);
    const recordRect = geo.controlButtonRect("record", th);
    const local = { x: recordRect.x + 5, y: geo.HEADER_HEIGHT + recordRect.y + 5 };

    // No handler set - must not throw.
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });

    let called = null;
    controller.setRecordHandler(track => { called = track; });
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(called, 0);
});

test("dragging a scrollbar thumb changes the offset by the expected ratio", () => {
    const controller = createMultitrackController();
    // Zoom out enough that the pattern (64 steps) overflows the viewport at a small pixelsPerStep, then widen: instead, shrink pixelsPerStep via zoom-out wheel ticks is fragile - directly drive a wide zoom by scrolling won't change pixelsPerStep. Use a very small viewport instead.
    const narrow = { x: 0, y: 0, width: geo.CTRL_WIDTH + 50, height: geo.HEADER_HEIGHT + 4 * 40 };
    const hMetrics = geo.hScrollbarMetrics(narrow, song.getPatternLength(), controller.state.pixelsPerStep, 0);
    assert.ok(hMetrics, "the pattern overflows a 50px-wide viewport at 14px/step");

    const down = { x: hMetrics.x + 2, y: hMetrics.y + 2 };
    controller.handle({ type: "pointerdown", rect: narrow, point: point(down), local: down });
    assert.equal(controller.state.dragMode, "hscrollbar");

    const dragTo = { x: down.x + 10, y: down.y };
    controller.handle({ type: "drag", rect: narrow, point: point(dragTo), local: dragTo });
    assert.ok(controller.state.scrollX > 0, "dragging the thumb right scrolled right");
    assert.equal(
        controller.state.scrollX,
        geo.applyHorizontalThumbDelta(10, 0, narrow, song.getPatternLength(), controller.state.pixelsPerStep)
    );
});

test("setDisabled blocks pointerdown and cancels any in-progress drag", () => {
    clearTrack(0);
    const controller = createMultitrackController();
    const local = { x: geo.CTRL_WIDTH + 5 * 14, y: geo.HEADER_HEIGHT + 5 };
    controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(controller.state.dragMode, "timeline");

    controller.setDisabled(true);
    assert.equal(controller.state.dragMode, null);

    const result = controller.handle({ type: "pointerdown", rect: RECT, point: point(local), local });
    assert.equal(result.blocked, "disabled");
    assert.equal(controller.state.dragMode, null);
});
