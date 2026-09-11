# 005 — Interactive YAML application workbench

Date: 2026-09-10. Kind: feature/research. Status: specified; implementation not started. Builds on 003's canvas runtime and 002's component tools. Supersedes 004's authored-ID, compactLabel, explicit-YAML-binding and fatal-unresolved-behavior proposals. Git remains the revision store.

## Purpose

Develop the application inside a browser: keep canonical YAML beside its rendered result, point to a component to locate its source, edit and save the actual file, and see the regenerated result. The first delivery is a simplified but inspectable canvas application with explicitly limited/mock behavior, not full tracker playback.

## Authoring conventions

- Names, mapping keys and filenames identify definitions. Authors need not supply IDs. Generate internal instance IDs when necessary.
- Keep type separate from layout. Fixed dimensions may come from component defaults; missing defaults produce warnings rather than invented requirements.
- Comma-separated labels represent ordered alternatives, longest/preferred first: `instrument, instr, ins, i`. Commas never belong to a label. Derive alternatives in the outline without rewriting authoring syntax.
- Natural-language rules and actions are valid source. Generate executable bindings in outline.json where understood; report unresolved interpretations as warnings. Authors are not required to hand-write selectors or state machines.
- Generation of outline and implementation code is allowed during development. Launching the already-generated static application does not require generation. Automatic code-to-YAML synchronization is future research, not this delivery.

## User stories and acceptance

- **IWB-001 — Workspace:** As an author, I see a YAML file tree/editor beside the live app, with component ancestry, diagnostics and save status. Acceptance: open app.yaml and referenced component/action/rule files; resize the panes; see the selected source filename and unsaved state.
- **IWB-002 — Hover inspection:** As an author, I can discover nested component boundaries. Acceptance: Inspect mode outlines the deepest hit component and exposes its ancestor chain; clipped/hidden components cannot steal selection; outlines remain correct after scrolling, scaling and resize.
- **IWB-003 — Source selection:** As an author, clicking a component opens its defining YAML and selects the relevant block. Acceptance: clicking a referenced controlBar button opens controlBar.yaml; a parent breadcrumb selects the parent. Show both definition and reference/use site when applicable. Repeated instances remain distinguishable. Inspection never dispatches the component's application command.
- **IWB-004 — Editing and persistence:** As an author, I save real YAML files from the UI. Acceptance: edit a label or layout, Save, then reopen the file and observe the change on disk and in the preview. Ctrl/Cmd+S saves the active document. Unsaved buffers survive file switching. External edits cause a conflict rather than an overwrite.
- **IWB-005 — Conversion diagnostics:** As an author, each conversion returns and prints a warning list with source locations. Acceptance: missing action1/action2, unknown rules or unsupported components appear in the browser and server console. Supported content still previews; unresolved behavior is inert or explicitly mocked. Syntax errors/cycles that prevent a coherent tree retain the last valid preview and output.
- **IWB-006 — Interpretation:** As an author, prose remains my source while generated bindings are inspectable. Acceptance: supported phrases produce visible bindings with provenance; ambiguous phrases produce warnings, not undisclosed guesses. Unknown interpretation never claims working behavior. No arbitrary prose is evaluated as JavaScript.
- **IWB-007 — Interaction:** As an author, I switch to Interact mode to exercise controls and see input → state → command in the Interaction log. Acceptance: inspect selection and app activation are mutually exclusive, editor keyboard input never triggers tracker shortcuts, and selection survives mode switching where its node exists.
- **IWB-008 — Component development:** As an author, I use the State gallery and Interaction log while refining components. Acceptance: labeled default/hover/pressed/focus/disabled and toggle states are available for supported buttons; illustrations are isolated from application commands; the log has clear, pause/resume, filtering and bounded storage. Follow spec 002's acceptance details.
- **IWB-009 — Local service:** As an author, one Node command serves the workbench, files and conversion API. Acceptance: no separate Vite server is required for this flow; source access and writes remain within v2's allowed locations; the standalone generated app also works on a static host.
- **IWB-010 — Progress:** As a researcher, I distinguish saved source, successful generation, warnings, stale preview and implemented behavior. Acceptance: failed generation does not masquerade as an unsaved file, no copied revision snapshots are created, and no automatic Git commit is made by Save.

## Non-functional requirements

Plain JavaScript and small modules; Node built-ins for HTTP/filesystem. Any YAML parser must be deliberately selected with license/provenance, kept out of the shipped app. Preserve YAML comments and formatting by saving the edited text rather than serializing the whole graph. Reuse the canvas runtime and bitmap fonts; no canvas fillText. The workbench shell may use ordinary HTML controls. All edits stay in v2.

## Scope boundaries

First delivery: local single-user editing, canvas preview, simplified supported controls and warning placeholders, source inspection, saving/conversion and component tools. DOM parity follows the existing renderer roadmap. Real tracker playback, arbitrary AI-generated modules, collaboration, Git UI and reverse synchronization from code are deferred. Warnings make partial support explicit; they are not substitutes for completion of the acceptance scenarios above.
