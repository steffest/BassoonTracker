import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseYamlDocument, mapGet, scalarValue } from "../compiler/yaml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function read(relPath) {
    return readFileSync(join(CURRENT, relPath), "utf8");
}

test("parses a flat mapping with scalar and nested values", () => {
    const { root, errors } = parseYamlDocument(read("components/songProperties.yaml"), "songProperties.yaml");
    assert.deepEqual(errors, []);
    assert.equal(scalarValue(mapGet(root, "name")), "songProperties");
    assert.equal(scalarValue(mapGet(root, "type")), "panel");
    const layout = mapGet(root, "layout");
    assert.equal(layout.kind, "map");
    assert.equal(scalarValue(mapGet(layout, "width")), "fill");
    assert.equal(scalarValue(mapGet(layout, "resizable")), "horizontal");
});

test("folds a multi-line plain scalar into one space-joined value", () => {
    const { root, errors } = parseYamlDocument(read("rules/horizontalResize.yaml"), "horizontalResize.yaml");
    assert.deepEqual(errors, []);
    const description = scalarValue(mapGet(root, "description"));
    assert.ok(description.startsWith("Ensures that the UI components adjust properly"));
    assert.ok(description.includes("switching to the small UI representation if needed."));
    assert.ok(description.includes("Text labels can be shortened"));
    assert.ok(!description.includes("\n"));
});

test("parses controlBar: sequence items as scalar, multi-key mapping and nested named items", () => {
    // Reads the live authored component, so the shapes below are asserted by
    // *finding* their content rather than by index or count: this file grows
    // as the application is authored, and the parser contract does not.
    const { root, errors } = parseYamlDocument(read("components/controlBar.yaml"), "controlBar.yaml");
    assert.deepEqual(errors, []);
    const content = mapGet(root, "content");
    assert.equal(content.kind, "seq");
    assert.ok(content.items.length >= 3, "the control bar has at least the radio group and the two transport buttons");

    const byType = type => content.items.filter(item => item.kind === "map" && scalarValue(mapGet(item, "type")) === type);
    const radioGroups = byType("radioGroup");
    assert.ok(radioGroups.length >= 1, "the song/pattern order is a radioGroup");

    // Spec 070's own UI-alignment pass (step 6): File Operations/Options/
    // Sample Edit are three independent toggle buttons (matching v1's own
    // three separate Checkboxbuttons - confirmed live that File Operations
    // and Sample Edit can both be open at once, which one shared
    // mutually-exclusive radioGroup could never express), grouped only
    // visually inside a buttonGroup (no shared selection state of its own).
    const buttonGroups = byType("buttonGroup");
    const topViewButtons = buttonGroups.find(group => {
        const groupItems = mapGet(group, "items");
        return groupItems && groupItems.items.some(item => scalarValue(mapGet(item, "label")) === "Sample Edit");
    });
    assert.ok(topViewButtons, "the File Operations/Options/Sample Edit buttonGroup is found by its own content");
    const topViewItems = mapGet(topViewButtons, "items");
    assert.deepEqual(topViewItems.items.map(item => scalarValue(mapGet(item, "label"))), ["File Operations", "Options", "Sample Edit"]);
    const sampleEditItem = topViewItems.items.find(item => scalarValue(mapGet(item, "label")) === "Sample Edit");
    const sampleEditActions = mapGet(sampleEditItem, "actions");
    assert.equal(scalarValue(mapGet(sampleEditActions.items[0], "click")), "toggleSampleEditPanel");

    const songGroup = radioGroups.find(group => {
        const groupItems = mapGet(group, "items");
        return groupItems && groupItems.items.some(item => (scalarValue(mapGet(item, "label")) || "").toLowerCase().startsWith("song"));
    });
    assert.ok(songGroup, "the song/pattern radioGroup is found by its own content, not by position");
    const items = mapGet(songGroup, "items");
    assert.equal(items.kind, "seq");
    assert.ok(items.items.length >= 2);
    assert.ok(items.items.every(item => item.kind === "map"), "every radio item parses as a mapping");

    const buttons = byType("button");
    const playButton = buttons.find(item => scalarValue(mapGet(item, "label")) === "Play");
    assert.ok(playButton, "the Play button is present");
    assert.equal(scalarValue(mapGet(playButton, "shortKey")), "Enter");
    // spec 008: the component names the skin variant that draws it.
    assert.equal(scalarValue(mapGet(playButton, "variant")), "play");
    const actions = mapGet(playButton, "actions");
    assert.equal(actions.kind, "seq");
    assert.equal(scalarValue(mapGet(actions.items[0], "click")), "toggleplay");

    const recordButton = buttons.find(item => scalarValue(mapGet(item, "label")) === "record");
    assert.ok(recordButton, "the record button is present");
    assert.equal(scalarValue(mapGet(recordButton, "variant")), "record");
    assert.ok(mapGet(recordButton, "rule"), "the record button carries a prose rule");
});

test("parses app.yaml: bare scalar references and nested named panel items", () => {
    const { root, errors } = parseYamlDocument(read("app.yaml"), "app.yaml");
    assert.deepEqual(errors, []);
    const app = mapGet(root, "app");
    assert.equal(scalarValue(mapGet(app, "rules")), "noDependencies");

    const main = mapGet(mapGet(app, "ui"), "main");
    const content = mapGet(main, "content");
    // Spec 070's own UI-alignment pass (step 3) removed infoBar from this
    // top-level list - it moved into a new patternSection wrapper nested
    // inside normalMainView (see below). Step 6 then removed nibblesPanel
    // from this list entirely too - it moved into songProperties.yaml's own
    // content (components/nibblesPanel.yaml, referenced by name), confirmed
    // against v1's own real source to belong to the song-properties
    // section's own bounded strip, not a full top-level sibling of
    // normalMainView - so main.content now has two fewer items than
    // originally.
    assert.equal(content.items.length, 4);

    const topItem = content.items[0];
    assert.equal(topItem.kind, "map");
    const top = mapGet(topItem, "top");
    assert.equal(scalarValue(mapGet(top, "type")), "panel");
    const menu = mapGet(top, "menu");
    assert.equal(scalarValue(mapGet(menu, "type")), "menu");
    assert.equal(scalarValue(mapGet(top, "volume meter")), "volumemeter");

    const notifications = mapGet(top, "notifications");
    const notificationContent = mapGet(notifications, "content");
    assert.equal(notificationContent.items.length, 2);
    const keyLight = mapGet(notificationContent.items[0], "notification light");
    assert.equal(scalarValue(mapGet(keyLight, "label")), "Key, K");
    const rules = mapGet(keyLight, "rules");
    assert.equal(rules.items.length, 2);
    assert.equal(scalarValue(rules.items[0]), "horizontalResize");

    assert.equal(scalarValue(content.items[1]), "controlBar");

    // Spec 048: the six regions main-view.value swaps away for Nibbles are
    // wrapped in a new named panel, "normalMainView" - still bare scalar
    // references, just nested one level deeper. Spec 070's own UI-alignment
    // pass (step 3) further nested editPad/patternViewPanel (plus infoBar,
    // moved here from main.content directly - see above) inside a new
    // "patternSection" wrapper, matching v1's own _patternPanel, which owns
    // editPanel/infoPanel/patternView directly rather than as independent
    // regions. Step 4 then moved sampleEditPanel itself inside that same
    // wrapper too, as patternSectionDefault's own sibling - v1's sample
    // editor is scoped to the pattern section, not the song-properties one.
    // Step 5 moved songPatternList out of this shared stack entirely, into
    // songProperties.yaml's own content instead (a real, bounded 160px
    // wrapper now, matching v1's own song-properties section). Step 6 then
    // moved fileOperationsPanel/optionsPanel out of normalMainView's own
    // content too - confirmed against v1's own real source that they (and
    // Nibbles) all share one slot, appMainPanel.js's own bounded strip, so
    // all three now live inside songProperties.yaml's own content instead
    // (see that file directly) - normalMainView's own content is just
    // patternSection and the bare "songProperties" reference now, and
    // normalMainView itself no longer carries a visibleWhen at all (main-view.value
    // is retired - Nibbles no longer replaces the whole main content area).
    const normalMainViewItem = content.items[2];
    assert.equal(normalMainViewItem.kind, "map");
    assert.equal(mapGet(normalMainViewItem, "visibleWhen"), null, "no longer gated - always present");
    const normalMainViewContent = mapGet(normalMainViewItem, "content");
    assert.equal(normalMainViewContent.items.length, 2);
    const patternSectionItem = normalMainViewContent.items[0];
    assert.equal(patternSectionItem.kind, "map");
    assert.equal(scalarValue(mapGet(patternSectionItem, "name")), "patternSection");
    const patternSectionContent = mapGet(patternSectionItem, "content");
    const patternSectionDefaultItem = patternSectionContent.items[0];
    assert.equal(patternSectionDefaultItem.kind, "map");
    assert.equal(scalarValue(mapGet(patternSectionDefaultItem, "name")), "patternSectionDefault");
    const patternSectionDefaultContent = mapGet(patternSectionDefaultItem, "content");
    assert.equal(scalarValue(patternSectionDefaultContent.items[0]), "editPad");
    assert.equal(scalarValue(patternSectionDefaultContent.items[1]), "infoBar");
    assert.equal(scalarValue(patternSectionDefaultContent.items[2]), "patternViewPanel");
    assert.equal(scalarValue(patternSectionContent.items[1]), "sampleEditPanel");
    assert.equal(scalarValue(normalMainViewContent.items[1]), "songProperties");

    assert.equal(scalarValue(content.items[3]), "pianoPanel");
});

test("reports a range-qualified error for malformed indentation", () => {
    const { errors } = parseYamlDocument("a:\n  b: 1\n c: 2\n", "broken.yaml");
    assert.ok(errors.length > 0);
    assert.ok(errors[0].range.start.line >= 1);
});

test("rejects unterminated/unsupported flow syntax instead of silently misreading it as plain text", () => {
    // Regression: `key: [oops` was previously accepted as the scalar text
    // "[oops" (this parser doesn't implement flow collections at all), which
    // let a corrupt save slip past the server's validate-before-write gate.
    const { errors } = parseYamlDocument("name: songProperties\nbad: [unterminated\n", "broken.yaml");
    assert.ok(errors.length > 0);
    assert.match(errors[0].message, /flow collection/);
});

test("preserves source ranges for keys and scalars", () => {
    const { root } = parseYamlDocument("name: controlBar\ntype: panel\n", "small.yaml");
    const entry = root.entries[0];
    assert.deepEqual(entry.keyRange.start, { line: 1, column: 0, offset: 0 });
    assert.equal(entry.keyRange.end.column, 4);
    assert.equal(entry.valueNode.range.start.line, 1);
});
