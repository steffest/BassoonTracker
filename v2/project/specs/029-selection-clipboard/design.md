# 029 — Design

## A pure range/clipboard module, an integration layer that reuses spec 028's own primitives

**`domain/song/selection.js`** — pure, no `Tracker`/`Note` import, matching `editHistory.js`'s own independence from the document it will eventually be wired against. `createSelectionState()` returns `{getRange, setRange, getClipboard, setClipboard}` over two closure variables (`_range`, `_clipboard`), plus a standalone `normalizeRange({start, end})` - v1's own `_normalizeRange` (`patternView.js:761-772`), sorting `{row, track}` pairs into `{top, left, bottom, right}` regardless of which corner a drag started from. Nothing here knows what a "pattern" or a "note" is; it only sorts numbers and holds whatever object it is given as a clipboard.

**`domain/song/index.js`** — one module-level `selectionState = createSelectionState()` (a single document is being edited, so there is exactly one selection, not a registry of them - the thing v1's `UI.setSelection` callback-swapping existed to arbitrate between and this spec has no need for). The verb functions read cells and build undo actions the same way spec 028's `clearTrack`/`pasteTrack` already do - `scopedAction(EDITACTION.RANGE, ...)` plus `addDiff`/`history.registerEdit` - because a block selection's clear/paste *is* a range edit, just addressed by a rectangle instead of a whole track or pattern. No new edit-action kind, no new replay logic in `editHistory.js`.

```js
export function selectionCopy() {
    const range = getSelectionRange();
    if (!range) return false;
    const patternData = Tracker.getSong().patterns[getCurrentPattern()];
    const rows = [];
    for (let r = range.top; r <= range.bottom; r++) {
        rows.push(Array.from({length: range.right - range.left + 1}, (_, c) =>
            duplicateNote(patternData[r][range.left + c])));
    }
    selectionState.setClipboard({rows, width: rows[0].length, height: rows.length});
    return true;
}
```

`selectionClear()` builds one `RANGE` action over exactly the cells in the normalized range, the same loop shape as `clearPattern()` but bounded by the rectangle instead of the whole pattern. `selectionCut()` is `selectionCopy()` then `selectionClear()` - copying never mutates the document, so only the clear half needs (or gets) an undo entry, which is exactly what v1's own CUT does by composing its COPY and CLEAR cases rather than a third implementation.

`selectionPaste()` targets the current selection's top-left corner if one exists, or the current cursor otherwise - the single behaviour that replaces v1's `POSITION` verb (see requirements.md). It writes row-major, skipping any column that falls outside the current track count and stopping at the pattern's row count, matching v1's own clipping (`patternView.js:448-475`) exactly:

```js
export function selectionPaste() {
    const clipboard = selectionState.getClipboard();
    if (!clipboard) return false;
    const range = getSelectionRange();
    const startRow = range ? range.top : getCurrentPatternPos();
    const startTrack = range ? range.left : getCurrentTrack();
    const pattern = getCurrentPattern();
    const patternData = Tracker.getSong().patterns[pattern];
    const trackCount = Tracker.getTrackCount();
    const action = scopedAction(EDITACTION.RANGE, pattern, "Paste Block");

    for (let r = 0; r < clipboard.rows.length && startRow + r < patternData.length; r++) {
        for (let c = 0; c < clipboard.rows[r].length; c++) {
            const track = startTrack + c;
            if (track >= trackCount) continue;
            const row = startRow + r;
            let note = patternData[row][track];
            if (!note) { note = new Note(); patternData[row][track] = note; }
            const diff = addDiff(action, track, row, note);
            diff.to = clipboard.rows[r][c];
            populateNote(note, diff.to);
        }
    }
    history.registerEdit(action);
    return {pattern};
}
```

## Why one clipboard, not two

v1's `pasteBuffer` (whole track/pattern) and `_rangeCopy` (an arbitrary rectangle) are both "the last thing copied, for a later paste" - they exist separately because two different UI surfaces (the Track/Pattern Copy/Paste buttons, and Ctrl+C/V on a drag-selected block) happened to be built at different times, not because a tracker ever needs two independent clipboards at once. Nothing in `editor.js` or `patternView.js` reads the other's buffer, and no v1 workflow relies on both holding different things simultaneously. Spec 028's `copyTrack`/`pasteTrack`/`copyPattern`/`pastePattern` already cover "move this exact data between two explicit locations" as primitives with no ambient state; this spec's clipboard is the one *stateful* "last thing copied" a keyboard-driven Ctrl+C/V would use, and "copy the whole track to it" is just `selectAll()` (a single-track, full-height range) followed by `selectionCopy()` - the same protocol as copying three cells, not a second mechanism.

## What this deliberately does not do

See requirements.md's scope boundaries. `DELETE`/`REPLACE` stay declared-only, matching v1's own gap. No pattern-grid wiring (P7). No new store fields, no event bus, no browser verification - all for the same reasons spec 028 gave.
