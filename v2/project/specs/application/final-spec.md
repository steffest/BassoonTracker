# Full application specification

Historical design narrative. Since 2026-09-10, current/app.yaml and referenced YAML files are the single application source (spec 004). This document is no longer authoritative. Earlier snapshot/version policies below are superseded by Git history.

Application-spec revision: 0.3.0. Date: 2026-09-09. Incorporates: 001-specification-lifecycle, 002-component-authoring, 003-live-workbench and the initial user-directed design exploration.

This is the consolidated intended application at this revision. It is an initial research baseline with open questions, not a claim of complete legacy-feature coverage. Implementation status: mostly documentation. The exception is spec 003's first executable runtime (schema version 1, validate/normalize/store/commands/layout, and a canvas renderer for one transport/instrument-list screen with mock playback) — see APP-015 and [project/documentation/runtime.md](../../documentation/runtime.md). No DOM renderer, live editing, lazy loading, pattern grid or real playback exists yet.

## Purpose and users

The project provides a browser workbench for describing and evolving applications through specifications. Its first target is a browser music tracker based on BassoonTracker's workflows and reusable playback behavior. It serves application authors experimenting with rules and musicians using the generated tracker.

## Authoring and history

**APP-001:** Significant features and research changes have separate numbered specifications with requirements, design, phased tasks and observed outcomes. Research may conclude without code. A cumulative natural-language application specification describes the complete currently intended scope, and previous baselines remain readable.

**APP-002:** A structured outline derived from the cumulative specification describes state, commands, capabilities, screens, navigation, layout intent, assets and loading boundaries. Its revision and source provenance are explicit. Ambiguous requirements and missing behavior modules are reported rather than silently invented. Schema version 1 is now defined and implemented for one screen (`tracker.main`, `project/specs/application/outline.json`; that document was retired on 2026-09-10 by spec [011](../011-retire-spec003-pipeline/requirements.md), so the reference is historical and no longer a link): named typed state fields, an `editor-workspace` view document, and explicit region/command/selector references validated against a registry. It covers a controls-row region and one specialized component region (`instrument-list`); multi-screen documents, additional templates and additional component types are not yet defined.

**APP-003:** The workbench edits structured drafts, previews screens, reports validation errors and reveals the source rules behind a component. Invalid changes retain the last valid preview. Compatible edits preserve state. Baseline promotion reconciles prose and outline; neither silently diverges. Browser drafts and import/export support static mode; an optional Node authoring server enables direct project saving during early workbench development. Not yet implemented: `v2/dev.html` today only embeds the isolated standalone preview in an iframe (the isolation boundary step 6 will build on); there is no editing UI yet.

## Generated interface

**APP-004:** Reusable templates turn semantic screen regions and layout policies into components and geometry. Authors need not position every screen manually. Narrow-screen behavior is explicit. Unsupported constraints produce diagnostics. Implemented: the `editor-workspace` template and `runtime/layout.js`'s row layout, padding/gap/remaining-space rules and explicit narrow-width drawer fallback (`layout.secondaryWhenNarrow: "drawer"`).

**APP-005:** Canvas is a first-class renderer using bitmap fonts, sprites and pixel-aligned layout. A DOM renderer exercises the same commands and state. Renderer replacement preserves application state and disposes old resources. Focus, keyboard interaction and accessible semantics are part of the component contract. Implemented: the canvas renderer, adapted from the legacy bitmap-font/scale-9 conventions, with a semantic DOM overlay carrying focus, keyboard activation and accessible names. Not yet implemented: the DOM renderer and renderer-replacement state preservation (IMPLEMENTATION-PLAN.md step 5).

**APP-006:** Initial components are panels, labels, buttons and listboxes. The first preview includes mock Play/Stop status, instrument selection and an optional sample-editor placeholder. Later tracker screens use specialized pattern, waveform and envelope components where generic controls are inefficient. Detailed later-screen inventories require their own specs. Implemented: panel, label, button and a listbox (selection only, no scrolling yet) for the `tracker.main` screen; the sample-editor button dispatches an inert placeholder command (no lazy loading yet).

## Behavior and loading

**APP-007:** Generated components bind to named commands, selectors and capability modules. Renderers do not own song state or audio timing. Mock behavior is visibly identified. Capability code implements semantics that declarations alone cannot supply. Implemented: `runtime/store.js` + `runtime/commands.js` (field-scoped subscriptions, an explicit dispatcher that checks enablement independently of the renderer); `domain/mockTracker.js`'s mock Play/Stop/select behavior is visibly labeled ("... - mock") in the rendered status label.

**APP-008:** The base application displays promptly and loads optional feature implementations only when needed. Loading, failure, retry and cancellation of pending UI intent are explicit. Startup does not load the workbench when opening the standalone app. Partially implemented: opening `v2/preview.html` never requests a workbench module (verified by network trace). Lazy loading of the sample-editor implementation itself is not implemented (IMPLEMENTATION-PLAN.md step 7); its button currently just sets a mock status field.

**APP-009:** Reuse existing tracker playback and file-format behavior where an isolated adapter can preserve compatibility. Audit both the main tracker and standalone player before selecting the boundary. Validate extraction with real module fixtures. Switching renderer or editing layout must not interrupt playback. Not yet implemented; playback is entirely mocked (IMPLEMENTATION-PLAN.md step 9).

## Execution and performance

**APP-010:** The application runs as plain JavaScript modules and static assets served over HTTP, directly from source, without installation, compilation or code generation at startup. An optional optimized build may be added later. AI may assist authoring but is not a runtime dependency. Verified for the current runtime: `v2/preview.html` and `v2/dev.html` were checked from a plain static file server (not only Vite), with `v2/package.json` scoping `"type": "module"` to v2 only.

**APP-011:** Resolve specifications when structure changes, rather than on every frame. Use targeted updates, coalesced canvas invalidation and virtualized large views. Keep sample buffers and audio scheduling outside generic reactive UI state. Measure first useful paint, first interaction, feature load, frame work and idle behavior on documented fixtures and hardware before setting firm budgets. Implemented for this screen: layout only recomputes on viewport/drawer-state changes or when a bound label's measured size actually changes; redraws are coalesced onto one `requestAnimationFrame`. No performance measurement has been recorded yet (open question, unchanged from 0.2.0).

**APP-012:** All project modifications remain inside v2. Legacy source may be inspected and narrowly adapted into v2 with provenance. The existing application is preserved as a behavioral reference. Provenance for spec 003's adapted code is recorded in [project/documentation/runtime.md](../../documentation/runtime.md).

## Delivery sequence and open research

**APP-013:** The workbench develops reusable components alongside screens. Contracts specify properties, variants, states, interactions, accessibility, sizing and acceptance scenarios. An isolated gallery and event log support canvas/DOM comparison. Instances bind behavior to application commands. Consumers pin revisions; incompatible changes produce diagnostics. Not yet implemented (spec 002).

**APP-014:** An optional lightweight Node server serves source and saves specifications without dependencies or a build. Writes stay within v2/project, detect stale edits and preserve previous content on failure. Draft saves differ from revision promotion, which records the numbered change spec and preserves recoverable history. Running the generated application requires no authoring server. Not yet implemented (spec 002).

**APP-015:** A first executable screen (`tracker.main`) proves the pipeline from a schema-version-1 JSON document to a rendered, interactive canvas UI with mock state: a transport (Play/Stop/status), an instrument list with pointer- and keyboard-equivalent selection, an inert sample-editor placeholder button, and an explicit narrow-width fallback that collapses the instrument list behind a toggle. Acceptance: `node --test v2/tests` passes; a manual browser pass (recorded in [project/specs/003-live-workbench/tasks.md](../003-live-workbench/tasks.md)) confirms pointer/keyboard parity, visible focus, the narrow/wide/drawer behavior, and that `preview.html` requests no workbench module. Delivered by spec 003, Phase 1 and Phase 2.

First establish the versioned process (001, done). Then develop the small live workbench with two renderers alongside component contracts and a button gallery (003 delivers the canvas half; 002 and 003's later phases remain). Add direct saving early through the optional Node server (002, not started). Prove lazy loading and a realistic pattern viewport, and integrate playback after compatibility checks (later specs).

Open questions: how the DOM renderer will share the layout/store contract in practice (003 phase continuation); how reliably prose can be translated into the outline; how much component inference is useful; the right playback extraction boundary; measured performance budgets; the eventual inventory of tracker screens and editing commands; whether the "small" bitmap font needs a wider character set once real labels (not just this mock screen) are authored. Resolving these questions produces new numbered specs and, when intent changes, a new cumulative baseline.
