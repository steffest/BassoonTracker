import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { decodePng, encodePng, packAssets, writeAtlas, listSourceAssets } from "../tools/skinAtlas.mjs";

// Spec 008: the release build packs the individual source PNGs into one sheet
// plus one map. The check that matters is that the packed pixels are still the
// source pixels at the mapped rectangle, so development (loose PNGs) and
// release (atlas) cannot drift apart.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../assets/skin/src");

function pixelsMatch(sheet, source, rect) {
    for (let y = 0; y < source.height; y++) {
        const from = source.data.subarray(y * source.width * 4, (y + 1) * source.width * 4);
        const offset = ((rect.y + y) * sheet.width + rect.x) * 4;
        if (!from.equals(sheet.data.subarray(offset, offset + source.width * 4))) return false;
    }
    return true;
}

test("decodes the real source PNGs to RGBA", () => {
    const files = listSourceAssets(SRC);
    assert.ok(files.length >= 10, "the source folder holds the individual skin PNGs");
    const font = decodePng(join(SRC, "font.png"));
    assert.equal(font.name, "font");
    assert.equal(font.width, 256);
    assert.equal(font.height, 256);
    assert.equal(font.data.length, 256 * 256 * 4);
    // A palette PNG (color type 3) and a truecolor one both decode.
    const palette = decodePng(join(SRC, "keybutton_hover.png"));
    assert.equal(palette.data.length, palette.width * palette.height * 4);
    assert.ok(palette.data.some(byte => byte !== 0), "decoded pixels are not blank");
});

test("packs without overlap and inside the sheet", () => {
    const files = ["font.png", "panel_dark.png", "button_inlay.png", "button_inlay_active.png", "record.png"].map(name => join(SRC, name));
    const assetsIn = files.map(decodePng);
    const pack = packAssets(assetsIn);
    assert.equal(pack.sprites.length, assetsIn.length);
    const total = assetsIn.reduce((sum, a) => sum + a.width * a.height, 0);
    assert.ok(pack.width * pack.height >= total, "the sheet is at least as large as its content");
    for (const sprite of pack.sprites) {
        assert.ok(sprite.x >= 0 && sprite.y >= 0);
        assert.ok(sprite.x + sprite.width <= pack.width);
        assert.ok(sprite.y + sprite.height <= pack.height);
    }
    // packAssets validates overlap itself and throws; assert the layout is
    // also deterministic for the same set of inputs.
    const again = packAssets(files.slice().reverse().map(decodePng));
    assert.deepEqual(
        again.sprites.map(s => `${s.name}@${s.x},${s.y}`).sort(),
        pack.sprites.map(s => `${s.name}@${s.x},${s.y}`).sort(),
        "the layout depends on the set of assets, not on their order"
    );
});

test("writeAtlas produces a sheet whose every rect is pixel-identical to its source PNG", () => {
    const out = mkdtempSync(join(tmpdir(), "v2-atlas-test-"));
    try {
        const files = ["font.png", "panel_dark.png", "button_inlay.png", "button_inlay_green.png", "record.png", "keybutton_hover.png"].map(name => join(SRC, name));
        const result = writeAtlas(files, { outDir: out });
        assert.ok(existsSync(result.sheetPath) && existsSync(result.mapPath));
        assert.equal(result.map.length, files.length);

        const sheet = decodePng(result.sheetPath);
        assert.equal(sheet.width, result.width);
        assert.equal(sheet.height, result.height);

        const map = JSON.parse(readFileSync(result.mapPath, "utf8"));
        assert.deepEqual(map, result.map);
        for (const entry of map) {
            const source = decodePng(join(SRC, `${entry.name}.png`));
            assert.equal(entry.width, source.width, `${entry.name} width`);
            assert.equal(entry.height, source.height, `${entry.name} height`);
            assert.ok(pixelsMatch(sheet, source, entry), `${entry.name} pixels survive packing and re-encoding`);
        }
        // The sprite name is the source file's base name: that *is* the trace
        // from a skin asset to its artwork file.
        assert.deepEqual(map.map(e => e.name).sort(), files.map(f => basename(f, ".png")).sort());
    } finally {
        rmSync(out, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("encodePng round-trips arbitrary RGBA", () => {
    const width = 7;
    const height = 5;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) % 256;
    const out = mkdtempSync(join(tmpdir(), "v2-png-test-"));
    try {
        const file = join(out, "probe.png");
        writeFileSync(file, encodePng(width, height, rgba));
        const decoded = decodePng(file);
        assert.equal(decoded.width, width);
        assert.equal(decoded.height, height);
        assert.ok(decoded.data.equals(rgba), "every byte survives filter selection, deflate and decoding");
    } finally {
        rmSync(out, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("refuses two source files that would claim the same asset name", () => {
    const out = mkdtempSync(join(tmpdir(), "v2-atlas-dup-"));
    try {
        // An asset name is a source file's base name, so two files sharing one
        // base name would make the trace ambiguous.
        mkdirSync(join(out, "other"), { recursive: true });
        copyFileSync(join(SRC, "record.png"), join(out, "record.png"));
        copyFileSync(join(SRC, "button_inlay.png"), join(out, "other", "record.png"));
        assert.throws(() => writeAtlas([join(out, "record.png"), join(out, "other", "record.png")], { outDir: join(out, "atlas") }), /duplicate asset name "record"/);
    } finally {
        rmSync(out, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});
