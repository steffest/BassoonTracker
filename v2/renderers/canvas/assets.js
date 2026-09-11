import BitmapFont from "./bitmapFont.js";
import { loadSkin } from "./skin.js";
import { BUILTIN_SKIN, lookupStyle } from "../../runtime/skinModel.js";

// Turns a compiled skin model (spec 008) into what the canvas renderer needs:
// one BitmapFont per authored font, the style table, and the loaded artwork.
// Nothing about a font or a 9-slice is hardcoded here any more; the glyph
// metrics come from the skin's `fonts:` block and the glyph sheet is an
// ordinary asset, so the font is found at its own asset rect plus the
// authored offsets instead of at fixed sprite-sheet coordinates.
//
// Spec 011 removed the pre-skin `button`/`panel` fields: the only caller was
// spec 003's renderer, which is retired.

const cache = new Map();

/**
 * @param {object} [skinModel] `outline.skin`; omit for the built-in fallback skin.
 *   Set `cacheKey` on it (the outline's sourceHash, say) to force a reload after
 *   a regeneration changed the skin; the application never needs to.
 * @param {string|URL} [skinBase] see loadSkin(); omit for the default v2/assets/skin/
 * @returns {Promise<{ skin: object, font: BitmapFont, fonts: Record<string, BitmapFont>,
 *   fontFor: (name?: string) => BitmapFont, styles: object, styleFor: Function,
 *   missing: string[] }>}
 */
export function loadCanvasAssets(skinModel, skinBase) {
    const model = skinModel || BUILTIN_SKIN;
    const key = `${skinBase ? String(skinBase) : ""}|${model.name || "builtin"}|${model.mode || "atlas"}|${model.cacheKey || ""}`;
    let cached = cache.get(key);
    if (!cached) {
        cached = loadSkin(model, skinBase).then(skin => {
            const fonts = {};
            for (const [name, config] of Object.entries(model.fonts || BUILTIN_SKIN.fonts)) {
                const asset = skin.getAsset(config.asset);
                if (!asset) {
                    console.warn(`[v2 skin] font "${name}" has no artwork ("${config.asset}"); text will not be drawn`);
                    continue;
                }
                const font = new BitmapFont();
                font.generate({
                    image: asset.image,
                    startX: asset.x + (config.offsetX || 0),
                    startY: asset.y + (config.offsetY || 0),
                    charWidth: config.charWidth,
                    charHeight: config.charHeight,
                    spaceWidth: config.spaceWidth,
                    margin: config.margin,
                    lineSpacing: config.lineSpacing,
                    charsPerLine: config.charsPerLine,
                    chars: config.chars,
                    onlyUpperCase: config.onlyUpperCase
                });
                fonts[name] = font;
            }
            const defaultFontName = Object.keys(fonts)[0];
            const styles = model.styles || BUILTIN_SKIN.styles;

            function fontFor(name) {
                return fonts[name] || fonts[defaultFontName];
            }
            function styleFor(type, variant) {
                return lookupStyle(model, type, variant).style;
            }
            return {
                skin,
                model,
                fonts,
                font: fontFor(defaultFontName),
                fontFor,
                styles,
                styleFor,
                missing: skin.missing
            };
        });
        cache.set(key, cached);
    }
    return cached;
}
