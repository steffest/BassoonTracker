# 004 — YAML source and Git history

Date: 2026-09-10. Status: specified; compiler pending. Supersedes source-authority and snapshot policies in 001–003.

- YAML-001: The graph rooted at application/current/app.yaml is the single authoring source, including referenced actions, rules and components. Prose descriptions may live there; final-spec.md is historical context.
- YAML-002: Generate outline.json deterministically from validated YAML. Unknown references and unsupported behavior produce source-located errors; failure preserves the working outline.
- YAML-003: Commit generated JSON alongside source when committing; application startup requires no generator, YAML parser or Node authoring service.
- YAML-004: Use Git for revisions, removing application/revisions and stopping copied application/component baselines. Retain numbered change specs, progress and schema versions.
- YAML-005: Workbench editing targets YAML; outline is derived inspection output. State gallery and Interaction log remain required component tools.

Acceptance: a label edit generates matching JSON; invalid references/cycles fail without replacing working output; a clean checkout runs statically; Git diffs show source and output together. The existing runtime must accept generated output before migration is complete.
