# 045 — The loop creator's menu bar and screen wiring

Date: 2026-09-14. Kind: feature. Status: specified. Continues package **P10** (features and the plugin path) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 044 (the interactive loop-creator overlay). Gives that mechanism a way to actually be reached: the menu-bar controls and the sample-editor screen (spec 042) wiring spec 044's own requirements.md deferred.

## Purpose

Spec 044 built `loopCreatorView` - registered, but authored nowhere, exactly the gap `waveformView` had between specs 041 and 042. This spec closes it: a "Create Loop" button opens the loop creator over the sample-editor panel's own normal content, its own small menu bar (Apply/Cancel, a "Snap to zero" checkbox, a presets control) drives spec 043's own capability surface, and Apply/Cancel return to the normal view.

## What v1 actually does, and what this narrows out (read from source, not assumed)

`sampleView.js`'s own `sampleEditorMenu` "Edit > Create Loop" item opens the loop creator (`openLoopCreator()`, 148-153), which calls `loopCreator.open(Tracker.getCurrentInstrument())` and hides the normal menu while it is visible (`menuPanelActive = !loopCreator.isVisible() && !hissReductionPanel.isVisible()`, 637). The loop creator's own menu-bar strip (`loopCreatorLabel`/`loopSaveButton`/`loopCancelButton`/`snapCheckbox`+`snapLabel`/`presetDropdown`, 545-588) sits inside its own panel, shown only while it is open (`setControlsVisible`, 626-643); `loopCreator.js#saveLoop`/`cancelLoop` both hide the panel and call `me.onClose`, which `sampleView.js` wires back to re-showing its own menu (168-171). This spec authors the same shape with what v2 already has: a `visibleWhen`-gated pair of panels (the loop creator's own content, and the sample-editor panel's own pre-existing content) switched by one state field, rather than v1's own imperative show/hide calls.

`sampleView.js`'s own presets control is a `Dropdown` (570-588, four items: Select/Fade in Head/Fade out Tail/Cross Fade). This spec authors it as a `radioGroup` instead - see Decisions and assumptions for why.

## Decisions and assumptions

- **A `radioGroup`, not a `dropdown`, for the four presets.** `dropdown` has never been authored in any real YAML in this port; its own popup-synthesis machinery (spec 020) is real but unproven end-to-end the way `radioGroup` already is (authored dozens of times across this codebase). Four short, always-visible labels are exactly what `radioGroup`'s own `variant: buttons` shape already handles well, and a genuinely new mechanism's first real exercise is not this spec's job when an already-proven one does the same job. `capabilities.js`'s own `setLoopPreset` maps the clicked item's own label to its index (0-3) via a small fixed array, the same shape `domain/playback/index.js#setScreenRefresh` already uses for its own label-to-index mapping (spec 032).
- **One new state field, `loop-creator.mode`** (`"open"`/`"closed"`/`""`), switches which of the sample-edit panel's own two top-level children is visible - the same `visibleWhen` mechanism every other panel-switch in this application already uses (`top-view.value`, spec 025), not a new mechanism.
- **`compiler/recipes.js`'s `verb-action` recipe gains two more verbs, `open` and `cancel`** - the same small, additive vocabulary growth spec 037/042 already did for `save` and six others; no new recipe kind.
- **The presets radioGroup's own selected item is never synced back to reflect live state.** Once any individual size/blend value is dragged away from a preset's own exact configuration (spec 044's own overlay), no single preset label is "the current one" to highlight - matching how this same ambiguity is already accepted, unaddressed, for the several existing UI-state-only radio groups this application already has (recorded in `app/LOOSE-ENDS.md` for those; this one simply never becomes a loose end since its own command is mapped).
- **The "Snap to zero" checkbox always starts unchecked**, matching `domain/sampleEditor/loopCreator.js#openLoopCreator`'s own unconditional `snapToZero = false` reset - no explicit publish is needed on open for this one field to already show correctly, but this spec publishes it anyway (a cheap, one-line, more-robust-than-necessary safety net, consistent with how carefully this port already treats "the display must reflect real state" elsewhere - spec 042's own `publishInstrumentFields`).

## User stories and acceptance

- **LCS-001 — "Create Loop" opens the loop creator over the current instrument.** Clicking it calls `domain/sampleEditor/index.js#openLoopCreator`, which opens spec 043's own session and switches `loop-creator.mode` to `"open"`; the sample-edit panel's own normal content becomes invisible, the loop-creator panel becomes visible. Acceptance: a compiled-outline check (`node compiler/generate.js`, read back) plus a capability unit test.
- **LCS-002 — Apply/Cancel both return to the normal view.** Each calls its own matching spec-043 capability (`saveLoopCreator`/`cancelLoopCreator`) and unconditionally sets `loop-creator.mode` back to `"closed"`. Acceptance: capability unit tests, including the "nothing was open" no-op case.
- **LCS-003 — "Snap to zero" toggles the loop creator's own flag and reflects it.** A `CONDITION_FIELD_ALIASES` entry (`compiler/recipes.js`) lets its own `rule:` agree with what its `click` action writes, the same seam spec 042 already used for "Loop enabled." Acceptance: a compiler-recipe unit test plus a capability unit test.
- **LCS-004 — Each preset button applies the matching preset.** `setLoopPreset` maps the clicked label to its own 0-3 index and calls `applyLoopPreset`. Acceptance: a capability unit test per label, plus an unrecognized-label no-op case.
- **LCS-005 — No regressions.** Full unit suite passes; `node build.mjs app` succeeds with the loose-ends count unaffected (every new command mapped in `capabilities.js`); `node build.mjs dist` still blocked only by the pre-existing `esbuild` mismatch.

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No new authoring mechanism - `verb-action`'s two new verbs and one new `CONDITION_FIELD_ALIASES` entry are vocabulary added to existing, already-designed extension points.

## Scope boundaries

In scope: `project/specs/application/current/components/sampleEditPanel.yaml` (restructured: the existing content wrapped in a `visibleWhen`-gated panel, a new "Create Loop" button, a new loop-creator panel hosting `loopCreatorView` and its own menu bar), five new `domain/sampleEditor/index.js` capability functions, `compiler/recipes.js`'s two-verb/one-alias additions, five new `capabilities.js` mappings, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Live cursor hinting, zoom sync with the plain waveform view** - already recorded as out of scope in spec 044.
- **The color-key legend** - already recorded as out of scope in spec 044.
- **A `dropdown`-based presets control** - see Decisions and assumptions; a real `dropdown` exercise is a later spec's own, when a real need for its own popup-anchoring behavior (not just four always-visible labels) exists.
