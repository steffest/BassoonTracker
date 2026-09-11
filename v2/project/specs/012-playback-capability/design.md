# 012 — Design

## Layout

```
v2/domain/playback/
  README.md      provenance: every adapted file, every divergence, and why
  index.js       the capability: the only module anything outside may import
  scheduler.js   the v2-native lookahead clock that replaces WAAClock
  engine/        player/src, adapted
    tracker.js  audio.js  enum.js  eventBus.js  filesystem.js
    audio/{filterChain,synth}.js
    fileformats/{detect,protracker,soundtracker,fasttracker,screamtracker}.js
    models/{note,instrument,sample}.js
```

`v2/capabilities.js` maps `transport.toggle` to `./domain/playback/index.js`. Everything else about the build, the emitter and the generated app is already in place from spec 007: the generated action module imports the mapped export and delegates, and the command stops being listed as a mock.

## The capability API

```js
export async function transportToggle(app)   // the command the YAML action resolves to
export async function loadModule(app, url)   // load without playing
export function playbackState()              // { status, title, position, pattern, bpm }
```

`app` is the context spec 007 defined: `{ state, feature, log }`. The capability:

1. Creates the `AudioContext` on first call and never before, because the first call is a click.
2. Initialises the engine once, then loads the initial module if none is loaded.
3. Toggles play and stop.
4. Publishes scalars to `app.state`: `playback.status`, and, where the application binds them, `song.title`, `playback.position` and `playback.bpm`.

Publishing is throttled to actual changes. The engine's own position tracking already works by writing timestamped states into a ring that the caller samples, which is how v1 keeps the audio clock out of the UI; the capability samples it from the renderer's existing state-change path rather than pushing per note.

## The scheduler

`tracker.js` uses exactly four things from WAAClock: construction with a context, `start`/`stop`, `setTimeout(callback, delay)` returning an event that carries `deadline` and offers `repeat(delay)`, and `timeStretch(now, [event], ratio)` on a tempo change. `v2/domain/playback/scheduler.js` provides those over a plain timer that watches `context.currentTime`:

- an event holds its next `deadline` in audio-clock seconds and an optional repeat interval;
- a timer wakes often enough to fire any event whose deadline is within the lookahead tolerance, passing the deadline the engine expects;
- `repeat` changes the interval for the next firing, which is how the engine grows its lookahead from 0.2 s to 1 s after the first steps;
- `timeStretch` rescales a pending deadline, which is how a tempo change takes effect without rescheduling;
- a missed deadline is reported through a callback instead of v1's global event bus, so the throttling decision belongs to whoever owns the frame loop.

Note timing does not depend on the timer's precision. Every note, volume ramp, envelope point and effect is scheduled with `setValueAtTime`/`linearRampToValueAtTime` at an absolute audio-clock time computed inside the loop. The timer only has to run before the lookahead window empties.

## Divergences from `player/src`

Recorded in `domain/playback/README.md` next to the code, with the reason for each. Expected set, to be confirmed during the adaptation:

1. `audio.js` no longer creates an `AudioContext` at import or assigns `window.AudioContext`; `init(context, destination)` requires one.
2. `lib/waaclock.js` is gone; `tracker.js` imports `../scheduler.js`.
3. Anything else that prevents a headless import is removed rather than shimmed, and listed.

Everything else is byte-identical, so the port inherits the effect behaviour rather than reimplementing it.

## Observing playback in the UI

The application needs to show what is playing, and spec 010's P4 and P6 are far away. The smallest honest addition is a `field` property on the `label` type: the label draws the value of a state field instead of static text.

- `runtime/componentTypes.js`: `label` gains `field`, kind `reference`.
- `compiler/convert.js`: the value is carried onto the node, like `shortKey` and `color`.
- `renderers/canvas/mountGeneric.js`: a node with a `field` resolves its text from state before drawing; the redraw path already exists, because the renderer subscribes to any state change.
- `compiler/emit.js`: `field` is passed through to the generated node.

No new draw kind, no branch on a component type, and the registry test still passes. The status bar's existing label then binds `playback.status`, and a second one binds `song.title`.

## Fixtures and tests

Three small modules are copied into `v2/tests/fixtures/`, which keeps every v2 edit inside `v2`:

| fixture | why |
|---|---|
| `wizballalt.mod` (4 KB) | a 4-channel ProTracker module with instruments and effects |
| `sin-vibrato.mod` (2 KB) | small, and exercises a vibrato effect specifically |
| `sin.xm` (2 KB) | the FastTracker path: envelopes, a different note table |

- `tests/playback.test.js`: imports the engine in Node, loads each fixture, and asserts title, channel count, pattern count and shape, song length, instrument count and tempo. This is possible only because of divergence 1 and 2, and it is the first automated test of v1 behaviour that has ever existed on either side.
- `tests/scheduler.test.js`: drives the scheduler with a fake context whose `currentTime` the test advances, asserting first fire, repeat interval changes, time stretching, stop, and the missed-deadline report.

Browser acceptance adds one scenario: press Play in the application, assert the status flips and the position advances, then render a fixture offline and assert the buffer is non-silent, the right length, and identical across two runs.

## Risks

- **The engine may not survive the headless import for a reason not yet found.** Mitigated by finding out first: the import was already tried, and the two blockers above are what it reported.
- **Rewriting the clock is the one place audio behaviour could change.** Mitigated by the surface being four methods, by note timing being clock-timestamped independently of the timer, and by `tests/scheduler.test.js` pinning the semantics.
- **The engine's circular imports** (`tracker` and `audio` and `instrument` import each other) work today under ES modules because every use is inside a function. Copying them unchanged preserves that; reordering or "cleaning" them is what would break it, so the adaptation does not.
