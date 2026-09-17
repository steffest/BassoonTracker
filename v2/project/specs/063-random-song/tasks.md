# 063 — Tasks

- [x] `compiler/recipes.js`: add `random` to `verb-action`'s own verb list; confirmed empirically first.
- [x] `domain/randomSong/index.js` (new): `openRandomSong`, `openRandomSongXM`; README.
- [x] **Found and fixed a real architectural-boundary violation in the first draft**: `fetchRandomModuleUrl` was initially written directly in `domain/randomSong/index.js` (its own `BASE_URL`/`fetch`), which broke `tests/domainBoundary.test.js`'s own "only domain/providers/ may name a provider host" check. Moved into `domain/providers/bassoon.js` (re-exported from `domain/providers/index.js`, the same way `proxyUrl`/`isProxyUrl` already are); `domain/randomSong/index.js` only calls it. `tests/randomSong.test.js` added to that boundary test's own allowlist. Both READMEs (`domain/providers/`, `domain/randomSong/`) updated to match.
- [x] `capabilities.js`: `song.random`/`song-xm.random` mappings.
- [x] `tests/randomSong.test.js` (new, 6 tests); `tests/recipes.test.js` extended (+2).
- [x] Found and fixed two pre-existing test breaks from the real, expected count changes: `tests/compiler.test.js`'s own `unresolved-action-reference >= 10` threshold (now 7, since three resolved), `tests/domainBoundary.test.js`'s own allowlist.
- [x] `node --test tests/*.test.js` passes (901, up from 893).
- [x] `node compiler/generate.js`: 12 warnings (down from 15) - `randomSong`/`randomSongXM`/`randomPlayList` (a recorded, incidental side effect) all gone.
- [x] `node build.mjs app`: 88 loose ends (down from 90); `song.random`/`song-xm.random` are real commands; `play-list.random` (the incidental `randomPlayList` resolution) is a new, expected `mocked-command`.
- [x] Update `v2/project/progress.md`, `010-port-roadmap/tasks.md`, `specs/index.md`.
