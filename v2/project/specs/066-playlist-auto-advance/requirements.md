# 066 — Playlist auto-advance on song end

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 065 (the Playlist domain model). Closes the gap spec 065 deliberately left open: "auto-advance on song end ... needs a new subscription hook out of `domain/playback/index.js` ... and has no UI trigger to reach it yet either."

## Purpose

Spec 065 made `play-list.random` real: it fetches a generated playlist and plays its first track. Without this spec, that is where it stops - the playlist never advances, even though the mechanism it needs (an already-ported, already-firing `EVENT.songEnd`) has existed in the engine since package P2. This spec is the small, real gap between "a playlist plays its first track" and "a playlist plays."

## What v1 actually does (read from source, not assumed)

- **`engine/tracker.js`** (330, 362-379, unchanged by this port) triggers `EVENT.songEnd` with one argument - `time - Audio.context.currentTime` (seconds remaining in the currently-scheduled buffer) - but only ever while `Tracker.autoPlay` is truthy. This gate already exists in the ported engine (confirmed by grep - the exact same two call sites); nothing in `domain/playback/` has ever set `autoPlay` or subscribed to the event, so it has been dead code from v2's own perspective since spec 012.
- **`script/src/models/playlist.js`**'s own `EVENT.songEnd` handler (249-258): `delay = (delay||0)*1000; if (playListActive) { setTimeout(() => { Tracker.stop(); Tracker.reset(); setTimeout(me.next, 100); }, delay); }` - waits out the buffer's own remaining tail before stopping (avoiding an audible cut), then a further 100ms settle before advancing.
- **`Tracker.autoPlay`/`playListActive` are both set, and never unset, by `Playlist.play`/`loadTrack(index, true)`** (called by `next`/`prev`/`play` and by `generatePlayList`) - a real, confirmed v1 quirk: once any playlist track has ever been played, both flags stay true for the rest of the session, even if the user later loads an unrelated module through a completely different path (File > Open, `openRandomSong`, drag-and-drop). If that unrelated module later ends, v1 really would call `Playlist.next()` against whatever playlist was last set. Confirmed by reading the whole file for any reset of either flag - there is none.

## Decisions and assumptions

- **`domain/playback/index.js` gains two small, additive exports**: `setAutoPlay(value)` (a thin `Tracker.autoPlay = Boolean(value)` forward) and `onSongEnd(handler)` (wraps the ported `EventBus.on(EVENT.songEnd, ...)`/`.off`, returning an unsubscribe function) - the same "only `domain/playback/index.js` may reach the engine" boundary every prior playback addition (`setTrackVolumes`, `getTrackScopeData`, `previewNoteOn`) already follows.
- **v1's own `Tracker.reset()` call between `stop()` and the next load is not ported.** Read `engine/tracker.js#reset` (2023-2025): it only calls `resetDefaultSettings()`, restoring tempo/speed/etc. to defaults - work the *next* track's own `loadModule`/`Tracker.processFile` call already redoes in full when it parses that module's own header. Calling it here would only reset state that gets immediately overwritten a moment later; not porting it changes no observable outcome.
- **v1's own sticky, never-reset `autoPlay`/`playListActive` quirk is ported faithfully, not fixed** - matching this roadmap's own bar (e.g. spec 065's identical call for the inert `indexOf(...) || 0` fallback): it is a real, if a little surprising, existing behavior, not a defect with a plausible reader depending on the "fixed" version instead.
- **The delay/stop/settle choreography is one new exported, directly-awaitable function** (`advanceOnSongEnd(app, delaySeconds)`) rather than an unexported closure, so a test can invoke it directly instead of needing to reach through a real `setTimeout`-scheduled `EVENT.songEnd` trigger end to end.
- **`domain/playlist/index.js` registers exactly one `onSongEnd` subscription, at module load**, mirroring v1's own single, permanent `EventBus.on(EVENT.songEnd, ...)` registration - not per-`playTrack`-call, which would accumulate duplicate subscriptions against the engine's own persistent `EventBus` singleton.

## User stories and acceptance

- **ADVANCE-001 — Playing a playlist track arms auto-advance.** `playTrack(app, index)` sets `Tracker.autoPlay` true (via `setAutoPlay`) and marks the playlist active, matching v1's own `Playlist.play`/`loadTrack(index, true)`.
- **ADVANCE-002 — A song-end event advances to the next playable track.** `advanceOnSongEnd(app, delaySeconds)` waits `delaySeconds` (real time, matching v1's own buffer-tail wait), stops playback, waits a further 100ms settle, then calls `nextTrack(app)` - landing on the same index `nextTrack` itself would (skipping a gap entry, wrapping at the end).
- **ADVANCE-003 — No playlist has ever been played: no-op.** Before any `playTrack` call, `advanceOnSongEnd` returns `false` immediately (no stop, no wait, no `nextTrack` call) - matching v1's own `if (playListActive)` guard.
- **ADVANCE-004 — No regressions.** Full unit suite passes; `node compiler/generate.js`/`node build.mjs app`/`dist` succeed with no new warnings or loose ends (no YAML/`capabilities.js` change - nothing here is a new authored command).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No YAML/compiler/`capabilities.js` change - this closes a gap inside an already-real capability (`play-list.random`), not a new one.

## Scope boundaries

In scope: `domain/playback/index.js`'s two new exports, `domain/playlist/index.js`'s `advanceOnSongEnd` + the `playTrack`/registration wiring, and tests for both.

Out of scope, recorded rather than silently dropped:

- **A way to turn `playListActive`/`autoPlay` back off** - v1 never has one either (see the confirmed quirk above); not invented here.
- **The Bassoon/Hippo disk-operations playlist listboxes, Dropbox as an export target, and a save/export screen** - unchanged from spec 065's own identical scope boundaries.
