# 063 — Random song

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 038 (XM export). Picked up per user direction ("continue with P9" - see the roadmap's own decision to reconsider P12, its optional package, in favor of finishing P9's required "it ships" scope first).

## Purpose

Closes two of the File menu's three remaining `unresolved-action-reference` warnings (`randomSong`, `randomSongXM` - `app.yaml:34,38`): "Open Random MOD Song"/"Open Random XM Song" fetch a random module from the ModArchive API (through this repo's own `api/` server, kept as-is per the roadmap's resolved open decision 4) and load it, exactly like clicking a leaf in the disk-operations screen already does (spec 036).

## What v1 actually does, and what this narrows out (read from source, not assumed)

`script/src/ui/diskOperations.js:634-654,766-772` (`playRandomSong`): `Tracker.autoPlay = true` then a `FetchService.json` call to `https://www.stef.be/bassoontracker/api/random` (or `.../randomxm` for the XM variant - literal string concatenation, `"random" + (format||"")`, matching `api/server.js`'s own `case "randomxm"` route exactly), parsing `data.modarchive.module.url` and calling `Tracker.load(url)`. On a malformed response, only `console.error(...)`s - no thrown exception, no user-facing error beyond that. A parallel status-bar message (`UI.setStatus("Fetching random song", true)`) is cosmetic feedback with no v2 equivalent to hook into (the generated app's own status-bar file was removed in an unrelated, prior restructure) - not reproduced, the same class of omission this port has made for other transient toasts.

**`Tracker.autoPlay`** (read in full, `engine/tracker.js:330,362`, already ported wholesale in P2): despite its name, this flag does not itself start playback - it only controls whether `EVENT.songEnd`/endless-loop detection fires during an *already-playing* song, relevant to playlist auto-advance (`Playlist`'s own `EVENT.songEnd` listener, `script/src/models/playlist.js:230-238`). With no playlist model in this port yet (see Decisions), setting it here would do nothing observable - **not ported**, a real, confirmed simplification, not an oversight.

**`generatePlayList`/`COMMAND.randomPlayList`** and **HippoPlayer's own disk-ops target** both need a real `Playlist` domain model (`script/src/models/playlist.js`, 266 lines, read in full: current playlist/index, next/prev navigation with optional shuffle, `.pls`/`.m3u` parsing and export, auto-advance on `EVENT.songEnd`) - a genuinely separate, moderately-sized domain concept neither existing capability has any reason to grow into incidentally. **Out of scope here**, a real, recorded follow-up - see Scope boundaries.

## Decisions and assumptions

- **A new domain folder, `domain/randomSong/`**, not folded into `domain/diskOperations/` (screen-scoped, per that module's own framing). Two thin exports, `openRandomSong(app)`/`openRandomSongXM(app)`: fetch the module URL and hand it to `domain/playback/index.js#loadModule` (which already retries the *module* fetch through the proxy on a network failure) - the same two-step shape a disk-ops leaf click already has. **The API fetch itself lives in `domain/providers/bassoon.js`, not here** (a real correction, found by running the test suite, not anticipated up front): `tests/domainBoundary.test.js` enforces that only `domain/providers/` may name a remote-catalog host directly, the same rule `domain/diskOperations/` already follows for ModArchive/modules.pl. `fetchRandomModuleUrl(format)` lives in `bassoon.js` (the same file already hardcoding this exact host for `proxyUrl`) and is re-exported from `domain/providers/index.js`, the same way `proxyUrl`/`isProxyUrl` already are; `domain/randomSong/index.js` only ever calls it.
- **A new `verb-action` verb, `random`.** Confirmed empirically: `randomSong`/`randomSongXM`'s own action-name prose ("random song"/"random song xm" - no leading verb at all, unlike every other action this port has resolved so far) matches no existing recipe. Extending `verb-action`'s own verb list with `random` resolves both with no new recipe class needed: `song.random`/`song-xm.random`, `mockField: null` (a one-shot fire-and-forget command, the same shape `save`/`start`/`open` already are). As a side effect - the same class of incidental resolution spec 048's own `show` verb addition already recorded once for its own three siblings - `randomPlayList` ("random play list") also now resolves, to `play-list.random`; left unmapped (a `mocked-command` loose end, not an `unresolved-action-reference` one), since mapping it needs the `Playlist` model this spec explicitly does not build.
- **Graceful degradation, matching v1's own `console.error`-only fallback**: a malformed API response, a network failure fetching it, or `loadModule` itself throwing (a bad HTTP status loading the returned module URL) all resolve to a quiet no-op - nothing loads, nothing crashes, no thrown rejection reaches the action dispatcher.
- **No status-bar "fetching..." message, no `Tracker.autoPlay`** - see above, both real, recorded simplifications.

## User stories and acceptance

- **RANDOM-001 — A successful random-song fetch loads the returned module.** `openRandomSong(app)` against a fake `fetch` returning a well-formed envelope calls `loadModule` with the envelope's own `url`; the engine reports the loaded title. Acceptance: a unit test against a fake `fetch` and a real fixture buffer.
- **RANDOM-002 — The XM variant hits the XM-specific endpoint.** `openRandomSongXM(app)` fetches `.../api/randomxm`, not `.../api/random`. Acceptance: assert the fetched URL directly.
- **RANDOM-003 — Graceful degradation.** A malformed envelope (missing `modarchive`/`module`/`url`), a rejected `fetch`, and a `loadModule` rejection (a 404 loading the returned module URL) all resolve to `false`/no throw, with nothing loaded. Acceptance: one unit test per case.
- **RANDOM-004 — No regressions.** Full unit suite passes; `node compiler/generate.js` shows the `randomSong`/`randomSongXM` warnings gone (one remains, `pattern2Sample`, unrelated); `node build.mjs app` succeeds, the two new commands are real (not mocked).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given); the real ModArchive API is never actually called in a test - a fake `fetch` stands in, the same convention `tests/diskOperations.test.js` already uses.

## Scope boundaries

In scope: `domain/randomSong/index.js` (new), its README, one new `compiler/recipes.js` verb, two `capabilities.js` mappings, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **`randomPlayList`/`generatePlayList`, a `Playlist` domain model, `.pls`/`.m3u` parsing and export, playlist export to Dropbox** - a real, separate, freely-buildable follow-up (`script/src/models/playlist.js`, read in full above).
- **HippoPlayer as a disk-operations screen target** - its own catalog is playlist-shaped (`browse("playlist/<name>")` returns a whole playlist, not a single loadable module), so it depends on the same `Playlist` model above, not a simple fourth `PROVIDERS` entry.
- **The File menu's `showFileOperations`** (a second entry point to the already-reachable disk-operations panel) - unchanged from every prior P9 spec's own recorded boundary.
- **A status-bar "Fetching random song" message** - cosmetic, no v2 equivalent exists to hook into right now.
