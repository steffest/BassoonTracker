# 003 — Live workbench requirements

Kind: feature/research. Base: application-spec 0.2.0. Target: 0.3.0. Status: specified; implementation starting.

## Purpose and alignment

Establish the first executable runtime: a small specification-driven screen rendered on canvas, with mock playback and instrument selection, proving rule provenance, deterministic normalization, an explicit store/dispatcher and a shared layout engine before a second renderer or live editing is added. This is the "first executable example" and steps 1-4 of IMPLEMENTATION-PLAN.md.

## The first executable example

A transport/instrument-list screen:

- A transport region with Play, Stop and a playback-status label.
- An instrument list with selection.
- A button that opens a lazily loaded sample-editor placeholder (loader proven separately in a later phase; the button may be inert until then).
- A compact layout that keeps the transport visible and moves the secondary region behind a toggle when space is insufficient.

Playback and instruments are explicit mocks in this spec. Real BPM editing, pattern data and audio belong to later specs (playback integration is audited and adapted no earlier than IMPLEMENTATION-PLAN.md step 9).

## Requirements

- **LWB-001:** As a spec author, I want each UI rule to have a stable ID referenced by acceptance scenarios and by generated nodes, so the workbench can explain why a control exists. Acceptance: every node in the normalized tree carries its originating rule ID(s) and document path; diagnostics cite both.
- **LWB-002:** As a runtime implementer, I want a versioned schema (schema version 1) describing state fields, commands, regions, component types and layout policy, kept separate from initial state values, so that changing a view cannot silently overwrite runtime state. Acceptance: the example screen validates against schema version 1; state and view are distinct documents/sections.
- **LWB-003:** As a runtime implementer, I want a deterministic pipeline from JSON specification to component tree: parse+validate, expand the `editor-workspace` template, resolve bindings/commands against an explicit registry, and preserve rule IDs/paths at each step. Acceptance: identical input documents produce identical normalized trees and stable IDs; invalid documents produce actionable path-qualified diagnostics without partial mounting; no `eval` or string execution of specification content.
- **LWB-004:** As a runtime implementer, I want an explicit store with targeted subscriptions and a command dispatcher, so state updates do not require rebuilding the specification tree. Acceptance: mock Play/Stop updates a playback-status field; instrument selection updates a selected-id field; a state update notifies only subscribers of the changed field; the dispatcher checks command enablement independently of what the renderer displays.
- **LWB-005:** As a musician/tester, I want pointer and keyboard input to produce the same effect, so the app is usable without a mouse. Acceptance: activating Play/Stop and selecting an instrument via keyboard dispatches the same semantic command as the pointer path, with visible focus.
- **LWB-006:** As a runtime implementer, I want a shared measurement/layout pass (rows, columns, gaps, padding, minimum sizes, remaining-space allocation, and the explicit narrow-screen fallback) so screens are not positioned by absolute coordinates. Acceptance: the example works at wide and narrow viewport widths using the same specification; layout recomputes only when geometry-relevant inputs change (not on every playback-status update).
- **LWB-007:** As a musician/tester, I want the example rendered on canvas using the existing bitmap-font and sprite conventions (no `fillText`), with working pointer hit-testing, keyboard activation and visible focus, and no perpetual redraw loop. Acceptance: panel, label, button and listbox render and respond correctly after resize; the canvas becomes idle after interaction settles.
- **LWB-008:** As a project author, I want direct-source entry points so the workbench and the standalone preview can be opened without a build step, and so opening the preview alone never loads workbench/editor code. Acceptance: `v2/dev.html` (workbench) and `v2/preview.html` (standalone runtime) load via `type="module"`; both work from a plain static file server, not only Vite; a network trace of `preview.html` shows no workbench module requested.

## Non-functional constraints

Plain JavaScript, native ES modules, explicit relative imports, JSON specification documents. No dependency installation, transpilation or code generation is required to run. No edits outside `v2`. Canvas rendering only uses bitmap fonts/sprites, never `fillText`. Musical timing is out of scope for this spec (mocked); it must not be modeled in a way that later couples rendering to audio scheduling.

## Explicitly deferred (separate specs or later phases of this one)

DOM renderer interchangeability (IMPLEMENTATION-PLAN.md step 5), live specification editing in the browser workbench (step 6, coordinated with 002's component gallery/log), lazy feature loading proof (step 7), the pattern-grid component (step 8) and real playback integration (step 9) are out of scope for the first delivery of this spec and will be recorded as later phases or superseding specs per the workflow.
