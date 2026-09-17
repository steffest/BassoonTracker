# Random song capability

The File menu's "Open Random MOD Song"/"Open Random XM Song" commands. Spec [063](../../project/specs/063-random-song/requirements.md), continuing package **P9** (persistence, providers, file operations) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md), following spec 038 (XM export).

```
index.js   openRandomSong(app), openRandomSongXM(app)
```

## What this does

Fetches a random module URL from this repo's own `api/` server (`https://www.stef.be/bassoontracker/api/random`/`randomxm` - kept as-is, the roadmap's own resolved open decision 4) and hands it to `domain/playback/index.js#loadModule`, exactly the same two-step shape a disk-operations screen leaf click already has (`domain/diskOperations/index.js`).

## Why its own folder

Not `domain/diskOperations/` - that module is scoped to the disk-operations screen specifically, and this is a separate File-menu entry point with no tree/row state of its own.

The API fetch itself is *not* here, though - it lives in `domain/providers/bassoon.js#fetchRandomModuleUrl` (re-exported from `domain/providers/index.js`), since only `domain/providers/` may name a remote-catalog host directly (`tests/domainBoundary.test.js`'s own enforced boundary, the same rule `domain/diskOperations/` already follows for ModArchive/modules.pl). This module only ever calls that function and then `domain/playback/index.js#loadModule` - the "load it into the tracker" half, the same role `domain/diskOperations/index.js` already plays for its own screen.

## Graceful degradation

Matches v1's own `console.error`-only fallback (`script/src/ui/diskOperations.js#playRandomSong`): a network failure, a non-OK response, a malformed envelope, or `loadModule` itself throwing (a bad HTTP status loading the returned module URL) all resolve to `false` - nothing loads, nothing crashes, no rejection reaches the action dispatcher.

## What this deliberately does not do

- **`Tracker.autoPlay`** - despite its name, this ported engine flag does not start playback; it only gates `EVENT.songEnd`/endless-loop detection during an *already-playing* song, relevant to playlist auto-advance. With no playlist model in this port yet, setting it here would do nothing observable.
- **A status-bar "Fetching random song" message** - cosmetic, no v2 equivalent exists to hook into.
- **`randomPlayList`/`generatePlayList`, a `Playlist` domain model** (`script/src/models/playlist.js`) - a real, separate, moderately-sized follow-up; see requirements.md's Scope boundaries.
- **HippoPlayer as a disk-operations screen target** - its own catalog is playlist-shaped, so it depends on the same `Playlist` model above.
