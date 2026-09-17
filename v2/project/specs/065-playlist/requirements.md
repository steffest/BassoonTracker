# 065 — The Playlist domain model

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 064 (sample export). Picks up the piece spec 063 deliberately cut: "`randomPlayList`/`generatePlayList` ... genuinely need a real `Playlist` domain model ... cut cleanly as a separate, recorded follow-up."

## Purpose

Spec 063 resolved the File menu's `randomSong`/`randomSongXM` commands but left `randomPlayList` (the "Open Random Playlist" menu item, compiled to `play-list.random`) as a `mocked-command` on purpose, since generating and playing a playlist needs a real playlist model v2 does not have yet. This spec builds that model - state, PLS/M3U import, PLS/M3U/JSON export (P9's own separately-named "playlist export" acceptance item), and next/prev/shuffle navigation - and uses it to resolve `play-list.random`.

## What v1 actually does (read from source, not assumed)

- **`script/src/models/playlist.js`** (266 lines, read in full) is a singleton closure holding `currentPlaylist` (`{title, modules: [{title, url, link?}]}`), `currentIndex`, `isShuffle`/`playOrder`, and `playListActive` (gates auto-advance only). `me.set(data)` replaces the playlist and recomputes `playOrder`; `me.play(index)`/`me.loadTrack(index, andPlay)` call `Tracker.load(item.url, true)`, set `Tracker.autoPlay = true` when `andPlay`, and (browser-only) push the index into the URL's own query string via `history.pushState`.
- **`me.next()`/`me.prev()`** advance `currentIndex` (through shuffle's own `playOrder` when active), skip one further step if the landed-on entry has no `url` (matching a possible gap in a parsed playlist), then call `me.play(currentIndex)`. `moveIndex`'s own shuffle branch has a latent, confirmed-harmless bug: `playOrder.indexOf(currentIndex) || 0` intends "default to 0 when not found," but `indexOf` returning `-1` is truthy in JS, so the fallback never actually triggers for a genuine miss - inert in practice, since `playOrder` always holds every index `0..length-1` whenever a playlist is set, so `currentIndex` is never actually absent from it.
- **`me.parse(data, name)`** switches on the file's own extension (`pls`/`m3u`) - PLS reads `FileN=`/`TitleN=` pairs; M3U reads any line starting with `http`, deriving a title from the URL's own last path segment. Both filter through `isFormatSupported(url)`, itself carrying a real, harmless dead branch: `case ".pls":` inside a `switch` on an extension that is always computed via `.split(".").pop()` (never including the leading dot), so that case can never match - ported faithfully as dead code, not "fixed," since it changes nothing observable.
- **`me.export(filename, format, target)`** builds PLS (`generatePLS`), M3U (`generateM3U`) or JSON (`JSON.stringify(currentPlaylist, null, 2)`) text, resolving any relative module URL against `window.location.href` first (browser-only), and downloads it via `saveFile`/`Dropbox.putFile`.
- **`script/src/ui/diskOperations.js#generatePlayList`** (665-678, already read for spec 063's own research) is the `play-list.random` command's real body: fetch `https://www.stef.be/bassoontracker/api/generatelist`, and on a `{modules: [...]}` response, `Playlist.set(data)` then `Tracker.autoPlay = true; Playlist.play(0)`.
- **Auto-advance** (`EVENT.songEnd` → `Playlist.next()` after a delay, only while `playListActive`) and the Bassoon/Hippo disk-operations screen listboxes (`diskOperations.js:596-626`, populating a playlist picker from `playlists/main.json` or `Hippo.get("playlists"/"playlist/"+url, ...)`) are both real v1 features this spec does not build - see Scope boundaries.

## Decisions and assumptions

- **`domain/playlist/index.js` is its own domain folder**, not folded into `domain/randomSong/` or `domain/providers/`: it owns real, persistent-for-the-session state (the current playlist, index, shuffle order) the way `domain/song/`/`domain/nibbles/` do, which neither of those two stateless capability folders has any reason to hold.
- **`domain/providers/bassoon.js` gains `fetchGeneratedPlayList()`**, alongside `fetchRandomModuleUrl` - the same "only `domain/providers/` may name a provider host" rule spec 063 already established (`tests/domainBoundary.test.js`), re-exported from `domain/providers/index.js` the same way.
- **v1's own two harmless quirks (the inert `indexOf(...) || 0` fallback, the dead `.pls` switch case) are ported faithfully, not fixed** - neither is reachable with an observable effect (see above), matching this roadmap's own bar for "preserve unless a real reader could be affected" (e.g. spec 043's asymmetric snap-to-zero).
- **Relative-URL resolution in export falls back gracefully with no `window`.** `resolveUrl()` only calls `new URL(url, window.location.href)` when `window`/`window.location` exist (true in a real browser, absent in this test environment); otherwise a relative URL is written through unresolved. This is a genuine, recorded behavior difference from v1 in the one situation (no browser) v1 itself could never actually run in either, not a divergence any real user hits.
- **`play-list.random` gets a real capability (`openGeneratedPlaylist`)**, mapped in `capabilities.js` - the already-authored, currently-`mocked-command` action from `app.yaml`'s own "Open Random Playlist" menu item (spec 063's own recorded side effect). `exportPlaylist` (the "playlist export" capability) is built and tested but **not** wired to any command: `node compiler/generate.js` was re-run before writing this spec and confirmed no authored YAML references playlist export at all, the same finding spec 064 made for sample export - a save/export screen remains its own, separately-recorded later item.
- **A real, pre-existing test-infrastructure gap was found and fixed while researching this spec, not introduced by it**: `tests/domainBoundary.test.js#sourceFiles()` named `"domain/song"` and `"domain/moduleExport"` individually rather than `"domain"` as a whole, so every domain folder added since spec 033 (`settings`, `providers`, `randomSong`, `sampleEditor`, `nibbles`, `arrangement`, `diskOperations`) was silently never scanned by any of that file's four checks - confirmed by instrumenting the walk directly, not assumed. Widening it to `"domain"` alone (a strict superset) surfaced only pre-existing doc-comment false positives (`localStorage`/`modarchive.org` mentioned as prose in `domain/nibbles/`, `domain/settings/` and `domain/playback/engine/fileformats/detect.js`, none of them real violations), fixed by having every check strip comments (block and line) before testing, rather than by narrowing the walk back down or special-casing those three files. This is fixed here because `domain/playlist/` is the first new domain folder since the gap existed whose own correctness genuinely depends on that check actually running.

## User stories and acceptance

- **PLAYLIST-001 — Set/get/parse round-trip.** `setPlaylist(data)`/`getPlaylist()` hold the given playlist; `parsePlaylist(text, "x.pls")` and `parsePlaylist(text, "x.m3u")` each recover the same `{title, modules}` shape v1's own `parse` would, against hand-built PLS/M3U text.
- **PLAYLIST-002 — Export round-trips through parse.** `writePlaylist("pls")`/`writePlaylist("m3u")` produce text that `parsePlaylist` reads back to the same `modules` list (title/url pairs); `writePlaylist("json")` round-trips through `JSON.parse` exactly.
- **PLAYLIST-003 — Navigation.** `playTrack(app, index)` loads that entry's module and updates the current index; `nextTrack`/`previousTrack` advance (wrapping at both ends), skip one further step past an entry with no `url`, and respect `toggleShuffle()`'s own play order once enabled.
- **PLAYLIST-004 — `play-list.random` is real.** `openGeneratedPlaylist(app)` fetches the generated playlist, sets it as current, and plays index 0; on a failed fetch it logs an error and does not throw. Acceptance: `node compiler/generate.js` reports one fewer `mocked-command` loose end for `play-list.random`.
- **PLAYLIST-005 — `exportPlaylist` triggers a real download.** Given a set playlist, `exportPlaylist(app, format)` (for each of `"pls"`, `"m3u"`, `"json"`) triggers a browser download with the right extension, matching `tests/moduleExport.test.js`'s/`tests/sampleExport.test.js`'s own DOM-stub convention.
- **PLAYLIST-006 — No regressions.** Full unit suite passes; `node compiler/generate.js`/`node build.mjs app`/`dist` succeed; the widened `domain` boundary walk (see Decisions) reports zero real offenders.

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- `capabilities.js` gains exactly one new mapping (`play-list.random`); no YAML change (the action was already authored, spec 063).

## Scope boundaries

In scope: `domain/playlist/index.js` (new), `domain/providers/bassoon.js#fetchGeneratedPlayList` (+ re-export), `capabilities.js`'s `play-list.random` mapping, the `tests/domainBoundary.test.js` walk/comment-stripping fix, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Auto-advance on song end** (`EVENT.songEnd` → `next()`) - needs a new subscription hook out of `domain/playback/index.js` (nothing today exposes `EVENT.songEnd` to a capability outside `createEngine`'s own return value) and has no UI trigger to reach it yet either; a real, separate, recorded follow-up.
- **The Bassoon/Hippo disk-operations screen playlist listboxes**, and HippoPlayer's own `Playlist.set(data)` wiring - screen work, not this spec's "mechanism first" slice; needs `domain/diskOperations/` or a sibling extended, later.
- **Dropbox as an export target** - matching spec 037/038/064's own identical, already-recorded scope boundary.
- **`me.getSongInfoUrl`** - a HippoPlayer-screen-specific lookup with no caller until that screen exists.
- **A save/export screen** - `exportPlaylist` has nowhere to be triggered from yet, the same recorded decision spec 064 made for `exportSample`.
- **v1's own browser-URL query-string sync** (`history.pushState` on track change) - a browser-integration detail, not a domain concern; not ported.
