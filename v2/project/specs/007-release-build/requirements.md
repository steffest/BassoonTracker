# 007 — Release build: generated application and bundle

Date: 2026-09-10. Kind: feature. Status: implemented and verified. Builds on 005 (compiler, outline, canvas runtime). Refines the README's "optional packaging may optimize delivery but must never supply missing runtime functionality".

## Purpose

Turn the YAML source into a plain JavaScript application that end users run without fetching an outline document, and package that application the way modern tooling does: one minified main file plus one lazily loaded file per feature. The outline (`app-outline.json`) stays the development-time representation the workbench, gallery and diagnostics use; it is no longer what a release ships.

## Decisions (user, 2026-09-10)

- Unresolved warnings never fail a release build. They are listed prominently as loose ends, and the affected nodes are not rendered or become no-ops.
- Two outputs: `v2/app/`, a well-structured, documented, readable plain-JS app with a file per component and UI separated from logic; and `v2/dist/`, a minified, comment-free bundle with one main file and one chunk per lazy-loaded feature, in the style Vite produces.

## User stories and acceptance

- **REL-001 — Generated application:** As a developer, `node v2/build.mjs app` writes `v2/app/`: `ui/<component>.js` per authored container (structure only), `actions/<command>.js` per command (behavior; lazy-loaded), `state.js` (fields and initial values), `main.js` (entry), `index.html`, `README.md`, `LOOSE-ENDS.md`. Acceptance: every generated module is valid ES, carries a generated-file header and JSDoc that names its YAML source line; the UI tree it builds has the same ids, labels, layout and order as the outline's supported nodes; unsupported nodes are absent; the app mounts and Play toggles without any `app-outline.json` request.
- **REL-002 — Loose ends:** As a developer, I see exactly what the source left unresolved and what the build did about it. Acceptance: `LOOSE-ENDS.md` and the build log list each item with its kind, YAML source line and handling (not rendered, no-op, generated mock, UI-state only); each compiler warning is covered once; a build with no warnings says so.
- **REL-003 — Capabilities:** As a developer, I replace a generated mock by mapping the command id in `v2/capabilities.js` to my module and export, then rebuilding. Acceptance: the action module then imports and delegates to the mapped export, is no longer listed as mocked, and unmapped commands still are.
- **REL-004 — Release bundle:** As a developer, `node v2/build.mjs dist` writes `v2/dist/`: `index.html`, `assets/main-<hash>.js`, one `assets/<feature>-<hash>.js` per action, copied skin assets, `build-manifest.json`. Acceptance: minified, no comments, ES modules with code splitting; served from a static host rooted at `dist/` the app starts with only the entry and assets requested, the feature chunk is fetched on first activation, and nothing from `runtime/`, `renderers/`, `workbench/`, `vendor/` or `/api/` is requested.
- **REL-005 — Parity:** As a developer, the generated app and the bundle behave like the source-run app. Acceptance: the existing browser scenario for the plain app passes against both outputs; the unit suite still passes.
- **REL-006 — Hard failures:** Compile errors (syntax, missing `app.ui.main`, reference cycles) fail the build and leave previous outputs untouched.

## Non-functional requirements

`app` needs only Node. `dist` needs esbuild, the single devDependency in `v2/package.json`, installed with `npm install` inside `v2/`; nothing else in v2 acquires a dependency or a build step. Generated code imports the shared runtime library rather than duplicating it. `app/` is committed as generated output (reviewable diffs, like `app-outline.json`); `dist/` and `node_modules/` are ignored. The build refuses to clear an output folder it did not generate.

## Scope boundaries

In scope: emitter, build CLI, capability manifest hook, loose-ends report, bundle with code splitting, parity verification. Out of scope: real capability modules (playback, file formats), a DOM renderer target, service worker/PWA packaging, deployment automation, reverse synchronization from generated code to YAML (deferred by spec 005).
