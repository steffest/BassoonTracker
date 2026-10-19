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

import Tracker, { FTNotes } from "./engine/tracker.js";
import Audio from "./engine/audio.js";
import EventBus from "./engine/eventBus.js";
import { EVENT, SETTINGS, NOTEPERIOD } from "./engine/enum.js";
import { setDefaultOnMissedDeadline } from "./scheduler.js";
// Spec 060's own note-preview resolution reuses this directly - it is
// documented as a pure, dependency-free module (see its own header comment),
// so importing it here is not the boundary violation importing
// domain/song/index.js itself would be.
import { resolveNote } from "../song/keyboardNotes.js";
// Spec 033's one documented exception in this direction: setScreenRefresh
// already owns the label-to-index translation below, so persistence calls
// straight into domain/settings/ rather than that folder duplicating the
// translation table. See domain/settings/README.md.
import { persistSetting } from "../settings/index.js";
// Spec 034: loadModule's own fetch retries through the v2 API's CORS proxy
// on a network-level failure, ported from script/src/filesystem.js#loadFile.
// See domain/providers/README.md.
import { fetchModuleUrl } from "../providers/index.js";
// Spec 071: a second, narrow, one-purpose exception to this file's own
// "resolveNote, not domain/song/index.js itself" rule above - loadModule/
// openFiles are the only two places a *new* song document ever replaces the
// old one, and domain/song's own display state (current pattern/instrument,
// song length/repeat, the instrument and song/pattern row lists) has to
// resync then or never at all (nothing else calls into domain/song for this
// - confirmed empirically that domain/sampleEditor's own, older instrument
// fields have the identical unaddressed gap already). Read only for its own
// publishSongProperties() call below, not for editing - the boundary this
// file's own header still protects is "don't mutate the document from
// here," not "never read domain/song's own display-publish surface." Named
// songDomain, not song - loadModule/openFiles both already use `song` as a
// local variable for the document itself.
import * as songDomain from "../song/index.js";

/** State fields this capability publishes, when the application binds them. */
export const STATE_FIELDS = {
    status: "playback.status",
    title: "song.title",
    position: "playback.position",
    pattern: "playback.pattern",
    // Spec 032: "Screen refresh" (renderer frame-skip), not a playback
    // scalar - it lives in this capability's STATE_FIELDS anyway because
    // this module is the automatic half of its two writers (see
    // handleMissedDeadline below); splitting the manual half into a
    // different file would fragment one field's ownership for no benefit.
    screenRefresh: "screen-refresh.value",
    // Spec 050: which format loaded - the sample editor's own FT-only
    // fields (finetune/panning/fadeout/relative note/vibrato) need this to
    // drive their own `disabledWhen`. Lives here, not domain/sampleEditor
    // or domain/song, for the same reason getSampleRateForPeriod (spec 046)
    // does: it is playback/format state, not song-document or sample-edit
    // state.
    ftMode: "ft-mode.active",
    // Spec 071: tempo is scheduling state, not song-document state (the
    // same reasoning ftMode above already has) - lives here even though the
    // song-properties section's own BPM spinbox is what drives it.
    bpm: "song.bpm"
};

const DEMO_MODULE = "demo/wizballalt.mod";

// Spec 032, ported from script/src/ui/ui.js:54,597-618 - the "Screen
// refresh" options panel radio group's own four labels (optionsPanel.yaml's
// authored order), and the automatic-throttle cooldown/cap.
const SCREEN_REFRESH_LABELS = ["Smooth", "Normal", "Economical", "Low CPU"];
const MISSED_DEADLINE_COOLDOWN_MS = 2000;
const MAX_AUTO_SKIP = 4;

let context = null;
let engineReady = false;
let loadedUrl = null;
let loading = null;
let observing = null;   // the frame loop that samples the audio clock while playing
let lastPublished = {};
let lastThrottleEscalation = 0;
let trackAnalysers = []; // spec 052: one per track, lazily created/connected - see getTrackScopeData
let masterScopeAnalysers = null; // spec 054: {left, right}, lazily created/connected - see getMasterScopeData
let activeKeys = new Map(); // spec 060: piano key index -> played note handle, mirrors input.js's own keyDown[]
let lastPreviewAt = -Infinity; // spec 083: when previewNoteOn last fired - see wasNotePreviewedRecently

/**
 * Ported from ui.js:607-618 (`EVENT.clockEventExpired`): escalates the
 * shared frame-skip count on every missed deadline, unless one already did
 * within the cooldown - so the very first missed deadline always escalates
 * immediately (v1's own `prevEventExpired` starts at 0), and a burst of
 * them only ever throttles once per window.
 */
export function handleMissedDeadline(app, lateBy) {
    if (!app || !app.state) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastThrottleEscalation <= MISSED_DEADLINE_COOLDOWN_MS) return;
    lastThrottleEscalation = now;
    const current = Number(app.state.get(STATE_FIELDS.screenRefresh)) || 0;
    if (current >= MAX_AUTO_SKIP) return;
    app.state.set(STATE_FIELDS.screenRefresh, current + 1);
    if (app.log) app.log("playback.throttle", { lateBy, skip: current + 1 });
}

/**
 * The "Screen refresh" capability (replaces a mock that could not guess a
 * value set for a radioGroup's own label payload). The clicked item's own
 * position in SCREEN_REFRESH_LABELS *is* the skip count, exactly as v1's
 * `UI.skipFrame(index)` (optionsPanel.js:97-99) already uses the item's list
 * index directly. Spec 033: also persisted, through domain/settings/.
 */
export function setScreenRefresh(app, detail, settingsStorage) {
    const label = detail && detail.value;
    const index = SCREEN_REFRESH_LABELS.indexOf(label);
    const value = index >= 0 ? index : 0;
    if (app && app.state) app.state.set(STATE_FIELDS.screenRefresh, value);
    persistSetting(STATE_FIELDS.screenRefresh, value, settingsStorage);
    if (app && app.log) app.log("screen-refresh.set", { [STATE_FIELDS.screenRefresh]: value });
    return value;
}

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
    setDefaultOnMissedDeadline(lateBy => handleMissedDeadline(app, lateBy));
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

/** Spec 050: called alongside song.title, at the only two places anything in this port learns a new module has loaded. */
function publishFtMode(app) {
    publish(app, STATE_FIELDS.ftMode, Tracker.inFTMode());
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
    // Spec 081: resolving a *given* url against the page's own location
    // (rather than mediaUrl's own asset base, app.media) was a real,
    // previously-latent bug - it happened to work for every caller so far
    // only because every one of them passed either no url (the bundled demo,
    // below) or a full absolute https:// URL (an external host, whose own
    // scheme makes any base irrelevant per the URL spec) - never a bare
    // asset-relative path like a curated playlist's own "demomods/x.mod".
    // Surfaced live by spec 081's own default-populated Songs tab, whose
    // real curated data uses exactly that relative shape (v1's own real
    // playlists/demosongs.json, ported as-is) - clicking a row 404'd at
    // ".../app/demomods/..." instead of ".../assets/demomods/...".
    // mediaUrl is correct for both shapes: an absolute url passed as new
    // URL's own first argument ignores the base entirely, so nothing that
    // worked before regresses.
    const target = url ? mediaUrl(app, url) : mediaUrl(app, DEMO_MODULE);
    if (loadedUrl === target) return playbackState();
    if (loading) await loading.catch(() => {});
    loading = (async () => {
        const response = await fetchModuleUrl(target);
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
    publish(app, STATE_FIELDS.bpm, Tracker.getBPM());
    publishFtMode(app);
    publishStatus(app);
    songDomain.publishSongProperties(app);
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
    publish(app, STATE_FIELDS.bpm, Tracker.getBPM());
    publishFtMode(app);
    publishStatus(app);
    songDomain.publishSongProperties(app);
    if (app && app.log) app.log("playback.open", { name: file.name, bytes: file.size, ignored: list.length - 1 });
    return playbackState();
}

/** The song-properties section's own BPM spinbox. */
export function setBPM(app, detail) {
    const value = Math.round(Number(detail && detail.value));
    if (Number.isFinite(value)) Tracker.setBPM(value);
    publish(app, STATE_FIELDS.bpm, Tracker.getBPM());
}

/** The song-properties section's own mod-name inputbox - the write direction of the field loadModule/openFiles already publish (STATE_FIELDS.title). */
export function setSongTitle(app, detail) {
    const song = Tracker.getSong();
    if (!song) return;
    const value = String(detail && detail.value !== undefined ? detail.value : "");
    song.title = value;
    publish(app, STATE_FIELDS.title, value);
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

/**
 * Sets the ported engine's own `Tracker.autoPlay` flag (spec 065), a plain
 * property `engine/tracker.js` reads directly (330, 379, 362) - it does not
 * itself start playback; it only gates whether EVENT.songEnd is ever
 * triggered at all. Ported from script/src/models/playlist.js's own direct
 * `Tracker.autoPlay = true` assignments, exposed here since only
 * domain/playback/index.js may reach the engine.
 */
export function setAutoPlay(value) {
    Tracker.autoPlay = Boolean(value);
}

/**
 * Subscribes to the ported engine's own EVENT.songEnd (spec 065) - only
 * ever triggered while `Tracker.autoPlay` is set (see setAutoPlay above).
 * `handler` receives the same `delay` (seconds remaining in the current
 * buffer) v1's own script/src/models/playlist.js handler does.
 * @returns {() => void} an unsubscribe function
 */
export function onSongEnd(handler) {
    const index = EventBus.on(EVENT.songEnd, handler);
    return () => EventBus.off(EVENT.songEnd, index);
}

/**
 * Pure playback-engine math (engine/audio.js#getSampleRateForPeriod) - no
 * audioContext needed, safe to call anytime. Exposed here (spec 046) so
 * domain/sampleEditor/resample.js can compute a target playback rate
 * without importing domain/playback/engine/ directly.
 */
export function getSampleRateForPeriod(period) {
    return Audio.getSampleRateForPeriod(period);
}

/**
 * Four more small, additive forwards over existing engine math (spec 051),
 * the same one-line shape getSampleRateForPeriod above already is - so
 * domain/arrangement/index.js's own per-track block segmentation never
 * imports domain/playback/engine/ directly either.
 */
export function getFineTuneForNote(noteIndex, finetune) {
    return Audio.getFineTuneForNote(noteIndex, finetune);
}
export function getFineTuneForPeriod(period, finetune) {
    return Audio.getFineTuneForPeriod(period, finetune);
}
export function usesLinearFrequency() {
    return Tracker.useLinearFrequency;
}

/** A single FT note's own period, or null when out of range - domain/arrangement's own sample-length estimate needs the same existence guard multitrack.js#_getSampleLengthInSteps (770-780) has, without exposing the whole FTNotes table. */
export function getFtNotePeriod(noteIndex) {
    const note = FTNotes[noteIndex];
    return note ? note.period : null;
}
export function getTickTiming() {
    const props = Tracker.getProperties();
    return { ticksPerStep: props.ticksPerStep, tickTime: props.tickTime };
}
export function emulatesProtracker1OffsetBug() {
    return SETTINGS.emulateProtracker1OffsetBug;
}

/**
 * A parameterized port of engine/audio.js's own former inline
 * updateTrackVolumes() logic (v1's audio.js:182-201) - domain/arrangement is
 * the single owner of each track's mute/solo flag (spec 051), so this takes
 * the two flag arrays as parameters rather than the engine keeping its own,
 * now-redundant, second copy of the same bookkeeping.
 */
export function setTrackVolumes(muteFlags, soloFlags) {
    Audio.setTrackVolumes(muteFlags, soloFlags);
}

/**
 * Grows `trackAnalysers` to match the current track count, connecting any
 * new one to its own FilterChain's output - a parameterless, idempotent
 * mirror of `multitrack.js#_addAnalyser`/`_connectAnalysers` (327-346),
 * called on demand rather than reacting to EVENT.trackCountChange (spec 052,
 * the same "consolidate v1's own event-driven bookkeeping into a direct
 * call" choice spec 051 already made for mute/solo).
 */
function ensureTrackAnalysers() {
    if (!Audio.context) return;
    const count = Tracker.getTrackCount();
    while (trackAnalysers.length < count) {
        const analyser = Audio.context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0;
        const idx = trackAnalysers.length;
        trackAnalysers.push(analyser);
        if (Audio.filterChains && Audio.filterChains[idx]) {
            try { Audio.filterChains[idx].output().connect(analyser); } catch (e) {}
        }
    }
}

/**
 * Live time-domain samples for one track's own audio (spec 052) - the
 * mechanism the plain live oscilloscope needs. `target` is filled in place
 * and returned; `null` when there is no audio context yet or `track` is out
 * of range.
 */
export function getTrackScopeData(track, target) {
    ensureTrackAnalysers();
    const analyser = trackAnalysers[track];
    if (!analyser) return null;
    // v1's Visualiser sets its analyser FFT size to the requested scope
    // sample count on every draw. The dedicated scopes strip uses 512
    // samples while multitrack thumbnails use 256, so the shared analyser
    // follows the caller's target rather than forcing both surfaces to one
    // density.
    if (target?.length >= 32 && target.length <= 32768 && (target.length & (target.length - 1)) === 0 && analyser.fftSize !== target.length) {
        analyser.fftSize = target.length;
    }
    analyser.getByteTimeDomainData(target);
    return target;
}

/**
 * The mix's own final stereo output (spec 054) - taps `Audio.cutOffVolume`,
 * the same real node v1's own menu.js#vumeter.connect does, not any
 * per-track signal (see getTrackScopeData above for that). Lazily connects
 * a ChannelSplitter(2) and two analysers once; every call after just
 * refills the two targets.
 */
function ensureMasterScopeAnalysers() {
    if (masterScopeAnalysers || !Audio.context || !Audio.cutOffVolume) return;
    const splitter = Audio.context.createChannelSplitter(2);
    Audio.cutOffVolume.connect(splitter);
    const left = Audio.context.createAnalyser();
    const right = Audio.context.createAnalyser();
    left.fftSize = right.fftSize = 32;
    left.smoothingTimeConstant = right.smoothingTimeConstant = 0.85;
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    masterScopeAnalysers = { left, right };
}

export function getMasterScopeData(leftTarget, rightTarget) {
    ensureMasterScopeAnalysers();
    if (!masterScopeAnalysers) return null;
    masterScopeAnalysers.left.getByteTimeDomainData(leftTarget);
    masterScopeAnalysers.right.getByteTimeDomainData(rightTarget);
    return { left: leftTarget, right: rightTarget };
}

/**
 * Live audio note preview (spec 060), for the piano - ported from the
 * playback slice of script/src/ui/input.js#handleNoteOn (734-883); the
 * record-into-pattern slice of that same function is a separate concern
 * this does not cover (see requirements.md's Decisions). `index` is the
 * piano's own already-octave-combined key index (runtime/pianoController.js,
 * spec 061) - `resolveNote`'s own `octave` parameter is passed 0 here
 * because that combined index is already in `resolveNote`'s internal
 * "index" space (`index = octave*12 + offset`; octave 0 makes index ===
 * offset, reproducing the same math with no double-count). A no-op,
 * returning `false`, for an already-sounding key, an unresolvable note, or
 * no current instrument - matches `keyDown[index]` already truthy, an
 * unmapped note, or `!instrument` in v1.
 *
 * `app` is optional and forwarded only to `ensureEngine` (see that
 * function): a real caller (the piano's own controller) never has one to
 * give, the same as every other controller-invoked domain call in this
 * port, and does not need to - `ensureEngine(undefined)` still lazily
 * creates a real `AudioContext` on first use. Tests supply a fake `app`
 * carrying a silent context, the same shape `loadModule`'s own tests
 * already use.
 */
export function previewNoteOn(index, app) {
    if (activeKeys.has(index)) return false;
    ensureEngine(app);
    const note = resolveNote(index, 0, Tracker.inFTMode(), { notePeriod: NOTEPERIOD, ftNotes: FTNotes });
    if (!note) return false;
    const instrument = Tracker.getCurrentInstrument();
    if (!instrument) return false;
    if (note.index) {
        instrument.setSampleForNoteIndex(note.index);
        if (instrument.sample.relativeNote) {
            note.index += instrument.sample.relativeNote;
            const ftNote = FTNotes[note.index];
            if (ftNote) note.period = ftNote.period;
        }
    }
    lastPreviewAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    Audio.checkState();
    const played = instrument.play(note.index, note.period, undefined, undefined, undefined);
    played.instrument = instrument;
    played.isKey = true; // instrument.noteOff's own non-FT branch silently no-ops without this - instrument.js:123
    activeKeys.set(index, played);
    return true;
}

/**
 * The top menu bar's own "Key" notification light (spec 083) polls this
 * instead of v1's own real `flash()` (script/src/ui/app/menu.js:168-174,
 * a setTimeout that flips a boolean back off after 100ms) - an edge-
 * triggered "was a note previewed within the last `windowMs`" check needs
 * no timer of its own to leak or cancel, and holding a note (or a fast
 * chord) keeps the light lit continuously the same way v1's own
 * `clearTimeout`-and-reschedule does, for the same reason: each new
 * `previewNoteOn` call simply moves `lastPreviewAt` forward again.
 */
export function wasNotePreviewedRecently(windowMs = 100) {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    return now - lastPreviewAt < windowMs;
}

/**
 * Silences a preview started by previewNoteOn - ported from the playback
 * slice of handleNoteOff (887-899). v1's own sustain toggle
 * (SETTINGS.sustainKeyboardNotes) is not modeled: its own v1 default is
 * false and it was never exposed as a user-facing option either (see
 * requirements.md). Returns whether a sounding key was actually found.
 */
export function previewNoteOff(index) {
    const played = activeKeys.get(index);
    if (played) {
        try {
            if (played.instrument) played.instrument.noteOff(context.currentTime, played);
            else if (played.source) played.source.stop();
        } catch {
            /* matches handleNoteOff's own empty catch */
        }
    }
    activeKeys.delete(index);
    return Boolean(played);
}

/** For the piano leaf's own key-highlight rendering (spec 061). */
export function isPreviewNoteActive(index) {
    return activeKeys.has(index);
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
    lastThrottleEscalation = 0;
    trackAnalysers = [];
    masterScopeAnalysers = null;
    lastPreviewAt = -Infinity;
}
