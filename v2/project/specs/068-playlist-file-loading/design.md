# 068 — Design

## Overview

```
domain/playlist/index.js
  + parsePlaylistFile(text, name)   .json -> JSON.parse; else -> parsePlaylist
  + openPlaylistUrl(app, url)       fetch (via fetchModuleUrl) -> parse -> setPlaylist
```

## `domain/playlist/index.js` (additions)

```js
import { loadModule, onSongEnd, setAutoPlay, transportStop } from "../playback/index.js";
import { fetchGeneratedPlayList, fetchModuleUrl } from "../providers/index.js";

/**
 * Ported from script/src/tracker.js#processFile's own FILETYPE.playlist
 * branch (2248-2258) - the direct v2-native equivalent of the one thing
 * that branch does that domain/playback's own ported processFile (package
 * P2) still detects but never handles (see requirements.md).
 */
export function parsePlaylistFile(text, name) {
    if (String(name).toLowerCase().endsWith(".json")) return JSON.parse(text);
    return parsePlaylist(text, name);
}

/**
 * Fetches a playlist file (JSON/PLS/M3U) at `url` and sets it as the
 * current playlist. Reuses domain/providers#fetchModuleUrl - the same
 * proxy-retry-on-network-failure contract domain/playback#loadModule
 * already relies on for cross-origin module URLs.
 */
export async function openPlaylistUrl(app, url) {
    try {
        const response = await fetchModuleUrl(url);
        if (!response.ok) return false;
        const text = await response.text();
        const name = url.split("/").pop().split("?")[0] || "playlist";
        const data = parsePlaylistFile(text, name);
        if (!data || !Array.isArray(data.modules)) return false;
        setPlaylist(data);
        if (app && app.log) app.log("play-list.open", { name, count: data.modules.length });
        return true;
    } catch {
        return false;
    }
}
```

Placed alongside `parsePlaylist`/`setPlaylist` (both already defined earlier in the same file, spec 065) - no new imports beyond adding `fetchModuleUrl` to the existing `domain/providers` import line.

## Data models

None new - `openPlaylistUrl` produces exactly the `{title, modules}` shape `setPlaylist` already expects.

## Error handling

- **A non-OK response**: `false`, nothing set.
- **A rejected fetch** (network failure, including a failed proxy retry - `fetchModuleUrl`'s own contract): caught by the outer `try`/`catch`, `false`.
- **Malformed JSON** (`.json` name, unparsable text): `JSON.parse` throws, caught the same way, `false`.
- **Well-formed content with no `modules` array** (a `.pls`/`.m3u` file with nothing supported in it, or a `.json` file that parses but isn't playlist-shaped): the explicit `Array.isArray(data.modules)` check catches this without needing a try/catch, `false`, `setPlaylist` never called.

## Testing strategy

- **`tests/playlist.test.js`** (extended): `parsePlaylistFile` for `.json` (returns the parsed object unchanged) and for `.pls`/`.m3u` (matches `parsePlaylist`'s own existing, already-tested output exactly, confirmed by calling both and comparing). `openPlaylistUrl` against the same fake-fetch convention every other test in this file already uses: a real `.json` fetch sets the playlist; a non-OK response, a rejected fetch, malformed JSON, and JSON with no `modules` array each resolve to `false` without changing whatever was already current.
- `node --test tests/*.test.js` passes; `node compiler/generate.js`/`node build.mjs app`/`dist` unaffected (no YAML/`capabilities.js` touched).

## What this deliberately does not do

See requirements.md's Scope boundaries: no Bassoon "Playlists"/Hippo disk-op targets yet (the actual screen wiring - P9's own last remaining piece), no auto-play on load.
