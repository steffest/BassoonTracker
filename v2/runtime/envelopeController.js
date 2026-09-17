// The "envelope" behavior (spec 056): envelopeView's own controller, the
// port's eighth specialized-component leaf after patternGrid ("grid"),
// fileBrowser ("rowList"), waveformView ("waveform"), loopCreatorView
// ("loopCreator"), nibblesGrid ("nibbles"), multitrackView ("multitrack")
// and volumeMeter ("vuMeter"). Mirrors loopCreatorController.js's own
// contract: reads/writes domain/sampleEditor/envelope.js directly as a side
// effect of handle(), returns no value/scrollTo for the generic write-back
// to act on - a candidate value is computed here and handed to
// domain/sampleEditor/envelope.js#setPoint, which already owns the clamp.
//
// `options.envelopeType` ("volume"/"panning") is the first per-node
// variant any specialized leaf in this port needs - see requirements.md's
// Decisions for why this is a controller option, not two component types.
//
// Ported from envelope.js's own onHover/onDragStart/onDrag/onTouchUp
// (36-114).

import * as envelope from "../domain/sampleEditor/envelope.js";
import { toLogical, pointAt } from "../renderers/canvas/envelopeGeometry.js";

export const ENVELOPE_STATE_FIELDS = ["hover", "focused", "disabled", "activeIndex", "dragging", "envelopeType"];

/**
 * @param {{ disabled?: boolean, envelopeType?: "volume"|"panning" }} [options]
 */
export function createEnvelopeController(options = {}) {
    const envelopeType = options.envelopeType === "panning" ? "panning" : "volume";
    const state = { hover: false, focused: false, disabled: Boolean(options.disabled), activeIndex: -1, dragging: false, envelopeType };
    // { index, startPoint: [x, y], startLogical: {x, y} }
    let dragAnchor = null;

    function set(field, value, transitions) {
        if (state[field] === value) return;
        transitions.push({ field, from: state[field], to: value });
        state[field] = value;
    }

    /** Ported from envelope.js#onHover (36-75) - only while not disabled/dragging, and only for an enabled envelope. */
    function updateHover(input, transitions) {
        if (state.disabled || state.dragging || !input.rect || !input.local) return;
        const env = envelope.getEnvelope(envelopeType);
        const index = env.enabled ? pointAt(env.points, env.count, toLogical(input.local, input.rect)) : -1;
        set("activeIndex", index, transitions);
    }

    function handle(input) {
        const transitions = [];
        let handled = false;
        let blocked = null;

        switch (input.type) {
            case "pointerenter":
                set("hover", true, transitions);
                break;
            case "pointerleave":
                set("hover", false, transitions);
                set("activeIndex", -1, transitions);
                break;
            case "focus":
                set("focused", true, transitions);
                break;
            case "blur":
                set("focused", false, transitions);
                dragAnchor = null;
                set("dragging", false, transitions);
                break;
            case "pointermove":
                updateHover(input, transitions);
                break;

            case "pointerdown": {
                set("focused", true, transitions);
                if (state.disabled) { blocked = "disabled"; break; }
                // A plain click with no preceding hover (a synthetic test, or
                // a touch device) still finds its own point - a small
                // robustness addition beyond v1's own mouse-only assumption,
                // not a behavior change for the mouse case (which already
                // hovers before it can press).
                updateHover(input, transitions);
                if (state.activeIndex < 0 || !input.rect || !input.local) break;
                const env = envelope.getEnvelope(envelopeType);
                const point = env.points[state.activeIndex];
                if (!point) break;
                dragAnchor = {
                    index: state.activeIndex,
                    startPoint: [point[0], point[1]],
                    startLogical: toLogical(input.local, input.rect)
                };
                set("dragging", true, transitions);
                handled = true;
                break;
            }

            case "drag": {
                if (state.disabled || !dragAnchor || !input.rect || !input.local) break;
                const current = toLogical(input.local, input.rect);
                const candidateX = dragAnchor.startPoint[0] + (current.x - dragAnchor.startLogical.x);
                const candidateY = dragAnchor.startPoint[1] + (current.y - dragAnchor.startLogical.y);
                envelope.setPoint(envelopeType, dragAnchor.index, candidateX, candidateY);
                handled = true;
                break;
            }

            case "pointerup":
                if (dragAnchor) handled = true;
                dragAnchor = null;
                set("dragging", false, transitions);
                break;

            default:
                break;
        }

        return { transitions, activated: false, blocked, handled, changed: false, value: null, scrollTo: null };
    }

    function setDisabled(disabled) {
        const transitions = [];
        set("disabled", Boolean(disabled), transitions);
        if (disabled) {
            dragAnchor = null;
            set("dragging", false, transitions);
            set("activeIndex", -1, transitions);
        }
        return transitions;
    }

    return {
        handle,
        setDisabled,
        get state() { return { ...state }; }
    };
}
