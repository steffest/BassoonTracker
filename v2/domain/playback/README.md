# Playback capability

The adapted v1 sequencer, behind one boundary. Spec [012](../../project/specs/012-playback-capability/requirements.md), package P2 of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md).

```
index.js          the capability: the only module anything outside may import
scheduler.js      the lookahead clock (v2 code)
silentContext.js  a stub audio context for headless use (v2 code)
engine/           the adapted engine (v1 code)
```

## The boundary

Only `index.js` may be imported from outside this folder - with two documented exceptions. `domain/song/` (spec 028, package P6) imports `Tracker`/`Note` straight from `engine/`, because pattern editing has to mutate the exact song object the scheduler reads from, not a copy; `domain/song/README.md` records the same exception from its side. `domain/moduleExport/` (spec 037, package P9) imports `Tracker` the same way, for the same reason: the exported bytes have to come from the exact song/instrument objects the engine holds; `domain/moduleExport/README.md` records it too. Nothing else - `runtime/`, `renderers/`, `compiler/`, `workbench/`, the generated `app/` - imports anything under `engine/`, and the engine imports nothing from them. `tests/domainBoundary.test.js` checks this mechanically.

The engine keeps its v1 shape on purpose: module-private singletons, its own small event bus, a mutable settings object, and circular imports between `tracker.js`, `audio.js` and `models/instrument.js` that work because every use is inside a function. Rewriting a working sequencer is not what this package was for. What crosses the boundary is four functions and four scalars.

`capabilities.js` maps `transport.toggle` here, so only the **generated application** reaches it. The authoring preview keeps its mock, because opening the workbench should not start an audio device.

Spec 033's own one documented exception, in the other direction: `setScreenRefresh` here calls `domain/settings/index.js#persistSetting` directly, rather than that folder duplicating this module's own label-to-index translation table. See `domain/settings/README.md`.

Spec 034 adds a second: `loadModule` calls `domain/providers/index.js#fetchModuleUrl` instead of a bare `fetch()`, so a module URL retries through the v2 API's CORS proxy on a network-level failure, matching `script/src/filesystem.js#loadFile`'s own retry. See `domain/providers/README.md`.

## Provenance

`engine/` is copied from `player/src` in the parent BassoonTracker repository (same repository, MIT), which is the playback-only subset: 16 files, no UI imports. It was preferred over `script/src`, whose `tracker.js` imports `ui/stateManager.js` and `ui/ui.js`.

| file | origin |
|---|---|
| `engine/tracker.js` | `player/src/tracker.js` (the sequencer, effects, song model) |
| `engine/audio.js` | `player/src/audio.js` (Web Audio graph, sample playback, period maths) |
| `engine/enum.js`, `eventBus.js`, `filesystem.js` | same names under `player/src` |
| `engine/audio/{filterChain,synth}.js` | `player/src/audio/` |
| `engine/fileformats/*.js` | `player/src/fileformats/` (detect, ProTracker, SoundTracker, FastTracker, ScreamTracker) |
| `engine/models/*.js` | `player/src/models/` (note, instrument, sample) |

Everything else in this folder is v2 code.

## Divergences from the original

Three, each with its reason. Everything else is byte-identical, so the port inherits the effect behaviour rather than reimplementing it.

1. **`engine/audio.js` no longer creates an audio context at module import**, and no longer patches the global constructor name. `init(context, destination)` requires the caller's context. The original took an audio device the moment it was imported, which browsers increasingly refuse and which made the engine unimportable outside a browser.
2. **`lib/waaclock.js` is gone.** `engine/tracker.js` imports `../scheduler.js` instead. The original was a browserified third-party bundle that referenced the window object at import and had been patched to emit on v1's event bus. The replacement implements the four things the sequencer actually uses, and reports a missed deadline through a callback rather than a global event.
3. **Nothing else changes behaviour.** No shims, no guards, no reordering. The circular imports are preserved exactly, because reordering them is what would break them.

One small, additive-only extension, not a fourth divergence (nothing about existing behaviour changes): spec 038 added `engine/tracker.js#getBPM`/`getAmigaSpeed`, two one-line getters for state the engine already privately tracks (`bpm`, `ticksPerStep`) but never exposed - `player/src` never needed to read them back out; `script/src/tracker.js` already has both, ported verbatim, for `domain/moduleExport`'s own XM writer, which has to write the song's current tempo/speed into the file header.

## Why replacing the clock is safe

The clock decides *when the scheduling loop runs*, not when notes sound. Inside that loop every note, volume ramp, envelope point and effect is scheduled with `setValueAtTime` and `linearRampToValueAtTime` at an absolute audio-clock time. The timer only has to run before the lookahead window empties, and the window grows from 0.2 to 1 second after the first steps. `tests/scheduler.test.js` pins the semantics the sequencer depends on, including that a deadline series does not drift when a firing is late.

## Headless use

`silentContext.js` is enough of a `BaseAudioContext` for the engine to load a module, build its graph and schedule a batch without making a sound, and it can record the parameter automation so a test can assert on the schedule. That is what makes `tests/playback.test.js` possible: the first automated tests this engine has ever had on either side of the project.

```js
import { createSilentContext } from "./silentContext.js";
import { createEngine } from "./index.js";

const context = createSilentContext({ recordAutomation: true });
const { Tracker } = createEngine(context);
await Tracker.processFile(buffer, "song.mod");
Tracker.playSong();
context.advance(0.3);        // the scheduler fires against this clock
```

## Known limits

- The engine keeps v1's console logging while loading a module, so the application console is chatty on first Play.
- The song document still lives inside this engine - `domain/song/` (spec 028) is an explicit editing API onto the same object, not a second copy. Selection and clipboard, the rest of package P6, are a later spec.
- Only the read path for MOD, SoundTracker, XM and S3M comes with this package; writing, sample formats, containers and remote sources are P9.
- Recording, offline export and MIDI are not ported. MP3/WAV whole-song export is permanently out of scope - the port roadmap's own open decision 8 (2026-09-15) - alongside Dropbox as a save target (open decision 9); see `domain/providers/README.md` and `domain/moduleExport/README.md`.
- The initial module is the bundled demo under `assets/demo/`, until file operations arrive with P9.
