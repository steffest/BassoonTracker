// The providers capability (spec 034), continuing package P9 of the port
// roadmap. There is no shared interface across v1's five providers - see
// README.md - so this file is not a facade over the other modules in this
// folder; it is only the one thing every caller of a module URL needs:
// domain/playback/index.js#loadModule's own proxy-retry wrapper.

import { proxyUrl, isProxyUrl, fetchRandomModuleUrl, fetchGeneratedPlayList } from "./bassoon.js";

export { proxyUrl, isProxyUrl, fetchRandomModuleUrl, fetchGeneratedPlayList };

/**
 * Fetches `target`, retrying once through the v2 API's CORS proxy on a
 * network-level failure (not an HTTP-level one - see design.md's own
 * "getting the retry condition exactly right"). Ported from
 * script/src/filesystem.js#loadFile's onerror handler (its only retry path),
 * with `fetch()`'s rejection standing in for XMLHttpRequest's onerror.
 */
export async function fetchModuleUrl(target) {
    try {
        return await fetch(target);
    } catch (networkError) {
        if (isProxyUrl(target)) throw networkError; // already proxied - v1's own cutoff
        return fetch(proxyUrl(target));
    }
}
