# 033 — Settings and favorites: the persistence capability

Date: 2026-09-11. Kind: feature. Status: specified. Opens package **P9** (persistence, providers, file operations) of the [port roadmap](../010-port-roadmap/requirements.md), following P8's closure (spec 032).

## Purpose

P9 as a whole ([design.md](../010-port-roadmap/design.md)) bundles four different things: a settings capability, favorites, five remote providers behind one interface, the disk-operation screens, and the format write path (including MP3 export). That is too much for one spec to verify at once, the same way P4, P5 and P6 each split into several specs when they were started.

This spec takes the smallest independent, load-bearing slice: **local persistence of user preferences**. It needs no new component type, no provider interface, no format writer and no disk-operation screen — every control it wires already exists, authored in `optionsPanel.yaml` and `controlBar.yaml` since spec 026, and is already listed in `app/LOOSE-ENDS.md` as a `GENERATED MOCK` with nowhere to persist to. Of P9's stated acceptance ("settings survive a reload"), this spec delivers exactly that clause; the other two ("a module loads from each provider", "exports are readable by v1") are later specs' acceptance, not this one's.

## What v1 actually does (read from source, not assumed)

- **`script/src/settings.js` persists fourteen keys, not thirteen** (design.md's inventory undercounts by one): `vubars`, `stereoSeparation`, `dropboxMode`, `skipFrame`, `midi`, `highDPI`, `showKey`, `showMidi`, `useTooltip`, `playFrom`, `showSideBar`, `showAppPanel`, `showPiano`, `patternViewMode`. All read/written as one JSON blob under the single `localStorage` key `bassoonTrackerSettings`, through a two-function `script/src/storage.js` wrapper (`get`/`set`, no other abstraction).
- **Startup applies UI state fifty milliseconds after reading it**, on a bare `setTimeout` (`settings.js:19`), because `readSettings()` runs before the widgets it configures (sidebar, app panel, piano, pattern-view orientation) have been constructed. `applyUIState()` sets an `isApplyingUI` reentrancy flag for its whole duration so its own side effects don't re-trigger a save.
- **Saving is per-event, not batched.** `saveSettings()` (writing all fourteen keys every time) is called from five separate listeners: `EVENT.appLayoutChanged` (sidebar), `COMMAND.toggleAppPanel` (app panel, itself debounced by a 10ms `setTimeout` to let the panel finish toggling first), `EVENT.toggleView` for `"piano"`, and `EVENT.showView` for `"multitrack"`/`"main"` (pattern-view orientation) — plus every options-panel control calling it directly after mutating `SETTINGS` itself (see `script/src/ui/optionsPanel.js`, one `Settings.saveSettings()` call per control).
- **Corrupt or missing storage falls back to defaults silently**: `JSON.parse` is wrapped in a `try/catch` that sets `settings = undefined` on failure, and `set(undefined)` still runs `setDefaults()` first.
- **`script/src/models/favorites.js` is a second, independent `localStorage` key (`favorites`)**, a plain array of `{url, title}`, not part of the settings blob. Toggling reads `Tracker.getCurrentUrl()`/`getSong()` for the entry to add — it depends on a loaded song, unlike settings. `getPlaylist()` wraps it as a playlist object with a three-line placeholder (`"No favorites yet...", "Press the heart icon", "to add one!"`) when empty. `script/src/filesystem.js` special-cases the URL `/favorites.pls` to return this playlist directly, bypassing the network fetch every other URL goes through.
- **One options-panel control is not a persisted setting at all.** "Frequency table" (Linear / Amiga periods) reads and writes `Tracker.useLinearFrequency` directly (`script/src/ui/optionsPanel.js:121`), which is live per-loaded-song engine state that the format loader itself sets (`protracker.js` sets it `false`, `fasttracker.js` sets it `true`) and the user can override for the current song only. It is never part of the `SETTINGS` object `saveSettings()` writes, so it does not survive a reload in v1 either. This belongs with a playback/song-format capability, not this one.

## v2 today

`app/state.js`'s `INITIAL_STATE` and `app/LOOSE-ENDS.md` already carry thirteen fields matching this territory, each still a `GENERATED MOCK` action (per spec 007's policy: unmapped commands cycle their own state field and nothing else). Twelve map one-for-one to a v1 settings key; the thirteenth (`frequency-table.value`) is the live-engine control above and is explicitly out of scope here.

| v2 state field | command(s) | v1 settings key |
|---|---|---|
| `vu-bars.value` | `vu-bars.set` | `vubars` |
| `help-bubbles.active` | `help-bubbles.toggle` | `useTooltip` (v1's own control label is "Show Help Bubbles"; the internal variable name is the only thing that diverges) |
| `stereo-separation.value` | `stereo-separation.set` | `stereoSeparation` |
| `show-key-input.active` | `show-key-input.toggle` | `showKey` |
| `screen-refresh.value` | `screen-refresh.set` | `skipFrame` (spec 032 already made this a **real, live** capability against `domain/playback/`; it is just not persisted across a reload yet) |
| `high-dpi.active` | `high-dpi.toggle` | `highDPI` (spec 032 already made the *renderer* read this field for real; the toggle command itself is still the generated mock, which is sufficient behavior — it only needs persistence) |
| `dropbox-mode.value` | `dropbox-mode.set` | `dropboxMode` |
| `midi-input.value` | `midi-input.set` | `midi` |
| `show-midi-input.active` | `show-midi-input.toggle` | `showMidi` |
| `play-from.value` | `play-from.set` | `playFrom` |
| `editor-layout.value` | `editor-layout.set` | `patternViewMode` (`"vertical"`/`"horizontal"`) |
| `piano.active` | `piano.toggle` | `showPiano` |
| `frequency-table.value` | `frequency-table.set` | *(none — see above; deliberately excluded)* |

`showSideBar` and `showAppPanel` have no authored v2 field or control yet at all (no sidebar-visibility or app-panel-visibility binding exists in `app.yaml`/`controlBar.yaml` today), so there is nothing in v2 to wire them to. Recorded as deferred, not silently dropped.

## Decisions and assumptions

- **Where it lives.** `domain/settings/`, a sibling to `domain/playback/` and `domain/song/`, following the same convention: one `index.js` boundary, a `README.md` recording provenance, pure sub-modules unit-testable without a browser. Favorites lives alongside it (`domain/settings/favorites.js`) rather than in its own top-level domain folder — it is small, `localStorage`-backed, and does not justify a second capability boundary — but it is documented as its own module because, unlike the settings blob, it reads the current song (a real dependency on `domain/song`/`domain/playback` that plain settings does not have).
- **Twelve keys, not fourteen.** `frequency-table.value` is excluded per the finding above. `showSideBar`/`showAppPanel` are excluded because no v2 control exists to bind them to yet; adding one is a UI-authoring change outside a persistence spec's scope, not a persistence decision.
- **No fifty-millisecond race.** `app/state.js`'s `INITIAL_STATE` is already built synchronously at store construction, before first render. `domain/settings/index.js` reads `localStorage` synchronously too, so the generated store can seed these twelve fields from the persisted blob at construction time with no `setTimeout` — a real, incidental improvement over v1, not a re-litigation of a user-visible behavior (nothing about the fifty-millisecond delay was ever observable to a user; it existed only because v1's widgets weren't finished constructing yet).
- **Save on every change, one key at a time is fine.** v1 always rewrites the whole fourteen-key (here: twelve-key) blob per change, from whichever call site changed one field. `domain/settings/index.js` keeps that shape (`setSetting(key, value)` reads the current blob, updates one key, writes the whole blob back) rather than introducing per-key storage, since nothing about the port needs finer granularity and the existing generated action modules already call one command per change.
- **Each of the twelve mock actions becomes a real capability module**, replacing the `GENERATED MOCK` behavior with a call into `domain/settings/index.js` that both updates the bound state field (so the already-authored UI keeps working unchanged) and persists it — mirroring how `domain/playback/index.js` already services multiple commands (`transportToggle`, `setScreenRefresh`, `openFiles`) from one module.
- **Favorites are implemented headless, even with no playlist screen to display them yet.** The disk-operation/provider screens that would browse a "Favorites" playlist are P9's own later spec, per design.md. This mirrors spec 028's precedent: it built pattern-editing mutations before the pattern grid (P7) existed to display them. Verifying `isFavorite`/toggle/list against a stub "current song" reference needs nothing from that later spec.

## User stories and acceptance

- **SET-001 — Settings load before first paint, with no race.** As a user reopening the tracker, every one of the twelve settings-backed controls shows its last saved value on the very first render, not after a delay. Acceptance: seed `localStorage` with a non-default value for each of the twelve keys, load the generated app, and confirm the corresponding control's initial state matches — checked headlessly against `domain/settings/index.js` plus the generated store's initial read, since no browser is available in this environment (see Non-functional requirements).
- **SET-002 — The twelve mock commands become real and persist.** `vu-bars.set`, `help-bubbles.toggle`, `stereo-separation.set`, `show-key-input.toggle`, `screen-refresh.set`, `high-dpi.toggle`, `dropbox-mode.set`, `midi-input.set`, `show-midi-input.toggle`, `play-from.set`, `editor-layout.set`, `piano.toggle` are mapped in `capabilities.js` to `domain/settings/index.js`. Acceptance: each, invoked through its action module, updates its state field (unchanged observable behavior) and writes the change to `localStorage` under `bassoonTrackerSettings`; a second `domain/settings/index.js` instance constructed against the same storage reads the new value back. `app/LOOSE-ENDS.md` no longer lists these twelve as `GENERATED MOCK` after a rebuild.
- **SET-003 — Corrupt or missing storage falls back to defaults, exactly as v1 does.** Acceptance: a unit test seeds `localStorage` with invalid JSON under `bassoonTrackerSettings` and confirms `domain/settings/index.js` returns the documented defaults for all twelve keys rather than throwing, matching `settings.js`'s `try/catch` fallback.
- **SET-004 — Favorites: toggle, list, and the empty-state placeholder.** `domain/settings/favorites.js` exposes add/remove-by-toggle (keyed on a song URL), `isFavorite(url)`, and a playlist-shaped `getPlaylist()` with v1's exact three-line placeholder when empty. Acceptance: a unit test toggles a stub URL on and off, confirms `isFavorite` and the persisted list agree at each step, and confirms `getPlaylist()`'s placeholder text matches v1's when the list is empty.
- **SET-005 — No regressions.** Acceptance: the full unit suite passes; `node build.mjs app`/`dist` succeed unchanged (no compiler, YAML, or new component-type change is in scope); nothing outside `domain/settings/` reads or writes the `bassoonTrackerSettings` or `favorites` `localStorage` keys directly, checked by the same grep-based boundary-test convention `domain/song/` and `domain/playback/` already use.

## Non-functional requirements

- Follows the existing `domain/*/README.md` convention: one `index.js` boundary per capability, provenance recorded, pure sub-modules independently testable without a loaded song or a DOM.
- No new component type, no renderer change, no compiler change — pure capability plus generated action wiring, the same shape spec 032's `screen-refresh` capability already used.
- Headless verification only, for the same recorded reason as specs 012 and 019–032: no browser-automation dependency exists in this environment.

## Scope boundaries

In scope: `domain/settings/index.js` (the twelve-key persisted schema, defaults, get/set/reset), `domain/settings/favorites.js` (toggle/list/`isFavorite`/`getPlaylist`), a `domain/settings/README.md`, the twelve capability-module mappings in `capabilities.js` and their now-real action bodies, a grep-based boundary test, and unit tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **The five remote providers** (own API, ModArchive, modules.pl, HippoPlayer, Dropbox) behind one interface — a later spec; `script/src/provider/*.js` were read during this spec's research only to confirm `dropboxMode` is the one settings key a provider consumes, not to scope provider work here.
- **The disk-operation screens** (load/save, provider browsing, a playlist/favorites listing) authored in YAML — depend on the provider interface above and on component types (a browsable tree/list) this spec does not add.
- **The format write path** (XI, WAV, the playlist formats PLS/M3U/JSON, the container formats zip/gzip) and **MP3 export** — later specs, once the disk-operation screens exist to trigger them. MP3 is noted for that spec's research, not this one: v1's own "MP3 export" is not a vendored client-side encoder at all — it round-trips through `api/`'s server-side `lame.exe` (`provider/bassoon.js#renderFile`, `api/render/`), which is why design.md's open decision 5 (a vendored, no-CDN encoder) is a deliberate *change* from v1's behavior, not a port of it.
- **`frequency-table.set`** — not a persisted setting (see "What v1 actually does"); belongs with a playback/song-format capability.
- **`showSideBar`/`showAppPanel` persistence** — no v2 field authors these controls yet.
