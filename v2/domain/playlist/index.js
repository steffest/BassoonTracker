// The Playlist domain model (spec 065) plus auto-advance on song end (spec
// 066), continuing package P9 (persistence, providers, file operations) of
// the port roadmap. Ported from script/src/models/playlist.js (266 lines,
// read in full) - the state, PLS/M3U import, PLS/M3U/JSON export,
// player-order navigation and the EVENT.songEnd handler, minus the pieces
// recorded out of scope in requirements.md (the Bassoon/Hippo
// disk-operations screen listboxes, Dropbox targets, and v1's own
// browser-URL query-string sync).

import { loadModule, onSongEnd, setAutoPlay, transportStop } from "../playback/index.js";
import { fetchGeneratedPlayList, fetchModuleUrl } from "../providers/index.js";

let currentPlaylist = null;
let currentIndex = 0;
let isShuffle = false;
let playOrder = [];
let playListActive = false;
let lastApp = null;

function setPlayOrder() {
    playOrder = [];
    if (!currentPlaylist || !currentPlaylist.modules) return;
    for (let i = 0; i < currentPlaylist.modules.length; i++) playOrder.push(i);
    if (isShuffle) playOrder.sort(() => 0.5 - Math.random());
}

/** Ported from playlist.js#set (14-25), minus the EventBus trigger (no listener exists in v2 yet). */
export function setPlaylist(data) {
    currentPlaylist = data;
    currentIndex = 0;
    setPlayOrder();
}

export function getPlaylist() { return currentPlaylist; }
export function getCurrentIndex() { return currentIndex; }
export function isShuffleEnabled() { return isShuffle; }

/** Ported from playlist.js#toggleShuffle (162-165). */
export function toggleShuffle() {
    isShuffle = !isShuffle;
    setPlayOrder();
    return isShuffle;
}

/**
 * Ported from playlist.js#loadTrack/play (31-54), minus v1's own browser-URL
 * query-string sync (see requirements.md). Also arms auto-advance (spec
 * 066), matching v1's own `Tracker.autoPlay = true; playListActive = true;`
 * - both stay set for the rest of the session once any track has ever
 * played this way, a real v1 quirk ported faithfully, not "fixed" (see
 * spec 066's requirements.md). A failed load resolves to `false` rather
 * than throwing, the same graceful-degradation contract
 * domain/randomSong#openRandomSong already established for the identical
 * failure mode (a resolved entry whose own module URL fails to load).
 */
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

/**
 * Ported from playlist.js#moveIndex (209-221), including its own inert
 * `indexOf(...) || 0` fallback (JS's `-1` is truthy, so the "not found"
 * default never actually triggers) - harmless in practice, since playOrder
 * always holds every index whenever a playlist is set (see requirements.md).
 */
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

/** Ported from playlist.js#next (56-63): skip one extra step past an entry with no url. */
export async function nextTrack(app) {
    if (!currentPlaylist || !currentPlaylist.modules || !currentPlaylist.modules.length) return false;
    moveIndex(1);
    if (!currentPlaylist.modules[currentIndex] || !currentPlaylist.modules[currentIndex].url) moveIndex(1);
    return playTrack(app, currentIndex);
}

/** Ported from playlist.js#prev (65-72). */
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

/**
 * Ported from playlist.js#isFormatSupported (223-234), including its own
 * dead `".pls"` case: `ext` is always computed via `.split(".").pop()`, so
 * it never carries a leading dot and that branch can never match - kept
 * faithfully, since it changes nothing observable (see requirements.md).
 */
function isFormatSupported(url) {
    const ext = url.split(".").pop().toLowerCase();
    if (ext === "mod" || ext === "xm" || ext === ".pls") return true;
    if (url.indexOf(".modarchive.") > 0) return true;
    if (url.indexOf("bassoontracker") > 0) return true;
    return false;
}

/**
 * Ported from script/src/tracker.js#processFile's own FILETYPE.playlist
 * branch (2248-2258, spec 068) - the direct v2-native equivalent of the one
 * thing that branch does that domain/playback's own ported processFile
 * (package P2) still detects but never handles. `name`'s own extension
 * decides the shape: a `.json` file already is a `{title, modules}` object;
 * anything else goes through parsePlaylist above.
 */
export function parsePlaylistFile(text, name) {
    if (String(name).toLowerCase().endsWith(".json")) return JSON.parse(text);
    return parsePlaylist(text, name);
}

/**
 * Fetches a playlist file (JSON/PLS/M3U) at `url` and sets it as the
 * current playlist (spec 068). Reuses domain/providers#fetchModuleUrl - the
 * same proxy-retry-on-network-failure contract domain/playback#loadModule
 * already relies on for cross-origin module URLs. Matches v1's own
 * behavior exactly: nothing here starts playback (see requirements.md).
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

// v1 resolves a relative module URL against window.location.href; with no
// browser (this test environment, and any future non-browser host) a
// relative URL is written through unresolved rather than thrown on.
function resolveUrl(url) {
    if (url.indexOf("://") >= 0) return url;
    if (typeof window !== "undefined" && window.location) {
        try {
            return new URL(url, window.location.href).href;
        } catch {
            return url;
        }
    }
    return url;
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

/**
 * `format` is one of "pls" (the default), "m3u", "json" - matching
 * diskOp_Save.js's own default-selected playlist-format radio item.
 */
export function writePlaylist(format) {
    if (!currentPlaylist || !currentPlaylist.modules) return null;
    if (format === "json") return JSON.stringify(currentPlaylist, null, 2);
    if (format === "m3u") return generateM3U();
    return generatePLS();
}

/** Ported from playlist.js#getFileName (167-171). */
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

/**
 * The playlist-export capability, ported from playlist.js#export (138-160),
 * minus Dropbox (see requirements.md). Not wired to any YAML/capabilities.js
 * entry yet - a later "save/export screen" spec is expected to call this,
 * matching spec 064's own identical decision for exportSample.
 */
export async function exportPlaylist(app, format) {
    const text = writePlaylist(format);
    if (text === null) return;
    const extension = format === "json" ? "json" : format === "m3u" ? "m3u" : "pls";
    const name = getPlaylistFileName().replace(/\.pls$/, `.${extension}`);
    downloadText(text, name);
    if (app && app.log) app.log("play-list.export", { name, format });
}

// The save/export screen's own format radioGroup (spec 067) dispatches a
// clicked item's own label, not the internal format code exportPlaylist
// itself expects - this table is the one place that translation happens.
const PLAYLIST_FORMAT_LABELS = { PLS: "pls", M3U: "m3u", JSON: "json" };
let playlistExportFormat = "pls";

/** The `playlist-format.set` capability (spec 067) - the radioGroup's own `change` handler. */
export function setPlaylistExportFormat(app, detail) {
    playlistExportFormat = PLAYLIST_FORMAT_LABELS[detail && detail.value] || "pls";
}

/**
 * The `play-list.export` capability (spec 067) - the save/export screen's
 * own "Export Playlist" button. A thin wrapper over exportPlaylist(app,
 * format) (spec 065, unchanged and still directly callable/testable on its
 * own) supplying whatever format the radioGroup above last selected.
 */
export async function exportPlaylistSelection(app) {
    return exportPlaylist(app, playlistExportFormat);
}

/**
 * The `play-list.random` capability, ported from
 * script/src/ui/diskOperations.js#generatePlayList (665-678) - resolves the
 * File menu's own previously-mocked "Open Random Playlist" command.
 */
export async function openGeneratedPlaylist(app) {
    const data = await fetchGeneratedPlayList();
    if (!data) {
        if (app && app.log) app.log("play-list.random", { error: "could not contact the API" });
        return false;
    }
    setPlaylist(data);
    return playTrack(app, 0);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ported from playlist.js's own EVENT.songEnd handler (249-258, spec 066):
 * waits for the current buffer's own remaining tail before stopping, then a
 * further 100ms settle before advancing - avoids an audible cut from
 * stopping and loading a new module while the old one is still rendering
 * its last buffer. v1's own extra Tracker.reset() between stop and the next
 * load is not ported - the next track's own loadModule already redoes
 * everything it would touch (see requirements.md).
 */
export async function advanceOnSongEnd(app, delaySeconds) {
    if (!playListActive) return false;
    await sleep((delaySeconds || 0) * 1000);
    await transportStop(app);
    await sleep(100);
    return nextTrack(app);
}

// Registered once, at module load, mirroring v1's own single permanent
// EventBus.on(EVENT.songEnd, ...) registration - not per-playTrack-call,
// which would accumulate duplicate subscriptions against the engine's own
// persistent EventBus singleton. lastApp is read fresh on every firing.
onSongEnd(delay => advanceOnSongEnd(lastApp, delay));
