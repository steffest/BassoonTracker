# 003 — Live workbench design

## Schema version 1 (outline)

Two top-level sections, validated independently:

- `state`: named fields with a type (`enum`, `string`, `id-ref`, ...) and, where relevant, allowed values. Example fields: `playback.status` (enum: `stopped`, `playing`), `instruments.selectedId` (id-ref into `instruments.items`).
- `view`: `schemaVersion`, `id`, `template` (`editor-workspace` for now), `density`, `regions` (each with a role and either `controls` for template-inferred rows or a `component` + `model` for a specialized component), and `layout` (`priority` order, `secondaryWhenNarrow`).

Commands (`transport.play`, `transport.stop`, `instruments.select`, `sampleEditor.open`) and selectors (read paths into `state`) are named and resolved against an explicit registry (`runtime/commands.js`); they are never inline expressions. See `templates/editor-workspace.js` for the expansion rules once implemented.

Rule IDs: every requirement in requirements.md (LWB-00x) may be cited by one or more nodes in the example view document via a `rule` field per control; the normalizer copies it onto the produced node alongside the JSON Pointer-style source path.

## Pipeline (LWB-003, LWB-004)

```
JSON document -> validate (schema, ids, refs) -> normalize (expand template, resolve bindings/commands, attach rule/path) -> component tree
```

`runtime/validate.js` checks schema version, required fields, duplicate IDs, unknown component types and unresolved command/selector names, returning a list of `{ path, message }` diagnostics instead of throwing on the first error. `runtime/normalize.js` consumes a validated document only; it is pure (same input, same output tree, same generated IDs) and does not read the store. `templates/editor-workspace.js` expands `regions.*.controls` entries into primitive nodes (`panel`, `row`, `label`, `button`, `listbox`); a `component` region (e.g. `instrument-list`) is passed through with its `model` selector attached rather than expanded.

`runtime/store.js` holds `state` plus a subscriber list keyed by top-level field path; `set(path, value)` notifies only subscribers of that path. `runtime/commands.js` is a registry of `{ id, isEnabled(state), run(state, dispatchArgs) }`; the dispatcher looks up the command, checks `isEnabled`, and calls `run`, which calls `store.set`. Renderers never call `store.set` directly; they call `dispatch(commandId, args)`.

`domain/mock-tracker.js` supplies the initial `state` value and registers the four commands above against the store; "mock" is visible in the rendered status label text (e.g. "Stopped (mock)") per APP-007.

## Layout (LWB-006)

`runtime/layout.js` takes the normalized tree plus a viewport size and returns `{ nodeId: rect }` for every node, using row/column/gap/padding/min-size rules and a remaining-space pass for the region marked to fill. The `editor-workspace` template's `layout.secondaryWhenNarrow: "drawer"` policy is interpreted here: below a width threshold, the secondary region is omitted from the row and layout instead produces a toggle button node plus an off-canvas/hidden secondary panel. Layout runs once at mount and again only when viewport size or the normalized tree identity changes; it does not run on a `store` notification alone.

## Canvas renderer (LWB-007)

`renderers/canvas/` mounts by walking the component tree and, for each node, drawing via adapted bitmap-font/sprite routines (audited from the legacy `script/src/ui` implementation; adaptation notes and copied file provenance are recorded in `project/documentation/runtime.md` once ported, per AGENTS.md's provenance requirement). No `fillText` is used anywhere in this renderer.

A parallel minimal semantic DOM tree (visually hidden, positioned to match hit-test rects) carries focus and accessible names for canvas controls per README.md's "Renderer contract"; pointer and keyboard both resolve to the same `dispatch(commandId)` call, and the renderer suppresses the semantic-DOM activation when it already handled the same input to avoid double dispatch.

Redraws are coalesced onto one `requestAnimationFrame` per invalidation batch; a node invalidates only on a layout change or a subscribed state change affecting its own bound value (e.g. the status label subscribes to `playback.status` only). After settling, no further frames are scheduled.

## Entry points (LWB-008)

`v2/preview.html` loads only `runtime/`, `templates/`, `renderers/canvas/`, `domain/` and the example view/state documents — no workbench module. `v2/dev.html` is the same preview embedded plus a minimal workbench shell reserved for spec 002/006 work; for this spec it may be a thin wrapper that just mounts the preview, so opening it does not yet imply editing UI exists. Both are verified from a plain static server (e.g. `npx serve v2` or `python -m http.server`) in addition to the Vite dev server, since Vite can mask bare-specifier or MIME assumptions that a plain static server would reject.

## Errors, verification and performance

Validation errors are collected (not fail-fast on the first one) and reported with the JSON path; the previous successfully-mounted tree, if any, is left in place. Tests are dependency-free (plain assertions run via a small runner or Node's built-in `node:test`/`assert`), covering: schema validation acceptance/rejection cases, normalization determinism and rule/path attachment, store subscription scoping, command enablement, and layout's narrow-width fallback. Canvas hit-testing and keyboard activation are checked with a manual verification script recorded in tasks.md until a headless-canvas test harness is justified.

Out of scope for verification here: audio timing, real playback, DOM renderer parity (spec continues in a later phase), and lazy-loading network traces (step 7).
