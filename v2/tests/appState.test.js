import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppState } from "../runtime/appState.js";
import { persistSetting } from "../domain/settings/index.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";

// SET-001: a settings-backed field holds its saved value at construction
// time, synchronously, with nothing to await - the seam that removes the
// fifty-millisecond race v1 needed (see domain/settings/README.md and
// runtime/appState.js's own header comment).

test("createAppState seeds a settings-backed field from persisted storage before returning", () => {
    const settingsStorage = createFakeStorage();
    persistSetting("piano.active", true, settingsStorage);
    persistSetting("editor-layout.value", "horizontal", settingsStorage);

    const state = createAppState({ "piano.active": false, "editor-layout.value": "vertical", "unrelated.field": 1 }, { settingsStorage });

    assert.equal(state.get("piano.active"), true);
    assert.equal(state.get("editor-layout.value"), "horizontal");
    assert.equal(state.get("unrelated.field"), 1, "a field settings knows nothing about is unaffected");
});

test("createAppState falls back to domain/settings' own declared default (not the compiler's placeholder) when nothing is persisted", () => {
    const state = createAppState({ "editor-layout.value": "" }, { settingsStorage: createFakeStorage() });
    assert.equal(state.get("editor-layout.value"), "vertical");
});

test("createAppState with no options still works (the generated app's own call shape)", () => {
    const state = createAppState({ "some.field": "x" });
    assert.equal(state.get("some.field"), "x");
});
