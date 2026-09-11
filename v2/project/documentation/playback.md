# Playback

Status: implemented and verified 2026-09-10 (spec [012](../specs/012-playback-capability/requirements.md), package P2 of the [port roadmap](../specs/010-port-roadmap/requirements.md)). This is the first real capability behind the seam spec [007](../specs/007-release-build/requirements.md) built.

The generated application plays real modules. The authoring preview does not, on purpose.

## How it is wired

```
app.yaml            button, rule "highlighted when song playback is active", action toggleplay
  -> compiler       action binding: command transport.toggle, field playback.status
  -> capabilities.js  transport.toggle -> domain/playback/index.js#transportToggle
  -> app/actions/transportToggle.js   generated, delegates
  -> domain/playback/index.js         creates the context on the click, loads, plays
  -> domain/playback/engine/          the adapted v1 sequencer
```

Nothing about the YAML changed to make this work. The command the prose recipe generated was already `transport.toggle`; mapping it in `capabilities.js` is what replaced the generated mock. The same rule that lit the mock now lights the button from the real engine, because both name the same state field.

Only the generated app and the release bundle reach the capability. `app.html` and `preview-app.html` render the outline and dispatch mocks, so opening the workbench never starts an audio device and never loads a 68 KB sequencer.

## What crosses the boundary

The capability exposes four functions and publishes four scalars.

| function | what it does |
|---|---|
| `transportToggle(app)` | creates the audio context on first call, loads the initial module if none is loaded, then starts or stops |
| `loadModule(app, url)` | loads without playing |
| `playbackState()` | a snapshot: status, title, position, pattern row, track count, loaded URL |
| `createEngine(context)` | runs the engine against a caller-supplied context, for tests and harnesses |

| field | value |
|---|---|
| `playback.status` | `"playing"` or `"stopped"` |
| `song.title` | the module's title |
| `playback.position` | position in the song order |
| `playback.pattern` | row within the pattern |

A field is only published if the application declared it, which happens when something binds it. Nothing else about the engine is visible: the song, the instruments, the sample data and the schedule all stay inside.

## Timing

Audio timing never passes through the UI. The sequencer schedules whole steps ahead of the audio clock with absolute `setValueAtTime` times, and grows its lookahead from 0.2 to 1 second after the first steps. The capability samples the engine's timestamped state ring once per animation frame and publishes only what changed, which is the same split v1 uses. The store sees a row change a few times a second, never a note.

The lookahead clock is v2's own (`domain/playback/scheduler.js`), replacing the browserified WAAClock bundle v1 vendored. See the [capability's README](../../domain/playback/README.md) for why that is safe and what else diverges.

## Observing playback in the interface

A `label` may name a state `field` instead of static text, which is how the status bar shows the song title and playback status:

```yaml
- song title:
    type: label
    field: song.title
```

The field becomes part of the application's state automatically, so a capability has somewhere to publish to. This is the smallest addition that makes playback observable; the compact read-only transport the roadmap asked for. A field-bound label does not currently trigger a relayout when its text changes width, only a redraw.

## Testing it

Two suites, both in `node --test`, no browser required:

- `tests/playback.test.js` loads all three fixtures and asserts their musical facts: title, channels, pattern shape, song length, instruments, envelopes, effects present, tempo, and that playing schedules a batch of sources spanning the lookahead window with absolute times.
- `tests/scheduler.test.js` drives the clock against a fake context, pinning the deadline series, the growing lookahead, tempo stretching, stop and restart, late reporting and failure isolation.

Both exist only because the adaptation removed the import-time audio context and the vendored clock. Before that the engine could not be imported outside a browser at all, and v1 had no automated tests of any kind.

`domain/playback/silentContext.js` is the stub context they run against. It records every `start`, `stop` and parameter automation, so a test can assert on the schedule rather than on a rendered waveform.

## Known limits

The engine keeps v1's console logging on load. The song document is still private to the engine until roadmap package P6. Only the module read path is ported: writing, sample formats, containers and remote sources are P9, recording and MIDI are unported, and MP3 export is dropped because it needs a CDN-fetched encoder. The initial module is the bundled demo under `assets/demo/` until file operations arrive.

The parity comparison against v1's own engine, roadmap package P13, is not done: this package establishes that the engine runs and is testable, not yet that it renders identically to v1.
