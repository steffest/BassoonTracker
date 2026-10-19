// The settings capability (spec 033), opening package P9 of the port
// roadmap. Persists twelve user-preference fields as one JSON blob under
// the same localStorage key v1 used (`bassoonTrackerSettings`), through
// storage.js's tiny abstraction so this runs headless in plain Node.
//
// This is the only module anything outside `domain/settings/` may import
// for settings. One documented exception, the same shape domain/song/README.md
// already uses for its own: `domain/playback/index.js#setScreenRefresh`
// calls persistSetting() directly, rather than duplicating its own
// label-to-index translation here - see this folder's README.md.
//
// Value semantics deliberately diverge from v1's own internal codes (v1
// stores e.g. `vubars: "none"|"colour"|"trans"`; v2 stores the exact
// authored label text - "None"/"Amiga"/"Transparent" - that every
// already-authored radioGroup already dispatches as `detail.value`). See
// README.md and design.md for why: nothing in this repository ever reads
// this blob back as v1's own SETTINGS object.

import { createStorage } from "./storage.js";

const SETTINGS_KEY = "bassoonTrackerSettings";

// v2 state field -> [v1 settings key, default]. Twelve keys - see
// requirements.md's "What v1 actually does" for why not fourteen
// (frequency-table is live per-song engine state, not a setting;
// showSideBar/showAppPanel have no authored v2 control yet).
export const SETTINGS_FIELDS = {
    "vu-bars.value": ["vubars", "Amiga"],
    "help-bubbles.active": ["useTooltip", true],
    "stereo-separation.value": ["stereoSeparation", "Balanced"],
    "show-key-input.active": ["showKey", false],
    // Spec 098: v1's own default is 0 - `var skipRenderSteps = 0`
    // (script/src/ui/ui.js:39), which is the "Smooth" choice, and the
    // Options panel lights it on a fresh profile. 1 lit "Normal" instead.
    "screen-refresh.value": ["skipFrame", 0],
    "high-dpi.active": ["highDPI", false],
    "dropbox-mode.value": ["dropboxMode", "Rename"],
    "midi-input.value": ["midi", "Disabled"],
    "show-midi-input.active": ["showMidi", false],
    "play-from.value": ["playFrom", "Pattern start"],
    "editor-layout.value": ["patternViewMode", "vertical"],
    "piano.active": ["showPiano", false]
};

function readBlob(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(SETTINGS_KEY));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {}; // corrupt or missing - falls back to defaults (SET-003)
    }
}

function readField(field, storage) {
    const [key, fallback] = SETTINGS_FIELDS[field];
    const blob = readBlob(storage);
    return Object.prototype.hasOwnProperty.call(blob, key) ? blob[key] : fallback;
}

/** Writes one field into the shared blob, leaving every other key untouched. */
export function persistSetting(field, value, storage = createStorage()) {
    const entry = SETTINGS_FIELDS[field];
    if (!entry) return;
    const [key] = entry;
    const blob = readBlob(storage);
    blob[key] = value;
    storage.setItem(SETTINGS_KEY, JSON.stringify(blob));
}

/**
 * Called once, at store construction (runtime/appState.js). Returns a new
 * object: `initial` with every settings-backed field it already declares
 * overridden from storage. A field `initial` never declared is left alone,
 * matching domain/playback/index.js#publish's own "the store rejects a
 * field the application never declared" tolerance.
 */
export function applyPersistedSettings(initial, storage = createStorage()) {
    const seeded = { ...initial };
    for (const field of Object.keys(SETTINGS_FIELDS)) {
        if (Object.prototype.hasOwnProperty.call(seeded, field)) seeded[field] = readField(field, storage);
    }
    return seeded;
}

// `storage` is never passed by the generated action wrapper (it always
// calls `implementation(app, detail)`, exactly two arguments) - it exists
// so a test can inject a fake store and observe the round trip (SET-002).
function applyToggle(app, detail, field, command, storage) {
    const current = Boolean(app.state.get(field));
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    app.state.set(field, next);
    persistSetting(field, next, storage);
    if (app.log) app.log(command, { [field]: next });
    return next;
}

function applySet(app, detail, field, command, storage) {
    const next = detail && detail.value !== undefined ? detail.value : app.state.get(field);
    app.state.set(field, next);
    persistSetting(field, next, storage);
    if (app.log) app.log(command, { [field]: next });
    return next;
}

export function setVuBars(app, detail, storage) { return applySet(app, detail, "vu-bars.value", "vu-bars.set", storage); }
export function toggleHelpBubbles(app, detail, storage) { return applyToggle(app, detail, "help-bubbles.active", "help-bubbles.toggle", storage); }
export function setStereoSeparation(app, detail, storage) { return applySet(app, detail, "stereo-separation.value", "stereo-separation.set", storage); }
export function toggleShowKeyInput(app, detail, storage) { return applyToggle(app, detail, "show-key-input.active", "show-key-input.toggle", storage); }
export function toggleHighDpi(app, detail, storage) { return applyToggle(app, detail, "high-dpi.active", "high-dpi.toggle", storage); }
export function setDropboxMode(app, detail, storage) { return applySet(app, detail, "dropbox-mode.value", "dropbox-mode.set", storage); }
export function setMidiInput(app, detail, storage) { return applySet(app, detail, "midi-input.value", "midi-input.set", storage); }
export function toggleShowMidiInput(app, detail, storage) { return applyToggle(app, detail, "show-midi-input.active", "show-midi-input.toggle", storage); }
export function setPlayFrom(app, detail, storage) { return applySet(app, detail, "play-from.value", "play-from.set", storage); }
export function setEditorLayout(app, detail, storage) { return applySet(app, detail, "editor-layout.value", "editor-layout.set", storage); }
export function togglePiano(app, detail, storage) { return applyToggle(app, detail, "piano.active", "piano.toggle", storage); }
