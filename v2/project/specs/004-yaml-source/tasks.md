# 004 — Tasks

## Phase 1 — Source authority and history

Goal: document and adopt the corrected workflow.

- [x] Inspect YAML, existing outline and runtime validator.
- [x] Document gaps, authority and generation boundaries.
- [x] Update current guidance to stop storing revision copies.
- [ ] Remove existing revision copies: automatic command review blocked the cleanup command; files remain.

User verification: spec index points to app.yaml and guidance uses Git history. Existing application/revisions files remain pending cleanup. Compiler is explicitly pending.

## Phase 2 — Generate a compatible example

Goal: produce validated runtime JSON from source.

- [ ] Define minimal schema and choose an authoring parser.
- [ ] Normalize YAML IDs/shapes and resolve missing bindings explicitly.
- [ ] Implement resolver/validator, provenance, deterministic emission and check mode.
- [ ] Test bad refs/cycles, stable output and preservation on failure.
- [ ] Validate generated output against runtime before replacing existing JSON.

User verification: a YAML label change appears in preview; a broken ref produces a source error and retains the working preview.

## Phase 3 — Workbench integration

Goal: maintain one source through browser authoring.

- [ ] Save/edit YAML and regenerate through the authoring server.
- [ ] Make outline inspection derived/read-only and flag stale output.
- [ ] Replace planned snapshot promotion with Git-based history and source/output diffs.
- [ ] Verify checkout execution on a static host without compiler dependencies.

User verification: inspect saved YAML/JSON changes together and run without the authoring server.

Outcome: documentation/process delivered; compiler and YAML-backed editing are not implemented.
