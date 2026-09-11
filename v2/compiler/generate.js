#!/usr/bin/env node
// Development-time CLI (spec 005 Phase 1): compiles
// project/specs/application/current/app.yaml into a generated outline
// artifact the static preview can load without running this script again.
// Run: node v2/compiler/generate.js
//
// On a hard failure (YAML syntax error, missing app.yaml/app.ui.main), the
// previous output artifact is left untouched so the preview keeps showing
// the last usable result (spec 005 IWB-005/IWB-010) rather than being
// overwritten with nothing.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileApplication, COMPILER_VERSION, OUTLINE_SCHEMA_VERSION } from "./convert.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRENT_DIR = join(__dirname, "../project/specs/application/current");
const OUTPUT_PATH = join(__dirname, "../project/specs/application/app-outline.json");
const SKIN_SRC_DIR = join(__dirname, "../assets/skin/src");

function readFile(relPath) {
    const fullPath = join(CURRENT_DIR, relPath);
    try {
        return readFileSync(fullPath, "utf8");
    } catch {
        return null;
    }
}

// The available skin assets (spec 008): one PNG per asset name, so a state
// naming artwork that does not exist is reported instead of failing at load.
function listSkinAssets() {
    try {
        return readdirSync(SKIN_SRC_DIR).filter(name => name.toLowerCase().endsWith(".png")).map(name => name.slice(0, -4));
    } catch {
        return [];
    }
}

function fileHash(text) {
    return createHash("sha256").update(text).digest("hex");
}

// One hash per file (so the workbench can flag a single stale buffer without
// re-running generate.js) plus a combined hash over all of them (so the
// preview/workbench pair can detect they're looking at different overall
// revisions, per design.md "Record source hash and preview revision").
function sourceHashes(sourceFiles) {
    const perFile = {};
    const combined = createHash("sha256");
    for (const path of [...sourceFiles].sort()) {
        const text = readFile(path) || "";
        perFile[path] = fileHash(text);
        combined.update(path).update("\0").update(text).update("\0");
    }
    return { perFile, combined: combined.digest("hex") };
}

function formatDiagnostic(d) {
    const location = d.range ? `${d.file}:${d.range.start.line}:${d.range.start.column}` : d.file || "";
    return `${d.severity.toUpperCase()} [${d.code}] ${location} ${d.message}`;
}

function main() {
    const result = compileApplication("app.yaml", readFile, { listAssets: listSkinAssets });
    result.diagnostics.forEach(d => console[d.severity === "error" ? "error" : "warn"](formatDiagnostic(d)));

    const errorCount = result.diagnostics.filter(d => d.severity === "error").length;
    const warningCount = result.diagnostics.filter(d => d.severity === "warning").length;

    if (result.hardFailure) {
        console.error(`\ngenerate: compile failed (${errorCount} error(s)); leaving ${existsSync(OUTPUT_PATH) ? "the previous app-outline.json" : "no output"} in place.`);
        process.exitCode = 1;
        return;
    }

    const hashes = sourceHashes(result.sourceFiles);
    const outline = {
        outlineSchemaVersion: OUTLINE_SCHEMA_VERSION,
        compilerVersion: COMPILER_VERSION,
        sourceHash: hashes.combined,
        sourceFiles: [...result.sourceFiles].sort(),
        sourceFileHashes: hashes.perFile,
        root: result.root,
        skin: result.skin,
        diagnostics: result.diagnostics
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(outline, null, 2) + "\n");
    console.log(`\ngenerate: wrote ${OUTPUT_PATH} (${warningCount} warning(s), 0 errors).`);
}

main();
