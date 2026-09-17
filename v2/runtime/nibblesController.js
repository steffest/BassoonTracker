// nibblesGrid's own controller (spec 047): the specialized-component
// contract's fifth leaf, after patternGrid/fileBrowser/waveformView/
// loopCreatorView. Reads and writes domain/nibbles/index.js directly -
// arrow keys move the snake, Enter runs the game's own state-dependent
// primary action (Start/Resume/Try Again/Rematch, matching nibbles.js's
// own game.onClick). Named "nibbles", not "nibblesGrid", for the same
// type-name-collision reason "waveform"/"rowList"/"grid"/"loopCreator" are
// named apart from their own types (tests/componentTypes.test.js's own
// type-name-branch scan).
//
// `onFrame(deltaMs)` is not part of handle()'s input vocabulary - it is
// called directly by renderers/canvas/mountGeneric.js's own new, independent
// tick clock (see requirements.md's Decisions), the same way
// gridController.js's own runSelectionCommand is called directly by a
// synthesized menu rather than through a pointer/keyboard/focus event. It
// accumulates elapsed time and calls domain/nibbles#update() once per whole
// difficulty-tick interval, carrying the remainder forward rather than
// drifting - the same idea runtime/animationClock.js already uses for a
// sprite's own frame count, restated here for a game tick instead.

import * as nibbles from "../domain/nibbles/index.js";

const KEY_TO_DIRECTION = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down" };

export function createNibblesController(initial = {}) {
    const state = { hover: false, focused: false, disabled: Boolean(initial.disabled) };
    let accumulatedMs = 0;

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    function handlePointerDown(transitions) {
        set("focused", true, transitions);
        if (state.disabled) return { transitions, handled: false, blocked: "disabled" };
        return { transitions, handled: true };
    }

    function handleKeydown(input, transitions) {
        if (state.disabled) return { transitions, handled: false, blocked: "disabled" };
        if (!state.focused) return { transitions, handled: false, blocked: "unfocused" };
        const direction = KEY_TO_DIRECTION[input.key];
        if (direction) {
            nibbles.move(direction);
            return { transitions, handled: true };
        }
        if (input.key === "Enter") {
            nibbles.primaryAction();
            return { transitions, handled: true };
        }
        return { transitions, handled: false };
    }

    function handle(input) {
        const transitions = [];
        switch (input.type) {
            case "pointerenter": set("hover", true, transitions); return { transitions, handled: false };
            case "pointerleave": set("hover", false, transitions); return { transitions, handled: false };
            case "pointerdown": return handlePointerDown(transitions);
            case "keydown": return handleKeydown(input, transitions);
            case "focus": set("focused", true, transitions); return { transitions, handled: true };
            case "blur": set("focused", false, transitions); return { transitions, handled: true };
            default: return { transitions, handled: false };
        }
    }

    function onFrame(deltaMs) {
        if (state.disabled) return;
        accumulatedMs += Math.max(0, deltaMs || 0);
        const frameTime = nibbles.getFrameTime();
        while (accumulatedMs >= frameTime) {
            nibbles.update();
            accumulatedMs -= frameTime;
        }
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        return transitions;
    }

    return {
        handle,
        onFrame,
        setDisabled,
        get state() { return { ...state }; }
    };
}
