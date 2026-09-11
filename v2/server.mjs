#!/usr/bin/env node
// Local Node service (spec 005 Phase 3: "Save files and refresh").
// Run: node v2/server.mjs   (or PORT=8080 node v2/server.mjs)
// Workbench URL: http://127.0.0.1:8877/workbench.html
// Listens on all network interfaces by default so other devices on the LAN
// can reach it; set HOST=127.0.0.1 to restrict it to this machine again.
//
// Serves v2/** as static files (so v2/workbench.html, v2/app.html and
// v2/preview-app.html all work exactly as
// they did under a plain static server) and adds a small constrained API for the workbench:
// list/read/write the YAML source tree and trigger a conversion. This
// replaces `python -m http.server` for local development; it is not a
// general file server or command runner. GET /api/skin-assets lists the
// available skin source PNG names for the workbench's Skin tab (spec 008);
// the PNGs themselves are ordinary static files under assets/skin/src.
//
// Security posture (design.md "Local Node service"): rejects requests whose
// Host header is not localhost or a bare IP literal on our port (this blocks
// DNS-rebinding attacks, which need a real hostname); every path is
// resolved and containment-checked against project/specs/application/current
// before any read or write; writes additionally require a random per-process
// token (fetched once via GET /api/token, which cross-origin pages cannot
// read due to the same-origin response) and only ever replace an *existing*
// file - this service does not create new files or run arbitrary commands.
//
// The module exports `createWorkbenchServer` so tests can run the exact same
// handler against a temporary source tree on an ephemeral port; it only
// starts listening on its own when executed directly as a script.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, extname, resolve, sep, isAbsolute } from "node:path";
import { networkInterfaces } from "node:os";
import { compileApplication, COMPILER_VERSION, OUTLINE_SCHEMA_VERSION } from "./compiler/convert.js";
import { parseYamlDocument } from "./compiler/yaml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_V2_ROOT = __dirname;
const DEFAULT_CURRENT_DIR = join(__dirname, "project", "specs", "application", "current");
const DEFAULT_SKIN_SRC_DIR = join(__dirname, "assets", "skin", "src");
const DEFAULT_OUTLINE_PATH = join(__dirname, "project", "specs", "application", "app-outline.json");
const DEFAULT_PORT = 8877;
const DEFAULT_HOST = "0.0.0.0";
const MAX_BODY_BYTES = 1_000_000;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".css": "text/css; charset=utf-8"
};

export function fileHash(text) {
    return createHash("sha256").update(text).digest("hex");
}

// Resolves a client-supplied relative path against `currentDir` and refuses
// anything that isn't a plain, contained ".yaml" path - no absolute paths,
// no "..", no drive-letter overrides (path.resolve treats an absolute
// second argument as replacing the base entirely, so isAbsolute is checked
// *before* resolving, not after). When the file exists, its real path (after
// junctions/symlinks) must also stay inside the root.
export function resolveCurrentPath(currentDir, relPath) {
    if (typeof relPath !== "string" || relPath.length === 0) return null;
    if (isAbsolute(relPath) || /^[A-Za-z]:/.test(relPath)) return null; // reject POSIX/Windows absolute and drive-letter paths
    const normalized = relPath.replace(/\\/g, "/");
    if (normalized.split("/").some(part => part === "..")) return null;
    if (!normalized.endsWith(".yaml")) return null;
    const full = resolve(currentDir, normalized);
    if (full !== currentDir && !full.startsWith(currentDir + sep)) return null;
    if (existsSync(full)) {
        const realRoot = realpathSync(currentDir);
        const realFull = realpathSync(full);
        if (realFull !== realRoot && !realFull.startsWith(realRoot + sep)) return null;
    }
    return { full, normalized };
}

function listYamlFiles(dir, base = dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listYamlFiles(full, base));
        else if (entry.isFile() && extname(entry.name) === ".yaml") {
            out.push(full.slice(base.length + 1).replace(/\\/g, "/"));
        }
    }
    return out.sort();
}

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
        "Cache-Control": "no-store"
    });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolvePromise, rejectPromise) => {
        const chunks = [];
        let size = 0;
        req.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                rejectPromise(Object.assign(new Error("request body too large"), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
        req.on("error", rejectPromise);
    });
}

/**
 * @param {{ currentDir?: string, skinSrcDir?: string, outlinePath?: string, v2Root?: string, host?: string, port?: number, log?: (line: string) => void }} [options]
 */
export function createWorkbenchServer(options = {}) {
    const currentDir = resolve(options.currentDir || DEFAULT_CURRENT_DIR);
    const skinSrcDir = resolve(options.skinSrcDir || DEFAULT_SKIN_SRC_DIR);
    const outlinePath = resolve(options.outlinePath || DEFAULT_OUTLINE_PATH);
    const v2Root = resolve(options.v2Root || DEFAULT_V2_ROOT);
    const host = options.host || DEFAULT_HOST;
    const token = randomBytes(16).toString("hex");
    const log = options.log || (() => {});
    let port = options.port ?? DEFAULT_PORT;
    let generation = 0;

    function readCompilerFile(relPath) {
        const resolved = resolveCurrentPath(currentDir, relPath);
        if (!resolved) return null;
        try {
            return readFileSync(resolved.full, "utf8");
        } catch {
            return null;
        }
    }

    // Available skin assets (spec 008), so a conversion can report artwork a
    // style names but no PNG provides.
    function listSkinAssets() {
        try {
            return readdirSync(skinSrcDir).filter(name => name.toLowerCase().endsWith(".png")).map(name => name.slice(0, -4));
        } catch {
            return [];
        }
    }

    function sourceHashes(sourceFiles) {
        const perFile = {};
        const combined = createHash("sha256");
        for (const path of [...sourceFiles].sort()) {
            const text = readCompilerFile(path) || "";
            perFile[path] = fileHash(text);
            combined.update(path).update("\0").update(text).update("\0");
        }
        return { perFile, combined: combined.digest("hex") };
    }

    // All mutating requests (PUT /api/source, POST /api/convert) run through
    // this single queue. design.md asks for hash-recheck-and-retry against
    // concurrent writes during conversion; serializing every mutation through
    // one in-process queue removes that race for *workbench* writes. External
    // editors can still change a file while compileApplication reads the
    // graph, so runConvert re-hashes every input after compiling and retries
    // (bounded) when anything moved underneath it.
    let queue = Promise.resolve();
    function enqueue(fn) {
        const result = queue.then(fn, fn);
        queue = result.catch(() => {});
        return result;
    }

    function formatDiagnostic(d) {
        const location = d.range ? `${d.file}:${d.range.start.line}:${d.range.start.column}` : d.file || "";
        return `${d.severity.toUpperCase()} [${d.code}] ${location} ${d.message}`;
    }

    function runConvert() {
        const MAX_ATTEMPTS = 3;
        let attempt = 0;
        while (true) {
            attempt += 1;
            const before = sourceHashes(listYamlFiles(currentDir));
            const result = compileApplication("app.yaml", readCompilerFile, { listAssets: listSkinAssets });
            const after = sourceHashes(listYamlFiles(currentDir));
            if (before.combined !== after.combined) {
                if (attempt < MAX_ATTEMPTS) continue;
                return {
                    published: false,
                    hardFailure: false,
                    retried: attempt,
                    diagnostics: [{ severity: "error", code: "source-changed-during-conversion", file: "app.yaml",
                        message: `source files kept changing on disk during ${attempt} conversion attempts; previous app-outline.json retained` }]
                };
            }
            result.diagnostics.forEach(d => log(formatDiagnostic(d)));
            if (result.hardFailure) {
                log(`convert: compile failed; leaving ${existsSync(outlinePath) ? "the previous app-outline.json" : "no output"} in place.`);
                return { published: false, hardFailure: true, diagnostics: result.diagnostics };
            }
            const hashes = sourceHashes(result.sourceFiles);
            generation += 1;
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
            const tmpPath = `${outlinePath}.tmp-${process.pid}`;
            writeFileSync(tmpPath, JSON.stringify(outline, null, 2) + "\n");
            renameSync(tmpPath, outlinePath);
            const warningCount = result.diagnostics.filter(d => d.severity === "warning").length;
            log(`convert: generation ${generation} published (${warningCount} warning(s), 0 errors).`);
            return { published: true, hardFailure: false, generation, diagnostics: result.diagnostics, sourceHash: hashes.combined, sourceFileHashes: hashes.perFile };
        }
    }

    function hasToken(req) {
        return req.headers["x-v2-token"] === token;
    }

    // Accept localhost and bare IP literals (IPv4 or bracketed IPv6) on our
    // port. Real hostnames are rejected so a DNS-rebinding page cannot reach
    // the API even though the server listens on every interface.
    function isTrustedHost(req) {
        const hostHeader = req.headers.host || "";
        const match = /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:.]+\])(?::(\d+))?$/.exec(hostHeader);
        if (!match) return false;
        const headerPort = match[2] ? Number(match[2]) : 80;
        return headerPort === port;
    }

    async function handleApi(req, res, url) {
        if (!isTrustedHost(req)) return sendJson(res, 403, { error: "untrusted host header" });

        if (req.method === "GET" && url.pathname === "/api/token") {
            return sendJson(res, 200, { token });
        }

        if (req.method === "GET" && url.pathname === "/api/files") {
            return sendJson(res, 200, { files: listYamlFiles(currentDir) });
        }

        if (req.method === "GET" && url.pathname === "/api/skin-assets") {
            return sendJson(res, 200, { assets: listSkinAssets() });
        }

        if (req.method === "GET" && url.pathname === "/api/source") {
            const resolved = resolveCurrentPath(currentDir, url.searchParams.get("path") || "");
            if (!resolved || !existsSync(resolved.full)) return sendJson(res, 404, { error: "not found" });
            const text = readFileSync(resolved.full, "utf8");
            return sendJson(res, 200, { path: resolved.normalized, text, hash: fileHash(text) });
        }

        if (req.method === "PUT" && url.pathname === "/api/source") {
            if (!hasToken(req)) return sendJson(res, 403, { error: "missing or invalid token" });
            let body;
            try {
                body = JSON.parse(await readBody(req));
            } catch (error) {
                return sendJson(res, error.status || 400, { error: error.status ? error.message : "invalid JSON body" });
            }
            const resolved = resolveCurrentPath(currentDir, body.path);
            if (!resolved || !existsSync(resolved.full)) return sendJson(res, 404, { error: "not found (this service only replaces existing files)" });
            if (typeof body.text !== "string") return sendJson(res, 400, { error: "text is required" });

            return enqueue(() => {
                const onDisk = readFileSync(resolved.full, "utf8");
                const onDiskHash = fileHash(onDisk);
                if (body.baseHash !== onDiskHash) {
                    return sendJson(res, 409, { error: "conflict: file changed on disk since it was loaded", currentText: onDisk, currentHash: onDiskHash });
                }
                const { errors } = parseYamlDocument(body.text, resolved.normalized);
                if (errors.length > 0) {
                    return sendJson(res, 422, { error: "invalid YAML syntax", errors });
                }
                const tmpPath = `${resolved.full}.tmp-${process.pid}`;
                try {
                    writeFileSync(tmpPath, body.text);
                    renameSync(tmpPath, resolved.full);
                } catch (error) {
                    return sendJson(res, 500, { error: `write failed: ${error.message}` });
                }
                log(`save: ${resolved.normalized}`);
                return sendJson(res, 200, { path: resolved.normalized, hash: fileHash(body.text) });
            });
        }

        if (req.method === "POST" && url.pathname === "/api/convert") {
            if (!hasToken(req)) return sendJson(res, 403, { error: "missing or invalid token" });
            return enqueue(() => sendJson(res, 200, runConvert()));
        }

        if (req.method === "GET" && url.pathname === "/api/outline") {
            if (!existsSync(outlinePath)) return sendJson(res, 404, { error: "no app-outline.json yet; POST /api/convert first" });
            return sendJson(res, 200, JSON.parse(readFileSync(outlinePath, "utf8")));
        }

        return sendJson(res, 404, { error: "unknown API endpoint" });
    }

    function serveStatic(req, res, url) {
        let relPath = decodeURIComponent(url.pathname);
        if (relPath === "/") relPath = "/workbench.html";
        if (relPath.includes("..")) return sendJson(res, 400, { error: "invalid path" });
        const full = join(v2Root, relPath);
        if (!full.startsWith(v2Root + sep) || !existsSync(full) || !statSync(full).isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found");
            return;
        }
        const mime = MIME_TYPES[extname(full)] || "application/octet-stream";
        // Everything served here is under active development: never let the
        // browser hand back a cached app-outline.json or module after a save.
        res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
        res.end(readFileSync(full));
    }

    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
            if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
            else serveStatic(req, res, url);
        } catch (error) {
            sendJson(res, error.status || 500, { error: error.message });
        }
    });

    // URLs a browser can actually open. When bound to a single address that
    // is the only entry; when bound to all interfaces (0.0.0.0 / ::) it lists
    // loopback plus every non-internal IPv4 address of this machine.
    function reachableHosts() {
        if (host !== "0.0.0.0" && host !== "::") return [host];
        const hosts = ["127.0.0.1"];
        for (const entries of Object.values(networkInterfaces())) {
            for (const entry of entries || []) {
                if (entry.family === "IPv4" && !entry.internal) hosts.push(entry.address);
            }
        }
        return hosts;
    }

    function listen() {
        return new Promise((resolvePromise, rejectPromise) => {
            server.once("error", rejectPromise);
            server.listen(port, host, () => {
                port = server.address().port;
                resolvePromise({ host, port, token, hosts: reachableHosts() });
            });
        });
    }

    function close() {
        return new Promise(resolvePromise => server.close(() => resolvePromise()));
    }

    return { server, listen, close, get token() { return token; }, get port() { return port; } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const service = createWorkbenchServer({
        host: process.env.HOST || DEFAULT_HOST,
        port: Number(process.env.PORT) || DEFAULT_PORT,
        log: line => console.log(line)
    });
    service.listen().then(({ host, port, token, hosts }) => {
        console.log(`listening on ${host}:${port}`);
        for (const h of hosts) {
            console.log(`v2 workbench:          http://${h}:${port}/workbench.html`);
            console.log(`v2 application:        http://${h}:${port}/app.html`);
            console.log(`v2 authoring preview:  http://${h}:${port}/preview-app.html`);
        }
        console.log(`(preview-app.html is the same app with Inspect/Interact toolbar and diagnostics panel)`);
        console.log(`write token (workbench.html fetches this itself via GET /api/token): ${token}`);
    }).catch(error => {
        console.error(`v2 workbench server failed to start: ${error.message}`);
        process.exitCode = 1;
    });
}
