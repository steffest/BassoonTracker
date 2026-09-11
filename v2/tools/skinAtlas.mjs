#!/usr/bin/env node
// Skin atlas packer (spec 008). Development-time tool, Node only: it turns
// the individual source PNGs under assets/skin/src/ into the one sheet plus
// one map file the generated application and the release bundle load.
// Nothing in the runtime imports this module.
//
// Provenance: adapted from the parent repository's skin/generate.js (MIT,
// same repository) - the PNG reader, the shelf packer, the scanline filter
// search and the PNG writer are the same algorithms, restated as ES modules
// with an explicit asset list instead of a directory scan, so v2 packs
// exactly the assets its skin YAML references and no more.
//
//   node v2/tools/skinAtlas.mjs                  pack every PNG in assets/skin/src
//   node v2/tools/skinAtlas.mjs a.png b.png      pack the named files
//
// `node v2/build.mjs skin` is the normal entry point: it packs the assets
// the compiled skin actually references.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename, extname } from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = buildCrcTable();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SRC_DIR = join(__dirname, "..", "assets", "skin", "src");
const DEFAULT_OUT_DIR = join(__dirname, "..", "assets", "skin", "generated");

// --- PNG decoding ------------------------------------------------------

/**
 * Decodes one 8-bit, non-interlaced PNG to straight RGBA.
 * @param {string} file path, used in error messages and for the asset name
 * @returns {{ name: string, file: string, width: number, height: number, data: Buffer }}
 */
export function decodePng(file) {
    const buffer = readFileSync(file);
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file} is not a PNG file`);

    let offset = 8;
    let header = null;
    let palette = null;
    let transparency = null;
    const idat = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        offset += length + 12;

        if (type === "IHDR") {
            header = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                bitDepth: data[8],
                colorType: data[9],
                compression: data[10],
                filter: data[11],
                interlace: data[12]
            };
        } else if (type === "PLTE") palette = data;
        else if (type === "tRNS") transparency = data;
        else if (type === "IDAT") idat.push(data);
        else if (type === "IEND") break;
    }

    if (!header) throw new Error(`${file} has no PNG header`);
    if (header.bitDepth !== 8) throw new Error(`${file} uses unsupported bit depth ${header.bitDepth}`);
    if (header.compression || header.filter) throw new Error(`${file} uses an unsupported compression/filter method`);
    if (header.interlace) throw new Error(`${file} is interlaced, which is not supported`);

    const channels = channelCount(header.colorType, file);
    const scanlineLength = header.width * channels;
    const raw = inflateSync(Buffer.concat(idat));
    const unfiltered = Buffer.alloc(scanlineLength * header.height);

    for (let y = 0; y < header.height; y++) {
        const source = y * (scanlineLength + 1);
        const target = y * scanlineLength;
        unfilterScanline(raw, unfiltered, source + 1, target, scanlineLength, channels, raw[source]);
    }

    return {
        name: basename(file, extname(file)),
        file,
        width: header.width,
        height: header.height,
        data: toRgba(unfiltered, header, palette, transparency)
    };
}

function channelCount(colorType, file) {
    switch (colorType) {
        case 0: return 1;
        case 2: return 3;
        case 3: return 1;
        case 4: return 2;
        case 6: return 4;
        default: throw new Error(`${file} uses unsupported PNG color type ${colorType}`);
    }
}

function unfilterScanline(source, target, sourceOffset, targetOffset, length, bpp, filter) {
    for (let i = 0; i < length; i++) {
        const x = source[sourceOffset + i];
        const left = i >= bpp ? target[targetOffset + i - bpp] : 0;
        const up = targetOffset >= length ? target[targetOffset + i - length] : 0;
        const upLeft = targetOffset >= length && i >= bpp ? target[targetOffset + i - length - bpp] : 0;
        let value;
        switch (filter) {
            case 0: value = x; break;
            case 1: value = x + left; break;
            case 2: value = x + up; break;
            case 3: value = x + Math.floor((left + up) / 2); break;
            case 4: value = x + paeth(left, up, upLeft); break;
            default: throw new Error(`unsupported PNG scanline filter ${filter}`);
        }
        target[targetOffset + i] = value & 255;
    }
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

function toRgba(data, header, palette, transparency) {
    const rgba = Buffer.alloc(header.width * header.height * 4);
    let source = 0;
    let target = 0;
    let transparentGrey;
    let transparentRgb;

    if (transparency && header.colorType === 0) transparentGrey = transparency.readUInt16BE(0) & 255;
    if (transparency && header.colorType === 2) {
        transparentRgb = [transparency.readUInt16BE(0) & 255, transparency.readUInt16BE(2) & 255, transparency.readUInt16BE(4) & 255];
    }

    for (let i = 0, max = header.width * header.height; i < max; i++) {
        if (header.colorType === 0) {
            const grey = data[source++];
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey === transparentGrey ? 0 : 255;
        } else if (header.colorType === 2) {
            const r = data[source++];
            const g = data[source++];
            const b = data[source++];
            rgba[target++] = r;
            rgba[target++] = g;
            rgba[target++] = b;
            rgba[target++] = transparentRgb && r === transparentRgb[0] && g === transparentRgb[1] && b === transparentRgb[2] ? 0 : 255;
        } else if (header.colorType === 3) {
            const index = data[source++];
            rgba[target++] = palette ? palette[index * 3] || 0 : 0;
            rgba[target++] = palette ? palette[index * 3 + 1] || 0 : 0;
            rgba[target++] = palette ? palette[index * 3 + 2] || 0 : 0;
            rgba[target++] = transparency && typeof transparency[index] !== "undefined" ? transparency[index] : 255;
        } else if (header.colorType === 4) {
            const grey = data[source++];
            const alpha = data[source++];
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = grey;
            rgba[target++] = alpha;
        } else {
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
            rgba[target++] = data[source++];
        }
    }
    return rgba;
}

// --- packing -----------------------------------------------------------

/**
 * Places every asset in one sheet, trying a range of candidate widths and
 * keeping the smallest resulting area. Deterministic: the same input list
 * always produces the same layout.
 *
 * @param {Array<{name: string, width: number, height: number, data: Buffer}>} assets
 * @returns {{ width: number, height: number, sprites: Array }}
 */
export function packAssets(assets) {
    if (assets.length === 0) throw new Error("packAssets: nothing to pack");
    const totalArea = assets.reduce((total, a) => total + a.width * a.height, 0);
    const maxWidth = assets.reduce((max, a) => Math.max(max, a.width), 0);
    const targetWidth = Math.ceil(Math.sqrt(totalArea));
    const maxCandidateWidth = Math.max(maxWidth, targetWidth * 2);

    const candidates = new Set();
    for (let width = maxWidth; width <= maxCandidateWidth; width += 8) candidates.add(width);
    for (const width of [maxWidth, targetWidth, 512, 768, 1024, 1280, 1536, 2048]) {
        if (width >= maxWidth && width <= maxCandidateWidth) candidates.add(width);
    }

    let best = null;
    for (const width of [...candidates].sort((a, b) => a - b)) {
        const packed = packAtWidth(assets, width);
        if (!best || isBetterPack(packed, best)) best = packed;
    }
    validatePack(best);
    return best;
}

function packAtWidth(assets, width) {
    const sprites = assets.map((asset, sourceIndex) => ({ ...asset, sourceIndex, x: 0, y: 0 }));
    const byArea = sprites.slice().sort((a, b) => (b.height * b.width) - (a.height * a.width) || b.height - a.height || b.width - a.width || a.name.localeCompare(b.name));
    const stackHeight = sprites.reduce((total, s) => total + s.height, 0);
    const freeRects = [{ x: 0, y: 0, width, height: stackHeight }];

    for (const sprite of byArea) {
        const placement = findPlacement(freeRects, sprite);
        if (!placement) throw new Error(`packAssets: could not place "${sprite.name}"`);
        sprite.x = placement.x;
        sprite.y = placement.y;
        splitFreeRects(freeRects, placement);
        pruneFreeRects(freeRects);
    }

    let usedWidth = 0;
    let usedHeight = 0;
    for (const sprite of sprites) {
        usedWidth = Math.max(usedWidth, sprite.x + sprite.width);
        usedHeight = Math.max(usedHeight, sprite.y + sprite.height);
    }
    return { width: usedWidth, height: usedHeight, area: usedWidth * usedHeight, maxSide: Math.max(usedWidth, usedHeight), sprites };
}

function findPlacement(freeRects, sprite) {
    let best = null;
    for (const rect of freeRects) {
        if (sprite.width > rect.width || sprite.height > rect.height) continue;
        const shortSide = Math.min(rect.width - sprite.width, rect.height - sprite.height);
        const longSide = Math.max(rect.width - sprite.width, rect.height - sprite.height);
        if (!best || shortSide < best.shortSide || (shortSide === best.shortSide && longSide < best.longSide)) {
            best = { x: rect.x, y: rect.y, width: sprite.width, height: sprite.height, shortSide, longSide };
        }
    }
    return best;
}

function splitFreeRects(freeRects, used) {
    for (let i = freeRects.length - 1; i >= 0; i--) {
        const rect = freeRects[i];
        if (!intersects(rect, used)) continue;
        freeRects.splice(i, 1);
        if (used.x > rect.x) freeRects.push({ x: rect.x, y: rect.y, width: used.x - rect.x, height: rect.height });
        if (used.x + used.width < rect.x + rect.width) {
            freeRects.push({ x: used.x + used.width, y: rect.y, width: rect.x + rect.width - (used.x + used.width), height: rect.height });
        }
        if (used.y > rect.y) freeRects.push({ x: rect.x, y: rect.y, width: rect.width, height: used.y - rect.y });
        if (used.y + used.height < rect.y + rect.height) {
            freeRects.push({ x: rect.x, y: used.y + used.height, width: rect.width, height: rect.y + rect.height - (used.y + used.height) });
        }
    }
}

function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pruneFreeRects(freeRects) {
    for (let i = 0; i < freeRects.length; i++) {
        for (let j = i + 1; j < freeRects.length; j++) {
            if (contains(freeRects[i], freeRects[j])) {
                freeRects.splice(j, 1);
                j--;
            } else if (contains(freeRects[j], freeRects[i])) {
                freeRects.splice(i, 1);
                i--;
                break;
            }
        }
    }
}

function contains(a, b) {
    return b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
}

function isBetterPack(pack, best) {
    if (pack.area !== best.area) return pack.area < best.area;
    if (pack.maxSide !== best.maxSide) return pack.maxSide < best.maxSide;
    return pack.width < best.width;
}

function validatePack(pack) {
    for (const sprite of pack.sprites) {
        if (sprite.x < 0 || sprite.y < 0 || sprite.x + sprite.width > pack.width || sprite.y + sprite.height > pack.height) {
            throw new Error(`packAssets: "${sprite.name}" ended up outside the sheet (${sprite.x},${sprite.y} ${sprite.width}x${sprite.height} in ${pack.width}x${pack.height})`);
        }
    }
    for (const a of pack.sprites) {
        for (const b of pack.sprites) {
            if (a !== b && intersects(a, b)) throw new Error(`packAssets: "${a.name}" overlaps "${b.name}"`);
        }
    }
}

function composeSheet(pack) {
    const sheet = Buffer.alloc(pack.width * pack.height * 4);
    for (const sprite of pack.sprites) {
        for (let y = 0; y < sprite.height; y++) {
            const source = y * sprite.width * 4;
            const target = ((sprite.y + y) * pack.width + sprite.x) * 4;
            sprite.data.copy(sheet, target, source, source + sprite.width * 4);
        }
    }
    return sheet;
}

// --- PNG encoding ------------------------------------------------------

/** Encodes straight RGBA as an 8-bit color-type-6 PNG. */
export function encodePng(width, height, rgba) {
    const scanlineLength = width * 4;
    const raw = Buffer.alloc((scanlineLength + 1) * height);
    for (let y = 0; y < height; y++) {
        const source = y * scanlineLength;
        const target = y * (scanlineLength + 1);
        const previous = y > 0 ? rgba.subarray(source - scanlineLength, source) : undefined;
        const filtered = filterScanline(rgba.subarray(source, source + scanlineLength), previous, 4);
        raw[target] = filtered.type;
        filtered.data.copy(raw, target + 1);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;  // bit depth
    header[9] = 6;  // color type: truecolor with alpha
    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk("IHDR", header),
        pngChunk("IDAT", deflateSync(raw, { level: 9 })),
        pngChunk("IEND", Buffer.alloc(0))
    ]);
}

// Tries all five scanline filters and keeps the one whose bytes are closest
// to zero, which is what deflate compresses best.
function filterScanline(current, previous, bpp) {
    let best = { type: 0, data: current, score: filterScore(current) };
    for (let type = 1; type <= 4; type++) {
        const data = Buffer.alloc(current.length);
        for (let i = 0; i < current.length; i++) {
            const left = i >= bpp ? current[i - bpp] : 0;
            const up = previous ? previous[i] : 0;
            const upLeft = previous && i >= bpp ? previous[i - bpp] : 0;
            let predictor = 0;
            if (type === 1) predictor = left;
            else if (type === 2) predictor = up;
            else if (type === 3) predictor = Math.floor((left + up) / 2);
            else predictor = paeth(left, up, upLeft);
            data[i] = (current[i] - predictor) & 255;
        }
        const score = filterScore(data);
        if (score < best.score) best = { type, data, score };
    }
    return best;
}

function filterScore(data) {
    let score = 0;
    for (let i = 0; i < data.length; i++) score += data[i] < 128 ? data[i] : 256 - data[i];
    return score;
}

function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}

function buildCrcTable() {
    const table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

// --- entry points ------------------------------------------------------

/**
 * Packs the given source PNGs into one sheet plus one map file.
 *
 * @param {string[]} files absolute paths to the source PNGs, in any order
 * @param {{ outDir?: string, sheetName?: string, mapName?: string }} [options]
 * @returns {{ sheetPath: string, mapPath: string, width: number, height: number, map: Array, bytes: number }}
 */
export function writeAtlas(files, options = {}) {
    const outDir = options.outDir || DEFAULT_OUT_DIR;
    const sheetName = options.sheetName || "atlas.png";
    const mapName = options.mapName || "atlas.json";

    // Sort by name so the layout depends only on the *set* of assets, not on
    // the order the caller happened to collect them in.
    const assets = [...new Set(files)].sort((a, b) => basename(a).localeCompare(basename(b))).map(decodePng);
    const names = new Map();
    for (const asset of assets) {
        if (names.has(asset.name)) throw new Error(`writeAtlas: duplicate asset name "${asset.name}" (${names.get(asset.name)} and ${asset.file})`);
        names.set(asset.name, asset.file);
    }

    const pack = packAssets(assets);
    const png = encodePng(pack.width, pack.height, composeSheet(pack));
    const map = pack.sprites
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => ({ name: s.name, x: s.x, y: s.y, width: s.width, height: s.height }));

    mkdirSync(outDir, { recursive: true });
    const sheetPath = join(outDir, sheetName);
    const mapPath = join(outDir, mapName);
    writeFileSync(sheetPath, png);
    writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");

    return { sheetPath, mapPath, width: pack.width, height: pack.height, map, bytes: png.length };
}

/** Every PNG in the source directory, as absolute paths. */
export function listSourceAssets(srcDir = DEFAULT_SRC_DIR) {
    return readdirSync(srcDir)
        .filter(name => name.toLowerCase().endsWith(".png"))
        .sort()
        .map(name => join(srcDir, name));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const files = process.argv.slice(2);
    const result = writeAtlas(files.length ? files : listSourceAssets());
    console.log(`skin atlas: ${result.map.length} assets in ${result.width}x${result.height} (${result.bytes} bytes)`);
    console.log(`  ${result.sheetPath}`);
    console.log(`  ${result.mapPath}`);
}
