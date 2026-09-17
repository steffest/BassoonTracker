// Frame-rate governance (spec 032), ported from script/src/ui/ui.js's own
// render() loop: a frame-rate cap (`maxRenderFps`) and a frame-skip counter
// (`skipRenderSteps`/`renderStep`), composed the same way v1 composes them -
// the cap decides whether this tick is even eligible; only an eligible tick
// advances the skip counter.
//
// Pure: no DOM, no requestAnimationFrame - renderers/canvas/mountGeneric.js
// supplies `now` (the rAF callback's own timestamp) and calls in, the same
// split runtime/pointerRouter.js and runtime/scrollbar.js already have.

export const DEFAULT_MAX_FPS = 60;

/**
 * @param {{ maxFps?: number }} [options]
 * @returns {{ shouldDraw: (now: number, skipCount: number) => boolean }}
 */
export function createFrameGovernor({ maxFps = DEFAULT_MAX_FPS } = {}) {
    let lastDrawTime = -Infinity; // so the very first call is never rejected by the cap
    let opportunity = 0; // eligible (fps-cap-passed) frames seen since the last actual draw

    /**
     * @param {number} now a monotonic timestamp, e.g. the rAF callback's own argument
     * @param {number} skipCount 0 draws every eligible frame; N draws every (N+1)th
     */
    function shouldDraw(now, skipCount) {
        const minInterval = maxFps > 0 ? 1000 / maxFps : 0;
        if (now - lastDrawTime < minInterval) return false; // too soon for the cap; no skip slot consumed
        if (skipCount > 0) {
            opportunity++;
            if (opportunity <= skipCount) return false;
        }
        opportunity = 0;
        lastDrawTime = now;
        return true;
    }

    return { shouldDraw };
}
