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
    const radioGroup = byType("radioGroup")[0];
    assert.ok(radioGroup, "a radioGroup item is present");
    const items = mapGet(radioGroup, "items");
    assert.equal(items.kind, "seq");
    assert.ok(items.items.length >= 2);
    assert.ok(items.items.every(item => item.kind === "map"), "every radio item parses as a mapping");
    assert.ok(items.items.some(item => (scalarValue(mapGet(item, "label")) || "").toLowerCase().startsWith("song")), "the first choice is the song order");

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
    const statusBar = mapGet(content.items[2], "statusBar");
    assert.equal(scalarValue(mapGet(statusBar, "type")), "panel");
    assert.equal(scalarValue(content.items[3]), "songProperties");
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
