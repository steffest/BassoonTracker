# 033 — Design

## Overview

Two independent pieces, neither touching `domain/playback/engine/`:

1. **A new capability, `domain/settings/`**, owning a twelve-key persisted blob under the same `localStorage` key v1 used (`bassoonTrackerSettings`) and, as a second, independent key (`favorites`), the favorites list. Both go through one tiny storage abstraction (`storage.js`) so the module runs headless in plain Node, where no `localStorage` exists.
2. **A construction-time seed**, so the twelve fields read their persisted value before the very first paint, with no `setTimeout`. This is the one piece that needs a seam nothing before it needed: every prior capability (playback, song, screen-refresh) starts a field at a YAML-declared default and only *publishes* to it later, from a user gesture or a running engine. Settings has to *arrive* with a value already in place.

## Value semantics: a deliberate divergence from v1's own encoding

v1's `SETTINGS` object stores internal codes a radio group's index maps to (`vubars: "none"|"colour"|"trans"`, `dropboxMode: "rename"|"overwrite"`, `midi: "disabled"|"enabled-note"|"enabled"`, `playFrom: "start"|"cursor"`) that exist only inside `script/src/ui/optionsPanel.js`'s own `index === 0 ? ... : ...` translation at each control.

v2 never built that translation. `compiler/emit.js`'s generated mock for a `.set` command stores exactly `detail.value`, and a `radioGroup`'s `change` event (`renderers/canvas/mountGeneric.js:824-833`) carries `detail.value = node.definitionName || labelText(node)` — the clicked item's own authored label text (confirmed for `screen-refresh.set`'s real capability too: `domain/playback/index.js#setScreenRefresh` receives `"Smooth"`/`"Normal"`/etc., not an index, and translates it *itself*). So `vu-bars.value` already holds `"None"`/`"Amiga"`/`"Transparent"` today, `dropbox-mode.value` already holds `"Rename"`/`"Overwrite"`, and so on - this is the value every already-authored control already reads and writes, per SET-002's own "updates its state field (unchanged observable behavior)" requirement.

Given that, `domain/settings/index.js` persists **the label text v2 already uses**, under **v1's own key names** (for continuity/readability of the JSON blob only - nothing in this repository ever reads it back as v1's `SETTINGS` object; v1 and v2 do not run in the same page). Building a second label ↔ v1-code translation table, with no acceptance criterion asking for it and nothing to verify it against, would be exactly the kind of speculative abstraction this project's own conventions avoid. This is recorded here as this spec's one divergence, the same way `domain/playback/README.md` records its own three.

The one field that is *not* label text is `screen-refresh.value`: spec 032 already made it a plain integer (the clicked item's list index, e.g. `1` for `"Normal"`), and `domain/playback/index.js#setScreenRefresh` already owns that translation. This spec does not re-derive it; see "screen-refresh.set stays put" below.

## A pre-existing, out-of-scope gap: radio-group highlighting

Traced before writing this design, because it directly bears on what SET-001 can actually claim: a `radioGroup`'s drawn selection (which item looks pressed) is **not** derived from the bound field at all. `mountGeneric.js` keeps a private `radioSelection` Map (`id -> selected item id`, line 139), written only on a click (line 826-827) and read only by `isHighlighted()`'s `radioSelection.get(group) === node.id` check (line 500-503) - an id-equality check against click history, never a value comparison against `mockState`. It is never seeded from a node's `field` at mount. This means **no radio-driven control in the current renderer shows a pre-selected item on load, regardless of persistence** - a real, already-existing gap this spec does not introduce and is not the one to close, since closing it needs a renderer change and this package's acceptance is state persistence, not that highlight. Recorded here, in `domain/settings/README.md`, and in tasks.md's Known limits, rather than silently left for someone to rediscover.

Practically: SET-001's acceptance is exactly what its own text already scopes it to - the twelve state fields hold the right value at construction, checked against `domain/settings/index.js` and the generated store's initial read. Checkbox-driven fields (`help-bubbles.active`, `show-key-input.active`, `high-dpi.active`, `show-midi-input.active`, `piano.active`) *do* draw correctly from their field today (a checkbox's `isHighlighted()` falls through to the generic `visual-state` binding check, or - for these five, which carry no such binding - simply is not highlighted either way; their own on/off *artwork* comes from `spriteLabel`'s own state read of the same field, unaffected by `radioSelection`). Only the seven radio-driven fields (`vu-bars`, `stereo-separation`, `screen-refresh`, `dropbox-mode`, `midi-input`, `play-from`, `editor-layout`) inherit the pre-existing highlight gap.

## Architecture

```
domain/settings/storage.js (new, pure)
  createStorage(backend?) -> { getItem(key), setItem(key, value) }
  real localStorage when present; an in-memory Map otherwise, so every
  module in this folder runs in plain Node with no polyfill.
        ^
        | used by
        |
domain/settings/index.js (new)
  SETTINGS_FIELDS: v2 field -> [v1 key, default]  (twelve entries)
  applyPersistedSettings(initial, storage?) -> a new object, `initial` with
      every key it already declares that is also a known settings field
      overridden from storage (corrupt/missing -> the declared default)
  persistSetting(field, value, storage?)          write-one, no state write
  setVuBars / toggleHelpBubbles / setStereoSeparation / toggleShowKeyInput /
  toggleHighDpi / setDropboxMode / setMidiInput / toggleShowMidiInput /
  setPlayFrom / setEditorLayout / togglePiano (app, detail)
      -> update the bound field (same shape the mock they replace already
         has) AND persistSetting() the new value
        ^
        | eleven direct capability mappings
        |
capabilities.js  (extended: eleven new entries)
        |
        | one cross-import (documented, like domain/song's engine exception)
        v
domain/playback/index.js#setScreenRefresh (unchanged translation logic)
  now also calls persistSetting("screen-refresh.value", value)

domain/settings/favorites.js (new, pure, headless)
  toggleFavorite(url, title, storage?) / isFavorite(url, storage?) /
  getPlaylist(storage?) - a second, independent `favorites` key; no command
  maps to it yet (no heart icon is authored) - see Scope boundaries.

runtime/appState.js (extended: ONE new import)
  createAppState(initial, options = {}) calls
  applyPersistedSettings(initial, options.settingsStorage) before
  constructing the store - the seam that removes the race, entirely inside
  hand-written v2 infrastructure. Neither compiler/emit.js nor any generated
  file (app/state.js, app/main.js) changes at all.
```

## Why the seed lives in `runtime/appState.js`, not the emitter

Requirements.md's own non-functional bullet is explicit: no compiler change. `app/state.js` and `app/main.js` are both generated by `compiler/emit.js`; touching either (even to add one import) would mean the compiler now knows about a specific domain capability by name, which nothing else it emits does - host hooks are the one generic exception, and they are wired *generically*, off a manifest prefix (`host.`), not by naming `domain/playback` in the template. Inventing an equivalent generic prefix (say, a `boot.` manifest key) purely for this one capability would be new machinery with exactly one caller - the kind of ahead-of-need abstraction this codebase's own conventions (see e.g. spec 028's "a different undel shape, not part of this spec's wording") argue against.

`runtime/appState.js` is already the one hand-written module every generated `app/state.js` delegates to, and it is reached only from the generated release path (confirmed: grepping every `.js` file for `appState` finds exactly `app/state.js` - the generated caller, `tests/components.test.js` - a direct unit test, and this file itself; the authoring preview's own mock state in `mountGeneric.js` never imports it, so this change cannot leak into the workbench). Adding one settings-aware call here is a documented, narrow exception to "generic runtime infra knows nothing about a specific domain" - exactly the shape `domain/song/README.md` already uses for its own one documented exception (importing `domain/playback/engine/` directly) - recorded in this file's own header comment and in `domain/settings/README.md`, not left implicit.

`options.settingsStorage` exists purely so `tests/appState.test.js` can inject a fake backend and prove the seed actually happens; the generated `app/state.js` never passes it (its call is `createStore(INITIAL_STATE)`, unchanged), so in the browser `applyPersistedSettings` always falls through to the real `localStorage`.

## `screen-refresh.set` stays put

`domain/playback/index.js#setScreenRefresh` already owns the label → index translation (`SCREEN_REFRESH_LABELS`), already tested, already documented (spec 032). Duplicating that table in `domain/settings/` to "own" this field's persistence too would fragment one field's translation across two files for no benefit. Instead `setScreenRefresh` gains one line, calling `persistSetting` from `domain/settings/index.js` after it computes the index - the one place this spec's capability and spec 032's capability cross, recorded in both files' comments the same way `domain/playback/README.md` and `domain/song/README.md` already cross-reference their own one exception.

`capabilities.js`'s existing `"screen-refresh.set"` mapping is unchanged. `"high-dpi.toggle"` **is** newly mapped here (superseding spec 032's explicit "no capability needed" note) - persistence is exactly the domain logic spec 032 correctly said a plain mock already covered for *drawing*, but a mock cannot also write to `localStorage`, so this field needs a real capability now that persistence exists. Recorded as superseding, not silently changed.

## Components and interfaces

### `domain/settings/storage.js`

```js
export function createStorage(backend) {
    if (backend) return backend;
    if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
    return createMemoryStorage();
}

function createMemoryStorage() {
    const map = new Map();
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => { map.set(key, String(value)); }
    };
}
```

A fresh in-memory store per call with no backend given is deliberate: it makes every capability function safe to import in Node with zero setup (nothing to leak between unrelated tests), while a real browser always resolves to the one real `localStorage` singleton, and a test that wants to prove persistence constructs one fake store and passes it explicitly to both sides of the round trip.

### `domain/settings/index.js`

```js
const SETTINGS_KEY = "bassoonTrackerSettings";

// v2 state field -> [v1 settings key, default]. Twelve keys - see
// requirements.md's "What v1 actually does" for why not fourteen.
const SETTINGS_FIELDS = {
    "vu-bars.value":           ["vubars", "Amiga"],
    "help-bubbles.active":     ["useTooltip", true],
    "stereo-separation.value": ["stereoSeparation", "Balanced"],
    "show-key-input.active":   ["showKey", false],
    "screen-refresh.value":    ["skipFrame", 1],
    "high-dpi.active":         ["highDPI", false],
    "dropbox-mode.value":      ["dropboxMode", "Rename"],
    "midi-input.value":        ["midi", "Disabled"],
    "show-midi-input.active":  ["showMidi", false],
    "play-from.value":         ["playFrom", "Pattern start"],
    "editor-layout.value":     ["patternViewMode", "vertical"],
    "piano.active":            ["showPiano", false]
};

function readBlob(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(SETTINGS_KEY));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {}; // corrupt or missing - SET-003
    }
}

function readField(field, storage) {
    const [key, fallback] = SETTINGS_FIELDS[field];
    const blob = readBlob(storage);
    return Object.prototype.hasOwnProperty.call(blob, key) ? blob[key] : fallback;
}

export function persistSetting(field, value, storage = createStorage()) {
    const [key] = SETTINGS_FIELDS[field];
    const blob = readBlob(storage);
    blob[key] = value;
    storage.setItem(SETTINGS_KEY, JSON.stringify(blob));
}

/** Called once, at store construction (see runtime/appState.js). Only overrides a field `initial` already declares. */
export function applyPersistedSettings(initial, storage = createStorage()) {
    const seeded = { ...initial };
    for (const field of Object.keys(SETTINGS_FIELDS)) {
        if (Object.prototype.hasOwnProperty.call(seeded, field)) seeded[field] = readField(field, storage);
    }
    return seeded;
}

function applyToggle(app, detail, field) {
    const current = Boolean(app.state.get(field));
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    app.state.set(field, next);
    persistSetting(field, next);
    if (app.log) app.log(`${field}.toggle`, { [field]: next });
    return next;
}

function applySet(app, detail, field) {
    const next = detail && detail.value !== undefined ? detail.value : app.state.get(field);
    app.state.set(field, next);
    persistSetting(field, next);
    if (app.log) app.log(`${field}.set`, { [field]: next });
    return next;
}

export function setVuBars(app, detail) { return applySet(app, detail, "vu-bars.value"); }
export function toggleHelpBubbles(app, detail) { return applyToggle(app, detail, "help-bubbles.active"); }
export function setStereoSeparation(app, detail) { return applySet(app, detail, "stereo-separation.value"); }
export function toggleShowKeyInput(app, detail) { return applyToggle(app, detail, "show-key-input.active"); }
export function toggleHighDpi(app, detail) { return applyToggle(app, detail, "high-dpi.active"); }
export function setDropboxMode(app, detail) { return applySet(app, detail, "dropbox-mode.value"); }
export function setMidiInput(app, detail) { return applySet(app, detail, "midi-input.value"); }
export function toggleShowMidiInput(app, detail) { return applyToggle(app, detail, "show-midi-input.active"); }
export function setPlayFrom(app, detail) { return applySet(app, detail, "play-from.value"); }
export function setEditorLayout(app, detail) { return applySet(app, detail, "editor-layout.value"); }
export function togglePiano(app, detail) { return applyToggle(app, detail, "piano.active"); }
```

`applyToggle`/`applySet` mirror exactly what the generated mocks they replace already do (`compiler/emit.js`'s own `next = detail?.value !== undefined ? detail.value : <cycle-or-hold>`), so the observable behavior of every already-authored control is unchanged - only persistence is new. A `.set` command's mock always has an empty `mockValues` (`compiler/recipes.js:51`), so `applySet` never has anything to cycle through and simply holds when no gesture value arrives, matching that.

### `domain/settings/favorites.js`

```js
const FAVORITES_KEY = "favorites";
const EMPTY_LINES = ["No favorites yet...", "Press the heart icon", "to add one!"];

function load(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(FAVORITES_KEY));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function isFavorite(url, storage = createStorage()) {
    return load(storage).some(item => item.url === url);
}

export function toggleFavorite(url, title, storage = createStorage()) {
    const favorites = load(storage);
    const next = isFavorite(url, storage)
        ? favorites.filter(item => item.url !== url)
        : [...favorites, { url, title: title || url.split("/").pop() }];
    storage.setItem(FAVORITES_KEY, JSON.stringify(next));
    return next;
}

export function getPlaylist(storage = createStorage()) {
    const modules = load(storage);
    return { title: "Favorites", icon: "icons/fav.png", modules: modules.length ? modules : EMPTY_LINES.map(title => ({ title })) };
}
```

Ported from `script/src/models/favorites.js`, minus its `EventBus.on(EVENT.toggleFavorite, ...)` wiring: no control dispatches a favorite-toggle command yet (no heart icon is authored anywhere in the current YAML), so there is nothing to map in `capabilities.js` today. `toggleFavorite` takes `(url, title)` directly rather than reading `Tracker.getCurrentUrl()`/`getSong()` itself, so this module stays headless and free of any dependency on `domain/playback` - the capability wiring that reads "the current song" is the disk-operation screens' own later spec's job, per requirements.md's own SET-004 note.

### `runtime/appState.js`

```js
import { createStore } from "./store.js";
import { applyPersistedSettings } from "../domain/settings/index.js";

// Spec 033's one documented exception: generic app-state infrastructure
// consulting one specific capability, so a settings-backed field can be
// seeded before the very first render with no setTimeout. See
// domain/settings/README.md.
export function createAppState(initial, options = {}) {
    const seeded = applyPersistedSettings(initial, options.settingsStorage);
    const fields = Object.fromEntries(Object.entries(seeded).map(([path, value]) => [path, { initial: value }]));
    const store = createStore(fields);
    // ...unchanged below...
}
```

### `capabilities.js` (additions)

```js
"vu-bars.set":            { module: "./domain/settings/index.js", export: "setVuBars" },
"help-bubbles.toggle":    { module: "./domain/settings/index.js", export: "toggleHelpBubbles" },
"stereo-separation.set":  { module: "./domain/settings/index.js", export: "setStereoSeparation" },
"show-key-input.toggle":  { module: "./domain/settings/index.js", export: "toggleShowKeyInput" },
"high-dpi.toggle":        { module: "./domain/settings/index.js", export: "toggleHighDpi" },
"dropbox-mode.set":       { module: "./domain/settings/index.js", export: "setDropboxMode" },
"midi-input.set":         { module: "./domain/settings/index.js", export: "setMidiInput" },
"show-midi-input.toggle": { module: "./domain/settings/index.js", export: "toggleShowMidiInput" },
"play-from.set":          { module: "./domain/settings/index.js", export: "setPlayFrom" },
"editor-layout.set":      { module: "./domain/settings/index.js", export: "setEditorLayout" },
"piano.toggle":           { module: "./domain/settings/index.js", export: "togglePiano" }
```

`"screen-refresh.set"` is untouched (already mapped to `domain/playback/index.js#setScreenRefresh`).

## Data models

The persisted blob, `localStorage["bassoonTrackerSettings"]`:

```json
{
  "vubars": "Amiga", "useTooltip": true, "stereoSeparation": "Balanced",
  "showKey": false, "skipFrame": 1, "highDPI": false,
  "dropboxMode": "Rename", "midi": "Disabled", "showMidi": false,
  "playFrom": "Pattern start", "patternViewMode": "vertical", "showPiano": false
}
```

`localStorage["favorites"]`: `[{ "url": string, "title": string }, ...]`, matching v1's shape exactly (so a real v1 profile's existing favorites, if this ever shares a browser profile, already parse correctly - unlike the settings blob, which does not attempt v1 value compatibility, this shape needs none: v1's own favorites entries are already plain `{url, title}`).

## Error handling

- **Corrupt/missing `bassoonTrackerSettings`**: `readBlob` catches `JSON.parse` and any non-object result, returning `{}`; every field then falls back to its declared default (SET-003).
- **Corrupt/missing `favorites`**: same shape, falls back to `[]`.
- **A field `applyPersistedSettings` is asked to seed that `initial` never declared**: skipped entirely (the `hasOwnProperty` guard) - an application that never authors a control for one of these twelve names is not given a field it never declared, matching `domain/playback/index.js#publish`'s own "the store rejects a field the application never declared" tolerance.
- **`persistSetting`/`applyToggle`/`applySet` called with no `app.state`**: not guarded - every call site is a real capability invoked by the generated action wrapper, which always supplies `app.state` (same assumption `domain/song/index.js#recordToggle` already makes for `app.state.set`, though that one does guard; this module matches its own immediate siblings' `setScreenRefresh`, which also assumes `app`/`app.state` in the same way once past its own explicit `if (app && app.state)` re-check - since ours is always the real generated `app`, not the authoring preview, we keep the check for parity but do not invent a "no-op without one" contract nothing calls into).

## Testing strategy

- **`tests/settingsStorage.test.js`** (new): `createStorage()` returns the same real `localStorage`-shaped object when a stub global exists (asserted via `globalThis.localStorage = fakeStorage` inside the test, restored after); returns a working in-memory store otherwise; two separate `createStorage()` calls with no backend do not share state (documents the deliberate "fresh per call" choice above).
- **`tests/settings.test.js`** (new): `applyPersistedSettings` against a fresh store returns declared defaults for all twelve fields, leaves an undeclared field on `initial` untouched, and does not add a field `initial` never had; each of the eleven exported capability functions against a fake `app` (`{ state: <a tiny stub with get/set>, log }`) - toggles flip correctly with and without an explicit `detail.value`, `.set` commands hold when no `detail.value` arrives, and every one persists (a second `readField`-equivalent call against the *same* storage object sees the new value, satisfying SET-002's own "a second instance... reads the new value back"); corrupt JSON seeded directly into the fake storage falls back to every declared default (SET-003).
- **`tests/favorites.test.js`** (new): `toggleFavorite` on then off agrees with `isFavorite` at each step against one shared fake storage; `getPlaylist()` returns the three-line placeholder verbatim when empty and the real list otherwise.
- **`tests/appState.test.js`** (new, small): `createAppState(initial, { settingsStorage })` seeded with a non-default value for a settings-backed field returns a store whose `get()` reflects it immediately (no timer, checked with `node:test`'s fake timers or simply asserting synchronously with nothing pending) - proves the actual construction-time seam, not just `applyPersistedSettings` in isolation.
- **`tests/playback.test.js`** (extended): `setScreenRefresh` now also persists - a second read via `domain/settings/index.js`'s own field-read path (through `applyPersistedSettings` against the same fake storage) sees the index it wrote.
- **Boundary test**: extend the existing grep-based convention (`tests/domainBoundary.test.js`'s style, not necessarily that file itself) so nothing outside `domain/settings/` touches `localStorage`/`bassoonTrackerSettings`/`favorites` directly - SET-005.
- `node --test "v2/tests/*.test.js"` passes; `node build.mjs app`/`dist` succeed; the eleven newly-mapped commands leave `app/LOOSE-ENDS.md`'s mocked-command list.

## Security considerations

Not applicable - `localStorage`, same-origin, no new input surface beyond what already existed (every value already flows from an already-authored, already-trusted UI control).

## Monitoring and observability

Every capability function calls `app.log(...)` on the same pattern every other capability already uses (SET-002 doesn't ask for this, but it costs nothing and matches the codebase's own convention everywhere else).

## What this deliberately does not do

- **No v1-value-encoding compatibility.** See "Value semantics" above.
- **No fix for radio-group highlighting on load.** See its own section above - a real, pre-existing, separately-scoped gap.
- **No `showSideBar`/`showAppPanel` persistence** - no v2 control authors them yet (requirements.md's own scope boundary).
- **No `frequency-table.set` capability** - live per-song engine state, not a persisted setting (requirements.md's own scope boundary).
- **No favorites UI, no heart-icon command mapping, no playlist screen** - `domain/settings/favorites.js` is verified headless, against a stub URL/title, exactly as `domain/song/index.js`'s pattern-editing landed before the pattern grid existed to display it (spec 028's own precedent).
- **No provider interface, no disk-operation screens, no format write path, no MP3 export** - later P9 specs.
