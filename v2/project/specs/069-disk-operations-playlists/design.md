# 069 — Design

## Overview

```
assets/data/playlists.json (new)          root listing, mirrors modules.json
assets/data/playlists/*.json (new, x7)    one curated, filtered file per playlist

domain/providers/hippo.js
  browse()'s own JSDoc corrected (no code change)

domain/diskOperations/index.js
  + loadPlaylistsRoot(app)          fetches assets/data/playlists.json
  rootFor(): + "Playlists" -> loadPlaylistsRoot; + "Hippo" -> browseHippo("playlists")
  setDiskTarget(): TARGETS list gains "Playlists", "Hippo"
  setBrowserRow(): leaf branch gains two currentTarget checks before the
    existing loadModule() fallback

components/fileOperationsPanel.yaml
  diskTargetRow's radioGroup gains two items: Playlists, Hippo

build.mjs
  mediaSubdirs gains "data/playlists"; the copy filter also skips directories
  (a latent bug the new subdirectory exposed, fixed alongside)
```

## Curated playlist assets

A one-off Node script (not committed - the same "scripted, not hand-typed" call spec 036 made implicitly for its own eight absolute-URL entries, made explicit here since the scale is roughly 40x larger) read each of the seven real files directly from `playlists/*.json`, filtered out any entry whose own `url` is present but not absolute (`url.indexOf("://") < 0`), and wrote:

```
assets/data/playlists.json
{
  "modules": [
    { "title": "DemoScene 2023", "url": "data/playlists/demoscene2023.json", "info": "92 tracks" },
    { "title": "DemoScene 2024", "url": "data/playlists/demoscene2024.json", "info": "55 tracks" },
    { "title": "DemoScene 2025", "url": "data/playlists/demoscene2025.json", "info": "63 tracks" },
    { "title": "DemoScene 2026", "url": "data/playlists/demoscene2026.json", "info": "77 tracks" },
    { "title": "DSR 2024", "url": "data/playlists/dsr2024.json", "info": "15 tracks" },
    { "title": "Chippies", "url": "data/playlists/chippies.json", "info": "1 track" },
    { "title": "RAW diskmag", "url": "data/playlists/raw_diskmag.json", "info": "36 tracks" }
  ]
}
```

Each `assets/data/playlists/<name>.json` keeps the source file's own `title` and its own filtered `modules` array verbatim (title/url/author/group/info/link fields all preserved, exactly as the source has them - no field picked-and-chosen the way `modules.json`'s own simpler shape did, since a playlist entry has more of them and nothing reads this file selectively).

## `domain/providers/hippo.js`

JSDoc only - see requirements.md's own Decisions section for the finding. No behavior change: `browse("playlist/<name>")` already correctly forwarded to `loadFromApi(param)` (dropping the `"playlist/"` verb itself before hitting the real API path), matching v1's own `Hippo.get`/`loadFromApi` exactly.

## `domain/diskOperations/index.js`

```js
import { browse as browseHippo } from "../providers/hippo.js";
import { setPlaylist, openPlaylistUrl } from "../playlist/index.js";

const PLAYLISTS_JSON_PATH = "data/playlists.json";

async function loadPlaylistsRoot(app) {
    const response = await fetch(assetUrl(app, PLAYLISTS_JSON_PATH));
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data && data.modules) ? data.modules : [];
}

async function rootFor(app, target) {
    if (trees[target]) return trees[target];
    if (target === "Bassoon") trees[target] = await loadBassoonRoot(app);
    else if (target === "ModArchive") trees[target] = MODARCHIVE_ROOT();
    else if (target === "Modules.pl") trees[target] = MODULESPL_ROOT();
    else if (target === "Playlists") trees[target] = await loadPlaylistsRoot(app);
    else if (target === "Hippo") trees[target] = await browseHippo("playlists");
    else trees[target] = [];
    return trees[target];
}

const TARGETS = ["Bassoon", "ModArchive", "Modules.pl", "Playlists", "Hippo"];

export async function setDiskTarget(app, detail) {
    const target = detail && detail.value;
    if (!TARGETS.includes(target)) return;
    // ...unchanged below this line
}
```

`setBrowserRow`'s leaf branch (after the existing branch/expand logic, before the final `loadModule` fallback):

```js
if (currentTarget === "Playlists") {
    await openPlaylistUrl(app, assetUrl(app, node.url));
    return;
}
if (currentTarget === "Hippo") {
    const data = await browseHippo(`playlist/${node.url}`);
    if (data && Array.isArray(data.modules)) setPlaylist(data);
    return;
}
await loadModule(app, assetUrl(app, node.url)); // unchanged
```

`node.url` for a "Playlists" root row is `"data/playlists/<name>.json"` (relative to v2's asset base, resolved by `assetUrl` exactly as `loadBassoonRoot`'s own entries already are); for a "Hippo" root row it is whatever the API's own listing gave (`"chippies.prg"`, etc., matching v1's own `item` value verbatim) - passed straight through to `browse()`'s own `"playlist/<name>"` verb, which builds the real fetch URL itself.

## `components/fileOperationsPanel.yaml`

One change, two new items in the existing target radioGroup:

```yaml
items:
  - label: Bassoon
  - label: ModArchive
  - label: Modules.pl
  - label: Playlists
  - label: Hippo
```

No new `visibleWhen`/field - the same `change: setDiskTarget` action already handles any value the radioGroup dispatches.

## `build.mjs`

```js
const mediaSubdirs = ["demo", "data", "data/playlists"];
...
const names = existsSync(mediaDir)
    ? readdirSync(mediaDir).filter(name => !name.startsWith(".") && !statSync(join(mediaDir, name)).isDirectory())
    : [];
```

The directory-skip is the fix for the latent bug found while first running `dist` against the new `data/playlists/` subdirectory (see requirements.md).

## Data models

None new - a "Playlists" root row is the same `{title, url, info?}` shape `loadBassoonRoot`'s own entries already are; a "Hippo" root row is the same `{title, url, icon}` shape `domain/providers/hippo.js#browse("playlists")` already produced since spec 034.

## Error handling

- **`loadPlaylistsRoot` on a failed fetch**: `[]`, matching `loadBassoonRoot`'s own identical contract.
- **A Hippo leaf's own playlist fetch failing**: `browse()`'s own `[]` failure value fails the `Array.isArray(data.modules)` check, so `setPlaylist` is never called and whatever playlist was already current is left untouched.
- **A Playlists leaf's own fetch/parse failing**: entirely `openPlaylistUrl`'s own existing contract (spec 068) - `false`, nothing changed.

## Testing strategy

- **`tests/diskOperations.test.js`** (extended): `setDiskTarget(Playlists)` publishing rows from a faked `assets/data/playlists.json` fetch, and tolerating a failed one; a Playlists leaf click fetching and setting a playlist; `setDiskTarget(Hippo)` publishing rows from a faked API listing; a Hippo leaf click setting a playlist directly, and a failed one leaving the current playlist untouched. `resetHippo()` (spec 034's own test/harness export, unused by this file until now) added to `beforeEach`, since `domain/providers/hippo.js#browse("playlists")` memoizes its own result at module scope - without resetting it, an earlier test's own faked listing would silently satisfy a later test's own different fake, since the process-lifetime cache never asks `fetch` again.
- `node --test tests/*.test.js` passes; `node compiler/generate.js` (no new warnings) and `node build.mjs app`/`dist` (two new `inert-control` loose ends, nothing else, and a real `dist` build succeeding against the new asset subdirectory) confirmed.

## What this deliberately does not do

See requirements.md's Scope boundaries: no auto-play on load, "Demo Songs"/"My Favorites" both excluded for real, recorded reasons, no navigate-back-to-main behavior added asymmetrically.
