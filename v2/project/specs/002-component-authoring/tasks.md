# 002 — Tasks

Specification delivered; implementation pending. Coordinate these phases with the future live-workbench spec.

## Phase 1 — Component experiment

Goal: prove a reusable button contract.

- [ ] Define schema and action/toggle scenarios.
- [ ] Implement shared behavior and canvas/DOM adapters with behavioral tests.
- [ ] Add property editing and a labeled State gallery for supported button states in both renderers; keep illustrative states separate from the live example. (State gallery delivered for canvas by spec 005 Phase 4; property editing and DOM pending.)
- [x] Add the Interaction log with ordered input/state/command entries, pause/resume, clear, filters and bounded storage. (Delivered by spec 005 Phase 4: `runtime/traceCollector.js` + `v2/workbench/interactionLog.js`.)
- [x] Verify gallery fixtures dispatch no application commands; disabled live controls emit no activation command; log truncation and filtering remain visible. (Verified in spec 005 Phase 4's browser run and `traceCollector.test.js`.)
- [ ] Exercise disabled, release-outside, keyboard and renderer-switch cases.

User verification: edit a variant and compare pointer/keyboard behavior in both renderers. Record whether the contract vocabulary is sufficient.

## Phase 2 — Direct saving

Goal: save and reopen project drafts reliably.

- [ ] Implement built-in Node source server and constrained document API.
- [ ] Test containment, write authorization, stale hashes and replacement failures.
- [ ] Connect storage adapter and save/conflict indicators.
- [ ] Verify static-mode browser drafts/import/export still work.

User verification: save/reopen a draft, change the file externally, then resolve a conflict from the stale browser copy.

## Phase 3 — Component revision history

Goal: evolve components without silently changing consumers.

- [ ] Implement pinned references, usage inspection and compatibility diagnostics.
- [ ] Add recoverable revision promotion and test interruption/restart recovery.
- [ ] Add replayable behavior scenarios linked to revisions.
- [ ] Update cumulative baselines and domain documentation when delivered.

User verification: revise a contract, inspect affected screens, promote it, and reopen the old baseline. A failed promotion must not leave mixed revisions active.

## Current outcome

Design and plan documented. No component editor, save server or automated version promotion exists yet.
