# 049 — Design

## Overview

```
compiler/recipes.js
  verb-action gains: start (startNibbles -> nibbles.start)
  CONDITION_FIELD_ALIASES gains: "wrap" -> wrap.active, "grid" -> grid.active

domain/nibbles/index.js (extended)
  getShowGrid() / setShowGrid(bool)     new engine state, default true
  resetToIdle()                          state = GAME_STATE.IDLE, nothing else touched

  startNibbles(app)                      primaryAction() + immediate publishStatus(app)
  toggleWrap(app, detail)
  toggleGrid(app, detail)
  setNibblesDifficulty(app, detail)      label -> index -> setDifficulty()
  toggleHighScoreView(app)               flips nibbles-view.value, publishes rows on the way in
  openNibblesView(app)                   [extended] resetToIdle(), seeds nibbles-view.value="game",
                                          starts the observation loop, then spec 048's own body
  showMain(app)                          [extended] stops the observation loop, then spec 048's own body

  publishStatus(app)                     score/lives/level/status-text/button-label/info-visible
  startObservingStatus(app) / stopObservingStatus()   mirrors domain/playback#startObserving exactly

renderers/canvas/drawKinds.js
  nibblesGrid gains: grid lines when getShowGrid(), else a plain border (ported from
  nibbles.js's own drawGrid()/drawBorder(), 618-651)

capabilities.js
  five new command -> module/export mappings

project/specs/application/current/app.yaml
  nibblesPanel's own placeholder replaced with the real screen (see below)
```

Confirmed empirically before writing any YAML (spec 036/042/045/046/048's own precedent):

| Authored action | Command | Field |
|---|---|---|
| `startNibbles` | `nibbles.start` | *(none - new verb)* |
| `toggleWrap` | `wrap.toggle` | `wrap.active` |
| `toggleGrid` | `grid.toggle` | `grid.active` |
| `setDifficulty` | `difficulty.set` | `difficulty.value` |
| `toggleHighScoreView` | `high-score-view.toggle` | `high-score-view.active` *(unused - overridden below)* |

`interpretRule(null, "highlighted when wrap is active")`/`"...grid is active"` both derive a bare, dot-free mock field (`"wrap"`/`"grid"`), which does not match `toggle-generic`'s own `wrap.active`/`grid.active` - confirming both aliases are needed, the same seam `loop enabled`/`snap to zero`/`resample interpolate` already used.

## `domain/nibbles/index.js` (extended)

```js
// --- grid-lines cosmetic flag (spec 049, nibbles.js's own showGrid) --------

let showGrid = true;

export function getShowGrid() { return showGrid; }
export function setShowGrid(value) { showGrid = Boolean(value); }

// --- reopening always starts fresh (spec 049) -------------------------------

/** Matches v1's own behavior of constructing a brand-new Game() (state=IDLE by default) every time Nibbles.init() runs after a prior close - nothing else (lives/score/level/high scores) resets. */
export function resetToIdle() {
    state = GAME_STATE.IDLE;
}

// --- publishing live status to ordinary field-bound controls (spec 049) ----
// Mirrors domain/playback/index.js#startObserving exactly: a self-perpetuating
// requestAnimationFrame loop, started by a capability call, publishing only
// to the state store - no existing specialized leaf's own controller has
// ever called app.state.set() directly, and this does not start now either;
// nibblesGrid's own onFrame (spec 047) still only drives the simulation.

let observing = null;

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    app.state.set(field, value);
}

function publishStatus(app) {
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

export function startNibbles(app) {
    primaryAction();
    publishStatus(app); // immediate, not waiting for the next animation frame
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

const DIFFICULTY_LABELS = ["Novice", "Average", "Pro", "Triton"];

export function setNibblesDifficulty(app, detail) {
    const index = DIFFICULTY_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    setDifficulty(index);
    publish(app, "difficulty.value", detail.value);
    if (app && app.log) app.log("difficulty.set", { index });
    return true;
}

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

// --- openNibblesView/showMain (spec 048), extended -------------------------

export function openNibblesView(app) {
    resetToIdle();
    if (app && app.state) {
        app.state.set("main-view.value", "nibbles");
        app.state.set("nibbles-view.value", "game");
    }
    startObservingStatus(app);
    if (app && app.log) app.log("nibbles.open", {});
}

export function showMain(app) {
    stopObservingStatus();
    if (app && app.state) app.state.set("main-view.value", "");
    if (app && app.log) app.log("main.show", {});
}
```

`getHighScores` is imported from `./highscores.js` (already exported, spec 047).

## `renderers/canvas/drawKinds.js` (nibblesGrid, extended)

```js
// after the cell-drawing loop, before the paused-state dim:
if (nibbles.getShowGrid()) {
    ctx.strokeStyle = "#3d4c6e";
    ctx.beginPath();
    for (let x = 0; x <= nibbles.GRID_WIDTH; x++) {
        ctx.moveTo(rect.x + x * cellSize, rect.y);
        ctx.lineTo(rect.x + x * cellSize, rect.y + nibbles.GRID_HEIGHT * cellSize);
    }
    for (let y = 0; y <= nibbles.GRID_HEIGHT; y++) {
        ctx.moveTo(rect.x, rect.y + y * cellSize);
        ctx.lineTo(rect.x + nibbles.GRID_WIDTH * cellSize, rect.y + y * cellSize);
    }
    ctx.stroke();
} else {
    ctx.strokeStyle = "#53638f";
    ctx.strokeRect(rect.x, rect.y, nibbles.GRID_WIDTH * cellSize, nibbles.GRID_HEIGHT * cellSize);
}
```

## `project/specs/application/current/app.yaml` (`nibblesPanel`, replacing spec 048's placeholder)

```yaml
- name: nibblesPanel
  type: panel
  layout: { width: fill, height: fill }
  visibleWhen: { field: main-view.value, oneOf: [nibbles] }
  content:
    - name: nibblesGameView
      type: panel
      layout: { width: fill, height: fill, direction: column }
      visibleWhen: { field: nibbles-view.value, oneOf: [game] }
      content:
        - name: nibblesTopRow
          type: panel
          layout: { width: fill, height: fill, direction: row }
          content:
            - name: nibblesGrid
              type: nibblesGrid
              layout: { width: fill, height: fill }
            - name: nibblesScoreboard
              type: panel
              layout: { width: fixed, direction: column }
              content:
                - { type: label, label: Score }
                - { type: label, field: nibbles-score.value }
                - { type: label, label: Lives }
                - { type: label, field: nibbles-lives.value }
                - { type: label, label: Level }
                - { type: label, field: nibbles-level.value }
                - { type: label, label: Difficulty }
                - name: nibblesDifficulty
                  type: radioGroup
                  variant: buttons
                  direction: column
                  items:
                    - { label: Novice }
                    - { label: Average }
                    - { label: Pro }
                    - { label: Triton }
                  actions: [change: setDifficulty]
                - type: checkbox
                  label: Wrap
                  rule: highlighted when wrap is active
                  actions: [click: toggleWrap]
                - type: checkbox
                  label: Grid
                  rule: highlighted when grid is active
                  actions: [click: toggleGrid]
                - { type: button, label: HighScore, actions: [click: toggleHighScoreView] }
                - { type: button, label: Exit, actions: [click: showMain] }
        - name: nibblesInfoPanel
          type: panel
          layout: { width: fill, direction: row }
          visibleWhen: { field: nibbles-info-visible.value, oneOf: [true] }
          content:
            - { type: label, field: nibbles-status-text.value }
            - { type: button, field: nibbles-button-label.value, actions: [click: startNibbles] }
    - name: nibblesHighScoreView
      type: panel
      layout: { width: fill, height: fill, direction: column }
      visibleWhen: { field: nibbles-view.value, oneOf: [highscore] }
      content:
        - { type: label, label: "Nibbles Highscore List of Fame" }
        - { type: label, field: nibbles-highscore-row-1.value }
        - { type: label, field: nibbles-highscore-row-2.value }
        - { type: label, field: nibbles-highscore-row-3.value }
        - { type: label, field: nibbles-highscore-row-4.value }
        - { type: label, field: nibbles-highscore-row-5.value }
        - { type: label, field: nibbles-highscore-row-6.value }
        - { type: label, field: nibbles-highscore-row-7.value }
        - { type: label, field: nibbles-highscore-row-8.value }
        - { type: label, field: nibbles-highscore-row-9.value }
        - { type: label, field: nibbles-highscore-row-10.value }
        - { type: button, label: Back, actions: [click: toggleHighScoreView] }
```

`visibleWhen: { field: nibbles-info-visible.value, oneOf: [true] }` - a boolean field compared against the literal `true`; confirmed against `runtime/genericLayout.js#isVisible`'s own `oneOf.includes(value)` check (spec 025), which works for any value type, not only strings (`optionsPanel.yaml`'s own `oneOf: [Options, ""]` is the only precedent so far, both strings - this is the first boolean use, confirmed to need no special-casing by reading `isVisible()` itself, not assumed).

Ten fixed `label`/`field` pairs for the high-score rows, not a `listbox`/`fileBrowser` (a data-bound repeating list): the table is always exactly ten rows (`domain/nibbles/highscores.js`'s own cap), so a fixed-row-count authoring costs nothing extra and needs no new mechanism, the same reasoning spec 042 used for `numberDisplay` vs. reusing an ill-fitting existing controller.

## `capabilities.js` (five new mappings)

```js
"nibbles.start": { module: "./domain/nibbles/index.js", export: "startNibbles" },
"wrap.toggle": { module: "./domain/nibbles/index.js", export: "toggleWrap" },
"grid.toggle": { module: "./domain/nibbles/index.js", export: "toggleGrid" },
"difficulty.set": { module: "./domain/nibbles/index.js", export: "setNibblesDifficulty" },
"high-score-view.toggle": { module: "./domain/nibbles/index.js", export: "toggleHighScoreView" }
```

## Data models

New fields: `nibbles-view.value` (`"game"`/`"highscore"`), `nibbles-score.value`, `nibbles-lives.value`, `nibbles-level.value`, `nibbles-status-text.value`, `nibbles-button-label.value`, `nibbles-info-visible.value` (boolean), `wrap.active`/`grid.active` (booleans), `difficulty.value` (a label string - the radioGroup's own known display limitation applies, see requirements.md), `nibbles-highscore-row-1.value` .. `nibbles-highscore-row-10.value`.

## Error handling

- **`setNibblesDifficulty` with an unrecognized label** (not reachable from the authored four items, but a real guard): returns `false` without calling `setDifficulty` at all, the same shape `setLoopPreset`'s own unrecognized-label guard already has.
- **`toggleHighScoreView` with no `app.state`** (not reachable through the UI): reads `current` as `"game"` by default, so the very first toggle always opens the table rather than throwing.
- **`startObservingStatus` with no `requestAnimationFrame`** (the headless test/build environment): a no-op, matching `domain/playback/index.js#startObserving`'s own identical guard.

## Testing strategy

- **`tests/recipes.test.js`** (extended): the new `start` verb; the `wrap`/`grid` alias agreement.
- **`tests/nibbles.test.js`** (extended): `getShowGrid`/`setShowGrid`; `resetToIdle()` (including the "reopen after a finished game" scenario, NS-006); `startNibbles`'s own five-state dispatch and immediate republish; `toggleWrap`/`toggleGrid`; `setNibblesDifficulty` (all four labels plus one unrecognized); `toggleHighScoreView` (including the fewer-than-ten-entries blank-row case); `publishStatus`/the observation loop's own step function, called directly (mirroring how `domain/playback`'s own polling loop is tested, not a real animation frame).
- **`tests/nibblesGridView.test.js`** (extended): grid-lines-vs-border drawing, both states, draw-never-throws.
- `node compiler/generate.js` / `node build.mjs app`: confirms the compiled outline (the command table above, read back) and that every new command is mapped, none left as a mock.
- `node --test tests/*.test.js` passes; `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## What this deliberately does not do

See requirements.md's Scope boundaries: no bespoke breakpoint layout, no high-score sprite thumbnails, no new-high-score name-entry dialog, no cheat codes, no decorative sprites, no feature-registry wiring.
