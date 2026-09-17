// The v2 API's proxy pair (spec 034), ported verbatim from
// script/src/provider/bassoon.js:11,84-90. Pure string functions - nothing
// else from that v1 module is here; its render/export pipeline belongs with
// a later format-write-path spec (see README.md).
//
// fetchRandomModuleUrl (spec 063) joins them here rather than in
// domain/randomSong/ - only this folder may name a provider host directly
// (tests/domainBoundary.test.js's own boundary check), the same reason
// domain/diskOperations/ reaches ModArchive/modules.pl only through this
// folder's own browse() exports rather than fetching stef.be itself.

const BASE_URL = "https://www.stef.be/bassoontracker/api/";

export function proxyUrl(url) {
    return BASE_URL + "proxy?" + encodeURIComponent(url);
}

export function isProxyUrl(url) {
    return typeof url === "string" && url.indexOf(BASE_URL + "proxy?") === 0;
}

/**
 * Ported from script/src/ui/diskOperations.js#playRandomSong's own fetch -
 * `format` is literal string concatenation ("random" + (format||"")), so
 * "xm" produces "randomxm", the same route api/server.js's own
 * `case "randomxm"` serves.
 * @returns {Promise<string|null>} the envelope's own module url, or null for
 *   any network failure, non-OK response, or malformed envelope - v1 itself
 *   only ever `console.error`s on the last of those, never throwing.
 */
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

/**
 * Ported from script/src/ui/diskOperations.js#generatePlayList's own fetch
 * (665-678) - api/generatelist, the Bassoon-hosted playlist generator (spec 065).
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
