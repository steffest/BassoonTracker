# 001 — Specification lifecycle requirements

Kind: process/research. Base: unversioned design proposal. Target application-spec revision: 0.1.0. Status: specified; documentation delivered.

## Purpose and alignment

Make the research project's evolution traceable while retaining one complete description of the intended application. This supports reproducible app authoring, renderer independence and learning from experiments.

## Requirements

- **SDD-001:** As a project author, I want all specifications under v2/project/specs so project records remain distinct from runtime code. Acceptance: product steering, index and numbered specs exist there; the roadmap uses those paths.
- **SDD-002:** As a researcher, I want each significant change captured separately so earlier intent and findings remain recoverable. Acceptance: each change has a permanent number, requirements, design, phased tasks and an explicit outcome; later changes do not overwrite completed scope.
- **SDD-003:** As an application author, I want a cumulative natural-language specification so I can understand the whole intended app without replaying change history. Acceptance: a revisioned current spec and preserved baseline exist, with unresolved scope and implementation status clearly stated.
- **SDD-004:** As a researcher, I want investigations to finish with evidence even when no code is appropriate. Acceptance: the lifecycle admits documentation, experiments, rejected hypotheses and inconclusive results.
- **SDD-005:** As a runtime implementer, I want a clear path from prose to structured outline to UI and behavior modules. Acceptance: the workflow separates assisted interpretation from deterministic expansion and records how derived artifacts become stale.

## Non-functional constraints

Changes stay inside v2. No mandatory build, plugin installation or dependency is introduced. Version records must not imply runtime implementation or tests that have not occurred. Application-spec, schema and software-release versions remain distinct.
