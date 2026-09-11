# 011 — Retiring the spec 003 pipeline

Date: 2026-09-10. Kind: cleanup. Status: specified. Closes spec [003](../003-live-workbench/requirements.md) by removing its runtime, which spec 005's pipeline replaced and which nothing has used since.

## Purpose

v2 has carried two independent rendering pipelines since spec 005:

| | spec 003 | spec 005 onward |
|---|---|---|
| document | `project/specs/application/outline.json`, schema version 1, hand-authored | `app-outline.json`, schema version 3, compiled from YAML |
| renderer | `renderers/canvas/mount.js`, one fixed transport/instrument template | `renderers/canvas/mountGeneric.js`, an arbitrary component tree |
| layout | `runtime/layout.js` | `runtime/genericLayout.js` |
| validation | `runtime/validate.js` | `compiler/convert.js` diagnostics |
| commands | `runtime/commands.js`, a registry with enablement | action bindings and lazy capability modules |
| entry points | `preview.html`, embedded by `dev.html` | `app.html`, `preview-app.html`, embedded by `workbench.html` |

Keeping both was deliberate: spec 005 said the older pipeline "still renders the fixed transport/instrument-list example unchanged", and that was true evidence while the new one was unproven. It is now proven, and the second pipeline has become a cost. It is a second answer to every question the first one answers, it is the only exception in spec 009's seam test, and it is the reason `assets.js` still exposes pre-skin fields.

## Decisions

- The whole spec 003 runtime goes, not part of it. Half a pipeline is worse than either.
- Nothing that the live path imports goes with it. `runtime/store.js` stays, because `runtime/appState.js` uses it and therefore the generated application does. `renderers/canvas/scale9.js` stays, used by the current draw kinds. The built-in fallback skin stays, because it is also what a `missing-skin` compile falls back to.
- The historical record is not rewritten. Specs 003, 005, 006 and 008 and the progress log keep describing what they described at the time; only documents that describe the *current* system are corrected, and this spec is the dated amendment that explains why they changed.
- **The code is not recoverable from Git.** No v2 file has ever been committed, so this deletion has no commit to revert. The removed files are copied to this session's scratchpad and listed in [tasks.md](tasks.md), and the folder is inside Dropbox, whose version history is the only other fallback. Committing v2 would be the durable answer and is not part of this spec.
- One concept in the removed code has no replacement yet and is worth carrying forward by name: `runtime/commands.js` was the only implementation of a command registry that checks *enablement* before dispatch, which spec 010's interaction and document-model packages will need again. Spec 010 records that.

## User stories and acceptance

- **RET-001 — The second pipeline is gone:** Acceptance: `mount.js`, `validate.js`, `normalize.js`, `layout.js`, `commands.js`, `uiCommands.js`, `templates/editor-workspace.js`, `domain/mockTracker.js`, `preview.html`, `dev.html` and `outline.json` no longer exist, and no remaining file imports any of them.
- **RET-002 — The live path is untouched:** Acceptance: the compiled outline is byte-identical, the application, the workbench, the generated app and the bundle all render and behave exactly as before, and the unit suite passes with only the four removed test files missing.
- **RET-003 — The current documentation is true:** Acceptance: every document that describes the present system stops describing two pipelines, two entry-point pairs or a schema-version-1 example; the historical specs and the progress log are left alone; this spec is linked as the amendment.
- **RET-004 — The follow-on simplifications land:** Acceptance: `assets.js` no longer carries the pre-skin `button`/`panel` fields, and spec 009's seam test no longer needs an exclusion, so no module anywhere branches on a component type name.

## Scope boundaries

In scope: deleting the eleven files and their four test files, removing the newly dead fields and the seam-test exclusion, and correcting the six current documents plus the service header.

Out of scope: committing v2 to Git, any change to the live pipeline's behaviour, and rewriting the historical specs or the progress log.
