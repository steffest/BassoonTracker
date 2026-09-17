import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine } from "../domain/playback/index.js";
import * as SongDoc from "../domain/song/index.js";
import { createGridController } from "../runtime/gridController.js";
import { GUTTER_WIDTH, trackStep, LINE_HEIGHT } from "../renderers/canvas/patternGridGeometry.js";

// Spec 030: the "grid" behavior. Exercised against the same real fixture
// tests/song.test.js already uses, since - unlike every controller before
// it - it reads/writes domain/song directly rather than being fed numbers
// through `contextFor()`'s usual bounds/value shape.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

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

beforeEach(async () => {
    await load("wizballalt.mod");
    SongDoc.clearHistory();
    SongDoc.setCurrentPattern(0);
    SongDoc.setCurrentPatternPos(2);
    SongDoc.setCurrentTrack(0);
    SongDoc.resetSelection();
    SongDoc.setRecording(false);
    SongDoc.setCurrentOctave(2);
});

const RECT = { x: 0, y: 0, width: GUTTER_WIDTH + trackStep(false) * 4, height: 130 };

function localFor(track) {
    return { x: GUTTER_WIDTH + trackStep(false) * track + 2, y: 10 };
}

test("a plain press-and-release on a track sets the cursor's track, without selecting", () => {
    const controller = createGridController();
    const down = controller.handle({ type: "pointerdown", rect: RECT, local: localFor(2), point: { x: 0, y: 0 } });
    assert.equal(down.handled, true);
    assert.equal(SongDoc.getCurrentTrack(), 2);
    const up = controller.handle({ type: "pointerup" });
    assert.equal(up.openSelectionMenu, false);
    assert.equal(SongDoc.hasSelection(), false);
});

test("a modifier-drag begins and extends a selection, and reports openSelectionMenu on release", () => {
    const controller = createGridController();
    controller.handle({ type: "pointerdown", rect: RECT, local: localFor(1), point: { x: 0, y: 0 }, metaKey: true });
    assert.equal(SongDoc.hasSelection(), true);
    controller.handle({ type: "drag", rect: RECT, delta: { x: trackStep(false), y: LINE_HEIGHT * 2 } });
    const range = SongDoc.getSelectionRange();
    assert.equal(range.left, 1);
    assert.equal(range.right, 2, "the drag moved one track to the right");
    assert.equal(range.top, 2, "the pattern position never moves during a selection drag");
    assert.equal(range.bottom, 4);

    const up = controller.handle({ type: "pointerup" });
    assert.equal(up.openSelectionMenu, true);
});

test("a plain drag pans the view instead of selecting", () => {
    const controller = createGridController();
    controller.handle({ type: "pointerdown", rect: RECT, local: localFor(0), point: { x: 0, y: 0 } });
    controller.handle({ type: "drag", rect: RECT, delta: { x: 0, y: -LINE_HEIGHT * 3 } });
    assert.equal(SongDoc.hasSelection(), false, "a plain drag never selects");
    assert.equal(SongDoc.getCurrentPatternPos(), 5, "dragging up moves the position forward");
    const up = controller.handle({ type: "pointerup" });
    assert.equal(up.openSelectionMenu, false);
});

test("wheel moves the pattern position by one and stops at either end", () => {
    const controller = createGridController();
    const down = controller.handle({ type: "wheel", deltaY: 1 });
    assert.equal(down.handled, true);
    assert.equal(SongDoc.getCurrentPatternPos(), 3);
    controller.handle({ type: "wheel", deltaY: -1 });
    assert.equal(SongDoc.getCurrentPatternPos(), 2);

    SongDoc.setCurrentPatternPos(0);
    const atStart = controller.handle({ type: "wheel", deltaY: -1 });
    assert.equal(atStart.handled, false, "already at the first row; an ancestor should get the wheel");

    SongDoc.setCurrentPatternPos(SongDoc.getPatternLength() - 1);
    const atEnd = controller.handle({ type: "wheel", deltaY: 1 });
    assert.equal(atEnd.handled, false, "already at the last row");
});

test("wheel and drag no-op while the song is playing", () => {
    const original = Tracker.isPlaying;
    Tracker.isPlaying = () => true;
    try {
        const controller = createGridController();
        const before = SongDoc.getCurrentPatternPos();
        controller.handle({ type: "wheel", deltaY: 1 });
        assert.equal(SongDoc.getCurrentPatternPos(), before);

        controller.handle({ type: "pointerdown", rect: RECT, local: localFor(0), point: { x: 0, y: 0 } });
        controller.handle({ type: "drag", rect: RECT, delta: { x: 0, y: -LINE_HEIGHT * 3 } });
        assert.equal(SongDoc.getCurrentPatternPos(), before, "a plain pan drag also no-ops while playing");
    } finally {
        Tracker.isPlaying = original;
    }
});

test("keydown navigates the cursor and pattern position, and is ignored while unfocused", () => {
    const controller = createGridController();
    const unfocused = controller.handle({ type: "keydown", key: "ArrowDown" });
    assert.equal(unfocused.blocked, "unfocused");
    assert.equal(SongDoc.getCurrentPatternPos(), 2, "no change while unfocused");

    controller.handle({ type: "focus" });
    controller.handle({ type: "keydown", key: "ArrowDown" });
    assert.equal(SongDoc.getCurrentPatternPos(), 3);
    controller.handle({ type: "keydown", key: "ArrowUp" });
    assert.equal(SongDoc.getCurrentPatternPos(), 2);
    controller.handle({ type: "keydown", key: "Home" });
    assert.equal(SongDoc.getCurrentPatternPos(), 0);
    controller.handle({ type: "keydown", key: "End" });
    assert.equal(SongDoc.getCurrentPatternPos(), SongDoc.getPatternLength() - 1);

    SongDoc.setCurrentPatternPos(2);
    SongDoc.setCurrentCursorPosition(0);
    controller.handle({ type: "keydown", key: "ArrowRight" });
    assert.equal(SongDoc.getCurrentCursorPosition(), 1);
});

test("runSelectionCommand dispatches to domain/song's own selection primitives", () => {
    const controller = createGridController();
    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(1, 0);
    controller.runSelectionCommand("copy");
    assert.equal(SongDoc.hasClipboard(), true);
    controller.runSelectionCommand("clear");
    assert.equal(SongDoc.canUndo(), true);
    controller.runSelectionCommand("nonesuch"); // unknown command: no throw, no effect
});

test("disabled blocks pointerdown but still tracks focus, matching the button controller's convention", () => {
    const controller = createGridController({ disabled: true });
    const down = controller.handle({ type: "pointerdown", rect: RECT, local: localFor(0), point: { x: 0, y: 0 } });
    assert.equal(down.blocked, "disabled");
    assert.equal(controller.state.focused, true);
});

// --- spec 031: keyboard note entry ------------------------------------------

function focused() {
    const controller = createGridController();
    controller.handle({ type: "focus" });
    return controller;
}

test("a mapped note key does nothing while not recording, and writes once recording is on", () => {
    const controller = focused();
    SongDoc.setCurrentTrackPosition(0);
    const before = SongDoc.getPattern(SongDoc.getCurrentPattern())[SongDoc.getCurrentPatternPos()][0].period;

    const off = controller.handle({ type: "keydown", key: "z", code: "KeyZ" });
    assert.equal(off.handled, false, "not recording: unhandled, not silently swallowed");
    assert.equal(SongDoc.getPattern(SongDoc.getCurrentPattern())[2][0].period, before);

    SongDoc.setRecording(true);
    const row = SongDoc.getCurrentPatternPos();
    const on = controller.handle({ type: "keydown", key: "z", code: "KeyZ" });
    assert.equal(on.handled, true);
    assert.notEqual(SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].period, before);
    assert.equal(SongDoc.getCurrentPatternPos(), row + 1, "advances one row");
});

test("a repeated (OS auto-repeat) note key is ignored, and an unmapped key is unhandled", () => {
    const controller = focused();
    SongDoc.setRecording(true);
    SongDoc.setCurrentTrackPosition(0);
    const row = SongDoc.getCurrentPatternPos();

    const repeated = controller.handle({ type: "keydown", key: "z", code: "KeyZ", repeat: true });
    assert.equal(repeated.handled, true, "consumed, so it does not fall through, but nothing is written");
    assert.equal(SongDoc.getCurrentPatternPos(), row, "no row advance from a repeat");

    const unmapped = controller.handle({ type: "keydown", key: "a", code: "KeyA" });
    assert.equal(unmapped.handled, false);
});

test("Ctrl/Cmd held on a letter is never treated as a note or hex digit, recording or not", () => {
    const controller = focused();
    SongDoc.setCurrentTrackPosition(0);
    const before = SongDoc.getPattern(SongDoc.getCurrentPattern())[SongDoc.getCurrentPatternPos()][0].period;
    SongDoc.setRecording(true);

    const result = controller.handle({ type: "keydown", key: "z", code: "KeyZ", ctrlKey: true });
    assert.equal(result.handled, false);
    assert.equal(SongDoc.getPattern(SongDoc.getCurrentPattern())[2][0].period, before, "no note written");
});

test("hex entry edits the instrument column's nibbles and advances", () => {
    const controller = focused();
    SongDoc.setRecording(true);
    const row = SongDoc.getCurrentPatternPos();
    SongDoc.setCurrentTrackPosition(1); // instrument high nibble
    const highResult = controller.handle({ type: "keydown", key: "3" });
    assert.equal(highResult.handled, true);
    SongDoc.setCurrentPatternPos(row); // putNoteParam's advance moved the row; edit the same cell's low nibble
    SongDoc.setCurrentTrackPosition(2); // instrument low nibble
    controller.handle({ type: "keydown", key: "a" });
    const note = SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0];
    assert.equal(note.instrument, 0x3a);

    const rejected = controller.handle({ type: "keydown", key: "!" });
    assert.equal(rejected.handled, false);
});

test("FastTracker mode: the volume column's mnemonics and the effect column's base-36 letters", () => {
    return load("sin.xm").then(() => {
        SongDoc.setCurrentPattern(0);
        SongDoc.setCurrentPatternPos(2);
        SongDoc.setCurrentTrack(0);
        SongDoc.setRecording(true);
        const controller = focused();
        const row = SongDoc.getCurrentPatternPos();

        SongDoc.setCurrentTrackPosition(3); // FT volume column
        controller.handle({ type: "keydown", key: "d" }); // volume slide down mnemonic -> 7 (resolveColumnValue's own value)
        const viaKey = SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].volumeEffect;

        // Same resolved value (7), written directly through the already-
        // tested putNoteParam (spec 028) - this only checks that the
        // mnemonic key routes to the same call, not putNoteParam's own bit
        // packing, which is that spec's concern, not this one's.
        SongDoc.setCurrentPatternPos(row);
        SongDoc.putNoteParam(3, 7);
        const viaDirectCall = SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].volumeEffect;
        assert.equal(viaKey, viaDirectCall);

        SongDoc.setCurrentPatternPos(row);
        SongDoc.setCurrentTrackPosition(5); // FT effect column
        controller.handle({ type: "keydown", key: "z" }); // base-36, not a note key here (column !== 0)
        const note = SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0];
        assert.equal(note.effect, parseInt("z", 36));
    });
});

test("Backspace clears the current column and steps forward; Ctrl/Cmd+Backspace removes the row and steps back", () => {
    const controller = focused();
    SongDoc.setRecording(true);
    SongDoc.setCurrentTrackPosition(0);
    SongDoc.putNote({ instrument: 5, period: 400 });
    const row = SongDoc.getCurrentPatternPos();

    const plain = controller.handle({ type: "keydown", key: "Backspace" });
    assert.equal(plain.handled, true);
    assert.equal(SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].period, 0, "the column was cleared");
    assert.equal(SongDoc.getCurrentPatternPos(), row + 1, "steps forward, matching v1's own direction");

    SongDoc.setCurrentPatternPos(row + 1);
    const before = SongDoc.getPattern(SongDoc.getCurrentPattern())[row + 1][0].period;
    const withModifier = controller.handle({ type: "keydown", key: "Backspace", ctrlKey: true });
    assert.equal(withModifier.handled, true);
    assert.equal(SongDoc.getCurrentPatternPos(), row, "steps back after removing the row");
    assert.equal(SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].period, before, "the next row shifted up");
});

test("Delete clears the current column and steps forward, without a Backspace/Ctrl+Backspace variant", () => {
    const controller = focused();
    SongDoc.setRecording(true);
    SongDoc.setCurrentTrackPosition(0);
    SongDoc.putNote({ instrument: 5, period: 400 });
    const row = SongDoc.getCurrentPatternPos();

    const result = controller.handle({ type: "keydown", key: "Delete" });
    assert.equal(result.handled, true);
    assert.equal(SongDoc.getPattern(SongDoc.getCurrentPattern())[row][0].period, 0);
    assert.equal(SongDoc.getCurrentPatternPos(), row + 1);
});

test("Ctrl/Cmd+Enter inserts a row and steps forward, while recording", () => {
    const controller = focused();
    const rowThree = SongDoc.getPattern(SongDoc.getCurrentPattern())[3][0];
    const before = { instrument: rowThree.instrument, period: rowThree.period };
    SongDoc.setCurrentPatternPos(3);
    SongDoc.setCurrentTrack(0);

    const notRecording = controller.handle({ type: "keydown", key: "Enter", ctrlKey: true });
    assert.equal(notRecording.handled, false, "insert requires recording, matching togglePlay's own claim on a plain Enter elsewhere");

    SongDoc.setRecording(true);
    const result = controller.handle({ type: "keydown", key: "Enter", ctrlKey: true });
    assert.equal(result.handled, true);
    assert.equal(SongDoc.getCurrentPatternPos(), 4);
    const shifted = SongDoc.getPattern(SongDoc.getCurrentPattern())[4][0];
    assert.equal(shifted.period, before.period);
});

test("Ctrl/Cmd+ArrowLeft/Right jump a full track, wrapping at the song's track bounds", () => {
    const controller = focused();
    assert.equal(SongDoc.getTrackCount(), 4, "wizballalt.mod has 4 tracks");
    SongDoc.setCurrentTrack(3);
    SongDoc.setCurrentTrackPosition(0);

    controller.handle({ type: "keydown", key: "ArrowRight", ctrlKey: true });
    assert.equal(SongDoc.getCurrentTrack(), 0, "wraps from the last track to the first");

    controller.handle({ type: "keydown", key: "ArrowLeft", ctrlKey: true });
    assert.equal(SongDoc.getCurrentTrack(), 3, "wraps back");
});

test("Ctrl/Cmd+ArrowDown grows a selection the same way a mouse drag does, and a plain arrow afterward leaves it untouched", () => {
    const controller = focused();
    SongDoc.setCurrentPatternPos(2);
    SongDoc.setCurrentTrack(1);

    controller.handle({ type: "keydown", key: "ArrowDown", ctrlKey: true });
    controller.handle({ type: "keydown", key: "ArrowDown", ctrlKey: true });
    const range = SongDoc.getSelectionRange();
    assert.equal(range.top, 2);
    assert.equal(range.bottom, 4);
    assert.equal(range.left, 1);
    assert.equal(range.right, 1);

    controller.handle({ type: "keydown", key: "ArrowDown" });
    assert.deepEqual(SongDoc.getSelectionRange(), range, "released the modifier: the selection is untouched");
});

test("Escape clears the grid's own selection", () => {
    const controller = focused();
    SongDoc.beginSelection(0, 0);
    SongDoc.extendSelection(2, 1);
    assert.equal(SongDoc.hasSelection(), true);

    const result = controller.handle({ type: "keydown", key: "Escape" });
    assert.equal(result.handled, true);
    assert.equal(SongDoc.hasSelection(), false);

    const again = controller.handle({ type: "keydown", key: "Escape" });
    assert.equal(again.handled, false, "nothing to clear the second time");
});

test("NOTE-010: ArrowUp/ArrowDown wrap at the pattern's ends, matching Tracker.moveCurrentPatternPos", () => {
    const controller = focused();
    SongDoc.setCurrentPatternPos(0);
    controller.handle({ type: "keydown", key: "ArrowUp" });
    assert.equal(SongDoc.getCurrentPatternPos(), SongDoc.getPatternLength() - 1, "wraps to the last row");

    controller.handle({ type: "keydown", key: "ArrowDown" });
    assert.equal(SongDoc.getCurrentPatternPos(), 0, "wraps back to the first row");
});

test("NOTE-010: PageUp/PageDown jump to the nearest quarter-pattern boundary, clamped at either end", () => {
    const controller = focused();
    const length = SongDoc.getPatternLength();
    const step = Math.floor(length / 4) || 1;

    SongDoc.setCurrentPatternPos(0);
    controller.handle({ type: "keydown", key: "PageDown" });
    assert.equal(SongDoc.getCurrentPatternPos(), step, "not already on a boundary: rounds up to the next one");
    controller.handle({ type: "keydown", key: "PageDown" });
    assert.equal(SongDoc.getCurrentPatternPos(), step * 2, "already on a boundary: steps one further");

    SongDoc.setCurrentPatternPos(length - 1);
    controller.handle({ type: "keydown", key: "PageDown" });
    assert.equal(SongDoc.getCurrentPatternPos(), length - 1, "clamped at the last row, never wraps");
});

test("F1-F7 select an octave, clamped to the current format's range", () => {
    const controller = focused();
    controller.handle({ type: "keydown", key: "F1" });
    assert.equal(SongDoc.getCurrentOctave(), 1);

    controller.handle({ type: "keydown", key: "F5" });
    assert.equal(SongDoc.getCurrentOctave(), 1, "ProTracker mode: 5 is out of [1,3], silently ignored");

    controller.handle({ type: "keydown", key: "F3" });
    assert.equal(SongDoc.getCurrentOctave(), 3);
});
