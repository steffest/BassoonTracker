import { test } from "node:test";
import assert from "node:assert/strict";
import {
    SETTINGS_FIELDS,
    applyPersistedSettings,
    persistSetting,
    setVuBars,
    toggleHelpBubbles,
    setStereoSeparation,
    toggleShowKeyInput,
    toggleHighDpi,
    setDropboxMode,
    setMidiInput,
    toggleShowMidiInput,
    setPlayFrom,
    setEditorLayout,
    togglePiano
} from "../domain/settings/index.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";

function fakeApp() {
    const store = new Map();
    return { app: { state: { get: f => store.get(f), set: (f, v) => store.set(f, v) }, log: () => {} }, store };
}

test("applyPersistedSettings returns declared defaults for all twelve fields against a fresh store", () => {
    const initial = Object.fromEntries(Object.keys(SETTINGS_FIELDS).map(field => [field, "__unset__"]));
    const seeded = applyPersistedSettings(initial, createFakeStorage());
    for (const [field, [, fallback]] of Object.entries(SETTINGS_FIELDS)) {
        assert.equal(seeded[field], fallback, field);
    }
});

test("applyPersistedSettings leaves a field the application never declared untouched, and adds nothing new", () => {
    const initial = { "some.other.field": 42 };
    const seeded = applyPersistedSettings(initial, createFakeStorage());
    assert.deepEqual(seeded, { "some.other.field": 42 });
});

test("applyPersistedSettings only overrides fields already present on initial", () => {
    const storage = createFakeStorage();
    persistSetting("vu-bars.value", "Transparent", storage);
    const initial = { "vu-bars.value": "" }; // help-bubbles.active deliberately absent
    const seeded = applyPersistedSettings(initial, storage);
    assert.equal(seeded["vu-bars.value"], "Transparent");
    assert.ok(!("help-bubbles.active" in seeded));
});

test("corrupt JSON in the settings blob falls back to every declared default (SET-003)", () => {
    const storage = createFakeStorage({ bassoonTrackerSettings: "{not json" });
    const initial = Object.fromEntries(Object.keys(SETTINGS_FIELDS).map(field => [field, "__unset__"]));
    const seeded = applyPersistedSettings(initial, storage);
    for (const [field, [, fallback]] of Object.entries(SETTINGS_FIELDS)) {
        assert.equal(seeded[field], fallback, field);
    }
});

test("a missing settings blob falls back to every declared default", () => {
    const initial = Object.fromEntries(Object.keys(SETTINGS_FIELDS).map(field => [field, "__unset__"]));
    const seeded = applyPersistedSettings(initial, createFakeStorage());
    assert.equal(seeded["editor-layout.value"], "vertical");
});

// --- the eleven real capability functions (screen-refresh.set stays in
// domain/playback/index.js - see tests/playback.test.js) --------------------

test("setVuBars sets the field to detail.value and persists it", () => {
    const { app, store } = fakeApp();
    const storage = createFakeStorage();
    setVuBars(app, { value: "Transparent" }, storage);
    assert.equal(store.get("vu-bars.value"), "Transparent");
    const seeded = applyPersistedSettings({ "vu-bars.value": "" }, storage);
    assert.equal(seeded["vu-bars.value"], "Transparent", "a second read against the same storage sees the new value");
});

test("setVuBars holds the current value when no detail.value arrives", () => {
    const { app, store } = fakeApp();
    store.set("vu-bars.value", "Amiga");
    setVuBars(app, undefined, createFakeStorage());
    assert.equal(store.get("vu-bars.value"), "Amiga");
});

test("toggleHelpBubbles flips the current boolean with no detail.value, and persists", () => {
    const { app, store } = fakeApp();
    const storage = createFakeStorage();
    store.set("help-bubbles.active", true);
    toggleHelpBubbles(app, undefined, storage);
    assert.equal(store.get("help-bubbles.active"), false);
    toggleHelpBubbles(app, undefined, storage);
    assert.equal(store.get("help-bubbles.active"), true);
    const seeded = applyPersistedSettings({ "help-bubbles.active": "" }, storage);
    assert.equal(seeded["help-bubbles.active"], true);
});

test("toggleHelpBubbles honors an explicit detail.value over cycling", () => {
    const { app, store } = fakeApp();
    store.set("help-bubbles.active", true);
    toggleHelpBubbles(app, { value: true }, createFakeStorage());
    assert.equal(store.get("help-bubbles.active"), true);
});

test("every remaining toggle/set capability updates its field and round-trips through the same storage", () => {
    const cases = [
        [setStereoSeparation, "stereo-separation.value", { value: "Hard: Amiga" }],
        [toggleShowKeyInput, "show-key-input.active", undefined],
        [toggleHighDpi, "high-dpi.active", undefined],
        [setDropboxMode, "dropbox-mode.value", { value: "Overwrite" }],
        [setMidiInput, "midi-input.value", { value: "Enabled Note" }],
        [toggleShowMidiInput, "show-midi-input.active", undefined],
        [setPlayFrom, "play-from.value", { value: "Current pos" }],
        [setEditorLayout, "editor-layout.value", { value: "horizontal" }],
        [togglePiano, "piano.active", undefined]
    ];
    for (const [fn, field, detail] of cases) {
        const { app, store } = fakeApp();
        const storage = createFakeStorage();
        const result = fn(app, detail, storage);
        assert.equal(store.get(field), result, field);
        const seeded = applyPersistedSettings({ [field]: "__unset__" }, storage);
        assert.equal(seeded[field], result, `${field} persisted`);
    }
});
