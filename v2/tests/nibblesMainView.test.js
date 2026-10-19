import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication } from "../compiler/convert.js";
import { computeGenericLayout } from "../runtime/genericLayout.js";

// Spec 048 originally gated Nibbles behind main-view.value, swapping out the
// *whole* main content area for a full-viewport game. Spec 070's own
// UI-alignment pass (step 6) found and fixed this: confirmed against v1's
// own real source (script/src/ui/app/appMainPanel.js's own pluginRenderHook,
// target "main") and live in the browser (console: "Set Nibbles render
// target to {width:1200, height:160}"; screenshot: the whole game genuinely
// renders inside that 160px-tall strip) that Nibbles occupies the exact
// same bounded song-properties-section slot File Operations/Options
// share - it does not replace normalMainView at all. main-view.value is
// retired entirely; normalMainView is now always present, and nibblesPanel
// lives inside songProperties (components/nibblesPanel.yaml), gated on
// song-properties-view.value like its two siblings. Compiled against the
// real, live app.yaml, verified with computeGenericLayout directly (no
// Playwright in this environment, the same recorded reason every spec since
// 019 has given).

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT = join(__dirname, "../project/specs/application/current");

function readSource(relPath) {
    try { return readFileSync(join(CURRENT, relPath), "utf8"); } catch { return null; }
}

const compiled = compileApplication("app.yaml", readSource);

function measure() {
    return { width: 40, height: 20 };
}

function layout(overrides) {
    return computeGenericLayout(compiled.root, { width: 1200, height: 800 }, measure, {
        stateValueOf: field => {
            if (field in overrides) return overrides[field];
            if (field === "song-properties-view.value") return "";
            if (field === "pattern-section-view.value") return "";
            return undefined;
        }
    });
}

test("compiles without a hard failure", () => {
    assert.equal(compiled.hardFailure, false);
});

test("with the real seeded defaults, normalMainView, the pattern section's default content and songPatternList are all present; the other song-properties alternates are not", () => {
    const { rects } = layout({});
    assert.ok(rects.get("main.normalMainView"), "always present now - no visibleWhen of its own any more");
    for (const id of [
        "main.normalMainView.patternSection.patternLeftColumn.editPad",
        "main.songProperties",
        "main.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList"
    ]) {
        assert.ok(rects.get(id), `${id} has a rect`);
    }
    for (const id of [
        "main.songProperties.optionsPanel",
        "main.songProperties.fileOperationsPanel",
        "main.songProperties.nibblesPanel"
    ]) {
        assert.equal(rects.get(id), undefined, `${id} is not shown by default`);
    }
});

test("song-properties-view.value selects exactly one of File Operations/Options/Nibbles, mutually exclusive - the three share v1's own single appMainPanel slot", () => {
    for (const [value, expectedId] of [
        ["File Operations", "main.songProperties.fileOperationsPanel"],
        ["Options", "main.songProperties.optionsPanel"],
        ["Nibbles", "main.songProperties.nibblesPanel"]
    ]) {
        const { rects } = layout({ "song-properties-view.value": value });
        assert.ok(rects.get(expectedId), `${expectedId} shown for song-properties-view.value=${value}`);
        assert.equal(rects.get("main.songProperties.songPropertiesDefault.songPropertiesLayout.songPatternGroup.songPatternList"), undefined, `songPatternList hidden while ${value} is showing`);
        for (const [otherValue, otherId] of [
            ["File Operations", "main.songProperties.fileOperationsPanel"],
            ["Options", "main.songProperties.optionsPanel"],
            ["Nibbles", "main.songProperties.nibblesPanel"]
        ]) {
            if (otherValue === value) continue;
            assert.equal(rects.get(otherId), undefined, `${otherId} absent while ${value} is showing`);
        }
    }
});

// Confirmed live against the real v1 app (step 6): opening File Operations
// with Sample Edit already open leaves *both* showing at once - they are
// two genuinely independent slots (song-properties-view.value and
// pattern-section-view.value), not one shared switch. Selecting Options
// instead of File Operations does not touch Sample Edit either.
test("song-properties-view.value and pattern-section-view.value are independent - File Operations and Sample Edit can both be open at the same time", () => {
    const { rects } = layout({ "song-properties-view.value": "File Operations", "pattern-section-view.value": "Sample Edit" });
    assert.ok(rects.get("main.songProperties.fileOperationsPanel"), "File Operations still shows");
    assert.ok(rects.get("main.normalMainView.patternSection.sampleEditPanel"), "Sample Edit still shows too");
    // Spec 076's own deep-parity-audit item 2 moved editPad out of
    // patternSectionDefault into patternLeftColumn (nested above
    // patternSidebar, matching v1's own real narrow left column) - Sample
    // Edit only ever replaced patternSectionDefault's own content
    // (infoBar/patternViewPanel), never the sidebar column, so editPad no
    // longer disappears when Sample Edit opens (confirmed against v1's own
    // real behavior: its editPanel column stays in place regardless of
    // which pattern-section view is active).
    assert.ok(rects.get("main.normalMainView.patternSection.patternLeftColumn.editPad"), "editPad is unaffected by Sample Edit - it lives in the sidebar column now, not patternSectionDefault");
});

// The real, corrected finding this step made, replacing this same test's own
// previous (wrong) claim that Nibbles hides infoBar/editPad/the pattern
// grid: confirmed live against v1 (screenshot: the "STOPPED / MORE INFO"
// row, the scope graphs and the pattern grid all stay visible below the
// game while it plays) that Nibbles never touches the pattern section at
// all - only domain/nibbles/index.js's own openNibblesView clearing
// pattern-section-view.value (closing Sample Edit specifically, matching
// v1's own single "main" showView broadcast) has any effect there.
test("Nibbles showing in the song-properties section leaves the pattern section's own default content (editPad/infoBar/patternViewPanel) fully visible", () => {
    const { rects } = layout({ "song-properties-view.value": "Nibbles" });
    assert.ok(rects.get("main.songProperties.nibblesPanel"), "Nibbles itself shows");
    for (const id of [
        "main.normalMainView.patternSection.patternLeftColumn.editPad",
        "main.normalMainView.patternSection.patternSectionDefault.infoBar",
        "main.normalMainView.patternSection.patternSectionDefault.patternViewPanel"
    ]) {
        assert.ok(rects.get(id), `${id} is unaffected by Nibbles showing in a completely different section`);
    }
});

// v1's own real strip is 160px tall (confirmed live: "Set Nibbles render
// target to {width:1200, height:160}"). v2's own songProperties.yaml grew
// to 220px in step 7, to fit optionsPanel's own real 6/7-column grid
// without clipping - a deliberate, documented deviation, not a regression -
// so this only checks "still genuinely bounded to the section, not the
// full viewport" rather than pinning the exact v1 pixel count.
test("nibblesPanel's own game grid is genuinely bounded to the song-properties section's own fixed height, not the full viewport - matching v1's own real, confirmed behavior", () => {
    const { rects } = layout({ "song-properties-view.value": "Nibbles", "nibbles-view.value": "game" });
    const panel = rects.get("main.songProperties.nibblesPanel");
    const grid = rects.get("main.songProperties.nibblesPanel.nibblesGameView.nibblesTopRow.nibblesGrid");
    assert.ok(panel && grid);
    assert.ok(panel.height < 300, "bounded to the song-properties section's own fixed height, not left to grow");
    assert.ok(grid.width > 0 && grid.height > 0);
});

test("wrapping changes nothing about the menu bar or control bar - present regardless of song-properties-view.value", () => {
    for (const value of ["", "Nibbles"]) {
        const { rects } = layout({ "song-properties-view.value": value });
        assert.ok(rects.get("main.top"), `top present for song-properties-view.value=${JSON.stringify(value)}`);
        assert.ok(rects.get("main.controlBar"), `controlBar present for song-properties-view.value=${JSON.stringify(value)}`);
    }
});

test("normalMainView behaves as a plain, unsurprising column wrapper - not a special case", () => {
    // Nesting deeper than a direct child of `main` costs one more panel's
    // own padding on each side, per extra level (genericLayout.js's own
    // PADDING, applied consistently at every nesting depth) - editPad's own
    // width is smaller than normalMainView's own, by at least that much,
    // the same way controlBar (still main's own direct child) differs from
    // the raw viewport width by one padding level. (editPad is four levels
    // under main since spec 070's own UI-alignment pass added the
    // patternSection wrapper, then step 4 added patternSectionDefault
    // between patternSection and editPad - the inequality below holds
    // regardless of the exact depth.)
    //
    // The height half of this check used to assert editPad's own height
    // (28) was untouched by nesting - editPad no longer has an authored
    // `height: fixed` at all (spec 070's own UI-alignment pass gave it a
    // real `direction: row` and let it auto-size to its own Track/Pattern
    // button columns, fixing two real, confirmed bugs found doing that:
    // compiler/emit.js's own `layoutLiteral()` and runtime/components.js's
    // own `component()` both silently dropped `layout.direction` for every
    // node in the whole generated application, not just this one - neither
    // ever emitted/carried it through at all). `main.top.volumemeter`
    // (also two levels under `main`) is the substitute here: a real,
    // explicitly authored `height: 160`/`16` (spec 054), unrelated to this
    // change, still proving the same "fixed stays fixed regardless of
    // nesting depth" property the original assertion was actually testing.
    const { rects } = layout({});
    const controlBar = rects.get("main.controlBar"); // one level under main, for comparison
    const normalMainView = rects.get("main.normalMainView"); // also one level under main
    const editPad = rects.get("main.normalMainView.patternSection.patternLeftColumn.editPad"); // four levels under main
    const volumemeter = rects.get("main.top.volumemeter"); // two levels under main, still height: fixed

    assert.equal(normalMainView.width, controlBar.width, "normalMainView is exactly as wide as any other direct child of main");
    assert.ok(editPad.width < normalMainView.width, "extra nesting levels each cost their own panel's own padding");
    assert.equal(volumemeter.height, 16, "a genuinely fixed-height node's own height is unaffected by nesting depth");
});
