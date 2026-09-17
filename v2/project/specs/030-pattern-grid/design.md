# 030 — Design

## Overview

`patternGrid` is a new, leaf component type: `container: null`, one declared behavior (`"grid"`), one declared draw kind (`"patternGrid"`). Unlike every type before it, its controller and its draw kind read and write `domain/song`'s live cursor/selection/pattern state directly, instead of the generic store-bound `field` every other interactive type uses. This needs no new exception to the "one door" rule spec 028's README already documents: `domain/song/index.js` is that one door, and this spec only adds a few more thin delegations to it (`isPlaying`, `getTrackCount`, `getPatternLength`, `inFTMode` - all one-line forwards to `Tracker`, exactly as `getCurrentPattern`/`getCurrentPatternPos` already are) so that `runtime/gridController.js` and the `patternGrid` draw kind can import `domain/song/index.js` alone, the same single module every other editing consumer is restricted to. v1's own `isRecording` (`patternView.js:517`) has no port: the ported engine never exposed a getter for it, so the selection-vs-pan gesture below decides on the modifier key alone. Nothing about the mechanism that adds a component type (`runtime/componentTypes.js`), gives it a controller (`runtime/behaviors.js`) or draws it (`renderers/canvas/drawKinds.js`) changes; what is new is that this one controller's `contextFor`/`feed` branch in `renderers/canvas/mountGeneric.js` does not go through `mockState`, `applyValue()` or `applyScroll()` at all, because there is no bounded number or string field to write - a pattern's notes are not state the compiler's field-binding was ever meant to hold (GRID-001, PORT-002).

## Architecture

```
domain/song/index.js  (spec 028/029, plus a few new thin delegations)
  cursor: getCurrentTrack/Position, setCurrentTrack, moveCursorPosition, ...
  selection: beginSelection, extendSelection, getSelectionRange, ...
  clipboard: selectionCopy/Cut/Paste/Clear
  song data: getPattern, getSong, isPlaying, getTrackCount,
             getPatternLength, inFTMode (new: thin Tracker forwards)
        ^                                   ^
        | read/write, the one door,         | read, the same one door
        | unchanged since spec 028          |
        |                                   |
runtime/gridController.js          renderers/canvas/drawKinds.js
  "grid" behavior: handle()          "patternGrid" draw kind:
  pointer -> cursor/selection          - line-number + note/instrument/
  keyboard -> navigation                 volume/effect/param columns,
  (note entry: deferred, see             centered current row
   requirements.md scope decision)     - own scrollbar thumb (runtime/
        ^                                 scrollbar.js's thumbMetrics)
        | feed()/contextFor(), a new    - per-glyph cache (new,
        | branch keyed on behavior        renderers/canvas/patternGridGlyphs.js)
        | name "grid", same shape             ^
        | every other behavior gets           | draw(ctx, assets, style, rect,
        v                                     |      label, state, node)
renderers/canvas/mountGeneric.js  ------------+
  pointer routing, keyboard routing, focus, tracing: all pre-existing,
  unchanged - patternGrid is a controllable leaf, so it is already reached
  the same way a slider or a listbox is.
```

`renderers/canvas/patternGridGeometry.js` (new, pure, no canvas) is shared by both the draw kind and the controller: given a node's rect, the song's track count and whether FastTracker mode is active, it answers "which track/column is at this point" and "where is track N's column C" - one function, so drawing and hit-testing can never disagree about where a cell is, the same reason `runtime/scrollbar.js` is shared by a thumb's drawing, dragging and cursor.

## Components and interfaces

### The registry entry

```js
// runtime/componentTypes.js
patternGrid: {
    description: "The note grid (spec 030). A specialized component: its controller and draw kind read domain/song directly rather than a bound field, and it is always exactly one node regardless of pattern length or track count.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "grid",
    draw: "patternGrid",
    cursor: "default",
    synthesizes: "selectionMenu",
    properties: {}
}
```

No authored properties: everything the draw kind and controller need comes from `domain/song` and the node's own rect. `synthesizes: "selectionMenu"` is a third case for `runtime/overlaySynthesis.js`'s existing `kind` switch (alongside `"popup"`/`"dialogParts"`), giving every `patternGrid` node one synthesized `submenu` child - see "The selection menu" below. This keeps the node count a fixed small number (grid + submenu + 4 static items), never one that depends on the loaded song, which is what GRID-001 actually requires; it is not literally "one node" once the menu is counted, and requirements.md's wording is satisfied by "independent of song size", not by a literal node total.

### `runtime/behaviors.js`

```js
grid: createGridController
```

One more entry in the existing table, exactly as `list`/`flyout`/`digitEntry` were each added by their own spec.

### `runtime/gridController.js` (new)

Same three-member shape every controller has (`handle`, `setDisabled`, `state`), but its `handle(input)` reads and writes `domain/song` as a side effect instead of returning a `value`/`scrollTo` for the caller to write into a field:

```js
import * as song from "../domain/song/index.js";
import { cellAt, trackAt } from "../renderers/canvas/patternGridGeometry.js";

export function createGridController(options = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled) };
    let dragAnchor = null; // {row, track} the current drag/selection began at

    function handle(input) {
        const transitions = [];
        switch (input.type) {
            case "pointerdown": {
                const cell = cellAt(input.rect, input.local, song.getTrackCount());
                if (input.metaKey || input.ctrlKey) {
                    song.beginSelection(song.getCurrentPatternPos(), cell.track);
                    dragAnchor = { track: cell.track };
                } else {
                    song.setCurrentTrack(cell.track);
                    dragAnchor = null;
                }
                return { transitions, handled: true };
            }
            case "drag": {
                if (dragAnchor) {
                    song.extendSelection(song.getCurrentPatternPos() + rowsOf(input.delta.y), dragAnchor.track + tracksOf(input.delta.x));
                } else if (!song.isPlaying()) {
                    scrollBy(input.delta); // GRID-003/004: moves pattern position and/or the horizontal track window
                }
                return { transitions, handled: true };
            }
            case "pointerup":
                { const opened = dragAnchor && song.hasSelection(); dragAnchor = null;
                  return { transitions, handled: true, openSelectionMenu: opened }; }
            case "wheel":
                if (song.isPlaying()) return { transitions, handled: false };
                song.setCurrentPatternPos(song.getCurrentPatternPos() + (input.deltaY > 0 ? 1 : -1));
                return { transitions, handled: true };
            case "keydown":
                return handleKeydown(input, transitions);
            case "focus": set("focused", true, transitions); return { transitions, handled: true };
            case "blur": set("focused", false, transitions); return { transitions, handled: true };
            default: return { transitions, handled: false };
        }
    }
    // ...setDisabled(), state getter, same pattern every other controller uses.
    return { handle, setDisabled: (d) => { /* ... */ }, get state() { return state; } };
}
```

`handleKeydown` (GRID navigation only - see scope decision) covers `ArrowUp`/`ArrowDown` (pattern position ±1) and `ArrowLeft`/`ArrowRight` (cursor column ±1 via `song.moveCursorPosition`) and `PageUp`/`PageDown`/`Home`/`End` (pattern position jumps). None of these write a field or call `applyValue`; each calls straight into `domain/song`. **v1's own `Tab`/`Shift+Tab` jump-a-track (`input.js:355-363`) is dropped, not ported**: `mountGeneric.js`'s `handleKeyDown` claims `Tab` unconditionally for moving focus between controls (spec 015 INT), before a keydown ever reaches a node's own controller, so a focused `patternGrid` can never see it - a real constraint found while implementing, not a design choice, and left to the deferred follow-up spec to find a different binding for (e.g. an arrow with a modifier) rather than fought here. Keyboard-driven selection growth (holding the same modifier while navigating, as v1's event-driven `_initRange` does) and all note entry are the deferred follow-up spec's job too, per requirements.md's scope decision.

`input.metaKey`/`ctrlKey` is new, but it does not touch `runtime/pointerRouter.js` at all - that module's gesture objects are exercised by spec 014/015/019's own tests today, and threading two more fields through `down`/`move`/`up`'s fixed emitted shapes is real risk to that coverage for no benefit a *different* mechanism does not also give: `mountGeneric.js` already sees the raw native `PointerEvent` in `handlePointerDown`/`handlePointerMove`, one call before it ever reaches the router. A small piece of ambient state, `let pointerModifiers = { meta: false, ctrl: false }`, is set from `event.metaKey`/`event.ctrlKey` at the top of each of those two handlers, and `contextFor()`'s `"grid"` branch reads it directly - synchronously current for whatever input is being fed in the same native event, with zero change to the router's own shape or tests.

### `renderers/canvas/patternGridGeometry.js` (new, pure)

```js
export const LINE_HEIGHT = 13;

/** Track index + column (0=note, 1-2=instrument, 3=volume [FT only], 4-5=effect/param) at a local point. */
export function cellAt(rect, local, trackCount, startTrack, ftMode) { /* trackWidth = rect.width / visibleTracks, ... */ }

/** How many tracks fit in `width`, and which column edges they draw at - shared by the draw kind and cellAt. */
export function trackLayout(width, trackCount, startTrack) { /* ... */ }
```

Ported from `patternView.js`'s own `Layout.trackWidth`/`Layout.firstTrackOffsetLeft`/`cursorWidth1`/`cursorWidth3` constants (`patternView.js:204-222,275-292`), but scoped to this one file instead of the global `Layout` singleton v1 used - nothing else in v2 needs a tracker-specific column layout.

### `renderers/canvas/drawKinds.js` — the `patternGrid` entry

```js
patternGrid: {
    draw(ctx, assets, style, rect, label, state, node) {
        const song = /* import * as song from "../../domain/song/index.js" */;
        const currentSong = song.getSong();
        if (!currentSong) return null; // v1's own early-out, patternView.js:195
        const pattern = song.getPattern(song.getCurrentPattern());
        const visibleRows = Math.floor(rect.height / LINE_HEIGHT) | 1; // odd, so one row is exactly centered
        // ...draw the centered current row, the rows above/below, per-track
        // columns via trackLayout(), the cursor highlight, the selection
        // rectangle (song.getSelectionRange()), and the scrollbar thumb via
        // thumbMetrics(rect, {height: song.getPatternLength() * LINE_HEIGHT},
        // song.getCurrentPatternPos() * LINE_HEIGHT).
        return null;
    },
    measure() { return { width: 200, height: 200 }; } // a fill-sized leaf; only a floor for when it is unconstrained
}
```

Every glyph (a line number, a note name, an instrument/effect/param string) is drawn through `patternGridGlyphs.js`'s cache, not rasterized inline - ported one-for-one from `_renderLineNumber`/`_renderNote`/`_renderNoteParam` (`patternView.js:571-701`), keyed by the same string v1 already used (`id = text + "." + font.charWidth`, e.g.), since the cache is a pure function of "what text, what font", never of which grid instance or which row drew it - exactly why v1's own caches, despite being instance fields, never needed per-instance keys either.

### `renderers/canvas/mountGeneric.js` — the four integration points

1. **`contextFor(node, input)`** gains an `else if (behavior === "grid")` branch supplying `rect`, `local`, and the modifier flags already on `input` - no `mockState` read, unlike every existing branch.
2. **`feed(id, input, options)`** gains an early branch: `if (behaviorNames.get(id) === "grid") { const result = controller.handle({...input, ...contextFor(node, input)}); if (result.openSelectionMenu) openSelectionMenu(node); if (result.handled) draw(); return result; }` - before the `applyValue`/`applyScroll`/`activated` chain, since none of those apply. `draw()`, not `relayout()`: a grid interaction never changes any node's rect or extent, only what is painted inside the grid's own box, so re-running `computeGenericLayout()` would be pure waste.
3. **`handlePointerDown`/`handlePointerMove`** set the new `pointerModifiers` ambient state from the native event, read by `contextFor()`'s `"grid"` branch - no change to `runtime/pointerRouter.js` or its emitted shapes.
4. **The selection menu.** `openSelectionMenu(node)` calls the same `toggleOverlay(popup.id, { anchorTo: node.id, edge: "below" })` a dropdown's own click already uses (line ~1060), where `popup` is `patternGrid`'s one synthesized `submenu` child. The `activated` branch (line ~1068-1074) gains one more special case, alongside `dialogResult` and `"disclose"`/`"collapsible"`: an activated item carrying `selectionCommand` (`"clear"|"cut"|"copy"|"paste"`) calls `domain/song`'s matching `selectionClear`/`selectionCut`/`selectionCopy`/`selectionPaste` directly and closes the overlay, rather than `dispatch()`-ing a command - the same reasoning `dialogResult` already established: a synthesized part answers to the mechanism that built it, not to the compiler's command table, because nothing authored it.

### The selection menu (`overlaySynthesis.js`)

```js
function synthesizeSelectionMenu(node) {
    node.children = [synthetic("submenu", {
        id: `${node.id}.selectionMenu`,
        definitionName: "selectionMenu",
        children: ["Clear", "Cut", "Copy", "Paste"].map(label => synthetic("label", {
            definitionName: label.toLowerCase(),
            labelVariants: [label],
            selectionCommand: label.toLowerCase()
        }))
    })];
}
```

Visually and behaviorally identical to a menu's own flyout (spec 020's `flyout` behavior: hover-to-preview, click-to-execute, closes after); the only new idea is that its items carry a plain `selectionCommand` data property instead of an `actions` binding, exactly the same shape `dialogResult` already is on a modal dialog's synthesized OK/Cancel.

## Data models

- **Cell address.** `{ row: number, track: number, column: 0..5 }` - `row`/`track` already exist as `domain/song`'s `getCurrentPatternPos()`/`getCurrentTrack()`; `column` is `getCurrentTrackPosition()` (0-7, per `getStepsPerTrack()`). Nothing new; this spec only adds the geometry to resolve a pixel point to one.
- **Selection rectangle.** Already `domain/song`'s `{ top, left, bottom, right }` from `getSelectionRange()` (spec 029) - drawn, not re-modeled.
- **Scroll extent/offset.** Computed, not stored: `{ height: patternLength * LINE_HEIGHT }` / `currentPatternPos * LINE_HEIGHT`, fed straight into `runtime/scrollbar.js`'s existing `thumbMetrics()` - no new shape, and no `layoutResult.extents`/`offsets` entry, since `patternGrid` has no children for `computeGenericLayout()` to size.
- **Synthesized selection-menu item.** `{ selectionCommand: "clear"|"cut"|"copy"|"paste" }`, read only by `mountGeneric.js`'s `activated` branch.

## Error handling

- **No song loaded.** The draw kind's `if (!currentSong) return null` (mirroring `patternView.js:195`) draws nothing; the controller still accepts focus and keydown navigation harmlessly no-ops, since `domain/song`'s own functions already guard on `song.getSong()` existing (unchanged from spec 028/029).
- **Track count or pattern length changes mid-session** (e.g. `EVENT.trackCountChange` in v1): nothing to react to explicitly - every read (`getTrackCount()`, `getPatternLength()`) happens fresh on the next `draw()`/`handle()` call, so a stale count is never cached anywhere in this spec's own state.
- **A selection or cursor outside the current pattern's bounds** (e.g. after a shorter pattern is switched to): `domain/song`'s own clamping (already in place for cursor movement; `getSelectionRange()` is read-only) is relied on unchanged - this spec adds no new clamping logic of its own.
- **Playing while dragging/wheeling.** Every position-changing gesture no-ops while `song.isPlaying()`, exactly as v1's own `onDrag`/`onMouseWheel` do (`patternView.js:502-558`), so a click during playback cannot desynchronize the cursor from what is audibly playing.

## Testing strategy

No Playwright/Chromium install exists in this environment (confirmed again for this spec, matching spec 019's own finding) - the same real gap, recorded rather than glossed over. Verification is:

- **Unit tests on `runtime/gridController.js`** - pure, no canvas: pointerdown/drag/pointerup sequences produce the expected `domain/song` cursor/selection calls, given a fake `domain/song`-shaped module (mirroring how `editHistory.test.js` fakes `applyPatternDiff`).
- **Unit tests on `renderers/canvas/patternGridGeometry.js`** - pure geometry, trivially testable with plain numbers.
- **A `computeGenericLayout()`/outline integration test** (the same shape spec 019 used for listbox) asserting node count stays constant across a small (1 pattern, 4 tracks) and a large (256-row, 32-track) fixture song - the literal check for GRID-001.
- **A direct draw-kind smoke test** (jsdom `OffscreenCanvas` or a stub 2D context, as `bitmapFont.test.js` already uses) asserting the glyph cache is populated once per distinct glyph across repeated draws of the same cell.
- **GRID-009's frame-work measurement** is a one-time recorded number (`performance.now()` around one full draw of a 32-track, 64-row pattern), written into tasks.md's evidence, not a persistent test assertion - there is no budget to assert against until P8 sets one.

## Performance considerations

Draw cost is bounded by the viewport's visible rows × visible tracks, never by the pattern's row count or the song's track count (GRID-002); the per-glyph cache turns repeated identical cells (the overwhelming majority of any real pattern) into a `drawImage` of an already-rasterized canvas rather than a font-write. No per-frame allocation in the hot path beyond what `cellAt`/`trackLayout` already need (plain numbers, no object churn beyond the geometry ports already return).

## Security considerations

Not applicable beyond spec 014/015's existing pointer/keyboard input handling; this spec introduces no new input surface (no network, no file, no `eval`-adjacent parsing of authored content - `patternGrid` takes no authored properties at all).

## Monitoring and observability

No bespoke tracing: `feed()`'s existing `traceInput`/`trace("state", ...)` calls already fire for any `handled`/`transitions` result the grid controller returns, exactly as every other behavior's do, so a grid interaction already appears in the Interaction log with no change to the tracer. GRID-009's frame-work number is a recorded, one-time measurement (tasks.md), not a runtime metric - building a persistent frame-timing overlay is P8's job, not this spec's.

## What this deliberately does not do

- **No keyboard note entry, octave selection, or insert/remove-row shortcuts.** See requirements.md's scope decision - a follow-up spec's `handleKeydown` additions to the same controller.
- **No per-track mute/solo, FX panel or VU meters.** `patternPanel.js`'s other children, not `patternView.js`'s own concern; P11's territory.
- **No change to `radioGroup`/listbox/any other behavior's routing.** `patternGrid` is a controllable leaf reached by the exact same `controllableTarget`/wheel-ancestry-walk/focus mechanism spec 014/015/019 already built; nothing about those is type-aware, so nothing there needs to change.
- **No browser verification**, for the same environment reason spec 019 recorded.
