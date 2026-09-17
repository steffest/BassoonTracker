# 067 — Design

## Overview

```
components/fileOperationsPanel.yaml
  diskActionRow (new)         Load/Save toggle -> disk-action.value (mocked)
  [existing "Load module:"/diskTargetRow/browser, each gains visibleWhen
   on disk-action.value oneOf ["", "Load"] - same depth, same ids, unchanged
   otherwise]
  saveView (new)               visibleWhen disk-action.value oneOf ["Save"]
    saveTypeRow                 Module/Sample/Playlist -> save-type.value (mocked)
    saveModulePanel             visibleWhen save-type.value oneOf ["", "Module"]
      "Export Module" button -> click: saveFile (existing file.save)
    saveSamplePanel              visibleWhen save-type.value oneOf ["Sample"]
      format radioGroup -> change: setSampleFormat (sample-format.set)
      "Export Sample" button -> click: exportSample (sample.export)
    savePlaylistPanel            visibleWhen save-type.value oneOf ["Playlist"]
      format radioGroup -> change: setPlaylistFormat (playlist-format.set)
      "Export Playlist" button -> click: exportPlayList (play-list.export)

compiler/recipes.js
  verb-action gains "export" (sample.export / play-list.export)

domain/moduleExport/index.js
  + setSampleExportFormat(app, detail)   stores a format code
  + exportSampleSelection(app)            exportSample(app, storedFormat)

domain/playlist/index.js
  + setPlaylistExportFormat(app, detail)
  + exportPlaylistSelection(app)          exportPlaylist(app, storedFormat)

capabilities.js
  + sample-format.set, sample.export, playlist-format.set, play-list.export
  (disk-action.set / save-type.set stay generated mocks)
```

## `components/fileOperationsPanel.yaml`

The existing three nodes (`"Load module:"` label, `diskTargetRow`, `browser`) each gain one line, `visibleWhen: {field: disk-action.value, oneOf: ["", "Load"]}` - no restructuring, no id change (see requirements.md's own decision on this). Everything else is new, nested under a new `saveView` sibling:

```yaml
content:
  - name: diskActionRow
    type: panel
    layout: {direction: row}
    content:
      - type: radioGroup
        variant: buttons
        items: [{label: Load}, {label: Save}]
        actions: [{change: setDiskAction}]
  - type: label
    label: "Load module:"
    visibleWhen: {field: disk-action.value, oneOf: ["", Load]}
  - name: diskTargetRow
    visibleWhen: {field: disk-action.value, oneOf: ["", Load]}
    ... (unchanged content)
  - name: browser
    visibleWhen: {field: disk-action.value, oneOf: ["", Load]}
    ... (unchanged content)
  - name: saveView
    type: panel
    layout: {width: fill, direction: column}
    visibleWhen: {field: disk-action.value, oneOf: [Save]}
    content:
      - name: saveTypeRow
        type: panel
        layout: {direction: row}
        content:
          - type: label
            label: "Save:"
          - type: radioGroup
            variant: buttons
            items: [{label: Module}, {label: Sample}, {label: Playlist}]
            actions: [{change: setSaveType}]
      - name: saveModulePanel
        type: panel
        visibleWhen: {field: save-type.value, oneOf: ["", Module]}
        content:
          - type: button
            label: "Export Module"
            actions: [{click: saveFile}]
      - name: saveSamplePanel
        type: panel
        layout: {direction: column}
        visibleWhen: {field: save-type.value, oneOf: [Sample]}
        content:
          - type: radioGroup
            variant: buttons
            items:
              - {label: "WAV 8-bit"}
              - {label: "WAV 16-bit"}
              - {label: "RAW 8-bit"}
              - {label: XI}
            actions: [{change: setSampleFormat}]
          - type: button
            label: "Export Sample"
            actions: [{click: exportSample}]
      - name: savePlaylistPanel
        type: panel
        layout: {direction: column}
        visibleWhen: {field: save-type.value, oneOf: [Playlist]}
        content:
          - type: radioGroup
            variant: buttons
            items: [{label: PLS}, {label: M3U}, {label: JSON}]
            actions: [{change: setPlaylistFormat}]
          - type: button
            label: "Export Playlist"
            actions: [{click: exportPlayList}]
```

`setDiskAction`/`setSaveType` derive `disk-action.set`/`save-type.set` through the existing `set-value` recipe, left mocked. `saveFile` reuses the exact reference already authored in the File menu (spec 037) - same derived command, same real capability, no change needed anywhere else. `exportSample`/`exportPlayList` need the new `"export"` verb below; `setSampleFormat`/`setPlaylistFormat` resolve through the existing `set-value` recipe to `sample-format.set`/`playlist-format.set`, which do need real capabilities (they write session state a later click reads).

## `compiler/recipes.js`

One word added to the `verb-action` pattern's own verb list:

```js
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out|open|cancel|show|start|add|remove|random|export)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
```

`actionNameAsProse("exportSample")` → `"export sample"` → command `sample.export`. `actionNameAsProse("exportPlayList")` → `"export play list"` → subject `"play list"` → hyphenated `"play-list"` → command `play-list.export` (matching spec 063's own `randomPlayList` → `play-list.random` exactly, confirmed by tracing `actionNameAsProse`'s own camelCase-splitting regex before choosing the reference's spelling, not guessed).

## `domain/moduleExport/index.js` (additions)

```js
const SAMPLE_FORMAT_LABELS = { "WAV 8-bit": "wav8", "WAV 16-bit": "wav16", "RAW 8-bit": "raw8", XI: "xi" };
let sampleExportFormat = "wav8";

export function setSampleExportFormat(app, detail) {
    sampleExportFormat = SAMPLE_FORMAT_LABELS[detail && detail.value] || "wav8";
}

export async function exportSampleSelection(app) {
    return exportSample(app, sampleExportFormat);
}
```

`exportSample(app, format)` itself (spec 064) is unchanged - still directly callable/testable with an explicit format, exactly as its own existing tests already do; `exportSampleSelection` is a thin new wrapper, not a signature change.

## `domain/playlist/index.js` (additions)

```js
const PLAYLIST_FORMAT_LABELS = { PLS: "pls", M3U: "m3u", JSON: "json" };
let playlistExportFormat = "pls";

export function setPlaylistExportFormat(app, detail) {
    playlistExportFormat = PLAYLIST_FORMAT_LABELS[detail && detail.value] || "pls";
}

export async function exportPlaylistSelection(app) {
    return exportPlaylist(app, playlistExportFormat);
}
```

Same shape, same non-breaking relationship to `exportPlaylist` (spec 065).

## `capabilities.js`

```js
"sample-format.set": { module: "./domain/moduleExport/index.js", export: "setSampleExportFormat" },
"sample.export": { module: "./domain/moduleExport/index.js", export: "exportSampleSelection" },
"playlist-format.set": { module: "./domain/playlist/index.js", export: "setPlaylistExportFormat" },
"play-list.export": { module: "./domain/playlist/index.js", export: "exportPlaylistSelection" },
```

`disk-action.set`/`save-type.set` are intentionally absent - pure UI state, matching `top-view.set`/`pattern-view.set`/`main-view.set`'s own precedent.

## Data models

None new - both format-selection functions read a radioGroup's own clicked label (`detail.value`, the same shape every other `change`-wired radioGroup capability already receives) and translate it to the internal format code `exportSample`/`exportPlaylist` already expect.

## Error handling

- **An unrecognized format label** (should not happen through the authored radioGroup, but cheap to guard): both setters fall back to their own panel's first/default item (`"wav8"`, `"pls"`), matching `diskOp_Save.js`'s own default-selected radio item for each type.
- **`exportSampleSelection`/`exportPlaylistSelection` with nothing to export**: fall straight through to `exportSample`/`exportPlaylist`'s own existing no-op guards (spec 064/065) - no new error handling needed.

## Testing strategy

- **`tests/saveExportScreen.test.js`** (new): compiles the real `app.yaml` and, via `computeGenericLayout()` (no Playwright in this environment, matching specs 048/059/062), confirms: the whole panel is absent when `top-view.value` isn't "File Operations"; the load view (label/`diskTargetRow`/`browser`) shows and the save view does not when `disk-action.value` is unset (the real seeded default, `""`); the save view shows (defaulting to the Module panel) and the load view does not once `disk-action.value` is `"Save"`; `save-type.value` of `"Sample"`/`"Playlist"` shows exactly that one sub-panel, each with its own format radioGroup and button present.
- **`tests/sampleExport.test.js`/`tests/playlist.test.js`** (extended): `exportSampleSelection`/`exportPlaylistSelection` dispatch to whichever format was last selected via `setSampleExportFormat`/`setPlaylistExportFormat` (asserted through the downloaded file's own extension, the same DOM-stub convention both files already use), and both setters default sensibly for an unrecognized label.
- **`tests/recipes.test.js`** (extended): the new `"export"` verb resolves `exportSample`/`exportPlayList` to `sample.export`/`play-list.export`.
- `node --test tests/*.test.js` passes; `node compiler/generate.js` (no new warnings) and `node build.mjs app`/`dist` (new loose ends are exactly the expected inert radio items and two deliberately-mocked commands) confirmed.

## What this deliberately does not do

See requirements.md's Scope boundaries: no MP3/WAV whole-song render, no Dropbox target, no filename rename field, no "has a playlist" gate on the Playlist export button, no disk-operations playlist listboxes.
