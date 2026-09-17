# 071 — Design

## Overview

```
components/songProperties.yaml
  songPropertiesDefault gains, before songPatternList:
    logoBanner (image), cornerDeco (image), trackerBanner (image)
    modNameInput (inputbox, field: song.title)
    instrumentList (new file, components/instrumentList.yaml)
    6 spinboxes: patternSpinBox, instrumentSpinBox (reuses instrument-index.value),
      songLengthSpinBox, songRepeatSpinBox, patternLengthSpinBox, bpmSpinBox

components/instrumentList.yaml (new)
  type: fileBrowser, actions: [change: selectInstrumentRow, doubleClick: openInstrumentInSampleEditor]

components/songPatternList.yaml
  listbox (static) -> fileBrowser (real rows.* published from song.patternTable)
  4 buttons: incrementPattern/decrementPattern/insertPattern/deletePattern -> real capabilities

domain/song/index.js
  + addToPatternTable, removeFromPatternTable, incrementPatternTableEntry, decrementPatternTableEntry
  + publishSongPatternRows, publishInstrumentRows
  + setCurrentPatternNumber, setSongLength, setSongRepeat, setPatternLength
  + selectInstrumentRow, openInstrumentInSampleEditor, selectSongPatternRow
  + publishSongProperties(app) - calls the above publishers plus republishes instrument-index

domain/playback/index.js
  STATE_FIELDS: + bpm: "song.bpm"
  + setBPM, setSongTitle
  module-load success path: also calls song.publishSongProperties(app)

domain/sampleEditor/index.js
  setInstrumentName: also calls song.publishInstrumentRows(app)

capabilities.js
  + song-title.set, current-pattern.set, song-length.set, song-repeat.set,
    pattern-length.set, song-bpm.set, select-instrument-row.set (change),
    open-instrument-in-sample-editor.doubleClick, select-song-pattern-row.set,
    pattern.increment, pattern.decrement (reused existing command names), 
    pattern.insert, pattern.delete (reused existing command names)
  logo.toggle: left as GENERATED MOCK (deliberate)
```

## `domain/song/index.js` additions

```js
import { formatInstrumentIndex } from "../../lib/util.js"; // ported alongside, see below

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    app.state.set(field, value);
}

// --- pattern-table mutation (ported from script/src/editor.js:372-416) ----

export function addToPatternTable(index, patternIndex = 0) {
    const song = getSong();
    if (!song) return;
    if (index === undefined) index = song.length;
    if (index === song.length) {
        song.patternTable[index] = patternIndex;
    } else {
        for (let i = song.length; i > index; i--) song.patternTable[i] = song.patternTable[i - 1];
        song.patternTable[index] = patternIndex;
    }
    song.length++;
}

export function removeFromPatternTable(index) {
    const song = getSong();
    if (!song || song.length < 2) return;
    if (index === undefined) index = song.length - 1;
    if (index === song.length - 1) {
        song.patternTable[index] = 0;
    } else {
        for (let i = index; i < song.length; i++) song.patternTable[i] = song.patternTable[i + 1];
    }
    song.length--;
    if (getCurrentSongPosition() >= song.length) setCurrentSongPosition(song.length - 1);
}

export function incrementPatternTableEntry(index) {
    const song = getSong();
    if (!song || !song.patternTable) return;
    song.patternTable[index] = (song.patternTable[index] || 0) + 1;
}

export function decrementPatternTableEntry(index) {
    const song = getSong();
    if (!song || !song.patternTable) return;
    if (song.patternTable[index] > 0) song.patternTable[index]--;
}

// --- rows published for the two fileBrowser-typed listboxes ---------------

const SONG_PATTERN_ROWS_FIELD = "rows.main.normalMainView.songProperties.songPropertiesDefault.songPatternList.list";
const INSTRUMENT_ROWS_FIELD = "rows.main.normalMainView.songProperties.songPropertiesDefault.instrumentList";

function pad2(n) { return String(n).padStart(2, "0"); }

export function publishSongPatternRows(app) {
    const song = getSong();
    if (!song) return;
    const rows = [];
    for (let i = 0; i < song.length; i++) rows.push({ title: `${pad2(i + 1)}:${pad2(song.patternTable[i] || 0)}` });
    publish(app, SONG_PATTERN_ROWS_FIELD, rows);
}

export function publishInstrumentRows(app) {
    const max = getMaxInstruments();
    const rows = [];
    for (let i = 1; i <= max; i++) {
        const instrument = getInstrumentAt(i);
        rows.push({ title: `${formatInstrumentIndex(i)} ${(instrument && instrument.name) || ""}`.trimEnd() });
    }
    publish(app, INSTRUMENT_ROWS_FIELD, rows);
}

// --- the six new/extended spinbox capabilities -----------------------------

export function setCurrentPatternNumber(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) setCurrentPattern(value);
    publish(app, "current-pattern.value", getCurrentPattern());
}

export function setSongLength(app, detail) {
    const requested = Math.round(Number(detail && detail.value));
    const song = getSong();
    if (!song || !Number.isFinite(requested)) return;
    if (requested > song.length) addToPatternTable();
    else if (requested < song.length) removeFromPatternTable();
    publish(app, "song-length.value", song.length);
    publishSongPatternRows(app);
}

export function setSongRepeat(app, detail) {
    const song = getSong();
    const value = Math.round(Number(detail && detail.value));
    if (!song || !Number.isFinite(value)) return;
    song.restartPosition = value;
    publish(app, "song-repeat.value", value);
}

export function setPatternLength(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) Tracker.setPatternLength(value); // the one documented exception already in place
    publish(app, "pattern-length.value", getPatternLength());
}

// --- the two fileBrowser-typed listboxes' own row actions ------------------

export function selectInstrumentRow(app, detail) {
    const index = Number(detail && detail.value);
    if (!Number.isFinite(index)) return;
    setCurrentInstrumentIndex(index + 1);
    publish(app, "instrument-index.value", getCurrentInstrumentIndex());
}

export function openInstrumentInSampleEditor(app, detail) {
    selectInstrumentRow(app, detail);
    publish(app, "pattern-section-view.value", "Sample Edit");
}

export function selectSongPatternRow(app, detail) {
    const index = Number(detail && detail.value);
    if (!Number.isFinite(index)) return;
    setCurrentSongPosition(index);
}

// --- one publish call for "song just changed underneath us" ---------------

export function publishSongProperties(app) {
    const song = getSong();
    if (!song || !app || !app.state) return;
    publish(app, "current-pattern.value", getCurrentPattern());
    publish(app, "instrument-index.value", getCurrentInstrumentIndex());
    publish(app, "song-length.value", song.length);
    publish(app, "song-repeat.value", song.restartPosition || 1);
    publish(app, "pattern-length.value", getPatternLength());
    publishSongPatternRows(app);
    publishInstrumentRows(app);
}
```

`formatInstrumentIndex` (ported verbatim from `script/src/lib/util.js:16-21`) lives in a small new file, `domain/song/format.js`, imported by `domain/song/index.js` - kept out of `index.js` itself only because it is a pure, dependency-free formatter with no state, the same reasoning `domain/song/keyboardNotes.js` already documents for its own split.

## `domain/playback/index.js` additions

```js
export const STATE_FIELDS = {
    ...,
    bpm: "song.bpm" // new
};

export function setBPM(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) Tracker.setBPM(value);
    publish(app, STATE_FIELDS.bpm, Tracker.getBPM ? Tracker.getBPM() : value);
}

export function setSongTitle(app, detail) {
    const song = Tracker.getSong();
    if (!song) return;
    const value = String(detail && detail.value !== undefined ? detail.value : "");
    song.title = value;
    publish(app, STATE_FIELDS.title, value);
}
```

The existing module-load success handler (where `STATE_FIELDS.title`/`bpm` are already republished after `loadModule`/file-drop) gains one more line, `song.publishSongProperties(app)` (`import * as song from "../song/index.js"`), at the same point - an ordinary door-to-door call, the same shape `domain/sampleEditor` already uses to reach `domain/song`.

## `domain/sampleEditor/index.js`

`setInstrumentName` gains one line at its end: `song.publishInstrumentRows(app)` (already imports `domain/song` as `song`) - so a name typed into the sample editor's own instrument-name field is immediately reflected in the song-properties section's own instrument list too.

## `components/instrumentList.yaml` (new)

```yaml
name: instrumentList
type: fileBrowser
layout:
  width: fill
  height: fill
actions:
  - change: selectInstrumentRow
  - doubleClick: openInstrumentInSampleEditor
```

Authored as `fileBrowser`, not `listbox` - see requirements.md's own Decisions section for why (the only mechanism in this codebase that supports a variable-length, data-bound row list at all).

## `components/songPatternList.yaml`

The existing `listbox` leaf becomes a `fileBrowser` (`actions: [change: selectSongPatternRow]`), and the four buttons' own actions change from the mocked verbs to ones a real `verb-action`/`toggle-generic` recipe resolves against the new `domain/song` exports:

```yaml
content:
  - name: list
    type: fileBrowser
    layout:
      width: fill
      height: fill
    actions:
      - change: selectSongPatternRow
  - type: panel
    layout:
      direction: column
    content:
      - { type: button, label: "↑", actions: [{ click: incrementPatternRow }] }
      - { type: button, label: "↓", actions: [{ click: decrementPatternRow }] }
      - { type: button, label: Ins, actions: [{ click: insertPatternRow }] }
      - { type: button, label: Del, actions: [{ click: deletePatternRow }] }
```

`incrementPatternRow`/`decrementPatternRow`/`insertPatternRow`/`deletePatternRow` each need "which row is selected" - read from the same field the `fileBrowser`'s own `change` action already writes (`domain/song`'s own module-level "current song-position" via `getCurrentSongPosition()`, not a second copy), matching v1's own `this._songlistbox.getSelectedIndex()` read directly off the same control the click handler owns.

## `components/songProperties.yaml`

`songPropertiesDefault`'s own content gains, before `songPatternList` (matching `appMainPanel.js`'s own real top-to-bottom order - logo/corner/tracker first, then the mod-name box, then the instrument list, then the six spinboxes, then the song/pattern list):

```yaml
content:
  - name: bannerRow
    type: panel
    layout:
      direction: row
    content:
      - { name: logoBanner, type: button, layout: { width: 70, height: 50 }, rule: "highlighted when logo is active", actions: [{ click: toggleLogo }] }
      - { name: cornerDeco, type: image, src: togglecorner }
      - { name: trackerBanner, type: image, src: tracker }
  - name: modNameInput
    type: inputbox
    field: song.title
    placeholder: "(untitled)"
    actions:
      - change: setSongTitle
  - instrumentList
  - name: songPropertiesSpinBoxRow
    type: panel
    layout:
      direction: row
    content:
      - { name: patternSpinBox, type: spinBox, field: current-pattern.value, min: 0, max: 100, step: 1, actions: [{ change: setCurrentPatternNumber }] }
      - { name: songInstrumentSpinBox, type: spinBox, field: instrument-index.value, min: 1, max: 128, step: 1, actions: [{ change: setInstrumentIndex }] }
      - { name: songLengthSpinBox, type: spinBox, field: song-length.value, min: 1, max: 200, step: 1, actions: [{ change: setSongLength }] }
      - { name: songRepeatSpinBox, type: spinBox, field: song-repeat.value, min: 1, max: 200, step: 1, actions: [{ change: setSongRepeat }] }
      - { name: patternLengthSpinBox, type: spinBox, field: pattern-length.value, min: 1, max: 128, step: 1, actions: [{ change: setPatternLength }] }
      - { name: bpmSpinBox, type: spinBox, field: song.bpm, min: 1, max: 400, step: 1, actions: [{ change: setBPM }] }
  - songPatternList
```

`logoBanner` is authored as a `button` with an image-styled skin variant, not a bare `image`, since it needs `highlightedWhen`/a click action - the `image` type itself declares `interactive: false` (`componentTypes.js:329`), matching how `_logo`'s own v1 shape (a real `Button`, not a plain `UIImage` like `_corner`) already draws it. The exact skin styling (whether the logo's own two images bind through a new `button`-type skin variant's own `states:` or through `highlightedWhen` swapping which `image` child shows) is confirmed empirically during implementation, not assumed here - see requirements.md's own "asset availability confirmed" note; `_corner`/`trackerBanner` need no interactivity at all, so they are plain `image` nodes regardless.

`songInstrumentSpinBox`'s own action is `setInstrumentIndex` (the existing sample-editor capability), not a new one - reusing the field and the command exactly, matching v1's own identical `Tracker.setCurrentInstrumentIndex` call from two UI locations.

## `capabilities.js`

```js
"song-title.set": { module: "./domain/playback/index.js", export: "setSongTitle" },
"song-bpm.set": { module: "./domain/playback/index.js", export: "setBPM" },
"current-pattern-number.set": { module: "./domain/song/index.js", export: "setCurrentPatternNumber" },
"song-length.set": { module: "./domain/song/index.js", export: "setSongLength" },
"song-repeat.set": { module: "./domain/song/index.js", export: "setSongRepeat" },
"pattern-length.set": { module: "./domain/song/index.js", export: "setPatternLength" },
"select-instrument-row.set": { module: "./domain/song/index.js", export: "selectInstrumentRow" },
"open-instrument-in-sample-editor.double-click": { module: "./domain/song/index.js", export: "openInstrumentInSampleEditor" },
"select-song-pattern-row.set": { module: "./domain/song/index.js", export: "selectSongPatternRow" },
"pattern-row.increment": { module: "./domain/song/index.js", export: "incrementSelectedPatternRow" },
"pattern-row.decrement": { module: "./domain/song/index.js", export: "decrementSelectedPatternRow" },
"pattern-row.insert": { module: "./domain/song/index.js", export: "insertAtSelectedPatternRow" },
"pattern-row.delete": { module: "./domain/song/index.js", export: "deleteSelectedPatternRow" }
// "logo.toggle" deliberately left unmapped - a real, recorded, permanently mocked control (see requirements.md)
```

Exact command strings above are the recipe-derived names from each action's own authored prose/camelCase name - confirmed against `compiler/recipes.js`'s real patterns during implementation, not hand-guessed; this table is corrected in place if any of them resolve differently once compiled (the same "verify, don't guess" discipline every prior spec in this port has used).

## Data models

None new - a song-pattern row is `{title: "01:00"}` (matching `drawKinds.js`'s own `row.title` read exactly); an instrument row is the identical shape.

## Error handling

- `addToPatternTable`/`removeFromPatternTable`: no-op past `song.length < 2` (matching v1's own guard against an empty song) or a missing song (headless/no-song state).
- `selectInstrumentRow`/`selectSongPatternRow`: a non-finite `detail.value` (should not happen - `fileBrowserController.js`'s own `value` is always a real row index or `null`, and a `null` never reaches a `change` dispatch) is a no-op, not a thrown error.
- `setBPM`/`setPatternLength`/etc: a non-finite typed/dragged value is a no-op, matching every other spinbox capability's own existing convention in this codebase (see `domain/sampleEditor/index.js#setInstrumentIndex`'s own `Number.isFinite` guard).

## Testing strategy

- `domain/song/index.js` (extended): the new pattern-table primitives against a fake song object (matching `tests/song.test.js`'s own existing convention, if that file exists, otherwise following the nearest sibling domain test's own fake-`app`/fake-`Tracker` shape); `publishSongPatternRows`/`publishInstrumentRows` against a fake `app.state`.
- `domain/playback/index.js` (extended): `setBPM`/`setSongTitle` against a fake `app`; the load-time `publishSongProperties` call verified via the existing `loadModule` test's own fake-fetch convention.
- `computeGenericLayout` against the real, compiled `app.yaml`: all new nodes present, sized, and correctly gated (none of this section's new content is behind any `visibleWhen` beyond `songPropertiesDefault`'s own existing one).
- Live in a real Chromium browser via Playwright: typing a mod name, dragging each spinbox, clicking then double-clicking an instrument row, and the song/pattern list's own four buttons all producing a real, visible effect with no console errors.
- `node --test tests/*.test.js`, `node compiler/generate.js`, `node build.mjs app`/`dist` after implementation, matching every prior spec's own verification convention.

## What this deliberately does not do

See requirements.md's own Scope boundaries: no drag-to-reorder, no pattern-sidebar song browser, no `UI.setInfo()` status-bar echo, no pixel-exact tracker-banner version-text easter egg.
