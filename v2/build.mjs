#!/usr/bin/env node
// Release build (spec 007).
//
//   node v2/build.mjs skin    pack the source PNGs the compiled skin references
//                             into assets/skin/generated/atlas.png + atlas.json
//   node v2/build.mjs app     compile the YAML and emit the readable generated
//                             application into v2/app/ (plain ES modules,
//                             documented, one file per component/action)
//   node v2/build.mjs dist    bundle v2/app/ into v2/dist/: one hashed main
//                             file plus one hashed chunk per lazy-loaded
//                             feature, minified, no comments, assets copied
//   node v2/build.mjs         all three
//
// `app` needs nothing but Node. `dist` needs esbuild: run `npm install` in
// v2/ once (it is the only devDependency). Unresolved warnings never fail a
// build; they are printed and written to app/LOOSE-ENDS.md. Compile errors
// (syntax, missing app.ui.main, cycles) do fail it and leave the previous
// output untouched.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { compileApplication } from "./compiler/convert.js";
import { emitApplication } from "./compiler/emit.js";
import { writeAtlas } from "./tools/skinAtlas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2 = __dirname;
const CURRENT_DIR = join(V2, "project", "specs", "application", "current");
const DEFAULT_APP_DIR = join(V2, "app");
const DEFAULT_DIST_DIR = join(V2, "dist");
const SKIN_DIR = join(V2, "assets", "skin");
const SKIN_SRC_DIR = join(SKIN_DIR, "src");
const SKIN_OUT_DIR = join(SKIN_DIR, "generated");

function readSource(relPath) {
    try {
        return readFileSync(join(CURRENT_DIR, relPath), "utf8");
    } catch {
        return null;
    }
}

function formatDiagnostic(d) {
    const location = d.range ? `${d.file}:${d.range.start.line}:${d.range.start.column}` : d.file || "";
    return `${d.severity.toUpperCase()} [${d.code}] ${location} ${d.message}`;
}

function sourceHash(sourceFiles) {
    const hash = createHash("sha256");
    for (const path of [...sourceFiles].sort()) hash.update(path).update("\0").update(readSource(path) || "").update("\0");
    return hash.digest("hex");
}

function toPosix(path) {
    return path.split(sep).join("/");
}

/**
 * Empties an output folder. Removing the folder itself is preferable (no
 * stale empty directories), but Windows cloud-sync clients and sandboxed
 * shells routinely hold a directory handle long enough to make that fail
 * while file deletion still works, so fall back to deleting the contents and
 * leaving the (now empty) folders behind rather than failing the build.
 */
function clearOutputDir(dir, log) {
    try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        return;
    } catch (error) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) clearOutputDir(full, null);
            else rmSync(full, { force: true, maxRetries: 10, retryDelay: 200 });
        }
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch {
            if (log) log(`  note: could not remove ${toPosix(relative(V2, dir))} itself (${error.code || error.message}); its contents were cleared instead`);
        }
    }
}

// The skin assets that exist on disk (spec 008), so a style naming artwork
// that is not there is reported instead of failing at load.
function listSkinAssets() {
    try {
        return readdirSync(SKIN_SRC_DIR).filter(name => name.toLowerCase().endsWith(".png")).map(name => name.slice(0, -4));
    } catch {
        return [];
    }
}

export function compile() {
    const result = compileApplication("app.yaml", readSource, { listAssets: listSkinAssets });
    result.sourceHash = sourceHash(result.sourceFiles);
    return result;
}

/**
 * Packs exactly the assets the compiled skin references into one sheet plus
 * one map (spec 008). Development loads the individual PNGs instead, so this
 * only has to run before an `app`/`dist` build; both targets call it.
 */
export function buildSkin({ log = console.log } = {}) {
    const skin = compile().skin;
    const assets = (skin.assets || []).filter(asset => asset.file);
    if (assets.length === 0) {
        log("build skin: the compiled skin references no source assets (built-in fallback skin); nothing packed.");
        return null;
    }
    const missing = assets.filter(asset => !existsSync(join(SKIN_DIR, asset.file)));
    for (const asset of missing) log(`WARNING [unknown-skin-asset] ${asset.file} does not exist; it will draw as a placeholder`);
    const files = assets.filter(asset => !missing.includes(asset)).map(asset => join(SKIN_DIR, asset.file));
    if (files.length === 0) throw new Error("build skin: none of the referenced source PNGs exist");
    const result = writeAtlas(files, { outDir: SKIN_OUT_DIR });
    log(`
build skin: packed ${result.map.length} asset(s) into ${result.width}x${result.height} (${result.bytes} bytes)`);
    log(`  ${toPosix(relative(V2, result.sheetPath))}, ${toPosix(relative(V2, result.mapPath))}`);
    return result;
}

/**
 * Emits the readable app. Refuses to clear a target folder that was not
 * produced by this script (no `.generated` marker) unless it is empty.
 */
export async function buildApp({ appDir = DEFAULT_APP_DIR, log = console.log } = {}) {
    const compiled = compile();
    compiled.diagnostics.forEach(d => log(formatDiagnostic(d)));
    if (compiled.hardFailure) {
        throw new Error(`build: compile failed with ${compiled.diagnostics.filter(d => d.severity === "error").length} error(s); ${existsSync(appDir) ? "previous app/ left untouched" : "nothing written"}`);
    }
    const capabilities = (await import(pathToFileURL(join(V2, "capabilities.js")).href)).default || {};
    const libraryBase = toPosix(relative(appDir, V2)) || ".";
    const emitted = emitApplication(compiled, { capabilities, libraryBase });

    if (existsSync(appDir)) {
        const entries = readdirSync(appDir);
        if (entries.length && !entries.includes(".generated")) {
            throw new Error(`build: ${appDir} exists, is not empty and has no .generated marker; refusing to overwrite`);
        }
        clearOutputDir(appDir, log);
    }
    for (const [rel, text] of emitted.files) {
        const full = join(appDir, rel);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
    }
    log(`\nbuild app: wrote ${emitted.files.size} files to ${appDir}`);
    log(`  ui modules: ${emitted.uiModules.join(", ")}`);
    log(`  actions (lazy features): ${emitted.actions.map(a => `${a.moduleName}${a.capability ? "" : " [mock]"}`).join(", ") || "none"}`);
    log(`  state fields: ${Object.keys(emitted.stateFields).join(", ") || "none"}`);
    if (emitted.looseEnds.length) {
        log(`\n  ${emitted.looseEnds.length} loose end(s) (see app/LOOSE-ENDS.md; none fail the build):`);
        emitted.looseEnds.forEach(e => log(`   - [${e.kind}] ${e.subject} (${e.where}) -> ${e.did}`));
    } else {
        log("\n  0 loose ends.");
    }
    return { compiled, emitted, appDir };
}

async function loadEsbuild() {
    try {
        return await import("esbuild");
    } catch {
        throw new Error("build dist: esbuild is not installed. Run `npm install` inside v2/ (esbuild is the only devDependency), then retry.");
    }
}

/**
 * Bundles app/ into dist/: entry main.js -> dist/assets/main-[hash].js,
 * each dynamically imported action -> its own hashed chunk, minified, no
 * comments, ES modules with code splitting. Assets are copied and
 * config.js is swapped for one pointing at the copied location.
 */
export async function buildDist({ appDir = DEFAULT_APP_DIR, distDir = DEFAULT_DIST_DIR, log = console.log } = {}) {
    if (!existsSync(join(appDir, "main.js"))) throw new Error(`build dist: ${appDir}/main.js not found; run \`node v2/build.mjs app\` first`);
    const esbuild = await loadEsbuild();

    if (existsSync(distDir)) clearOutputDir(distDir, log);
    // The generated skin module names its atlas relative to the asset base,
    // as "generated/atlas.*", so the copy keeps that one folder level.
    mkdirSync(join(distDir, "assets", "skin", "generated"), { recursive: true });

    const distConfig = `export const ASSET_BASE = new URL("./skin/", import.meta.url);\nexport const MEDIA_BASE = new URL("./", import.meta.url);\n`;
    const configSwap = {
        name: "v2-dist-config",
        setup(build) {
            build.onLoad({ filter: /[\\/]config\.js$/ }, args => (resolve(args.path).startsWith(resolve(appDir)) ? { contents: distConfig, loader: "js" } : undefined));
        }
    };

    const result = await esbuild.build({
        entryPoints: [join(appDir, "main.js")],
        bundle: true,
        splitting: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        minify: true,
        legalComments: "none",
        sourcemap: false,
        outdir: join(distDir, "assets"),
        entryNames: "[name]-[hash]",
        chunkNames: "[name]-[hash]",
        metafile: true,
        plugins: [configSwap],
        logLevel: "silent"
    });

    const skinAssets = ["generated/atlas.png", "generated/atlas.json"];
    for (const name of skinAssets) {
        const from = join(SKIN_DIR, name);
        if (!existsSync(from)) throw new Error(`build dist: ${toPosix(relative(V2, from))} not found; run \`node v2/build.mjs skin\` first`);
        copyFileSync(from, join(distDir, "assets", "skin", name));
    }

    // Non-skin media a capability loads at runtime (spec 012's demo module;
    // spec 036 adds "data", the disk-operation screen's local module list;
    // spec 069 adds "data/playlists", the curated per-playlist snapshot
    // files the same screen's own "Playlists" target loads on demand - one
    // level of subdirectory nesting under "data", not a third top-level
    // media kind, so this list stays a flat array of relative paths rather
    // than growing a recursive-copy mechanism nothing else needs yet).
    // spec 081 adds "demomods", the real files the sidebar's own
    // boot-populated Songs tab (assets/data/demosongs.json) references -
    // this list is the one place a new asset subdirectory has to be named
    // or a release build silently 404s on it (dev serves the whole assets/
    // tree unfiltered, so this gap is invisible there).
    const mediaSubdirs = ["demo", "demomods", "data", "data/playlists"];
    const mediaAssets = [];
    for (const subdir of mediaSubdirs) {
        const mediaDir = join(V2, "assets", subdir);
        // "data" now also contains the "playlists" subdirectory itself (its
        // own entry in this same list, copied separately) - skip
        // directories here rather than trying to copyFileSync one.
        const names = existsSync(mediaDir)
            ? readdirSync(mediaDir).filter(name => !name.startsWith(".") && !statSync(join(mediaDir, name)).isDirectory())
            : [];
        if (names.length) mkdirSync(join(distDir, "assets", subdir), { recursive: true });
        for (const name of names) copyFileSync(join(mediaDir, name), join(distDir, "assets", subdir, name));
        mediaAssets.push(...names.map(name => `assets/${subdir}/${name}`));
    }

    // esbuild's metafile also reports dynamically imported modules as
    // "entryPoint"s of their chunks, so the real entry is the one for main.js.
    const outputs = Object.entries(result.metafile.outputs).map(([path, meta]) => ({ path: toPosix(relative(distDir, resolve(path))), bytes: meta.bytes, entryPoint: meta.entryPoint ? toPosix(meta.entryPoint) : null }));
    const entry = outputs.find(o => o.entryPoint && o.entryPoint.endsWith("/main.js"));
    if (!entry) throw new Error("build dist: esbuild produced no output for main.js");

    const html = readFileSync(join(appDir, "index.html"), "utf8")
        .replace(/<!-- GENERATED[^\n]*-->\n/, "")
        .replace('import { start } from "./main.js";', `import { start } from "./${entry.path}";`);
    writeFileSync(join(distDir, "index.html"), html);

    const manifest = {
        entry: entry.path,
        chunks: outputs.filter(o => o !== entry && o.path.endsWith(".js")).map(o => o.path),
        assets: [...skinAssets.map(name => `assets/skin/${name}`), ...mediaAssets],
        bytes: Object.fromEntries(outputs.map(o => [o.path, o.bytes])),
        sourceHash: compile().sourceHash
    };
    writeFileSync(join(distDir, "build-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

    log(`\nbuild dist: wrote ${distDir}`);
    log(`  entry:  ${entry.path} (${entry.bytes} bytes)`);
    for (const chunk of outputs.filter(o => o !== entry && o.path.endsWith(".js"))) log(`  chunk:  ${chunk.path} (${chunk.bytes} bytes)`);
    for (const asset of manifest.assets) log(`  asset:  ${asset} (${statSync(join(distDir, asset)).size} bytes)`);
    log("  index.html, build-manifest.json");
    return { distDir, manifest };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const target = process.argv[2] || "all";
    (async () => {
        if (!["skin", "app", "dist", "all"].includes(target)) throw new Error(`usage: node v2/build.mjs [skin|app|dist|all]`);
        if (target === "skin" || target === "app" || target === "all") buildSkin();
        if (target === "app" || target === "all") await buildApp();
        if (target === "dist" || target === "all") await buildDist();
    })().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
