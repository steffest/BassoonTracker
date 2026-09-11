# Vendored CodeMirror 6 bundle (workbench only)

`codemirror.bundle.js` is a single minified ES module produced from `entry.source.js` with esbuild 0.28.2 (`--bundle --format=esm --minify --target=es2022 --legal-comments=none`) on 2026-09-10. It is loaded only by `v2/workbench/editor.js` (the authoring workbench); `app.html`, `preview-app.html`, `preview.html` and every runtime/renderer module never import it, so the generated application still ships no third-party code. All contained packages are MIT licensed (see `LICENSE`, the CodeMirror licence text that applies to the @codemirror/* and @lezer/* packages alike; @marijn/find-cluster-break, crelt, style-mod and w3c-keyname are MIT by the same author or contributors).

| package | version | license |
|---|---|---|
| @codemirror/autocomplete | 6.20.3 | MIT |
| @codemirror/commands | 6.11.0 | MIT |
| @codemirror/lang-yaml | 6.1.3 | MIT |
| @codemirror/language | 6.12.4 | MIT |
| @codemirror/lint | 6.9.7 | MIT |
| @codemirror/search | 6.7.2 | MIT |
| @codemirror/state | 6.7.4 | MIT |
| @codemirror/theme-one-dark | 6.1.3 | MIT |
| @codemirror/view | 6.43.11 | MIT |
| @lezer/common | 1.5.2 | MIT |
| @lezer/highlight | 1.2.3 | MIT |
| @lezer/lr | 1.4.10 | MIT |
| @lezer/yaml | 1.0.4 | MIT |
| @marijn/find-cluster-break | 1.0.4 | MIT |
| codemirror | 6.0.2 | MIT |
| crelt | 1.0.7 | MIT |
| style-mod | 4.1.3 | MIT |
| w3c-keyname | 2.2.8 | MIT |

## Regenerating

```
npm init -y
npm i codemirror@6.0.2 @codemirror/lang-yaml@6.1.3 @codemirror/lint@6.9.7 @codemirror/theme-one-dark@6 esbuild@0.28.2
cp <v2>/vendor/codemirror/entry.source.js entry.js
npx esbuild entry.js --bundle --format=esm --minify --target=es2022 --legal-comments=none --outfile=codemirror.bundle.js
```

Then copy the output here and update the table above from the resulting `package-lock.json`. Bumping versions is a deliberate change: record it in `project/progress.md`.

## Why vendored rather than a CDN or npm install

The project runs from static source with no install or build step (`AGENTS.md`), so the workbench cannot depend on `node_modules` at runtime; loading from a CDN would make the authoring tool depend on network access and on a third party serving unchanged code. A single checked-in artifact with recorded versions is deterministic, works offline and is reviewable in Git, the same treatment the skin sprite sheet received in spec 003.
