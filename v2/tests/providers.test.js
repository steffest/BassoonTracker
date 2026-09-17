import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { formatFileSize } from "../domain/providers/formatFileSize.js";
import * as modArchive from "../domain/providers/modArchive.js";
import * as modulesPl from "../domain/providers/modulesPl.js";
import * as hippo from "../domain/providers/hippo.js";
import { fetchModuleUrl, proxyUrl, isProxyUrl } from "../domain/providers/index.js";

let originalFetch;
let responses; // url -> () => { ok, json?: () => any }

beforeEach(() => {
    originalFetch = globalThis.fetch;
    responses = new Map();
    globalThis.fetch = async url => {
        const make = responses.get(url);
        if (!make) throw new Error(`unexpected fetch: ${url}`);
        return make();
    };
    modArchive.reset();
    modulesPl.reset();
    hippo.reset();
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function jsonResponse(data, ok = true) {
    return { ok, json: async () => data };
}

// --- formatFileSize ---------------------------------------------------

test("formatFileSize matches v1's own two-unit rounding", () => {
    assert.equal(formatFileSize(NaN), "0k");
    assert.equal(formatFileSize(4500), "5k");
    assert.equal(formatFileSize(999000), "999k");
    assert.equal(formatFileSize(1_234_000_000), "1234MB");
});

// --- ModArchive ---------------------------------------------------------

test("modArchive: genres nests children under their parent and sums counts", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/ma/genres", () => jsonResponse([
        { id: 1, name: "Rock", parent: null },
        { id: 2, name: "Hard Rock", parent: 1, count: 5 },
        { id: 3, name: "Punk", parent: 1, count: 3 }
    ]));
    const result = await modArchive.browse("genres");
    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Rock");
    assert.equal(result[0].info, "8 >");
    assert.equal(result[0].children.length, 2);
    assert.equal(result[0].children[0].url, "genre/2");
});

test("modArchive: genres is memoized across calls", async () => {
    let calls = 0;
    responses.set("https://www.stef.be/bassoontracker/api/ma/genres", () => { calls++; return jsonResponse([]); });
    await modArchive.browse("genres");
    await modArchive.browse("genres");
    assert.equal(calls, 1);
});

test("modArchive: artists is a flat list with a count and a url", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/ma/artists", () => jsonResponse([{ id: 9, handle: "4mat", count: 12 }]));
    const result = await modArchive.browse("artists");
    assert.deepEqual(result, [{ title: "4mat", children: [], info: "12 >", url: "artist/9" }]);
});

test("modArchive: genre/<id> lists modules with a modarchive.org download url", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/ma/genre/12", () => jsonResponse([{ id: 55, title: "Wizball", format: "mod", size: 45000 }]));
    const result = await modArchive.browse("genre/12");
    assert.deepEqual(result, [{ title: "Wizball", url: "https://api.modarchive.org/downloads.php?moduleid=55", icon: "mod", info: "45k" }]);
});

test("modArchive: artist/<id>/<page> is passed through to the api path", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/ma/artist/9/2", () => jsonResponse([]));
    await modArchive.browse("artist/9/2");
});

test("modArchive: toprating unwraps the modarchive v1 envelope and a single result", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/toprating/1", () => jsonResponse({
        modarchive: { module: { songtitle: "Second Reality", url: "https://x/2r.mod" } }
    }));
    const result = await modArchive.browse("toprating");
    assert.deepEqual(result, [{ title: "Second Reality", url: "https://x/2r.mod", icon: "mod" }]);
});

test("modArchive: toprating handles an array of modules and appends a load-more sentinel", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/toprating/1", () => jsonResponse({
        modarchive: {
            module: [{ songtitle: "A", url: "a" }, { songtitle: "B", url: "b" }],
            totalpages: "3"
        }
    }));
    const result = await modArchive.browse("toprating/1");
    assert.equal(result.length, 3);
    assert.deepEqual(result[2], { title: "... load more ...", children: [], url: "toprating/2" });
});

test("modArchive: a single-page result never appends the load-more sentinel", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/toprating/1", () => jsonResponse({ modarchive: { totalpages: "1" } }));
    assert.deepEqual(await modArchive.browse("toprating/1"), []);
});

test("modArchive: an unrecognized verb resolves to an empty list", async () => {
    assert.deepEqual(await modArchive.browse("nonesuch"), []);
});

test("modArchive: an HTTP failure resolves the tree to an empty list rather than throwing", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/ma/genres", () => jsonResponse(undefined, false));
    assert.deepEqual(await modArchive.browse("genres"), []);
});

// --- modules.pl ----------------------------------------------------------

test("modulesPl: genres, artists and genre/<id> match v1's own field names", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/mpl/genres", () => jsonResponse([{ name: "Chip", count: 4 }]));
    const genres = await modulesPl.browse("genres");
    assert.deepEqual(genres, [{ title: "Chip", url: "genre/Chip", children: [], info: "4 >" }]);

    responses.set("https://www.stef.be/bassoontracker/api/mpl/genre/Chip", () => jsonResponse([{ id: 1, title: "Song", size: 2000, format: "xm" }]));
    const mods = await modulesPl.browse("genre/Chip");
    assert.deepEqual(mods, [{ title: "Song", url: "https://www.stef.be/bassoontracker/api/modules.pl/1", info: "2k", icon: "xm" }]);
});

test("modulesPl: genre appends the page only when one is given, even \"0\"", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/mpl/genre/Chip/0", () => jsonResponse([]));
    await modulesPl.browse("genre/Chip/0");
});

test("modulesPl: toprating/topscore prefix the title with the extra-info field", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/mpl/toprating/1", () => jsonResponse([{ id: 1, title: "Song", rate: "9.5", size: 1000, format: "mod" }]));
    const result = await modulesPl.browse("toprating");
    assert.equal(result[0].title, "9.5: Song");
});

test("modulesPl: an unrecognized verb resolves to an empty list", async () => {
    assert.deepEqual(await modulesPl.browse("nonesuch"), []);
});

// --- Hippo -----------------------------------------------------------------

test("hippo: playlists strips .prg and turns underscores into spaces", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => jsonResponse(["demo_scene_2020.prg"]));
    const result = await hippo.browse("playlists");
    assert.deepEqual(result, [{ title: "demo scene 2020", url: "demo_scene_2020.prg", icon: "playlist" }]);
});

test("hippo: playlists is memoized", async () => {
    let calls = 0;
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => { calls++; return jsonResponse([]); });
    await hippo.browse("playlists");
    await hippo.browse("playlists");
    assert.equal(calls, 1);
});

test("hippo: an HTTP failure resolves playlists to an empty list rather than throwing", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => jsonResponse(undefined, false));
    assert.deepEqual(await hippo.browse("playlists"), []);
});

test("hippo: playlist/<name> passes the name through", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/hippo/foo.prg", () => jsonResponse({ some: "data" }));
    assert.deepEqual(await hippo.browse("playlist/foo.prg"), { some: "data" });
});

test("hippo: an unrecognized verb resolves to an empty list", async () => {
    assert.deepEqual(await hippo.browse("nonesuch"), []);
});

// --- bassoon.js / fetchModuleUrl -------------------------------------------

test("proxyUrl/isProxyUrl round-trip and isProxyUrl rejects an unrelated url", () => {
    const url = "https://example.com/song.mod";
    const proxied = proxyUrl(url);
    assert.equal(proxied, `https://www.stef.be/bassoontracker/api/proxy?${encodeURIComponent(url)}`);
    assert.equal(isProxyUrl(proxied), true);
    assert.equal(isProxyUrl(url), false);
});

test("fetchModuleUrl retries once through the proxy on a network-level failure", async () => {
    const target = "https://example.com/song.mod";
    const calls = [];
    globalThis.fetch = async url => {
        calls.push(url);
        if (url === target) throw new TypeError("Failed to fetch");
        return jsonResponse({ ok: true });
    };
    const response = await fetchModuleUrl(target);
    assert.deepEqual(calls, [target, proxyUrl(target)]);
    assert.equal(response.ok, true);
});

test("fetchModuleUrl does not retry a second time once already proxied", async () => {
    const target = proxyUrl("https://example.com/song.mod");
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new TypeError("Failed to fetch"); };
    await assert.rejects(() => fetchModuleUrl(target));
    assert.equal(calls, 1);
});

test("fetchModuleUrl does not retry an HTTP-level failure (a resolved, not-ok response)", async () => {
    const target = "https://example.com/song.mod";
    const calls = [];
    globalThis.fetch = async url => { calls.push(url); return jsonResponse(undefined, false); };
    const response = await fetchModuleUrl(target);
    assert.deepEqual(calls, [target], "no proxy retry - v1 never retries a bad status, only a network-level error");
    assert.equal(response.ok, false);
});
