# 058 — The scopes

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P11** (the remaining specialized surfaces) of the [port roadmap](../010-port-roadmap/requirements.md), following the envelope editor's own three-part arc (055/056/057). The port's ninth specialized-component leaf, after `patternGrid`, `fileBrowser`, `waveformView`, `loopCreatorView`, `nibblesGrid`, `multitrackView`, `volumeMeter` and `envelopeView`. Built as engine, leaf and placement together in one pass, the same "small enough for one spec" call the VU meter (054) already made - there is no new domain mechanism to separate out at all here, see below.

## Purpose

`script/src/ui/app/components/visualiser.js` (204 lines, read in full for this spec) is the small live oscilloscope grid shown above the pattern editor - one mini scope per track, tiled in up to two rows, clicking one toggles that track's own mute.

**A real, confirmed finding that shrinks this spec's own scope before any code is written**: `Visualiser` declares three modes (`_modes = ["wave", "spectrum", "tracks"]`, cycled by `nextMode()`), but `render()` unconditionally calls `this._modeTracksRender()` - the *only* render method the whole file defines - regardless of `this._mode`. `"wave"`/`"spectrum"` are declared labels with no rendering path behind them at all; cycling through them changes `_mode` and logs to the console, but the screen never changes. Confirmed by reading the entire file, not assumed from the mode list alone - this is v1's own dead code, the same "declared but unreachable" shape `loopCreator.js`'s own `snapMarkersToZero` (spec 043) and `envelope.js`'s own apparent orphaning (spec 057, corrected there once the real import site was found) already turned out to be, in this case genuinely dead rather than merely hard to find. Only `"tracks"` mode is ported.

## What v1 actually does, and what this narrows out (read from source, not assumed)

**Layout** (`_setAnalyserPositions`, 179-203): one cell per track, in a single row up to four tracks; beyond four, two rows (`cols = ceil(trackCount/2)`, each cell's own height halved), the second row's own cells positioned at `top = height - cellHeight` (not `top = cellHeight` - the same value once cells are exactly half-height, but the *formula* v1 actually uses, ported literally rather than by a value it happens to currently agree with).

**Drawing** (`_modeTracksRender`, 118-177): each track's own live time-domain byte data (already exactly `getTrackScopeData`'s own per-track `AnalyserNode`, spec 052 - the same mechanism, not a second one) plotted as `wy = v * height/2 + top` where `v = byte/128.0` (0-2, centered on 1 at silence) - an *asymmetric* mapping (the trace sits at the vertical center only at exact silence, and can reach the cell's own full height above but only half below, a real, faithfully-preserved v1 quirk, not obviously "centered" the way a naive re-derivation might assume); a muted track (or no audible master volume at all, `Audio.cutOff`) instead draws one flat horizontal line and a dimming overlay. Clicking inside a cell (`onClick`, 96-108) fires `EVENT.trackScopeClick`, which `trackControl.js`'s own listener turns into that one track's own mute toggle (confirmed by re-reading `trackControl.js:54-56`, already read in full for spec 051) - the same `domain/arrangement` mute mechanism spec 051 already centralized, so this spec adds nothing new there either.

**Not ported, and why**: the background is a skin-atlas sprite image (`Y.getImage("oscilloscope")`) - the same flat-fill simplification every specialized leaf's own background already makes; the adaptive FFT-size shrink under low framerate (`EVENT.second`'s own handler, halving `_analyserSize` down to a floor of 32 when average FPS drops below 32) is a v1-only performance accommodation this port's own renderer (spec 032's coalesced draw loop) does not need in the same way, and reusing spec 052's own fixed-size per-track analysers (256 samples) avoids a second, parallel analyser-sizing concern entirely; the amplitude-boost branch (`_analyserAmp`, always `1.5` in v1 but never actually reachable from any UI - grepped, confirmed nothing ever sets it away from its own hardcoded `1` no-op threshold... actually a real design choice, not dead code: `_analyserAmp = 1.5` and `if (this._analyserAmp > 1)` *is* always true, boosting the trace by 1.5x - ported faithfully, not dropped, once this was checked rather than assumed).

## Decisions and assumptions

- **No domain work at all** - this is the first specialized leaf in this port needing zero new domain functions. `domain/arrangement/index.js#getTrackScopeData`/`getTrackMuteSolo`/`toggleTrackMute` (specs 051/052) already cover every real mechanism this leaf touches; only a new pure geometry module and the leaf itself (controller + draw kind) are new.
- **Placed once, immediately, inside `components/multitrackPanel.yaml`** (spec 053), as a new sibling above `multitrackView` - not deferred as a "mechanism, not yet placed" leaf the way `loopCreatorView`/`envelopeView` each were. v1 itself shows the *same* `Visualiser` instance above both its own classic grid and its own multitrack view (`mainPanel.js`'s own `addChild(UI.visualiser)` ahead of `addChild(UI.multitrack)`) - unlike the row/column view toggle (spec 053's own recorded, real blocker: no classic-grid screen exists to toggle *away from*), the scopes have a real, sensible home directly above the one pattern-editing surface v2 actually has, with nothing else in the way.
- **The amplitude boost (`v * 1.5`) is ported, not dropped** - confirmed by reading the whole file rather than assuming a labelled multiplier with no visible UI control is dead.
- **"wave"/"spectrum" are not ported at all** - see Purpose; there is nothing behind either label to port.
- **The dimming/no-signal branches are unified**: v1's own `hasVolume = !Audio.cutOff` (a global "audio cut off entirely" flag with no v2 equivalent - `domain/playback` has never modeled it, and nothing in this port has needed to) is folded into the same "no data" fallback `getTrackScopeData` returning `null` already produces (before any audio context exists) - one flat-line branch instead of two, since v2 has no separate "cut off" concept to distinguish from "no context yet."

## User stories and acceptance

- **SCOPES-001 — Cell layout matches v1's own formula for up to four tracks (one row) and beyond four (two rows).** Acceptance: pure geometry unit tests for both branches, including the exact `top = height - cellHeight` formula.
- **SCOPES-002 — Clicking inside a cell toggles that track's own mute; clicking outside every cell does nothing.** Acceptance: controller unit tests against a real loaded fixture, confirming `domain/arrangement#getTrackMuteSolo` flips.
- **SCOPES-003 — The draw kind never throws; plots each track's own live data with the `v*1.5` boost, dims a muted track, and draws a flat line with no data.** Acceptance: a fake-canvas-context test mirroring `volumeMeterView.test.js`'s/`multitrackView.test.js`'s own convention.
- **SCOPES-004 — Placed above `multitrackView`, both present and sized whenever `multitrackPanel` itself is visible.** Acceptance: an extension of `tests/multitrackScreen.test.js`'s own `computeGenericLayout()` convention.
- **SCOPES-005 — No regressions.** Full unit suite passes; `node compiler/generate.js` shows no new warnings; `node build.mjs app` succeeds with no new loose ends (no command is authored at all - a click toggles mute the same way `multitrackView`'s own control strip already does, entirely inside the leaf's own controller).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No new authoring mechanism, no `capabilities.js` mapping - the leaf calls `domain/arrangement` directly, the same self-contained shape `multitrackView`'s own control strip already has.

## Scope boundaries

In scope: `renderers/canvas/scopesGeometry.js` (new, pure), `runtime/scopesController.js` (new), `runtime/behaviors.js`/`runtime/componentTypes.js`/`renderers/canvas/drawKinds.js` registrations, `components/multitrackPanel.yaml`'s new sibling, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **"wave"/"spectrum" modes** - dead code in v1, nothing to port.
- **The skin-atlas sprite background** and **the adaptive low-framerate FFT-size shrink** - see Decisions.
- **The piano** - P11's last remaining surface, a later spec's own.
- **The classic pattern grid's own screen** - the still-open P7 gap recorded again in spec 053, unrelated to this spec.
