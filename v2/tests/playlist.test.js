import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, reset as resetPlayback } from "../domain/playback/index.js";
import * as playlist from "../domain/playlist/index.js";

// Spec 065: the Playlist domain model, continuing package P9. Ported from
// script/src/models/playlist.js (read in full) and the play-list.random
// capability from script/src/ui/diskOperations.js#generatePlayList. Mirrors
// tests/randomSong.test.js's own fake-fetch/fake-app convention for the
// navigation/openGeneratedPlaylist tests, and
// tests/moduleExport.test.js's/tests/sampleExport.test.js's own DOM-stub
// convention for exportPlaylist.

const GENERATE_URL = "https://www.stef.be/bassoontracker/api/generatelist";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function jsonResponse(data, ok = true) {
    return { ok, json: async () => data };
}

function fakeApp() {
    return { audioContext: createSilentContext({ recordAutomation: true }) };
}

function wizballFixtureBytes() {
    return new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
}

let Tracker;
let originalFetch;
let originalAudioContext;
let responses;

before(() => {
    const context = createSilentContext({ recordAutomation: true });
    ({ Tracker } = createEngine(context));
    originalAudioContext = globalThis.AudioContext;
    if (!globalThis.AudioContext) globalThis.AudioContext = class {};
});

beforeEach(() => {
    resetPlayback();
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

// --- ADVANCE-003: must run before any test below ever calls playTrack ------
//
// playListActive is a real, faithfully-ported v1 quirk: playTrack sets it
// and it is never unset (see spec 066's requirements.md). This is the only
// point in the whole file where it is still guaranteed to be at its
// pristine, never-armed default - every later test that calls playTrack
// leaves it true for the rest of this file's own run.

test("advanceOnSongEnd before any track has ever been played is a no-op", async () => {
    const result = await playlist.advanceOnSongEnd(fakeApp(), 0);
    assert.equal(result, false);
});

// --- PLAYLIST-001: set/get/parse -------------------------------------------

test("setPlaylist/getPlaylist hold the given playlist", () => {
    const data = { title: "Mine", modules: [{ title: "A", url: "https://example.com/a.mod" }] };
    playlist.setPlaylist(data);
    assert.deepEqual(playlist.getPlaylist(), data);
    assert.equal(playlist.getCurrentIndex(), 0);
});

test("parsePlaylist reads PLS File/Title pairs and skips unsupported urls", () => {
    const pls = [
        "[playlist]",
        "File1=https://example.com/track1.mod",
        "Title1=Track One",
        "File2=https://example.com/track2.png", // unsupported extension, skipped
        "NumberOfEntries=2",
        "Version=2"
    ].join("\n");
    const result = playlist.parsePlaylist(pls, "mine.pls");
    assert.equal(result.title, "mine.pls");
    assert.deepEqual(result.modules, [{ title: "Track One", url: "https://example.com/track1.mod" }]);
});

test("parsePlaylist reads M3U http lines, deriving a title from the url when none is given", () => {
    const m3u = ["#EXTM3U", "#EXTINF:-1,ignored", "https://example.com/some%20track.xm"].join("\n");
    const result = playlist.parsePlaylist(m3u, "mine.m3u");
    assert.deepEqual(result.modules, [{ title: "some track.xm", url: "https://example.com/some%20track.xm" }]);
});

// --- PLAYLIST-002: export round-trips through parse -------------------------

test("writePlaylist('pls') round-trips through parsePlaylist", () => {
    playlist.setPlaylist({ title: "Mine", modules: [
        { title: "Track One", url: "https://example.com/track1.mod" },
        { title: "Track Two", url: "https://example.com/track2.xm" }
    ] });
    const text = playlist.writePlaylist("pls");
    const reparsed = playlist.parsePlaylist(text, "roundtrip.pls");
    assert.deepEqual(reparsed.modules, [
        { title: "Track One", url: "https://example.com/track1.mod" },
        { title: "Track Two", url: "https://example.com/track2.xm" }
    ]);
});

test("writePlaylist('m3u') round-trips through parsePlaylist (v1's own M3U parser derives the title from the url, ignoring #EXTINF)", () => {
    playlist.setPlaylist({ title: "Mine", modules: [{ title: "Track One", url: "https://example.com/track1.mod" }] });
    const text = playlist.writePlaylist("m3u");
    assert.match(text, /^#EXTM3U/);
    const reparsed = playlist.parsePlaylist(text, "roundtrip.m3u");
    assert.deepEqual(reparsed.modules, [{ title: "track1.mod", url: "https://example.com/track1.mod" }]);
});

test("writePlaylist('json') round-trips through JSON.parse exactly", () => {
    const data = { title: "Mine", modules: [{ title: "Track One", url: "https://example.com/track1.mod" }] };
    playlist.setPlaylist(data);
    assert.deepEqual(JSON.parse(playlist.writePlaylist("json")), data);
});

test("writePlaylist defaults to PLS for an unrecognized format", () => {
    playlist.setPlaylist({ title: "Mine", modules: [{ title: "T", url: "https://example.com/t.mod" }] });
    assert.match(playlist.writePlaylist("nonsense"), /^\[playlist\]/);
});

test("writePlaylist/getPlaylistFileName with no playlist set", () => {
    playlist.setPlaylist(null);
    assert.equal(playlist.writePlaylist("pls"), null);
    assert.equal(playlist.getPlaylistFileName(), "playlist.pls");
});

// --- PLAYLIST-003: navigation -----------------------------------------------

function threeTrackPlaylist() {
    return {
        title: "Three Tracks",
        modules: [
            { title: "One", url: "https://example.com/one.mod" },
            { title: "Gap", url: null }, // no url - the skip-one-further-step branch
            { title: "Two", url: "https://example.com/two.mod" }
        ]
    };
}

test("playTrack loads the entry's module and updates the current index", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    const result = await playlist.playTrack(fakeApp(), 0);
    assert.equal(result, true);
    assert.equal(playlist.getCurrentIndex(), 0);
    assert.equal(Tracker.getSong().title.trim(), "wizball");
});

test("playTrack on an entry with no url resolves to false without loading anything", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    const result = await playlist.playTrack(fakeApp(), 1);
    assert.equal(result, false);
});

test("nextTrack skips a gap entry and wraps at the end", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));
    responses.set("https://example.com/two.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    await playlist.playTrack(fakeApp(), 0);
    assert.equal(await playlist.nextTrack(fakeApp()), true, "skips index 1 (no url), lands on index 2");
    assert.equal(playlist.getCurrentIndex(), 2);

    assert.equal(await playlist.nextTrack(fakeApp()), true, "wraps past the end, skips index 1 again, lands on index 0");
    assert.equal(playlist.getCurrentIndex(), 0);
});

test("previousTrack skips a gap entry and wraps at the start", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));
    responses.set("https://example.com/two.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    await playlist.playTrack(fakeApp(), 0);
    assert.equal(await playlist.previousTrack(fakeApp()), true, "wraps to index 2, skipping index 1's own gap the other direction is not needed here");
    assert.equal(playlist.getCurrentIndex(), 2);
});

test("nextTrack/previousTrack/playTrack with no playlist set resolve to false", async () => {
    playlist.setPlaylist(null);
    assert.equal(await playlist.nextTrack(fakeApp()), false);
    assert.equal(await playlist.previousTrack(fakeApp()), false);
    assert.equal(await playlist.playTrack(fakeApp(), 0), false);
});

test("a failed module load resolves playTrack to false rather than throwing", async () => {
    playlist.setPlaylist({ title: "T", modules: [{ title: "Missing", url: "https://example.com/missing.mod" }] });
    responses.set("https://example.com/missing.mod", () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
    assert.equal(await playlist.playTrack(fakeApp(), 0), false);
});

// --- ADVANCE-001/002: auto-advance on song end (spec 066) -------------------

test("playTrack arms auto-advance", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));
    responses.set("https://example.com/two.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));
    await playlist.playTrack(fakeApp(), 0);
    // Confirmed armed indirectly, through advanceOnSongEnd's own behavior
    // below (there is no direct getter - see requirements.md, matching v1's
    // own sticky, write-only flags).
    assert.equal(await playlist.advanceOnSongEnd(fakeApp(), 0), true, "auto-advance is armed once any track has ever been played");
});

test("advanceOnSongEnd stops, waits, then advances to the next playable track", async () => {
    playlist.setPlaylist(threeTrackPlaylist());
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));
    responses.set("https://example.com/two.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    await playlist.playTrack(fakeApp(), 0);
    const before_ = Date.now();
    const result = await playlist.advanceOnSongEnd(fakeApp(), 0.02); // 20ms buffer tail + the fixed 100ms settle
    const elapsed = Date.now() - before_;

    assert.equal(result, true, "landed on index 2, skipping index 1's own gap - the same nextTrack contract spec 065 already tests");
    assert.equal(playlist.getCurrentIndex(), 2);
    assert.ok(elapsed >= 120, `expected at least the 20ms delay + 100ms settle to elapse, got ${elapsed}ms`);
});

// --- toggleShuffle -----------------------------------------------------------

test("toggleShuffle flips state and recomputes a play order covering every index", () => {
    playlist.setPlaylist({ title: "T", modules: [
        { title: "A", url: "https://example.com/a.mod" },
        { title: "B", url: "https://example.com/b.mod" },
        { title: "C", url: "https://example.com/c.mod" }
    ] });
    assert.equal(playlist.isShuffleEnabled(), false);
    assert.equal(playlist.toggleShuffle(), true);
    assert.equal(playlist.isShuffleEnabled(), true);
    assert.equal(playlist.toggleShuffle(), false);
});

// --- PLAYLIST-004: play-list.random -----------------------------------------

test("openGeneratedPlaylist fetches, sets and plays index 0", async () => {
    responses.set(GENERATE_URL, () => jsonResponse({
        title: "Generated",
        modules: [{ title: "First", url: "https://example.com/one.mod" }]
    }));
    responses.set("https://example.com/one.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    const result = await playlist.openGeneratedPlaylist(fakeApp());
    assert.equal(result, true);
    assert.equal(playlist.getPlaylist().title, "Generated");
    assert.equal(playlist.getCurrentIndex(), 0);
    assert.equal(Tracker.getSong().title.trim(), "wizball");
});

test("openGeneratedPlaylist on a malformed response resolves to false, nothing set", async () => {
    responses.set(GENERATE_URL, () => jsonResponse({}));
    const before_ = playlist.getPlaylist();
    const result = await playlist.openGeneratedPlaylist(fakeApp());
    assert.equal(result, false);
    assert.equal(playlist.getPlaylist(), before_);
});

test("openGeneratedPlaylist on a non-OK response resolves to false", async () => {
    responses.set(GENERATE_URL, () => jsonResponse(undefined, false));
    assert.equal(await playlist.openGeneratedPlaylist(fakeApp()), false);
});

test("openGeneratedPlaylist on a rejected fetch resolves to false, not a thrown rejection", async () => {
    responses.set(GENERATE_URL, () => { throw new Error("network down"); });
    assert.equal(await playlist.openGeneratedPlaylist(fakeApp()), false);
});

// --- PLAYLIST-005: exportPlaylist -------------------------------------------

test("exportPlaylist downloads the right extension for each format", async () => {
    playlist.setPlaylist({ title: "My Playlist", modules: [{ title: "A", url: "https://example.com/a.mod" }] });

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        await playlist.exportPlaylist(app, "pls");
        await playlist.exportPlaylist(app, "m3u");
        await playlist.exportPlaylist(app, "json");
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 3);
    assert.ok(logs[0].detail.name.endsWith(".pls"));
    assert.ok(logs[1].detail.name.endsWith(".m3u"));
    assert.ok(logs[2].detail.name.endsWith(".json"));
    assert.equal(logs[0].detail.name, "my_playlist.pls");
    logs.forEach(entry => assert.equal(entry.command, "play-list.export"));
});

test("exportPlaylist no-ops with no playlist set", async () => {
    playlist.setPlaylist(null);
    await assert.doesNotReject(playlist.exportPlaylist({}, "pls"));
});

// --- setPlaylistExportFormat / exportPlaylistSelection (spec 067) ----------

test("exportPlaylistSelection dispatches to whatever format the radioGroup last selected", async () => {
    playlist.setPlaylist({ title: "My Playlist", modules: [{ title: "A", url: "https://example.com/a.mod" }] });

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        playlist.setPlaylistExportFormat(app, { value: "M3U" });
        await playlist.exportPlaylistSelection(app);
        playlist.setPlaylistExportFormat(app, { value: "JSON" });
        await playlist.exportPlaylistSelection(app);
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 2);
    assert.ok(logs[0].detail.name.endsWith(".m3u"));
    assert.ok(logs[1].detail.name.endsWith(".json"));
});

test("setPlaylistExportFormat defaults to pls for an unrecognized label", async () => {
    playlist.setPlaylist({ title: "My Playlist", modules: [{ title: "A", url: "https://example.com/a.mod" }] });

    const logs = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalDocument = globalThis.document;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};
    globalThis.document = { createElement: () => ({ click() {} }) };

    const app = { log: (command, detail) => logs.push({ command, detail }) };
    try {
        playlist.setPlaylistExportFormat(app, { value: "nonsense" });
        await playlist.exportPlaylistSelection(app);
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }

    assert.equal(logs.length, 1);
    assert.ok(logs[0].detail.name.endsWith(".pls"));
    assert.equal(logs[0].detail.format, "pls");
});

// --- parsePlaylistFile / openPlaylistUrl (spec 068) -------------------------

test("parsePlaylistFile('.json') returns the parsed object unchanged", () => {
    const data = { title: "Remote", modules: [{ title: "A", url: "https://example.com/a.mod" }] };
    assert.deepEqual(playlist.parsePlaylistFile(JSON.stringify(data), "list.json"), data);
});

test("parsePlaylistFile('.pls'/'.m3u') matches parsePlaylist's own output exactly", () => {
    const pls = "[playlist]\nFile1=https://example.com/a.mod\nTitle1=A\nNumberOfEntries=1\nVersion=2";
    assert.deepEqual(playlist.parsePlaylistFile(pls, "list.pls"), playlist.parsePlaylist(pls, "list.pls"));

    const m3u = "#EXTM3U\nhttps://example.com/a.mod";
    assert.deepEqual(playlist.parsePlaylistFile(m3u, "list.m3u"), playlist.parsePlaylist(m3u, "list.m3u"));
});

test("openPlaylistUrl fetches a real .json playlist and sets it as current", async () => {
    const data = { title: "Remote List", modules: [{ title: "A", url: "https://example.com/a.mod" }] };
    responses.set("https://example.com/remote.json", () => ({ ok: true, text: async () => JSON.stringify(data) }));

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/remote.json");
    assert.equal(result, true);
    assert.deepEqual(playlist.getPlaylist(), data);
});

test("openPlaylistUrl fetches a real .pls playlist and sets it as current", async () => {
    const pls = "[playlist]\nFile1=https://example.com/a.mod\nTitle1=A\nNumberOfEntries=1\nVersion=2";
    responses.set("https://example.com/remote.pls", () => ({ ok: true, text: async () => pls }));

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/remote.pls");
    assert.equal(result, true);
    assert.deepEqual(playlist.getPlaylist().modules, [{ title: "A", url: "https://example.com/a.mod" }]);
});

test("openPlaylistUrl on a non-OK response resolves to false, current playlist unchanged", async () => {
    playlist.setPlaylist({ title: "Before", modules: [] });
    responses.set("https://example.com/missing.json", () => ({ ok: false, text: async () => "" }));

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/missing.json");
    assert.equal(result, false);
    assert.equal(playlist.getPlaylist().title, "Before");
});

test("openPlaylistUrl on a rejected fetch (network failure, proxy retry also fails) resolves to false, not a thrown rejection", async () => {
    playlist.setPlaylist({ title: "Before", modules: [] });
    responses.set("https://example.com/down.json", () => { throw new Error("network down"); });
    // No proxy response registered either - fetchModuleUrl's own retry also fails, propagating the rejection.

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/down.json");
    assert.equal(result, false);
    assert.equal(playlist.getPlaylist().title, "Before");
});

test("openPlaylistUrl on malformed JSON resolves to false, current playlist unchanged", async () => {
    playlist.setPlaylist({ title: "Before", modules: [] });
    responses.set("https://example.com/broken.json", () => ({ ok: true, text: async () => "{not json" }));

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/broken.json");
    assert.equal(result, false);
    assert.equal(playlist.getPlaylist().title, "Before");
});

test("openPlaylistUrl on well-formed JSON with no modules array resolves to false, current playlist unchanged", async () => {
    playlist.setPlaylist({ title: "Before", modules: [] });
    responses.set("https://example.com/notaplaylist.json", () => ({ ok: true, text: async () => JSON.stringify({ hello: "world" }) }));

    const result = await playlist.openPlaylistUrl(fakeApp(), "https://example.com/notaplaylist.json");
    assert.equal(result, false);
    assert.equal(playlist.getPlaylist().title, "Before");
});
