# 052 — Design

## Overview

```
domain/playback/index.js (extended)
  getTrackScopeData(track, target: Uint8Array) -> Uint8Array | null
    lazily creates+connects one AnalyserNode per track (growing on demand),
    fills `target` via getByteTimeDomainData, returns it (or null if no
    audio context / out-of-range track).

domain/playback/silentContext.js (extended)
  StubNode gains getByteTimeDomainData(array) -> fills with 128 (silence)

domain/arrangement/index.js (extended)
  getTrackScopeData(track, target) -> forwards to domain/playback

renderers/canvas/multitrackGeometry.js (new, pure)
  constants: HEADER_HEIGHT, SCROLLBAR_SIZE, MIN_TRACK_H, CTRL_WIDTH,
             MIN_PPS, MAX_PPS, SCOPE_LEFT, SCOPE_WIDTH, DEFAULT_VISIBLE_TRACKS
  trackHeightFor(rect, visibleTracks) -> number
  stepToX(step, pixelsPerStep, scrollX) / xToStep(localX, pixelsPerStep, scrollX)
  trackAtY(localY, scrollY, trackHeight) / localTrackY(localY, scrollY, track, trackHeight)
  maxScrollX(rect, patternLength, pixelsPerStep) / maxScrollY(rect, trackCount, trackHeight)
  clampScrollX(x, ...) / clampScrollY(y, ...)
  applyHorizontalThumbDelta(deltaX, startScrollX, rect, patternLength, pixelsPerStep)
  applyVerticalThumbDelta(deltaY, startScrollY, rect, trackCount, trackHeight)
  hScrollbarMetrics(rect, patternLength, pixelsPerStep, scrollX) -> {x,y,width,height} | null
  vScrollbarMetrics(rect, trackCount, trackHeight, scrollY) -> {x,y,width,height} | null
  hitRegion(local, rect) -> "vscrollbar"|"hscrollbar"|"ruler"|"controls"|"lane"|null
  findBlockAt(blocks, step) -> block | null
  controlButtonAt(localX, localY, trackHeight) -> "solo"|"mute"|"record"|null
  controlButtonRect(button, trackHeight) -> {x,y,width,height}

runtime/multitrackController.js (new)
  createMultitrackController(initial) -> { handle(input), setDisabled, setRecordHandler(fn), state }

runtime/behaviors.js: multitrack -> createMultitrackController
runtime/componentTypes.js: multitrackView { behavior: "multitrack", draw: "multitrackView", ticks: true, ... }
renderers/canvas/drawKinds.js: multitrackView { measure(), draw(ctx, assets, style, rect, label, state) }
renderers/canvas/mountGeneric.js: contextFor's behavior switch gains "multitrack" -> extra.ctrlKey = pointerModifiers.ctrl
```

## `domain/playback/index.js` addition

```js
let trackAnalysers = [];

function ensureTrackAnalysers() {
    if (!Audio.context) return;
    const count = Tracker.getTrackCount();
    while (trackAnalysers.length < count) {
        const analyser = Audio.context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0;
        const idx = trackAnalysers.length;
        trackAnalysers.push(analyser);
        if (Audio.filterChains && Audio.filterChains[idx]) {
            try { Audio.filterChains[idx].output().connect(analyser); } catch (e) {}
        }
    }
}

/**
 * Live time-domain samples for one track's own audio (spec 052) - the
 * mechanism the plain live oscilloscope needs. Grows the analyser array to
 * match the current track count on demand, rather than reacting to
 * EVENT.trackCountChange the way v1's own multitrack.js#_addAnalyser does -
 * the same "consolidate v1's own event-driven bookkeeping into a direct,
 * idempotent call" choice spec 051 already made for mute/solo.
 */
export function getTrackScopeData(track, target) {
    ensureTrackAnalysers();
    const analyser = trackAnalysers[track];
    if (!analyser) return null;
    analyser.getByteTimeDomainData(target);
    return target;
}
```

`ensureTrackAnalysers`'s own connection loop mirrors `multitrack.js#_connectAnalysers` (337-346), minus the re-connect-on-every-call v1 does (unnecessary here since a connection, once made, stays made for that analyser's own lifetime - only new analysers past the previous count ever need connecting).

## `domain/playback/silentContext.js` addition

```js
class StubNode {
    ...
    getByteTimeDomainData(array) {
        array.fill(128); // silence, matching Web Audio's own real convention for time-domain data
    }
}
```

## `domain/arrangement/index.js` addition

```js
import { ..., getTrackScopeData as playbackScopeData } from "../playback/index.js";

export function getTrackScopeData(track, target) {
    return playbackScopeData(track, target);
}
```

## `renderers/canvas/multitrackGeometry.js`

Ported directly from `multitrack.js`'s own formulas (`_getTrackHeight`, `_getMaxScrollX/Y`, `_applyHorizontal/VerticalThumbDelta`, `_updateScrollbars`, `onDragStart`'s own region dispatch) and `dawtrack.js`'s own control-button layout (`panel.setTrackHeight`, 164-177) - see requirements.md's own line citations. All pure: a rect, some counts, no domain import, no canvas - the same contract `waveformGeometry.js`/`loopCreatorGeometry.js`/`patternGridGeometry.js` already have.

```js
export const HEADER_HEIGHT = 20;
export const SCROLLBAR_SIZE = 16;
export const MIN_TRACK_H = 24;
export const CTRL_WIDTH = 220;
export const MIN_PPS = 4;
export const MAX_PPS = 128;
export const SCOPE_LEFT = 36;
export const SCOPE_WIDTH = 132;
export const DEFAULT_VISIBLE_TRACKS = 4; // replaces v1's own Layout.visibleTracks - see requirements.md's Decisions

export function trackHeightFor(rect, visibleTracks = DEFAULT_VISIBLE_TRACKS) {
    const available = rect.height - HEADER_HEIGHT;
    return Math.max(MIN_TRACK_H, Math.floor(available / Math.max(1, visibleTracks)));
}

export function stepToX(step, pixelsPerStep, scrollX) { return CTRL_WIDTH + step * pixelsPerStep - scrollX; }
export function xToStep(localX, pixelsPerStep, scrollX) { return Math.floor((scrollX + localX - CTRL_WIDTH) / pixelsPerStep); }
export function trackAtY(localY, scrollY, trackHeight) { return Math.floor((scrollY + localY - HEADER_HEIGHT) / trackHeight); }
export function localTrackY(localY, scrollY, track, trackHeight) { return scrollY + localY - HEADER_HEIGHT - track * trackHeight; }

export function maxScrollX(rect, patternLength, pixelsPerStep) {
    return Math.max(0, patternLength * pixelsPerStep - (rect.width - CTRL_WIDTH));
}
export function maxScrollY(rect, trackCount, trackHeight) {
    return Math.max(0, trackCount * trackHeight - (rect.height - HEADER_HEIGHT));
}
export function clampScrollX(x, rect, patternLength, pixelsPerStep) {
    return Math.max(0, Math.min(maxScrollX(rect, patternLength, pixelsPerStep), x));
}
export function clampScrollY(y, rect, trackCount, trackHeight) {
    return Math.max(0, Math.min(maxScrollY(rect, trackCount, trackHeight), y));
}

// Ported from multitrack.js#_applyHorizontalThumbDelta/_applyVerticalThumbDelta (399-425).
export function applyHorizontalThumbDelta(deltaX, startScrollX, rect, patternLength, pixelsPerStep) {
    const contentW = rect.width - CTRL_WIDTH;
    const totalW = patternLength * pixelsPerStep;
    if (totalW <= contentW) return startScrollX;
    const thumbW = Math.max(SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
    const thumbRangeX = contentW - thumbW;
    if (thumbRangeX <= 0) return startScrollX;
    return clampScrollX(startScrollX + deltaX * (totalW - contentW) / thumbRangeX, rect, patternLength, pixelsPerStep);
}
export function applyVerticalThumbDelta(deltaY, startScrollY, rect, trackCount, trackHeight) {
    const contentH = rect.height - HEADER_HEIGHT;
    const totalMaxScrollY = maxScrollY(rect, trackCount, trackHeight);
    if (totalMaxScrollY <= 0) return startScrollY;
    const totalH = trackCount * trackHeight;
    const thumbH = Math.max(SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
    const thumbRangeY = contentH - thumbH;
    if (thumbRangeY <= 0) return startScrollY;
    return clampScrollY(startScrollY + deltaY * totalMaxScrollY / thumbRangeY, rect, trackCount, trackHeight);
}

// Ported from multitrack.js#_updateScrollbars (485-513) - geometry only, no drawing.
export function hScrollbarMetrics(rect, patternLength, pixelsPerStep, scrollX) {
    const contentW = rect.width - CTRL_WIDTH;
    const totalW = patternLength * pixelsPerStep;
    if (totalW <= contentW) return null;
    const thumbW = Math.max(SCROLLBAR_SIZE, Math.floor(contentW * contentW / totalW));
    const maxThumbX = contentW - thumbW;
    const thumbX = CTRL_WIDTH + Math.floor((scrollX / (totalW - contentW)) * maxThumbX);
    return { x: rect.x + thumbX, y: rect.y + rect.height - SCROLLBAR_SIZE, width: thumbW, height: SCROLLBAR_SIZE };
}
export function vScrollbarMetrics(rect, trackCount, trackHeight, scrollY) {
    const contentH = rect.height - HEADER_HEIGHT;
    const totalMaxScrollY = maxScrollY(rect, trackCount, trackHeight);
    if (totalMaxScrollY <= 0) return null;
    const totalH = trackCount * trackHeight;
    const thumbH = Math.max(SCROLLBAR_SIZE, Math.floor(contentH * contentH / totalH));
    const maxThumbY = contentH - thumbH;
    const thumbY = HEADER_HEIGHT + Math.floor((scrollY / totalMaxScrollY) * maxThumbY);
    return { x: rect.x + rect.width - SCROLLBAR_SIZE, y: rect.y + thumbY, width: SCROLLBAR_SIZE, height: thumbH };
}

// Ported from multitrack.js#onDragStart's own region dispatch (215-255), minus the note-vs-timeline decision (the caller's own, since it needs domain data this pure module does not import).
export function hitRegion(local, rect) {
    if (local.x >= rect.width - SCROLLBAR_SIZE && local.y >= HEADER_HEIGHT) return "vscrollbar";
    if (local.y >= rect.height - SCROLLBAR_SIZE && local.x >= CTRL_WIDTH) return "hscrollbar";
    if (local.y < HEADER_HEIGHT && local.x >= CTRL_WIDTH) return "ruler";
    if (local.x < CTRL_WIDTH && local.y >= HEADER_HEIGHT) return "controls";
    if (local.x >= CTRL_WIDTH) return "lane";
    return null;
}

/** Ported from multitrack.js#_getNoteBlockAt (536-547), against an already-fetched per-track block array. */
export function findBlockAt(blocks, step) {
    if (!blocks) return null;
    for (const block of blocks) {
        if (step >= block.startStep && step < block.endStep) return block;
    }
    return null;
}

// Ported from dawtrack.js#panel.setTrackHeight (164-177) - three 26x26 buttons, evenly spaced, at the strip's own right edge.
const BUTTON_SIZE = 26;
export function controlButtonRect(button, trackHeight) {
    const buttonSpace = Math.floor((trackHeight - BUTTON_SIZE * 3) / 4);
    const x = CTRL_WIDTH - BUTTON_SIZE - 7;
    const order = { solo: 0, mute: 1, record: 2 };
    const y = buttonSpace * (order[button] + 1) + BUTTON_SIZE * order[button];
    return { x, y, width: BUTTON_SIZE, height: BUTTON_SIZE };
}
export function controlButtonAt(localX, localY, trackHeight) {
    for (const button of ["solo", "mute", "record"]) {
        const r = controlButtonRect(button, trackHeight);
        if (localX >= r.x && localX <= r.x + r.width && localY >= r.y && localY <= r.y + r.height) return button;
    }
    return null;
}
```

## `runtime/multitrackController.js`

```js
import * as song from "../domain/song/index.js";
import * as arrangement from "../domain/arrangement/index.js";
import * as geo from "../renderers/canvas/multitrackGeometry.js";

export const MULTITRACK_STATE_FIELDS = ["hover", "focused", "disabled", "scrollX", "scrollY", "pixelsPerStep", "dragMode", "dragNote"];

export function createMultitrackController(options = {}) {
    const state = {
        hover: false, focused: false, disabled: Boolean(options.disabled),
        scrollX: 0, scrollY: 0, pixelsPerStep: 14,
        dragMode: null, dragNote: null
    };
    let dragStart = { scrollX: 0, scrollY: 0, localX: 0, localY: 0 };
    let recordHandler = null;

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function seekTo(rect, localX) {
        const patternLength = song.getPatternLength();
        let step = geo.xToStep(localX, state.pixelsPerStep, state.scrollX);
        step = Math.max(0, Math.min(patternLength - 1, step));
        song.setCurrentPatternPos(step);
    }

    function trackHeight(rect) { return geo.trackHeightFor(rect); }

    function handle(input) {
        const transitions = [];
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); break;
            case "pointerleave": set("hover", false, transitions); break;
            case "focus": set("focused", true, transitions); break;
            case "blur":
                set("focused", false, transitions);
                set("dragMode", null, transitions);
                state.dragNote = null;
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                if (!input.rect || !input.local) break;
                const region = geo.hitRegion(input.local, input.rect);
                const th = trackHeight(input.rect);
                const trackCount = song.getTrackCount();
                const patternLength = song.getPatternLength();

                if (region === "vscrollbar") {
                    dragStart = { ...dragStart, scrollY: state.scrollY, localY: input.local.y };
                    set("dragMode", "vscrollbar", transitions);
                } else if (region === "hscrollbar") {
                    dragStart = { ...dragStart, scrollX: state.scrollX, localX: input.local.x };
                    set("dragMode", "hscrollbar", transitions);
                } else if (region === "ruler") {
                    seekTo(input.rect, input.local.x);
                    set("dragMode", "seek", transitions);
                } else if (region === "controls") {
                    const track = geo.trackAtY(input.local.y, state.scrollY, th);
                    const localY = geo.localTrackY(input.local.y, state.scrollY, track, th);
                    if (track >= 0 && track < trackCount) {
                        const button = geo.controlButtonAt(input.local.x, localY, th);
                        if (button === "solo") arrangement.toggleTrackSolo(track);
                        else if (button === "mute") arrangement.toggleTrackMute(track);
                        else if (button === "record" && recordHandler) recordHandler(track);
                    }
                } else if (region === "lane") {
                    const track = geo.trackAtY(input.local.y, state.scrollY, th);
                    const step = geo.xToStep(input.local.x, state.pixelsPerStep, state.scrollX);
                    const blocks = (track >= 0 && track < trackCount) ? arrangement.getPerTrackBlocks(song.getCurrentPattern())[track] : null;
                    const block = (step >= 0 && step < patternLength) ? geo.findBlockAt(blocks, step) : null;
                    if (block) {
                        state.dragNote = {
                            sourceTrack: track, sourceStep: block.startStep,
                            targetTrack: track, targetStep: block.startStep,
                            offsetStep: step - block.startStep
                        };
                        set("dragMode", "note", transitions);
                    } else {
                        dragStart = { ...dragStart, scrollX: state.scrollX, localX: input.local.x };
                        set("dragMode", "timeline", transitions);
                    }
                }
                handled = region !== null;
                break;
            }

            case "drag": {
                if (state.disabled || !state.dragMode || !input.rect || !input.local) break;
                const th = trackHeight(input.rect);
                const trackCount = song.getTrackCount();
                const patternLength = song.getPatternLength();

                if (state.dragMode === "seek") {
                    seekTo(input.rect, input.local.x);
                } else if (state.dragMode === "timeline") {
                    state.scrollX = geo.clampScrollX(dragStart.scrollX - (input.local.x - dragStart.localX), input.rect, patternLength, state.pixelsPerStep);
                } else if (state.dragMode === "hscrollbar") {
                    state.scrollX = geo.applyHorizontalThumbDelta(input.local.x - dragStart.localX, dragStart.scrollX, input.rect, patternLength, state.pixelsPerStep);
                } else if (state.dragMode === "vscrollbar") {
                    state.scrollY = geo.applyVerticalThumbDelta(input.local.y - dragStart.localY, dragStart.scrollY, input.rect, trackCount, th);
                } else if (state.dragMode === "note" && state.dragNote) {
                    let targetTrack = geo.trackAtY(input.local.y, state.scrollY, th);
                    targetTrack = Math.max(0, Math.min(trackCount - 1, targetTrack));
                    let step = geo.xToStep(input.local.x, state.pixelsPerStep, state.scrollX) - state.dragNote.offsetStep;
                    step = Math.max(0, Math.min(patternLength - 1, step));
                    state.dragNote = { ...state.dragNote, targetTrack, targetStep: step };
                }
                handled = true;
                break;
            }

            case "pointerup": {
                if (state.dragMode === "note" && state.dragNote) {
                    const n = state.dragNote;
                    if (n.sourceTrack !== n.targetTrack || n.sourceStep !== n.targetStep) {
                        arrangement.moveNote(n.sourceTrack, n.sourceStep, n.targetTrack, n.targetStep);
                    }
                }
                handled = state.dragMode !== null;
                set("dragMode", null, transitions);
                state.dragNote = null;
                break;
            }

            case "wheel": {
                if (state.disabled || !input.rect) break;
                const patternLength = song.getPatternLength();
                const trackCount = song.getTrackCount();
                const th = trackHeight(input.rect);
                const deltaX = input.deltaX || 0;
                const deltaY = input.deltaY || 0;

                if (input.ctrlKey && input.local) {
                    const localX = input.local.x;
                    const mouseStep = (state.scrollX + localX - geo.CTRL_WIDTH) / state.pixelsPerStep;
                    const factor = deltaY > 0 ? 1.1 : 1 / 1.1;
                    state.pixelsPerStep = Math.max(geo.MIN_PPS, Math.min(geo.MAX_PPS, state.pixelsPerStep * factor));
                    state.scrollX = geo.clampScrollX(mouseStep * state.pixelsPerStep - (localX - geo.CTRL_WIDTH), input.rect, patternLength, state.pixelsPerStep);
                } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    state.scrollX = geo.clampScrollX(state.scrollX - deltaX * 0.5, input.rect, patternLength, state.pixelsPerStep);
                } else {
                    state.scrollY = geo.clampScrollY(state.scrollY - deltaY * 0.5, input.rect, trackCount, th);
                }
                handled = true;
                break;
            }

            default: break;
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) { set("dragMode", null, transitions); state.dragNote = null; }
        return transitions;
    }

    /** Not part of handle()'s own input vocabulary - a later screen spec's own seam, mirroring nibblesController's separation of input handling from screen wiring. Defaults to a no-op (see requirements.md's Decisions: no FX panel exists to wire this to yet). */
    function setRecordHandler(fn) { recordHandler = typeof fn === "function" ? fn : null; }

    return { handle, setDisabled, setRecordHandler, get state() { return { ...state, dragNote: state.dragNote ? { ...state.dragNote } : null }; } };
}
```

## `renderers/canvas/drawKinds.js` (new `multitrackView` entry)

Reads `domain/song` (track count, pattern length/position) and `domain/arrangement` (blocks, effects, mute/solo, scope data) directly - no bound field, the same contract every specialized leaf's own draw kind already has. `state` (scrollX/scrollY/pixelsPerStep/dragMode/dragNote) comes from the controller generically, the same way `waveformView`'s `zoomStart`/`zoomLength` already does.

Draws, per visible lane: an alternating lane background, vertical grid lines every 16 steps, one rectangle per block (a flat instrument-colored fill, its own name text - no waveform thumbnail, see requirements.md), the effects strip (hex effect/param text under the blocks), the control strip (background, three buttons tinted by `getTrackMuteSolo`), and the live oscilloscope line (`getTrackScopeData`, a flat dim line when muted or absent). Then, once for the whole leaf: the header ruler (step numbers every 16 steps), the playhead line, a drag ghost while `dragMode === "note"`, and both scrollbars when `hScrollbarMetrics`/`vScrollbarMetrics` return non-null.

`measure()` returns `{ width: 500, height: 200 }`, a floor size in the same spirit as every other specialized leaf's own.

## `renderers/canvas/mountGeneric.js`

One new branch in `contextFor`'s behavior switch, next to `"loopCreator"`:

```js
} else if (behavior === "multitrack") {
    // multitrackView (spec 052): like "waveform"/"loopCreator", no
    // mockState read at all - the controller reads/writes domain/song and
    // domain/arrangement directly. Only the ctrl modifier (pan vs. zoom on
    // wheel) is resolved here.
    extra.ctrlKey = pointerModifiers.ctrl;
}
```

## Data models

Controller state's `dragNote` (`{sourceTrack, sourceStep, targetTrack, targetStep, offsetStep}` or `null`) is read by the draw kind for the drag-ghost only - never written to `app.state`, the same "specialized leaf owns its own interaction state" contract every prior leaf already has.

## Error handling

- **No rect/local on `pointerdown`/`drag`** (not reachable through `mountGeneric.js`'s own dispatch, but guarded the same way every other controller here already is): the branch does nothing, `handled` stays false.
- **`region === null`** (a `pointerdown` inside the leaf's own bounds should always resolve to a region given `hitRegion`'s own five-way coverage of the whole rect, but a rect narrower than `CTRL_WIDTH` could leave a sliver unmatched): `handled` stays false, no `dragMode` set.
- **Wheel with no `ctrlKey`/no `local`** (a plain scroll never needs `local` at all): the `ctrlKey` branch is skipped outright since `input.local` is checked before use.
- **`getTrackScopeData` before any audio context exists**: returns `null` (checked at `ensureTrackAnalysers`'s own `if (!Audio.context) return;` guard, leaving `trackAnalysers` empty); the draw kind treats `null` as "draw a flat line", the same visual v1 gives a muted track.

## Testing strategy

- **`tests/multitrackGeometry.test.js`** (new): every pure function above, including `hitRegion`'s five-way coverage of a rect's own edges/corners, `findBlockAt`'s boundary cases, and `controlButtonAt`'s three buttons plus a miss, mirroring `loopCreatorGeometry.test.js`'s own convention.
- **`tests/multitrackController.test.js`** (new): wheel scroll/zoom-around-pointer (VIEW-001), scrollbar thumb drag changing the offset by the expected ratio (VIEW-002), the three initial-gesture branches from a `pointerdown` (VIEW-003), a full note-drag-and-release calling `arrangement.moveNote` exactly once against a real loaded fixture (VIEW-004), and solo/mute/record button hits (VIEW-006) - all against a real loaded fixture, the same way `nibblesController.test.js`/`loopCreatorController.test.js` already are.
- **`tests/multitrackView.test.js`** (new): a fake-canvas-context test mirroring `waveformView.test.js`'s/`loopCreatorView.test.js`'s own convention - registry declaration, `measure()`'s floor size, draw-never-throws with an empty pattern and with real blocks/effects, the muted-track flat scope line appearing exactly once.
- **`tests/playback.test.js`** (extended): `getTrackScopeData` growing on demand and returning byte data, against a real loaded fixture.
- `node --test tests/*.test.js` passes. This spec touches no YAML/`capabilities.js` - `multitrackView` is registered but not yet placed in any component tree, matching `loopCreatorView`'s own precedent between specs 044 and 045; `node compiler/generate.js`/`node build.mjs app` confirmed unaffected by an unchanged run.

## What this deliberately does not do

See requirements.md's Scope boundaries: no waveform thumbnails, no scale-9 block panel image, no real record-button destination, no menu bar, no classic-grid header, no screen wiring, no dynamic cursor hinting, no `Layout.visibleTracks` breakpoint integration.
