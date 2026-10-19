# Documentation index

- [Component pixel parity](pixel-parity.md): v1 source mappings, reproducible multi-size reference captures, exact v2 pixel/geometry diffs, and two reusable skills with a fast, risk-based testing loop (spec 084).

- [Native C generation idea](../../projects/ideas/native-c-generation.md): sharing the application specification across browser and native targets, and the runtime and capability implementations that would be needed.

- [Release build](../specs/007-release-build/design.md): YAML → readable generated app (`v2/app/`) → minified code-split bundle (`v2/dist/`); loose ends report; capability manifest.
- [Interactive workbench](interactive-workbench.md): source editor is vendored CodeMirror 6 (spec [006](../specs/006-codemirror-editor/requirements.md); highlighting, folding, compiler-backed lint); YAML beside canvas, hover inspection, source selection, Node-backed Save & Refresh (`node v2/server.mjs`), Interact-mode tracing with Interaction log and State gallery; spec 005 complete, with a Reference section (startup URL, recipe vocabulary, diagnostic codes, save semantics, known limits).

- [YAML source migration](../specs/004-yaml-source/design.md): canonical YAML, inspection findings, generated outline and Git-only history.

- [Playback](playback.md): the first real capability. How the generated application plays a module, what crosses the boundary, why audio timing never touches the UI, and how the engine is tested without a browser; see spec [012](../specs/012-playback-capability/requirements.md).
- [Port roadmap](../specs/010-port-roadmap/requirements.md): what is still missing to run the v1 tracker on v2, as twelve ordered work packages with milestones, risks and open decisions; supersedes the roadmap's own steps 5-9.
- [Component types](components.md): the registry that declares every component type once, its property contract, container shape, styling, interactivity and draw kind, plus the workbench Components tab; see spec [009](../specs/009-component-registry/requirements.md).
- [Skin](skin.md): artwork traced to one source PNG per asset, authored component styles per visual state, loose PNGs in development and one packed atlas in the release, and the workbench Skin tab; see spec [008](../specs/008-skin-assets/requirements.md).
- [Interaction](interaction.md): how a DOM event becomes a gesture and then a state change: pointer capture, drag, wheel, viewport scrolling, double and secondary click, the behavior a type declares, cursors and file drag-and-drop; see spec [014](../specs/014-pointer-interaction/requirements.md).
- [Layout](layout.md): how a component tree becomes rectangles, what clips what, how a viewport scrolls, and how the overlay layer and its modal slot work; see spec [013](../specs/013-layout-foundations/requirements.md).
- [Runtime](runtime.md): what `v2/runtime/` and the canvas renderer are today, the provenance of the adapted code, and what spec [011](../specs/011-retire-spec003-pipeline/requirements.md) removed when it retired spec 003's runtime, including the command enablement and semantic DOM layer that went with it.
- [Compiler](compiler.md): YAML source graph to generic component tree and diagnostics, run by `generate.js` or the local service; see spec [005-interactive-workbench](../specs/005-interactive-workbench/requirements.md) Phases 1-4.
- [Component authoring](component-authoring.md): component contracts, isolated previews and optional local saving; State gallery and Interaction log delivered through spec 005 Phase 4, the rest pending.

- [Specification workflow](specification-workflow.md): adopted SDD structure, research outcomes, application revisions and generation pipeline.
- [Design proposal](../../README.md): runtime architecture exploration.
- [Implementation roadmap](../../IMPLEMENTATION-PLAN.md): first runtime milestones.
