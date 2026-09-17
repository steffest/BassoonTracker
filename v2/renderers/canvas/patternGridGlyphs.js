// Per-glyph offscreen-canvas cache (spec 030), ported from
// script/src/ui/app/components/patternView.js's own _noteCache/
// _noteParamCache/_lineNumberCache (patternView.js:571-701): rasterizing a
// short string once and blitting the cached canvas on every later draw of
// the same text, rather than re-composing it every frame.
//
// Keyed per font object (a WeakMap, so a skin reload - which builds new
// BitmapFont instances - can never blit a glyph rasterized from the
// previous skin's images) and then by "what text", never by which grid
// instance or which row drew it - the same reason v1's own caches, despite
// being instance fields, never needed a per-instance key either.

const cachesByFont = new WeakMap();

function bucketFor(font) {
    let bucket = cachesByFont.get(font);
    if (!bucket) {
        bucket = new Map();
        cachesByFont.set(font, bucket);
    }
    return bucket;
}

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
    if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    // Neither host exists (a Node unit test with a fake font/ctx, never a
    // real browser): nothing here calls a real 2D method on the result
    // directly, only `font.write(canvas.getContext("2d"), ...)` and
    // `ctx.drawImage(canvas, x, y)`, both of which a test's own fakes
    // already tolerate a null/placeholder context for.
    return { width, height, getContext: () => null };
}

function cachedGlyph(font, key, text) {
    const bucket = bucketFor(font);
    let canvas = bucket.get(key);
    if (!canvas) {
        const width = Math.max(1, Math.ceil(font.getTextWidth(text)));
        const height = font.charHeight;
        canvas = makeCanvas(width, height);
        font.write(canvas.getContext("2d"), text, 0, 0);
        bucket.set(key, canvas);
    }
    return canvas;
}

/** Draws `text` at (x, y) through the cache, one glyph-string canvas per distinct (font, text). */
export function drawCachedText(ctx, font, text, x, y) {
    const canvas = cachedGlyph(font, `t.${text}`, text);
    ctx.drawImage(canvas, x, y);
}

/** Same as drawCachedText, but keyed separately so a line-number "05" can never collide with a note or param string that happens to read the same. */
export function drawCachedLineNumber(ctx, font, row, x, y) {
    const text = (row < 10 ? "0" : "") + row;
    const canvas = cachedGlyph(font, `n.${text}`, text);
    ctx.drawImage(canvas, x, y);
}
