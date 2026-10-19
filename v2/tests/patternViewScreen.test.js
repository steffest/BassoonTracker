import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 059: closes the standing P7 gap (patternGrid, specs 030/031, never
// placed in any screen) and unites it with multitrackView (specs 051/052/
// 053) behind the same real toggle v1 itself has - controlPanel.js's own
// "Column view"/"Row view" buttons. components/multitrackPanel.yaml (spec
// 053) is restructured into components/patternViewPanel.yaml: scopesView
// stays always visible (moved up one level, matching v1's own single
// Visualiser instance shown above whichever sub-view is active), and
// patternGridPanel/multitrackViewPanel are now mutually exclusive,
// gated by pattern-view.value. Compiled against the real, live app.yaml,
// verified with computeGenericLayout directly (no Playwright in this
// environment, the same recorded reason every spec since 019 has given) -
// the same convention tests/nibblesMainView.test.js already uses. This
// file replaces tests/multitrackScreen.test.js (spec 053/058's own tests),
// since the node ids it named no longer exist under that name.

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function readSource(relPath) {
    try { return readFileSync(join(CURRENT, relPath), "utf8"); } catch { return null; }
}

const compiled = compileApplication("app.yaml", readSource);

function measure() {
    return { width: 40, height: 20 };
}

function layoutWith(patternView) {
    return computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => {
            // patternSectionDefault (step 4's own wrapper, sibling of
            // sampleEditPanel) needs its own field seeded to the real app's
            // seeded default too - none of this file's tests exercise Sample
            // Edit itself. songPropertiesDefault (step 6's own wrapper,
            // sibling of fileOperationsPanel/optionsPanel/nibblesPanel)
            // needs the same seeding - none of this file's tests exercise
            // those either.
            if (field === "pattern-section-view.value") return "";
            if (field === "song-properties-view.value") return "";
            if (field === "pattern-view.value") return patternView;
            return undefined;
        }
    });
}

test("compiles without a hard failure", () => {
    assert.equal(compiled.hardFailure, false);
});

test("with pattern-view.value \"\" (the real app's own seeded initial value), patternGrid is present and sized non-zero; multitrackView is absent", () => {
    const { rects } = layoutWith("");
    const panelRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel");
    const gridRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel.patternGrid");
    assert.ok(panelRect, "patternGridPanel has a rect");
    assert.ok(gridRect, "patternGrid has a rect");
    assert.ok(panelRect.width > 0 && panelRect.height > 0);
    assert.ok(gridRect.width > 0 && gridRect.height > 0);
    assert.equal(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel"), undefined);
});

test("with pattern-view.value = \"Column view\" (the explicit label, not just the unset default), the same is true", () => {
    const { rects } = layoutWith("Column view");
    assert.ok(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel.patternGrid"));
    assert.equal(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel"), undefined);
});

// Spec 074: the classic grid's own per-track Solo/Mute/FX header sits only
// inside patternGridPanel (multitrackView already has its own equivalent
// control strip built in, spec 052).
test("trackControl sits above patternGrid inside patternGridPanel only, not multitrackViewPanel", () => {
    const { rects } = layoutWith("");
    const trackControlRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel.trackControl");
    const gridRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel.patternGrid");
    assert.ok(trackControlRect, "trackControl has a rect");
    assert.ok(trackControlRect.width > 0 && trackControlRect.height > 0);
    assert.ok(trackControlRect.y < gridRect.y, "trackControl sits above patternGrid");

    const { rects: rowRects } = layoutWith("Row view");
    assert.equal(rowRects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel.trackControl"), undefined, "not duplicated inside multitrackViewPanel");
});

test("with pattern-view.value = \"Row view\", multitrackView is present and sized non-zero; patternGrid is absent", () => {
    const { rects } = layoutWith("Row view");
    const panelRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel");
    const viewRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel.multitrackView");
    assert.ok(panelRect, "multitrackViewPanel has a rect");
    assert.ok(viewRect, "multitrackView has a rect");
    assert.ok(panelRect.width > 0 && panelRect.height > 0);
    assert.ok(viewRect.width > 0 && viewRect.height > 0);
    assert.equal(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel"), undefined);
});

// Spec 070's own UI-alignment pass (step 6, correcting an earlier, wrong
// assumption of this same test): confirmed against v1's own real source and
// live in the browser that Nibbles renders inside the song-properties
// section's own bounded strip - a completely different section from the
// pattern one - so it does *not* hide patternViewPanel. The two sections
// really are independent, unlike this test's own previous claim.
test("with song-properties-view.value = \"Nibbles\", patternViewPanel (scopes and the default sub-panel) is unaffected", () => {
    const { rects } = computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => {
            if (field === "song-properties-view.value") return "Nibbles";
            if (field === "pattern-section-view.value") return "";
            if (field === "pattern-view.value") return "";
            return undefined;
        }
    });
    assert.ok(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel"), "the pattern section's own default content is untouched by the song-properties section's own state");
    assert.ok(rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.scopes"));
});

// Spec 058's own scopes placement: still always visible, regardless of the
// new toggle - v1 itself shows the identical Visualiser instance above
// whichever sub-view is active, not gated by the same field the sub-views
// themselves are.
test("scopesView is present and sits above whichever sub-view is showing, on both sides of the toggle", () => {
    for (const patternView of ["", "Row view"]) {
        const { rects } = layoutWith(patternView);
        const scopesRect = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.scopes");
        assert.ok(scopesRect, `scopes has a rect for pattern-view.value=${JSON.stringify(patternView)}`);
        assert.ok(scopesRect.width > 0 && scopesRect.height > 0);
        const subViewId = patternView === "Row view"
            ? "main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.multitrackViewPanel"
            : "main.normalMainView.patternSection.patternSectionDefault.patternViewPanel.patternGridPanel";
        assert.ok(scopesRect.y < rects.get(subViewId).y, "scopes sits above the active sub-view");
    }
});

// Spec 070's own UI-alignment pass (step 3) nested editPad and
// patternViewPanel one level deeper still, inside a new patternSection
// wrapper alongside infoBar (matching v1's own _patternPanel, which owns
// editPanel/infoPanel/patternView directly) - songPatternList/songProperties
// stay direct children of normalMainView, siblings of patternSection as a
// whole rather than of editPad/patternViewPanel individually. Step 4 then
// added one more level, patternSectionDefault, as sampleEditPanel's own
// sibling inside patternSection. Step 5 then gave songProperties its own
// real, bounded 160px wrapper and moved songPatternList inside it as
// default content, one level deeper still.
// Spec 076's own deep-parity-audit item 1 promoted "songProperties" out of
// normalMainView entirely, to a top-level sibling above controlBar/
// patternSection - matching v1's own real stacking order (menu -> appPanel
// [[song-properties]] -> controlPanel -> patternPanel). songPatternList is
// now above editPad/patternViewPanel, the reverse of this test's own
// previous (now-outdated) claim.
test("songPatternList sits above editPad and patternViewPanel, and neither of those two lost their own rect", () => {
    const { rects } = layoutWith("");
    assert.ok(rects.get("main.normalMainView.patternSection.patternLeftColumn.editPad"));
    assert.ok(rects.get("main.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList"));
    assert.ok(rects.get("main.songProperties"));

    const editPadTop = rects.get("main.normalMainView.patternSection.patternLeftColumn.editPad").y;
    const patternViewTop = rects.get("main.normalMainView.patternSection.patternSectionDefault.patternViewPanel").y;
    const songListTop = rects.get("main.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList").y;
    assert.ok(editPadTop <= patternViewTop, "editPad is above (or level with) patternViewPanel");
    assert.ok(songListTop < patternViewTop, "songPatternList is above patternViewPanel");
});
