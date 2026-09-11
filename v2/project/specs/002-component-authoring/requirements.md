# 002 — Component authoring and local saving

Kind: feature/research. Base: application-spec 0.1.0. Target: 0.2.0. Status: specified; implementation not started. Extends 001.

## Purpose

Develop reusable UI components alongside application screens. Extend the workbench to specify and exercise their behavior, and save project specifications directly from the browser.

## Requirements

- **COMP-001:** As an author, I can define properties, variants, states, input behavior, accessibility, sizing and acceptance scenarios. Acceptance: action and toggle buttons have explicit contracts independent of renderer and application bindings.
- **COMP-002:** As an author, I can preview states and exercise components on canvas and DOM. Acceptance: disabled controls never activate; pointer and keyboard follow the same contract; toggle state survives renderer replacement. Forced visual states are labeled and do not count as behavioral verification.
- **COMP-003:** As an author, I can see component usage and review contract changes. Acceptance: consumers pin revisions and incompatible changes produce diagnostics rather than silently changing existing screens.
- **COMP-004:** As an author, I can save drafts to project files. Acceptance: saved content reopens correctly; stale browser edits produce conflicts; failed saves preserve previous content; writes stay inside v2/project.
- **COMP-005:** As a researcher, I can distinguish saving, promoting a spec revision and verifying implementation. Acceptance: semantic changes belong to numbered specs; promoted baselines preserve history; autosave does not create a new feature spec per keystroke.

## Constraints and hypothesis

### Confirmed first-delivery scope — 2026-09-09

The user explicitly confirmed the State gallery and Interaction log. Both are required in Phase 1, not deferred inspection tools. This clarifies COMP-002 within the existing 0.2.0 scope; it does not allocate a new feature number.

- **State gallery acceptance:** show labeled default, hover, pressed, focused and disabled examples together, plus on/off for toggle buttons. Display supported states for the selected variant in canvas and DOM. Mark forced states as illustrative; interacting with a separate live example verifies actual transitions. Gallery examples must not dispatch real application commands.
- **Interaction log acceptance:** record ordered pointer/keyboard input, resulting state transitions and emitted semantic commands for the live example. Each entry identifies component instance, renderer, sequence number and elapsed time. A disabled activation attempt produces no command. Provide pause/resume, clear and component/event filtering; distinguish paused capture and filtered views from missing events. Keep a bounded buffer with an explicit dropped-entry count so inspection cannot grow memory indefinitely. Logging is workbench-only and can be disabled.

Plain JavaScript and source-only execution remain required. An optional dependency-free Node authoring server is allowed; the generated application does not require it.

Hypothesis: a small declarative contract plus reusable behavior controllers can express useful component variants without becoming a general programming language. Test action/toggle buttons first. If arbitrary embedded scripts become necessary, revise the abstraction and keep complex behavior in named modules.
