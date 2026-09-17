import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNibblesController } from "../runtime/nibblesController.js";
import * as Nibbles from "../domain/nibbles/index.js";

// Spec 047: the controller's own input handling and tick accumulator,
// against the real domain engine (mirroring gridController.test.js's own
// convention of exercising a real controller against real domain state,
// not a mock).

beforeEach(() => {
    Nibbles.setWrap(false);
    Nibbles.setDifficulty(1); // "Average", 100ms
    Nibbles.resetGame();
});

test("pointerdown focuses; keydown before focus is blocked", () => {
    const controller = createNibblesController();
    const r1 = controller.handle({ type: "keydown", key: "ArrowLeft" });
    assert.equal(r1.handled, false);
    assert.equal(r1.blocked, "unfocused");

    controller.handle({ type: "pointerdown" });
    assert.equal(controller.state.focused, true);
});

test("arrow keys move the snake once focused", () => {
    const controller = createNibblesController();
    controller.handle({ type: "focus" });
    const before = Nibbles.getSnakeHead();

    const result = controller.handle({ type: "keydown", key: "ArrowUp" });
    assert.equal(result.handled, true);
    Nibbles.update();
    assert.deepEqual(Nibbles.getSnakeHead(), { x: before.x, y: before.y - 1 });
});

test("Enter runs the game's own primary action", () => {
    const controller = createNibblesController();
    controller.handle({ type: "focus" });
    Nibbles.pauseGame();

    controller.handle({ type: "keydown", key: "Enter" });
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING);
});

test("an unrecognized key is not handled", () => {
    const controller = createNibblesController();
    controller.handle({ type: "focus" });
    const result = controller.handle({ type: "keydown", key: "a" });
    assert.equal(result.handled, false);
});

test("a disabled controller blocks both pointerdown and keydown", () => {
    const controller = createNibblesController({ disabled: true });
    controller.handle({ type: "focus" });
    const down = controller.handle({ type: "pointerdown" });
    assert.equal(down.blocked, "disabled");
    const key = controller.handle({ type: "keydown", key: "ArrowLeft" });
    assert.equal(key.blocked, "disabled");
});

test("setDisabled toggles the blocked reason", () => {
    const controller = createNibblesController();
    controller.handle({ type: "focus" });
    controller.setDisabled(true);
    assert.equal(controller.handle({ type: "keydown", key: "Enter" }).blocked, "disabled");
    controller.setDisabled(false);
    assert.equal(controller.handle({ type: "keydown", key: "Enter" }).handled, true);
});

test("onFrame calls update() exactly once per whole difficulty-tick interval, carrying the remainder forward", () => {
    const controller = createNibblesController();
    const before = Nibbles.getSnakeHead();

    controller.onFrame(99); // just under 100ms ("Average") - no tick yet
    assert.deepEqual(Nibbles.getSnakeHead(), before);

    controller.onFrame(2); // 101ms accumulated - exactly one tick, 1ms carried forward
    assert.deepEqual(Nibbles.getSnakeHead(), { x: before.x - 1, y: before.y });

    controller.onFrame(199); // 200ms more accumulated - exactly two ticks
    assert.deepEqual(Nibbles.getSnakeHead(), { x: before.x - 3, y: before.y });
});

test("onFrame does nothing while the controller is disabled", () => {
    const controller = createNibblesController({ disabled: true });
    const before = Nibbles.getSnakeHead();
    controller.onFrame(1000);
    assert.deepEqual(Nibbles.getSnakeHead(), before);
});

test("onFrame is harmless while the game itself is not playing - update() no-ops internally", () => {
    Nibbles.pauseGame();
    const controller = createNibblesController();
    const before = Nibbles.getSnakeHead();
    controller.onFrame(1000);
    assert.deepEqual(Nibbles.getSnakeHead(), before);
});
