# 005 — Interactive workbench design

## Existing foundation and architecture

dev.html currently embeds preview.html without editing. runtime provides validate/normalize/store/commands/layout, and renderers/canvas/mount.js implements the transport/list example. There is no YAML compiler or authoring service. The new source hierarchy needs an extended tree schema; do not force menu/radio groups into transport-region assumptions.

```text
Browser workbench: file tree | text editor | canvas preview
                         diagnostics / gallery / interaction log
       ↓ read/save/convert                         ↑ source mapping
Local Node service → YAML graph → interpretation → outline + diagnostics
                                                    ↓
                                      browser layout and canvas renderer
```

Node serves static source, persists YAML and performs conversion. Rendering and hit-testing stay in the browser. A simplified renderer is a runtime capability profile sharing the same tree/layout/source map, not a second server-rendered UI with unrelated geometry.

## Source language and identity

Accept the existing inline keyed nodes and scalar component references. Resolve known names against current/components, current/actions and current/rules. Definition identity prefers name, then mapping key, then filename. Internal instance identity combines reference ancestry and local name; use type/first label as a fallback and occurrence suffixes only for collisions. Emit a warning for ambiguous duplicate names. Do not require authored IDs. Renames/reordering of otherwise indistinguishable nodes may reset their selection/local preview state; do not promise stable identity that the source cannot supply.

Split label strings on commas, trim whitespace, preserve order, warn about empty variants and measure with the actual renderer font. Pick the first fitting variant; if none fits, use the shortest with the component's documented clipping/overflow policy and expose the full preferred label accessibly. Labels are not rewritten into separate fields in YAML.

Support independent layout fields such as width: fill, height: fixed and resizable: horizontal. Numeric fixed sizes come from a defined component/theme default unless provided explicitly; warn if no applicable default exists. All authoring remains semantic, without requiring coordinates for every screen.

## Interpreting prose and generating bindings

Preserve descriptions/rules/actions verbatim. A converter layer maps recognized intent to registered behavior/layout recipes and emits bindings, command references and required mock state into the outline. Keep this layer separate from YAML parsing and geometry. Initial recipes cover the supplied play-highlight/toggle intent and documented layout policies, with explicit mock labels where real capabilities are absent.

Do not claim arbitrary natural language can be understood by a small deterministic compiler. Unsupported or ambiguous prose yields warnings and inert/placeholder behavior. The first implementation uses a tested phrase/recipe vocabulary; later an optional inference provider may broaden coverage. Any AI inference output needs schema/reference validation and recorded provenance. Such inference is not presumed reproducible from a prompt; deterministic expansion applies after interpretation is fixed. No AI service is required for the initial workbench.

Return diagnostics with severity, code, message, file, range and node identity. Print an ordered warning list in the UI and console, including a zero-warning summary when applicable. Warnings allow simplified preview with visible limitations. Parse failures, ambiguous graph resolution and cycles that prevent safe expansion are errors. Never silently drop an unsupported component: render an inspectable placeholder with its source provenance.

## Source map and inspection

Use a YAML parser exposing document ranges; reject duplicate mapping keys and unsafe executable tags. Generate source metadata per node: defining file, document path and range; reference-site file/range; generated identity; contributing rules/actions. Record source hash and preview revision so offsets cannot be applied to a different editor buffer.

Canvas layout exposes visible rectangles, clipping, paint order and ancestry to a workbench-only inspection adapter. Inspect mode schedules overlay redraw only on hover/selection/geometry changes. Hit-test deepest visible node by paint order; breadcrumbs allow parent selection. Map pointer coordinates through CSS scale, device-pixel ratio and scroll consistently with the renderer. The overlay must not alter layout or app state.

Selecting a node opens its definition block by default and offers the use site and contributing rules as links. For expanded instances, distinguish instance context from a shared definition; changing the latter affects all uses. Generated helper nodes map to the nearest authored owner and are labeled generated. If source offsets are stale due to unsaved edits, reparse that buffer or show a stale-location notice instead of selecting unrelated text.

Use an iframe message bridge with preview revision/request IDs, validated source/origin and structured payloads. Events include ready, hover, select, geometry, diagnostics and runtime trace. Reject stale responses. In Interact mode the inspection overlay does not intercept input. A toolbar control and keyboard-accessible ancestry tree provide alternatives to hover.

## Editor and save lifecycle

Start with a plain textarea plus file tree, source-range selection and diagnostics; no large IDE dependency is necessary. (Superseded 2026-09-10 by spec [006](../006-codemirror-editor/requirements.md), which vendors CodeMirror 6 once the loop worked.) Maintain text, disk hash, dirty flag and cursor/selection per open file. Save the full original edited text, preserving comments. File switching retains buffers; browser draft recovery may supplement disk saves and must be labeled.

Initially Save & Refresh is explicit, with Ctrl/Cmd+S bound to it; debounced in-memory draft preview can follow. Save validates YAML syntax before disk replacement, compares the base hash, writes atomically and then converts the on-disk graph. Valid YAML with unresolved behavior is saved and generates warnings. Invalid YAML stays editable as a local draft. If semantic conversion fails after a successful save, report 'saved; preview stale' and retain the previous outline. Do not overwrite other unsaved buffers or imply they were included in a disk conversion.

Serialize saves and conversion publication. Capture hashes of every graph input, recheck before publishing, and discard/retry if another file changed during conversion. Render only the newest successful generation. Separate source-save and outline-publish status; they are not a fictitious multi-file atomic transaction. Preserve compatible app state by generated identity; remount affected subtrees and dispose subscriptions correctly.

## Local Node service

Proposed entry: server.mjs, run as `node v2/server.mjs`. Bind loopback on a dedicated configurable port; document its workbench URL when implemented. Serve v2/dev.html and preview assets directly, without transforms. Existing root /dev.html remains untouched.

Proposed API:

- GET /api/files — editable YAML tree under project/specs/application/current.
- GET /api/source?path=... — text and content hash for an allowed relative path.
- PUT /api/source — path, text, baseHash; return saved hash or conflict/validation error.
- POST /api/convert — convert the saved graph; return generation identity, diagnostics and publish/stale status.
- GET /api/outline — current generated document and source-generation identity.

Constrain normalized/real paths including junctions to allowed roots. Writes allow only current YAML documents and converter-owned outline output. Bind to loopback, check Host/Origin, protect writes with a session token and cap request sizes. Never expose arbitrary commands, general file writes or eval. Serve correct MIME types and explicit errors. Test replacement semantics and recovery on Windows. External edits are detected through hashes; push notifications are optional later.

## Component tools, performance and testing

Keep State gallery fixtures isolated with mock commands. Live Interaction log captures sequence/time, instance, input, transition and emitted command; bounded storage and disabled capture prevent unbounded overhead. Do not ship inspection/editor/log modules with standalone preview startup.

Test name-derived identities, label selection, source maps across references, warnings, parse errors and output preservation. Test picking under clipping/scale/scroll and ensure Inspect never activates a control. Test disk conflicts, failed replacement, concurrent generations and stale messages. Run existing runtime regression tests after schema changes. End-to-end acceptance uses the actual local server and browser, including on-disk reread after Save.

## Future research

Code generation may happen during authoring. Reverse code-to-YAML synchronization is explicitly deferred: first establish source maps and ownership between generated wiring and handwritten capability modules. Do not silently modify canonical YAML in response to arbitrary code changes. Git records the coherent source/output/module set; no copied revision directories or manual application release numbers.
