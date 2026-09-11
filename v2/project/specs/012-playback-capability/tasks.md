# 012 — Implementation

Status: implemented and verified 2026-09-10.

- [x] Confirmed the reuse candidate before copying anything: `player/src`'s whole module graph is self-contained, has no UI imports, and its audio entry already accepts an injected context. The headless import was attempted first, and the two blockers it reported are the two divergences below.
- [x] Copied the 15 engine files into `domain/playback/engine/` with provenance recorded in `domain/playback/README.md`.
- [x] Divergence 1: no audio context at module import, no patching of the global constructor name.
- [x] Divergence 2: `domain/playback/scheduler.js` replaces the browserified WAAClock bundle.
- [x] `domain/playback/index.js`: the capability, the only module anything outside may import.
- [x] `domain/playback/silentContext.js`: a stub context so the engine runs headless and a test can assert on the schedule.
- [x] `capabilities.js` maps `transport.toggle`; `emit.js` gained a media base and `build.mjs` copies the demo module into the bundle.
- [x] A `label` may bind a state `field`, and that field becomes part of the application's state; the status bar binds the title and the status.
- [x] Fixtures, unit tests, browser acceptance, documentation.

## Evidence

`node --test "v2/tests/*.test.js"`: 127 tests, 125 passing, 2 skipped, up from 111. Sixteen new tests in two files, both running in plain Node with no browser:

| suite | what it pins |
|---|---|
| `tests/playback.test.js` (7) | each fixture's title, channels, pattern shape, song order length, instruments and sample data; XM envelopes and the FastTracker note table; the vibrato effect surviving in pattern data; loading a second module replacing the first and rewinding; playing scheduling a batch of sources that spans the lookahead window at absolute times; automation written with absolute-time methods; tempo readable and settable |
| `tests/scheduler.test.js` (9) | first firing and the deadline it carries; a repeat series that does not drift when a firing is late; the sequencer's growing lookahead; `timeStretch` on a tempo change; stop then restart; clearing one event; the missed-deadline report; a failing step isolating itself; due events firing in deadline order |

Browser, 17 checks in one new scenario, all passing:

| check | result |
|---|---|
| startup | neither the engine nor the demo module is requested; the capability reports nothing loaded |
| first click | loads `assets/demo/wizballalt.mod` and plays; the engine reports 4 tracks and the title "wizball" |
| lazy loading | the engine arrives as one chunk on that click, 18 modules including the four format loaders |
| real audio | the context is running at 48 kHz and the master output carries signal, peak 1.05 and rms 0.52 |
| position | the pattern row advances from 11 to 21 over 1.2 s |
| the button | draws its active artwork while really playing: green-over-blue goes from -13 stopped to 0 playing |
| the status bar | a field-bound label draws the title and the status |
| second click | stops, keeping the module loaded |
| the authoring preview | never requests the engine or the module, and dispatches the mock instead |
| hygiene | nothing thrown, every request succeeded |

The other seven browser scenarios and all three build targets were re-run unchanged. The bundle entry stays at 41.6 KB and the engine is a separate 68 KB chunk fetched on first activation.

## Found while building

- **The position cursor never advanced.** The sequencer schedules ahead of the clock and records timestamped states; in v1 the frame loop decides which one is "now" and pushes it back into the engine. The capability had been publishing to the store without doing that, so the engine's own position stayed at row 0 and anything reading it, including the future pattern grid, would have too. The observer now advances the engine as v1's loop does.
- **v1 divides 8-bit sample data by 127, not 128.** Values reach 1.008 and Web Audio clamps the difference, which shows up as a 1.05 peak at the master output. Asserted as observed rather than "fixed": this is the behaviour the port has to reproduce, and changing it would be a musical change dressed up as a rounding fix.
- **The scheduler's first version advanced the deadline before calling back.** The sequencer reads `event.deadline` to compute its lookahead window, so it saw the *next* deadline and scheduled a window that had already passed. Caught by the scheduler tests before it ever reached the browser.
- **A field-bound label needed to register its field.** Otherwise the capability publishes into a store that rejects unknown fields and the label stays empty forever. The emitter now adds it to the application's state.

## Known limits

The offline render comparison against v1's own engine is **not** done; it is roadmap package P13, which now says so explicitly. This package establishes that the engine runs, is bounded, and is testable, not that it is sample-identical to v1.

The engine keeps v1's console logging on load. The song document is still private to the engine until P6. Only the module read path is ported; writing, sample formats, containers and remote sources are P9. Recording and MIDI are unported, and MP3 export is dropped because it needs a CDN-fetched encoder, which v2 forbids. The initial module is the bundled demo until file operations arrive. A field-bound label redraws but does not relayout when its text changes width.
