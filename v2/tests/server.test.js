import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, symlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { request as httpRequest } from "node:http";
import { createWorkbenchServer, resolveCurrentPath, fileHash } from "../server.mjs";

// Runs the real server handler on an ephemeral loopback port against a
// throw-away copy of project/specs/application/current, so every test can
// write, corrupt and externally edit files without touching the real source.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_CURRENT = join(__dirname, "../project/specs/application/current");

let work, currentDir, outlinePath, service, base, token;

before(async () => {
    work = mkdtempSync(join(tmpdir(), "v2-server-test-"));
    currentDir = join(work, "current");
    outlinePath = join(work, "app-outline.json");
    cpSync(REAL_CURRENT, currentDir, { recursive: true });
    service = createWorkbenchServer({ currentDir, outlinePath, port: 0 });
    const info = await service.listen();
    base = `http://127.0.0.1:${info.port}`;
    token = info.token;
});

after(async () => {
    await service.close();
    rmSync(work, { recursive: true, force: true });
});

function api(path, init = {}) {
    const headers = { ...(init.headers || {}) };
    if (init.auth !== false && init.method && init.method !== "GET") headers["x-v2-token"] = token;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    return fetch(base + path, { ...init, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

// fetch() silently drops a custom Host header and normalizes "/../" away
// before sending, so requests that must reach the server verbatim go
// through node:http directly.
function rawRequest(path, headers = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
        const url = new URL(base);
        const req = httpRequest({ host: url.hostname, port: url.port, path, method: "GET", headers }, res => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", chunk => { text += chunk; });
            res.on("end", () => resolvePromise({ status: res.statusCode, headers: res.headers, text }));
        });
        req.on("error", rejectPromise);
        req.end();
    });
}

async function readSource(path) {
    const res = await api(`/api/source?path=${encodeURIComponent(path)}`);
    assert.equal(res.status, 200);
    return res.json();
}

test("resolveCurrentPath contains every path inside the current directory", () => {
    const ok = resolveCurrentPath(currentDir, "components/controlBar.yaml");
    assert.ok(ok);
    assert.equal(ok.normalized, "components/controlBar.yaml");
    assert.equal(resolveCurrentPath(currentDir, "components\\controlBar.yaml").normalized, "components/controlBar.yaml");

    for (const bad of [
        "", null, 42,
        "../app-outline.json",
        "components/../../secret.yaml",
        "/etc/passwd.yaml",
        "C:/Windows/win.yaml",
        "c:\\Windows\\win.yaml",
        "app.json",
        "components/controlBar.yaml.tmp"
    ]) {
        assert.equal(resolveCurrentPath(currentDir, bad), null, `expected rejection for ${JSON.stringify(bad)}`);
    }
});

test("resolveCurrentPath rejects a symlink/junction that escapes the root", { skip: process.platform === "win32" && "creating symlinks needs elevated rights on Windows" }, () => {
    const outside = join(work, "outside.yaml");
    writeFileSync(outside, "name: outside\n");
    const linkDir = join(currentDir, "linked");
    mkdirSync(linkDir);
    symlinkSync(outside, join(linkDir, "escape.yaml"));
    assert.equal(resolveCurrentPath(currentDir, "linked/escape.yaml"), null);
    rmSync(linkDir, { recursive: true, force: true });
});

test("GET /api/files lists only yaml files, relative and sorted", async () => {
    const res = await api("/api/files");
    assert.equal(res.status, 200);
    const { files } = await res.json();
    assert.deepEqual(files, [
        "actions/toggleplay.yaml",
        "app.yaml",
        "components/controlBar.yaml",
        "components/editPad.yaml",
        "components/fileOperationsPanel.yaml",
        "components/infoBar.yaml",
        "components/instrumentList.yaml",
        "components/nibblesPanel.yaml",
        "components/optionsPanel.yaml",
        "components/patternSidebar.yaml",
        "components/patternViewPanel.yaml",
        "components/pianoPanel.yaml",
        "components/sampleEditPanel.yaml",
        "components/songPatternList.yaml",
        "components/songProperties.yaml",
        "components/volumemeter.yaml",
        "rules/horizontalResize.yaml",
        "rules/noDependencies.yaml",
        "skin/default.yaml"
    ]);
});

test("GET /api/source returns text and hash; escapes and missing files are 404", async () => {
    const { text, hash } = await readSource("components/controlBar.yaml");
    assert.equal(text, readFileSync(join(currentDir, "components/controlBar.yaml"), "utf8"));
    assert.equal(hash, fileHash(text));
    for (const bad of ["../app-outline.json", "components/nope.yaml", "app.json"]) {
        const res = await api(`/api/source?path=${encodeURIComponent(bad)}`);
        assert.equal(res.status, 404, bad);
    }
});

test("API requests with a foreign Host header are refused", async () => {
    const res = await rawRequest("/api/files", { host: "evil.example:80" });
    assert.equal(res.status, 403);
    const ok = await rawRequest("/api/files", { host: `localhost:${service.port}` });
    assert.equal(ok.status, 200);
});

test("writes require the per-process token", async () => {
    const { text, hash } = await readSource("components/songProperties.yaml");
    const res = await api("/api/source", { method: "PUT", auth: false, body: { path: "components/songProperties.yaml", text, baseHash: hash } });
    assert.equal(res.status, 403);
    const convert = await api("/api/convert", { method: "POST", auth: false });
    assert.equal(convert.status, 403);
    assert.equal(readFileSync(join(currentDir, "components/songProperties.yaml"), "utf8"), text, "nothing was written");
});

test("PUT /api/source replaces an existing file atomically and returns the new hash", async () => {
    const { text, hash } = await readSource("components/songProperties.yaml");
    const edited = text.replace("width: fill", "width: fixed");
    assert.notEqual(edited, text);
    const res = await api("/api/source", { method: "PUT", body: { path: "components/songProperties.yaml", text: edited, baseHash: hash } });
    assert.equal(res.status, 200);
    const saved = await res.json();
    assert.equal(saved.hash, fileHash(edited));
    assert.equal(readFileSync(join(currentDir, "components/songProperties.yaml"), "utf8"), edited);
    assert.ok(!existsSync(join(currentDir, `components/songProperties.yaml.tmp-${process.pid}`)), "temp file cleaned up");
    // restore
    await api("/api/source", { method: "PUT", body: { path: "components/songProperties.yaml", text, baseHash: saved.hash } });
});

test("PUT /api/source never creates files, follows containment, and validates the body", async () => {
    const res404 = await api("/api/source", { method: "PUT", body: { path: "components/new.yaml", text: "name: new\n", baseHash: "x" } });
    assert.equal(res404.status, 404);
    assert.ok(!existsSync(join(currentDir, "components/new.yaml")));

    const escape = await api("/api/source", { method: "PUT", body: { path: "../escape.yaml", text: "x: 1\n", baseHash: "x" } });
    assert.equal(escape.status, 404);
    assert.ok(!existsSync(join(work, "escape.yaml")));

    const { hash } = await readSource("app.yaml");
    const noText = await api("/api/source", { method: "PUT", body: { path: "app.yaml", baseHash: hash } });
    assert.equal(noText.status, 400);

    const badJson = await fetch(base + "/api/source", { method: "PUT", headers: { "x-v2-token": token }, body: "{not json" });
    assert.equal(badJson.status, 400);
});

test("external edits produce a 409 conflict carrying the current disk text, not an overwrite", async () => {
    const { text, hash } = await readSource("rules/horizontalResize.yaml");
    const external = text + "# edited outside the workbench\n";
    writeFileSync(join(currentDir, "rules/horizontalResize.yaml"), external);

    const res = await api("/api/source", { method: "PUT", body: { path: "rules/horizontalResize.yaml", text: text + "# from workbench\n", baseHash: hash } });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.currentText, external);
    assert.equal(body.currentHash, fileHash(external));
    assert.equal(readFileSync(join(currentDir, "rules/horizontalResize.yaml"), "utf8"), external, "disk still holds the external edit");

    // Rebasing on the reported hash succeeds.
    const retry = await api("/api/source", { method: "PUT", body: { path: "rules/horizontalResize.yaml", text, baseHash: body.currentHash } });
    assert.equal(retry.status, 200);
});

test("invalid YAML is rejected with 422 and located errors; disk is untouched", async () => {
    const { text, hash } = await readSource("components/songProperties.yaml");
    const broken = text + "bad: [unterminated\n";
    const res = await api("/api/source", { method: "PUT", body: { path: "components/songProperties.yaml", text: broken, baseHash: hash } });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.ok(body.errors.length > 0);
    assert.ok(body.errors[0].range, "error carries a source range");
    assert.equal(readFileSync(join(currentDir, "components/songProperties.yaml"), "utf8"), text);
});

test("a failed disk replacement reports 500 and leaves the original in place", { skip: process.platform === "win32" && "read-only directory semantics differ on Windows" }, async () => {
    const dir = join(currentDir, "rules");
    const { text, hash } = await readSource("rules/noDependencies.yaml");
    chmodSync(dir, 0o555);
    try {
        const res = await api("/api/source", { method: "PUT", body: { path: "rules/noDependencies.yaml", text: text + "\n", baseHash: hash } });
        assert.equal(res.status, 500);
        assert.equal(readFileSync(join(currentDir, "rules/noDependencies.yaml"), "utf8"), text);
    } finally {
        chmodSync(dir, 0o755);
    }
});

test("POST /api/convert publishes app-outline.json with per-file hashes matching disk; GET /api/outline returns it", async () => {
    assert.ok(!existsSync(outlinePath));
    const res = await api("/api/convert", { method: "POST" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.published, true);
    assert.equal(body.hardFailure, false);
    assert.equal(body.generation, 1);
    assert.ok(body.diagnostics.length > 0, "the real graph has known warnings");
    assert.ok(existsSync(outlinePath));

    const outline = JSON.parse(readFileSync(outlinePath, "utf8"));
    assert.equal(outline.sourceHash, body.sourceHash);
    for (const [path, hash] of Object.entries(outline.sourceFileHashes)) {
        assert.equal(hash, fileHash(readFileSync(join(currentDir, path), "utf8")), path);
    }

    const get = await api("/api/outline");
    assert.equal(get.status, 200);
    const served = await get.json();
    assert.equal(served.sourceHash, outline.sourceHash);
});

test("a save followed by convert is reflected in the published outline", async () => {
    const { text, hash } = await readSource("components/controlBar.yaml");
    const edited = text.replace("label: Play", "label: Start");
    const save = await api("/api/source", { method: "PUT", body: { path: "components/controlBar.yaml", text: edited, baseHash: hash } });
    assert.equal(save.status, 200);
    const convert = await (await api("/api/convert", { method: "POST" })).json();
    assert.equal(convert.published, true);
    const outline = JSON.parse(readFileSync(outlinePath, "utf8"));
    // Spec 072 gave the pattern sidebar's own transport row a "Play" button
    // too, so a bare label-substring check would now find a real, unrelated
    // "Play" elsewhere in the tree - asserting on controlBar's own Play
    // button's specific compiled id is what this test actually means.
    assert.ok(JSON.stringify(outline.root).includes('"main.controlBar.button.Start"'));
    assert.ok(!JSON.stringify(outline.root).includes('"main.controlBar.button.Play"'));
    assert.equal(outline.sourceFileHashes["components/controlBar.yaml"], fileHash(edited));
    // restore
    await api("/api/source", { method: "PUT", body: { path: "components/controlBar.yaml", text, baseHash: (await save.json()).hash } });
});

test("a hard compile failure keeps the previous app-outline.json and reports saved-but-stale", async () => {
    const before = readFileSync(outlinePath, "utf8");
    const { text, hash } = await readSource("app.yaml");
    // Syntactically valid YAML, but app.ui.main is gone: a structural hard failure.
    const save = await api("/api/source", { method: "PUT", body: { path: "app.yaml", text: "app:\n  rules: noDependencies\n", baseHash: hash } });
    assert.equal(save.status, 200, "valid YAML is saved even when it will not convert");
    const convert = await (await api("/api/convert", { method: "POST" })).json();
    assert.equal(convert.published, false);
    assert.equal(convert.hardFailure, true);
    assert.ok(convert.diagnostics.some(d => d.severity === "error"));
    assert.equal(readFileSync(outlinePath, "utf8"), before, "previous generation retained");
    // restore
    const restore = await api("/api/source", { method: "PUT", body: { path: "app.yaml", text, baseHash: (await save.json()).hash } });
    assert.equal(restore.status, 200);
    assert.equal((await (await api("/api/convert", { method: "POST" })).json()).published, true);
});

test("a save and a convert racing on separate connections never publish a torn generation", async () => {
    const file = "components/controlBar.yaml";
    const { text, hash } = await readSource(file);
    const edited = text.replace("label: record", "label: recordRaced");
    assert.notEqual(edited, text);
    const oldHash = fileHash(text);
    const newHash = fileHash(edited);
    const [save, convert] = await Promise.all([
        api("/api/source", { method: "PUT", body: { path: file, text: edited, baseHash: hash } }),
        api("/api/convert", { method: "POST" })
    ]);
    assert.equal(save.status, 200);
    const result = await convert.json();
    assert.equal(result.published, true);
    // HTTP gives no ordering across two connections, so the convert may have
    // run before or after the save - but it must reflect exactly one of the
    // two on-disk states, and the published root must agree with the hash it
    // recorded for that file.
    const seen = result.sourceFileHashes[file];
    assert.ok(seen === oldHash || seen === newHash, "convert saw a complete file, never a partial write");
    const outline = JSON.parse(readFileSync(outlinePath, "utf8"));
    assert.equal(outline.sourceHash, result.sourceHash);
    assert.equal(JSON.stringify(outline.root).includes("recordRaced"), seen === newHash, "published root and recorded source hash agree");

    // The workbench's own sequence (await save, then convert) is deterministic.
    const followUp = await (await api("/api/convert", { method: "POST" })).json();
    assert.equal(followUp.sourceFileHashes[file], newHash);
    await api("/api/source", { method: "PUT", body: { path: file, text, baseHash: (await save.json()).hash } });
});

test("static files are served with no-store and the workbench is the default document", async () => {
    const res = await fetch(base + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(await res.text(), /workbench/);
    // "/../x" is normalized to "/x" by the URL parser before any check runs,
    // so it can never leave the root; percent-encoded dot segments with
    // backslashes survive parsing and must hit the containment check.
    const escape = await rawRequest("/..%5C..%5Cpackage.json");
    assert.ok(escape.status === 400 || escape.status === 404, `got ${escape.status}`);
    assert.ok(!escape.text.includes("bassoontracker-v2"));
    // Encoded dot segments are also normalized by the parser; whatever comes
    // back must be a v2 file or a clean error, never the parent repository's
    // README and never a crash.
    const outsideEncoded = await rawRequest("/%2e%2e/%2e%2e/README.md");
    assert.notEqual(outsideEncoded.status, 500);
    if (outsideEncoded.status === 200) assert.ok(readFileSync(join(__dirname, "../README.md"), "utf8") === outsideEncoded.text, "served v2/README.md, not a parent file");
});
