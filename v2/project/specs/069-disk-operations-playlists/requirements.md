# 069 — The disk-operations screen's playlist targets

Date: 2026-09-16. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 068 (loading a playlist file). Closes P9's own last remaining, unallocated piece.

## Purpose

Spec 068 built the mechanism (`domain/playlist#openPlaylistUrl`) a "load a saved playlist" screen fundamentally needs. This spec is that screen: two more targets in `fileOperationsPanel.yaml`'s existing target radioGroup - "Playlists" (a curated local snapshot, mirroring the existing "Bassoon" module target) and "Hippo" (HippoPlayer's own playlist catalog, via `domain/providers/hippo.js#browse()`, built in spec 034 and unused until now). With this, **package P9 is closed**.

## What v1 actually does (read from source, not assumed)

- **`script/src/ui/diskOperations.js`'s own `"playlists"` target** (586-606, re-read for spec 068's own research) reads `playlists/main.json` (v1's own real root file, read in full: nine entries, most pointing at a further `playlist-<name>` pseudo-URL that `Editor.unpackUrl` resolves to `playlists/<name>.json`). Clicking a row calls the generic `Tracker.load(...)`, relying entirely on the `FILETYPE.playlist` detection/handling spec 068 just closed.
- **`"hippo"`'s own target** (607-626) calls `Hippo.get("playlists", cb)` to populate the list, and, per row, `Hippo.get("playlist/" + item.data.url, cb)` directly followed by `Playlist.set(data)` - no file-format detection needed, since the API's own `"playlist/<name>"` endpoint already returns a ready `{title, modules}` object (confirmed both in v1's `script/src/provider/hippo.js#loadFromApi` and this port's own `domain/providers/hippo.js`, whose `browse()` JSDoc had accurately described the *local* two-verb dispatch shape but not, until this spec, the real wire URL each verb hits).
- **Every real file in `playlists/*.json`** (read again for this spec, having been surveyed once already for spec 068's own research) was hand-counted: `demoscene2023`/`demoscene2024`/`demoscene2025`/`demoscene2026`/`DSR2024`/`chippies`/`raw_diskmag` (seven files) are each ≥90% absolute-URL, real, fetchable module entries, with only ten relative (`mods/...`) entries across three of them (`demoscene2024`: 5, `demoscene2025`: 2, `demoscene2026`: 3) needing to be filtered, the same way spec 036 filtered `data/modules.json`'s own sixteen `demomods/`-relative entries out. A handful of entries in some files carry no `url` at all - confirmed, by inspecting them directly, to be section headers (e.g. `{"title": "Gerp 2023", "icon": "icons/gerp.png"}`), not broken links - these need no filtering at all, since `domain/playlist`'s own navigation (spec 065) already treats a no-`url` entry as a gap to skip past, exactly the behavior these headers need. `demosongs.json` is 100% `demomods/`-relative (the same folder spec 036 already declined to copy) and is excluded. `main.json`'s own "My Favorites" entry (`unpackUrl("favorites")` → a server-relative `/favorites.pls`) is a different, server-side, anonymous-session feature unrelated to `domain/settings/favorites.js` (spec 033) and is excluded.

## Decisions and assumptions

- **A curated `assets/data/playlists.json` + `assets/data/playlists/<name>.json`** mirrors `data/modules.json`'s own precedent (spec 036) exactly: one small root listing plus, this time, one real per-playlist snapshot file per entry (each itself filtered the same way). Scripted, not hand-typed - the ten relative entries across three files were found and removed by a small one-off Node script reading each real source file directly, not retyped by hand (avoiding transcription error across roughly 340 real module entries).
- **`domain/diskOperations/index.js` gains two more targets**, not a second capability module - it already owns exactly this shape (a cached tree per target, root-fetch-then-flatten, a leaf click that does something with the clicked row). `rootFor()` gains two branches (`loadPlaylistsRoot`, mirroring `loadBassoonRoot`; `browseHippo("playlists")`, mirroring the existing `PROVIDERS` map's own remote-catalog calls); `setBrowserRow()`'s leaf branch gains two more `currentTarget` checks, dispatching to `domain/playlist#openPlaylistUrl` (Playlists) or `browseHippo("playlist/<name>")` + `domain/playlist#setPlaylist` directly (Hippo - no file-fetch/parse needed, the API already returns a ready object).
- **`domain/providers/hippo.js#browse()`'s own JSDoc is corrected**, not just reused - found, while becoming this module's first real second caller, that its return type genuinely differs by verb (`"playlists"` → an array; `"playlist/<name>"` → a playlist object, or `[]` on a failed fetch) and its own comment never said so.
- **`build.mjs`'s dist media-copy step gains one more relative path** (`"data/playlists"`), following spec 036's own precedent of generalizing that list rather than hardcoding a second copy loop - and, while doing so, found and fixed a real, confirmed bug the new subdirectory exposed immediately: the existing loop's own `readdirSync(mediaDir)` filter excluded dotfiles but never checked for a directory entry, so once `assets/data/` gained its own `playlists/` subdirectory, the very first `dist` build attempted `copyFileSync` on a directory and crashed (`ENOTSUP`). Fixed by skipping directory entries in that filter - a latent defect nothing had triggered before this spec, not a regression this spec introduced.

## User stories and acceptance

- **DISKPL-001 — The Playlists target lists the curated snapshot.** `setDiskTarget(app, {value: "Playlists"})` fetches `assets/data/playlists.json` and publishes its entries as flat, level-0 rows, the same shape `"Bassoon"` already produces.
- **DISKPL-002 — Clicking a Playlists row loads that playlist.** The clicked row's own `url` (resolved against v2's own asset base) is fetched and parsed via `openPlaylistUrl` (spec 068); `domain/playlist#getPlaylist()` reflects it afterward.
- **DISKPL-003 — The Hippo target lists the API's own catalog.** `setDiskTarget(app, {value: "Hippo"})` calls `domain/providers/hippo.js#browse("playlists")` and publishes the result the same way.
- **DISKPL-004 — Clicking a Hippo row loads that playlist directly.** The clicked row's own `url` resolves through `browse("playlist/<url>")`, and the result - already a `{title, modules}` object - is set directly via `setPlaylist`, with no fetch/parse step of this spec's own; a failed fetch (the API's own `[]` failure shape) leaves the current playlist unchanged.
- **DISKPL-005 — No regressions.** Full unit suite passes; `node compiler/generate.js` reports no new warnings; `node build.mjs app`/`dist` both succeed (two new `inert-control` loose ends for the two new radio items, nothing else).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No `capabilities.js` change - `setDiskTarget`/`setBrowserRow` are already real, mapped capabilities (spec 036); this spec only extends what they do internally.

## Scope boundaries

In scope: `assets/data/playlists.json` + `assets/data/playlists/*.json` (new, curated), `domain/diskOperations/index.js`'s two new targets, `domain/providers/hippo.js`'s corrected JSDoc, `build.mjs`'s media-copy fix, `fileOperationsPanel.yaml`'s two new radio items, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Auto-play on loading a saved playlist** - matches v1's own real behavior exactly (spec 068's own recorded decision); not something to add here either.
- **The remaining two of nine `playlists/*.json` entries** ("Demo Songs," `demomods/`-relative; "My Favorites," an unrelated server feature) - both real, confirmed exclusions, not oversights.
- **Any per-row navigate-back-to-main behavior** (v1's own `App.doCommand(COMMAND.showTopMain)` after a "playlists"/"hippo" row loads) - the existing "Bassoon"/"ModArchive"/"Modules.pl" leaf-click behavior has never done this either; adding it asymmetrically for only the two new targets was rejected as inconsistent, not merely deferred.
