// Nibbles: the game engine (spec 047), package P10's second named tenant
// (open decision 3). Ported from script/plugins/games/nibbles/nibbles.js's
// own Game() (78-680), read in full for this spec. The first genuinely
// independent domain this port has added - nothing here imports
// domain/playback/, domain/song/, or any other tracker-specific module.
//
// The grid is fixed at 40x15 cells (the level layouts' own native size),
// not derived from any window or leaf pixel size the way v1's own
// game.resize() computes it - see requirements.md's Decisions and
// assumptions. Level data comes from ./levels.js, generated once, offline,
// by tools/nibblesLevels.mjs from the real level-sprite PNG - never decoded
// at runtime the way v1's own getLevelSprite() does.
//
// Unlike v1's single overloaded `map` array (0 empty, 1-9 food, 10+ wall
// indexed into a session-wide accumulating color table, 1000+ snake body
// doubling as its own age), this module keeps a level's own wall layout and
// palette as static data (never copied into a mutable per-cell structure)
// and only the food/snake state as dynamic, reset every new level.

import { LEVELS } from "./levels.js";
import { getHighScores } from "./highscores.js";

export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 15;

export const GAME_STATE = { IDLE: "idle", PLAYING: "playing", PAUSED: "paused", WON: "won", LOST: "lost", GAMEOVER: "gameover" };

const DIRECTIONS = { LEFT: "left", UP: "up", RIGHT: "right", DOWN: "down" };
const OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };

// Novice/Average/Pro/Triton - nibbles.js's own radioGroup.onChange (766-772).
const DIFFICULTY_FRAME_TIMES = [180, 100, 75, 40];
const DEFAULT_DIFFICULTY_INDEX = 1; // "Average", the item nibbles.js marks active: true (762)

let level = 1;
let lives = 5;
let score = 0;
let currentNumber = 1;
let direction = DIRECTIONS.LEFT;
let nextDirection = null;
let state = GAME_STATE.IDLE;
let wrap = false;
let difficultyIndex = DEFAULT_DIFFICULTY_INDEX;
let snakeHead = { x: 0, y: 0 };
let snakeAge = new Map(); // "x,y" -> age (1 = head-most segment just laid down)
let numberCell = null; // {x, y} | null
let wallColor = new Map(); // "x,y" -> "r,g,b"
let wallSet = new Set(); // "x,y", redundant with wallColor's own keys, kept for a name-free O(1) check

function key(x, y) {
    return x + "," + y;
}

function snakeLength() {
    const c = currentNumber - 1;
    return Math.floor(5 + c * (1 + c * 1.5));
}

function placeNumber() {
    // Real levels always leave open floor far short of all 600 cells, so
    // this always terminates - matching nibbles.js's own unguarded
    // do/while (placeNumber, 653-663).
    let x, y;
    do {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
    } while (wallSet.has(key(x, y)) || snakeAge.has(key(x, y)));
    numberCell = { x, y };
}

/** Ported from nibbles.js's own game.setLevel/getLevelSprite (403-446, 557-575) - reading LEVELS instead of decoding a sprite. */
function loadLevel(n) {
    level = Math.max(1, Math.min(30, n));
    const data = LEVELS[level - 1];
    wallSet = new Set(data.cells.map(([x, y]) => key(x, y)));
    wallColor = new Map(data.cells.map(([x, y, c]) => [key(x, y), data.colors[c]]));
    snakeHead = { x: data.start.x, y: data.start.y };
    snakeAge = new Map([[key(snakeHead.x, snakeHead.y), 1]]);
    direction = DIRECTIONS.LEFT;
    nextDirection = null;
    currentNumber = 1;
    numberCell = null;
    placeNumber();
}

/** Ported from nibbles.js's own game.reset (113-118). */
export function resetGame() {
    lives = 5;
    score = 0;
    startGame(1);
}

/** Ported from nibbles.js's own game.start (120-146), minus every UI/layout side effect. */
export function startGame(startLevel = level) {
    loadLevel(startLevel);
    state = GAME_STATE.PLAYING;
}

export function pauseGame() {
    if (state === GAME_STATE.PLAYING) state = GAME_STATE.PAUSED;
}

export function resumeGame() {
    if (state === GAME_STATE.PAUSED) state = GAME_STATE.PLAYING;
}

/**
 * Ported from nibbles.js's own game.onClick (384-401) - the single button's
 * own state-dependent dispatch. LOST/WON/IDLE all just (re)start at
 * whatever `level` already is - `lost()` leaves it untouched (retry the
 * same level) and `won()` already advanced it, so no branch needs its own
 * special-cased level number, matching v1's own single `game.start()` call
 * for all three.
 */
export function primaryAction() {
    switch (state) {
        case GAME_STATE.LOST:
        case GAME_STATE.WON:
        case GAME_STATE.IDLE:
            startGame(level);
            break;
        case GAME_STATE.PAUSED:
            resumeGame();
            break;
        case GAME_STATE.PLAYING:
            pauseGame();
            break;
        case GAME_STATE.GAMEOVER:
            resetGame();
            break;
    }
}

/** Ported from nibbles.js's own game.move (298-300) - blocks an exact U-turn, queued for the next update(). */
export function move(requested) {
    if (requested !== OPPOSITE[direction]) nextDirection = requested;
}

export function getFrameTime() {
    return DIFFICULTY_FRAME_TIMES[difficultyIndex];
}

export function setDifficulty(index) {
    difficultyIndex = Math.max(0, Math.min(DIFFICULTY_FRAME_TIMES.length - 1, Math.round(index) || 0));
}

export function setWrap(value) {
    wrap = Boolean(value);
}

export function getWrap() {
    return wrap;
}

function won() {
    state = GAME_STATE.WON;
    level = Math.min(level + 1, 30);
    lives++;
}

function lost() {
    lives--;
    state = lives <= 0 ? GAME_STATE.GAMEOVER : GAME_STATE.LOST;
}

/** Ported from nibbles.js's own game.update (223-296). No time parameter - one call is one tick; a controller decides when a tick has elapsed. */
export function update() {
    if (state !== GAME_STATE.PLAYING) return;
    if (nextDirection) direction = nextDirection;
    nextDirection = null;

    let { x, y } = snakeHead;
    if (direction === DIRECTIONS.LEFT) x--;
    else if (direction === DIRECTIONS.UP) y--;
    else if (direction === DIRECTIONS.RIGHT) x++;
    else if (direction === DIRECTIONS.DOWN) y++;

    // Ported exactly as v1's own if/else shape (223-272, not merely its
    // outcome): an off-grid, wrap-around move skips collision detection
    // entirely for that step - v1's own `else` branch (the only place a
    // wall/self/food check happens at all) never runs once the `if`
    // (off-grid) branch already has, wrapped or not. A wrapped move can
    // therefore never die or eat on the same step, matching v1 verbatim
    // rather than "fixing" an asymmetry not called out anywhere as a bug.
    let canMove = true;
    let ate = false;
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
        if (wrap) {
            if (x < 0) x = GRID_WIDTH - 1;
            if (x >= GRID_WIDTH) x = 0;
            if (y < 0) y = GRID_HEIGHT - 1;
            if (y >= GRID_HEIGHT) y = 0;
        } else {
            canMove = false;
        }
    } else if (wallSet.has(key(x, y))) {
        canMove = false;
    } else if (numberCell && numberCell.x === x && numberCell.y === y) {
        currentNumber++;
        if (currentNumber > 9) {
            won();
            return;
        }
        score += 1000 + (200 - getFrameTime()) * currentNumber * 2;
        ate = true;
    } else if (snakeAge.has(key(x, y))) {
        canMove = false; // self-collision
    }

    if (!canMove) {
        lost();
        return;
    }

    snakeHead = { x, y };
    snakeAge.set(key(x, y), 1);
    const maxAge = snakeLength() + 1;
    for (const [cellKey, age] of snakeAge) {
        const next = age + 1;
        if (next > maxAge) snakeAge.delete(cellKey);
        else snakeAge.set(cellKey, next);
    }

    // Placed after the head/aging update above (v1's own placeNumber() runs
    // earlier, before setCell() writes the new head - an incidental
    // ordering that happens to also avoid the new head's own cell, since
    // the old food digit briefly lingers there). Placing it here instead
    // achieves the same "never under a wall or the snake" guarantee
    // directly, via placeNumber()'s own snakeAge/wallSet checks, rather
    // than relying on a one-tick-stale map value.
    if (ate) placeNumber();
    if (score > 0) score--;
}

export function getSnakeHead() {
    return { ...snakeHead };
}

export function getDirection() {
    return direction;
}

export function getState() {
    return state;
}

/** The draw kind's only way to read the grid - it never touches the internal Maps/Sets directly. */
export function getCellView(x, y) {
    const k = key(x, y);
    if (snakeAge.has(k)) return { kind: "snake", age: snakeAge.get(k) };
    if (numberCell && numberCell.x === x && numberCell.y === y) return { kind: "food", number: currentNumber };
    if (wallColor.has(k)) return { kind: "wall", color: wallColor.get(k) };
    return { kind: "empty" };
}

// Ported from GameControls's own showInfo call sites (nibbles.js:152,170,182,185,398).
const STATUS_TEXT = {
    [GAME_STATE.IDLE]: "Ready Player 1?",
    [GAME_STATE.PAUSED]: "Game Paused",
    [GAME_STATE.WON]: "You made it!",
    [GAME_STATE.LOST]: "Boom! Player 1 died",
    [GAME_STATE.GAMEOVER]: "Game Over"
};
const BUTTON_LABEL = {
    [GAME_STATE.IDLE]: "Start",
    [GAME_STATE.PAUSED]: "Resume",
    [GAME_STATE.LOST]: "Try Again",
    [GAME_STATE.GAMEOVER]: "REMATCH"
};

/** A pure, derived accessor next to the rest of the state (see requirements.md) - the eventual screen binds to this rather than re-deriving the state-to-text mapping itself. */
export function getStatus() {
    const buttonLabel = state === GAME_STATE.WON ? `Start Level ${level}` : (BUTTON_LABEL[state] ?? null);
    return { state, level, lives, score, statusText: STATUS_TEXT[state] ?? null, buttonLabel };
}

// --- grid-lines cosmetic flag (spec 049) ------------------------------------
// Ported from nibbles.js's own showGrid (213-218) - purely a drawing choice
// (grid lines vs. a plain border, drawGrid()/drawBorder(), 618-651), no
// gameplay effect at all.

let showGrid = true;

export function getShowGrid() {
    return showGrid;
}

export function setShowGrid(value) {
    showGrid = Boolean(value);
}

// --- reopening always starts fresh (spec 049) -------------------------------

/**
 * Matches v1's own behavior: `renderTarget.onHide()` tears down the whole
 * `Game()`/`GameControls()` pair (nibbles.js:1286-1297), so the next
 * `Nibbles.init()` always constructs a brand-new `Game()` whose own `state`
 * starts at `GAMSESTATE.IDLE` by simple variable initialization. This
 * module is a persistent singleton instead, so `openNibblesView` calls this
 * explicitly rather than relying on a fresh module load - lives/score/level
 * and the high-score table are untouched, matching v1 exactly (only the
 * game *object* is rebuilt in v1; its own high-score table is a
 * module-level array read fresh from localStorage regardless).
 */
export function resetToIdle() {
    state = GAME_STATE.IDLE;
}

// --- publishing live status to ordinary field-bound controls (spec 049) ----
//
// Mirrors domain/playback/index.js#startObserving exactly: a self-
// perpetuating requestAnimationFrame loop, started by a capability call,
// publishing only to the state store. No existing specialized leaf's own
// controller has ever called app.state.set() directly, and this does not
// start now either - nibblesGrid's own onFrame (spec 047) still only
// drives the simulation, never the screen's own surrounding labels.

let observing = null;

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    app.state.set(field, value);
}

/** Exported so a test can verify what gets published without a real requestAnimationFrame (this environment has none headless - the same, already-recorded limitation domain/playback's own identical loop shape has). */
export function publishStatus(app) {
    const status = getStatus();
    publish(app, "nibbles-score.value", status.score ?? 0);
    publish(app, "nibbles-lives.value", status.lives ?? 0);
    publish(app, "nibbles-level.value", status.level ?? 1);
    publish(app, "nibbles-status-text.value", status.statusText || "");
    publish(app, "nibbles-button-label.value", status.buttonLabel || "");
    publish(app, "nibbles-info-visible.value", status.state !== GAME_STATE.PLAYING);
}

function startObservingStatus(app) {
    if (observing || typeof requestAnimationFrame !== "function") return;
    const step = () => {
        publishStatus(app);
        observing = requestAnimationFrame(step);
    };
    observing = requestAnimationFrame(step);
}

function stopObservingStatus() {
    if (observing && typeof cancelAnimationFrame === "function") cancelAnimationFrame(observing);
    observing = null;
}

// --- the screen's own remaining capability surface (spec 049) --------------

/** The screen's own single, state-dependent primary button - runs primaryAction() and republishes immediately, not waiting for the next animation frame. */
export function startNibbles(app) {
    primaryAction();
    publishStatus(app);
    if (app && app.log) app.log("nibbles.start", {});
}

export function toggleWrap(app, detail) {
    const next = detail && typeof detail.value === "boolean" ? detail.value : !getWrap();
    setWrap(next);
    publish(app, "wrap.active", next);
    if (app && app.log) app.log("wrap.toggle", { next });
    return next;
}

export function toggleGrid(app, detail) {
    const next = detail && typeof detail.value === "boolean" ? detail.value : !getShowGrid();
    setShowGrid(next);
    publish(app, "grid.active", next);
    if (app && app.log) app.log("grid.toggle", { next });
    return next;
}

// nibbles.js's own radioGroup.onChange (760-772), by label rather than index.
const DIFFICULTY_LABELS = ["Novice", "Average", "Pro", "Triton"];

export function setNibblesDifficulty(app, detail) {
    const index = DIFFICULTY_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    setDifficulty(index);
    publish(app, "difficulty.value", detail.value);
    if (app && app.log) app.log("difficulty.set", { index });
    return true;
}

/** Ported from nibbles.js's own game.showHighScore/hideHighScore (448-551), minus the level-sprite thumbnail and two-column layout - ten plain text rows instead (see requirements.md). */
function publishHighScoreRows(app) {
    const table = getHighScores();
    for (let i = 0; i < 10; i++) {
        const entry = table[i];
        publish(app, `nibbles-highscore-row-${i + 1}.value`, entry ? `${i + 1}. ${entry.name} - ${entry.score}` : "");
    }
}

export function toggleHighScoreView(app) {
    const current = app && app.state ? app.state.get("nibbles-view.value") : "game";
    const next = current === "highscore" ? "game" : "highscore";
    if (next === "highscore") publishHighScoreRows(app);
    if (app && app.state) app.state.set("nibbles-view.value", next);
    if (app && app.log) app.log("high-score-view.toggle", { next });
    return next;
}

// --- the screen's own view-switch wiring (spec 048, extended by 049; ------
// corrected by spec 070's own UI-alignment pass, step 6) ---------------------
//
// Neither of these is game logic - they are thin app.state.set() wrappers,
// the same shape spec 045/046 already put directly in
// domain/sampleEditor/index.js for their own screen's mode field.
//
// Originally these two set a since-retired field, main-view.value, on the
// (wrong) assumption that Nibbles replaces the whole main content area.
// Confirmed against v1's own real source and live in the browser that this
// was never true: Nibbles renders inside the song-properties section's own
// bounded strip, the exact same slot File Operations/Options share
// (appMainPanel.js's own pluginRenderHook, target "main", sized to that
// panel's own dimensions - not the whole screen). `openNibblesView` now
// writes song-properties-view.value, the real field domain/appView/index.js
// already introduced for that same slot in step 4/6. It also clears
// pattern-section-view.value (Sample Edit's own, separate slot) - v1's own
// COMMAND.nibbles handler broadcasts EVENT.showView("main") *before*
// loading the plugin, which both appMainPanel.js's and patternPanel.js's
// own independent listeners treat as "reset to default," closing whichever
// of the two each one owns. `showMain` (the View menu's "Main" item, and
// Nibbles' own in-game "Exit" button - both dispatch the identical
// command) ports that same "main" broadcast exactly: resetting both slots,
// not just the one this module owns.

/** The "Nibbles" menu item's own capability - opens the game inside the song-properties section's own bounded strip. */
export function openNibblesView(app) {
    resetToIdle();
    if (app && app.state) {
        app.state.set("song-properties-view.value", "Nibbles");
        app.state.set("pattern-section-view.value", "");
        app.state.set("nibbles-view.value", "game");
    }
    startObservingStatus(app);
    if (app && app.log) app.log("nibbles.open", {});
}

/** Ported from nibbles.js's own "Exit" button (GameControls's exitButton.onClick, 720-722) and the View menu's "Main" item (both dispatch COMMAND.showMain) - resets both sections at once, matching v1's own single "main" showView broadcast. */
export function showMain(app) {
    stopObservingStatus();
    if (app && app.state) {
        app.state.set("song-properties-view.value", "");
        app.state.set("pattern-section-view.value", "");
    }
    if (app && app.log) app.log("main.show", {});
}
