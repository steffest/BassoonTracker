# BassoonTracker v2 — design proposal

The current workbench specification is [005](project/specs/005-interactive-workbench/requirements.md): YAML beside rendered app, hover/click source inspection, direct Node-backed saves, State gallery and Interaction log. Names identify components, commas separate label variants, and prose can generate outline bindings with unresolved-behavior warnings. This supersedes stricter earlier authoring proposals below.

Current source policy (2026-09-10): [app.yaml](project/specs/application/current/app.yaml) and referenced YAML files are canonical. app-outline.json is the development-time representation of that graph (spec 005 compiler); the release is generated plain JavaScript in `v2/app/` and a bundled `v2/dist/` (spec 007, `node v2/build.mjs`); Spec 003's earlier fixed-template example (outline.json, its renderer and its runtime) was retired by spec 011. Git replaces copied revision folders. Spec 004 supersedes the earlier prose-authority/snapshot proposals below; final-spec.md is historical context.

Status: exploration, not an implemented runtime. All work stays inside `v2`.

Next steps: [Implementation plan](IMPLEMENTATION-PLAN.md), with ordered tasks and completion checks.

Project records: [specification index](project/specs/index.md), [current full application specification](project/specs/application/final-spec.md), and [progress log](project/progress.md). Feature and research changes use separate numbered specs. The full specification is cumulative; its revision history distinguishes intended behavior from verified implementation. The [specification workflow](project/documentation/specification-workflow.md) defines this process.

The experiment is to make an application reproducible from versioned specifications, reusable components, and explicit domain capabilities. BassoonTracker is the first demanding test case. Plain JavaScript modules run directly from a static HTTP server. Optional packaging may optimize delivery but must never supply missing runtime functionality.

## Separate authoring from execution

Use this pipeline:

    Human descriptions + examples + architectural rules
                         |
               assisted authoring / review
                         v
    Versioned machine-readable app specification
                         |
                deterministic validation
                         v
    Component tree + bindings + commands + layout policies
                         |
              shared measurement and layout
                         v
             Canvas renderer / DOM renderer
                         |
                domain capability adapter
                         v
                 existing playback logic

Natural-language rules explain intent. A structured specification makes that intent executable. Acceptance scenarios tell us whether the result is correct. AI can propose changes to specifications and implementations during authoring; launching the app never requires AI or a code-generation service.

Interpret the structured specification at screen creation and on edits. Cache its resolved bindings and layout. Do not interpret rules inside audio scheduling, pointer-move hot paths, or every animation frame. An optional export can serialize the normalized specification or precompute wiring later; running original source must remain equivalent.

## Sources of truth

Keep four distinct artifacts:

- Product specifications: workflows, language, examples, domain semantics.
- Architectural rules: source-only execution, module boundaries, renderer constraints, performance budgets.
- Executable app specifications: state fields, commands, views, feature references, layout intent.
- Capability implementations: playback, format readers, pattern editing, waveform operations.

Give rules stable IDs. Bind acceptance scenarios and generated nodes to those IDs. The workbench should explain why a control exists and which rule produced it. Diagnostics should include the rule ID and specification path.

Generated artifacts should not become a second hand-edited source of truth. Change the specification, reusable template, or implementation behind a named capability, then regenerate. Preserve author-written modules separately. Pin schema and generator versions, record inputs, and review diffs. Equivalent inputs should produce identical normalized specifications.

Conflicting rules should produce diagnostics. Start with hard constraints plus explicit template selection, not a general-purpose rule solver. An impossible minimum size should choose a declared collapse/scroll fallback or report overflow, never silently shrink controls beyond usability.

## Small initial language

Start with JSON, loaded using fetch, plus plain JavaScript implementations. JSON is easy to inspect, validate, save and diff. Add a friendlier text syntax only after real examples expose its value. Avoid arbitrary JavaScript expressions inside documents: use named selectors, commands and a small set of typed predicates.

Illustrative high-level view input, not an implemented schema:

```json
{
  "schemaVersion": 1,
  "id": "tracker.main",
  "template": "editor-workspace",
  "density": "compact",
  "regions": {
    "transport": {
      "controls": [
        { "command": "transport.play", "label": "Play" },
        { "command": "transport.stop", "label": "Stop" },
        { "field": "song.bpm", "label": "BPM" }
      ]
    },
    "primary": { "component": "pattern-grid", "model": "song.pattern" },
    "secondary": { "component": "instrument-list", "model": "song.instruments" }
  },
  "layout": {
    "priority": ["transport", "primary", "secondary"],
    "secondaryWhenNarrow": "drawer"
  }
}
```

The state schema defines BPM's type and supported bounds; command definitions supply readiness and enablement. Templates infer ordinary controls and arrangement. Specialized component types are explicit. Expanding the template produces lower-level nodes such as panel, row, button, numeric-input and listbox, each with stable IDs, bindings and originating rule IDs.

Do not guess musical semantics from a generic number type. Domain definitions must distinguish speed, BPM, periods, notes and format-dependent constraints.

## Layout without positioning every screen

Use a small family of reusable templates: editor-workspace, inspector, browser, dialog, toolbar and settings-form. Screens identify roles, importance, order and optional minimum sizes. Templates decide geometry.

The first shared layout engine needs rows, columns, wrapping, padding, gaps, intrinsic sizes, minimum/maximum sizes and remaining-space allocation. Add docking or splitters when the tracker needs them. Run layout after viewport, content-size, theme or structure changes; a playback-position update should not trigger layout.

Renderers provide font/control metrics, then consume computed rectangles. Support integer logical coordinates and pixel snapping for canvas. Renderer equivalence means the same commands, values, focus order and fallback behavior; font differences need not produce identical pixels.

## Renderer contract

Separate measurement, layout, drawing and interaction. Renderers must implement mounting, updating, focus, hit testing/input mapping and disposal. All emit semantic commands; neither owns song state or playback timing.

Canvas is a first-class production target. Reuse/adapt the existing bitmap fonts, sprites, scale-9 controls and invalidation lifecycle after inspecting their dependencies. Never use fillText on the tracker canvas. The DOM renderer is a useful alternative and reference implementation, while the workbench itself can use ordinary HTML controls outside the tracker preview.

Pattern grids, scopes, sample waveforms and envelopes are specialized components. A pattern grid gets a viewport, selection and model accessor; it draws visible cells directly. Do not expand every note cell into a generic UI node or allocate a song-sized scene graph.

Include keyboard navigation, focus, text entry, pointer capture, clipping and scroll behavior in the contract from the start. Canvas accessibility needs semantic DOM support; it cannot be solved solely by drawing pixels. Renderer replacement preserves application state and disposes subscriptions, input handlers and animation work.

## Loading and performance

Load a small shell, active renderer, minimal skin assets and the initial view first. Keep basic controls together; use dynamic imports for features such as sample editing, file browsing, export and optional applications. Lazy-loading each button would add overhead without a useful boundary.

The registry contains metadata and import functions, with no eager imports of feature implementations. Deduplicate concurrent requests. Define loading, ready and failed states, retry behavior and disposal. Prefetch likely next features only after the shell is useful. Decide explicitly what happens to commands issued during loading; never replay stale play commands after the user has pressed stop.

Track separately: first shell paint, first editable pattern, first playable audio, first feature interaction, transferred bytes and module count. A fast empty frame alone is insufficient.

Use targeted subscriptions, dirty regions and requestAnimationFrame coalescing. Idle screens should schedule no continuous redraw work. Virtualize lists and patterns. Keep large sample buffers out of generic reactive state, cloning and JSON serialization. Playback supplies compact UI observations on a separate cadence from audio scheduling.

Provisional experiment targets, to be calibrated on named hardware and a fixed fixture: shell under 100 KiB compressed including required assets; p95 UI work under 8 ms per frame during pattern scrolling at 60 Hz; no optional editor modules requested at startup. Also record raw source transfer sizes and cold-cache request waterfalls. These are proposed budgets, not measured results.

Consider worker rendering only if measurements identify main-thread contention. It adds synchronization, asset transfer and input complexity. Keep the renderer boundary compatible with that possibility without making it a prerequisite.

## Playback reuse

Inspection of the current source shows tracker.js importing UI, Input, Editor and StateManager. audio.js imports Tracker and Editor. The existing plugin loader already provides useful examples of dynamic imports and concurrent-load deduplication.

Audit the standalone player as a second candidate before choosing an extraction boundary. Preserve sequencing/effect logic and format readers with their required tables and models, then introduce a small adapter owned by v2. Do not assume copying audio.js alone makes an independent engine. Do not modify the existing application to extract it under the current scope restriction.

The UI-facing boundary should offer commands such as load, play, stop and edit, plus read-only observations. Its exact API follows the dependency audit. Musical timing and high-volume buffers stay behind that boundary. Renderer switching and specification editing must not recreate the audio context.

Before adopting an extracted engine, compare real MOD/XM fixtures against the existing implementation: sequencing and effect traces, loop boundaries, playback duration, and audio renders with documented tolerances where appropriate. Existing testing is an asset, not evidence that extraction cannot introduce regressions.

## A small browser workbench

First version: editable specification, live preview and diagnostics. Include renderer selection, viewport presets, component inspection, resolved layout and a loaded-feature list. A rule-to-node inspector is more valuable early than a general code editor.

Validate a candidate before applying it. Keep the last valid preview when edits fail. Preserve runtime state by stable node IDs where types remain compatible; require an explicit reset/migration for incompatible state-schema changes. Debounce edits, report errors at document paths, and apply updates transactionally. Use an isolated preview frame and structured messages so preview failures do not take down the editor.

Start with browser draft storage plus JSON import/export. Direct saving into a repository is a separate capability: later add supported file access or a small optional local file service. Neither is necessary to run the application. JavaScript implementation hot reload can initially reload the preview; data/specification hot updates are the first priority.

## First experiments

1. One transport and instrument-list specification, a deterministic normalizer, shared layout, mock state/commands, and canvas plus DOM renderers. Prove that changing a label, order or compact-layout rule updates both without per-screen coordinates.
2. Add a lazy sample-editor placeholder. Inspect the network to prove its implementation is absent at startup and loaded once when opened. Exercise failure/retry and close/reopen.
3. Add a specialized pattern viewport with realistic data and keyboard selection. Measure scrolling and resize behavior before growing the component vocabulary.
4. Audit and integrate playback behind the adapter; run fixture comparisons before expanding editing.
5. Add structured rule authoring, provenance and acceptance scenarios. Expand into a broader IDE only after the runtime contract survives these examples.

The first three experiments should run without npm installation, transpilation or bundling, served directly as static source. The existing app's dev entry remains /dev.html. A future v2 preview should have its own entry inside v2; do not repurpose root production index.html.

## Browser foundations

Native browser modules support direct source execution and lazy dynamic import. They require HTTP(S) serving for normal local development; double-clicking an HTML file is not the proposed execution model. A static server is infrastructure, not a build step.

- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN: dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

Spec 002 extends the workbench with component-contract editing and isolated previews. Direct project saving is now planned early through an optional Node authoring server; this updates the earlier suggestion to defer it. See [component authoring](project/documentation/component-authoring.md).
