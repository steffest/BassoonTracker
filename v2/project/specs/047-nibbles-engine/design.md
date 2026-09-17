# 047 — Design

## Overview

```
tools/nibblesLevels.mjs (new, dev-time only)
  decodes assets/games/nibbles/src/levels.png (via skinAtlas.mjs#decodePng)
  writes domain/nibbles/levels.js: export const LEVELS = [ {start,colors,cells}, ... ]  (30 entries)

domain/nibbles/index.js (new)
  GRID_WIDTH = 40, GRID_HEIGHT = 15
  resetGame() / startGame() / loadLevel(n) / pauseGame() / resumeGame() / primaryAction()
  move(direction) / update()
  setWrap(bool) / setDifficulty(index) / getFrameTime()
  getCellView(x, y) -> { kind, color?, number?, age? }
  getSnakeHead() -> {x, y}
  getStatus() -> { state, level, lives, score, statusText, buttonLabel }

domain/nibbles/highscores.js (new, mirrors domain/settings/favorites.js)
  getHighScores() / qualifies(score) / insertHighScore(name, score, level)

runtime/nibblesController.js (new)
  createNibblesController(initial) -> { handle(input), setDisabled, onFrame(deltaMs), state }

renderers/canvas/drawKinds.js
  "nibblesGrid": measure() + draw() reading domain/nibbles directly

runtime/componentTypes.js
  nibblesGrid: { ..., behavior: "nibbles", draw: "nibblesGrid", ticks: true }
  isTickingType(type) - mirrors isAnimatedType

renderers/canvas/mountGeneric.js
  a second, independent requestAnimationFrame clock (ticksClock) alongside
  the existing sprite animationClock - calls controller.onFrame(deltaMs)
  for every mounted "ticks: true" node, every frame, unconditionally
  (update() itself no-ops while not playing)
```

## `tools/nibblesLevels.mjs`

Already written and run for this spec (see the tool's own header comment for the full rationale). Verified independently against three levels before being trusted:

| level | start | own shape |
|---|---|---|
| 1 | (36,12) | no walls at all |
| 3 | (36,13) | two vertical bars, x=7-8 and x=31-32, y=2-12 |
| 30 | (38,7) | a dense, multi-colored maze, 318 wall cells |

## `domain/nibbles/index.js`

```js
import { LEVELS } from "./levels.js";

export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 15;

export const GAME_STATE = { IDLE: "idle", PLAYING: "playing", PAUSED: "paused", WON: "won", LOST: "lost", GAMEOVER: "gameover" };
const DIRECTIONS = { LEFT: "left", UP: "up", RIGHT: "right", DOWN: "down" };
const OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };
const DIFFICULTY_FRAME_TIMES = [180, 100, 75, 40]; // Novice/Average/Pro/Triton, matching v1's own radioGroup exactly

let level, lives, score, currentNumber;
let direction, nextDirection;
let state = GAME_STATE.IDLE;
let wrap = false;
let difficultyIndex = 1; // "Average", matching v1's own default active item
let snakeHead;
let snakeAge; // Map<"x,y", age> - only occupied cells; age counts up each tick, evicted past snakeLength()+1
let numberCell; // {x,y} | null - where currentNumber currently sits
let wallColor; // Map<"x,y", colorIndex> for the current level
let wallSet;   // Set<"x,y">, redundant with wallColor's own keys but O(1) without a second lookup

function key(x, y) { return x + "," + y; }

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

export function resetGame() {
    lives = 5;
    score = 0;
    startGame(1);
}

export function startGame(startLevel = level || 1) {
    loadLevel(startLevel);
    state = GAME_STATE.PLAYING;
}

export function pauseGame() { if (state === GAME_STATE.PLAYING) state = GAME_STATE.PAUSED; }
export function resumeGame() { if (state === GAME_STATE.PAUSED) state = GAME_STATE.PLAYING; }

/** Ported from nibbles.js's own game.onClick (384-401) - the single button's own state-dependent dispatch. */
export function primaryAction() {
    switch (state) {
        case GAME_STATE.LOST:
        case GAME_STATE.WON:
        case GAME_STATE.IDLE:
            startGame(state === GAME_STATE.WON ? level : (lives === undefined ? 1 : level));
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

export function move(requested) {
    if (requested !== OPPOSITE[direction]) nextDirection = requested;
}

function snakeLength() {
    const c = currentNumber - 1;
    return Math.floor(5 + c * (1 + c * 1.5));
}

function placeNumber() {
    // Real levels always have open floor at 40x15 with a level's own wall
    // count far short of 600 cells, so this always terminates - matching
    // v1's own unguarded do/while (placeNumber, 653-663).
    let x, y;
    do {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
    } while (wallSet.has(key(x, y)) || snakeAge.has(key(x, y)));
    numberCell = { x, y };
}

export function getFrameTime() { return DIFFICULTY_FRAME_TIMES[difficultyIndex]; }
export function setDifficulty(index) { difficultyIndex = Math.max(0, Math.min(DIFFICULTY_FRAME_TIMES.length - 1, index)); }
export function setWrap(value) { wrap = Boolean(value); }

/** Ported from nibbles.js's own game.update (223-296). No time parameter - one call is one tick. */
export function update() {
    if (state !== GAME_STATE.PLAYING) return;
    if (nextDirection) direction = nextDirection;
    nextDirection = null;

    let { x, y } = snakeHead;
    if (direction === DIRECTIONS.LEFT) x--;
    else if (direction === DIRECTIONS.UP) y--;
    else if (direction === DIRECTIONS.RIGHT) x++;
    else if (direction === DIRECTIONS.DOWN) y++;

    let canMove = true;
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
        if (wrap) {
            if (x < 0) x = GRID_WIDTH - 1; if (x >= GRID_WIDTH) x = 0;
            if (y < 0) y = GRID_HEIGHT - 1; if (y >= GRID_HEIGHT) y = 0;
        } else canMove = false;
    } else if (wallSet.has(key(x, y))) {
        canMove = false;
    } else if (numberCell && numberCell.x === x && numberCell.y === y) {
        currentNumber++;
        if (currentNumber > 9) { won(); return; }
        score += 1000 + (200 - getFrameTime()) * currentNumber * 2;
        placeNumber();
    } else if (snakeAge.has(key(x, y))) {
        canMove = false; // self-collision
    }

    if (!canMove) { lost(); return; }

    snakeHead = { x, y };
    snakeAge.set(key(x, y), 1);
    const maxAge = snakeLength() + 1;
    for (const [k, age] of snakeAge) {
        const next = age + 1;
        if (next > maxAge) snakeAge.delete(k);
        else snakeAge.set(k, next);
    }
    if (score > 0) score--;
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

export function getSnakeHead() { return { ...snakeHead }; }

/** One cell's own drawable facts - the draw kind's only way to read the grid, so it never touches the internal Maps/Sets directly. */
export function getCellView(x, y) {
    const k = key(x, y);
    if (snakeAge.has(k)) return { kind: "snake", age: snakeAge.get(k) };
    if (numberCell && numberCell.x === x && numberCell.y === y) return { kind: "food", number: currentNumber };
    if (wallColor.has(k)) return { kind: "wall", color: wallColor.get(k) };
    return { kind: "empty" };
}

const STATUS_TEXT = {
    [GAME_STATE.IDLE]: ["Ready Player 1?", "Start"],
    [GAME_STATE.PAUSED]: ["Game Paused", "Resume"],
    [GAME_STATE.WON]: ["You made it!", null], // buttonLabel depends on the new level - filled in below
    [GAME_STATE.LOST]: ["Boom! Player 1 died", "Try Again"],
    [GAME_STATE.GAMEOVER]: ["Game Over", "REMATCH"]
};

/** Ported from GameControls's own showInfo call sites (170,182,185) - a pure derived accessor next to the state, not the eventual screen's own concern (see requirements.md). */
export function getStatus() {
    const entry = STATUS_TEXT[state];
    const buttonLabel = state === GAME_STATE.WON ? `Start Level ${level}` : entry ? entry[1] : null;
    return { state, level, lives, score, statusText: entry ? entry[0] : null, buttonLabel };
}
```

## `domain/nibbles/highscores.js`

Mirrors `domain/settings/favorites.js` exactly: the same `Storage` abstraction (spec 033), the same "read once, parse defensively, write back the whole list" shape - `localStorage.getItem("nibblesHighscore")`/`JSON.parse` in a `try` (nibbles.js:69-75), ten entries, v1's own seed data (Vogue/Mr. H/Steffest/...) as the default when nothing is stored yet.

```js
import { createStorage } from "../settings/storage.js"; // exact module name confirmed against domain/settings/ at implementation time

const KEY = "nibblesHighscore";
const DEFAULT_TABLE = [ /* v1's own ten seed entries, name/score/level, verbatim */ ];

export function getHighScores() { /* read KEY, JSON.parse defensively, fall back to DEFAULT_TABLE, same as v1 */ }
export function qualifies(score) { return getHighScores().findIndex(item => item.score < score); } // -1 or 0 = does not qualify, matching v1's own `index>0` check (nibbles.js:191-192)
export function insertHighScore(name, score, level) { /* splice at the qualifying index, pop the last, write back */ }
```

## `runtime/nibblesController.js`

```js
import * as nibbles from "../domain/nibbles/index.js";

const KEY_TO_DIRECTION = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down" };

export function createNibblesController(initial = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(initial.disabled) };
    let accumulatedMs = 0;

    function handle(input) {
        const transitions = [];
        switch (input.type) {
            case "pointerdown":
                set("focused", true, transitions);
                return { transitions, handled: true };
            case "keydown": {
                if (!state.focused || state.disabled) return { transitions, handled: false, blocked: state.disabled ? "disabled" : "unfocused" };
                const direction = KEY_TO_DIRECTION[input.key];
                if (direction) { nibbles.move(direction); return { transitions, handled: true }; }
                if (input.key === "Enter") { nibbles.primaryAction(); return { transitions, handled: true }; }
                return { transitions, handled: false };
            }
            case "focus": set("focused", true, transitions); return { transitions, handled: true };
            case "blur": set("focused", false, transitions); return { transitions, handled: true };
            default: return { transitions, handled: false };
        }
    }

    /**
     * Not part of handle()'s input vocabulary - called directly by
     * mountGeneric.js's own new tick clock, the same way runSelectionCommand
     * is called directly by a synthesized menu (gridController.js's own
     * precedent). Carries a remainder forward rather than drifting, the same
     * idea animationClock.js already uses for a frame count.
     */
    function onFrame(deltaMs) {
        if (state.disabled) return;
        accumulatedMs += deltaMs;
        const frameTime = nibbles.getFrameTime();
        while (accumulatedMs >= frameTime) {
            nibbles.update();
            accumulatedMs -= frameTime;
        }
    }

    function setDisabled(disabled) { state.disabled = Boolean(disabled); }

    return { handle, onFrame, setDisabled, get state() { return { ...state }; } };
}
```

## `renderers/canvas/drawKinds.js` (new `"nibblesGrid"` entry)

```js
nibblesGrid: {
    measure: () => ({ width: 400, height: 150 }), // a floor size, like patternGrid's own - real size comes from layout
    draw(ctx, rect, node, assets, style) {
        const cellSize = Math.floor(Math.min(rect.width / GRID_WIDTH, rect.height / GRID_HEIGHT));
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cell = nibbles.getCellView(x, y);
                if (cell.kind === "empty") continue;
                ctx.fillStyle = cell.kind === "wall" ? `rgb(${cell.color})`
                    : cell.kind === "snake" ? (cell.age > 1 ? "rgba(255,255,255,0.6)" : "white")
                    : "#ffcc00"; // food
                ctx.fillRect(rect.x + x * cellSize, rect.y + y * cellSize, cellSize - 1, cellSize - 1);
            }
        }
        if (nibbles.getStatus().state !== nibbles.GAME_STATE.PLAYING) {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(rect.x, rect.y, GRID_WIDTH * cellSize, GRID_HEIGHT * cellSize);
        }
    }
}
```

(Final shape confirmed against `drawKinds.js`'s own real per-kind interface at implementation time - other kinds' exact `measure`/`draw` signatures take precedence over this sketch if they differ.)

## `runtime/componentTypes.js`

```js
nibblesGrid: {
    description: "Nibbles' own playing field (spec 047), the port's fifth specialized-component leaf. A fixed 40x15 grid; its controller (behavior \"nibbles\") and draw kind read domain/nibbles/index.js directly, the same contract patternGrid/waveformView/loopCreatorView already have. `ticks: true` keeps the renderer's own frame clock alive while mounted so the game advances without further input, independent of animSprite's own sprite-frame clock (see requirements.md's Decisions).",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "nibbles",
    ticks: true,
    selection: null,
    direction: null,
    cursor: "default",
    draw: "nibblesGrid",
    authoredIn: null,
    properties: {}
}
```

`isTickingType(type)` mirrors `isAnimatedType` exactly (`Boolean(entry && entry.ticks && entry.implemented)`).

## `renderers/canvas/mountGeneric.js` (a second, independent clock)

```js
// alongside animatedNodes/spriteClock (spec 017), not merged with them -
// see requirements.md's own "same start/stop shape, applied separately" note.
const tickingNodes = allNodes.filter(node => isTickingType(node.type));
let tickAnimationFrameHandle = null;
let tickLastTime = null;

function tickAnimationFrame(time) {
    if (tickLastTime === null) tickLastTime = time;
    const delta = time - tickLastTime;
    tickLastTime = time;
    tickingNodes.forEach(node => {
        const controller = controllers.get(node.id);
        if (controller && typeof controller.onFrame === "function") controller.onFrame(delta);
    });
    markNeedsDraw();
    tickAnimationFrameHandle = requestAnimationFrame(tickAnimationFrame);
}

function startTickClock() {
    if (tickingNodes.length === 0 || tickAnimationFrameHandle !== null) return;
    tickAnimationFrameHandle = requestAnimationFrame(tickAnimationFrame);
}

function stopTickClock() {
    if (tickAnimationFrameHandle !== null) cancelAnimationFrame(tickAnimationFrameHandle);
    tickAnimationFrameHandle = null;
    tickLastTime = null;
}
```

Called at the exact two call sites `startAnimationClock()`/`stopAnimationClock()` already are (mount-time, and inside `dispose()`).

## Data models

`domain/nibbles/`'s own module-level state (level/lives/score/snake/etc.) is not part of the application's state store at all - like `domain/sampleEditor/loopCreator.js`, it is read and written only through the specialized leaf's own controller and draw kind, never through a bound `field`.

## Error handling

- **`move()` called before any level is loaded** (not reachable once a screen exists, since starting the game loads a level first, but cheap to guard): `direction`/`snakeHead` are `undefined` until `startGame()`/`resetGame()` runs once; `update()` itself is only ever meaningful once `state === PLAYING`, which only `startGame()` sets - a call to `move()` first just sets `nextDirection`, consumed harmlessly on the next `update()` once one actually runs.
- **`placeNumber()`'s own do/while** could in principle loop forever on a level with no open floor at all; none of the 30 real levels are that dense (checked: the densest, level 30, still leaves the majority of 600 cells open), so this is not guarded, matching v1's own unguarded loop exactly.

## Testing strategy

- **`tests/nibblesLevels.test.js`**: `LEVELS.length === 30`; level 1 has zero cells; level 3's own cells/start match a hand-derived, independently computed set (not merely re-deriving the extractor's own math); every level's own start point is a valid, in-bounds, non-wall cell.
- **`tests/nibbles.test.js`**: `resetGame()`'s own initial state; `move()`'s opposite-direction guard; `update()`'s wall/edge/self/food branches (against a small level picked for exact wall positions, or level 1's own empty layout for the wrap/self-collision cases); the scoring formula exactly; `won()`/`lost()`'s own level/lives transitions including game-over; `primaryAction()`'s full state-dependent dispatch table; `getStatus()`'s own text/label per state.
- **`tests/nibblesHighscores.test.js`**: mirrors `tests/favorites.test.js`'s own convention - qualifies/insert/cap-at-ten/fresh-storage.
- **`tests/nibblesController.test.js`**: synthetic keydown events for movement/Enter, focus/blur/disabled gating; `onFrame`'s own accumulator - an exact number of `update()` calls (spied via a small counter, or asserted through the domain's own observable score/tick effects) for a given elapsed time at each difficulty.
- **`tests/nibblesGridView.test.js`**: a `waveformView.test.js`-style fake-canvas test - the registry declaration, `measure()`'s floor size, draw-never-throws before any game starts and mid-game, the paused-state dimming tint appearing exactly once.
- `node --test tests/*.test.js` passes; this spec touches no YAML/compiler/`capabilities.js`, so `node build.mjs app`/`node compiler/generate.js` are confirmed unaffected by an unchanged run, the same precedent specs 039/040/043 already established.

## What this deliberately does not do

See requirements.md's Scope boundaries: no screen, no dynamic grid sizing, no high-score dialog/table UI, no cheat codes, no decorative sprites.
