# 066 — Design

## Overview

```
domain/playback/index.js
  + setAutoPlay(value)      Tracker.autoPlay = Boolean(value)
  + onSongEnd(handler)      EventBus.on(EVENT.songEnd, handler) -> unsubscribe

domain/playlist/index.js
  + playListActive, lastApp (module state)
  playTrack(app, index)     now also arms autoPlay/playListActive, remembers app
  + advanceOnSongEnd(app, delaySeconds)   the EVENT.songEnd handler's own body
  registers advanceOnSongEnd via onSongEnd once, at module load
```

## `domain/playback/index.js` (additions)

```js
export function setAutoPlay(value) {
    Tracker.autoPlay = Boolean(value);
}

export function onSongEnd(handler) {
    const index = EventBus.on(EVENT.songEnd, handler);
    return () => EventBus.off(EVENT.songEnd, index);
}
```

Placed alongside `transportStop` (both are thin, additive forwards onto the ported engine, the same shape `setTrackVolumes`/`getTrackScopeData` already use). `EventBus`/`EVENT` are already imported at this file's own top (spec 012); nothing new to import.

## `domain/playlist/index.js`

```js
import { loadModule, onSongEnd, setAutoPlay, transportStop } from "../playback/index.js";

let playListActive = false;
let lastApp = null;

export async function playTrack(app, index) {
    if (!currentPlaylist || !currentPlaylist.modules) return false;
    const item = currentPlaylist.modules[index];
    if (!item || !item.url) return false;
    setAutoPlay(true);
    playListActive = true;
    lastApp = app;
    currentIndex = index;
    try {
        await loadModule(app, item.url);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ported from playlist.js's own EVENT.songEnd handler (249-258): waits for
 * the current buffer's own remaining tail before stopping, then a further
 * 100ms settle before advancing - avoids an audible cut from stopping and
 * loading a new module while the old one is still rendering its last
 * buffer. v1's own extra Tracker.reset() between stop and the next load is
 * not ported (see requirements.md - the next loadModule already redoes
 * everything it would touch).
 */
export async function advanceOnSongEnd(app, delaySeconds) {
    if (!playListActive) return false;
    await sleep((delaySeconds || 0) * 1000);
    await transportStop(app);
    await sleep(100);
    return nextTrack(app);
}

onSongEnd(delay => advanceOnSongEnd(lastApp, delay));
```

`nextTrack`/`moveIndex` are unchanged from spec 065. The module-level `onSongEnd(...)` call registers exactly once, at import time, mirroring v1's own single permanent registration; `lastApp` is read fresh each time the handler fires, so it always reflects whichever `app` the most recent `playTrack` call was given.

## Data models

None new.

## Error handling

- **`advanceOnSongEnd` before any track has ever been played** (`playListActive` still `false`): returns `false` immediately, no `transportStop`/`nextTrack` call - matches v1's own `if (playListActive)` guard exactly.
- **`nextTrack` itself failing** (e.g. every remaining entry has no `url`, or the next module 404s): already handled by spec 065's own `playTrack`/`moveIndex` guards; `advanceOnSongEnd` simply returns whatever `nextTrack` returns.

## Testing strategy

- **`tests/playlist.test.js`** (extended): `advanceOnSongEnd` returns `false` and does nothing before any track has been played; after a real `playTrack` call, `advanceOnSongEnd(app, 0)` stops playback and lands on the next playable track (reusing the existing three-track/gap-entry fixture from spec 065's own navigation tests, so the skip-one-further-step behavior is exercised through this path too); the delay is honored as real elapsed time (a small, bounded assertion - e.g. `Date.now()` before/after with a loose lower-bound check - not a brittle exact-timing one).
- `node --test tests/*.test.js` passes; `node compiler/generate.js`/`node build.mjs app`/`dist` unaffected (no YAML/`capabilities.js` change).

## What this deliberately does not do

See requirements.md's Scope boundaries: no way to turn `playListActive`/`autoPlay` back off (matching v1's own sticky quirk), no disk-operations playlist listboxes, no Dropbox target, no save/export screen.
