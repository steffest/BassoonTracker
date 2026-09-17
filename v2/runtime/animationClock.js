// Per-sprite frame advancement (spec 017's `animSprite`): pure, DOM-free, no
// timer. The renderer owns the one requestAnimationFrame loop (started only
// while a mounted tree has at least one animated node, and stopped on
// dispose) and calls this with real elapsed time; this module only does the
// arithmetic, so it is unit-testable without a browser, matching every other
// piece of timing logic in runtime/ (pointerRouter's double-click window,
// the playback scheduler's lookahead).
//
// A frame advances in whole steps, carrying the remainder forward, so a
// delayed or coalesced call (a background tab, a slow frame) catches up by
// however many frames actually elapsed rather than skipping or drifting.

const DEFAULT_FRAME_DELAY_MS = 120;

/**
 * @typedef {object} SpriteClockState
 * @property {string} id
 * @property {number} frame current frame index
 * @property {number} elapsed ms accumulated since the last full step
 */

/**
 * @param {Array<{id: string, frame?: number, elapsed?: number, frames: number, frameDelay?: number}>} sprites
 *   the animated nodes' current clock state, plus their declared frames/frameDelay
 * @param {number} deltaMs time since the last call; clamped to 0 if negative
 * @returns {SpriteClockState[]} one entry per sprite, in the same order, whether or not it changed
 */
export function advanceSprites(sprites, deltaMs) {
    const delta = Math.max(0, deltaMs || 0);
    return sprites.map(sprite => {
        const frames = Math.max(1, Math.floor(sprite.frames) || 1);
        const delay = Math.max(1, sprite.frameDelay || DEFAULT_FRAME_DELAY_MS);
        const elapsedTotal = (sprite.elapsed || 0) + delta;
        const steps = Math.floor(elapsedTotal / delay);
        const frame = frames <= 1 ? 0 : (((sprite.frame || 0) + steps) % frames + frames) % frames;
        return { id: sprite.id, frame, elapsed: elapsedTotal - steps * delay };
    });
}

/** Whether any sprite in the `advanceSprites` result actually moved to a new frame. */
export function anyFrameChanged(before, after) {
    const frameOf = new Map(before.map(s => [s.id, s.frame || 0]));
    return after.some(s => (frameOf.get(s.id) ?? 0) !== s.frame);
}
