// The one table from a declared behavior name to a controller factory (spec
// 014), exactly as renderers/canvas/drawKinds.js is the one table from a
// declared draw kind to pixels.
//
// A component type says `behavior: "value"` in runtime/componentTypes.js and
// gets the value controller, with whatever `behaviorOptions` it declared.
// Nothing outside this file maps a type name to a controller, so adding an
// interactive type stays one registry entry.
//
// Every controller has the same three members, which is what lets the
// renderer keep one `feed()`:
//   handle(input) -> { transitions, activated, blocked, handled, ... }
//   setDisabled(disabled) -> transitions
//   get state()
// A controller may add result fields of its own (`changed` and `value` for a
// value control, `scrollTo` for a scroller); a caller that does not know
// about them simply does not read them.

import { createButtonController } from "./buttonController.js";
import { createValueController } from "./valueController.js";
import { createScrollController } from "./scrollController.js";
import { createTextController } from "./textController.js";
import { createListController } from "./listController.js";
import { createSubmenuController } from "./submenuController.js";
import { createNumberDisplayController } from "./numberDisplayController.js";
import { createGridController } from "./gridController.js";
import { createFileBrowserController } from "./fileBrowserController.js";
import { createWaveformController } from "./waveformController.js";
import { createLoopCreatorController } from "./loopCreatorController.js";
import { createNibblesController } from "./nibblesController.js";
import { createMultitrackController } from "./multitrackController.js";
import { createVuMeterController } from "./vuMeterController.js";
import { createEnvelopeController } from "./envelopeController.js";
import { createScopesController } from "./scopesController.js";
import { createPianoController } from "./pianoController.js";
import { createTrackControlController } from "./trackControlController.js";
import { createNotificationLightController } from "./notificationLightController.js";

export const BEHAVIORS = {
    /** Press, release, Enter and Space activate a command. */
    button: createButtonController,
    /** Drag and wheel move one bounded number. */
    value: createValueController,
    /** Wheel, drag and thumb move a viewport's scroll offset. */
    scroll: createScrollController,
    /** A caret, a selection, and typing (spec 015). */
    text: createTextController,
    /** Click-to-select an item plus wheel/drag-to-scroll (spec 019). */
    list: createListController,
    /**
     * A dropdown's own closed control (spec 020): a second name for the exact
     * same button controller, since a dropdown's click is a plain
     * press/release/Enter/Space activation - only what the renderer *does*
     * with that activation (toggle its popup, rather than dispatch a
     * command) differs, and that lives in mountGeneric.js, gated on this
     * behavior name, not on a second controller.
     */
    disclose: createButtonController,
    /** Hover-to-preselect, click-to-execute-by-index, disabled items (spec 020). */
    flyout: createSubmenuController,
    /**
     * A tabPanel's own tab-switching (spec 021): a second name for the exact
     * same list controller listbox uses - a press-and-release on a resolved
     * index selects it - since mountGeneric.js supplies `scrollable: false`
     * for a tab strip, so nothing about dragging or the wheel ever fires.
     */
    tabs: createListController,
    /**
     * A collapsePanel's own header click (spec 021): a third name for the
     * plain button controller, alongside `disclose` - only what the renderer
     * *does* with the activation (toggle a bound boolean field, rather than
     * open a popup or dispatch a command) differs, and that lives in
     * mountGeneric.js, gated on this behavior name.
     */
    collapsible: createButtonController,
    /**
     * numberDisplay's own controller (spec 027): a fixed-width, left-padded
     * digit string with a caret, re-parsed as an integer and clamped (never
     * snapped to a step grid) on every edit - close enough to both `value`
     * and `text` to borrow a shape from each, but not the same as either, so
     * it gets its own factory rather than an alias.
     */
    digitEntry: createNumberDisplayController,
    /**
     * patternGrid's own controller (spec 030): reads and writes domain/song
     * directly rather than a bound field - the specialized-component
     * contract's one behavior, not a generic value/scroll/list shape.
     */
    grid: createGridController,
    /**
     * fileBrowser's own controller (spec 035): the specialized-component
     * contract's second leaf - a scrollable, hierarchical list whose rows
     * are runtime data, not authored children, so click-to-select and
     * wheel/drag-to-scroll are computed from a bound row array (via
     * renderers/canvas/fileBrowserGeometry.js) instead of listController.js's
     * own child-rect/layout-extent assumptions. Named "rowList" rather than
     * reusing this type's own name, so the type-name-branch scanning test
     * (tests/componentTypes.test.js) stays meaningful - equal names would
     * otherwise collide in every behavior check this spec adds to
     * mountGeneric.js.
     */
    rowList: createFileBrowserController,
    /**
     * waveformView's own controller (spec 041): the specialized-component
     * contract's third leaf - reads/writes domain/song and
     * domain/sampleEditor directly, the same contract "grid" already has
     * (patternGrid), since a waveform view is tied to exactly one thing
     * (the current instrument's sample), not a generic container the way
     * "rowList" deliberately is. Named "waveform", not "waveformView", for
     * the same type-name-collision reason "rowList"/"grid" are named apart
     * from their own types.
     */
    waveform: createWaveformController,
    /**
     * loopCreatorView's own controller (spec 044): the specialized-component
     * contract's fourth leaf - eleven independent drag targets (two loop
     * markers, three blend-size handles, three blend-volume lines, three
     * "original volume" lines), each calling the exact domain setter spec
     * 043 already built and clamps against. Reads/writes
     * domain/sampleEditor/loopCreator.js directly, the same contract
     * "waveform" already has. Named "loopCreator", not "loopCreatorView",
     * for the same type-name-collision reason "waveform"/"rowList"/"grid"
     * are named apart from their own types.
     */
    loopCreator: createLoopCreatorController,
    /**
     * nibblesGrid's own controller (spec 047): the specialized-component
     * contract's fifth leaf - reads/writes domain/nibbles/index.js
     * directly, the same contract "grid"/"waveform"/"loopCreator" already
     * have. Also exposes `onFrame(deltaMs)`, called directly by
     * mountGeneric.js's own new tick clock rather than through handle()'s
     * pointer/keyboard/focus vocabulary. Named "nibbles", not "nibblesGrid",
     * for the same type-name-collision reason every other specialized
     * leaf's own behavior is named apart from its type.
     */
    nibbles: createNibblesController,
    /**
     * multitrackView's own controller (spec 052): the specialized-component
     * contract's sixth leaf - reads/writes domain/song and
     * domain/arrangement directly, the same contract "grid"/"waveform"/
     * "loopCreator"/"nibbles" already have. `ticks: true` keeps the
     * renderer's own tick clock alive while mounted so the live oscilloscope
     * keeps redrawing without further input, the same reason nibblesGrid
     * needs it - but this controller has no `onFrame` of its own, since
     * nothing here needs a per-frame simulation step; `markNeedsDraw()`
     * alone (mountGeneric.js's own tick loop, unconditional per tick) is
     * enough. Named "multitrack", not "multitrackView", for the same
     * type-name-collision reason every other specialized leaf's own
     * behavior is named apart from its type.
     */
    multitrack: createMultitrackController,
    /**
     * volumeMeter's own controller (spec 054): the specialized-component
     * contract's seventh leaf - reads domain/playback directly, the same
     * contract "grid"/"waveform"/"loopCreator"/"nibbles"/"multitrack"
     * already have, but with no real gesture vocabulary at all (v1's own
     * VUMeter has none either) - it exists only so `ticks: true` has a
     * controller to call `onFrame` through (this one has none; the tick
     * clock's own unconditional `markNeedsDraw()` is enough). Named
     * "vuMeter", not "volumeMeter", for the same type-name-collision reason
     * every other specialized leaf's own behavior is named apart from its
     * type.
     */
    vuMeter: createVuMeterController,
    /**
     * envelopeView's own controller (spec 056): the specialized-component
     * contract's eighth leaf - reads/writes domain/sampleEditor/envelope.js
     * directly, the same contract "grid"/"waveform"/"loopCreator"/
     * "nibbles"/"multitrack"/"vuMeter" already have. Its own
     * `options.envelopeType` ("volume"/"panning") is the first per-node
     * variant any specialized leaf here needs - see componentTypes.js's own
     * `envelopeType` property and mountGeneric.js's controller-construction
     * loop, which reads it the same way `node.vertical` already overrides
     * rangeSlider's own axis. Named "envelope", not "envelopeView", for the
     * same type-name-collision reason every other specialized leaf's own
     * behavior is named apart from its type.
     */
    envelope: createEnvelopeController,
    /**
     * scopesView's own controller (spec 058): the specialized-component
     * contract's ninth leaf - reads domain/song/domain/arrangement
     * directly, the same contract "grid"/"waveform"/"loopCreator"/
     * "nibbles"/"multitrack"/"vuMeter"/"envelope" already have. No new
     * domain work at all - a click just finds which cell it landed on and
     * forwards to domain/arrangement#toggleTrackMute (spec 051), already
     * the same mechanism multitrackView's own control strip uses. Named
     * "scopes", not "scopesView", for the same type-name-collision reason
     * every other specialized leaf's own behavior is named apart from its
     * type.
     */
    scopes: createScopesController,
    /**
     * pianoView's own controller (spec 061): the specialized-component
     * contract's tenth leaf - reads domain/song#getCurrentOctave and calls
     * domain/playback#previewNoteOn/previewNoteOff (spec 060) directly, the
     * same contract "grid"/"waveform"/"loopCreator"/"nibbles"/"multitrack"/
     * "vuMeter"/"envelope"/"scopes" already have. Named "piano", not
     * "pianoView", for the same type-name-collision reason every other
     * specialized leaf's own behavior is named apart from its type.
     */
    piano: createPianoController,
    /**
     * trackControl's own controller (spec 074): the specialized-component
     * contract's eleventh leaf - reads domain/song#getTrackCount/inFTMode
     * and calls domain/arrangement#toggleTrackMute/toggleTrackSolo (spec
     * 051) directly, the same contract "scopes" already has. Named
     * "trackControl" - it has no "...View"-suffixed type name to collide
     * with, unlike its specialized-leaf siblings.
     */
    trackControl: createTrackControlController,
    /**
     * notificationLight's own controller (spec 083): the specialized-component
     * contract's twelfth leaf - no gesture vocabulary at all (v1's own real
     * light is `ignoreEvents = true`), a controller exists purely so
     * `ticks: true` takes effect, the same reason vuMeter needs one.
     */
    notificationLight: createNotificationLightController
};

export const BEHAVIOR_NAMES = Object.keys(BEHAVIORS);

/**
 * @param {string|null} name a behavior from BEHAVIORS
 * @param {object} [options] the type's `behaviorOptions`
 * @returns {object|null} a controller, or null for a type with no behavior
 */
export function createBehaviorController(name, options = {}) {
    const factory = BEHAVIORS[name];
    return factory ? factory(options) : null;
}
