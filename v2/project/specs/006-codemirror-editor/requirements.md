# 006 — CodeMirror source editor for the workbench

Date: 2026-09-10. Kind: feature. Status: implemented and verified. Builds on 005 (interactive workbench). Supersedes 005's design note that "a plain textarea … no large IDE dependency is necessary": the textarea served Phases 2-5, and the user asked for a real editor once the authoring loop worked.

## Purpose

Replace the workbench's plain `<textarea>` with CodeMirror 6 so authors get YAML syntax highlighting, block folding and inline validation while editing the canonical source files, without changing what Save does, what the compiler reads, or what the generated application ships.

## User stories and acceptance

- **CME-001 — Highlighting:** As an author, YAML keys, values, strings and comments are visually distinct. Acceptance: opening any file under `project/specs/application/current` renders tokenized lines; the same file is selected/edited exactly as before (click-to-source still selects the authored block).
- **CME-002 — Folding:** As an author, I can collapse and expand nested YAML blocks. Acceptance: a fold gutter marks foldable blocks; "Fold all" collapses every block to a placeholder and "Unfold" restores them; folding never changes the document text or the dirty state.
- **CME-003 — Validation:** As an author, invalid YAML is underlined as I type, before I save. Acceptance: the same parser the server uses to reject a save (`compiler/yaml.js`) drives the lint, so an underlined error is exactly what `PUT /api/source` would answer 422 for; when the buffer is unchanged since the last generation, the compiler's warnings for this file appear inline at their ranges; once the buffer is edited those warnings are withdrawn (their offsets are no longer trustworthy) while syntax lint stays live.
- **CME-004 — Unchanged loop:** As an author, everything from spec 005 still holds. Acceptance: dirty markers, file switching with retained edits, Ctrl/Cmd+S, conflict and saved-but-stale handling, read-only mode on a static host, and the standalone preview loading no editor code all pass the existing browser scenarios.

## Non-functional requirements

No install or build step at runtime: the editor ships as one vendored, minified ES module under `v2/vendor/codemirror/` with recorded versions, licences (all MIT) and the exact command that produced it. It is loaded only by `v2/workbench.html`; `preview-app.html`, `preview.html` and every `runtime/`, `renderers/` and `compiler/` module remain free of third-party code. The workbench keeps working offline.

## Scope boundaries

In scope: highlighting, folding, lint gutter, Fold all/Unfold controls, a small `window.v2Workbench` automation surface for browser tests. Out of scope: autocompletion of component names, schema-aware validation beyond the compiler's own diagnostics, editing multiple files side by side, and any change to the save protocol.
