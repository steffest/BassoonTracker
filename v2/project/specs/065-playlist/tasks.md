# 065 — Tasks

Status: done.

- [x] Read `script/src/models/playlist.js` in full and re-read `script/src/ui/diskOperations.js#generatePlayList` before designing.
- [x] `domain/providers/bassoon.js`/`index.js`: `fetchGeneratedPlayList()`.
- [x] `domain/playlist/index.js` (new): state, `setPlaylist`/`getPlaylist`/`getCurrentIndex`/`isShuffleEnabled`/`toggleShuffle`, `parsePlaylist`, `writePlaylist`, `getPlaylistFileName`, `playTrack`/`nextTrack`/`previousTrack`, `exportPlaylist`, `openGeneratedPlaylist`.
- [x] `capabilities.js`: `play-list.random` mapped to `openGeneratedPlaylist`.
- [x] `tests/domainBoundary.test.js`: widened `sourceFiles()`'s walk to `"domain"`; added `codeLines()` comment-stripping to all four content-scanning checks; `tests/playlist.test.js` added to `PROVIDER_TEST_FILES`.
- [x] `tests/playlist.test.js` (new).
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`: 12 warnings, unchanged.
- [x] `node build.mjs app`/`dist`: `play-list.random` no longer a mock; 87 loose ends, down from 88.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no UI exists yet to reach `exportPlaylist`; `play-list.random` is reachable only through the File menu's own already-authored, now-real command - matching spec 063's own precedent for `song.random`/`song-xm.random`). `tests/playlist.test.js` mirrors `tests/randomSong.test.js`'s own fake-fetch/fake-app convention for navigation and `openGeneratedPlaylist`, and `tests/moduleExport.test.js`'s/`tests/sampleExport.test.js`'s own DOM-stub convention for `exportPlaylist`.

## Evidence

- `tests/playlist.test.js`: 21/21 passing - set/get, PLS/M3U parse (including an unsupported-extension entry skipped), PLS/M3U/JSON export each round-tripped back through parse or `JSON.parse`, `playTrack`/`nextTrack`/`previousTrack` against a real fixture URL with a no-`url` gap entry exercising the skip-one-further-step branch (both directions, plus wrapping), a failed module load resolving to `false` rather than throwing, `toggleShuffle`, `openGeneratedPlaylist`'s four cases (success, malformed, non-OK, rejected fetch), and `exportPlaylist`'s three formats plus its no-playlist no-op.
- `tests/domainBoundary.test.js`: all 5 checks still pass with the widened walk; instrumenting the walk directly (before editing the real file) confirmed the previously-narrow directory list left every domain folder since spec 033 unscanned, and confirmed the comment-stripping fix removes exactly the resulting false positives (`localStorage`/`modarchive.org` mentioned in prose in `domain/nibbles/`, `domain/settings/` and `domain/playback/engine/fileformats/detect.js`) with zero real offenders left over.
- Full suite: `node --test tests/*.test.js` → 929/929 passing (908 before this spec + 21).
- `node compiler/generate.js`: 12 warnings, unchanged (no YAML touched).
- `node build.mjs app`: 87 loose ends, down from 88 (`play-list.random` is now a real command, not `mocked-command`). `node build.mjs dist` succeeds.
- `node --check` passed on every new/touched source and test file before the suite ran.

## Found while doing it

- **A real, pre-existing test-infrastructure gap**, not introduced by this spec: `tests/domainBoundary.test.js#sourceFiles()` named `"domain/song"`/`"domain/moduleExport"` individually instead of `"domain"` as a whole, so every domain folder added since spec 033 (`settings`, `providers`, `randomSong`, `sampleEditor`, `nibbles`, `arrangement`, `diskOperations`) was silently never scanned by any of that file's four checks. Confirmed by instrumenting the walk directly rather than assumed from reading the code alone. Fixed by widening the walk and stripping comments before each content check (see requirements.md's own Decisions section for the full finding and why comment-stripping, not a narrower walk, was the right fix).
- **v1's own M3U reader never actually round-trips a track's title** - `me.parse`'s `m3u` branch derives every entry's title from the URL's own last path segment unconditionally, ignoring the `#EXTINF:-1,<title>` line `generateM3U` itself writes one line above each URL. Not a bug (confirmed by reading the whole `m3u` branch - there is no code path that ever reads an `#EXTINF` line's own title at all, in either v1 or this port), just a real asymmetry between M3U's write and read sides worth recording rather than silently working around in the test; `tests/playlist.test.js`'s own M3U round-trip test asserts the real, title-from-url behavior rather than a wrongly-assumed title-preserving one (a mistake caught by the test's own first run, not predicted).
- **`moveIndex`'s own `indexOf(...) || 0` fallback is inert** (see requirements.md) - confirmed, not fixed, since `playOrder` always holds every index whenever a playlist is set, so the "not found" branch this was meant to guard against can never actually occur.

## Known limits

No auto-advance on song end, no disk-operations playlist listboxes (Bassoon/Hippo), no Dropbox target, no `getSongInfoUrl`, no save/export screen, no browser-URL query-string sync - see requirements.md's Scope boundaries. Nothing here is reachable from any UI yet beyond the File menu's own "Open Random Playlist" item. No browser verification occurred in this environment.
