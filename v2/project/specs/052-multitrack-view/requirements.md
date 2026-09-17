# 052 — The interactive multitrack view

Date: 2026-09-15. Kind: feature. Status: specified. Continues package **P11** (the remaining specialized surfaces) of the [port roadmap](../010-port-roadmap/requirements.md), following spec 051 (the multitrack arrangement view's headless engine). Gives that mechanism its interactive front end - the port's sixth specialized-component leaf, after `patternGrid` (030), `fileBrowser` (035), `waveformView` (041), `loopCreatorView` (044) and `nibblesGrid` (047).

## Purpose

Spec 051 built the per-track segmentation, move-note editing and the real mute/solo audio effect headlessly. This spec is the interaction and the drawing: `multitrack.js` (803 lines) and `dawtrack.js` (449 lines), read in full for spec 051 already, together implement one canvas view with horizontal and vertical scrolling, horizontal zoom, seek-by-click, drag-to-move-note, a live per-track oscilloscope, and a per-track solo/mute/record control strip. Matching the split every prior multi-part specialized leaf has used (loop creator: 043 engine, 044 overlay; Nibbles: 047 engine+leaf combined, since it was smaller), this spec builds the controller and draw kind only - not the menu bar, not the classic grid's own smaller mute/solo header, not the screen wiring that reaches this view from anywhere at all. Nothing authors this type in any component tree yet, the same "mechanism, not yet placed" state `loopCreatorView` was left in between specs 044 and 045.

## What v1 actually does, and what this narrows out (read from source, not assumed)

**Layout.** A fixed header strip (`_HEADER_HEIGHT = 20`, the ruler) above N horizontal lanes, each `_getTrackHeight()` tall (`max(_MIN_TRACK_H=24, floor((height - header) / Layout.visibleTracks))` - visible-track count comes from the same `Layout.visibleTracks` setting the classic grid's own breakpoint system already has, not from this view's own logic). Each lane is a fixed-width control strip (`CTRL_WIDTH = 220`, dawtrack.js) followed by the scrollable block/scope area.

**Scroll and zoom** (`onMouseWheel`, `onDragStart`/`onDrag`, 189-307). Plain wheel scrolls vertically (lane-to-lane); shift-axis wheel (`deltaX` dominant) or a drag starting in the block area scrolls horizontally; a wheel with the meta key held zooms horizontally around the pointer (`_pixelsPerStep` from `_MIN_PPS=4` to `_MAX_PPS=128`), recentering so the point under the pointer stays put. Both scrollbars are draggable directly (`_applyHorizontalThumbDelta`/`_applyVerticalThumbDelta`, 399-425) with v1's own thumb-size/travel-ratio formulas.

**Seek.** A pointer-down in the header strip, or any drag starting there, sets the current pattern position from the clicked step (`_seekToX`).

**Move note.** A pointer-down on an existing note block (found via `_getNoteBlockAt`, using spec 051's own `getPerTrackBlocks`) starts a drag that snaps to whole steps/tracks, drawing a yellow ghost block at the candidate destination (`_drawDragGhost`) and committing the move (`domain/song#moveNote`, spec 051) only on release, exactly the same "commit on release, ghost while dragging" shape the pattern grid's own selection drag already uses conceptually, though this is the first specialized leaf to drag a *block* rather than a cell or a marker.

**The live oscilloscope** (`dawtrack.js#drawScopeTo`, 407-437). Each lane draws its own track's `AnalyserNode.getByteTimeDomainData` as a small line plot, muted tracks drawn as a flat, dimmed line instead - the same "real audio effect visualized" territory spec 051's own mute/solo mechanism already made real, now drawn. `SCOPE_WIDTH`/`SCOPE_LEFT` (132px starting at x=36 inside the 220px control strip) leave room for the solo/mute/record buttons beside it.

**The per-track control strip** (`dawtrack.js#createTrackControls`, 97-187). Three buttons (Solo "S", Mute "M", Record, a scale-9 background image) - Solo/Mute call `EVENT.trackStateChange` (spec 051's own consolidated `domain/arrangement#setTrackSolo`/`setTrackMute` now), Record calls `EVENT.fxPanelToggle` (no v2 equivalent exists at all - out of scope, see below).

**Block/effect drawing** (`dawtrack.js#buildCache`, 261-397, cached per row and redrawn only when dirty). A tinted, scale-9-bordered block per note (waveform thumbnail drawn inside, scaled by the note's own volume), an instrument name and note name inside sufficiently wide/tall blocks, and an effects strip beneath the blocks showing each effect's own hex code and param. `getPerTrackBlocks`/`getPerTrackEffects` (spec 051) already supply exactly this data.

## Decisions and assumptions

- **Waveform thumbnails inside blocks are not ported.** `dawtrack.js#getWaveformCanvas` (57-95) is a real, per-instrument, per-color, per-height canvas cache, decorative rather than load-bearing - a block's own color (by instrument), name and boundaries already convey the arrangement. Recorded as a deliberate visual simplification, the same footing Nibbles' own level-sprite thumbnails and high-score dialog were left on (spec 047/049).
- **Blocks are drawn as a solid tinted rectangle with a name label, not a scale-9 bordered panel image.** `Y.getImage("samplepanel_blue")` is skin-atlas-specific asset plumbing this spec does not need to prove; a solid fill is the same simplification `nibblesGrid`'s own flat-color cells already made.
- **The record button is drawn and clickable, but wired to a controller-level hook, not a real feature.** `EVENT.fxPanelToggle` has no v2 destination at all (no FX panel exists anywhere in this port yet) - the button calls `onRecordClick(track)` if the leaf's host ever sets one (mirroring `nibblesController`'s own precedent of separating `handle()`'s input vocabulary from screen-level wiring), defaulting to a no-op. This keeps the control strip visually and positionally complete for the screen spec that follows, without inventing a fake feature.
- **Waveform-cache invalidation, dirty-rectangle row caching, and the separate off-screen `_blockCanvas`/`rowCanvas` compositing v1 uses for performance are not ported.** `renderers/canvas/mountGeneric.js`'s own coalesced-draw loop (spec 032) already redraws only when something is dirty; a second, private caching layer inside this one leaf would duplicate that mechanism for a view whose content (a handful of blocks per visible lane) is cheap to redraw directly every time it is asked to. Recorded as a performance-only omission, not a behavioral one.
- **The live oscilloscope needs one new mechanism**: reading a track's own live audio samples requires a `AnalyserNode` connected to that track's `FilterChain`, which only `domain/playback/engine/audio.js` can create. `domain/playback/index.js` gains `getTrackScopeData(track, target)` (lazily creates and connects one analyser per track, growing to match the current track count on demand rather than reacting to a `trackCountChange` event - the same "consolidate v1's own event-driven bookkeeping into a direct, idempotent call" choice spec 051 already made for mute/solo); `domain/arrangement/index.js` re-exports it as a thin forward, so the draw kind still reaches everything about this screen through one module. `domain/playback/silentContext.js#StubNode` gains a `getByteTimeDomainData` stub (fills with 128, i.e. silence) so this is testable headlessly at all.
- **Dynamic cursor hinting is not ported**, the same recorded omission `loopCreatorView` (spec 044) already made for the identical reason (a hover-dependent resize cursor), kept consistent rather than each specialized leaf inventing its own.
- **`Layout.visibleTracks`-driven lane count is replaced by "however many lanes fit the leaf's own current height"**, computed the same way from `rect.height` directly - this view's own rect already is whatever the (not-yet-authored) screen gives it, and no v2 equivalent of v1's own breakpoint-driven `Layout.visibleTracks` setting exists yet; a later screen spec can revisit this if a real breakpoint need appears.
- **This leaf owns its own scroll/zoom state**, not shared with any other leaf - the same "every specialized leaf owns its own window" precedent `loopCreatorView`'s own requirements.md already recorded.

## User stories and acceptance

- **VIEW-001 — Wheel scrolls vertically by default, horizontally when the shift axis dominates, and zooms horizontally with the meta/ctrl key held, recentering on the pointer.** Acceptance: controller unit tests for all three branches, including a zoom-then-verify-the-same-pointer-relative-step-stays-under-the-cursor check.
- **VIEW-002 — Both scrollbars are draggable and their thumb geometry matches v1's own formulas.** Acceptance: pure geometry unit tests (thumb size/position for a range of content/viewport sizes) plus a controller test that dragging a thumb changes the scroll offset by the expected ratio.
- **VIEW-003 — A pointer-down in the header strip (or a drag starting there) seeks; a drag starting in the block area either moves a note (if one is under the pointer) or pans.** Acceptance: controller unit tests for all three initial-gesture branches.
- **VIEW-004 — Dragging a note block moves it on release, snapped to whole steps/tracks, clamped to the pattern's own bounds; releasing over no valid target does nothing.** Acceptance: controller unit tests against a real loaded fixture, calling `domain/arrangement#moveNote` exactly once, only on release.
- **VIEW-005 — The draw kind never throws; draws the header ruler, one block per note with its own name and instrument color, the effects strip, the live oscilloscope (silent/flat when muted or when no analyser data exists), and the three-button control strip per visible lane.** Acceptance: a fake-canvas-context test mirroring `waveformView.test.js`'s/`loopCreatorView.test.js`'s own convention.
- **VIEW-006 — Clicking Solo/Mute in the control strip calls the matching `domain/arrangement` function for that lane's own track; clicking Record calls the controller's own `onRecordClick` hook (a no-op unless a host sets one).** Acceptance: controller unit tests for a hit on each of the three buttons.
- **VIEW-007 — `getTrackScopeData` lazily creates and connects exactly one analyser per track, growing (never shrinking) as the track count grows, and returns byte time-domain data every call.** Acceptance: unit tests against a real loaded fixture and the silent context's own new stub.
- **VIEW-008 — No regressions.** Full unit suite passes; `node build.mjs app`/`dist` unaffected (no YAML/compiler/`capabilities.js` change - this type is registered but not yet placed in any component tree).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).
- No new authoring mechanism, no YAML - `multitrackView` is registered but not yet placed in any component tree, exactly as `waveformView`/`loopCreatorView` each were between their own mechanism and screen specs.

## Scope boundaries

In scope: `renderers/canvas/multitrackGeometry.js` (new, pure), `domain/playback/index.js#getTrackScopeData` and `domain/playback/silentContext.js`'s stub extension, `domain/arrangement/index.js`'s thin forward, `runtime/multitrackController.js` (new), `runtime/behaviors.js`/`runtime/componentTypes.js`/`renderers/canvas/drawKinds.js` registrations, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **Waveform thumbnails inside blocks, and the scale-9 bordered block panel image** - see Decisions and assumptions; blocks draw as a solid tinted rectangle with a name label.
- **The record button's real destination** - drawn and clickable, wired only to a controller-level hook; no FX panel exists anywhere in this port to wire it to.
- **The menu bar, the classic grid's own smaller mute/solo header (`trackControl.js`), and the screen wiring** (a View-menu entry, layout, breakpoints) - a later spec's own, the same way spec 042/045/049/053(planned) were each a mechanism's own later screen.
- **Dynamic cursor hinting** - see Decisions and assumptions, matching spec 044's own recorded omission.
- **`Layout.visibleTracks`-driven lane sizing, and v1's own private off-screen row/block canvas caching** - see Decisions and assumptions.
