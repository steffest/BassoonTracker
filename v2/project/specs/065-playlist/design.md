# 065 — Design

## Overview

```
domain/providers/bassoon.js
  + fetchGeneratedPlayList()   api/generatelist, alongside fetchRandomModuleUrl
domain/providers/index.js
  + re-export fetchGeneratedPlayList

domain/playlist/index.js (new)
  module state: currentPlaylist, currentIndex, isShuffle, playOrder
  setPlaylist/getPlaylist/getCurrentIndex/isShuffleEnabled/toggleShuffle
  parsePlaylist(text, name)        PLS/M3U import
  writePlaylist(format)            PLS/M3U/JSON export text
  getPlaylistFileName()
  playTrack(app, index) / nextTrack(app) / previousTrack(app)
  exportPlaylist(app, format)      the capability: writes + downloads
  openGeneratedPlaylist(app)       the capability: play-list.random

capabilities.js
  + "play-list.random": domain/playlist/index.js#openGeneratedPlaylist

tests/domainBoundary.test.js
  sourceFiles() walks "domain" (not two named subfolders); every check
  strips comments first (see requirements.md's own recorded finding)
```

## `domain/providers/bassoon.js` (addition)

```js
/**
 * Ported from script/src/ui/diskOperations.js#generatePlayList's own fetch
 * (665-678) - api/generatelist, the Bassoon-hosted playlist generator.
 * @returns {Promise<{title:string, modules:Array<{title:string,url:string}>}|null>}
 */
export async function fetchGeneratedPlayList() {
    try {
        const response = await fetch(BASE_URL + "generatelist");
        if (!response.ok) return null;
        const data = await response.json();
        return (data && data.modules) ? data : null;
    } catch {
        return null;
    }
}
```

`domain/providers/index.js` adds `fetchGeneratedPlayList` to its existing `import { ... } from "./bassoon.js"; export { ... };` pair, matching `fetchRandomModuleUrl`'s own precedent exactly.

## `domain/playlist/index.js`

```js
import { loadModule } from "../playback/index.js";
import { fetchGeneratedPlayList } from "../providers/index.js";

let currentPlaylist = null;
let currentIndex = 0;
let isShuffle = false;
let playOrder = [];

function setPlayOrder() {
    playOrder = [];
    if (!currentPlaylist || !currentPlaylist.modules) return;
    for (let i = 0; i < currentPlaylist.modules.length; i++) playOrder.push(i);
    if (isShuffle) playOrder.sort(() => 0.5 - Math.random());
}

export function setPlaylist(data) {
    currentPlaylist = data;
    currentIndex = 0;
    setPlayOrder();
}

export function getPlaylist() { return currentPlaylist; }
export function getCurrentIndex() { return currentIndex; }
export function isShuffleEnabled() { return isShuffle; }

export function toggleShuffle() {
    isShuffle = !isShuffle;
    setPlayOrder();
    return isShuffle;
}

/** Ported from playlist.js#loadTrack/play (31-54), minus v1's own browser-URL query-string sync (see requirements.md). */
export async function playTrack(app, index) {
    if (!currentPlaylist || !currentPlaylist.modules) return false;
    const item = currentPlaylist.modules[index];
    if (!item || !item.url) return false;
    currentIndex = index;
    await loadModule(app, item.url);
    return true;
}

/** Ported from playlist.js#moveIndex (209-221), including its own inert `|| 0` (see requirements.md). */
function moveIndex(offset) {
    if (!currentPlaylist || !currentPlaylist.modules || !currentPlaylist.modules.length) return;
    if (isShuffle) {
        let playIndex = playOrder.indexOf(currentIndex) || 0;
        playIndex += offset;
        if (playIndex >= playOrder.length) playIndex = 0;
        if (playIndex < 0) playIndex = playOrder.length - 1;
        currentIndex = playOrder[playIndex];
    } else {
        currentIndex += offset;
        if (currentIndex >= currentPlaylist.modules.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = currentPlaylist.modules.length - 1;
    }
}

/** Ported from playlist.js#next/prev (56-72): skip one extra step past an entry with no url. */
export async function nextTrack(app) {
    if (!currentPlaylist || !currentPlaylist.modules || !currentPlaylist.modules.length) return false;
    moveIndex(1);
    if (!currentPlaylist.modules[currentIndex] || !currentPlaylist.modules[currentIndex].url) moveIndex(1);
    return playTrack(app, currentIndex);
}

export async function previousTrack(app) {
    if (!currentPlaylist || !currentPlaylist.modules || !currentPlaylist.modules.length) return false;
    moveIndex(-1);
    if (!currentPlaylist.modules[currentIndex] || !currentPlaylist.modules[currentIndex].url) moveIndex(-1);
    return playTrack(app, currentIndex);
}

/** Ported from playlist.js#parse (84-136). */
export function parsePlaylist(data, name) {
    const result = { title: name, modules: [] };
    const lines = data.split("\n");
    const ext = name.split(".").pop().toLowerCase();

    if (ext === "pls") {
        lines.forEach(line => {
            let url;
            let title;
            if (line.startsWith("File")) {
                url = line.substring(line.indexOf("=") + 1).trim();
                const index = line.substring(4).split("=")[0].trim();
                const titleLine = lines.find(l => l.startsWith("Title" + index));
                if (titleLine) title = titleLine.split("=")[1].trim();
            }
            if (line.startsWith("http")) url = line.trim();
            if (url && isFormatSupported(url)) {
                if (!title) title = url.split("/").pop();
                result.modules.push({ title, url });
            }
        });
    } else if (ext === "m3u") {
        lines.forEach(line => {
            if (line.startsWith("http")) {
                result.modules.push({ title: decodeURIComponent(line.split("/").pop()), url: line.trim() });
            }
        });
    }
    return result;
}

/** Ported from playlist.js#isFormatSupported (223-234), including its own dead ".pls" case (see requirements.md). */
function isFormatSupported(url) {
    const ext = url.split(".").pop().toLowerCase();
    if (ext === "mod" || ext === "xm" || ext === ".pls") return true;
    if (url.indexOf(".modarchive.") > 0) return true;
    if (url.indexOf("bassoontracker") > 0) return true;
    return false;
}

function resolveUrl(url) {
    if (url.indexOf("://") >= 0) return url;
    if (typeof window !== "undefined" && window.location) {
        try { return new URL(url, window.location.href).href; } catch { return url; }
    }
    return url; // no browser to resolve against - see requirements.md
}

/** Ported from playlist.js#generatePLS (173-191). */
function generatePLS() {
    if (!currentPlaylist || !currentPlaylist.modules) return null;
    let result = "[playlist]\n";
    let index = 1;
    currentPlaylist.modules.forEach(item => {
        if (!item.url) return;
        result += `File${index}=${resolveUrl(item.url)}\n`;
        result += `Title${index}=${item.title}\n`;
        index++;
    });
    result += `NumberOfEntries=${index - 1}\nVersion=2`;
    return result;
}

/** Ported from playlist.js#generateM3U (193-207). */
function generateM3U() {
    if (!currentPlaylist || !currentPlaylist.modules) return null;
    let result = "#EXTM3U\n";
    currentPlaylist.modules.forEach(item => {
        if (!item.url) return;
        result += `#EXTINF:-1,${item.title}\n${resolveUrl(item.url)}\n`;
    });
    return result;
}

/** `format` one of "pls" (the default), "m3u", "json" - matching diskOp_Save.js's own default-selected item. */
export function writePlaylist(format) {
    if (!currentPlaylist || !currentPlaylist.modules) return null;
    if (format === "json") return JSON.stringify(currentPlaylist, null, 2);
    if (format === "m3u") return generateM3U();
    return generatePLS();
}

export function getPlaylistFileName() {
    if (!currentPlaylist) return "playlist.pls";
    return `${currentPlaylist.title}.pls`.replaceAll(" ", "_").toLowerCase();
}

function downloadText(text, name) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

/** The playlist-export capability (spec 065), ported from playlist.js#export (138-160), minus Dropbox (see requirements.md). Not wired to any command yet. */
export async function exportPlaylist(app, format) {
    const text = writePlaylist(format);
    if (text === null) return;
    const extension = format === "json" ? "json" : format === "m3u" ? "m3u" : "pls";
    const name = getPlaylistFileName().replace(/\.pls$/, `.${extension}`);
    downloadText(text, name);
    if (app && app.log) app.log("play-list.export", { name, format });
}

/** The `play-list.random` capability, ported from diskOperations.js#generatePlayList (665-678). */
export async function openGeneratedPlaylist(app) {
    const data = await fetchGeneratedPlayList();
    if (!data) {
        if (app && app.log) app.log("play-list.random", { error: "could not contact the API" });
        return false;
    }
    setPlaylist(data);
    return playTrack(app, 0);
}
```

## `capabilities.js`

One new line, alongside `song.random`/`song-xm.random`:

```js
"play-list.random": { module: "./domain/playlist/index.js", export: "openGeneratedPlaylist" },
```

## `tests/domainBoundary.test.js`

See requirements.md's own Decisions section for the finding. `sourceFiles()`'s directory list becomes `["compiler", "runtime", "renderers", "workbench", "app", "tests", "domain"]` (dropping the two now-redundant named subfolders); a new `codeLines(content)` helper (block comments blanked out preserving newlines, then `//...` stripped per line) replaces the raw `readFileSync(...).split(LINE)` in all four checks that scan file content.

## Data models

`{title: string, modules: Array<{title: string, url: string}>}` - the same shape `domain/randomSong`'s own `fetchGeneratedPlayList` return value already implies and v1's own `Playlist.set`/`.parse` already use; nothing new.

## Error handling

- **Every navigation/export function with no current playlist**: returns `false`/`null` rather than throwing, matching v1's own `if (!currentPlaylist || !currentPlaylist.modules) return;` guards throughout.
- **`playTrack` with an out-of-range index or an entry with no `url`**: returns `false`, does not call `loadModule` - matches v1's own `if (item && item.url)` guard.
- **`openGeneratedPlaylist` on a failed fetch**: `fetchGeneratedPlayList` already swallows network/HTTP errors to `null` (matching `fetchRandomModuleUrl`'s own contract); the capability logs and returns `false` rather than throwing, matching v1's own `UI.setStatus("Error: could not contact the API", false)` branch's intent without a UI to show it in yet.

## Testing strategy

- **`tests/playlist.test.js`** (new): `parsePlaylist` against hand-built PLS and M3U text (including a `FileN`/`TitleN` pair and an unsupported extension being skipped); `writePlaylist` for all three formats, each round-tripped back through `parsePlaylist`/`JSON.parse`; `playTrack`/`nextTrack`/`previousTrack` against a small hand-built playlist with a real fixture URL and one entry with no `url` (exercising the skip-one-further-step branch), both with and without shuffle; `toggleShuffle` changing the play order; `openGeneratedPlaylist` and `exportPlaylist` against a stubbed `fetch`/DOM, the same convention `tests/randomSong.test.js`/`tests/sampleExport.test.js` already use. Added to `PROVIDER_TEST_FILES` in `tests/domainBoundary.test.js` (it legitimately names the proxied host as a fake-fetch map key).
- `node --test tests/*.test.js` passes; `node compiler/generate.js` (one fewer `mocked-command`) and `node build.mjs app`/`dist` (one new real command, `play-list.random`) confirmed.

## What this deliberately does not do

See requirements.md's Scope boundaries: no auto-advance on song end, no disk-operations playlist listboxes, no Dropbox target, no `getSongInfoUrl`, no save/export screen, no browser-URL query-string sync.
