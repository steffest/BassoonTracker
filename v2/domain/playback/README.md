# Playback capability

The adapted v1 sequencer, behind one boundary. Spec [012](../../project/specs/012-playback-capability/requirements.md), package P2 of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md).

```
index.js          the capability: the only module anything outside may import
scheduler.js      the lookahead clock (v2 code)
silentContext.js  a stub audio context for headless use (v2 code)
engine/           the adapted engine (v1 code)
```

## The boundary

Only `index.js` may be imported from outside this folder. Nothing in `runtime/`, `renderers/`, `compiler/` or `workbench/` imports anything under `engine/`, and the engine imports nothing from them.

The engine keeps its v1 shape on purpose: module-private singletons, its own small event bus, a mutable settings object, and circular imports between `tracker.js`, `audio.js` and `models/instrument.js` that work because every use is inside a function. Rewriting a working sequencer is not what this package was for. What crosses the boundary is four functions and four scalars.

`capabilities.js` maps `transport.toggle` here, so only the **generated application** reaches it. The authoring preview keeps its mock, because opening the workbench should not start an audio device.

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
3. **Nothing else.** No shims, no guards, no reordering. The circular imports are preserved exactly, because reordering them is what would break them.

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
- The song document lives inside the engine, reachable only through it. Package P6 of the roadmap gives it an explicit model and an editing layer.
- Only the read path for MOD, SoundTracker, XM and S3M comes with this package; writing, sample formats, containers and remote sources are P9.
- Recording, offline export and MIDI are not ported. MP3 export is deliberately dropped: it needs an encoder fetched from a CDN, which v2's constraints forbid.
- The initial module is the bundled demo under `assets/demo/`, until file operations arrive with P9.
