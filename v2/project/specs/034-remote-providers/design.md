# 034 — Design

## Overview

Four independent pieces, none touching `domain/playback/engine/`:

1. **Three catalog browsers** (`domain/providers/{modArchive,modulesPl,hippo}.js`), each a faithful, `fetch()`-based port of its v1 module's `get(url, next)` dispatch, promise-shaped instead of callback-shaped.
2. **The proxy pair** (`domain/providers/bassoon.js`): `proxyUrl`/`isProxyUrl`, ported verbatim (pure string functions).
3. **The retry wrapper** (`domain/providers/index.js`): `fetchModuleUrl(url)`, composing (2) with `fetch()` to reproduce v1's exact retry condition.
4. **One call-site change** in `domain/playback/index.js#loadModule`, swapping its own `fetch(target)` for `fetchModuleUrl(target)`.

## Getting the retry condition exactly right

v1's two failure paths are not the same thing, and conflating them would silently change behavior:

- `filesystem.js#loadFile`'s `req.onerror` (`filesystem.js:26-36`) fires for a **network-level** failure - CORS rejection, DNS failure, mixed content blocked before any response exists. This is the *only* path that retries through the proxy, and only once (`if (!BassoonProvider.isProxyUrl(url))`).
- `req.onload`'s own `req.status === 200` check (`filesystem.js:15-24`) is a **separate**, non-retried path: a real HTTP response with a bad status (404, 500) logs an error and resolves with `false`. No proxy retry.

`fetch()` maps these onto two different outcomes: a network-level failure **rejects** the promise (`TypeError: Failed to fetch`, no `Response` object at all - the same class of failure `onerror` reports); an HTTP-level failure (404/500) **resolves** with `response.ok === false`. So the retry belongs strictly around the `try`, not around the existing `if (!response.ok)` check - which is exactly what design.md's own `fetchModuleUrl` below does, and why `loadModule`'s existing `if (!response.ok) throw ...` line is untouched.

```js
export async function fetchModuleUrl(target) {
    try {
        return await fetch(target);
    } catch (networkError) {
        if (isProxyUrl(target)) throw networkError; // already proxied - v1's own cutoff
        return fetch(proxyUrl(target));
    }
}
```

A proxied retry that itself rejects propagates as-is (nothing here catches it a second time) - matching v1, where a proxied URL's own `onerror` has nowhere left to fall back to either.

## Architecture

```
domain/providers/bassoon.js (new, pure)
  proxyUrl(url) / isProxyUrl(url)
        ^
        | used by
        |
domain/providers/index.js (new)
  fetchModuleUrl(url) -> Promise<Response>
        ^
        | imported directly (documented cross-domain import,
        | the same shape spec 033 used twice)
        |
domain/playback/index.js#loadModule (extended: one line)
  const response = await fetchModuleUrl(target);   // was: await fetch(target)

domain/providers/modArchive.js (new)     \
domain/providers/modulesPl.js (new)       |  each: browse(path) -> Promise<TreeItem[]>
domain/providers/hippo.js (new)          /   no shared base - see requirements.md's
                                              "no interface where v1 has none"
```

## Components and interfaces

### `domain/providers/bassoon.js`

```js
const BASE_URL = "https://www.stef.be/bassoontracker/api/";

export function proxyUrl(url) {
    return BASE_URL + "proxy?" + encodeURIComponent(url);
}

export function isProxyUrl(url) {
    return typeof url === "string" && url.indexOf(BASE_URL + "proxy?") === 0;
}
```

Verbatim port of `bassoon.js:11,84-90`. Nothing else from that file is here - see requirements.md's Scope boundaries.

### `domain/providers/index.js`

```js
import { proxyUrl, isProxyUrl } from "./bassoon.js";
export { proxyUrl, isProxyUrl };

export async function fetchModuleUrl(target) {
    try {
        return await fetch(target);
    } catch (networkError) {
        if (isProxyUrl(target)) throw networkError;
        return fetch(proxyUrl(target));
    }
}
```

### `domain/providers/modArchive.js`

A `path` argument, not v1's own combined "one string, split internally" shape - `browse("genre/12/3")` still works (split happens inside, unchanged from v1), kept as a single string parameter (not `(verb, param, page)`) because that is the exact shape every call site already has (a tree item's own `url` field) and splitting it at the call site would just move the `.split("/")` one file over for no benefit.

```js
const API_BASE = "https://www.stef.be/bassoontracker/api/ma/";
const API_V1_BASE = "https://www.stef.be/bassoontracker/api/";

let genres = null;   // memoized, like v1's own module-level array
let artists = null;

export async function browse(path) {
    const [verb, param, page] = (path || "").split("/");
    switch (verb) {
        case "genres": return loadGenres();
        case "artists": return loadArtists();
        case "genre": return loadFromApi(`genre/${param}`).then(parseModList);
        case "artist": return loadFromApi(`artist/${param}${page ? `/${page}` : ""}`).then(data => parseModList(data));
        case "toprating": return loadFromApiV1(`toprating/${param || 1}`).then(data => parseModListV1(data, [verb, param, page]));
        case "topreview": return loadFromApiV1(`topreview/${param || 1}`).then(data => parseModListV1(data, [verb, param, page]));
        default: return [];
    }
}

async function loadGenres() {
    if (genres) return genres;
    const result = await loadFromApi("genres");
    const children = {};
    (result || []).forEach(genre => {
        if (genre.parent) {
            (children[genre.parent] ||= []).push({ title: genre.name, count: genre.count, info: `${genre.count} >`, children: [], url: `genre/${genre.id}` });
        }
    });
    genres = (result || []).filter(genre => !genre.parent).map(genre => {
        const items = children[genre.id] || [];
        const total = items.reduce((sum, child) => sum + child.count, 0);
        return { title: genre.name, children: items, info: `${total} >` };
    });
    return genres;
}
// loadArtists mirrors loadGenres, one level (modarchive.js:91-105) - no parent/child nesting.

async function loadFromApi(path) {
    const response = await fetch(API_BASE + path);
    return response.ok ? response.json() : undefined;
}

async function loadFromApiV1(path) {
    const response = await fetch(API_V1_BASE + path);
    const data = response.ok ? await response.json() : undefined;
    return data && data.modarchive ? data.modarchive : data;
}

function parseModList(data) {
    return (data || []).map(mod => ({
        title: mod.title || "---",
        url: `https://api.modarchive.org/downloads.php?moduleid=${mod.id}`,
        icon: mod.format,
        info: formatFileSize(mod.size)
    }));
}

function parseModListV1(data, base) {
    // ported unchanged from modarchive.js:136-175 - single-vs-array module
    // result, the "... load more ..." sentinel keyed off totalpages, and the
    // profile/page-number reconstruction for artist/genre vs top* bases.
}
```

`formatFileSize` - already ported? **No** (checked: `script/src/lib/util.js` has a same-named helper, but `v2/script/src/lib/util.js` is the *original* v1 file the repo's `script/` tree still runs from directly, not a v2-owned copy - `v2/domain/` has never imported from `script/` anywhere). `domain/providers/formatFileSize.js` is a small, new, pure one-function module (kept separate from `modArchive.js`/`modulesPl.js`, which both need it) rather than duplicated twice or reached from `script/src/lib/util.js` (a coupling nothing else in `v2/` has to the legacy tree).

### `domain/providers/modulesPl.js`

Same shape as `modArchive.js`, faithfully divergent where v1 itself is: no API-v1 envelope (modules.pl has only one API base), a `proxyUrl` constant of its own (`https://www.stef.be/bassoontracker/api/modules.pl/`, unrelated to `bassoon.js`'s proxy - modules.pl's module URLs are pre-prefixed with *this* provider's own proxy at parse time, exactly as `modulespl.js:113` already does), and `rate`/`score` extra-info label prefixing for `toprating`/`topscore` (`modulespl.js:104-117`).

### `domain/providers/hippo.js`

```js
const API_BASE = "https://www.stef.be/bassoontracker/api/hippo/";
let playlists = null;

export async function browse(path) {
    const [verb, param] = (path || "").split("/");
    switch (verb) {
        case "playlists": return loadPlaylists();
        case "playlist": return loadFromApi(param || "");
        default: return [];
    }
}

async function loadPlaylists() {
    if (playlists) return playlists;
    const result = await loadFromApi("");
    playlists = (result || []).map(item => ({
        title: item.replace(".prg", "").replace(/_/g, " "),
        url: item,
        icon: "playlist"
    }));
    return playlists;
}

async function loadFromApi(path) {
    const response = await fetch(API_BASE + path);
    return response.ok ? response.json() : [];
}
```

## Data models

A tree item: `{title: string, url?: string, children?: TreeItem[], info?: string, icon?: string}` - v1's own shape (`diskOperations.js:278-295` reads exactly this), unchanged. `children: []` (present, empty) marks an expandable-but-unloaded node; `children` absent marks a leaf. Not enforced by a schema here - the disk-operation screen that eventually renders this tree is a later spec's concern.

## Error handling

- **A provider's own HTTP failure** (`loadFromApi`/`loadFromApiV1` sees `!response.ok`): resolves to `undefined` (ModArchive/modules.pl - matching `FetchService.json`'s own `error` callback, which passes nothing) or `[]` (Hippo). Every caller in this folder guards with `(result || [])` before iterating, including `hippo.js#loadPlaylists`, which v1's own equivalent does *not* do (`hippo.js`'s `result.forEach` has no `if (result)` guard at all - a real, latent v1 crash-on-network-failure bug, not a deliberate behavior). Guarding it here is a one-line, obviously-correct fix, the same shape spec 028's own "insertNote/removeNote gained undo v1 itself never registered" - not a parity gap, since nothing about v1's crash was ever an intended or observable behavior worth preserving (unlike, say, the 8-bit sample clipping spec 012 deliberately left alone because it is audible).
- **A network-level failure reaches `browse()` itself** (not `fetchModuleUrl`'s own retry - these three providers have no proxy fallback in v1 either, confirmed: nothing in `modarchive.js`/`modulespl.js`/`hippo.js` calls `BassoonProvider.proxyUrl`): the rejected promise propagates to the caller. No retry here - v1's own proxy retry is `filesystem.js#loadFile`'s alone, for a *module URL*, not a catalog-listing API call.
- **`fetchModuleUrl`'s retry, already covered above.**

## Testing strategy

- **`tests/providers.test.js`** (new): a fake global `fetch` (swapped in per test, restored after) drives all three `browse()` functions through PROV-001/002/003's acceptance list; `formatFileSize.js` gets its own tiny case set (byte/kb/mb boundaries, matching `script/src/lib/util.js`'s own rounding).
- **`tests/playback.test.js`** (extended): `fetchModuleUrl` via `loadModule` - a fake `fetch` that rejects once then resolves proves the single retry; one that rejects twice propagates the original rejection; a fake `fetch` that resolves with `ok: false` (no retry) still throws `loadModule`'s own existing error, unchanged.
- **Boundary test**: extend `tests/domainBoundary.test.js`'s convention - nothing outside `domain/providers/` names `stef.be`/`modarchive.org` directly.
- `node --test tests/*.test.js` passes; `node build.mjs app`/`dist` unaffected.

## Security considerations

Every URL fetched is either already-hardcoded (the API bases) or server-supplied (a listing's own `url` field, itself only ever handed to `fetch()`/`Tracker.load()` by a later, out-of-scope screen) - no new user-controlled input surface in this spec, since nothing here is reachable from the UI yet.

## What this deliberately does not do

- **No shared provider interface/base class.** See requirements.md.
- **No Dropbox, no Bassoon render/export, no disk-operation screen, no static root-snapshot fetch, no `random.*` command wiring.** See requirements.md's Scope boundaries.
- **No change to `domain/playback/engine/`** - `loadModule`'s own one-line change is in `domain/playback/index.js`, already v2 code.
