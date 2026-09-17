# 068 — Tasks

Status: done.

- [x] Read `script/src/tracker.js#processFile`'s own `FILETYPE.playlist` branch (2248-2258) and confirm, by reading `domain/playback/engine/tracker.js#processFile` directly, that it was never ported (the `result.type` computation is still there; only `result.isMod` is ever acted on).
- [x] Read `script/src/ui/diskOperations.js`'s own `"playlists"`/`"hippo"` disk-op targets (586-626) and `Editor.unpackUrl` (685-702) to confirm exactly what the still-unallocated screen work will eventually need, and record it precisely in requirements.md rather than leaving it vague.
- [x] `domain/playlist/index.js`: `parsePlaylistFile(text, name)`, `openPlaylistUrl(app, url)`.
- [x] `tests/playlist.test.js` (extended): 8 new tests.
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`/`dist`: unaffected (no YAML/compiler/capabilities.js touched).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no UI exists yet to reach this - the disk-operations playlist listboxes are the still-unallocated screen work this mechanism unlocks). `tests/playlist.test.js`'s own existing fake-fetch convention (a `responses` Map keyed by absolute URL) is reused directly, since `openPlaylistUrl` calls `domain/providers#fetchModuleUrl`, the same function `domain/randomSong`'s own tests already exercise this way.

## Evidence

- `tests/playlist.test.js`: 34/34 passing (26 from specs 065-067 + 8 new) - `parsePlaylistFile` for `.json` (the object round-trips through `JSON.stringify`/`JSON.parse` unchanged) and for `.pls`/`.m3u` (matches `parsePlaylist`'s own output exactly, compared directly rather than hand-duplicated); `openPlaylistUrl` fetching a real `.json` and a real `.pls` playlist and setting each as current; a non-OK response, a rejected fetch (with the proxy retry also failing), malformed JSON, and well-formed JSON with no `modules` array each resolving to `false` with the previously-current playlist left untouched.
- Full suite: `node --test tests/*.test.js` → 952/952 passing (944 before this spec + 8).
- `node compiler/generate.js`: 12 warnings, unchanged. `node build.mjs app`: 101 loose ends, unchanged (no YAML/compiler/capabilities.js touched - this spec is headless, matching every "engine first" spec since 039). `node build.mjs dist` succeeds.
- `node --check` passed on the touched source file and the touched test file before the suite ran.

## Found while doing it

- **The gap this spec closes was fully latent, not partially built**: `domain/playback/engine/tracker.js#processFile` (package P2, spec 012) still computes `result.type` for a playlist file - the `{name: "PLAYLIST", type: FILETYPE.playlist}` object literal and the detector branches that produce it are both still there, byte-for-byte - but nothing downstream of that computation was ever ported. Confirmed by reading the function directly rather than assuming from the detector's own continued presence.
- **The screen work this unlocks is more tractable than its own recorded "later spec" framing implied** - a hand count across the nine real files in `playlists/*.json` found six are ≥90% absolute-URL, real, fetchable entries (not the near-total `demomods/`-relative content spec 036 already declined to curate for the module list), narrowing what a future spec's own research pass will need to redo almost to nothing; recorded directly in this spec's own requirements.md Scope boundaries rather than left for that spec to rediscover from scratch.

## Known limits

The Bassoon "Playlists" and Hippo disk-op targets (the actual screen wiring) remain unallocated - see requirements.md's Scope boundaries; this is P9's own last remaining piece. No auto-play on load, matching v1's own real behavior. No browser verification occurred in this environment.
