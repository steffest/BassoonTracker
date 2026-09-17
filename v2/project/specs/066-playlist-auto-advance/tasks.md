# 066 — Tasks

Status: done.

- [x] Re-read `script/src/models/playlist.js`'s own `EVENT.songEnd` handler and `engine/tracker.js`'s two `EVENT.songEnd` trigger sites before designing.
- [x] `domain/playback/index.js`: `setAutoPlay(value)`, `onSongEnd(handler)`.
- [x] `domain/playlist/index.js`: `playListActive`/`lastApp` state; `playTrack` arms both; `advanceOnSongEnd(app, delaySeconds)`; registered once via `onSongEnd` at module load.
- [x] `tests/playlist.test.js` (extended): 3 new tests, including one placed first in the file specifically to catch the pristine, never-armed state before any other test's `playTrack` call makes it permanently true.
- [x] `node --test tests/*.test.js` passes.
- [x] `node compiler/generate.js`/`node build.mjs app`/`dist`: unaffected (no YAML/compiler/capabilities.js touched).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only. `advanceOnSongEnd` is exported specifically so a test can invoke the whole delay/stop/settle/advance chain directly, awaiting it, rather than needing to trigger a real `EVENT.songEnd` end to end through the ported engine's own scheduler. One real ordering constraint, called out at its own point in the test file: `playListActive` is a real, faithfully-ported v1 quirk (armed once, never disarmed) - the "never armed" case can only be exercised as the very first test in the file, before any other test's own `playTrack` call makes it permanently true for the rest of that file's run.

## Evidence

- `tests/playlist.test.js`: 24/24 passing (21 from spec 065 + 3 new) - `advanceOnSongEnd` no-ops before any track has ever been played (placed first in the file, on purpose); `playTrack` arms auto-advance (confirmed indirectly, since there is no direct getter, matching v1's own write-only flags); `advanceOnSongEnd` stops, waits out both the given delay and the fixed 100ms settle (asserted with a loose elapsed-time lower bound, not a brittle exact one), and lands on the correct next playable track (reusing spec 065's own three-track/gap-entry fixture, so the skip-one-further-step behavior is exercised through this path too).
- Full suite: `node --test tests/*.test.js` → 932/932 passing (929 before this spec + 3).
- `node compiler/generate.js`: 12 warnings, unchanged. `node build.mjs app`: 87 loose ends, unchanged (no YAML/compiler/capabilities.js touched - this spec only extends two already-real capabilities). `node build.mjs dist` succeeds.
- `node --check` passed on both touched source files and the touched test file before the suite ran.

## Found while doing it

- **`Tracker.autoPlay`/`playListActive` really are permanent once set** - confirmed by reading the whole of `playlist.js` for any reset of either flag; there is none. This directly shaped the test file's own structure (see Verification plan above) rather than being a surprise caught mid-write.
- **v1's own `Tracker.reset()` call between stop and the next load does nothing a fresh `loadModule` wouldn't already redo** - confirmed by reading `engine/tracker.js#reset` (2023-2025: only `resetDefaultSettings()`) before deciding not to port it, not assumed from the name alone.

## Known limits

No way to turn `playListActive`/`autoPlay` back off (matching v1's own sticky quirk, not a gap introduced here). The Bassoon/Hippo disk-operations playlist listboxes, Dropbox as an export target, and a save/export screen remain unallocated - see requirements.md. Nothing here is reachable from any UI beyond the File menu's own "Open Random Playlist" item, which now plays through more than one track when the generated list has more than one. No browser verification occurred in this environment.
