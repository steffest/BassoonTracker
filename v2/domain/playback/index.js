// The playback capability (spec 012), package P2 of the port roadmap.
//
// This is the only module anything outside `domain/playback/` may import.
// Everything under `engine/` is the adapted v1 sequencer and keeps its own
// shape: module-private singletons, its own small event bus, a mutable
// settings object. None of that crosses this boundary. What crosses is a
// handful of functions and a handful of scalars.
//
// Wired in through `v2/capabilities.js`, so the generated application's
// `transport.toggle` action delegates here instead of toggling a mock field.
// The authoring preview keeps the mock on purpose: opening the workbench
// should not start an audio device.

import Tracker from "./engine/tracker.js";
import Audio from "./engine/audio.js";
import EventBus from "./engine/eventBus.js";
import { EVENT } from "./engine/enum.js";

/** State fields this capability publishes, when the application binds them. */
export const STATE_FIELDS = {
    status: "playback.status",
    title: "song.title",
    position: "playback.position",
    pattern: "playback.pattern"
};

const DEMO_MODULE = "demo/wizballalt.mod";

let context = null;
let engineReady = false;
let loadedUrl = null;
let loading = null;
let observing = null;   // the frame loop that samples the audio clock while playing
let lastPublished = {};

/**
 * Creates the audio context on first use. Every entry point here is reached
 * from a user gesture (a click or a key), which is what browsers require and
 * what the engine's original import-time context could not honour.
 */
function ensureEngine(app) {
    if (engineReady) return context;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) throw new Error("playback: this browser has no Web Audio");
    context = app && app.audioContext ? app.audioContext : new Ctor();
    Tracker.init();
    Audio.init(context);
    engineReady = true;
    return context;
}

function mediaUrl(app, path) {
    const base = app && app.media ? app.media : new URL("../../assets/", import.meta.url);
    return new URL(path, base).href;
}

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    if (lastPublished[field] === value) return;
    lastPublished[field] = value;
    // The store rejects a field the application never declared, which is the
    // normal case for anything the current YAML does not bind.
    try {
        app.state.set(field, value);
    } catch {
        /* not bound by this application */
    }
}

function publishStatus(app) {
    publish(app, STATE_FIELDS.status, Tracker.isPlaying() ? "playing" : "stopped");
}

/**
 * Samples the engine's timestamped state ring against the audio clock, the
 * way v1's frame loop does, and publishes only what changed. Audio scheduling
 * never goes through here: this reads, it does not drive.
 */
function startObserving(app) {
    if (observing || typeof requestAnimationFrame !== "function") return;
    const step = () => {
        if (!Tracker.isPlaying()) {
            observing = null;
            publishStatus(app);
            return;
        }
        const state = Tracker.getStateAtTime(context.currentTime + 0.01);
        if (state) {
            // Tell the engine where playback has reached, exactly as v1's frame
            // loop does: the sequencer schedules ahead of the clock and records
            // timestamped states, and whoever draws decides which one is now.
            // Without this the engine's own position cursor never moves and
            // anything reading it (the future pattern grid) would sit at row 0.
            if (state.patternPos !== Tracker.getCurrentPatternPos()) Tracker.setCurrentPatternPos(state.patternPos);
            if (state.songPos !== Tracker.getCurrentSongPosition()) Tracker.setCurrentSongPosition(state.songPos);
            publish(app, STATE_FIELDS.position, state.songPos);
            publish(app, STATE_FIELDS.pattern, state.patternPos);
        }
        observing = requestAnimationFrame(step);
    };
    observing = requestAnimationFrame(step);
}

/**
 * Loads a module without playing it.
 * @param {object} app the app context: `{ state, feature, log, media? }`
 * @param {string} [url] defaults to the bundled demo module
 */
export async function loadModule(app, url) {
    ensureEngine(app);
    const target = url ? new URL(url, globalThis.location ? globalThis.location.href : undefined).href : mediaUrl(app, DEMO_MODULE);
    if (loadedUrl === target) return playbackState();
    if (loading) await loading.catch(() => {});
    loading = (async () => {
        const response = await fetch(target);
        if (!response.ok) throw new Error(`playback: cannot load ${target} (${response.status})`);
        const data = await response.arrayBuffer();
        await Tracker.processFile(data, target.split("/").pop());
        loadedUrl = target;
    })();
    try {
        await loading;
    } finally {
        loading = null;
    }
    const song = Tracker.getSong();
    publish(app, STATE_FIELDS.title, (song && song.title ? song.title.trim() : "") || "untitled");
    publishStatus(app);
    if (app && app.log) app.log("playback.load", { url: target, title: Tracker.getSong().title });
    return playbackState();
}

/**
 * The command `transport.toggle` resolves to. Loads the initial module the
 * first time, then starts or stops.
 */
/**
 * Loads a module the user dropped on the application (spec 014 INT-008).
 * Reads the *first* file, because a tracker plays one song at a time; the
 * rest are reported so a future playlist can pick them up.
 *
 * This is a reserved host command (`host.openFiles` in capabilities.js), not
 * one the YAML compiles to: the renderer offers the hook, the manifest says
 * who takes it.
 *
 * @param {object} app the generated application context
 * @param {File[]} files what was dropped
 */
export async function openFiles(app, files) {
    const list = [...(files || [])];
    if (list.length === 0) return playbackState();
    const file = list[0];
    ensureEngine(app);
    const data = await file.arrayBuffer();
    await Tracker.processFile(data, file.name);
    loadedUrl = `dropped:${file.name}`;
    const song = Tracker.getSong();
    publish(app, STATE_FIELDS.title, (song && song.title ? song.title.trim() : "") || file.name);
    publishStatus(app);
    if (app && app.log) app.log("playback.open", { name: file.name, bytes: file.size, ignored: list.length - 1 });
    return playbackState();
}

export async function transportToggle(app) {
    ensureEngine(app);
    Audio.checkState();
    if (!loadedUrl) await loadModule(app);
    Tracker.togglePlay();
    publishStatus(app);
    if (Tracker.isPlaying()) startObserving(app);
    if (app && app.log) app.log("transport.toggle", { [STATE_FIELDS.status]: Tracker.isPlaying() ? "playing" : "stopped" });
    return playbackState();
}

/** Stops without toggling, for a host that wants an explicit stop. */
export async function transportStop(app) {
    if (!engineReady) return playbackState();
    Tracker.stop();
    publishStatus(app);
    return playbackState();
}

/** A snapshot for a caller that wants to read rather than subscribe. */
export function playbackState() {
    if (!engineReady) return { status: "stopped", title: null, position: 0, pattern: 0, loaded: null };
    const song = Tracker.getSong();
    return {
        status: Tracker.isPlaying() ? "playing" : "stopped",
        title: song && song.title ? song.title.trim() : null,
        position: Tracker.getCurrentSongPosition(),
        pattern: Tracker.getCurrentPatternPos(),
        tracks: Tracker.getTrackCount(),
        loaded: loadedUrl
    };
}

/**
 * Test and harness entry point: runs the engine against a caller-supplied
 * context (a real one, an OfflineAudioContext, or the stub in
 * ./silentContext.js) without touching the module-level singletons above.
 */
export function createEngine(audioContext) {
    Tracker.init();
    Audio.init(audioContext);
    return { Tracker, Audio, EventBus, EVENT };
}

/** Resets the capability's own state. Used by tests; not part of the app path. */
export function reset() {
    if (observing && typeof cancelAnimationFrame === "function") cancelAnimationFrame(observing);
    observing = null;
    loadedUrl = null;
    loading = null;
    lastPublished = {};
    engineReady = false;
    context = null;
}
