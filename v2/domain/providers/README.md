# Providers capability

Remote catalog browsing and the CORS proxy fallback. Spec [034](../../project/specs/034-remote-providers/requirements.md), continuing package **P9** (persistence, providers, file operations) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md), following spec 033 (settings and favorites).

```
modArchive.js       browse() - ModArchive.org catalog
modulesPl.js         browse() - modules.pl catalog
hippo.js             browse() - HippoPlayer.se playlists
bassoon.js           the v2 API's own proxyUrl/isProxyUrl/fetchRandomModuleUrl
formatFileSize.js    a shared display-size helper the two mod catalogs use
index.js             fetchModuleUrl(), and re-exports of bassoon.js's own three functions
```

## No shared interface

v1 never built one across its five providers, and this folder does not invent one either - forcing symmetry the source code does not have would be exactly the kind of ahead-of-need abstraction this project's own conventions avoid. `modArchive.js`, `modulesPl.js` and `hippo.js` each export a `browse(path)` (a slash-delimited pseudo-path in, a promise of tree items out) because that really is one shape all three share; `bassoon.js` shares nothing with them (it is a pure proxy-URL string pair) and is not forced into the same export shape.

## The boundary

Every module here may be imported directly - there is no single `index.js` facade, because there is nothing to put behind one (see above). `index.js` re-exports the handful of functions reached from outside this folder: `fetchModuleUrl` (`domain/playback/index.js#loadModule`'s own import, a documented cross-domain import, the same shape `domain/settings/`'s two exceptions with `domain/playback/` already use - see that folder's own README) and, since spec 063, `proxyUrl`/`isProxyUrl`/`fetchRandomModuleUrl` (`domain/randomSong/index.js`'s own import - enforced by `tests/domainBoundary.test.js`: only this folder may name a remote-catalog host directly, so `domain/randomSong/` reaches the random-song endpoint only through `bassoon.js#fetchRandomModuleUrl`, never by fetching the host itself).

## Provenance

Ported from `script/src/provider/{modarchive,modulespl,hippo,bassoon}.js` and `script/src/lib/util.js#formatFileSize`. Callback-shaped (`get(url, next)`) become promise-shaped (`browse(path)`); `FetchService`/`XMLHttpRequest` become plain `fetch()`, matching `domain/playback/index.js#loadModule`'s own existing convention - v2 has never ported `fetchService.js` and nothing here needs it.

## A real v1 bug, fixed rather than preserved

`hippo.js#loadPlaylists`'s own v1 equivalent has no `if (result)` guard before `result.forEach(...)` - a network failure there throws, uncaught, inside a `FetchService.json` success/error split that never reaches that line on error to begin with, so the crash is real but only on a slow/broken connection. Guarded here (`(result || [])`) as a one-line, obviously-correct fix - not a preserved quirk, since nothing about the crash was ever an intended or observable behavior worth matching (contrast `domain/playback/README.md`'s own 8-bit sample clipping, which stays because it is audible).

## What this deliberately does not do

- **Dropbox** (`script/src/provider/dropbox.js`, `script/src/lib/dropbox.js`) - permanently out of scope, per the user's own direction (2026-09-15); see the port roadmap's own open decision 9. Its OAuth redirect URI is hardcoded to the original author's own domain (`https://www.stef.be/bassoontracker/auth/dropbox.html`), which was already a hosting/product decision, not a porting detail - not a "later spec" any more, but never.
- **Bassoon's render/export pipeline** (`renderFile`, the `storage/render`→`storage/convert`→`storage/wavtomp3` chain) - the whole-song MP3/WAV render behind v1's own module-save "wav"/"mp3" options (found and correctly scoped out by spec 067). Permanently out of scope alongside Dropbox above; see the port roadmap's own open decision 8. Only `proxyUrl`/`isProxyUrl`/`fetchRandomModuleUrl`/`fetchGeneratedPlayList` are here.
- **The disk-operation screens' own Bassoon/Hippo playlist listboxes, the static root-listing snapshots** - see requirements.md's Scope boundaries. `randomSong`/`randomSongXM`/`randomPlayList` are all wired (specs 063/065: `domain/randomSong/` and `domain/playlist/`, two sibling folders, call `fetchRandomModuleUrl`/`fetchGeneratedPlayList` here); browsing/loading a *saved* playlist from Bassoon's `playlists/main.json` or HippoPlayer's own `playlist/`-prefixed endpoint remains P9's own last unallocated piece.

## Headless use

```js
import { browse } from "./modArchive.js";
const items = await browse("genre/12"); // -> tree items, or [] for an unrecognized verb
```

```js
import { fetchModuleUrl } from "./index.js";
const response = await fetchModuleUrl("https://example.com/song.mod"); // retries via proxy on a network-level failure only
```

```js
import { fetchRandomModuleUrl } from "./index.js";
const url = await fetchRandomModuleUrl(); // or fetchRandomModuleUrl("xm") - null on any failure/malformed envelope
```
