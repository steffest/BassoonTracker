# v2 implementation plan

**Superseded in part, 2026-09-10.** Steps 5 to 9 below are replaced by spec [010](project/specs/010-port-roadmap/requirements.md), the port roadmap, which was written after the existing application was inventoried. Three of their assumptions did not survive it: the DOM renderer buys no parity and becomes conditional, playback is independent of the UI work and moves first, and step 4's clipping bounds, coalesced invalidation and semantic DOM mirror were never delivered and are now packages of their own. Steps 1 to 4 remain the record of how the runtime was built, but not of what exists: the runtime they describe (`outline.json`, `runtime/{validate,normalize,layout,commands,uiCommands}.js`, `templates/editor-workspace.js`, `domain/mockTracker.js`, `renderers/canvas/mount.js`, `preview.html` and `dev.html`) was retired on 2026-09-10 by spec [011](project/specs/011-retire-spec003-pipeline/requirements.md). Steps 7 and 8 survive inside 010 as its feature registry and pattern-grid packages.

Implemented 2026-09-10: [spec 005](project/specs/005-interactive-workbench/tasks.md), the YAML editor/canvas inspection workbench with local Node saving, State gallery and Interaction log (see its tasks for evidence and known limits). Spec 006 (CodeMirror editor) and spec 007 (release build: generated app + bundle) followed the same day. Spec 008 (skin assets and component styles) and spec 009 (the component registry, which delivers spec 002's component contract) followed. The next candidate is fixed by spec 010: playback as the first real capability behind `v2/capabilities.js`. Its phased tasks supersede earlier live-editing details. Names/generated IDs, comma-label variants and prose-to-outline interpretation are the accepted authoring conventions.

Spec 004 updates this roadmap: author application/current/app.yaml and referenced YAML, then validate/generate outline.json. Use Git for revision history, without snapshot storage/promotion. First migrate a supported runtime subset; the existing outline remains usable until generated output validates. Prior baseline-copy tasks below are superseded.

Status: proposed implementation sequence. No runtime has been implemented yet.

Specification governance now lives in [project/specs](project/specs/index.md). Follow its numbered requirements → design → tasks workflow for each feature or research change. This document remains the cross-feature roadmap; it is not the implementation status ledger. Spec 002 defines component authoring and local saving alongside the workbench. Allocate a separate live-workbench spec from the current index; later features also receive separate specs.

The first deliverable is a small browser workbench: edit a tracker specification, see it rendered on canvas, switch to DOM, and retain the same application state. This should demonstrate the architecture before we port the full tracker.

All new source, documentation, fixtures and adapted code live inside `v2`. The existing application remains the reference implementation. The design rationale is in [README.md](README.md).

## Working constraints

- Plain JavaScript with native modules and explicit relative imports; JSON for specifications. JSDoc may document contracts without requiring compilation.
- Run directly from a static HTTP server, without dependency installation, transpilation or generation. Any later optimized build is optional.
- Keep the workbench separate from the runtime: opening the application preview alone must not load editor code.
- Canvas uses bitmap fonts and sprites, with no `fillText`. Reuse existing component behavior and rendering conventions where their dependencies permit.
- State and domain commands belong outside renderers. Musical timing never depends on rendering or specification evaluation.
- Start with one template and the few controls it needs. Extend the language in response to concrete screens.

## 1. Define the first executable example

Write the first small set of rules and acceptance scenarios before implementing the runtime. Give each rule a stable ID and associate relevant specification nodes with it.

The example screen contains:

- A transport with Play, Stop and a playback-status label.
- An instrument list with selection.
- A button that will open a lazily loaded sample-editor placeholder.
- A compact layout that keeps transport visible and moves the secondary region behind a toggle when space is insufficient.

Use mock commands and mock instruments initially. Make simulated playback explicit in the UI. A numeric BPM editor, real playback and pattern editing follow later; they are unnecessary to establish the first renderer contract.

Define schema version 1 with explicit node IDs, region roles, command/selector references, component types and layout policy. Define the initial state separately from view declarations so changing a view cannot silently overwrite runtime state.

Deliverables:

- `project/specs/NNN-live-workbench/requirements.md`: rules and observable acceptance scenarios.
- `project/specs/NNN-live-workbench/design.md`: specification, command, state, component and renderer contracts.
- `project/specs/NNN-live-workbench/tasks.md`: testable phases and progress.
- `project/specs/application/outline.json`: cumulative structured application model, introduced when its schema is implemented; the transport example is part of it.
- `project/documentation/runtime.md`: implemented runtime contracts, added with the runtime and linked in the documentation index.

Completion check: a reader can tell what happens when Play is clicked, an instrument is selected, the viewport narrows, or the renderer changes, without reading implementation code. The screen specification contains no absolute positions.

## 2. Establish direct-source entry points

Create `v2/dev.html` for the workbench and `v2/preview.html` for the standalone runtime. Use `type="module"` entry scripts. Keep the HTML shell immediately visible while preview code and required font assets load.

The existing application's local test URL remains `http://localhost:5173/dev.html`. The separate v2 workbench URL will be `http://localhost:5173/v2/dev.html`; its preview will be `http://localhost:5173/v2/preview.html`. Verify v2 through a plain static server as well, so Vite does not conceal dependencies on transforms or import rewriting. Do not change root entry points or server configuration.

Add lightweight timing marks for startup, first preview paint and first interactive controls. Keep a readable loading/error state when assets or the specification fail to load.

Completion check: a fresh browser can open v2 from static source with no npm install or build, and opening the standalone preview does not request workbench modules.

## 3. Implement validation, normalization and state

Build a deterministic path from the high-level specification to a component tree. Keep these operations separate:

1. Parse JSON and validate its version, types, IDs and references.
2. Expand the `editor-workspace` template into primitive components.
3. Resolve bindings and command references against an explicit registry.
4. Preserve each node's originating rule IDs and specification path.

Start with a small validator tailored to the documented schema. Reject duplicate IDs, unknown components, unresolved commands/selectors and unsupported layout values. Report errors with document paths. Do not execute strings from the specification or use `eval`.

Implement an explicit store with targeted subscriptions and a command dispatcher. Mock Play/Stop updates playback status; instrument selection updates a selected ID. Command enablement is checked by the dispatcher as well as displayed by the renderer. Store updates must not require rebuilding the specification tree.

Completion checks:

- Identical inputs produce identical normalized trees and stable IDs.
- Invalid documents produce actionable diagnostics without partial mounting.
- Both pointer and keyboard actions dispatch the same semantic commands.
- A state update notifies only the relevant bindings.

Use small dependency-free tests for these contracts. They should check observable behavior and error cases, rather than snapshotting every implementation detail.

## 4. Implement shared layout and the canvas renderer

Audit the existing button, panel, listbox, font and input dependencies. Adapt the smallest coherent subset into v2; record source paths and retain applicable license notices. Avoid importing the old application bootstrap or its global singleton graph. Copy only needed skin/font assets into v2 so the experiment can eventually stand alone.

Implement a shared measurement/layout pass supporting rows, columns, gaps, padding, minimum sizes, remaining-space allocation and the example's explicit narrow-screen fallback. Renderers supply intrinsic metrics; the layout engine returns rectangles and clipping bounds. Use integer logical coordinates for canvas.

Implement panel, label, button and listbox rendering plus selection, focus and keyboard activation. Maintain a small semantic DOM representation for canvas controls so focus and accessible names are part of the implementation from the beginning. Prevent duplicate command dispatch between the semantic and visual layers.

Use the existing bitmap-font approach and pixel-art conventions. Coalesce invalidations into one scheduled frame and redraw affected regions, including overlapping content. Recompute layout only when geometry may change. Define resize and device-pixel-ratio behavior explicitly.

Completion checks:

- The example works at wide and narrow viewport sizes without screen-specific coordinates.
- Pointer hit testing matches visible controls after resize and scrolling.
- Tab, Enter/Space and list navigation work with visible focus.
- The canvas becomes idle after interaction; no perpetual redraw loop remains.
- Play/Stop status changes do not trigger layout unless their measured size changes.

## 5. Add the DOM renderer and prove interchangeability

Implement the same primitive component contract with native HTML elements. Consume shared layout rectangles; do not implement an unrelated CSS layout system for the preview. CSS can style controls and the surrounding workbench.

Define renderer lifecycle operations for mounting, applying state/layout updates, focus restoration and disposal. The runtime owns the store and command dispatcher across renderer replacement.

Completion check: select an instrument, activate mock playback, switch canvas to DOM and back. Selection, status and logical focus survive where the focused node exists. Commands fire once. Old input handlers, subscriptions and scheduled rendering work are disposed.

Run the same interaction scenarios through both renderers. Compare state and behavior, allowing renderer-specific font metrics and appearance.

## 6. Add live specification editing

Build a small HTML workbench around an isolated preview iframe. Begin with a textarea, renderer selector, viewport presets, diagnostics and Apply/Reset controls. Add debounced automatic application after transactional updates work reliably.

Use versioned messages with request IDs between workbench and preview. Validate message source and payload, and ignore stale revisions. A preview failure should leave the editor available to repair the document.

Apply edits in stages: validate, normalize, prepare the new view, then commit. Preserve the old view if preparation fails. Preserve application state across compatible view edits using stable IDs. For the first version, changes to state-schema types require an explicit reset rather than attempting automatic migrations.

Add browser draft persistence and JSON import/export. Browser drafts must be clearly distinguished from repository files; saving a draft does not write source files. Add the optional Node authoring server from spec 002 during early workbench development; verify conflicts and failed saves before enabling revision promotion.

Expose a basic inspector showing selected node ID, source path, originating rule IDs and computed rectangle.

Completion check: edit a label, reorder transport controls and change the compact-layout policy. The preview updates and preserves selection. Introduce an invalid command reference: an error points to the field, while the last valid preview remains usable. Repair it and continue without reloading the workbench.

**Milestone A:** the first usable workbench is complete after steps 1–6. It demonstrates rule provenance, automatic layout, two renderers, live updates and source-only execution. It intentionally uses mock playback.

## 7. Prove feature-level lazy loading

Create a metadata-only feature registry and a loader using dynamic import. The sample-editor placeholder is the first optional feature. Its implementation and optional assets must not be reachable through eager imports from startup modules.

Define idle/loading/ready/failed states, concurrent-request deduplication, retry, close/reopen behavior and instance disposal. Keep code-module caching separate from mounted feature instances. If the user closes a feature while it loads, completion must not reopen it unexpectedly.

Show the loaded-feature list and first-open timing in the workbench. Use an explicit test failure mode to exercise the error path. Defer speculative prefetch until the cold-load boundary has been demonstrated.

Completion check: a cold-cache network trace shows no sample-editor implementation or assets before opening it. Repeated opening during load initializes one instance. Closing during load leaves it closed. An initialization failure can be retried without corrupting the rest of the app; report network import failures honestly if a browser reload is needed.

## 8. Test the abstraction with a realistic pattern viewport

Introduce a specialized `pattern-grid` component with a model accessor, viewport, cursor and selection. Include realistic multi-channel data, vertical/horizontal scrolling and keyboard navigation. Keep it read-only initially except for cursor and selection changes.

Draw only visible cells; do not create a generic component per cell. Keep large song/sample data out of the generic state store. Ensure the renderer interface can support specialized implementations without exposing canvas drawing commands in the app specification.

Record raw and compressed transfer sizes where available, startup request count, first interactive pattern time, frame work and idle rendering. Document browser, machine, viewport, fixture and cold/warm-cache conditions. Measure standalone preview separately from live-editor overhead.

The README's size and frame-time budgets are provisional. Establish a baseline here and retain reproducible scenarios before treating any number as a regression threshold.

Completion check: increasing total pattern data does not increase visible component count proportionally. Scrolling, resizing and renderer switching preserve cursor/selection, and editing a view specification does not copy or serialize the entire song.

**Milestone B:** the runtime has demonstrated meaningful lazy loading and a tracker-sized rendering workload. Revisit the contracts here before adding more screens.

## 9. Audit and integrate existing playback

Inspect the main engine and standalone player dependency graphs. Document which sequencing, effects, formats, models and UI dependencies each requires. Choose the smallest boundary that preserves the tracker behavior we need, rather than assuming the standalone player supports editing.

Make v2-local adaptations and record their provenance. Define the adapter from the audit: initially load, play, stop and compact read-only transport observations. Keep audio initialization tied to appropriate user interaction. Loading progress and failure must be visible; do not queue a stale Play after a subsequent Stop.

Select real MOD/XM fixtures covering representative effects, loops and pattern transitions. Compare behavior with the existing implementation using sequencing traces and offline audio where practical. Document sample rate and tolerances for render comparisons. Keep fixture copies or test manifests under v2; do not alter existing tests or application files.

Completion checks:

- A real fixture loads and plays through the v2 transport.
- Switching renderer or changing layout does not restart playback or recreate the audio context.
- Fixture comparisons pass, with any unsupported behavior documented before further migration.
- High-frequency audio scheduling does not run through the generic UI store.

**Milestone C:** the specification-driven interface controls reused playback. Pattern editing, sample editing and export can now migrate as separate capabilities.

## Suggested initial file structure

Create files when their step requires them; this is a responsibility map, not a request to scaffold empty modules.

```text
v2/
  dev.html
  preview.html
  README.md
  IMPLEMENTATION-PLAN.md
  project/
    specs/
      index.md
      product.md
      application/
        final-spec.md
        outline.json             # future: validated cumulative app model
        revisions/
      001-specification-lifecycle/
        requirements.md
        design.md
        tasks.md
    documentation/
      index.md
      specification-workflow.md
    progress.md
  workbench/
    main.js
    style.css
  runtime/
    main.js
    validate.js
    normalize.js
    layout.js
    store.js
    commands.js
    features.js
  templates/
    editor-workspace.js
  renderers/
    canvas/
    dom/
  features/
    sample-editor/
    pattern-grid/
  domain/
    mock-tracker.js
    playback-adapter.js
  assets/
  tests/
```

## First implementation session

Complete steps 1–3, then get the first canvas transport visible in step 4. Deliver the executable example, documented contracts, direct-source preview, working mock Play/Stop, and validation tests. Record what remains incomplete rather than presenting this as the finished workbench.

Continue through Milestone A before expanding the component catalog. Defer a custom textual language, AI integration, visual drag-and-drop authoring, worker rendering, a general plugin marketplace and optional bundling until the core experiment provides evidence for them.

Component development proceeds alongside steps 4–6: specify action/toggle contracts, build an isolated state gallery and event log, and compare real interactions in both renderers. See project/specs/002-component-authoring.
