# 049 — The Nibbles screen

Date: 2026-09-14. Kind: feature. Status: specified. Continues package **P10** (features and the plugin path) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 047 (the engine and grid) and spec 048 (the screen prerequisites - `main-view.value`, the `normalMainView`/`nibblesPanel` split). This spec replaces spec 048's own placeholder with the real game screen, the same "mechanism, then screen" pattern's last step (specs 023/024, 025/026, 041/042, 043-045 all ended this way).

## Purpose

`nibblesPanel` exists but shows a placeholder. This spec authors the real content: the playing field mounted for the first time, score/lives/level, the difficulty/wrap/grid config controls, the single state-dependent primary button (Start/Resume/Try Again/REMATCH), Exit (already wired, spec 048), and a read-only high-score table.

## What v1 actually does, and what this narrows out (read from source, not assumed)

`nibbles.js`'s own `GameControls()` (682-1207, read in full for this spec) is the surrounding chrome: an info panel with dynamic text and a button whose label changes per game state (`showInfo`/`hideInfo`, 952-964); a score/lives LED-style numeric display (`gameControls.setScore`/`setLives`, 1126-1144); a difficulty `radioGroup` (four items, each its own fixed tick delay, 752-772) and Wrap/Grid checkboxes (774-801); Exit/HighScore buttons; a whole hand-rolled `col1`-`col5`/`col3` breakpoint layout (966-1124, v1's own bespoke column math, not this port's declared-breakpoint mechanism). The high-score table (`game.showHighScore`, 456-544) draws two columns of name/score plus a small level-sprite thumbnail per row, and a raw `host.UI.showDialog` prompt asks for a name when a new score qualifies (`game.checkHighScore`, 190-208).

This spec authors what is real and already backed by spec 047's own mechanism, narrowing three real things:

- **No dynamic window-size-derived layout.** The screen is authored plain YAML (rows/columns, `width`/`height: fill`), not v1's own bespoke `col1`-`col5` column math - consistent with spec 047's own decision to fix the grid at 40x15 rather than derive it from the window.
- **The high-score table is read-only text, not two columns with a level-sprite thumbnail per row.** Ten fixed rows (`domain/nibbles/highscores.js`'s own cap), each a plain `"N. Name - Score"` label bound to its own field, published once when the table is opened. No level-sprite image, no two-column layout - a visual-fidelity simplification, the same class of call open decision 1 already made for the skin as a whole.
- **No new-high-score name-entry prompt.** `host.UI.showDialog` is a raw v1-only modal API with no v2 equivalent; authoring a real one (a `modalDialog` with an `inputbox`, spec 020's own types) is a substantial enough addition - detecting "does this score qualify," opening the dialog, reading the entered name back - to be its own later spec rather than folded in here. The table itself is real and viewable; a game-over screen simply does not offer to record itself into it yet.

## Decisions and assumptions

- **A new verb, `start`, for the single primary-action button.** `startNibbles` ("start nibbles") is the one truly new authored vocabulary this spec needs - confirmed empirically that no existing `verb-action` verb matches before adding it, the same discipline spec 036/042/045/046/048 already established. Every other action resolves through existing recipes (`toggle-generic` for Wrap/Grid, `set-value` for the difficulty radioGroup, `show`/spec 048 for nothing new here).
- **A second view field within the Nibbles screen, `nibbles-view.value` (`"game"`/`"highscore"`), gates the game view vs. the high-score table** - the same `visibleWhen`-wrapped-panel shape spec 045/046/048 already used, not a second condition on existing nodes (the single-field-per-node limitation those specs already found). Seeded explicitly to `"game"` by `openNibblesView` (spec 048, extended here) rather than relying on an empty-string default, the same lesson spec 048's own test draft already learned the hard way.
- **Score/lives/level/status-text/button-label are republished every animation frame while Nibbles is open**, mirroring `domain/playback/index.js#startObserving`'s own exact shape (a self-perpetuating `requestAnimationFrame` loop, started by a capability call, publishing only to a state store) - not through the specialized leaf's own tick clock (spec 047's `onFrame`, which drives the domain simulation, not the surrounding screen's own field-bound labels). No existing specialized leaf's own controller has ever called `app.state.set()` directly, and this spec does not start; `domain/playback`'s own polling-and-publish loop, run instead by `domain/nibbles`, is the established precedent for "a live domain value needs an ordinary field-bound control to see it."
- **Two small, additive-only engine extensions**: `getShowGrid`/`setShowGrid` (a real, if purely cosmetic, addition to `domain/nibbles/index.js` - grid lines vs. a plain border, `nibbles.js`'s own `drawGrid`/`drawBorder`, 618-651) and `resetToIdle()` (so reopening Nibbles always starts at the "Ready Player 1?" screen, matching v1's own behavior of constructing a brand-new `Game()` object - with its own `state=IDLE` default - every time `Nibbles.init()` runs after a prior close, per `renderTarget.onHide()`'s own `game = null` teardown, 1286-1297).
- **The difficulty radioGroup's own selected item will not visually reflect the real default (or any later choice) on load.** A pre-existing, already-recorded limitation (spec 033: "a radioGroup's drawn selection is never derived from its bound field at all"), not something this spec fixes or regresses - the Wrap/Grid checkboxes are unaffected, since checkboxes reflect state through the `rule:`/`toggle-generic` mechanism already proven correct by every prior toggle in this port.
- **The feature-registry gap remains exactly as spec 048 recorded it.** `nibblesGrid`'s own controller and draw kind already import `domain/nibbles/index.js` at module scope; nothing in this spec changes that.

## User stories and acceptance

- **NS-001 — The playing field mounts for the first time.** `nibblesGrid` appears inside `nibblesPanel`'s own game view. Acceptance: `node compiler/generate.js` shows a real `nibblesGrid` node under `main.nibblesPanel`, zero new warnings.
- **NS-002 — Score, lives and level stay live while playing.** `openNibblesView` starts the observation loop; every animation frame, the published fields match `getStatus()`'s own current values. Acceptance: a unit test driving `update()` several times between two `publishStatus` calls and asserting the fields changed to match.
- **NS-003 — The one primary button reads and drives the game's own state machine.** Its own `field:`-bound label always matches `getStatus().buttonLabel`; clicking it calls `startNibbles`, which runs `primaryAction()` and republishes immediately (not waiting for the next animation frame). Acceptance: a capability unit test covering every one of `primaryAction`'s own five state branches (spec 047's own dispatch, exercised here through the screen's own wrapper).
- **NS-004 — Difficulty/Wrap/Grid controls drive the engine.** The difficulty radioGroup's four items map to `setDifficulty(0..3)`; Wrap/Grid toggle `setWrap`/`setShowGrid`, both reflected correctly via `rule:` (unlike the radioGroup's own known display limitation). Acceptance: capability unit tests for all three; a compiler-recipe check for the two new `CONDITION_FIELD_ALIASES` entries (`wrap`, `grid`).
- **NS-005 — The high-score table is real, viewable, and reads v1's own persisted data.** Toggling it publishes the top ten (or fewer) entries as ten fields, each `"N. Name - Score"` or blank past the real table's own length; toggling again returns to the game view. Acceptance: a capability unit test against a fake storage backend (mirroring `tests/nibblesHighscores.test.js`'s own convention) with fewer than ten real entries, confirming the blank-past-the-end case.
- **NS-006 — Reopening Nibbles always starts fresh at "Ready Player 1?"**, regardless of how a previous session ended. Acceptance: a unit test opening, playing partway, closing, and reopening, asserting the state is `IDLE` again.
- **NS-007 — No regressions.** Full unit suite passes; `node build.mjs app` succeeds with every new command mapped in `capabilities.js` (none left as a generated mock); `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - the animation-frame-driven publish loop is verified by calling its own step function directly in a test (`domain/playback/index.js`'s own test convention already does the same for its polling loop), not by a real `requestAnimationFrame`.
- No new component type, no new draw kind beyond spec 047's own `nibblesGrid`, one small addition to it (grid lines vs. border).

## Scope boundaries

In scope: `project/specs/application/current/components` (or inline in `app.yaml`'s own `nibblesPanel`, whichever the real authoring pass finds more natural) replacing spec 048's placeholder; `compiler/recipes.js`'s one new verb (`start`) and two new `CONDITION_FIELD_ALIASES` entries (`wrap`, `grid`); `domain/nibbles/index.js`'s new capability surface (`startNibbles`, `toggleWrap`, `toggleGrid`, `setDifficulty`, `toggleHighScoreView`) plus the observation loop and the two small engine extensions (`getShowGrid`/`setShowGrid`, `resetToIdle`); `renderers/canvas/drawKinds.js`'s `nibblesGrid` entry gains grid-lines-vs-border drawing; new `capabilities.js` mappings; tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **v1's own bespoke `col1`-`col5`/`col3` breakpoint layout** - plain authored YAML instead.
- **The high-score table's own level-sprite thumbnails and two-column layout** - ten plain text rows instead.
- **The new-high-score name-entry dialog** - a later spec's own, once a real `modalDialog`+`inputbox` need justifies it.
- **The "SKIP"/"TRITON" cheat codes** - already deferred by spec 047.
- **The decorative player-1/logo sprites** - not authored.
- **The feature registry / lazy loading** - unchanged from spec 048's own recorded limitation.
