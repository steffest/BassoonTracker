# 069 — Tasks

Status: done.

- [x] Re-read `script/src/ui/diskOperations.js`'s own `"playlists"`/`"hippo"` targets and `Editor.unpackUrl` (already read once for spec 068's own research); re-check `script/src/provider/hippo.js`'s own `get`/`loadFromApi` to confirm the real wire URL shape before writing any test against it.
- [x] Hand-count every real file in `playlists/*.json`, deciding curation per-file (confirmed by a one-off script, not by hand-counting alone).
- [x] `assets/data/playlists.json` + `assets/data/playlists/*.json` (new, 7 curated files).
- [x] `domain/providers/hippo.js`: JSDoc corrected (no behavior change).
- [x] `domain/diskOperations/index.js`: `loadPlaylistsRoot`; `rootFor`/`setDiskTarget`/`setBrowserRow` extended for two new targets.
- [x] `components/fileOperationsPanel.yaml`: two new radio items (Playlists, Hippo).
- [x] `build.mjs`: `data/playlists` added to the dist media-copy list; the copy filter's own directory-skip bug fixed (found immediately by running a real `dist` build, not anticipated).
- [x] `tests/diskOperations.test.js` (extended): 6 new tests; `resetHippo()` added to `beforeEach`.
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`: 12 warnings, unchanged.
- [x] `node build.mjs app`/`dist`: 103 loose ends, up from 101 (exactly the two new `inert-control` radio items); a real `dist` build succeeds against the new asset subdirectory.
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded - **package P9 is now closed**.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment). `tests/diskOperations.test.js`'s own established fake-fetch convention (spec 036) is reused directly for both new targets; `domain/providers/hippo.js#reset()` (built in spec 034, unused by any test until now) had to be wired into `beforeEach` once a second test in the same run started depending on `browse("playlists")`'s own faked response differing from an earlier test's - caught immediately by the resulting real fetch mismatch, not anticipated.

## Evidence

- `tests/diskOperations.test.js`: 14/14 passing (8 from spec 036 + 6 new) - `setDiskTarget(Playlists)` publishing rows from a faked snapshot fetch and tolerating a failed one; a Playlists leaf click fetching and setting a real playlist; `setDiskTarget(Hippo)` publishing rows from a faked API listing; a Hippo leaf click setting a playlist directly (the API's own already-parsed object, no fetch/parse step of this spec's own) and a failed one leaving the current playlist untouched.
- Full suite: `node --test tests/*.test.js` → 958/958 passing (952 before this spec + 6).
- `node compiler/generate.js`: 12 warnings, unchanged (both new radio items resolved as ordinary `radioItem`s, no new interpretation needed).
- `node build.mjs app`: 103 loose ends, up from 101 - both new, both `inert-control` entries for the "Playlists"/"Hippo" radio items themselves (the group's own `change` command, `disk-target.set`, was already real since spec 036). `node build.mjs dist` succeeds, copying all seven new curated playlist files alongside `playlists.json` itself.
- `node --check` passed on every new/touched source file and the touched test file before the suite ran.

## Found while doing it

- **A real, latent bug in `build.mjs`'s own dist media-copy loop**, exposed immediately (not anticipated) by the first real `dist` build against the new `assets/data/playlists/` subdirectory: `readdirSync(mediaDir)`'s own filter excluded dotfiles but never checked for a directory entry, so once `assets/data/` gained a subdirectory of its own, the loop tried `copyFileSync` on that directory and crashed with `ENOTSUP`. Fixed by skipping directory entries in the same filter - a defect nothing had ever triggered before this spec, not a regression it introduced.
- **`domain/providers/hippo.js#browse()`'s own JSDoc was already wrong**, confirmed while becoming its first real second-verb caller: `"playlist/<name>"` does not return the array shape `"playlists"` does; it returns a ready `{title, modules}` object (or `[]` on a failed fetch, a genuinely different failure shape from the success shape) - corrected without changing any behavior.
- **`domain/providers/hippo.js#browse("playlists")`'s own module-level memoization needed resetting between tests** - the identical class of harness gap several prior specs' own test files have each hit once for their own module-scoped cache (a fresh `reset()` export already existed, unused until this spec's own second test against the same target caught the staleness directly).
- **The scale of `playlists/*.json`'s own real content was large enough to require scripting the curation**, not hand-typing it (roughly 340 real entries across seven files, ten of them needing to be dropped) - confirmed by a direct count before writing any code, not estimated.

## Known limits

Auto-play on loading a saved playlist is not added (matches v1's own real behavior). "Demo Songs" and "My Favorites" remain excluded from the curated snapshot, both for real, recorded reasons (see requirements.md). No per-row navigate-back-to-main behavior was added, matching the existing three targets' own identical lack of it. No browser verification occurred in this environment.
