# 007 — Release build design

## Pipeline

```text
YAML (current/)  --compileApplication-->  tree + diagnostics   (compiler/convert.js, unchanged)
                                     |--> app-outline.json     (generate.js / server: dev representation)
                                     '--> compiler/emit.js --> app/   readable ES modules  (build.mjs app)
                                                                 '--> esbuild --> dist/   hashed, split, minified  (build.mjs dist)
```

The outline and the generated code come from the same compiled tree, so the workbench inspects exactly what the release renders. Nothing is evaluated at build time: the emitter writes source text.

## Generated code shape

- **Structure as code, behavior as references.** `ui/<container>.js` exports a factory returning a tree built with `runtime/components.js` constructors (`panel`, `radioGroup`, `radioItem`, `button`, `label`). Leaves carry `highlightedWhen(state)` predicates and `onActivate(app)` hooks; the outline's string command ids become `import()` references to `actions/<command>.js`, so a missing module is a build/resolution error rather than a silent runtime mock.
- **Actions are the lazy-load boundary.** Each command is its own module, imported dynamically on first activation. With the current mock actions this is trivially small, but it is exactly where a playback engine will sit, so the bundle already produces one chunk per feature.
- **State** is `runtime/appState.js`: the spec-003 store plus `onAnyChange`, so highlights follow changes from any action or capability, including asynchronous ones. Initial values come from command bindings first (`mockValues[0]`), visual-state fallbacks only for fields no command drives.
- **Rendering** reuses `renderers/canvas/mountGeneric.js` with `tools: false`, a host `state` store, an `appContext` for hooks and a configurable `assetBase`; the renderer honors `node.onActivate`/`node.highlightedWhen` before falling back to outline bindings, so hand-written trees and generated trees are treated identically.
- **Identity** is emitted explicitly (the compiler's ids), and `ensureIds()` fills the same rule for hand-written trees.

## Loose ends

The emitter never throws on warnings. Unsupported nodes are omitted with an inline comment at the position they would have occupied; radio items without an action are emitted but noted as UI-state only; commands without a capability mapping get a generated mock module that says so in its JSDoc. Every compiler warning not already covered by an omitted node becomes a row in `LOOSE-ENDS.md` with the YAML line and the handling. The build log prints the same list.

## Capabilities

`v2/capabilities.js` (default export) maps command id → `{ module, export }` relative to the v2 root. Mapped commands emit a delegating action module that imports the implementation; the app context (`state`, `feature`, `log`) is the contract the implementation receives. This is the hand-written side of the "generated wiring vs. capability modules" ownership boundary spec 005 asked for before any code-to-YAML synchronization is considered.

## Bundle

esbuild (`bundle`, `splitting`, `format: esm`, `minify`, `legalComments: none`, `target: es2022`, hashed entry and chunk names, metafile) over `app/main.js`. A tiny plugin swaps `app/config.js` for `export const ASSET_BASE = new URL("./skin/", import.meta.url)` so the copied `dist/assets/skin/` is found relative to the bundle. `index.html` is the generated one with the entry path rewritten; `build-manifest.json` records entry, chunks, assets, sizes and the source hash. The dependency policy in `AGENTS.md` is extended: esbuild is a devDependency for `dist` only.

## Verification

`tests/emit.test.js` emits from the real graph into a temporary folder inside `tests/`, imports the generated modules in Node, and checks structure parity with the outline, state seeding, mock action behavior via the lazy hook, capability delegation and loose-end coverage. `tests/components.test.js` covers constructors, id assignment and the state wrapper. The browser scenario (headless Chrome over CDP) runs `app/index.html` under the workbench server and `dist/index.html` under a static host rooted at `dist/`, asserting no chrome, no outline/API/authoring requests, lazy chunk fetch on first Play, no errors.
