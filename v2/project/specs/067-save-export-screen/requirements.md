# 067 — The save/export screen

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 066 (playlist auto-advance). Gives specs 037/064/065's own real capabilities (`exportModule`, `exportSample`, `exportPlaylist`) their first UI entry point beyond the File menu's own two already-authored items.

## Purpose

Three real export capabilities exist and are fully tested, but only one (`exportModule`, via the File menu's "Save") is reachable from the generated application at all. `exportSample`/`exportPlaylist` have had nowhere to be triggered from since the specs that built them (064, 065) each deliberately deferred exactly this. Design.md's own roadmap has separately recorded "a save/export screen" as its own later item since spec 037. This spec is that screen - the natural conclusion of the whole export arc, not a new mechanism.

## What v1 actually does (read from source, not assumed)

- **`script/src/ui/diskOperations.js`** combines load and save into one screen behind a Load/Save toggle (`actionPanel`, `DiskOperationActions`) - re-read for this spec, alongside `diskOp_Save.js` (already read in full for spec 064). Selecting "Save" shows `DiskOperationSave` (a target radioGroup - Module/Sample/Playlist, called `FILETYPE` - a per-type format sub-radioGroup, a filename `inputbox`, and an "Export" button).
- **The module type's own format sub-radioGroup includes options this port cannot build yet**: alongside "module" (native `.mod`/`.xm` save, real), it offers "wav" and "mp3" - but read closely, these do not export the current instrument's sample the way the *sample* type's own "wav"/"mp3" options do; they call `BassoonProvider.renderFile(...)`, rendering the *entire song's audio* to a file, a whole offline-render pipeline this port has never built (recorded separately as P9's still-unallocated MP3/WAV-render item, distinct from spec 064's sample export). Confirmed by reading `diskOp_Save.js`'s own `onClick` handler (72-95) line by line, not assumed from the option's label alone.
- **The filename `inputbox`** (`fileNameInput`) lets the user rename the file before saving, with a live-updated default computed from context (song title/instrument name/playlist title, per `EVENT.songPropertyChange`/`instrumentChange`/`trackerModeChanged`).
- **Dropbox** is a `saveTarget` option throughout (`diskOp_Save.js` lines 88-93, 122-126) - deferred consistently since spec 037.

## Decisions and assumptions

- **Module type has only one real option: native save.** v1's own "wav"/"mp3" module-render options need the offline-render pipeline this roadmap has never built (see above) - authoring them here would put a live-looking button behind a capability that does not exist. The screen's Module panel is a single "Export Module" button, reusing the File menu's own already-real `saveFile`/`file.save` command directly - no new authoring vocabulary, no sub-format choice needed (`exportModule` already dispatches MOD vs. XM by itself).
- **Sample and Playlist each get their own format radioGroup** (four items: WAV 8-bit/WAV 16-bit/RAW 8-bit/XI; three items: PLS/M3U/JSON), each `change`-wired to a new small capability that stores the selected format, and a plain "Export" button reading it back - the same "one control writes session state, a separate button reads it" shape the loop creator's own presets/Apply pair (specs 043/045) and the resample panel's own target-note spinbox/Apply pair (spec 046) already established, not a new pattern.
- **No filename input.** `exportModule`/`exportSample`/`exportPlaylist` already compute a real filename internally; the browser's own download (`<a download>`) still lets a user rename the file via their browser's own save dialog if one is configured to ask. A dedicated rename field is a real, freely-buildable enhancement, deferred rather than built speculatively - matching this roadmap's own repeated "ship what's real, defer polish" bar.
- **No "does a playlist exist" gate on the Playlist export button.** `exportPlaylist` already no-ops safely with nothing set (spec 065); adding a `visibleWhen`/`disabledWhen` field just to grey out a harmless no-op button is not warranted for this slice - recorded as a known, minor limitation rather than silently engineered around.
- **A new `disk-action.value`/`save-type.value` pair of pure-UI-state fields** (Load/Save; Module/Sample/Playlist), resolved through the existing `set-value` recipe and deliberately left mocked - the same precedent `top-view.value`/`pattern-view.value`/`main-view.value` already established repeatedly.
- **A new `compiler/recipes.js` verb, `"export"`**, resolving `exportSample`/`exportPlayList` to `sample.export`/`play-list.export` - the latter deliberately spelled `exportPlayList` (not `exportPlaylist`) so its own derived noun matches spec 063's own `play-list.*` prefix (`randomPlayList` → `play-list.random`) exactly, rather than introducing a second, inconsistent `playlist.*` prefix for one command.
- **No existing node is renested.** `diskTargetRow`/`browser` (spec 035/036) each gain their own `visibleWhen` on the new `disk-action.value` field directly, staying at the same depth - not wrapped in a new "load view" panel, which would have shifted `main.fileOperationsPanel.browser`'s own id and broken `domain/diskOperations/index.js`'s hardcoded field name and every one of `tests/diskOperations.test.js`'s own assertions for no reason. Only genuinely new content (`saveView` and everything inside it) is nested.

## User stories and acceptance

- **SAVE-001 — Load/Save toggle.** `fileOperationsPanel`'s own new `diskActionRow` radioGroup switches `disk-action.value` between `""`/`"Load"` (the existing browse UI, unchanged) and `"Save"` (the new save UI) - verified against the real compiled `app.yaml`.
- **SAVE-002 — Save-type switch.** With `disk-action.value: "Save"`, a `save-type.value` radioGroup (Module/Sample/Playlist) shows exactly one of three sub-panels at a time, defaulting to Module.
- **SAVE-003 — Module export is reachable.** The Module sub-panel's "Export Module" button dispatches the same `file.save` command the File menu's own "Save" item already does.
- **SAVE-004 — Sample export is reachable, in any of its four formats.** The Sample sub-panel's format radioGroup (`setSampleExportFormat`) stores a format; its "Export Sample" button (`exportSampleSelection`) calls `exportSample(app, format)` (spec 064, unchanged) with whatever was last selected.
- **SAVE-005 — Playlist export is reachable, in any of its three formats.** The Playlist sub-panel's format radioGroup (`setPlaylistExportFormat`)/"Export Playlist" button (`exportPlaylistSelection`) work the same way against `exportPlaylist` (spec 065, unchanged).
- **SAVE-006 — No regressions.** Full unit suite passes; `node compiler/generate.js` reports no new warnings; `node build.mjs app`/`dist` succeed (new loose ends are exactly the expected inert radio items plus the two deliberately-mocked pure-UI-state commands - no new `unresolved-*` warning of any kind).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - verified with `computeGenericLayout()` directly against the real, live `app.yaml`, the convention specs 048/059/062 already established.
- `capabilities.js` gains four new mappings (`sample-format.set`, `sample.export`, `playlist-format.set`, `play-list.export`); `disk-action.set`/`save-type.set` stay generated mocks on purpose.

## Scope boundaries

In scope: `components/fileOperationsPanel.yaml`'s restructuring, `compiler/recipes.js`'s `"export"` verb, four new `capabilities.js` mappings, `domain/moduleExport/index.js`'s `setSampleExportFormat`/`exportSampleSelection`, `domain/playlist/index.js`'s `setPlaylistExportFormat`/`exportPlaylistSelection`, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **MP3/WAV whole-song render/export** - needs an offline render pipeline this roadmap has never built, and the vendored-encoder-vs-server-`lame.exe` discrepancy spec 033 already found reconciled; a real, separate, still-unallocated P9 item.
- **Dropbox as a save target** - unchanged from spec 037/038/064/065's own identical, already-recorded scope boundary.
- **A filename rename field** - see the decision above; a real, freely-buildable follow-up.
- **Disabling the Playlist export button when no playlist is set** - see the decision above.
- **The Bassoon/Hippo disk-operations playlist listboxes** (browsing/loading a saved playlist, as opposed to exporting the currently-held one) - unchanged from spec 065's own scope boundary.
