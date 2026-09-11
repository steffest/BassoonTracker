# 002 — Design

## Component authoring

Add a Components area alongside Screens and Project history. Edit the natural-language contract and structured draft; preview in isolation or in a consuming screen. Bootstrap the workbench with ordinary HTML controls so an experimental component cannot prevent editing its own specification.

Separate component contracts, variants, screen instances and implementations. Contracts define properties, events, state transitions, sizing, focus, keyboard behavior and scenarios. Variants separate behavior (action/toggle) from appearance (toolbar/standard). Instances bind labels, values and application commands. Shared controllers implement behavior; canvas/DOM adapters implement rendering and input mapping.

Start with named events, guards and actions, not arbitrary script expressions. Resolve declarations when contracts change, not every frame. Specify release-outside behavior, lost capture, keyboard repeat, focus loss and becoming disabled during a press. Toggle state belongs to application state. Defer repeat/menu variants until separately specified.

Proposed cumulative component records: project/specs/components/<id>/<revision>/spec.md and contract.json with a catalog index. Create executable contracts only after their schema exists. Numbered specs explain changes; component baselines describe the whole component. Application outlines pin contract revisions; baseline manifests also identify implementations/assets and their compatibility.

Start with a state gallery, property controls, event/command log and canvas/DOM comparison. Add usage inspection and diffs before version upgrades. Later add interaction replay, layout bounds and redraw/timing inspection. A state gallery verifies appearance; actual input scenarios verify behavior.

Confirmed 2026-09-09: State gallery and Interaction log are mandatory Phase 1 deliverables. Gallery fixtures use isolated mock bindings and never invoke application commands. The live example feeds an optional workbench trace collector at input, controller transition and command-dispatch boundaries. Use sequence numbers and a shared monotonic time origin to preserve ordering across those boundaries. Store a bounded ring buffer; pause stops capture, filters affect display only, and clear resets the visible trace and dropped-entry count. Report paused capture and truncation explicitly. Do not import the collector into the standalone production runtime. Detailed acceptance is in COMP-002's first-delivery clarification.

## Optional local server

Proposed entry: v2/server.mjs, launched with `node v2/server.mjs` from the repository root. Use built-in node:http, node:fs/promises and node:crypto. Serve v2 source with correct MIME types and a small same-origin document API on a dedicated local port. No bundler, Express or database is required.

A storage adapter handles reading, saving and promotion. Static mode retains browser drafts plus import/export; the generated application never depends on the authoring API. Direct browser directory access can be a later adapter.

Map logical document IDs to allowed project files. Bind to loopback, validate Host/Origin and authenticate writes with a session token. Resolve paths including junctions/symlinks within v2/project; limit payload sizes and document types. Do not provide arbitrary shell execution or an unrestricted filesystem API. Existing historical snapshots cannot be overwritten through this API.

Reads include a content hash; saves include the base hash. Serialize writes and return a conflict when content has changed externally. Stage replacement writes and test Windows failure behavior. Multi-file promotion needs a recoverable journal/staged revision with the current revision pointer updated last; several independent writes are not a transaction. Expose saved, saving, conflict, offline and failed states.

Draft saves reference the active numbered spec. Promotion reconciles prose/contracts, validates references, preserves component/application baselines and appends progress. Git commits are a separate operation. Start with reread-before-save detection; external-change notifications can follow later.

## Verification and references

Test controller transitions, schema validation, compatibility, path containment, stale writes and failure recovery. Exercise actual keyboard/pointer behavior through both renderers. Test restart recovery before enabling multi-file promotion. Record the research outcome even if the proposed contract vocabulary proves insufficient.

- [MDN directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker): browser-only directory access has limited availability and requires user interaction/permission.
- [Node HTTP](https://nodejs.org/api/http.html) and [filesystem APIs](https://nodejs.org/api/fs.html): built-in foundations for the authoring server; save consistency remains application logic.
