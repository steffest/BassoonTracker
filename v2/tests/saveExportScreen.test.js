import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 067: the save/export screen. Gives specs 037/064/065's own real
// capabilities (exportModule/exportSample/exportPlaylist) their first UI
// entry point, inside fileOperationsPanel.yaml's existing "File Operations"
// panel behind a new Load/Save toggle. Verified with computeGenericLayout()
// directly against the real, live app.yaml (no Playwright in this
// environment), the same convention specs 048/059/062 already established.

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function readSource(relPath) {
    try { return readFileSync(join(CURRENT, relPath), "utf8"); } catch { return null; }
}

const compiled = compileApplication("app.yaml", readSource);

function measure() {
    return { width: 40, height: 20 };
}

// fileOperationsPanel lives inside songProperties (spec 048, re-scoped by
// spec 070's own UI-alignment pass, step 6), itself gated on
// song-properties-view.value being "File Operations" - the same real,
// section-scoped field Options/Nibbles share (they all sit in the one slot
// v1's own appMainPanel.js owns). disk-action.value/save-type.value are pure
// mocked UI state (no seed value published anywhere real, matching
// pattern-view.value's own precedent) - "" is what an unset field reads as
// in the real, running application, so tests exercising the *default* view
// supply it explicitly here rather than leaving it "undefined" (a string
// oneOf never matches).
function layoutWith(fields) {
    const withDefaults = { "disk-action.value": "", "save-type.value": "", ...fields };
    return computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => (field in withDefaults ? withDefaults[field] : undefined)
    });
}

// Spec 070's own UI-alignment pass (step 8) restructured this panel's own
// row-stacked shape into v1's real column layout (script/src/ui/
// diskOperations.js's own Action/Type/From columns plus a wide Label+
// Listbox column) - reusing the exact same fields/commands, just
// rearranged. The "From" target list and the "Save" type list now share
// one column slot (targetColumn), mutually exclusive on disk-action.value,
// matching how v1's own "From"/"To" label swaps in the identical column
// (diskOp_Targets.js) rather than being two unrelated regions.
const PANEL = "main.normalMainView.songProperties.fileOperationsPanel";
const GRID = `${PANEL}.diskOperationsGrid`;
const LOAD_CONTENT = `${GRID}.contentColumn.loadContent`;
const LOAD_LABEL = `${LOAD_CONTENT}.label.Load module:`;
const TARGET_GROUP = `${GRID}.targetColumn.targetGroup`;
const BROWSER = `${LOAD_CONTENT}.browser`;
const SAVE_VIEW = `${GRID}.contentColumn.saveContent`;
const SAVE_TYPE_GROUP = `${GRID}.targetColumn.saveTypeGroup`;
const SAVE_MODULE_PANEL = `${SAVE_VIEW}.saveModulePanel`;
const SAVE_SAMPLE_PANEL = `${SAVE_VIEW}.saveSamplePanel`;
const SAVE_PLAYLIST_PANEL = `${SAVE_VIEW}.savePlaylistPanel`;

test("compiles without a hard failure", () => {
    assert.equal(compiled.hardFailure, false);
});

test("song-properties-view.value not File Operations: the whole panel, load and save alike, is absent", () => {
    const { rects } = layoutWith({ "song-properties-view.value": "Options" });
    for (const id of [PANEL, LOAD_LABEL, TARGET_GROUP, BROWSER, SAVE_VIEW]) {
        assert.equal(rects.get(id), undefined, id);
    }
});

test("File Operations, disk-action unset (the real app's own seeded default): the load view shows, the save view does not", () => {
    const { rects } = layoutWith({ "song-properties-view.value": "File Operations" });
    for (const id of [PANEL, LOAD_LABEL, TARGET_GROUP, BROWSER]) {
        assert.ok(rects.get(id), `${id} present`);
    }
    assert.equal(rects.get(SAVE_VIEW), undefined);
    assert.equal(rects.get(SAVE_TYPE_GROUP), undefined, "the save-side type column is not shown while loading");
});

test("disk-action.value Save: the save view shows (default save-type: Module), the load view does not", () => {
    const { rects } = layoutWith({ "song-properties-view.value": "File Operations", "disk-action.value": "Save" });
    for (const id of [SAVE_VIEW, SAVE_TYPE_GROUP, SAVE_MODULE_PANEL]) {
        assert.ok(rects.get(id), `${id} present`);
    }
    assert.equal(rects.get(SAVE_SAMPLE_PANEL), undefined);
    assert.equal(rects.get(SAVE_PLAYLIST_PANEL), undefined);
    for (const id of [LOAD_LABEL, TARGET_GROUP, BROWSER]) {
        assert.equal(rects.get(id), undefined, id);
    }
});

test("save-type.value Sample: only the sample sub-panel (with its own format radioGroup) shows", () => {
    const { rects } = layoutWith({ "song-properties-view.value": "File Operations", "disk-action.value": "Save", "save-type.value": "Sample" });
    assert.ok(rects.get(SAVE_SAMPLE_PANEL));
    assert.ok(rects.get(`${SAVE_SAMPLE_PANEL}.radioGroup.radioItem.XI`));
    assert.ok(rects.get(`${SAVE_SAMPLE_PANEL}.button.Export Sample`));
    assert.equal(rects.get(SAVE_MODULE_PANEL), undefined);
    assert.equal(rects.get(SAVE_PLAYLIST_PANEL), undefined);
});

test("save-type.value Playlist: only the playlist sub-panel (with its own format radioGroup) shows", () => {
    const { rects } = layoutWith({ "song-properties-view.value": "File Operations", "disk-action.value": "Save", "save-type.value": "Playlist" });
    assert.ok(rects.get(SAVE_PLAYLIST_PANEL));
    assert.ok(rects.get(`${SAVE_PLAYLIST_PANEL}.radioGroup.radioItem.JSON`));
    assert.ok(rects.get(`${SAVE_PLAYLIST_PANEL}.button.Export Playlist`));
    assert.equal(rects.get(SAVE_MODULE_PANEL), undefined);
    assert.equal(rects.get(SAVE_SAMPLE_PANEL), undefined);
});
