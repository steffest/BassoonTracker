# 036 — The disk-operation screen: loading a module

Date: 2026-09-13. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 035 (the `fileBrowser` mechanism). Delivers P9's own stated acceptance line, "a module loads from each provider."

## Purpose

Spec 035 built `fileBrowser` - the specialized leaf a disk-operation screen needs - verified against a hand-built row array, with no screen authored. This spec authors that screen and the capability that drives it, for the one slice that is both fully unblocked (nothing else outstanding: `fileBrowser` exists, `domain/providers/{modArchive,modulesPl}.js#browse()` exist since spec 034, `domain/playback/index.js#loadModule` exists since spec 012) and matches P9's own acceptance criterion word for word: loading a module from each of the providers this port has actually built.

## What v1 actually does, and what this narrows out (read from source, not assumed)

`script/src/ui/diskOperations.js` (re-read for spec 035, and again here) is one screen serving load *and* save, for modules *and* samples *and* playlists, across five targets including Dropbox and local files, plus a "random song"/"generate playlist" pair of unrelated one-shot commands. Authoring all of that now would either silently reproduce features nothing else in this port yet supports (Dropbox has no capability - spec 034's own scope decision; samples/playlists have no load path in `domain/song`/a playlist model; save needs the format write path, unallocated), or invent placeholder behavior for them, which is worse than not authoring them yet. This spec authors exactly the slice that is real: **loading a module**, from:

- **Bassoon** - v1's own `data/modules.json`, a small, curated, host-served snapshot (`diskOperations.js:341-350`). v2 has no such folder of vendored demo `.mod`/`.xm` files to point a full copy at (most of v1's own entries are `demomods/<file>`, relative to a static folder this port never copied), so this spec ships a smaller, curated `v2/assets/data/modules.json`: the one demo module already bundled (spec 012's `assets/demo/wizballalt.mod`) plus the eight entries from v1's own list whose URL is already absolute (`https://www.stef.be/amiga/mod/*.mod`) and therefore genuinely fetchable from anywhere, unchanged. A recorded, deliberate scope reduction, not a silent one.
- **ModArchive**, **Modules.pl** - the root of each is v1's own `data/modarchive.json`/`data/modulespl.json`: four fixed, unloaded-branch items (`{title, url, children: []}`) whose `url` is already exactly the pseudo-path `domain/providers/{modArchive,modulesPl}.js#browse()` understands ("artists", "genres", "toprating"/"topscore"/"topreview"). Small and unchanging, so hardcoded in this spec's own capability rather than fetched as two more static assets.
- **Local, Dropbox** - not targets in this spec. Local files are already reachable today by dropping one on the canvas (spec 014's `host.openFiles`); this screen does not need to duplicate that entry point. Dropbox is spec 034's own deferred piece.

## Decisions and assumptions

- **One capability module, `domain/diskOperations/index.js`**, owning a small in-memory tree per target (cached for the application's lifetime, never reset on switching back and forth - matching v1's own per-target module-level arrays) and the flatten-into-`fileBrowser`-rows step spec 035's own mechanism expects. Two commands: the target radioGroup's `change` (`disk-target.set`) and the fileBrowser's own `change` (`browser-row.set`, name derived by the "set-value" recipe from the authored action `setBrowserRow`, exactly as every other value-bound control's field/command pair already is).
- **A row's own meaning stays entirely inside this capability**, matching spec 035's own design: the fileBrowser reports "row *N* was clicked"; whether that means "expand a branch" or "load a leaf" is resolved by looking the row up in this capability's own parallel array of real tree nodes, never by the renderer.
- **Expansion state and fetched children live on the tree node itself** (`node.expanded`, `node.children` replaced once fetched), the same shape v1's own tree items already have - not a second, parallel bookkeeping structure.
- **A leaf's `url` is resolved against v2's own asset base before reaching `loadModule`**, not left to that function's own fallback (the page's own location), since a local snapshot entry is relative to `v2/assets/`, not to wherever the generated application happens to be hosted. A remote catalog's own `url` is already absolute, so the same resolution step is a no-op for it - one code path, not two.
- **The panel is reached exactly as it already is today**: the control bar's own "File Operations" radio button (`components/controlBar.yaml`, authored since spec 026) already sets `top-view.value`, which `fileOperationsPanel.yaml`'s own `visibleWhen` already gates on - both predate this spec and needed no change. The File menu's own `showFileOperations` item stays an unresolved action reference, unchanged; wiring a second entry point to the same panel is not this spec's job.

## User stories and acceptance

- **DISK-001 — Bassoon loads.** Selecting "Bassoon" fetches the curated local snapshot once (cached after) and shows it as flat, level-0 rows with no children. Clicking one loads it as the current module. Acceptance: a unit test against a fake `fetch` and a real fixture module, asserting the engine reports the loaded title.
- **DISK-002 — ModArchive and Modules.pl load, browse, and load again.** Selecting either shows the four fixed root items as unloaded branches. Clicking one lazily fetches its children exactly once (through `domain/providers/` unchanged) and re-flattens; clicking an already-expanded branch collapses it without re-fetching; clicking a resulting leaf loads it. Acceptance: unit tests against a fake `fetch`, asserting the fetch count, the flattened row shape (title/icon/info/level/hasChildren) and the collapse/re-expand path.
- **DISK-003 — Graceful degradation.** A failed local-snapshot fetch publishes an empty list rather than throwing; a branch that resolves to no children shows a single "(no results)" row rather than nothing; an out-of-range row index (a stale click after the list changed) is a no-op. Acceptance: unit tests for each.
- **DISK-004 — No regressions.** Full unit suite passes; `node build.mjs app`/`dist` succeed; the two new commands leave the mocked-command list; the three new radio items are the same "inert-control, UI state only" shape every other radioGroup's items already have (nothing new to fix there).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- `v2/assets/data/modules.json` is a new, small, checked-in asset; `build.mjs`'s existing `dist` asset-copy step (previously hardcoded to `assets/demo/` alone) is generalized to copy any `assets/<subdir>/` a capability might load from, since this is now the second such folder.

## Scope boundaries

In scope: `project/specs/application/current/components/fileOperationsPanel.yaml` (replacing spec 026's placeholder), `domain/diskOperations/index.js`, `v2/assets/data/modules.json`, the two `capabilities.js` mappings, `build.mjs`'s small generalization, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Samples, playlists, save/export, Dropbox, local-file browsing** - see "What v1 actually does" above; each needs a capability or a mechanism this port does not have yet.
- **`random.*`/`generatePlayList` command wiring, the File menu's `showFileOperations`** - unchanged from specs 034/035's own scope boundaries; the panel is already reachable through the control bar.
- **The full v1 `data/modules.json`** - only the entries that are genuinely fetchable from any deployment are carried forward; recorded as a deliberate curation, not an oversight.
