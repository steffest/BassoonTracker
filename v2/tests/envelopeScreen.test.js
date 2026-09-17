import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 057: both envelope panels placed for the first time - a new
// envelopeRow inside sampleEditPanel.yaml's own sampleEditNormalView
// (specs 042/045/046/050), always shown (no visibleWhen of its own -
// disabled instead, via "disabled unless ft mode is active" on every
// interactive control inside it - see requirements.md's Decisions).
// Compiled against the real, live app.yaml, verified with
// computeGenericLayout directly (no Playwright in this environment, the
// same recorded reason every spec since 019 has given) - the same
// convention tests/nibblesMainView.test.js/tests/multitrackScreen.test.js
// already use.

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function readSource(relPath) {
    try { return readFileSync(join(CURRENT, relPath), "utf8"); } catch { return null; }
}

const compiled = compileApplication("app.yaml", readSource);

function measure() {
    return { width: 40, height: 20 };
}

function stateValueOf(field) {
    if (field === "pattern-section-view.value") return "Sample Edit";
    if (field === "sample-edit-view.value") return "";
    return undefined;
}

test("compiles without a hard failure", () => {
    assert.equal(compiled.hardFailure, false);
});

test("both envelopeView nodes are present, sized non-zero, whenever sampleEditNormalView itself is visible", () => {
    const { rects } = computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, { stateValueOf });

    const base = "main.normalMainView.patternSection.sampleEditPanel.sampleEditNormalView.envelopeRow";
    const volume = rects.get(`${base}.volumeEnvelopePanel.volumeEnvelopeBody.volumeEnvelopeGraph`);
    const panning = rects.get(`${base}.panningEnvelopePanel.panningEnvelopeBody.panningEnvelopeGraph`);
    assert.ok(volume, "the volume envelope graph has a rect");
    assert.ok(panning, "the panning envelope graph has a rect");
    assert.ok(volume.width > 0 && volume.height > 0);
    assert.ok(panning.width > 0 && panning.height > 0);
});

test("the envelope row is absent when sampleEditNormalView's own condition does not match (a loop-creator/resample sub-view instead)", () => {
    const { rects } = computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => (field === "sample-edit-view.value" ? "loop-creator" : stateValueOf(field))
    });
    assert.equal(rects.get("main.normalMainView.patternSection.sampleEditPanel.sampleEditNormalView.envelopeRow"), undefined);
});

test("the envelope row sits alongside ftOnlyRow, and both panels' own header controls are present too", () => {
    const { rects } = computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, { stateValueOf });
    const base = "main.normalMainView.patternSection.sampleEditPanel.sampleEditNormalView";
    assert.ok(rects.get(`${base}.ftOnlyRow`));
    assert.ok(rects.get(`${base}.envelopeRow.volumeEnvelopePanel.volumeEnvelopeHeader`));
    assert.ok(rects.get(`${base}.envelopeRow.panningEnvelopePanel.panningEnvelopeHeader`));
    assert.ok(rects.get(`${base}.envelopeRow.volumeEnvelopePanel.volumeEnvelopeBody.volumeEnvelopeControls.volumeEnvelopeSustainPoint`));
    assert.ok(rects.get(`${base}.envelopeRow.panningEnvelopePanel.panningEnvelopeBody.panningEnvelopeControls.panningEnvelopeLoopEnd`));
});
