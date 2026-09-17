# 035 — Design

## Overview

One new specialized leaf, the same shape patternGrid (spec 030) already established:

```
runtime/componentTypes.js         "fileBrowser" registered
runtime/behaviors.js               "fileBrowser" -> createFileBrowserController
runtime/fileBrowserController.js   the controller (new) + rowsFieldOf (derived field name)
renderers/canvas/
  fileBrowserGeometry.js           pure: ROW_HEIGHT, rowIndexAt, clampOffset, contentHeight
  drawKinds.js                     "fileBrowser" draw kind (new entry)
  mountGeneric.js                  three additive touches (below)
```

## Why not reuse `listbox`'s controller/scroll plumbing

Traced before designing, because it looked at first like `listController.js` should just work (its `handle()` never reads a child node - `itemIndex`/`extent`/`offset` all arrive as plain numbers on `input`, supplied by the *caller*). The blocker is upstream of the controller: `mountGeneric.js`'s `contextFor()` resolves those numbers today via `itemIndexAt()` (walks `node.children`, none exist here) and `scrollInfoOf()` (reads `layoutResult.extents.get(node.id)`, which `runtime/genericLayout.js` only ever populates by stacking children's own measured rects - again, none exist here, so it would resolve to `null`/`0` regardless of how many rows the bound field actually holds). Patching both of those to also serve a childless node, and keeping three call sites (`contextFor`, `itemIndexAt`, `scrollInfoOf`) in agreement about a fourth, entirely different content-height formula, is more entanglement than writing forty lines of new, self-contained geometry - the same trade-off patternGrid's own design already made when it declined to reuse `listController`/`scrollInfoOf` for the same reason.

## Components and interfaces

### `renderers/canvas/fileBrowserGeometry.js` (new, pure)

```js
export const ROW_HEIGHT = 16;
export const ICON_SIZE = 14;
export const INDENT_WIDTH = 12;

/** Total scrollable content height for `rowCount` rows. */
export function contentHeight(rowCount) {
    return Math.max(0, rowCount) * ROW_HEIGHT;
}

/** Clamps a requested scroll offset to what `rowCount` rows in `rectHeight` actually allow. */
export function clampOffset(offset, rowCount, rectHeight) {
    const max = Math.max(0, contentHeight(rowCount) - rectHeight);
    return Math.min(Math.max(0, Math.round(offset)), max);
}

/**
 * Which row index a local point (relative to the browser's own rect) falls
 * in, given the current (already-clamped) scroll offset - or null above the
 * first row, past the last, or with no rows at all.
 */
export function rowIndexAt(rect, point, offset, rowCount) {
    if (!rect || !point || rowCount <= 0) return null;
    const localY = point.y - rect.y + offset;
    if (localY < 0) return null;
    const index = Math.floor(localY / ROW_HEIGHT);
    return index >= 0 && index < rowCount ? index : null;
}

/** The first and last (exclusive) row index visible in `rect` at `offset` - what the draw kind iterates. */
export function visibleRowRange(rect, offset, rowCount) {
    const first = Math.max(0, Math.floor(offset / ROW_HEIGHT));
    const last = Math.min(rowCount, Math.ceil((offset + rect.height) / ROW_HEIGHT));
    return { first, last };
}
```

### `runtime/fileBrowserController.js` (new)

Structurally a smaller sibling of `listController.js` - the same five input cases (`pointerdown`/`drag`/`dragend`/`pointerup`/`wheel`, plus `pointerenter`/`pointerleave`/`focus`/`blur` for the same hover/focus bookkeeping every controller keeps), computing `itemIndex`/`scrollTo` from the geometry module instead of receiving `itemIndex` pre-resolved and `extent` from layout.

```js
import { rowIndexAt, clampOffset, contentHeight } from "../renderers/canvas/fileBrowserGeometry.js";
import { WHEEL_STEP } from "./scrollbar.js";

export const FILE_BROWSER_STATE_FIELDS = ["hover", "pressed", "focused", "disabled", "dragging"];

/** Where a fileBrowser's own row array lives - this spec's own equivalent of listController.js's scrollFieldOf, which it reuses unchanged for the scroll offset itself. */
export function rowsFieldOf(node) {
    return node && node.id ? `rows.${node.id}` : null;
}

export function createFileBrowserController(options = {}) {
    const state = { hover: false, pressed: false, focused: false, disabled: Boolean(options.disabled), dragging: false };
    let anchor = null; // { offset, rowIndex } captured at pointerdown

    function set(field, value, transitions) { /* identical shape to listController.js */ }

    function handle(input) {
        const transitions = [];
        const rowCount = (input.rows || []).length;
        const offset = clampOffset(input.offset || 0, rowCount, input.rect ? input.rect.height : 0);
        let scrollTo = null, value = null, handled = false, blocked = null;

        switch (input.type) {
            case "pointerdown":
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                set("pressed", true, transitions);
                handled = true;
                anchor = { offset, rowIndex: rowIndexAt(input.rect, input.point, offset, rowCount) };
                break;
            case "drag":
                if (state.disabled || !anchor) break;
                set("dragging", true, transitions);
                handled = true;
                scrollTo = anchor.offset - (input.delta ? input.delta.y : 0);
                break;
            case "pointerup":
                set("pressed", false, transitions);
                set("dragging", false, transitions);
                handled = true;
                if (!input.dragged && anchor && anchor.rowIndex !== null) value = anchor.rowIndex;
                anchor = null;
                break;
            case "wheel": {
                if (state.disabled || rowCount === 0) break;
                const direction = Math.sign(input.deltaY || 0);
                const atEnd = (direction < 0 && offset <= 0) || (direction > 0 && offset >= contentHeight(rowCount) - input.rect.height);
                if (direction === 0 || atEnd) break;
                handled = true;
                scrollTo = offset + direction * WHEEL_STEP;
                break;
            }
            // pointerenter/leave, focus/blur: identical bookkeeping to listController.js
        }

        return { transitions, activated: false, blocked, handled, changed: value !== null || (scrollTo !== null && scrollTo !== offset), value, scrollTo: scrollTo === null ? null : clampOffset(scrollTo, rowCount, input.rect ? input.rect.height : 0) };
    }

    function setDisabled(disabled) { /* identical shape to listController.js */ }

    return { handle, setDisabled, get state() { return { ...state }; } };
}
```

A drag never selects (`pointerup` only sets `value` `!input.dragged`), matching `listController.js`'s own rule - ported deliberately as the same product decision, not shared by import, since the two controllers no longer share a supertype.

### `renderers/canvas/mountGeneric.js` (three additive touches)

```js
// contextFor(): a new branch alongside "list"/"scroll"/"tabs"
} else if (behavior === "fileBrowser") {
    extra.rows = mockState.get(rowsFieldOf(node)) || [];
    extra.offset = Number(mockState.get(scrollFieldOf(node))) || 0;
    // rect already set above; rowIndexAt/clampOffset live inside the controller
}
```

```js
// visualStateOf(): a new branch, mirroring "list"'s own extra.selectedItemRect/extra.scroll
} else if (behavior === "fileBrowser") {
    const rows = mockState.get(rowsFieldOf(node)) || [];
    extra.rows = rows;
    extra.offset = clampOffset(Number(mockState.get(scrollFieldOf(node))) || 0, rows.length, layoutRectHeightOf(node));
    const selected = Number(mockState.get(valueFieldOf(node)));
    extra.selectedIndex = Number.isFinite(selected) ? selected : -1;
}
```

```js
// applyScroll(): extend the existing two-behavior check
const field = (behaviorNames.get(node.id) === "list" || behaviorNames.get(node.id) === "fileBrowser")
    ? scrollFieldOf(node) : node.field;
```

`scrollFieldOf` is imported from `runtime/listController.js` exactly as it already is for `"list"` - `fileBrowser` does not get its own scroll-field-naming function, only its own rows-field one (`rowsFieldOf`, from `fileBrowserController.js`), since the two behaviors share the same "where does an independent-of-selection scroll offset live" answer.

### `runtime/componentTypes.js`

```js
fileBrowser: {
    description: "A scrollable, hierarchical list whose rows are runtime data (spec 035), not authored children - the second specialized-component leaf after patternGrid, for the same reason: an unbounded, dynamically-changing row count (a remote catalog listing, lazily expanded) cannot be authored YAML. A row's own meaning (branch vs. leaf) is entirely opaque to this type - a bound `change` command decides what a click on row N means, the same as any other value-like control.",
    implemented: true,
    container: null,
    styled: false,
    interactive: true,
    behavior: "fileBrowser",
    selection: null,
    direction: null,
    cursor: "default",
    draw: "fileBrowser",
    authoredIn: null,
    properties: {
        field: { kind: "reference", description: "The state field holding the selected row's index into the current rows array. A change dispatches { value: index }; a capability decides what that row means." }
    }
}
```

No `clips: true` (see requirements.md) and no `synthesizes` (unlike patternGrid, nothing is synthesized here - a disk-operation screen author decides its own overlay/menu needs, if any, later).

### `renderers/canvas/drawKinds.js` (new entry)

```js
fileBrowser: {
    draw(ctx, assets, style, rect, label, state) {
        const rows = (state && state.rows) || [];
        const offset = (state && state.offset) || 0;
        const selectedIndex = state ? state.selectedIndex : -1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const { first, last } = visibleRowRange(rect, offset, rows.length);
        const font = assets.font;
        for (let i = first; i < last; i++) {
            const row = rows[i];
            const y = rect.y + i * ROW_HEIGHT - offset;
            if (i === selectedIndex) {
                ctx.fillStyle = "rgba(110,150,230,0.28)";
                ctx.fillRect(rect.x, y, rect.width, ROW_HEIGHT);
            }
            let x = rect.x + 2 + (row.level || 0) * INDENT_WIDTH;
            const asset = row.icon ? imageAsset(assets, null, row.icon) : null;
            if (asset) { ctx.drawImage(asset.image, asset.x, asset.y, asset.width, asset.height, x, y + 1, ICON_SIZE, ICON_SIZE); }
            if (asset || row.icon) x += ICON_SIZE + 3; // reserve the icon's own column even when its asset failed to resolve, so text never jitters row to row
            drawText(ctx, font, row.title || "", x, y + 2);
            if (row.info) drawText(ctx, font, row.info, rect.x + rect.width - 40, y + 2); // right-aligned column, fixed width - matches v1's own info string being short (a file size or a ">" count)
        }
        ctx.restore();
        drawScrollThumb(ctx, assets, style, rect, { scroll: { extent: { width: rect.width, height: contentHeight(rows.length) }, offset } });
        return { drawn: true };
    },
    measure() {
        return { width: 200, height: 140 };
    }
}
```

`drawText` is a small local helper (plain `ctx.fillText`-equivalent through the existing bitmap-font blit, matching whatever the codebase's other draw kinds already use for a single line of label text - not `drawCachedText`, which is patternGrid's own glyph *cache*, tuned for a fixed small charset redrawn every frame at speed; a file browser's rows are arbitrary, unbounded strings, so no cache is worth building for them here).

## Data models

A row descriptor: `{title: string, icon?: string, info?: string, level: number, hasChildren?: boolean}`. Not enforced by a schema (`fileBrowser` never validates what is in its own bound field, matching every other value-like control) - a later spec's capability owns producing this shape correctly.

## Error handling

- **`rows.<id>` is missing, not an array, or shrinks out from under a stale `selectedIndex`**: `(mockState.get(...) || [])` guards the missing/wrong-type case; `visualStateOf`'s `extra.selectedIndex` is used only as `i === selectedIndex` inside the draw loop's own bounds (`first`..`last`, itself bounded by `rows.length`), so an out-of-range index simply never matches - no clamping needed, no throw possible.
- **A row has no `icon`**: `imageAsset(...)` returns `null` for a falsy name already (existing behavior); the draw loop's own icon branch is skipped, `x` still advances by the icon column width so a mixed list (some rows with icons, some without) still lines up.
- **`clampOffset` is asked to clamp against zero rows**: `contentHeight(0) - rectHeight` is negative, `Math.max(0, ...)` floors it at 0 - an empty list's own offset is always 0, never negative.

## Testing strategy

- **`tests/fileBrowserGeometry.test.js`** (new, pure): `rowIndexAt` at the first/last row, above/below content, with a non-zero, non-row-height-multiple offset; `clampOffset` at both ends and for zero rows; `visibleRowRange` at the top, middle and bottom of a long list.
- **`tests/fileBrowserController.test.js`** (new): the `listController.js`-style case set - pointerdown capturing an anchor, a clean click selecting the anchored row, a drag never selecting, wheel scrolling and clamping at both ends, disabled blocking every input, blur clearing hover/pressed/focus together.
- **`tests/fileBrowser.test.js`** (new, `patternGrid.test.js`-style fake canvas): the declaration check (FB-001); `measure()`'s floor size; `draw()` never throws for zero rows, a huge row count (only the visible slice is ever drawn - asserted by counting `fillText`/`drawImage`-equivalent calls against the fake rect's own visible row count, not against the full array length); a row with no icon; an out-of-range `selectedIndex`.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` unaffected (no YAML/compiler/component-count change - `fileBrowser` is declared but authored nowhere yet, exactly as `menu`/`spinBox` once were between their own declaration and implementation specs).

## What this deliberately does not do

- **No screen, no capability, no YAML.** See requirements.md's Scope boundaries.
- **No change to `listbox`, `listController.js`, `scrollInfoOf()`'s existing "list"/"scroll" branches, or `genericLayout.js`.** Every touch in `mountGeneric.js` is a new, additive branch gated on the `"fileBrowser"` behavior name.
- **No glyph cache for row text** - unlike patternGrid's fixed, tiny charset redrawn at speed, a file browser's row titles are arbitrary strings; building and invalidating a cache for them is not justified without a measured need (mirroring spec 032's own "not attempted without a way to measure whether it is needed").
