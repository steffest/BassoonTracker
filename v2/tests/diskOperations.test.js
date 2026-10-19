import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, reset as resetPlayback } from "../domain/playback/index.js";
import { setDiskAction, setDiskType, setDiskTarget, setBrowserRow, reset as resetDiskOperations } from "../domain/diskOperations/index.js";
import { getPlaylist, setPlaylist } from "../domain/playlist/index.js";
import { reset as resetHippo } from "../domain/providers/hippo.js";

// Spec 036: the disk-operation screen's own capability, wiring
// fileOperationsPanel.yaml's target radioGroup and fileBrowser (spec 035) to
// a curated local snapshot ("Bassoon") and the two remote catalog browsers
// spec 034 already built.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const MEDIA_BASE = new URL("http://fake.test/assets/");

let Tracker;
let originalFetch;
let originalAudioContext;
let responses;

function jsonResponse(data, ok = true) {
    return { ok, json: async () => data };
}

function fakeApp() {
    const store = new Map();
    return {
        app: {
            state: { get: f => store.get(f), set: (f, v) => store.set(f, v) },
            log: () => {},
            media: MEDIA_BASE,
            audioContext: null // set per-test from the shared silent context
        },
        store
    };
}

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
    originalAudioContext = globalThis.AudioContext;
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
});

beforeEach(() => {
    resetDiskOperations();
    resetPlayback();
    resetHippo();
    setPlaylist(null);
    originalFetch = globalThis.fetch;
    responses = new Map();
    globalThis.fetch = async url => {
        const make = responses.get(url);
        if (!make) throw new Error(`unexpected fetch: ${url}`);
        return make();
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("setDiskTarget(Bassoon) fetches the local snapshot and publishes it as flat, level-0 rows", async () => {
    responses.set("http://fake.test/assets/data/modules.json", () => jsonResponse({
        modules: [{ title: "Wizball", url: "demo/wizballalt.mod", icon: "mod", info: "x" }]
    }));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Bassoon" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), [
        { title: "Wizball", icon: "mod", info: "x", level: 0, hasChildren: false }
    ]);
    assert.equal(store.get("disk-target.value"), "Bassoon");
});

test("setDiskTarget(Bassoon) tolerates a failed fetch by publishing an empty list", async () => {
    responses.set("http://fake.test/assets/data/modules.json", () => jsonResponse(undefined, false));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Bassoon" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), []);
});

test("setDiskTarget(ModArchive) publishes the four fixed root items as unloaded branches", async () => {
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "ModArchive" });
    const rows = store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser");
    assert.equal(rows.length, 4);
    assert.ok(rows.every(r => r.hasChildren === true && r.level === 0));
    assert.deepEqual(rows.map(r => r.title), ["Browse by artist", "Browse by genre", "Top rated in comments", "Top rated in reviews"]);
});

test("an unavailable external target publishes an empty browser while retaining the authored choice", async () => {
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Dropbox" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), []);
    assert.equal(store.get("disk-target.value"), "Dropbox");
});

test("action and type selections publish the exact selector state and reset their reachable target", async () => {
    responses.set("http://fake.test/assets/data/modules.json", () => jsonResponse({ modules: [] }));
    responses.set("http://fake.test/assets/data/playlists.json", () => jsonResponse({ modules: [] }));
    const { app, store } = fakeApp();
    store.set("disk-type.value", "Module");

    await setDiskAction(app, { value: "Save" });
    assert.equal(store.get("disk-action.value"), "Save");
    assert.equal(store.get("disk-target.value"), "local");

    await setDiskAction(app, { value: "Load" });
    await setDiskType(app, { value: "Playlist" });
    assert.equal(store.get("disk-type.value"), "Playlist");
    assert.equal(store.get("disk-target.value"), "Bassoon");
});

test("clicking a branch row expands it, lazily fetching its children exactly once", async () => {
    let calls = 0;
    responses.set("https://www.stef.be/bassoontracker/api/ma/artists", () => {
        calls++;
        return jsonResponse([{ id: 1, handle: "4mat", count: 3 }]);
    });
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "ModArchive" });

    await setBrowserRow(app, { value: 0 }); // "Browse by artist"
    let rows = store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser");
    assert.equal(rows.length, 5, "the branch plus its one child are now both shown");
    assert.deepEqual(rows[1], { title: "4mat", icon: undefined, info: "3 >", level: 1, hasChildren: true });
    assert.equal(calls, 1);

    // collapsing and re-expanding does not fetch again
    await setBrowserRow(app, { value: 0 });
    rows = store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser");
    assert.equal(rows.length, 4, "collapsed back to just the four roots");
    await setBrowserRow(app, { value: 0 });
    assert.equal(calls, 1, "the child list is cached on the tree node, not re-fetched");
});

test("a branch that resolves to no results still shows a placeholder row rather than nothing", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/mpl/genres", () => jsonResponse([]));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Modules.pl" });
    await setBrowserRow(app, { value: 1 }); // "Browse by genre"
    const rows = store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser");
    assert.equal(rows[2].title, "(no results)");
});

test("clicking a leaf row loads it as the current module", async () => {
    const fixtureBytes = new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
    responses.set("http://fake.test/assets/data/modules.json", () => jsonResponse({
        modules: [{ title: "Wizball", url: "demo/wizballalt.mod", icon: "mod" }]
    }));
    responses.set("http://fake.test/assets/demo/wizballalt.mod", () => ({ ok: true, arrayBuffer: async () => fixtureBytes }));

    const { app } = fakeApp();
    app.audioContext = createSilentContext({ recordAutomation: true });
    await setDiskTarget(app, { value: "Bassoon" });
    await setBrowserRow(app, { value: 0 });
    assert.equal(Tracker.getSong().title.trim(), "wizball");
});

test("an out-of-range row index is a no-op", async () => {
    const { app } = fakeApp();
    await setDiskTarget(app, { value: "ModArchive" });
    await assert.doesNotReject(() => setBrowserRow(app, { value: 99 }));
});

// --- spec 069: "Playlists" and "Hippo" targets ------------------------------

test("setDiskTarget(Playlists) fetches the local curated snapshot and publishes it as flat, level-0 rows", async () => {
    responses.set("http://fake.test/assets/data/playlists.json", () => jsonResponse({
        modules: [{ title: "DemoScene 2026", url: "data/playlists/demoscene2026.json", info: "77 tracks" }]
    }));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Playlists" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), [
        { title: "DemoScene 2026", icon: undefined, info: "77 tracks", level: 0, hasChildren: false }
    ]);
    assert.equal(store.get("disk-target.value"), "Playlists");
});

test("setDiskTarget(Playlists) tolerates a failed fetch by publishing an empty list", async () => {
    responses.set("http://fake.test/assets/data/playlists.json", () => jsonResponse(undefined, false));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Playlists" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), []);
});

test("clicking a Playlists leaf row fetches and sets it as the current playlist", async () => {
    const playlistData = { title: "DemoScene 2026", modules: [{ title: "A", url: "https://example.com/a.mod" }] };
    responses.set("http://fake.test/assets/data/playlists.json", () => jsonResponse({
        modules: [{ title: "DemoScene 2026", url: "data/playlists/demoscene2026.json" }]
    }));
    responses.set("http://fake.test/assets/data/playlists/demoscene2026.json", () => ({ ok: true, text: async () => JSON.stringify(playlistData) }));

    const { app } = fakeApp();
    await setDiskTarget(app, { value: "Playlists" });
    await setBrowserRow(app, { value: 0 });
    assert.deepEqual(getPlaylist(), playlistData);
});

test("setDiskTarget(Hippo) fetches the API's own playlist listing and publishes it as flat, level-0 rows", async () => {
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => jsonResponse(["demoscene_2026.prg", "chippies.prg"]));
    const { app, store } = fakeApp();
    await setDiskTarget(app, { value: "Hippo" });
    assert.deepEqual(store.get("rows.main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser"), [
        { title: "demoscene 2026", icon: "playlist", info: undefined, level: 0, hasChildren: false },
        { title: "chippies", icon: "playlist", info: undefined, level: 0, hasChildren: false }
    ]);
    assert.equal(store.get("disk-target.value"), "Hippo");
});

test("clicking a Hippo leaf row fetches and sets it as the current playlist", async () => {
    const playlistData = { title: "Chippies", modules: [{ title: "A", url: "https://example.com/a.mod" }] };
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => jsonResponse(["chippies.prg"]));
    responses.set("https://www.stef.be/bassoontracker/api/hippo/chippies.prg", () => jsonResponse(playlistData));

    const { app } = fakeApp();
    await setDiskTarget(app, { value: "Hippo" });
    await setBrowserRow(app, { value: 0 });
    assert.deepEqual(getPlaylist(), playlistData);
});

test("clicking a Hippo leaf row that fails to fetch does not change the current playlist", async () => {
    setPlaylist({ title: "Before", modules: [] });
    responses.set("https://www.stef.be/bassoontracker/api/hippo/", () => jsonResponse(["chippies.prg"]));
    responses.set("https://www.stef.be/bassoontracker/api/hippo/chippies.prg", () => jsonResponse(undefined, false));

    const { app } = fakeApp();
    await setDiskTarget(app, { value: "Hippo" });
    await setBrowserRow(app, { value: 0 });
    assert.equal(getPlaylist().title, "Before");
});
