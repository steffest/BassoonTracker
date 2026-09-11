// Loads a skin's artwork for the canvas renderer, in either of the two modes
// spec 008 defines, behind one interface:
//
//   loose  (development)  one PNG per asset from assets/skin/src/, so
//                         replacing artwork needs no build step
//   atlas  (release)      one packed sheet plus one JSON map, which is what
//                         the generated app and the bundle ship
//
// The mode and the asset list come from the compiled skin model in the
// outline (or from the built-in fallback skin), never from this file. No
// compiler or YAML code is imported here: this module ships to the app.

import { BUILTIN_SKIN } from "../../runtime/skinModel.js";

const DEFAULT_SKIN_BASE = new URL("../../assets/skin/", import.meta.url);

const cache = new Map();

function resolveBase(base) {
    if (!base) return DEFAULT_SKIN_BASE;
    return base instanceof URL ? base : new URL(String(base), document.baseURI);
}

/**
 * @param {object} [model] a compiled skin model (`outline.skin`); defaults to the built-in skin
 * @param {string|URL} [base] directory holding `src/` and `generated/` (or a
 *   release's copied asset folder); defaults to v2/assets/skin/
 * @returns {Promise<{ mode: string, name: string, base: URL, getAsset: (name: string) => object|null, missing: string[] }>}
 */
export function loadSkin(model = BUILTIN_SKIN, base) {
    const skinBase = resolveBase(base);
    // `cacheKey` lets a long-lived page (the workbench) reload artwork after a
    // regeneration changed the skin; without it the first load would be reused
    // for a model that no longer matches.
    const key = `${skinBase.href}|${model.name || "builtin"}|${model.mode || "atlas"}|${model.cacheKey || ""}`;
    let cached = cache.get(key);
    if (!cached) {
        cached = (model.mode === "loose" ? loadLoose(model, skinBase) : loadAtlas(model, skinBase)).then(result => {
            if (result.missing.length) {
                console.warn(`[v2 skin] ${result.missing.length} asset(s) could not be loaded and draw as placeholders: ${result.missing.join(", ")}`);
            }
            return result;
        });
        cache.set(key, cached);
    }
    return cached;
}

// One image per asset. A single unreachable PNG must not blank the UI, so a
// failed load is recorded and reported; drawing falls back to a placeholder.
function loadLoose(model, skinBase) {
    const assets = model.assets || [];
    const entries = new Map();
    const missing = [];
    return Promise.all(assets.map(asset => {
        const file = asset.file || `src/${asset.name}.png`;
        return loadImage(new URL(file, skinBase).href)
            .then(image => entries.set(asset.name, { name: asset.name, image, x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight, file }))
            .catch(error => {
                missing.push(asset.name);
                console.warn(`[v2 skin] ${error.message}`);
            });
    })).then(() => makeSkin(model, "loose", skinBase, entries, missing));
}

function loadAtlas(model, skinBase) {
    const atlas = model.atlas || BUILTIN_SKIN.atlas;
    return Promise.all([
        loadImage(new URL(atlas.sheet, skinBase).href),
        fetch(new URL(atlas.map, skinBase).href).then(response => {
            if (!response.ok) throw new Error(`loadSkin: failed to fetch ${atlas.map} (${response.status})`);
            return response.json();
        })
    ]).then(([image, spriteMap]) => {
        const entries = new Map();
        for (const entry of spriteMap) {
            entries.set(entry.name, { name: entry.name, image, x: entry.x, y: entry.y, width: entry.width, height: entry.height, file: atlas.sheet });
        }
        const missing = (model.assets || []).map(asset => asset.name).filter(name => !entries.has(name));
        return makeSkin(model, "atlas", skinBase, entries, missing);
    });
}

function makeSkin(model, mode, base, entries, missing) {
    return {
        mode,
        name: model.name || "builtin",
        base,
        missing,
        /** @returns {{image: CanvasImageSource, x: number, y: number, width: number, height: number}|null} */
        getAsset(name) {
            return entries.get(name) || null;
        },
        assetNames() {
            return [...entries.keys()];
        }
    };
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`loadSkin: failed to load image "${src}"`));
        img.src = src;
    });
}
