# 001 — Specification lifecycle design

## Architecture

Numbered change specs feed a consolidated application baseline; the baseline later feeds a validated outline and renderer-independent runtime. Product steering states purpose. A chronological progress log records evidence separately from intended behavior.

Interfaces and record structure are defined in [the workflow](../../documentation/specification-workflow.md). Each change has a stable number, kind, base/target revision, requirement IDs, specification status and delivery status. The application baseline has a revision, scope, requirement IDs and explicit unresolved questions.

## Decisions

- Adopt the linked plugin's project/specs layout and requirements/design/tasks sequence.
- Use v2/AGENTS.md for local process instructions without editing parent configuration.
- Add immutable full-spec snapshots and an application revision index.
- Keep the existing implementation plan as a roadmap; future feature task files own delivery status.
- Defer executable outline creation until the schema and validator are specified. No invented generated result is checked in as if executable.

## Errors, verification and performance

Reject conflicting version identities or mismatched current/snapshot content during document checks. Future generation must report unresolved references and stale source hashes. Validate links, required records and status consistency now; outline tests arrive with the runtime. Process records add no runtime load requirements.

No code execution from prose is introduced. Future outlines reference registered capabilities. Progress entries identify delivered artifacts and unimplemented work.
