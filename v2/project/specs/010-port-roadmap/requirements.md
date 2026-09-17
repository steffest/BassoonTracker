# 010 — Porting the v1 application onto the v2 system

Date: 2026-09-10. Kind: architecture/research (a plan, not a feature). Status: specified, not started. Supersedes steps 5 to 9 of [IMPLEMENTATION-PLAN.md](../../../IMPLEMENTATION-PLAN.md) as the porting plan; those steps were written before the existing application was inventoried.

## Purpose

v2 can now describe an application in YAML, compile it with source-located diagnostics, draw it on canvas from an authored skin, declare its component types once, and emit a static bundle. The application it describes is a control bar.

This spec is the ordered plan from here to a v2 that runs the tracker. It exists because the work is large enough that doing it in the wrong order wastes most of it: two thirds of the remaining effort depends on machinery v2 does not have, and the parts that look hardest (playback, file formats) turn out to be the most independent.

Each work package below becomes its own numbered spec when it is started. This document is the sequence, the reasoning and the acceptance for the programme as a whole.

## The measured gap

From the inventory of 2026-09-10 (`script/src`, `script/plugins`, `player/src`):

| | v1 | v2 today |
|---|---|---|
| own source | 25,300 lines: 14,453 UI, 10,850 non-UI | 6,728 lines |
| vendored | 6,098 lines (zip, WAAClock) | 0 in the runtime |
| plugins | 6,821 lines in 3 registered plugins | none |
| reusable component types | 26 | 6 implemented, 2 declared |
| bitmap fonts | 10, plus 7 colour variants | 1 |
| spritesheet assets used | 113 of 132 | 14 |
| events and commands | 63 and 37 | 4 prose recipes, 2 named rules |
| tracker effect branches | about 54 | none |
| automated tests | none (3 fixture files) | 138 |

About 8,800 lines of v1's UI sit in surfaces that are not component trees at all: the pattern grid, the multitrack arrangement view, the sample editor and its waveform, the piano, the envelope editor, the scopes and the VU meters. Those become specialized components with their own data access, not YAML.

## What "ported" means

Programme-level acceptance. Each is a gate, not a preference.

- **PORT-001 — Screen parity:** every v1 screen is either authored in YAML from registered component types, or is a declared specialized component with its own contract. No screen carries absolute coordinates in its source, and every one traces to a spec and to authored YAML.
- **PORT-002 — Musical parity:** a fixture set covering MOD, XM and S3M loads and plays through v2, and offline renders match v1's within a documented tolerance, with any divergence recorded before more migration proceeds. High-frequency audio scheduling never runs through the UI store.
- **PORT-003 — Editing parity:** pattern editing, cursor and block selection, clipboard, and a 100-step undo behave as v1 does, over a document model that is not the UI state store.
- **PORT-004 — File parity:** the formats v1 reads and writes today are read and written, detected the same way, including the container formats.
- **PORT-005 — Delivery parity:** the result still runs from static source with no build, still bundles into one entry plus lazily loaded features, and still adds no runtime dependency. Startup request count and first-interactive time are measured, not assumed.
- **PORT-006 — Nothing regresses:** v2's existing guarantees hold throughout. Diagnostics stay warnings, a half-authored application still renders, the workbench keeps working on a static host, and the outline stays a development artifact rather than a runtime requirement.

## Decisions and assumptions

- **The order is driven by dependency, then by risk, then by visible value.** Where those conflict, the earlier package is the one that unblocks more later work.
- **Playback moves early**, ahead of the UI machinery it does not need. It is the highest-risk unknown (about 54 effect branches, a WAAClock scheduling model, and circular imports between `tracker.js`, `audio.js`, `editor.js` and `ui/`), it is independent of layout and interaction work, and it is the strongest evidence that the architecture holds. A transport of plain buttons already exists to drive it.
- **`player/src` is the reuse candidate, not `script/src`.** It is 5,593 lines, has no UI imports, and is already a playback-only subset. `script/src/tracker.js` imports `ui/stateManager.js` and `ui/ui.js`, and `script/src/audio.js` creates an `AudioContext` at module-import time, so lifting those directly would drag the UI singleton graph across the seam.
- **The song document never enters the state store.** v1's patterns are arrays of note objects per row and channel, six to twenty thousand per song, and modules on disk reach 15 MB. The store keeps the handful of scalars the UI binds to, exactly as v1's split already works in practice.
- **Specialized components are a contract, not an exception.** The pattern grid, waveform and arrangement views get a declared component type, a model accessor and a viewport, and they draw their own pixels. What they must not do is appear as thousands of generic nodes, or put song data in the outline.
- **No package is allowed to introduce a runtime dependency.** Where v1 uses vendored code (zip, WAAClock, lamejs from a CDN), the port either adapts it with recorded provenance or drops the feature and says so.

## Open decisions

Resolved by the author on 2026-09-11. Kept here, in the past tense, as the record of what was decided and why it matters to the packages that scope on it.

1. **Visual fidelity — a smaller authored skin.** Not all 10 fonts and ~113 sprites; a reduced, authored skin is acceptable while the structure lands, revisited later if full fidelity turns out to matter. Changes P5's size downward from the "exact fidelity" assumption every prior spec was built under.
2. **The DOM renderer — deferred until after editing parity.** Confirms the prior assumption. P12 stays optional and stays after P5; it is reconsidered once editing (P6/P7) lands, not before.
3. **Plugins — sample editor and Nibbles port; the generator waits.** Widens the prior "sample editor only" assumption. Scopes P10 (plugin path) and P11 (specialized surfaces) to include Nibbles alongside the sample editor; the generator remains later-or-never.
4. **The server API — kept as is.** Confirms the prior assumption. `api/` stays; v2 talks to the same existing endpoints. Scopes P9.
5. **MP3 export — a vendored encoder is accepted.** Reverses the prior "dropped" assumption. A bundled (no-CDN) MP3 encoder is acceptable, so MP3 export stays in scope for P9's write path, provided it introduces no runtime (network) dependency, matching PORT-006 and the no-CDN rule.
6. **Amiga host integrations — out of scope.** Confirms the prior assumption. `hosts/AmiBase` and the `HostBridge` probe are not ported.
7. **The sample editor's hiss-reduction panel — permanently out of scope, resolved by the user on 2026-09-14.** Narrows decision 3's own "sample editor... ports" to exclude this one sub-feature specifically. `script/plugins/sampleeditor/hissReductionPanel.js` (443 lines, read in full by spec 040's own research pass) is not a later spec's own work-in-waiting - it is not planned at all. Every prior spec that named it (040, 042, 043, 045, 046) recorded it as "deferred" or "a later spec's own," which was accurate at the time each was written; this decision supersedes that framing going forward without rewriting those specs' own historical text. P10's own stated acceptance for the sample editor is met without it: DSP operations (040), the waveform view (041), the screen (042), the loop creator (043-045) and the resample panel (046) are all real and reachable.
8. **MP3/WAV whole-song export — permanently out of scope, resolved by the user on 2026-09-15.** Reverses decision 5 above (which had itself reversed an earlier "dropped" call to "a vendored encoder is accepted"): the whole-song render pipeline behind v1's own module-save "wav"/"mp3" options (`BassoonProvider.renderFile`, a server-side `storage/render`→`storage/convert`→`storage/wavtomp3` chain - confirmed by spec 067's own research to be a real render pipeline, not the vendored-encoder shape decision 5 had assumed) is not planned at all, in any form. Narrows P9's own stated acceptance: "Save and export produce files v1 can read" no longer includes MP3/WAV. Every prior spec that named this as unallocated (033, 034, 037, 038, 064, 065, 067) recorded it accurately for when it was written; this decision supersedes that framing going forward without rewriting those specs' own historical text.
9. **Dropbox as a save/load target — permanently out of scope, resolved by the user on 2026-09-15.** Every prior spec that recorded Dropbox as deferred (034, 037, 038, 064, 065, 067) cited the same real reason - its OAuth redirect URI is hardcoded to the original author's own domain, a hosting/product decision, not a porting detail - and each called it "a later spec." It is not a later spec's own work-in-waiting; it is not planned at all. Narrows P9's own scope: the browser's own download is the only save target this port will ever have, and Bassoon/HippoPlayer/ModArchive/Modules.pl/the local snapshot remain the only load sources.

## Scope boundaries

In scope: the ordered work packages in [design.md](design.md), each becoming its own spec.

Out of scope for the whole programme: the old builds under `player/old/`, the `api/import/` scrapers and their caches, the standalone `plugins/filters/stereoExpander` experiment, `plugins/screen.js`, `plugins/stats.js`, the games unless decision 3 says otherwise, and any attempt to run v1 and v2 UI code in the same page.
