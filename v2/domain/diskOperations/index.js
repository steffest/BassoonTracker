// The disk-operation screen's own capability (spec 036, extended by spec
// 069 for playlists), completing package P9's "disk-operation screens"
// piece - and, with spec 069's own addition, P9 in full. Wires
// `fileOperationsPanel.yaml`'s target radioGroup and fileBrowser (spec 035's
// mechanism) to five sources: a small curated local module snapshot
// ("Bassoon", this port's own equivalent of v1's `data/modules.json`), the
// two remote catalog browsers spec 034 already built (`domain/providers/
// {modArchive,modulesPl}.js#browse()`), a small curated local *playlist*
// snapshot ("Playlists", `data/playlists.json` - this port's own equivalent
// of v1's `playlists/main.json`), and HippoPlayer's own playlist listing
// (`domain/providers/hippo.js#browse()`, built in spec 034, unused until
// now). Dropbox, samples, MP3/WAV whole-song export and the local-file
// target are permanently out of scope (the port roadmap's own resolved open
// decisions 8/9) - see requirements.md.
//
// Mirrors script/src/ui/diskOperations.js's own shape: one mutable tree per
// target, cached across switches (not reset), each node expanded/collapsed
// in place and re-flattened into the fileBrowser's bound row array on every
// change - ported as a concept, not as code (v1's own version is entangled
// with its own imperative UI classes).

import { rowsFieldOf } from "../../runtime/fileBrowserController.js";
import { browse as browseModArchive } from "../providers/modArchive.js";
import { browse as browseModulesPl } from "../providers/modulesPl.js";
import { browse as browseHippo } from "../providers/hippo.js";
import { loadModule } from "../playback/index.js";
import { setPlaylist, openPlaylistUrl } from "../playlist/index.js";

// The fileBrowser instance this capability owns - fileOperationsPanel.yaml's
// only one, so one hardcoded id is simpler and no less correct than a
// lookup nothing else would use (contrast domain/playback's STATE_FIELDS,
// shared by several read/write sites).
const BROWSER_ROWS_FIELD = rowsFieldOf({ id: "main.songProperties.fileOperationsPanel.diskOperationsGrid.contentColumn.loadContent.browser" });
// Derived by compiler/recipes.js's "set-value" recipe from the authored
// action name `setDiskTarget` ("set disk target" -> "disk-target.set"/
// ".value"), the same way every other radioGroup's own field already is -
// see domain/settings/index.js's own SETTINGS_FIELDS table for the precedent.
const DISK_TARGET_FIELD = "disk-target.value";
const DISK_ACTION_FIELD = "disk-action.value";
const DISK_TYPE_FIELD = "disk-type.value";

const MODULES_JSON_PATH = "data/modules.json";
const PLAYLISTS_JSON_PATH = "data/playlists.json";

// v1's own `data/modarchive.json`/`data/modulespl.json` (read in full for
// spec 034's research): four fixed root items, each an unloaded branch
// (`children: []`) whose `url` is already exactly the pseudo-path
// domain/providers/{modArchive,modulesPl}.js#browse() understands. Small and
// unchanging, so hardcoded here rather than fetched as a third static asset.
const MODARCHIVE_ROOT = () => [
    { title: "Browse by artist", url: "artists", children: [] },
    { title: "Browse by genre", url: "genres", children: [] },
    { title: "Top rated in comments", url: "toprating", children: [] },
    { title: "Top rated in reviews", url: "topreview", children: [] }
];
const MODULESPL_ROOT = () => [
    { title: "Browse by artist", url: "artists", children: [] },
    { title: "Browse by genre", url: "genres", children: [] },
    { title: "Top Rating", url: "toprating", children: [] },
    { title: "Top Score", url: "topscore", children: [] }
];

const PROVIDERS = { ModArchive: browseModArchive, "Modules.pl": browseModulesPl };

// One tree per target, built lazily and cached for the lifetime of the
// application - switching targets and back preserves whatever was expanded,
// matching v1's own per-target module-level arrays in diskOperations.js.
const trees = {};
let currentTarget = null;
let flatRows = []; // parallel to the last-published row array: the real tree node behind each row

function assetUrl(app, path) {
    const base = app && app.media ? app.media : new URL("../../assets/", import.meta.url);
    return new URL(path, base).href;
}

async function loadBassoonRoot(app) {
    const response = await fetch(assetUrl(app, MODULES_JSON_PATH));
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data && data.modules) ? data.modules : [];
}

/**
 * `data/playlists.json` (spec 069, new) - a curated snapshot mirroring
 * `loadBassoonRoot`'s own precedent: v1's real `playlists/main.json` names
 * nine playlists, of which "Demo Songs" is entirely `demomods/`-relative
 * (the same folder spec 036 already declined to copy for modules.json) and
 * "My Favorites" is a different, server-side, anonymous-session feature
 * unrelated to `domain/settings/favorites.js` (both recorded, not silently
 * dropped, by spec 068's own research); the remaining seven each had their
 * own handful of `mods/...`-relative entries (never more than five) filtered
 * out the same way modules.json's own sixteen were.
 */
async function loadPlaylistsRoot(app) {
    const response = await fetch(assetUrl(app, PLAYLISTS_JSON_PATH));
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data && data.modules) ? data.modules : [];
}

async function rootFor(app, target) {
    if (trees[target]) return trees[target];
    if (target === "Bassoon") trees[target] = await loadBassoonRoot(app);
    else if (target === "ModArchive") trees[target] = MODARCHIVE_ROOT();
    else if (target === "Modules.pl") trees[target] = MODULESPL_ROOT();
    else if (target === "Playlists") trees[target] = await loadPlaylistsRoot(app);
    else if (target === "Hippo") trees[target] = await browseHippo("playlists");
    else trees[target] = [];
    return trees[target];
}

/** Flattens the currently expanded subtree into row descriptors, keeping `flatRows` in the same order for O(1) index lookup on click. */
function flatten(nodes) {
    const rows = [];
    const internal = [];
    (function visit(list, level) {
        for (const node of list) {
            rows.push({ title: node.title, icon: node.icon, info: node.info, level, hasChildren: Array.isArray(node.children) });
            internal.push(node);
            if (Array.isArray(node.children) && node.expanded) visit(node.children, level + 1);
        }
    })(nodes, 0);
    return { rows, internal };
}

function publish(app) {
    const { rows, internal } = flatten(trees[currentTarget] || []);
    flatRows = internal;
    if (app && app.state) app.state.set(BROWSER_ROWS_FIELD, rows);
}

/**
 * The target radioGroup's `change` capability. Switches which cached tree
 * the fileBrowser shows, fetching the local snapshot on its first use.
 */
const TARGETS = ["Bassoon", "ModArchive", "Modules.pl", "HippoPlayer.se", "Dropbox", "local", "Playlists", "Hippo"];

export async function setDiskAction(app, detail) {
    const action = detail && detail.value;
    if (!app?.state || !["Load", "Save"].includes(action)) return;
    app.state.set(DISK_ACTION_FIELD, action);
    await setDiskTarget(app, { value: action === "Save" ? "local" : "Bassoon" });
}

export async function setDiskType(app, detail) {
    const type = detail && detail.value;
    if (!app?.state || !["Module", "Sample", "Playlist"].includes(type)) return;
    app.state.set(DISK_TYPE_FIELD, type);
    await setDiskTarget(app, { value: app.state.get(DISK_ACTION_FIELD) === "Save" ? "local" : "Bassoon" });
}

export async function setDiskTarget(app, detail) {
    const authoredTarget = detail && detail.value;
    if (!TARGETS.includes(authoredTarget)) return;
    const type = app?.state?.get(DISK_TYPE_FIELD) || "Module";
    const target = authoredTarget === "HippoPlayer.se" ? "Hippo"
        : type === "Playlist" && authoredTarget === "Bassoon" ? "Playlists"
        : authoredTarget;
    currentTarget = target;
    await rootFor(app, target);
    if (app && app.state) app.state.set(DISK_TARGET_FIELD, authoredTarget);
    publish(app);
    if (app && app.log) app.log("disk-target.set", { [DISK_TARGET_FIELD]: authoredTarget });
}

/**
 * The fileBrowser's own `change` capability. A branch row toggles expanded
 * (lazily fetching its children through domain/providers's browse() the
 * first time); a leaf row loads it as the current module.
 */
export async function setBrowserRow(app, detail) {
    const index = detail && detail.value;
    const node = flatRows[index];
    if (!node) return;

    if (Array.isArray(node.children)) {
        if (node.expanded) {
            node.expanded = false;
            publish(app);
            return;
        }
        node.expanded = true;
        if (node.children.length === 0) {
            const browse = PROVIDERS[currentTarget];
            const children = browse ? await browse(node.url) : [];
            node.children = children.length ? children : [{ title: "(no results)" }];
        }
        publish(app);
        return;
    }

    // Spec 069: a "Playlists"/"Hippo" leaf sets a whole playlist as current,
    // rather than loading a single module - matching v1's own two disk-op
    // targets exactly (script/src/ui/diskOperations.js's own "playlists"/
    // "hippo" cases), each for a different real reason. "Playlists"'s own
    // rows point at a real file (JSON/PLS/M3U) needing the fetch-then-parse
    // domain/playlist#openPlaylistUrl already does (spec 068) - resolved
    // against v2's own asset base, the same as a Bassoon module leaf below.
    // "Hippo"'s own rows instead resolve through its own provider's second
    // browse() verb, which - unlike every other browse() call in this file -
    // already returns a ready-made {title, modules} object directly (see
    // domain/providers/hippo.js's own corrected JSDoc), so no fetch/parse of
    // this file's own is needed at all, only the guard against its one
    // failure shape ([] on a failed fetch).
    if (currentTarget === "Playlists") {
        await openPlaylistUrl(app, assetUrl(app, node.url));
        return;
    }
    if (currentTarget === "Hippo") {
        const data = await browseHippo(`playlist/${node.url}`);
        if (data && Array.isArray(data.modules)) setPlaylist(data, app);
        return;
    }

    // A remote catalog's own url is already absolute; a local snapshot entry
    // (e.g. "demo/wizballalt.mod") is relative to v2's own asset base, not to
    // wherever the page happens to be hosted - loadModule's own fallback
    // (page location) is the wrong base for that case, so this resolves it
    // the same way loadBassoonRoot() resolves modules.json itself.
    await loadModule(app, assetUrl(app, node.url));
}

/** Test/harness entry point: resets every cached tree and the current target. */
export function reset() {
    for (const key of Object.keys(trees)) delete trees[key];
    currentTarget = null;
    flatRows = [];
}
