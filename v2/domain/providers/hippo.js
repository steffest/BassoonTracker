// HippoPlayer.se catalog browsing (spec 034), ported from
// script/src/provider/hippo.js. The simplest of the three - no pagination,
// no genre/artist tree, no API-v1 envelope.

const API_BASE = "https://www.stef.be/bassoontracker/api/hippo/";

let playlists = null; // memoized, like v1's own module-level array

/**
 * @param {string} path "playlists" (a browsable listing) or "playlist/<name>"
 *   (one playlist's own real content). The two verbs return genuinely
 *   different shapes - confirmed by reading loadFromApi's own two callers
 *   below, not assumed from one shared JSDoc, since v1's own Hippo.get
 *   treats them identically as a raw API passthrough.
 * @returns {Promise<Array<{title: string, url?: string, icon?: string}>
 *   | {title: string, modules: Array<{title: string, url: string}>}>}
 *   "playlists" resolves to the array; "playlist/<name>" resolves to a
 *   playlist object directly consumable by domain/playlist#setPlaylist (or
 *   `[]` on a failed fetch - loadFromApi's own single failure value, safe
 *   to check for with `Array.isArray(data.modules)` either way).
 */
export async function browse(path) {
    const [verb, param] = String(path || "").split("/");
    switch (verb) {
        case "playlists":
            return loadPlaylists();
        case "playlist":
            return loadFromApi(param || "");
        default:
            return [];
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

/** Test/harness entry point: resets the module-level memoization. */
export function reset() {
    playlists = null;
}
