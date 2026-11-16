const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve, dirname} = require("node:path");
const vm = require("node:vm");

// Exercise real tracker state and binary readers/writers; isolate browser services.
async function runtime() {
    const root = resolve(__dirname, "..");
    const context = vm.createContext({window: {}, console: {log() {}, warn() {}}});
    const stubs = {
        "script/src/host.js": {default: {}},
        "script/src/ui/ui.js": {default: {setInfo() {}, showDialog() {}}},
        "script/src/audio.js": {default: {waveFormFunction: {sine() {}}, setMasterVolume() {}, setAmigaLowPassFilter() {}}},
        "script/src/editor.js": {default: {}},
        "script/src/ui/input.js": {default: {}},
        "script/src/lib/waaclock.js": {default: {}},
        "script/src/models/playlist.js": {default: {}},
        "script/src/models/favorites.js": {default: {}},
        "script/src/provider/bassoon.js": {default: {}},
        "script/src/lib/util.js": {getUrlParameter() {}},
        "script/src/ui/stateManager.js": {default: {clear() {}}},
        "script/src/fileformats/soundtracker.js": {default: () => ({})},
        "script/src/fileformats/screamtracker.js": {default: () => ({})}
    };
    const cache = new Map();
    function moduleFor(file) {
        if (cache.has(file)) return cache.get(file);
        const stub = stubs[file.slice(root.length + 1)];
        const mod = stub
            ? new vm.SyntheticModule(Object.keys(stub), function() {
                for (const [key, value] of Object.entries(stub)) this.setExport(key, value);
            }, {context, identifier: file})
            : new vm.SourceTextModule(readFileSync(file, "utf8"), {context, identifier: file});
        cache.set(file, mod);
        return mod;
    }
    const tracker = moduleFor(resolve(root, "script/src/tracker.js"));
    await tracker.link((specifier, parent) => moduleFor(resolve(dirname(parent.identifier), specifier)));
    await tracker.evaluate();
    return {
        Tracker: tracker.namespace.default,
        FastTracker: cache.get(resolve(root, "script/src/fileformats/fasttracker.js")).namespace.default,
        FileDetector: cache.get(resolve(root, "script/src/fileformats/detect.js")).namespace.default,
        BinaryStream: cache.get(resolve(root, "script/src/filesystem.js")).namespace.BinaryStream,
        EventBus: cache.get(resolve(root, "script/src/eventBus.js")).namespace.default,
        EVENT: cache.get(resolve(root, "script/src/enum.js")).namespace.EVENT
    };
}

function write(FastTracker) {
    let file;
    FastTracker().write(result => { file = result; });
    assert.ok(file);
    return file;
}

test("XM export encodes edited note-offs and preserves all following cells", async () => {
    const {Tracker, FastTracker, BinaryStream} = await runtime();
    Tracker.new();
    const pattern = Tracker.getSong().patterns[0];
    Object.assign(pattern[0][0], {index: 145}); // NOTEOFF, as entered by the editor
    Object.assign(pattern[0][1], {index: 49, instrument: 1, volumeEffect: 48, effect: 15, param: 6});
    Object.assign(pattern[63][3], {index: 97}); // Imported XM note-off
    const file = write(FastTracker);
    assert.equal(new Uint8Array(file.buffer)[345], 97);
    const reloaded = FastTracker().load(new BinaryStream(file.buffer, true));
    for (let row = 0; row < 64; row++) {
        for (let channel = 0; channel < 4; channel++) {
            for (const key of ["index", "instrument", "volumeEffect", "effect", "param"]) {
                const expected = pattern[row][channel][key];
                assert.equal(reloaded.patterns[0][row][channel][key], key === "index" && expected === 145 ? 97 : expected,
                    `${row}:${channel} ${key}`);
            }
        }
    }
});

test("editing a real imported XM preserves subsequent pattern data on export", async () => {
    const {Tracker, FastTracker, BinaryStream} = await runtime();
    Tracker.new();
    const bytes = readFileSync(resolve(__dirname, "../demomods/darkdecember.xm"));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await Tracker.processFile(buffer, "darkdecember.xm", "");
    const original = Tracker.getSong();
    original.patterns[0][0][0].setIndex(145);
    const file = write(FastTracker);
    const reloaded = FastTracker().load(new BinaryStream(file.buffer, true));
    for (let p = 0; p < reloaded.patterns.length; p++) {
        for (let row = 0; row < original.patterns[p].length; row++) {
            for (let channel = 0; channel < original.channels; channel++) {
                for (const key of ["index", "instrument", "volumeEffect", "effect", "param"]) {
                    const expected = original.patterns[p][row][channel][key];
                    assert.equal(reloaded.patterns[p][row][channel][key], key === "index" && expected === 145 ? 97 : expected,
                        `${p}:${row}:${channel} ${key}`);
                }
            }
        }
    }
});
