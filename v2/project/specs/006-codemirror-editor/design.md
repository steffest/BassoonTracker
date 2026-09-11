# 006 — CodeMirror editor design

## Dependency policy

CodeMirror 6 (`codemirror`, `@codemirror/lang-yaml`, `@codemirror/lint`, `@codemirror/theme-one-dark` and their `@codemirror/*`/`@lezer/*` dependencies) is bundled once with esbuild into `v2/vendor/codemirror/codemirror.bundle.js` (ESM, minified, ~420 KB). `entry.source.js` beside it is the exact entry that was bundled, `README.md` lists every contained package with version and licence plus the regeneration command, and `LICENSE` is the MIT text. This mirrors how the skin sprite sheet was brought in for spec 003: a checked-in artifact with provenance, no runtime install, no CDN. Regenerating the bundle is a deliberate change recorded in `project/progress.md`.

## Module boundary

`v2/workbench/editor.js` is the only importer of the bundle. It exposes a small host API (`getText`, `setText(text, { notify, selection })`, `getSelection`, `select(from, to)`, `setReadOnly`, `setExternalDiagnostics`, `foldAll`, `unfoldAll`, `dispose`) so `workbench.html` keeps its buffer model (per-file text, disk hash, EOL, selection, conflict) unchanged and merely swaps the widget. `setText` without `notify` is a host-driven load (file switch, reload from disk) and does not fire `onChange`; browser tests use `notify: true` to simulate typing.

Offsets stay consistent end to end: CodeMirror normalizes line breaks to LF, `compiler/yaml.js` computes ranges on LF-normalized text, and the workbench already converts CRLF files to LF for its buffers and back on save. Ranges from `app-outline.json` therefore map straight onto editor positions.

## Validation

`linter()` runs `parseYamlDocument` from `compiler/yaml.js` on the current document (250 ms debounce) and reports its range-qualified errors as `error` diagnostics. That parser is the one `PUT /api/source` uses as its validate-before-write gate, so the underline and the 422 agree by construction; the scoped-subset limitations of that parser (no flow collections, anchors, block scalars) are therefore also what the editor flags. The workbench's existing stale-location logic (`updateStaleNotice`) now also decides whether the compiler's diagnostics for the open file are overlaid: only while the buffer is clean and its disk hash equals the outline's recorded hash. Editing withdraws them; a successful Save & Refresh brings them back for the new generation.

## Keyboard and modes

`Mod-s` is bound inside the editor and calls the same `saveAndRefresh` as the toolbar button; the page-level Ctrl/Cmd+S handler skips events the editor already handled. Read-only on a static host is expressed through `EditorState.readOnly` + `EditorView.editable(false)` so the text is still selectable and click-to-source still highlights ranges. Fold all / Unfold buttons sit in the editor header next to Save & Refresh.

## Testing

No unit tests: the editor is DOM-bound. The headless-Chrome scenario for spec 005 Phase 3 gained eight editor checks (mounted, highlighted, fold gutter, fold/unfold, compiler warnings overlaid, overlay withdrawn on edit, live syntax error underlined) and all existing scenarios were re-run unchanged in intent against the new editor.
