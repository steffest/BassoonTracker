# 012 — Playback as the first real capability

Date: 2026-09-10. Kind: feature. Status: specified. Implements package **P2** of spec [010](../010-port-roadmap/requirements.md), the port roadmap, and fills the capability seam spec [007](../007-release-build/requirements.md) built and left empty.

## Purpose

v2 has a transport that toggles a mock field. This spec makes it play music.

It is first in the port order because it is the largest unknown and the most independent piece of work: it needs no layout, interaction, document-model or renderer change, and it is the only package that can invalidate the architecture. Doing it now means reacting to that is still cheap.

## What is being adapted

`player/src` in the parent repository: 16 files, 5,593 lines, a playback-only subset with no UI imports and no DOM use beyond one line. It is the reuse candidate spec 010 named, in preference to `script/src`, whose `tracker.js` imports `ui/stateManager.js` and `ui/ui.js`.

Verified before adapting: the engine's whole module graph is self-contained, and its audio entry already accepts an injected context (`Audio.init(audioContext, destination)`). Two things stop it running outside a browser, and both are removed rather than worked around.

| blocker | v2 divergence |
|---|---|
| `audio.js` creates an `AudioContext` at module-import time and assigns `window.AudioContext` | removed; `init(context)` requires the caller to supply one, created on a user gesture |
| `lib/waaclock.js` is a browserified third-party bundle that touches `window` at import and is patched to emit on v1's event bus | replaced by a v2-native scheduler with the same four-method surface |

The second is the only rewrite. It is safe because the clock decides *when the scheduling loop runs*, not when notes sound: every note, effect and envelope is scheduled with `setValueAtTime` against the audio clock inside that loop. It also removes v2's dependence on a 14 KB vendored bundle and makes the whole engine importable in plain Node, which is what gives this package real unit tests.

## User stories and acceptance

- **PLAY-001 — A real module plays:** As a user, pressing Play on a loaded module plays it, and pressing it again stops it. Acceptance: a MOD and an XM fixture each play through the existing transport button; an offline render of a fixture is non-silent, has the expected duration and is deterministic across runs.
- **PLAY-002 — The capability seam carries it:** As a developer, playback arrives through `capabilities.js` and nothing else changes. Acceptance: the generated action module delegates to the capability instead of being a mock; `v2/app/LOOSE-ENDS.md` no longer lists `transport.toggle` as mocked; nothing under `script/src` or `player/src` is imported at runtime; the compiled outline is unchanged.
- **PLAY-003 — Audio timing is separate from the UI:** As a developer, no audio scheduling passes through the state store or the renderer. Acceptance: the store receives only scalars, and it receives them at most once per state change, not once per scheduled note; the audio context is created on the first user gesture, not at import; changing the skin, resizing or reloading the outline does not recreate the context or restart playback.
- **PLAY-004 — The UI observes playback:** As a user, the status bar shows what is playing. Acceptance: an authored label binds a state field and shows the song title and playback status, updating as they change, with no new hardcoded coordinates and no renderer branch on a component name.
- **PLAY-005 — The engine is testable without a browser:** As a developer, module loading and sequencing are unit-tested in Node. Acceptance: fixtures load and their pattern data, instruments, tempo and length are asserted; the scheduler's timing logic is tested against a fake clock; both run in the existing `node --test` suite.
- **PLAY-006 — Provenance is recorded:** Acceptance: every adapted file is listed with its origin, and each divergence from the original is documented with its reason.

## Decisions

- **The engine's internals stay v1-shaped.** It keeps its module-private singletons, its own small event bus and its mutable `SETTINGS` object. Rewriting a working sequencer is not what this package is for; the seam is. What crosses the seam is a small v2-native API and scalars.
- **Only the capability may import the engine.** `v2/domain/playback/index.js` is the public entry. Nothing in `runtime/`, `renderers/`, `compiler/` or `workbench/` imports anything under `engine/`.
- **The song document stays inside the capability for now.** Spec 010's P6 gives it an explicit model and an editing layer; until then the engine owns it privately, exactly as v1 does, and the UI sees scalars.
- **Effects come with the adaptation, not after it.** The roughly 54 effect branches are part of the file being adapted; excluding them would mean forking the sequencer.
- **MP3 export is out.** It needs an encoder fetched from a CDN, which v2's constraints forbid (spec 010, open decision 5).

## Scope boundaries

In scope: the adapted engine, the v2 scheduler, the capability API, the `capabilities.js` mapping, a label field binding so the UI can show playback state, fixtures, unit tests and a browser acceptance run.

Out of scope: pattern editing and the document model (P6), the file *write* path and remote providers (P9), sample editing (P10), recording, offline export beyond what the parity harness needs, MIDI input, and any UI beyond binding a label. The parity comparison against v1's own engine is P13 and is started but not completed here.
