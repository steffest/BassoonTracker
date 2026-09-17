# 063 — Design

## Overview

```
domain/providers/bassoon.js
  + fetchRandomModuleUrl(format) -> the envelope's own url, or null
    (lives here, not domain/randomSong/ - only domain/providers/ may name a
    remote-catalog host directly, tests/domainBoundary.test.js's own
    boundary check, found the hard way: the first draft put BASE_URL/fetch
    directly in domain/randomSong/index.js and broke that test)
domain/providers/index.js
  + re-exports fetchRandomModuleUrl, the same way proxyUrl/isProxyUrl already are

domain/randomSong/index.js (new)
  openRandomSong(app)   -> fetchRandomModuleUrl() + loadModule
  openRandomSongXM(app) -> fetchRandomModuleUrl("xm") + loadModule

compiler/recipes.js
  verb-action verb list: + "random"  ("random song" -> song.random, "random song xm" -> song-xm.random)

capabilities.js
  "song.random": { module: "./domain/randomSong/index.js", export: "openRandomSong" }
  "song-xm.random": { module: "./domain/randomSong/index.js", export: "openRandomSongXM" }
```

No YAML change - `app.yaml`'s own "Open Random MOD Song"/"Open Random XM Song" menu items (`click: randomSong`/`randomSongXM`) already exist and are unchanged; only their own derived command resolves differently now.

## `domain/providers/bassoon.js` / `domain/randomSong/index.js`

```js
// domain/providers/bassoon.js - the only file allowed to name this host directly
export async function fetchRandomModuleUrl(format) {
    try {
        const response = await fetch(BASE_URL + "random" + (format || ""));
        if (!response.ok) return null;
        const data = await response.json();
        return (data && data.modarchive && data.modarchive.module && data.modarchive.module.url) || null;
    } catch {
        return null;
    }
}
```

```js
// domain/randomSong/index.js
import { loadModule } from "../playback/index.js";
import { fetchRandomModuleUrl } from "../providers/index.js";

export async function openRandomSong(app) {
    const url = await fetchRandomModuleUrl();
    if (!url) return false;
    try {
        await loadModule(app, url);
        return true;
    } catch {
        return false;
    }
}

export async function openRandomSongXM(app) {
    const url = await fetchRandomModuleUrl("xm");
    if (!url) return false;
    try {
        await loadModule(app, url);
        return true;
    } catch {
        return false;
    }
}
```

Plain `fetch()`, not `fetchModuleUrl`'s proxy-retry wrapper, for the API call itself - that wrapper is for an arbitrary third-party module-file host, not this repo's own CORS-enabled `bassoontracker/api/` (the same distinction `domain/providers/modArchive.js#browse()` already makes for its own API calls). `loadModule` already retries *its own* fetch (the returned module URL) through the proxy on a network failure - nothing new needed there.

A first draft put `BASE_URL` and the `fetch()` call directly in `domain/randomSong/index.js` - `node --test tests/domainBoundary.test.js` immediately failed "only domain/providers/ may name a provider host" (spec 034's own architectural boundary, enforced by a source-scanning test, not just a convention). Fixed by moving `fetchRandomModuleUrl` into `domain/providers/bassoon.js` itself (re-exported from `domain/providers/index.js`, the same way `proxyUrl`/`isProxyUrl` already are) - `domain/randomSong/index.js` only ever calls it, never names the host itself. `tests/randomSong.test.js` was added to that test's own allowlist (it legitimately needs the literal host string as a fake-fetch map key, the same reason `tests/diskOperations.test.js` already is).

## `compiler/recipes.js`

One word added to the existing `verb-action` pattern's verb alternation:

```js
pattern: /^(clear|copy|paste|insert|delete|increment|decrement|save|normalize|trim|reverse|invert|fade in|fade out|open|cancel|show|start|add|remove|random)\s+(?:the\s+)?([a-z][a-z0-9 ]*)$/i,
```

Confirmed empirically before authoring anything else:

```
"random song"    -> verb "random", subject "song"    -> command "song.random"
"random song xm" -> verb "random", subject "song xm" -> command "song-xm.random"
```

## Testing strategy

`tests/randomSong.test.js` (new), mirroring `tests/diskOperations.test.js`'s own fake-`fetch`/fake-`app` convention:

- RANDOM-001: a well-formed `{modarchive: {module: {url}}}` envelope from `.../api/random`, then a real fixture buffer from the envelope's own URL - `loadModule` reports the real loaded title.
- RANDOM-002: `openRandomSongXM` requests `.../api/randomxm`, asserted by which fake-fetch key was actually hit (a request to the non-XM URL would throw "unexpected fetch", the same convention `diskOperations.test.js` already relies on for exact-URL assertions).
- RANDOM-003, three sub-cases: a malformed envelope (`{}`, or `{modarchive: {}}`), a rejected `fetch` (throws), and a well-formed envelope whose module URL itself 404s (`loadModule` throws) - all three resolve to `false`, nothing loaded (`Tracker.getSong()` still whatever it was before, or the engine's own `loadedUrl` unchanged).
- `compiler/recipes.test.js` extended: the two new prose strings resolve as `verb-action`, `song.random`/`song-xm.random`.

`node --test tests/*.test.js` passes. `node compiler/generate.js`: `randomSong`/`randomSongXM`'s own `unresolved-action-reference` warnings gone (diffed - `pattern2Sample` is the one remaining, unrelated). `node build.mjs app`: the two commands leave the mocked-command list; loose ends drop by exactly two (confirmed by reading `LOOSE-ENDS.md` back, not assumed).
