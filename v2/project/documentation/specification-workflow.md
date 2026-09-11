# Specification workflow

## Current policy — 2026-09-10

[Spec 005](../specs/005-interactive-workbench/requirements.md) refines 004: names supply identity; no authored IDs or compactLabel fields are required. Commas separate label alternatives. Natural-language rules/actions remain canonical YAML and may be interpreted directly into generated outline bindings. Unknown behavior produces warnings and safe mock/inert previews; syntax/structural failures preserve previous output. Authors need not first rewrite prose as typed YAML bindings. Development-time outline/code generation is allowed; launching generated source remains static. Reverse code synchronization is deferred.

[Spec 004](../specs/004-yaml-source/requirements.md) supersedes the prose-authority and snapshot policies below. The YAML graph rooted at [app.yaml](../specs/application/current/app.yaml) is the single application authoring source. outline.json becomes deterministic generated output; final-spec.md is historical context. The current outline is still a hand-authored runtime example until compiler migration is implemented.

Use Git for history. Stop creating application/component revision copies and manually bumping application-spec versions. Retain numbered feature/research specs, progress records and schema/compiler versions. Workbench edits target YAML; outline inspection is derived/read-only. Commit source, generated output and related implementation together when committing. Git currently has no tracked v2 files; untracked content is not revision history.

Generation must resolve references, validate executable semantics and preserve working JSON on failure. Prose descriptions require explicit structured interpretation before execution. Store deterministic source hashes and compiler versions, avoiding volatile timestamps. Keep generated JSON checked in so application startup requires no generator, parser or authoring server.

The remaining sections record the earlier process; their snapshot and independent natural-language authority requirements no longer apply.

## Adopted structure

Use the linked [SDD plugin](https://github.com/steffest/claude-plugins/tree/main/plugins/spec-driven-development) as the process reference. Its [init](https://github.com/steffest/claude-plugins/blob/main/plugins/spec-driven-development/commands/init.md), [requirement](https://github.com/steffest/claude-plugins/blob/main/plugins/spec-driven-development/commands/requirement.md), [design](https://github.com/steffest/claude-plugins/blob/main/plugins/spec-driven-development/commands/design.md) and [plan](https://github.com/steffest/claude-plugins/blob/main/plugins/spec-driven-development/commands/plan.md) command files were inspected on 2026-09-09. This is a local adaptation, not a plugin installation or a claim that its commands run in this project.

The adopted core is product steering, a spec index, numbered feature folders, requirements → design → tasks, verifiable phases, and domain documentation with an index. v2 uses AGENTS.md for agent guidance. Research outcomes and cumulative application revisions are extensions for this project. Verification is matched to the artifact: behavioral code gets meaningful tests; documentation gets consistency and completeness checks.

## Three different records

1. **Change spec:** `specs/NNN-slug/` explains one feature, correction or research question, why it matters, the approach, tasks and outcome.
2. **Full application spec:** `specs/application/final-spec.md` describes the whole currently intended application. It is self-contained; a generator should not need to reconstruct intent by reading every historical change.
3. **Progress and evidence:** `progress.md` records what actually happened. Completed planning never implies completed software.

“Final” means the consolidated result at a particular revision. The project can keep evolving. Record unresolved questions explicitly rather than filling them with invented decisions. The initial full spec describes the agreed research scope; it does not pretend to enumerate all existing tracker behavior.

## Change lifecycle

Allocate the next unused number in the index. Define kind (feature, research, correction or process), status, base application revision, stable requirement IDs and acceptance evidence.

Write requirements with user stories, acceptance criteria and non-functional constraints. Write the design after examining dependencies and alternatives. Then create tasks grouped into independently verifiable phases. A research design includes a hypothesis, experiment, observations and a decision criterion. A valid outcome may reject an approach and produce no runtime code.

Suggested specification states: draft → specified → superseded. Track delivery separately: not started, in progress, verified, inconclusive or abandoned. Mark outcomes precisely; an experiment can be completed yet inconclusive.

As work proceeds, update task checkboxes and append evidence to the progress log. Append an outcome section when concluding a spec. Corrections to a completed record should be dated and explained; subsequent scope changes get a new number and a supersedes/extends link. Never renumber or recycle old IDs.

An accepted change in intended behavior updates the cumulative spec even if implementation follows later. List planned and verified capabilities separately. A rejected research hypothesis stays in history without silently becoming application intent. Existing user authorization governs work; this process does not introduce an additional approval ceremony for routine changes.

## Versions and snapshots

Keep these identities separate:

- Spec number: a permanent change identifier, such as 001.
- Application-spec revision: a cumulative content revision, initially 0.1.0.
- Outline schema version: the format understood by validators, initially to be defined.
- Implementation version: a software release, introduced when software is delivered.

For application-spec revisions use major for incompatible requirements/contracts, minor for added or changed capabilities, and patch for clarifications that do not change behavior. This is a project convention; 0.1.0 is not a release-quality claim.

For each baseline, store a full natural-language snapshot under `application/revisions/<revision>/final-spec.md`, update the revision index, and make the current final-spec.md identical to that baseline. Never edit an old snapshot to represent a newer revision. Progress-only changes do not require a new application-spec revision.

When structured generation exists, include the matching outline and a manifest in each baseline. The manifest records source revision and hashes, included change-spec IDs, outline schema version, template/generator versions, referenced module versions or content hashes, and verification results. A stale or incompatible outline must be detected instead of presented as current.

Use Git history alongside these records to preserve exact file changes when commits are made. This setup does not create a separate repository or a commit; numbered records and snapshots provide readable history even before committing. Do not assume every progress entry has a Git commit.

## From full spec to an application

```text
Feature and research changes
          ↓ consolidate
Full natural-language application spec at revision R
          ↓ assisted translation + review
Structured application outline linked to R
          ↓ schema/reference validation + template expansion
Screen/component trees + behavior bindings + feature manifest
          ↓ shared layout and runtime
Canvas or DOM UI ↔ named capability modules
```

Natural language is the human-facing authority for intent. The validated outline is the runtime-facing contract. These are related artifacts, not competing independently edited specifications. An outline edit in the workbench is a draft change: reconcile it into the natural-language spec and numbered change record before promoting a new baseline. Likewise, changing prose marks its derived outline stale until reconciled.

Translation from prose may use AI and is not presumed deterministic. Keep its output and review unresolved interpretations. Once the outline, templates and versions are fixed, validation and screen expansion should be deterministic. Do not claim reproducibility from an AI prompt alone.

The outline should cover application state, commands, capabilities, screens, navigation, component roles, layout policies, assets, feature-load boundaries and acceptance-scenario references. A behavior binding names a module capability and typed command; it does not embed arbitrary code or assume behavior can be inferred from a button label. Missing capabilities produce diagnostics or explicitly labeled mocks.

All screens represented by supported templates can be generated from this model. Specialized components such as the pattern grid still need efficient implementations. Generation can produce module interfaces and wiring; preserving audio semantics remains a code-and-evidence task.

Authoring/generation happens when the project changes. The checked-in source and outline must run without rerunning that process. The workbench may normalize edited outlines in memory for preview. No AI call or code generator is required to launch the app.

## Next practical step

Create a separate live-workbench spec. Define the first minimal outline schema and use one transport/list example to test this pipeline. Do not generate an authoritative outline yet: there is currently no validator or agreed executable schema to establish its correctness.
