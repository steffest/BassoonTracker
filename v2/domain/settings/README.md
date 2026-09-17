# Settings capability

Persisted user preferences and favorites, behind one boundary. Spec [033](../../project/specs/033-settings-and-favorites/requirements.md), opening package **P9** (persistence, providers, file operations) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md).

```
index.js       the capability: twelve persisted settings, get/set/defaults
favorites.js   a second, independent localStorage key (pure, headless)
storage.js     a tiny Web Storage abstraction (real localStorage or in-memory)
```

## The boundary

Only `index.js` and `favorites.js` may be imported from outside this folder. One documented exception, the same shape `domain/song/README.md` already records for its own: `domain/playback/index.js#setScreenRefresh` imports `persistSetting` from here directly, rather than this folder duplicating spec 032's own label-to-index translation table. Nothing else reaches into this folder's internals; a grep-based test checks that nothing outside `domain/settings/` touches `localStorage`, `"bassoonTrackerSettings"` or `"favorites"` directly.

`runtime/appState.js` - generic app-state infrastructure, not a domain module - is the one other place this folder is reached from, and it is reached deliberately: `createAppState(initial, options)` calls `applyPersistedSettings()` before constructing the store, so a settings-backed field holds its saved value on the very first render, with no `setTimeout`. This is recorded as a documented exception rather than left implicit, exactly as `domain/song/README.md` records its own engine-import exception.

## Provenance

Ported from `script/src/settings.js` (the fourteen-key `SETTINGS` blob, twelve of which apply here - see requirements.md's "What v1 actually does" for the other two) and `script/src/models/favorites.js` (the separate `favorites` key). `script/src/storage.js`'s own two-function wrapper became `storage.js` here, extended to also work with no `localStorage` global at all, which is what makes this folder importable in plain Node.

## Value semantics: a deliberate divergence

v1 stores internal codes a radio group's clicked *index* maps to (`vubars: "none"|"colour"|"trans"`, `dropboxMode: "rename"|"overwrite"`, `midi: "disabled"|"enabled-note"|"enabled"`, `playFrom: "start"|"cursor"`), translated only inside `script/src/ui/optionsPanel.js`'s own per-control code. v2 never built that translation: a `radioGroup`'s `change` action already carries the clicked item's own authored label text as `detail.value` (`renderers/canvas/mountGeneric.js`'s `dispatch()`), and `compiler/emit.js`'s generated mock for every `.set` command already stores exactly that. So `vu-bars.value` already holds `"None"`/`"Amiga"`/`"Transparent"` today - the value every already-authored control already reads and writes - and this module persists exactly that, under v1's own key *names* (for a human reading the JSON blob only; nothing in this repository ever reads it back as v1's own `SETTINGS` object, so no byte-for-byte compatibility is attempted or needed). `screen-refresh.value` is the one exception: spec 032 already made it a plain integer index, owned by `domain/playback/index.js#setScreenRefresh`, and this module does not re-derive that translation - see design.md's "screen-refresh.set stays put".

## A pre-existing, out-of-scope gap

A `radioGroup`'s drawn selection is **not** derived from its bound field at all - `mountGeneric.js` tracks it in a private `radioSelection` Map (node id of the last click, per group), never seeded from a field's current value at mount. This means no radio-driven control in the current renderer shows a pre-selected item on load, persisted or not - a real, already-existing renderer gap this spec's own scope (persistence, not rendering) does not close. See design.md for the full trace. Checkbox-driven fields (help bubbles, show key input, high DPI, show MIDI input, piano) are unaffected - their on/off artwork reads the field directly, not this selection map.

## Headless use

```js
import { createStorage } from "./storage.js";
import { applyPersistedSettings, setVuBars } from "./index.js";

const storage = createStorage(); // in-memory outside a browser
const state = applyPersistedSettings({ "vu-bars.value": "" }, storage);
const app = { state: { get: f => state[f], set: (f, v) => { state[f] = v; } } };
setVuBars(app, { value: "Amiga" }, storage); // storage is test-only injection; the real app omits it
```

## Known limits

`showSideBar`/`showAppPanel` are not persisted - no v2 control authors them yet. `frequency-table.set` is not a persisted setting at all (live per-song engine state; see requirements.md). Favorites has no UI path to reach it - no heart icon is authored, so nothing is mapped in `capabilities.js` for it yet; a later, disk-operation-screen spec is expected to add that, reading the current song's URL/title itself before calling `toggleFavorite`.
