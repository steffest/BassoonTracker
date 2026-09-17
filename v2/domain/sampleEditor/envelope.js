// The envelope editor's own engine (spec 055), the second of P11's own
// specialized surfaces to reach this shape (after the multitrack
// arrangement view's own domain/arrangement) - opens with the headless
// mechanism only, the interactive leaf and its screen following in later
// specs, matching the "engine, then interactive leaf, then screen" pattern
// this roadmap has used repeatedly.
//
// Ported from script/src/ui/envelope.js (the drag editor's own hit-test/
// clamp math) and script/src/ui/envelopePanel.js (add/remove point,
// enable/sustain/loop toggles). The envelope data itself needed no new
// engine work at all - domain/playback/engine/models/instrument.js#
// volumeEnvelope/panningEnvelope and engine/fileformats/fasttracker.js#
// processEnvelope already carry it, ported wholesale, unused until now.
//
// One module, both envelope types - `type` is "volume" or "panning"
// throughout, mirroring v1's own Envelope(type)/EnvelopePanel(type), each
// instantiated twice rather than duplicated into two files.
//
// Like domain/sampleEditor/loopCreator.js, this reaches the current
// instrument only through domain/song/index.js's own public surface, never
// domain/playback/engine/ directly.

import * as song from "../song/index.js";

const MAX_X = 324;
const MAX_Y = 64;
const MIN_GAP = 10; // v1's own fixed spacing for a newly added point

function envelopeOf(type) {
    const instrument = song.getCurrentInstrument();
    return instrument ? instrument[type + "Envelope"] : null;
}

/**
 * A safe, falsy-default snapshot (ENV-001) - every field
 * envelopePanel.js#setInstrument (173-186) reads falsy-safe (`envelope.sustain`,
 * `envelope.sustainPoint || 0`, ...), made explicit here instead of scattered
 * at every call site. `points` is the live array, not a copy - see
 * requirements.md's Decisions.
 */
export function getEnvelope(type) {
    const envelope = envelopeOf(type);
    if (!envelope) {
        return { enabled: false, points: [], count: 0, sustain: false, sustainPoint: 0, loop: false, loopStartPoint: 0, loopEndPoint: 0 };
    }
    return {
        enabled: !!envelope.enabled,
        points: envelope.points || [],
        count: envelope.count || 0,
        sustain: !!envelope.sustain,
        sustainPoint: envelope.sustainPoint || 0,
        loop: !!envelope.loop,
        loopStartPoint: envelope.loopStartPoint || 0,
        loopEndPoint: envelope.loopEndPoint || 0
    };
}

/**
 * Ported from envelope.js#onHover/onDrag's own bounds (36-75, 92-110) -
 * point 0 never moves horizontally; every other point clamps to its own
 * immediate neighbors (or MAX_X for the last one); y always clamps to
 * 0-MAX_Y (ENV-002).
 */
export function setPoint(type, index, x, y) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.points || !envelope.points[index]) return;
    const point = envelope.points[index];

    let minX = 0, maxX = 0;
    if (index > 0) {
        minX = envelope.points[index - 1][0];
        maxX = index < envelope.count - 1 ? envelope.points[index + 1][0] : MAX_X;
    }
    point[0] = Math.max(minX, Math.min(maxX, x));
    point[1] = Math.max(0, Math.min(MAX_Y, y));
}

/**
 * Shared re-clamp (ENV-004), ported from envelopePanel.js#checkMax (245-251) -
 * also run directly by setSustainPoint/setLoopStart/setLoopEnd below,
 * matching v1's own spinbox onChange call sites, not only removePoint's.
 */
function clampIndices(envelope) {
    if (!envelope.count) return;
    if (envelope.sustainPoint >= envelope.count) envelope.sustainPoint = envelope.count - 1;
    if (envelope.loopStartPoint >= envelope.count) envelope.loopStartPoint = envelope.count - 1;
    if (envelope.loopEndPoint >= envelope.count) envelope.loopEndPoint = envelope.count - 1;
}

/**
 * Ported from envelopePanel.js's own buttonAdd.onDown (40-61) - a no-op on
 * a disabled envelope, easy to miss since the guard sits above both button
 * handlers rather than being named as a shared precondition (ENV-003).
 */
export function addPoint(type) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.enabled) return;
    if (envelope.points.length > envelope.count) {
        const prevPoint = envelope.points[envelope.count - 1] || [0, 0];
        const nextPoint = envelope.points[envelope.count];
        if (prevPoint[0] + MIN_GAP < 320) {
            if (nextPoint[0] <= prevPoint[0]) nextPoint[0] = prevPoint[0] + MIN_GAP;
            envelope.count++;
        }
    } else {
        const lastPoint = envelope.points[envelope.points.length - 1];
        if (lastPoint[0] + MIN_GAP < 320) {
            envelope.points.push([lastPoint[0] + MIN_GAP, 32]);
            envelope.count = envelope.points.length;
        }
    }
}

/** Ported from envelopePanel.js's own buttonRemove.onDown (67-79) - also a no-op on a disabled envelope. */
export function removePoint(type) {
    const envelope = envelopeOf(type);
    if (!envelope || !envelope.enabled) return;
    if (envelope.count > 2) {
        envelope.count--;
        clampIndices(envelope);
    }
}

export function setEnabled(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.enabled = !!enabled;
}

export function setSustain(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.sustain = !!enabled;
}

export function setSustainPoint(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.sustainPoint = Math.max(0, value);
    clampIndices(envelope);
}

export function setLoop(type, enabled) {
    const envelope = envelopeOf(type);
    if (envelope) envelope.loop = !!enabled;
}

export function setLoopStart(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.loopStartPoint = Math.max(0, value);
    clampIndices(envelope);
}

export function setLoopEnd(type, value) {
    const envelope = envelopeOf(type);
    if (!envelope) return;
    envelope.loopEndPoint = Math.max(0, value);
    clampIndices(envelope);
}
