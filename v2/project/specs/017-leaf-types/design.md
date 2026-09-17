# 017 — Design

## `image` and `icon`: one draw kind, two property names

```js
function imageAsset(assets, node, explicitName) {
    const name = explicitName || (node && (node.src || node.icon));
    if (!name || !assets || !assets.skin) return null;
    return assets.skin.getAsset(name);
}
```

`drawKinds.js`'s `image` kind calls this with no explicit name, so it reads `node.src` (the `image` type's property) or `node.icon` (the `icon` type's) - whichever the node actually has, since a node only ever has one. This is not a style-state lookup (`resolveStateAsset`, which every other styled kind uses): neither type has interaction states, so there is nothing to resolve *by*, only a name to look up directly. `styled: false` on both registry entries reflects that; `styleOf(node)` still runs for them (every node gets one, unconditionally, in `drawNode()`), but the draw kind ignores it entirely.

Drawing: `scale: "stretch"` draws the asset's source rect into the full destination rect. Otherwise the asset draws at its own natural size, centred in the rect by default, or pinned by `horizontalAlign`/`verticalAlign` - the same three options v1's `UIImage.render()` supports, read from the node instead of instance properties. An unresolved asset draws nothing and returns `null`, the same "quietly absent" contract `slider`'s thumb-metrics-returns-null already established for "there is nothing to draw yet."

Measuring needed the asset, which `measure()`'s existing three-argument signature (`assets, style, label`) could not reach. It now also receives `node` - every other draw kind's `measure()` still declares (and needs) only three; JavaScript does not require the extra argument to be used, so nothing else changed. `image`/`icon` measure to the resolved asset's own `width`/`height`, or a small fixed fallback (14×14, v1's own `UIImage` default) when nothing resolves - so a placeholder-less leaf still has a sane size before anything is authored to give it one.

## `animSprite`: the animation clock

The one real design question was where the current frame lives. Two options: private renderer state keyed by node id (nothing else about a node's *visual* state lives outside the node/controller/mockState triangle, which would have made this the one exception), or the same place a slider's value and a viewport's offset already live - the node's bound state `field`. The second one composes with everything already built: `contextFor`/`visualStateOf`'s existing `behavior === "value"` / `"scroll"` branches already show the pattern of "read something the renderer computed and hand it to the draw kind as `state.<name>`"; this spec adds the generic third case,

```js
} else if (!behavior && node.field) {
    extra.fieldValue = mockState.get(node.field);
}
```

in `visualStateOf()`, for any non-interactive type with a bound field. It reads generically - nothing here names `animSprite` - which matters because it is not really an `animSprite`-only mechanism, only its first user; a future non-interactive, field-driven type gets the same thing for free.

**What drives the field.** A new registry flag: `animated: true`, checked by a new `isAnimatedType(type)`, exactly parallel to `isInteractiveType`. `mountGeneric.js` collects `animatedNodes = allNodes.filter(node => isAnimatedType(node.type) && node.field)` once at mount and keeps one clock entry per node in a `Map` (`{ frame, elapsed }`, seeded from the field's current value so a re-mount does not visibly reset an in-progress animation). `startAnimationClock()` requests one frame only if `animatedNodes.length > 0`; `animationTick(time)` computes the real elapsed delta, calls `runtime/animationClock.js#advanceSprites`, writes any changed frame back through the existing `setField()` (the same function every other field write already goes through) and redraws once if anything changed, then requests the next frame. `stopAnimationClock()` (called from `dispose()`) cancels it. A tree with no animated node never calls `requestAnimationFrame` at all - the cost is exactly zero until something asks for it, matching the design commitment package P8 wants held everywhere else in this renderer.

**Why the clock is its own pure module rather than inline math in `mountGeneric.js`.** `advanceSprites` has to get right: multiple frames advancing in one call when the delta is large (a backgrounded tab resuming, a slow frame), the remainder carrying forward rather than resetting to zero (so a runt frame does not accumulate drift), and wraparound. That is exactly the kind of arithmetic `runtime/pointerRouter.js` and `domain/playback/scheduler.js` already keep pure and unit-tested rather than inline in a renderer; `animationClock.js` follows the same split.

```js
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
```

Drawing reads the strip left to right, exactly as v1's `UIAnimsprite.render()` does, but from the *asset's own* width divided by the frame count rather than the node's rendered width - `frameWidth = asset.width / frames` - since an authored `layout:` can size the node differently from its natural pixels, and the source slice must not depend on that. `state.fieldValue` is clamped to `[0, frames - 1]` at draw time, so a field written from outside the clock (or simply not yet initialized) cannot read past the strip.

## What this deliberately does not do

- **No compiler-side asset registration.** `compiler/skin.js` tracks which assets a real, authored skin has to load by walking font declarations and each style's `states:` block; an `image`/`icon`/`animSprite` instance names an asset directly, by authored property, which nothing walks today. Harmless while nothing authors one; a real screen that wants a picture needs this fixed first, and it is a compiler change, not a runtime one.
- **No `numberDisplay`.** See requirements.md's scope decision: it is a real control, not a leaf, and deserves its own spec rather than being implemented under this one's "simple leaves" framing.
- **No caching of resolved assets per animated node.** `imageAsset()` is called on every draw, exactly as every other draw kind resolves its style/asset fresh each time; nothing measured this as a cost worth avoiding, and P8 (renderer performance) is where that measurement belongs if it ever is one.
