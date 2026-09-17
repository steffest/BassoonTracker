# 036 — Design

## Overview

```
project/specs/application/current/components/fileOperationsPanel.yaml
  a target radioGroup (Bassoon/ModArchive/Modules.pl) + one fileBrowser

domain/diskOperations/index.js (new)
  setDiskTarget(app, detail)   the radioGroup's own capability
  setBrowserRow(app, detail)   the fileBrowser's own capability
  one in-memory tree per target, cached for the application's lifetime

v2/assets/data/modules.json (new)
  the curated local snapshot Bassoon's own tree reads

capabilities.js
  "disk-target.set"  -> domain/diskOperations/index.js#setDiskTarget
  "browser-row.set"  -> domain/diskOperations/index.js#setBrowserRow

build.mjs
  the dist asset-copy step generalized from one hardcoded folder to a list
```

## Confirming the fileBrowser's own id empirically, not by calculation

`runtime/fileBrowserController.js#rowsFieldOf(node)` derives a field name from `node.id`, and a node's id comes from `identity.js`'s own name/type-based slug rules, not from anything this spec controls directly. Rather than re-deriving those rules by reading them, the authored YAML was written first, `node compiler/generate.js` was run, and `project/specs/application/app-outline.json` was read back to confirm the real id: `main.fileOperationsPanel.browser` (the panel's own authored name, `fileOperationsPanel`, plus the fileBrowser's own authored name, `browser` - no collision, no suffix). `domain/diskOperations/index.js` hardcodes exactly that one string, the same way `domain/playback/index.js`'s `STATE_FIELDS` hardcodes field names no other spec needs to look up generically - there is exactly one `fileBrowser` instance in this application, so a lookup mechanism would be speculative generality with one caller.

The same empirical check confirmed the two commands' own derived names (`compiler/recipes.js`'s "set-value" recipe, from the authored action names `setDiskTarget`/`setBrowserRow`): `disk-target.set`/`disk-target.value` and `browser-row.set`/`browser-row.value`.

## Components and interfaces

### `project/specs/application/current/components/fileOperationsPanel.yaml`

```yaml
name: fileOperationsPanel
type: panel
layout:
  width: fill
  direction: column
visibleWhen:
  field: top-view.value
  oneOf:
    - File Operations
content:
  - text: "Load module:"
  - name: diskTargetRow
    type: panel
    layout:
      direction: row
    content:
      - type: label
        label: "From:"
      - type: radioGroup
        variant: buttons
        items:
          - label: Bassoon
          - label: ModArchive
          - label: Modules.pl
        actions:
          - change: setDiskTarget
  - name: browser
    type: fileBrowser
    layout:
      width: fill
      height: fill
    actions:
      - change: setBrowserRow
```

Replaces spec 026's own placeholder text (`"File operations (load/save) - not yet implemented..."`) entirely - the panel's own `visibleWhen`, unchanged since spec 026, is what already makes it reachable through the control bar's existing "File Operations" radio button.

### `domain/diskOperations/index.js`

```js
import { rowsFieldOf } from "../../runtime/fileBrowserController.js";
import { browse as browseModArchive } from "../providers/modArchive.js";
import { browse as browseModulesPl } from "../providers/modulesPl.js";
import { loadModule } from "../playback/index.js";

const BROWSER_ROWS_FIELD = rowsFieldOf({ id: "main.fileOperationsPanel.browser" });
const DISK_TARGET_FIELD = "disk-target.value";
const MODULES_JSON_PATH = "data/modules.json";

const MODARCHIVE_ROOT = () => [ /* four fixed items, matching data/modarchive.json */ ];
const MODULESPL_ROOT  = () => [ /* four fixed items, matching data/modulespl.json */ ];
const PROVIDERS = { ModArchive: browseModArchive, "Modules.pl": browseModulesPl };

const trees = {};          // target name -> mutable tree, cached per application lifetime
let currentTarget = null;
let flatRows = [];         // parallel to the last-published row array

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

async function rootFor(app, target) {
    if (trees[target]) return trees[target];
    if (target === "Bassoon") trees[target] = await loadBassoonRoot(app);
    else if (target === "ModArchive") trees[target] = MODARCHIVE_ROOT();
    else if (target === "Modules.pl") trees[target] = MODULESPL_ROOT();
    else trees[target] = [];
    return trees[target];
}

function flatten(nodes) {
    const rows = [], internal = [];
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

export async function setDiskTarget(app, detail) {
    const target = detail && detail.value;
    if (target !== "Bassoon" && target !== "ModArchive" && target !== "Modules.pl") return;
    currentTarget = target;
    await rootFor(app, target);
    if (app && app.state) app.state.set(DISK_TARGET_FIELD, target);
    publish(app);
    if (app && app.log) app.log("disk-target.set", { [DISK_TARGET_FIELD]: target });
}

export async function setBrowserRow(app, detail) {
    const node = flatRows[detail && detail.value];
    if (!node) return;
    if (Array.isArray(node.children)) {
        if (node.expanded) { node.expanded = false; publish(app); return; }
        node.expanded = true;
        if (node.children.length === 0) {
            const browse = PROVIDERS[currentTarget];
            const children = browse ? await browse(node.url) : [];
            node.children = children.length ? children : [{ title: "(no results)" }];
        }
        publish(app);
        return;
    }
    await loadModule(app, assetUrl(app, node.url));
}
```

### `v2/assets/data/modules.json`

One demo module already bundled, plus eight of v1's own absolute-URL entries, unchanged (title/url/icon/info). See requirements.md for why the rest of v1's own list is not carried forward.

### `capabilities.js`, `build.mjs`

```js
"disk-target.set": { module: "./domain/diskOperations/index.js", export: "setDiskTarget" },
"browser-row.set": { module: "./domain/diskOperations/index.js", export: "setBrowserRow" }
```

`build.mjs`'s dist asset copy: `mediaSubdirs = ["demo", "data"]`, looped instead of one hardcoded `assets/demo/` block; the manifest's own `assets` list and copy destinations both fall out of the loop unchanged in shape.

## Data models

A tree node: `{title, url?, children?, icon?, info?, expanded?}` - v1's own shape, unchanged; `children` present (even empty) marks a branch, absent marks a leaf, `expanded` and a since-fetched `children` array persist for the tree's own lifetime. A published row: `{title, icon, info, level, hasChildren}` - spec 035's own contract, unchanged.

## Error handling

- **The local snapshot fetch fails**: `loadBassoonRoot` returns `[]`; the target still switches, publishing an empty list rather than throwing.
- **A branch resolves to no children**: a single `{title: "(no results)"}` placeholder row (no `children` key, so it renders as a leaf that does nothing useful if clicked - acceptable, matching v1's own "error loading data" placeholder's own inertness).
- **A stale row index** (the list changed since a click was queued - not reachable synchronously today, but cheap to guard): `flatRows[index]` is `undefined`, and both capability functions return immediately.
- **`node.url` is relative and `app.media` is absent** (should not happen in the generated app, where `app.media` is always `MEDIA_BASE`): `assetUrl` falls back to a URL relative to this module's own file, matching every other capability's own `mediaUrl`-shaped fallback.

## Testing strategy

`tests/diskOperations.test.js` (new): both capabilities against a fake global `fetch` (Bassoon's snapshot, ModArchive's/modules.pl's live endpoints) and the real `wizballalt.mod` fixture for the "loads as the current module" case (reusing `domain/playback`'s own `createSilentContext`/`createEngine`, the same convention `tests/playback.test.js`/`tests/gridController.test.js` already use) - DISK-001 through DISK-003's full list, plus the fetch-count assertion that proves a branch's children are cached, not re-fetched on every expand.

`tests/domainBoundary.test.js` (extended): `tests/diskOperations.test.js` added to the existing provider-host exclusion list (spec 034's own convention) - it legitimately names a provider host as a fake-fetch map key.

## What this deliberately does not do

See requirements.md's Scope boundaries: no samples, no playlists, no save/export, no Dropbox, no local-file browsing, no `random.*`/menu wiring, no full v1 module list.
