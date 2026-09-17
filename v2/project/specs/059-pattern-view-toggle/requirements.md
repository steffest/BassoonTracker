# 059 — The classic pattern grid, and the row/column view toggle

Date: 2026-09-15. Kind: feature. Status: specified. Closes the standing P7 gap this roadmap has carried since spec 031 ("authoring `patternGrid` into `app.yaml`'s actual pattern-panel screen") - unmentioned by any spec in between (P8-P10, and P11's own specs 051-058) but recorded again each time the multitrack arrangement view's own screen work touched the same area (specs 051/053). Also closes the one piece of the multitrack screen's own scope boundary that was genuinely blocked before, not merely deferred: the row/column view toggle (`controlPanel.js`'s own "Column view"/"Row view" buttons), which spec 053 could not build because the classic grid it would toggle *away from* did not exist yet. It does now.

## Purpose

`patternGrid` (spec 030) and keyboard note entry (spec 031) built the whole mechanism - node count independent of song size, cursor/selection surviving scroll and resize, real editing. Nothing has ever placed it anywhere `app.yaml` reaches. This spec places it, and - since `multitrackView`'s own three-part arc (051/052/053) already built the *other* side of v1's own single toggle - unites both into the same real switch v1 itself has, rather than leaving them as two permanently-simultaneous, unrelated screens.

## What v1 actually does, and what this narrows out (read from source, not assumed)

**The toggle itself** (`controlPanel.js:126-177,218-255`, re-read here alongside the classic grid rather than assumed from spec 053's own citation of it): two icon buttons ("Column view"/"Row view") in the control panel, each triggering `EVENT.showView("main"/"multitrack")`; `patternPanel.js`'s own handler (275-314) shows exactly one of `patternView`/`multitrackView` at a time. v1 also shows the *same* `Visualiser` instance above whichever one is active (`mainPanel.js`'s own child order, already the basis for spec 058's own placement decision) - the scopes stay visible regardless of which side of the toggle is showing.

**The classic grid's own screen context** (`patternPanel.js`, `controlPanel.js`, read again here for anything spec 030/031 did not already need): a per-track solo/mute/FX header (`trackControl.js`) sits above the grid, one per visible track, kept in horizontal sync with the grid's own scroll/pan window. This spec does **not** build it - see Decisions.

## Decisions and assumptions

- **A new field, `pattern-view.value`**, gates which of two sibling panels is visible - `""` (the seeded default, matching every other toggle field's own convention) or the clicked radio item's own label text (`"Column view"`/`"Row view"`, the same "the label itself is the value, no separate name" shape `topViewGroup`'s own already-authored radioGroup already uses) - resolved via the existing `set-value` recipe with no new vocabulary (`setPatternView` -> `pattern-view.set`, confirmed empirically). Left as a **generated mock**, deliberately, the same way `top-view.set` already is: this is pure UI-state (which sibling panel shows), the same class of command every other view-mode toggle in this port leaves mocked rather than mapping a capability that would do nothing beyond what the mock already does.
- **The whole area is restructured**: `components/multitrackPanel.yaml` (spec 053) becomes `components/patternViewPanel.yaml` - a new outer wrapper holding `scopesView` (always visible, moved up one level so it is not itself gated by the new toggle) and two mutually-exclusive children, `patternGridPanel` (`patternGrid`, gated `oneOf: ["", "Column view"]`) and `multitrackViewPanel` (`multitrackView`, gated `oneOf: ["Row view"]`, its own scopes duplicate removed - there is only one scopes instance now, matching v1's own single `Visualiser`). `app.yaml`'s own reference, and every existing test naming the old node ids, are updated to match - the same "rename the whole area, fix what breaks" precedent spec 048 already set when `main`'s own content became `normalMainView`.
- **The toggle itself is placed in `controlBar.yaml`**, as one more `radioGroup` beside the already-authored "Display" (4/8/12/16) group - the same sub-panel `controlPanel.js` itself puts the real buttons in, one more entry in an already-established row of view-mode controls, not a new location.
- **The classic per-track header (`trackControl.js`) is still not built.** Genuinely un-blocked now (the classic grid finally has a screen to attach one above), but keeping the two in sync (the header's own horizontal scroll window has to agree with `patternGrid`'s own internal `startTrack`, currently private controller state with no published field) is a real, separate mechanism question this spec's own placement work does not need answered to close the P7 gap it was scoped around. Recorded as a real, freshly-buildable follow-up, not silently dropped.
- **No new domain work, no new specialized leaf.** `patternGrid`/`multitrackView` are both already fully built; this spec is placement and a toggle, the same shape spec 053/058 already were.

## User stories and acceptance

- **TOGGLE-001 — `patternGrid` renders, in place, sized to fill its own panel, by default.** `computeGenericLayout()` against the real, compiled `app.yaml`, with `pattern-view.value` unset (`""`, the real app's own seeded value), places `patternGridPanel`'s own `patternGrid` node with a non-zero rect; `multitrackViewPanel`/its own `multitrackView` are absent.
- **TOGGLE-002 — Setting `pattern-view.value` to `"Row view"` swaps which of the two is visible; `scopesView` is present either way.** Acceptance: the same layout test, with `pattern-view.value` set to `"Row view"`.
- **TOGGLE-003 — The toggle resolves with no new vocabulary, confirmed empirically before authoring, and is a real, expected `mocked-command` loose end, not an oversight.** Acceptance: read the compiled outline/loose ends back and confirm `pattern-view.set` appears exactly the way `top-view.set` already does.
- **TOGGLE-004 — No regressions.** Full unit suite passes, including every pre-existing test that named the old `multitrackPanel` node id, now fixed to `patternViewPanel`; `node compiler/generate.js` shows no new warnings; `node build.mjs app` succeeds with only the expected new loose ends (the `mocked-command` itself, plus the new radioGroup's own two `inert-control` items - the same established category every prior authored `radioGroup` already carries).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).

## Scope boundaries

In scope: `components/patternViewPanel.yaml` (renamed/restructured from `multitrackPanel.yaml`), `components/controlBar.yaml`'s new toggle `radioGroup`, `app.yaml`'s updated reference, and every test this restructuring touches.

Out of scope, recorded rather than silently dropped:

- **The classic grid's own smaller mute/solo/FX header (`trackControl.js`)** - genuinely buildable now, a real follow-up, not this spec's own placement work.
- **The piano** - P11's last remaining surface, still blocked on a live-audio note-preview mechanism this port has never built.
- **A real capability for `pattern-view.set`** - deliberately left mocked, see Decisions.
