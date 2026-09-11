# Interactive workbench direction

Status: implemented and verified, all five phases (2026-09-10). Known limits are listed in the Reference section below. [Requirements](../specs/005-interactive-workbench/requirements.md), [design](../specs/005-interactive-workbench/design.md), [tasks](../specs/005-interactive-workbench/tasks.md), [compiler](compiler.md).

## Running it

```
node v2/server.mjs            # default http://127.0.0.1:8877/workbench.html (PORT=... to change)
node --test "v2/tests/*.test.js"
```

`v2/workbench.html` embeds `v2/preview-app.html` in an iframe and exchanges `postMessage`s with it (`v2:ready`/`v2:hover`/`v2:select`/`v2:mode`/`v2:setMode`/`v2:selectId`, each carrying the outline's `sourceHash` as a revision guard). The iframe owns hit-testing (`runtime/hitTest.js`) and the Inspect/Interact toggle; the workbench owns the file tree, one text buffer per file and a details panel (ancestry breadcrumbs, definition/use-site links, contributing-rule links).

The source editor is CodeMirror 6 (spec [006](../specs/006-codemirror-editor/requirements.md)), vendored as one MIT-licensed bundle under `v2/vendor/codemirror/` (provenance and regeneration in its README) and wrapped by `v2/workbench/editor.js`: YAML highlighting, a fold gutter with Fold all / Unfold buttons, and a lint gutter driven by the project's own `compiler/yaml.js`, so an underlined syntax error is exactly what Save would reject. While a buffer is clean and matches the last generation, the compiler's warnings for that file are overlaid at their ranges; editing withdraws them until the next Save & Refresh. Nothing under `vendor/` or `workbench/` is loaded by the standalone preview.

Served by `node v2/server.mjs`, the workbench is **live**: files come from `/api/files` + `/api/source`, the textarea is editable, and Save & Refresh (or Ctrl/Cmd+S) `PUT`s only the active buffer with its base hash, then `POST`s `/api/convert` and reloads the preview iframe, restoring Inspect/Interact mode and the selection by generated identity (a node whose label was edited gets a new identity and is reported as gone rather than re-selected). Unsaved buffers survive file switching and are marked in the tree/header; a `beforeunload` guard protects them. The `save` and `generation` status lines are separate on purpose: a valid file that no longer converts is reported as "saved; preview stale (previous generation kept)", never as unsaved. Conflicts (409: the file changed on disk since it was loaded) show a bar with two explicit choices, discard-mine or overwrite-disk; invalid YAML (422) stays an editable local draft with the error range selected and nothing written. Buffers keep each file's line-ending convention (a `<textarea>` always reports LF) and write it back on save; a file that already mixed CRLF and LF is unified to its dominant ending on first save. Served by any plain static host, the same page is **read-only**, exactly as in Phase 2, and says how to enable editing.

Source locations are only applied to a buffer whose text is what the last generation read: a dirty buffer or a disk file that changed since the last generation shows a stale-location notice instead of selecting unrelated text. A per-file SHA-256 (`app-outline.json`'s `sourceFileHashes`) backs this; in static mode it is computed client-side via `crypto.subtle`.

## Reference

**Start.** `node v2/server.mjs` prints three URLs (default port 8877; set `PORT` to change):

| URL | What it is |
|---|---|
| `/workbench.html` | the authoring workbench: file tree, CodeMirror editor, details, preview iframe, Interaction log, State gallery, Skin ([skin.md](skin.md)), Components ([components.md](components.md)) |
| `/app.html` | the **user-facing application**: the generated `app-outline.json` rendered with no authoring chrome (no Inspect/Interact toolbar, breadcrumbs or diagnostics panel; generation warnings go to the console only); always in Interact mode |
| `/preview-app.html` | the same application with the authoring tools switched on; this is what the workbench embeds |

`app.html` and `preview-app.html` run identically from any plain static host: they read `project/specs/application/app-outline.json` and never call the API or load `workbench/`, `vendor/` or `compiler/` code. They are development views of the outline. The **release** is generated code (spec [007](../specs/007-release-build/requirements.md)):

```
node v2/build.mjs app     # v2/app/: readable plain-JS app, one module per component and per action, LOOSE-ENDS.md
node v2/build.mjs dist    # v2/dist/: minified, comment-free bundle, one main file + one chunk per lazy feature (needs `npm install` in v2/ once, for esbuild)
node v2/build.mjs         # both
```

`app/index.html` is also served by the workbench server (`/app/index.html`); `dist/` is what you deploy. Regenerate the outline without the service: `node v2/compiler/generate.js`. Tests: `node --test "v2/tests/*.test.js"`.

**Interpreted prose (the whole vocabulary, `compiler/recipes.js`).** Anything not matched below is preserved verbatim and reported as an `unresolved-*` warning; nothing else is executed.

| Where | Phrase pattern | Generated binding |
|---|---|---|
| action | `toggle play state` | command `transport.toggle`, mock `playback.status` ∈ stopped/playing |
| action | `toggle recording` | command `record.toggle`, mock `record.active` ∈ false/true |
| action | `toggle <subject> on click` | command `<subject>.toggle`, mock `<subject>.active` ∈ false/true |
| rule | `highlighted when <subject> is active` | visual-state `highlighted`; subject mentioning play → `playback.status = "playing"`, record → `record.active = true`, otherwise a derived field active when `true` that no command drives |
| rule name | `horizontalResize` | layout-policy `resize-to-fit` |
| rule name | `noDependencies` | informational, no binding |

**Skin tab.** Spec [008](../specs/008-skin-assets/requirements.md) added a third tool tab that reads the compiled skin from the same outline: every component style by type and variant, one row per visual state with the source PNG behind it and the result drawn by the renderer, the variant by state library, and the components each variant draws. Its pickers set a state's artwork by splicing the exact scalar in the skin YAML buffer (never by re-emitting the document), leaving it unsaved for review; Ctrl+S saves and regenerates through the path described above. The details panel gained a `style:` row linking a component to its graphical representation and back. Details are in [skin.md](skin.md).

**Components tab.** Spec [009](../specs/009-component-registry/requirements.md) added a fourth tool tab showing the component-type catalogue the compiler and renderer share: each type's status, description, container shape, styling, interactivity, draw kind, the properties it accepts with their kinds, a sample drawn by its own draw kind, and the application nodes using it. It links to the Skin tab for a styled type and to the State gallery for an interactive one, and the details panel gained a `type:` row linking a selected component to its contract. Read-only: the registry is code. Details in [components.md](components.md).

**Diagnostics.** Errors stop publication and keep the previous `app-outline.json`: `yaml-syntax-error`, `missing-file`, `missing-app-root`, `missing-app-ui-main`, `reference-cycle`, `unsupported-content-item`, and the service's own `source-changed-during-conversion`. Warnings publish with visible limitations: `unresolved-action-reference` (no `actions/<name>.yaml`), `unresolved-action` (action prose not in the vocabulary), `unresolved-rule`, `unresolved-component-reference` (no `components/<name>.yaml`), `unsupported-component` (type not rendered or no type; drawn as a dashed placeholder), `ambiguous-duplicate-name` (identities suffixed `#1..#n`), `empty-label-variant`, `layout-default-fallback`, `unknown-component-property` (spec 009: a key the component's type does not declare), and the skin's own `unknown-skin-asset`, `unknown-style-variant`, `unknown-style-state`, `unknown-style-property`, `unresolved-style-extends`, `missing-skin`, `missing-skin-font`, `missing-skin-styles`, `missing-style-default`. Every diagnostic carries `file`, `range` and `nodeId` where applicable, is listed in the preview's diagnostics panel, printed to the browser console on each conversion and to the server console.

**Save semantics.** Save writes only the active buffer, as text, so comments and formatting survive; the file's line-ending convention is preserved (a file that already mixed CRLF and LF is unified to its dominant ending). The server checks the buffer's base hash (409 conflict with the current disk text on mismatch; the bar offers discard-mine or overwrite-disk), validates YAML syntax before touching disk (422; the draft stays local with the error range selected), replaces the file atomically, and never creates files. Conversion runs after a successful save; the `save` and `generation` status lines are independent: valid-but-unconvertible source is "saved; preview stale (previous generation kept)". Other unsaved buffers are never written or implied to be included. No Git commit or snapshot copy is ever made by Save.

**Known limits.** The Components tab is read-only; property editing remains spec 002's pending work. The Skin tab sets a state's artwork; other style properties (insets, size, label placement, fonts) are edited as YAML text. Radio items select as mock UI state but dispatch nothing (their prose is unresolved); `shortKey` is not bound; menu, volume meter and untyped notification lights are placeholders (two of which overlap inside the fixed-height top toolbar); nothing in the current `app.yaml` is disabled, so the disabled path is exercised via the details panel's mock toggle and the gallery; there is no DOM renderer and no real playback.

## Local service boundaries

`server.mjs` binds `127.0.0.1` only, rejects foreign `Host` headers, requires a random per-process token (`GET /api/token`, same-origin) on every write, accepts only relative `.yaml` paths that resolve (including through junctions/symlinks) inside `project/specs/application/current`, and only ever *replaces existing* files (temp file + rename), so it cannot create, delete or write anything else and runs no commands. All saves and conversions are serialized through one in-process queue; a conversion re-hashes every input after compiling and retries if an external editor changed a file mid-way, publishing `app-outline.json` atomically or keeping the previous one on a hard failure. Static files are served with `Cache-Control: no-store`. The service is a development tool; `preview-app.html` never needs it.

## Interact mode, Interaction log and State gallery

In Interact mode the preview feeds pointer and keyboard input (Tab cycles focus; Enter activates on keydown, Space on keyup) to a `runtime/buttonController.js` per supported button/radio item, and an activation dispatches the node's generated `command` bindings against an explicit **mock state** shown in the preview toolbar (`playback.status`, `record.active`, seeded from each command's `mockValues[0]`). `visual-state` bindings read that same state, so "highlighted when song playback is active" lights Play after `transport.toggle` because the compiler's recipes resolve both to `playback.status` (see [compiler](compiler.md)). Radio items select as mock UI state only; their prose rules are still unresolved warnings and they dispatch nothing. Nothing here is real playback; the console line says `dispatched … (mock)`.

Every input, state transition, activation result (`dispatched`, `inert`, `blocked-disabled`, `blocked-unfocused`) and command is emitted as a `v2:trace` message, stamped at the emitting boundary with one sequence counter and time origin. The workbench's **Interaction log** (`v2/workbench/interactionLog.js` over `runtime/traceCollector.js`) keeps a bounded ring buffer (capacity 500) and always states its condition: capturing or `PAUSED: n event(s) not captured`, `showing x of y (n hidden by filters)`, `dropped n`. Pause stops capture, filters (instance, kind) only change the view, Clear resets rows and counters. Clicking a row selects that instance in the preview. The details panel's "mock: disabled" toggle (`v2:setDisabled`) lets an author see a blocked activation with no command, since nothing in the current app.yaml is disabled.

The **State gallery** (`v2/workbench/stateGallery.js`) picks any supported interactive node from the outline and draws forced fixtures (default, hover, pressed, focused, disabled, plus on/off for nodes with a visual-state binding) with the same `renderers/canvas/buttonSkin.js` `drawButton()` the live renderer uses, labeled illustrative. Its live example runs the real controller against a private mock state and traces under renderer `gallery`; it has no path to the preview or to application commands. Bindings and node diagnostics are listed as links into the source. Both modules are loaded only by `workbench.html`; `preview-app.html` never requests them.

Names supply identity; internal IDs are generated. Commas separate label alternatives. Prose remains valid authoring input and bindings are generated in JSON. Unknown behavior produces warnings and explicit limitations; malformed YAML preserves the last usable preview. Code/outline generation during authoring is allowed; startup from generated source remains static. Git owns history. Reverse synchronization from code is future research.
