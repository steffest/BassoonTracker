// modules.pl catalog browsing (spec 034), ported from
// script/src/provider/modulespl.js. Same "expand a node, never load a root"
// scope as modArchive.js - see that file's own header note.

import { formatFileSize } from "./formatFileSize.js";

const API_BASE = "https://www.stef.be/bassoontracker/api/mpl/";
// modules.pl's own proxy, unrelated to domain/providers/bassoon.js's - v1
// pre-prefixes every module URL this provider returns with it at parse time
// (modulespl.js:113), not at fetch time.
const PROXY_BASE = "https://www.stef.be/bassoontracker/api/modules.pl/";

let genres = null;
let artists = null;

/**
 * @param {string} path a slash-delimited pseudo-path, e.g. "genre/rock/2"
 * @returns {Promise<Array<{title: string, url?: string, children?: object[], info?: string, icon?: string}>>}
 */
export async function browse(path) {
    const [verb, param, page] = String(path || "").split("/");
    switch (verb) {
        case "genres":
            return loadGenres();
        case "genre":
            return loadGenre(param, page);
        case "toprating":
            return loadFromApi(`toprating/${param || 1}`).then(data => parseModList(data, "rate"));
        case "topscore":
            return loadFromApi(`topscore/${param || 1}`).then(data => parseModList(data, "score"));
        case "artists":
            return loadArtists();
        case "artist": {
            const apiPath = page ? `artist/${param}/${page}` : `artist/${param}`;
            return loadFromApi(apiPath).then(data => parseModList(data));
        }
        default:
            return [];
    }
}

async function loadArtists() {
    if (artists) return artists;
    const result = await loadFromApi("artists");
    artists = (result || []).map(artist => ({ title: artist.handle, info: `${artist.count} >`, url: `artist/${artist.id}`, children: [] }));
    return artists;
}

async function loadGenres() {
    if (genres) return genres;
    const result = await loadFromApi("genres");
    genres = (result || []).map(genre => ({ title: genre.name, url: `genre/${genre.name}`, children: [], info: `${genre.count} >` }));
    return genres;
}

async function loadGenre(id, page) {
    // Ported from modulespl.js:86-95: appends when the raw `page` argument
    // is truthy (a non-empty string, including "0"), not when parseInt(page)
    // is - the two differ for "0", which v1's own `if (page)` treats as present.
    let path = `genre/${id}`;
    if (page) path += `/${parseInt(page, 10)}`;
    return loadFromApi(path).then(data => parseModList(data));
}

async function loadFromApi(path) {
    const response = await fetch(API_BASE + path);
    return response.ok ? response.json() : undefined;
}

function parseModList(data, extraInfo) {
    return (data || []).map(mod => {
        const info = formatFileSize(mod.size);
        const title = extraInfo ? `${mod[extraInfo]}: ${mod.title || "---"}` : (mod.title || "---");
        return { title, url: PROXY_BASE + mod.id, info, icon: mod.format };
    });
}

/** Test/harness entry point: resets the module-level memoization. */
export function reset() {
    genres = null;
    artists = null;
}
