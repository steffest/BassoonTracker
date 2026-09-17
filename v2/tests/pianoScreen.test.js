import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 062: places pianoView (spec 061) for the first time, closing the
// piano's own three-part arc (060 engine, 061 leaf, 062 screen) and, with
// it, P11. A new sibling of normalMainView (not nested inside it), gated
// only by piano.active - so it shows or hides independently of
// song-properties-view.value/pattern-section-view.value/pattern-view.value,
// matching v1's own "sits below whichever view is active" behavior
// (mainPanel.js:65-73).

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function readSource(relPath) {
    try { return readFileSync(join(CURRENT, relPath), "utf8"); } catch { return null; }
}

const compiled = compileApplication("app.yaml", readSource);

function measure() {
    return { width: 40, height: 20 };
}

function layoutWith(fields) {
    return computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => (field in fields ? fields[field] : undefined)
    });
}

test("compiles without a hard failure", () => {
    assert.equal(compiled.hardFailure, false);
});

test("piano.active unset (the real app's own seeded default): pianoPanel and everything inside it are absent", () => {
    const { rects } = layoutWith({});
    assert.equal(rects.get("main.pianoPanel"), undefined);
    assert.equal(rects.get("main.pianoPanel.pianoKeys"), undefined);
    assert.equal(rects.get("main.pianoPanel.pianoHeaderRow.pianoOctaveSpinBox"), undefined);
    assert.equal(rects.get("main.pianoPanel.pianoHeaderRow.pianoCloseButton"), undefined);
});

test("piano.active true: pianoPanel, pianoKeys, the octave spinbox and the close button are all present and sized", () => {
    const { rects } = layoutWith({ "piano.active": true });
    for (const id of [
        "main.pianoPanel",
        "main.pianoPanel.pianoKeys",
        "main.pianoPanel.pianoHeaderRow.pianoOctaveSpinBox",
        "main.pianoPanel.pianoHeaderRow.pianoCloseButton"
    ]) {
        const rect = rects.get(id);
        assert.ok(rect, `${id} has a rect`);
        assert.ok(rect.width > 0 && rect.height > 0, `${id} is sized`);
    }
});

test("piano.active true is independent of song-properties-view.value - present whether the default song-properties content or Nibbles is showing underneath", () => {
    for (const songPropertiesView of [undefined, "Nibbles"]) {
        const fields = { "piano.active": true };
        if (songPropertiesView !== undefined) fields["song-properties-view.value"] = songPropertiesView;
        const { rects } = layoutWith(fields);
        assert.ok(rects.get("main.pianoPanel.pianoKeys"), `pianoKeys present for song-properties-view.value=${JSON.stringify(songPropertiesView)}`);
    }
});

test("piano.active true is independent of pattern-view.value - present on both sides of the row/column toggle", () => {
    for (const patternView of ["", "Row view"]) {
        const { rects } = layoutWith({ "piano.active": true, "pattern-view.value": patternView });
        assert.ok(rects.get("main.pianoPanel.pianoKeys"), `pianoKeys present for pattern-view.value=${JSON.stringify(patternView)}`);
    }
});
