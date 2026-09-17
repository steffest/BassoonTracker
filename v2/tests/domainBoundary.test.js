import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

// Spec 028: domain/playback/README.md and domain/song/README.md both claim
// that only domain/playback/index.js (and, as documented exceptions,
// domain/song/index.js and, since spec 037, domain/moduleExport/*.js) may
// reach into domain/playback/engine/. This makes that claim mechanical
// instead of a paragraph nobody checks again.

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2 = join(__dirname, "..");
const LINE = /\r?\n/;

function sourceFiles() {
    const files = [join(V2, "build.mjs"), join(V2, "server.mjs"), join(V2, "capabilities.js")];
    const walk = dir => {
        if (!existsSync(dir)) return;
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(js|mjs)$/.test(name)) files.push(full);
        }
    };
    // Spec 065: this used to name "domain/song" and "domain/moduleExport"
    // individually, so every domain folder added since (settings, providers,
    // randomSong, sampleEditor, nibbles, arrangement, diskOperations,
    // playlist, ...) was silently never scanned by any check below - a real,
    // confirmed gap found while adding domain/playlist/, not this spec's own
    // regression. "domain" alone covers all of them, including the two
    // already named.
    ["compiler", "runtime", "renderers", "workbench", "app", "tests", "domain"].forEach(dir => walk(join(V2, dir)));
    return files;
}

/**
 * Line-per-line source with comments blanked out (block comments keep their
 * own newlines so line numbers stay accurate), so a doc comment that merely
 * *mentions* "localStorage" or a provider host as an example or a design
 * note - real, existing prose found in domain/nibbles/, domain/settings/ and
 * domain/playback/engine/fileformats/detect.js once "domain" was widened
 * above - cannot masquerade as the code violation these checks look for.
 */
function codeLines(content) {
    const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ""));
    return withoutBlockComments.split(LINE).map(line => line.replace(/\/\/.*/, ""));
}

const ENGINE_IMPORT_EXCEPTIONS = ["domain/song/index.js", "domain/moduleExport/index.js", "domain/moduleExport/protracker.js"];

test("only the documented exceptions reach into domain/playback/engine/ from outside domain/playback/", () => {
    const engineImport = /from\s+["'][^"']*domain\/playback\/engine\//;
    const offenders = [];
    for (const file of sourceFiles()) {
        const relPath = relative(V2, file).split("\\").join("/");
        if (ENGINE_IMPORT_EXCEPTIONS.includes(relPath)) continue;
        codeLines(readFileSync(file, "utf8")).forEach((line, index) => {
            if (engineImport.test(line)) offenders.push(`${relPath}:${index + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], "only the documented exceptions may import domain/playback/engine/*");
});

test("each documented exception does import the engine", () => {
    for (const relPath of ENGINE_IMPORT_EXCEPTIONS) {
        const content = readFileSync(join(V2, relPath), "utf8");
        assert.match(content, /from\s+["']\.\.\/playback\/engine\/tracker\.js["']/, relPath);
    }
});

// Spec 033: domain/settings/ owns both localStorage keys it persists.
// domain/settings/storage.js itself is the one place `localStorage` is
// named directly - everything else goes through createStorage()'s Storage
// argument, so this walk excludes only that one file.

// Both checks below exclude this file itself (its own test names/regexes
// mention the very strings it looks for) and the two settings test files
// that legitimately construct fixtures naming them (createFakeStorage seeds,
// and settingsStorage.test.js's own globalThis.localStorage stubbing).
const SETTINGS_TEST_FILES = ["tests/domainBoundary.test.js", "tests/settingsStorage.test.js", "tests/settings.test.js"];

test("only domain/settings/storage.js names localStorage directly", () => {
    const offenders = [];
    for (const file of sourceFiles()) {
        const relPath = relative(V2, file).split("\\").join("/");
        if (relPath === "domain/settings/storage.js") continue; // the one place it's named
        if (SETTINGS_TEST_FILES.includes(relPath)) continue;
        codeLines(readFileSync(file, "utf8")).forEach((line, index) => {
            if (/\blocalStorage\b/.test(line)) offenders.push(`${relPath}:${index + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], "only domain/settings/storage.js may name localStorage directly");
});

test("only domain/settings/ names the bassoonTrackerSettings or favorites storage keys", () => {
    const offenders = [];
    for (const file of sourceFiles()) {
        const relPath = relative(V2, file).split("\\").join("/");
        if (relPath.startsWith("domain/settings/")) continue;
        if (SETTINGS_TEST_FILES.includes(relPath)) continue;
        codeLines(readFileSync(file, "utf8")).forEach((line, index) => {
            if (/bassoonTrackerSettings|["']favorites["']/.test(line)) offenders.push(`${relPath}:${index + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], "only domain/settings/ may name these storage keys");
});

// Spec 034: nothing outside domain/providers/ names one of the remote
// catalog hosts directly - domain/playback/index.js reaches fetchModuleUrl
// through domain/providers/index.js instead, and domain/diskOperations/
// (spec 036) reaches ModArchive/modules.pl only through their own browse()
// exports; domain/randomSong/ (spec 063) reaches the random-song endpoint
// only through domain/providers/bassoon.js#fetchRandomModuleUrl the same
// way, and domain/playlist/ (spec 065) reaches api/generatelist only
// through domain/providers/bassoon.js#fetchGeneratedPlayList. Excludes this
// file itself and tests/providers.test.js, tests/playback.test.js,
// tests/diskOperations.test.js, tests/randomSong.test.js and
// tests/playlist.test.js, which legitimately construct fixtures naming the
// proxied host (the exact url a real fetch would hit, used only as a
// fake-fetch map key or an expected-call assertion).
const PROVIDER_TEST_FILES = ["tests/domainBoundary.test.js", "tests/providers.test.js", "tests/playback.test.js", "tests/diskOperations.test.js", "tests/randomSong.test.js", "tests/playlist.test.js"];
const PROVIDER_HOSTS = /stef\.be|modarchive\.org/;

test("only domain/providers/ names a remote catalog provider's host directly", () => {
    const offenders = [];
    for (const file of sourceFiles()) {
        const relPath = relative(V2, file).split("\\").join("/");
        if (relPath.startsWith("domain/providers/")) continue;
        if (PROVIDER_TEST_FILES.includes(relPath)) continue;
        codeLines(readFileSync(file, "utf8")).forEach((line, index) => {
            if (PROVIDER_HOSTS.test(line)) offenders.push(`${relPath}:${index + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], "only domain/providers/ may name a provider host");
});
