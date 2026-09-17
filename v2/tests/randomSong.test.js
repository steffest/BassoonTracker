import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSilentContext } from "../domain/playback/silentContext.js";
import { createEngine, reset as resetPlayback } from "../domain/playback/index.js";
import { openRandomSong, openRandomSongXM } from "../domain/randomSong/index.js";

// Spec 063: the File menu's "Open Random MOD Song"/"Open Random XM Song",
// ported from script/src/ui/diskOperations.js#playRandomSong. Mirrors
// tests/diskOperations.test.js's own fake-fetch/fake-app convention - the
// real ModArchive API is never actually called.

const RANDOM_URL = "https://www.stef.be/bassoontracker/api/random";
const RANDOM_XM_URL = "https://www.stef.be/bassoontracker/api/randomxm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function jsonResponse(data, ok = true) {
    return { ok, json: async () => data };
}

function fakeApp() {
    return { audioContext: createSilentContext({ recordAutomation: true }) };
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

function wizballFixtureBytes() {
    return new Uint8Array(readFileSync(join(FIXTURES, "wizballalt.mod"))).buffer;
}

// --- RANDOM-001 -------------------------------------------------------------

test("openRandomSong: a well-formed envelope loads the returned module", async () => {
    responses.set(RANDOM_URL, () => jsonResponse({ modarchive: { module: { url: "https://example.com/wizball.mod" } } }));
    responses.set("https://example.com/wizball.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    const app = fakeApp();
    const result = await openRandomSong(app);
    assert.equal(result, true);
    assert.equal(Tracker.getSong().title.trim(), "wizball");
});

// --- RANDOM-002 -------------------------------------------------------------

test("openRandomSongXM: hits the XM-specific endpoint, not the plain one", async () => {
    responses.set(RANDOM_XM_URL, () => jsonResponse({ modarchive: { module: { url: "https://example.com/wizball.mod" } } }));
    responses.set("https://example.com/wizball.mod", () => ({ ok: true, arrayBuffer: async () => wizballFixtureBytes() }));

    const app = fakeApp();
    const result = await openRandomSongXM(app);
    assert.equal(result, true, "resolved through the XM route, not the plain /random one (which has no fake response set)");
});

// --- RANDOM-003: graceful degradation ---------------------------------------

test("a malformed envelope (missing modarchive/module/url) resolves to false, nothing loaded", async () => {
    for (const malformed of [{}, { modarchive: {} }, { modarchive: { module: {} } }]) {
        responses.set(RANDOM_URL, () => jsonResponse(malformed));
        const result = await openRandomSong(fakeApp());
        assert.equal(result, false);
    }
});

test("a non-OK response from the random-song endpoint resolves to false", async () => {
    responses.set(RANDOM_URL, () => jsonResponse(undefined, false));
    const result = await openRandomSong(fakeApp());
    assert.equal(result, false);
});

test("a rejected fetch (network failure) resolves to false, not a thrown rejection", async () => {
    responses.set(RANDOM_URL, () => { throw new Error("network down"); });
    const result = await openRandomSong(fakeApp());
    assert.equal(result, false);
});

test("a well-formed envelope whose own module URL 404s resolves to false", async () => {
    responses.set(RANDOM_URL, () => jsonResponse({ modarchive: { module: { url: "https://example.com/missing.mod" } } }));
    responses.set("https://example.com/missing.mod", () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
    const result = await openRandomSong(fakeApp());
    assert.equal(result, false);
});
