// ModArchive catalog browsing (spec 034), ported from
// script/src/provider/modarchive.js. Only ever called to expand a node an
// already-loaded tree already contains (see README.md) - there is no "load
// the root" case here, matching v1's own diskOperations.js, which fetches a
// static snapshot for the root instead of calling this module with "".

import { formatFileSize } from "./formatFileSize.js";

const API_BASE = "https://www.stef.be/bassoontracker/api/ma/";
const API_V1_BASE = "https://www.stef.be/bassoontracker/api/";

let genres = null;  // memoized, like v1's own module-level array
let artists = null;

/**
 * @param {string} path a slash-delimited pseudo-path, e.g. "genre/12/2"
 * @returns {Promise<Array<{title: string, url?: string, children?: object[], info?: string, icon?: string}>>}
 */
export async function browse(path) {
    const parts = String(path || "").split("/");
    const verb = parts[0];
    const param = parts[1] || "";
    const page = parts[2] || "";
    switch (verb) {
        case "genres":
            return loadGenres();
        case "artists":
            return loadArtists();
        case "genre":
            return loadFromApi(`genre/${param}`).then(parseModList);
        case "artist": {
            const apiPath = page ? `artist/${param}/${page}` : `artist/${param}`;
            return loadFromApi(apiPath).then(parseModList);
        }
        case "toprating":
            return loadFromApiV1(`toprating/${param || 1}`).then(data => parseModListV1(data, [verb, param, page]));
        case "topreview":
            return loadFromApiV1(`topreview/${param || 1}`).then(data => parseModListV1(data, [verb, param, page]));
        default:
            return [];
    }
}

async function loadGenres() {
    if (genres) return genres;
    const result = await loadFromApi("genres");
    const children = {};
    (result || []).forEach(genre => {
        if (genre.parent) {
            const item = { title: genre.name, count: genre.count, info: `${genre.count} >`, children: [], url: `genre/${genre.id}` };
            if (!children[genre.parent]) children[genre.parent] = [];
            children[genre.parent].push(item);
        }
    });
    genres = (result || [])
        .filter(genre => !genre.parent)
        .map(genre => {
            const items = children[genre.id] || [];
            const total = items.reduce((sum, child) => sum + child.count, 0);
            return { title: genre.name, children: items, info: `${total} >` };
        });
    return genres;
}

async function loadArtists() {
    if (artists) return artists;
    const result = await loadFromApi("artists");
    artists = (result || []).map(artist => ({ title: artist.handle, children: [], info: `${artist.count} >`, url: `artist/${artist.id}` }));
    return artists;
}

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

/** Ported from modarchive.js:136-175: single-vs-array module result, the "... load more ..." sentinel, and profile/page reconstruction for artist/genre vs top* bases. */
function parseModListV1(data, base) {
    const result = [];
    if (!data) return result;

    if (data.module) {
        const mods = data.module;
        if (Array.isArray(mods)) {
            mods.forEach(mod => result.push({ title: mod.songtitle || "---", url: mod.url, icon: "mod" }));
        } else {
            result.push({ title: mods.songtitle || "---", url: mods.url, icon: "mod" });
        }
    }

    if (data.totalpages) {
        const pageCount = parseInt(data.totalpages, 10);
        if (pageCount > 1) {
            let profile = `${base[0]}/`;
            let currentPage = parseInt(base[1] || 1, 10);
            if (isNaN(currentPage)) currentPage = 1;

            if (profile === "artist/" || profile === "genre/") {
                profile += `${base[1]}/`;
                currentPage = parseInt(base[2] || 1, 10);
                if (isNaN(currentPage)) currentPage = 1;
            }
            if (pageCount > currentPage) {
                profile += currentPage + 1;
                result.push({ title: "... load more ...", children: [], url: profile });
            }
        }
    }

    return result;
}

/** Test/harness entry point: resets the module-level memoization. */
export function reset() {
    genres = null;
    artists = null;
}
