# 011 — Design

## What goes

Verified by tracing every import before deleting anything: no file outside this set references any member of it.

| file | lines | why it existed |
|---|---|---|
| `renderers/canvas/mount.js` | 341 | the fixed transport/instrument-list renderer |
| `runtime/validate.js` | 179 | schema-version-1 document validation |
| `runtime/layout.js` | 81 | the fixed template's layout pass |
| `runtime/commands.js` | 43 | a command registry with enablement |
| `runtime/normalize.js` | 27 | template expansion and `flatten` |
| `runtime/uiCommands.js` | 13 | the two UI command ids |
| `templates/editor-workspace.js` | 53 | the one template the schema expanded |
| `domain/mockTracker.js` | 37 | its mock domain |
| `preview.html` | 51 | the standalone entry point |
| `dev.html` | 25 | the iframe shell around it |
| `project/specs/application/outline.json` | 73 | the hand-authored schema-version-1 document |

Plus `tests/{validate,normalize,layout,commands}.test.js`, 27 tests over about 280 lines, whose subjects all disappear.

## What stays, and why

- `runtime/store.js` and `tests/store.test.js`. `runtime/appState.js` wraps it, so the generated application depends on it.
- `renderers/canvas/scale9.js`. The current draw kinds slice every 9-slice through it.
- The built-in fallback skin in `runtime/skinModel.js`. It was introduced for this pipeline but is also what a `missing-skin` compile falls back to, so it keeps its assets and styles and loses only its comment about `preview.html`.
- `runtime/hitTest.js`. It mentions `normalize.js` in one JSDoc line but does not import it; the line is corrected.

## Follow-on simplifications

- `renderers/canvas/assets.js` drops its `button` and `panel` fields, which existed only so `mount.js` could draw before skins were authored, along with the `legacy()` helper that built them.
- `tests/componentTypes.test.js` drops its one exclusion, so the seam test now covers every module without exception: nothing anywhere branches on a component type name.
- `v2/templates/` becomes an empty directory. Directory removal is denied in this environment, so it is left in place and noted here; remove it when convenient. `v2/domain/` also empties, and stays deliberately: spec 010's playback package puts `domain/playback/` there next.

## Documents corrected

Only documents that describe the present system. Each keeps its history and gains a pointer to this spec where the change is material.

| document | change |
|---|---|
| `README.md` | the two-pipeline description and the `preview.html` entry point |
| `IMPLEMENTATION-PLAN.md` | steps 2 to 4's entry points and deliverables, already partly superseded by spec 010 |
| `project/documentation/runtime.md` | it documents the removed modules; becomes a dated record that they were retired, keeping the provenance notes for what survives |
| `project/documentation/compiler.md` | the "second, independent pipeline" paragraph |
| `project/documentation/skin.md` | the built-in fallback skin's stated purpose |
| `project/specs/index.md` | the steering entry for `outline.json`, and spec 003's delivery status |
| `assets/skin/src/README.md` | the sentence explaining why the legacy sprite sheet is kept |
| `server.mjs` header | the served-entry-point list |

Left untouched on purpose: specs 003, 005, 006 and 008, `project/progress.md`, and `project/specs/application/final-spec.md`. They record what was true when written, which is the project's stated policy; this spec is the dated amendment.

## Recoverability

No v2 file has ever been committed, so there is no revert. Before deleting, the eleven files and four test files were copied to this session's scratchpad, and the manifest is in [tasks.md](tasks.md). The repository folder is inside Dropbox, whose version history is the only other fallback. Committing v2 is the durable fix and is out of scope here.

## Carried forward

Two capabilities lived only in the retired code. Both are recorded in spec [010](../010-port-roadmap/design.md) so they are rebuilt deliberately rather than rediscovered, and in [runtime.md](../../documentation/runtime.md) so the gap is visible where a reader looks for it.

- **Command enablement.** `runtime/commands.js` was the only place v2 has ever asked whether a command *can* run before dispatching it. Its shape was a registry consulted by both the renderer, to draw a disabled control, and the dispatcher, to refuse. The current pipeline has no equivalent; spec 010's interaction and document-model packages need one.
- **A semantic DOM layer, which is v2's whole accessibility story.** `mount.js` positioned a real, visually transparent `<button>` over every control, so focus, accessible names, native Enter and Space activation and the disabled state came from the platform, and it drew hover and focus back onto the canvas from those elements' own events. `mountGeneric.js` has never had one; it uses a single focusable canvas with its own hit-testing. Retiring spec 003 therefore leaves v2 with no accessibility layer at all, which is worth stating plainly rather than discovering later. Spec 010's optional renderer package is where it returns.

This second point corrects spec 010, which said the semantic mirror promised by the roadmap's step 4 was never delivered. It was delivered, for the spec 003 renderer only, and is now gone with it.
