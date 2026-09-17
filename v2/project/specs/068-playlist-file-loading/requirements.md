# 068 — Loading a playlist file

Date: 2026-09-16. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 067 (the save/export screen) and yesterday's scope amendment (MP3/WAV whole-song export and Dropbox permanently dropped, open decisions 8/9). Closes a real, confirmed gap found while scoping P9's own last remaining piece (the Bassoon/Hippo disk-operations playlist listboxes): the ported engine has *detected* a playlist file since package P2, but nothing has ever *handled* one.

## Purpose

`domain/playlist/` (spec 065) has everything needed to hold, navigate and export a playlist, and a way to generate one from Bassoon's own API (`play-list.random`). It has no way to load one from a file at all - the one thing the disk-operations playlist listboxes fundamentally need before they can do anything useful. This spec closes that gap directly, so the (still-unallocated) screen work has something real to call.

## What v1 actually does (read from source, not assumed)

- **`script/src/fileformats/detect.js`** classifies `.pls`/`.m3u` by extension and a `.json` file as a playlist if its parsed content has a `modules` array (29-38) - already ported verbatim into `domain/playback/engine/fileformats/detect.js` (27-33) by package P2, unchanged since.
- **`script/src/tracker.js#processFile`** (2124-2263), v1's single entry point for *any* loaded file, branches on the detector's own result: `result.isMod` loads a module (the only branch package P2's own `domain/playback/engine/tracker.js#processFile` ported); `result.type === FILETYPE.playlist` (2248-2258) reads the file's own text, parses it (`JSON.parse` for `.json`, `Playlist.parse(text, name)` for `.pls`/`.m3u`), and calls `Playlist.set(playlistData, name)`. **This branch was never ported** - confirmed by reading `domain/playback/engine/tracker.js#processFile` (1882-1911) directly: it still computes `result.type` (the object literal `{name: "PLAYLIST", type: FILETYPE.playlist}` is even still there, dead), but only ever acts on `result.isMod`. A playlist file loaded through `domain/playback#loadModule` today silently does nothing.
- **`script/src/ui/diskOperations.js`'s own `"playlists"` disk-op target** (586-606) reads a small local `playlists/main.json` (own pseudo-URL entries like `"playlist-demosongs"`, resolved by `Editor.unpackUrl` (685-702) to `"playlists/demosongs.json"`) and, on a click, simply calls `Tracker.load(...)` - the generic file loader above, relying entirely on its own playlist-detection branch to do the real work. **`"hippo"`'s own target** (607-626) is different: `Hippo.get("playlist/" + url, callback)` already returns a ready-made `{title, modules}` object directly from the API, so it calls `Playlist.set(data)` immediately, with no file-format detection at all.

## Decisions and assumptions

- **The missing handling lands in `domain/playlist/`, not `domain/playback/`.** `domain/playback/index.js` cannot import `domain/playlist/` (it would be circular - `domain/playlist` already imports `domain/playback#loadModule`), and `domain/playback`'s own documented contract is module playback only (see its README). `domain/playlist` is the one place that already knows both what a playlist object looks like and how to fetch cross-origin content safely (via `domain/providers#fetchModuleUrl`'s own proxy-retry, which `domain/playback#loadModule` already uses for the identical reason).
- **`parsePlaylistFile(text, name)` is the direct v2-native replacement for `processFile`'s own dead detection branch** - not a call into `domain/playback/engine/fileformats/detect.js` (which stays exactly what it already is: read-only classification the ported `Tracker.processFile` still computes for its own module-loading purposes, never a general-purpose parser). `name`'s own extension decides the shape, exactly as v1's branch does: `.json` is already `{title, modules}`; anything else goes through `parsePlaylist` (spec 065, unchanged).
- **`openPlaylistUrl(app, url)` reuses `domain/providers#fetchModuleUrl`**, the same proxy-retry-on-network-failure contract `domain/playback#loadModule` already relies on for cross-origin module URLs - a playlist file is fetched from the same kinds of hosts (Bassoon's own server, a remote catalog), so it needs the identical resilience, not a second, parallel fetch helper.
- **No auto-play.** v1's own `processFile` branch only calls `Playlist.set`; nothing about loading a playlist file starts playback (auto-play only ever happens from `Editor.js`'s own page-bootstrap path, reading a URL's own `index` query parameter - out of scope, see spec 065's own scope boundary on v1's browser-URL query-string sync). `openPlaylistUrl` matches that: it sets the playlist and returns, nothing more.

## User stories and acceptance

- **PLFILE-001 — `.json` playlist content parses directly.** `parsePlaylistFile(text, "x.json")` returns `JSON.parse(text)` unchanged, for real playlist-shaped JSON (`{title, modules}`).
- **PLFILE-002 — `.pls`/`.m3u` content parses through the existing importer.** `parsePlaylistFile(text, "x.pls")`/`"x.m3u"` produce the same result `parsePlaylist(text, name)` already does (spec 065, unchanged).
- **PLFILE-003 — `openPlaylistUrl` fetches, parses and sets.** Given a URL resolving to real `.json`/`.pls` content, `openPlaylistUrl(app, url)` sets that content as the current playlist (`getPlaylist()` reflects it) and resolves `true`.
- **PLFILE-004 — Graceful degradation.** A non-OK response, a rejected fetch, malformed JSON, or well-formed JSON with no `modules` array each resolve to `false` without throwing and without changing whatever playlist was already current.
- **PLFILE-005 — No regressions.** Full unit suite passes; `node compiler/generate.js`/`node build.mjs app`/`dist` succeed with no new warnings or loose ends (no YAML/`capabilities.js` change - this is a domain-level mechanism, no new command).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No YAML/compiler/`capabilities.js` change.

## Scope boundaries

In scope: `domain/playlist/index.js#parsePlaylistFile`/`#openPlaylistUrl`, and tests for both.

Out of scope, recorded rather than silently dropped - **the actual disk-operations playlist listboxes remain P9's own last unallocated piece**:

- **The Bassoon "Playlists" disk-op target** (a curated, local `playlists/main.json`-equivalent snapshot, mirroring spec 036's own `data/modules.json` curation) - real research already done while scoping this spec, recorded here to save the next one's own pass: of the nine real playlist files in `playlists/*.json`, six (`demoscene2023`-`2026`, `DSR2024`, `chippies`, `raw_diskmag`) are ≥90% absolute URLs (real, fetchable modarchive/demozoo-style links, curatable the same way spec 036 filtered `data/modules.json`'s own sixteen `demomods/`-relative entries out); `demosongs.json` is 100% `demomods/`-relative (would need the same folder spec 036 already declined to copy); `main.json`'s own "My Favorites" entry (`unpackUrl("favorites")` → a server-relative `/favorites.pls`) is a different, server-side, anonymous-session feature unrelated to `domain/settings/favorites.js` (spec 033) and does not map onto anything this port has.
- **The Hippo disk-op target** - `domain/providers/hippo.js#browse("playlists")`/`browse("playlist/<name>")` (spec 034) already exist, unused until now; wiring them into `domain/diskOperations/` and `fileOperationsPanel.yaml` is real, small, remaining work.
- **Auto-play on load** - matches v1's own behavior exactly (see the decision above); not something to add.
