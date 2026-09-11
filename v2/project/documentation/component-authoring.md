# Component authoring

Spec 004 supersedes copied component revisions: current contracts belong in canonical YAML; Git retrieves prior source/code combinations. Workbench editing and saving target YAML, while outline.json is derived output. No new component revision folders should be created.

Status: partly implemented. The component *contract* is delivered by spec [009](../specs/009-component-registry/requirements.md) ([components.md](components.md)): every type is declared once with its properties, container shape, styling, interactivity and draw kind, and the workbench Components tab shows the catalogue. The State gallery and Interaction log arrived with spec 005 Phase 4. Property *editing* and the DOM renderer remain pending. See [requirements](../specs/002-component-authoring/requirements.md), [design](../specs/002-component-authoring/design.md) and [tasks](../specs/002-component-authoring/tasks.md).

The workbench develops component contracts alongside screens: properties, variants, input behavior, sizing and acceptance scenarios. Shared behavior controllers connect to canvas/DOM adapters; screen instances supply state and commands. Start with an action/toggle button gallery and event log.

An optional dependency-free Node server saves project documents. Draft saving, baseline promotion and implementation verification remain separate. Static application execution remains supported.

Confirmed first-delivery tools: a labeled State gallery (including focus/disabled and toggle on/off), and an Interaction log showing ordered input, state transitions and commands. The log supports pause/resume, clear and filtering with bounded storage. Gallery fixtures are isolated illustrations; the live example exercises behavior. Both tools are implemented for the canvas renderer by spec 005 Phase 4 (`v2/workbench/{stateGallery,interactionLog}.js`, see [interactive workbench](interactive-workbench.md)); the DOM renderer, property editing and the component schema remain pending.
