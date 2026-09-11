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

export const BEHAVIORS = {
    /** Press, release, Enter and Space activate a command. */
    button: createButtonController,
    /** Drag and wheel move one bounded number. */
    value: createValueController,
    /** Wheel, drag and thumb move a viewport's scroll offset. */
    scroll: createScrollController
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
