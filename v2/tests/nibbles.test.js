import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as Nibbles from "../domain/nibbles/index.js";

// Spec 047: the game engine, headless. No domain/playback/, no domain/song/
// - Nibbles shares nothing with the tracker's own document model.

beforeEach(() => {
    Nibbles.setWrap(false);
    Nibbles.setDifficulty(1); // "Average", 100ms
    Nibbles.resetGame();
});

test("resetGame starts at level 1 with 5 lives and 0 score, playing", () => {
    const status = Nibbles.getStatus();
    assert.equal(status.level, 1);
    assert.equal(status.lives, 5);
    assert.equal(status.score, 0);
    assert.equal(status.state, Nibbles.GAME_STATE.PLAYING);
});

test("level 1's own start point is where the snake begins", () => {
    assert.deepEqual(Nibbles.getSnakeHead(), { x: 36, y: 12 });
});

test("move() ignores an exact U-turn, queuing anything else", () => {
    // level 1's own snake starts facing left (nibbles.js's own default, 123)
    const before = Nibbles.getSnakeHead();
    Nibbles.move("right"); // the exact opposite of "left" - ignored
    Nibbles.update();
    assert.equal(Nibbles.getSnakeHead().x, before.x - 1, "still moved left, the U-turn request was dropped");
});

test("update() moves the snake head one cell per tick and ages the trail", () => {
    const before = Nibbles.getSnakeHead();
    Nibbles.update();
    const after = Nibbles.getSnakeHead();
    assert.deepEqual(after, { x: before.x - 1, y: before.y }); // facing left
    assert.equal(Nibbles.getCellView(after.x, after.y).kind, "snake");
});

test("update() does nothing while not playing", () => {
    Nibbles.pauseGame();
    const before = Nibbles.getSnakeHead();
    Nibbles.update();
    assert.deepEqual(Nibbles.getSnakeHead(), before);
});

test("running off the grid without wrap loses a life", () => {
    // level 1's snake faces left at x=36 with no walls in the way; 37 ticks
    // reaches the left edge and the 37th steps off it.
    for (let i = 0; i < 40; i++) Nibbles.update();
    const status = Nibbles.getStatus();
    assert.equal(status.lives, 4);
    assert.equal(status.state, Nibbles.GAME_STATE.LOST);
});

test("primaryAction after a loss (\"Try Again\") restarts the same level's own snake position", () => {
    // Ported behavior, not assumed: nibbles.js's own lost() never resets the
    // snake itself - only its own "Try Again" button click (game.onClick's
    // LOST case, calling game.start() again) does, matching primaryAction() here.
    for (let i = 0; i < 40; i++) Nibbles.update();
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.LOST);
    Nibbles.primaryAction();
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING);
    assert.deepEqual(Nibbles.getSnakeHead(), { x: 36, y: 12 }, "level 1's own start point again");
});

test("wrap carries the snake to the opposite edge instead of losing a life", () => {
    Nibbles.setWrap(true);
    Nibbles.resetGame();
    for (let i = 0; i < 37; i++) Nibbles.update(); // 36 steps reaches x=0, the 37th wraps to x=39
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING);
    assert.equal(Nibbles.getSnakeHead().x, 39);
});

test("primaryAction dispatches per state, matching nibbles.js's own onClick", () => {
    Nibbles.pauseGame();
    Nibbles.primaryAction();
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING, "paused -> resume");

    Nibbles.primaryAction();
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PAUSED, "playing -> pause");
});

test("getStatus shows no overlay text while actively playing, matching nibbles.js's own hideInfo() on start", () => {
    assert.deepEqual([Nibbles.getStatus().statusText, Nibbles.getStatus().buttonLabel], [null, null]);
});

test("getStatus's own text and button label match nibbles.js's own showInfo call sites, per state", () => {
    Nibbles.pauseGame();
    assert.deepEqual([Nibbles.getStatus().statusText, Nibbles.getStatus().buttonLabel], ["Game Paused", "Resume"]);
});

// --- scenarios that need a snake to actually reach its own food -------------
// By the 9th catch the snake is ~109 segments long (snakeLength()'s own
// formula) on a 600-cell grid - any heuristic ("walk toward the food",
// "prefer open space") can still occasionally wall a long snake into a
// pocket smaller than its own body, since food is placed uniformly at
// random and a heuristic has no way to guarantee it never paints itself
// into a corner. Rather than fight that, this walker follows a fixed
// Hamiltonian cycle over all 600 cells of the (even-width) 40x15 grid: a
// snake that only ever steps to "the next cell in a cycle that visits
// every cell exactly once" can never collide with itself, by construction
// - by the time the cycle returns to any given cell, up to 599 other
// cells have been visited since, far more than the longest snake this
// engine ever produces. Food is eaten opportunistically as the cycle
// happens to pass over it - no pathing "toward" it is needed at all.
//
// The cycle (reserving row 0 as a return spine, sweeping columns 1..39
// vertically through rows 1..14, alternating direction each column - see
// the construction below) was verified by hand before use: 15 + 39*14 + 39
// = 600 cells, exactly once each, with every consecutive pair adjacent.

function buildHamiltonianCycle(width, height) {
    const cycle = [];
    for (let y = 0; y <= height - 1; y++) cycle.push({ x: 0, y }); // column 0, top to bottom
    for (let x = 1; x < width; x++) {
        if (x % 2 === 1) for (let y = height - 1; y >= 1; y--) cycle.push({ x, y }); // odd column: sweep up
        else for (let y = 1; y <= height - 1; y++) cycle.push({ x, y }); // even column: sweep down
    }
    for (let x = width - 1; x >= 1; x--) cycle.push({ x, y: 0 }); // row 0, back to (0,0)
    return cycle;
}

const HAM_CYCLE = buildHamiltonianCycle(Nibbles.GRID_WIDTH, Nibbles.GRID_HEIGHT);
const HAM_INDEX = new Map(HAM_CYCLE.map((p, i) => [`${p.x},${p.y}`, i]));

test("the test's own Hamiltonian cycle really does visit every cell exactly once, each step adjacent to the last", () => {
    assert.equal(HAM_CYCLE.length, Nibbles.GRID_WIDTH * Nibbles.GRID_HEIGHT);
    assert.equal(HAM_INDEX.size, HAM_CYCLE.length, "no cell repeated");
    for (let i = 0; i < HAM_CYCLE.length; i++) {
        const a = HAM_CYCLE[i], b = HAM_CYCLE[(i + 1) % HAM_CYCLE.length];
        const manhattan = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        assert.equal(manhattan, 1, `cycle[${i}] -> cycle[${(i + 1) % HAM_CYCLE.length}] is a single adjacent step`);
    }
});

function findFood() {
    for (let y = 0; y < Nibbles.GRID_HEIGHT; y++) {
        for (let x = 0; x < Nibbles.GRID_WIDTH; x++) {
            if (Nibbles.getCellView(x, y).kind === "food") return { x, y };
        }
    }
    return null;
}

function directionTo(from, to) {
    if (to.x > from.x) return "right";
    if (to.x < from.x) return "left";
    if (to.y > from.y) return "down";
    return "up";
}

function stepOnce() {
    const head = Nibbles.getSnakeHead();
    const index = HAM_INDEX.get(`${head.x},${head.y}`);
    assert.ok(index !== undefined, `snake head ${JSON.stringify(head)} is on the cycle`);
    const next = HAM_CYCLE[(index + 1) % HAM_CYCLE.length];
    Nibbles.move(directionTo(head, next));
    Nibbles.update();
}

/**
 * Runs until the current food is actually eaten - detected by its own cell
 * moving to a new position, not by score changing (score also decays by 1
 * on every ordinary tick, so "score changed" is true after a single tick
 * regardless of eating and falsely declares victory immediately - a real
 * bug this test itself had until caught here).
 */
function eatOneFood() {
    const startFood = findFood();
    const key = p => p && `${p.x},${p.y}`;
    let guard = 0;
    while (key(findFood()) === key(startFood) && Nibbles.getStatus().state === Nibbles.GAME_STATE.PLAYING && guard++ < HAM_CYCLE.length + 10) {
        stepOnce();
    }
}

test("eating the current number increments score by v1's own formula and never dies on an open level", () => {
    eatOneFood();
    const status = Nibbles.getStatus();
    assert.equal(status.state, Nibbles.GAME_STATE.PLAYING);
    // currentNumber was 1 before eating, becomes 2; frameTime is 100 ("Average");
    // one point is then spent by the same tick's own end-of-update decrement.
    const expected = 1000 + (200 - 100) * 2 * 2 - 1;
    assert.equal(status.score, expected);
});

test("winning a level (eating all 9 numbers) advances the level and adds a life", () => {
    // currentNumber starts at 1; catches 1-8 take it to 9 and each scores normally.
    // The 9th catch takes it past 9 and wins instead - see below.
    for (let i = 0; i < 8; i++) {
        eatOneFood();
        assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING, `still playing after eating number ${i + 1}`);
    }
    // The winning catch never places a new food (won() returns before
    // placeNumber() would run again), so eatOneFood()'s own
    // food-cell-moved guard would spin forever waiting for it - drive this
    // last step directly instead, stopping on the state transition itself.
    let guard = 0;
    while (Nibbles.getStatus().state === Nibbles.GAME_STATE.PLAYING && guard++ < 2000) {
        stepOnce();
    }
    const status = Nibbles.getStatus();
    assert.equal(status.state, Nibbles.GAME_STATE.WON);
    assert.equal(status.level, 2);
    assert.equal(status.lives, 6);
    assert.equal(status.buttonLabel, "Start Level 2");
});

test("losing all 5 lives ends the game", () => {
    for (let life = 0; life < 5; life++) {
        let guard = 0;
        while (Nibbles.getStatus().state === Nibbles.GAME_STATE.PLAYING && guard++ < 200) {
            Nibbles.move("left");
            Nibbles.update();
        }
        if (Nibbles.getStatus().state === Nibbles.GAME_STATE.LOST) Nibbles.primaryAction(); // "Try Again"
    }
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.GAMEOVER);
    assert.equal(Nibbles.getStatus().lives, 0);
});

// --- the screen's own view-switch wiring (spec 048; corrected by spec 070's
// own UI-alignment pass, step 6 - Nibbles renders inside the song-properties
// section's own bounded strip, the same slot File Operations/Options share,
// not a full main-content-area replacement) -------------------------------

test("openNibblesView shows Nibbles in the song-properties section, and closes Sample Edit (matching v1's own single \"main\" showView broadcast)", () => {
    const store = new Map();
    const app = { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) } };
    store.set("pattern-section-view.value", "Sample Edit");
    Nibbles.openNibblesView(app);
    assert.equal(store.get("song-properties-view.value"), "Nibbles");
    assert.equal(store.get("pattern-section-view.value"), "", "Sample Edit closes too - v1's own COMMAND.nibbles broadcasts showView(\"main\") first, which both appMainPanel.js and patternPanel.js treat as a reset");
});

test("showMain resets both the song-properties and pattern-section fields back to \"\"", () => {
    const store = new Map();
    const app = { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) } };
    Nibbles.openNibblesView(app);
    Nibbles.showMain(app);
    assert.equal(store.get("song-properties-view.value"), "");
    assert.equal(store.get("pattern-section-view.value"), "");
});

// --- the screen's own remaining capability surface (spec 049) --------------

function fakeApp() {
    const store = new Map();
    return { app: { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) } }, store };
}

test("openNibblesView also seeds nibbles-view.value to \"game\" and resets to idle", () => {
    Nibbles.startGame(1);
    Nibbles.pauseGame();
    const { app, store } = fakeApp();
    Nibbles.openNibblesView(app);
    assert.equal(store.get("nibbles-view.value"), "game");
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.IDLE);
});

test("resetToIdle: reopening after a finished game always starts fresh at \"Ready Player 1?\", regardless of how the previous session ended", () => {
    // Play to game-over (reusing the same left-into-the-wall loop the
    // dedicated game-over test above already established), then reopen.
    for (let life = 0; life < 5; life++) {
        let guard = 0;
        while (Nibbles.getStatus().state === Nibbles.GAME_STATE.PLAYING && guard++ < 200) {
            Nibbles.move("left");
            Nibbles.update();
        }
        if (Nibbles.getStatus().state === Nibbles.GAME_STATE.LOST) Nibbles.primaryAction();
    }
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.GAMEOVER);

    const { app } = fakeApp();
    Nibbles.openNibblesView(app);
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.IDLE);
    assert.equal(Nibbles.getStatus().statusText, "Ready Player 1?");
});

test("publishStatus publishes score/lives/level/status-text/button-label/info-visible, matching getStatus()", () => {
    const { app, store } = fakeApp();
    Nibbles.pauseGame();
    Nibbles.publishStatus(app);
    const status = Nibbles.getStatus();
    assert.equal(store.get("nibbles-score.value"), status.score);
    assert.equal(store.get("nibbles-lives.value"), status.lives);
    assert.equal(store.get("nibbles-level.value"), status.level);
    assert.equal(store.get("nibbles-status-text.value"), status.statusText);
    assert.equal(store.get("nibbles-button-label.value"), status.buttonLabel);
    assert.equal(store.get("nibbles-info-visible.value"), true);
});

test("publishStatus reports info-visible as false while actively playing", () => {
    const { app, store } = fakeApp();
    Nibbles.publishStatus(app);
    assert.equal(store.get("nibbles-info-visible.value"), false);
});

test("startNibbles runs primaryAction() and republishes immediately", () => {
    const { app, store } = fakeApp();
    Nibbles.pauseGame();
    Nibbles.startNibbles(app);
    assert.equal(Nibbles.getStatus().state, Nibbles.GAME_STATE.PLAYING, "paused -> resume, matching primaryAction()'s own dispatch");
    assert.equal(store.get("nibbles-button-label.value"), "", "republished immediately - no info panel while playing");
});

test("toggleWrap/toggleGrid flip by default and accept an explicit boolean, publishing back", () => {
    const { app, store } = fakeApp();
    Nibbles.setWrap(false);
    Nibbles.toggleWrap(app);
    assert.equal(Nibbles.getWrap(), true);
    assert.equal(store.get("wrap.active"), true);
    Nibbles.toggleWrap(app, { value: false });
    assert.equal(Nibbles.getWrap(), false);

    Nibbles.setShowGrid(false);
    Nibbles.toggleGrid(app);
    assert.equal(Nibbles.getShowGrid(), true);
    assert.equal(store.get("grid.active"), true);
    Nibbles.setShowGrid(true); // restore for later tests
});

test("setNibblesDifficulty maps each label to its own index; an unrecognized label is a no-op", () => {
    const { app, store } = fakeApp();
    assert.equal(Nibbles.setNibblesDifficulty(app, { value: "Triton" }), true);
    assert.equal(Nibbles.getFrameTime(), 40);
    assert.equal(store.get("difficulty.value"), "Triton");

    assert.equal(Nibbles.setNibblesDifficulty(app, { value: "Novice" }), true);
    assert.equal(Nibbles.getFrameTime(), 180);

    assert.equal(Nibbles.setNibblesDifficulty(app, { value: "Nonesuch" }), false);
    assert.equal(Nibbles.getFrameTime(), 180, "unchanged by the unrecognized label");

    Nibbles.setDifficulty(1); // restore "Average" for later tests
});

test("toggleHighScoreView flips nibbles-view.value and publishes the real table on the way in", () => {
    const { app, store } = fakeApp();
    store.set("nibbles-view.value", "game");

    assert.equal(Nibbles.toggleHighScoreView(app), "highscore");
    assert.equal(store.get("nibbles-view.value"), "highscore");
    assert.equal(store.get("nibbles-highscore-row-1.value"), "1. Vogue - 2000000");
    assert.equal(store.get("nibbles-highscore-row-10.value"), "10. Aceman - 4000");

    assert.equal(Nibbles.toggleHighScoreView(app), "game");
    assert.equal(store.get("nibbles-view.value"), "game");
});

test("toggleHighScoreView formats every one of v1's own ten seed entries exactly", () => {
    // toggleHighScoreView always reads the real storage backend (no
    // injectable seam through the capability layer, unlike
    // getHighScores(storage) itself, already tested with a fewer-than-ten
    // table in tests/nibblesHighscores.test.js) - against a fresh,
    // never-written store, that is v1's own seed table.
    const { app, store } = fakeApp();
    store.set("nibbles-view.value", "game");
    Nibbles.toggleHighScoreView(app);
    const expected = [
        "1. Vogue - 2000000", "2. Mr. H - 2000000", "3. Steffest - 1000000", "4. LizardKing - 100000",
        "5. Jogeir - 90000", "6. Dr. Awesome - 80000", "7. 4mat - 70000", "8. Romeo Knight - 60000",
        "9. HoffMan - 5000", "10. Aceman - 4000"
    ];
    expected.forEach((text, i) => assert.equal(store.get(`nibbles-highscore-row-${i + 1}.value`), text));
});
