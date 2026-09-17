# 033 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Traced how `radioGroup` selection actually works before writing design.md (see design.md's own section) - a real, pre-existing renderer gap, out of scope, not to be rediscovered later.
- [x] `domain/settings/storage.js` (new, pure): `createStorage(backend?)`, real `localStorage` or a fresh in-memory fallback per call.
- [x] `domain/settings/index.js` (new): `SETTINGS_FIELDS` (twelve entries), `applyPersistedSettings`, `persistSetting`, `applyToggle`/`applySet` plus the eleven named capability exports.
- [x] `domain/settings/favorites.js` (new, pure): `toggleFavorite`, `isFavorite`, `getPlaylist`.
- [x] `domain/settings/README.md` (new): boundary, provenance, the value-semantics divergence, the pre-existing radio-highlight gap, the `runtime/appState.js` exception.
- [x] `runtime/appState.js`: `createAppState(initial, options)` calls `applyPersistedSettings` before constructing the store.
- [x] `domain/playback/index.js`: `setScreenRefresh` also calls `persistSetting("screen-refresh.value", value, settingsStorage)`; header/README cross-reference `domain/settings/`.
- [x] `capabilities.js`: eleven new mappings (`vu-bars.set` through `piano.toggle`, per design.md); `high-dpi.toggle` newly mapped, superseding spec 032's own note.
- [x] `tests/settingsStorage.test.js` (new, 4 cases).
- [x] `tests/settings.test.js` (new, 9 cases).
- [x] `tests/favorites.test.js` (new, 5 cases).
- [x] `tests/appState.test.js` (new, 3 cases).
- [x] `tests/playback.test.js` (extended, +1): `setScreenRefresh` persistence.
- [x] `tests/domainBoundary.test.js` (extended, +2): only `domain/settings/storage.js` names `localStorage`; only `domain/settings/` names either storage key.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`: regenerated `app/` shows the eleven commands off the mocked-command list in `LOOSE-ENDS.md` (87 → 76).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only, per requirements.md's own recorded reason (no browser-automation dependency in this environment). SET-001's own acceptance is scoped to what is actually checkable this way: the twelve fields' initial value (`tests/appState.test.js`, plus a direct Node import of the regenerated `app/state.js`), not the pre-existing radio-highlight gap documented in design.md.

## Evidence

`node --test tests/*.test.js`: 438 tests, all passing, up from 413 (25 new: 4 in `settingsStorage.test.js`, 9 in `settings.test.js`, 5 in `favorites.test.js`, 3 in `appState.test.js`, 1 more in `playback.test.js`, 2 more in `domainBoundary.test.js`, and one shared new fixture helper, `tests/helpers/fakeStorage.js`, not itself a test file).

`node build.mjs app`: succeeds, exit 0. `app/LOOSE-ENDS.md`'s item count drops from 87 to 76 - exactly the eleven newly-mapped commands; each regenerated `app/actions/*.js` for them is the same thin capability-wrapper shape `transportToggle.js`/`recordToggle.js` already have (spot-checked `vuBarsSet.js` and `pianoToggle.js` by hand). `frequency-table.set` and the track/pattern-list mocks remain, correctly, since they are out of this spec's scope.

Direct Node check (not part of the automated suite, done by hand to confirm the actual seam end to end): `import("./app/state.js").then(m => m.createAppState())` with no `localStorage` global present (plain Node) returns `vu-bars.value: "Amiga"` and `editor-layout.value: "vertical"` - `domain/settings/index.js`'s own declared defaults, not the compiler's `""` placeholder that was in `INITIAL_STATE` before this spec - confirming `runtime/appState.js`'s seed actually runs at construction time in the real generated app, not just in a unit test's own fixture.

`node build.mjs dist`: still fails on the same pre-existing `esbuild` host/binary version mismatch (`0.28.2` vs `0.25.4`) every spec since 019 has recorded; unrelated to this work, not attempted to fix here.

## Found while doing it

- **The radio-group highlight gap** (design.md's own section) was found by tracing the code before writing design.md, not assumed from requirements.md's wording - `radioSelection` is a plain `id -> id` click-history map with no seeding from a bound field anywhere, which is a materially different (and weaker) guarantee than "a control shows its value" sounds like at first read. Recorded explicitly rather than let SET-001 quietly overclaim.
- **`app.state.js`'s literal per-field defaults for these twelve fields turn out to be dead weight once persistence exists** - `applyPersistedSettings` always overrides a declared field from storage (falling back to `domain/settings/index.js`'s own default, never to the compiler's placeholder), so the compiler's own `""`/`false` seeds for these twelve names are now purely cosmetic placeholders nothing ever reads in practice. Not changed here (would be a compiler change, out of scope), but worth a future spec's attention if the duplication becomes confusing.
- **"No compiler change" forced a real architectural decision, not a mechanical one.** The obvious seam (one new import in the generated `app/state.js`/`app/main.js`) was foreclosed by requirements.md's own wording; the actual seam (`runtime/appState.js`) required first confirming, by grep, that this file is reached only from the generated release path and one direct unit test - otherwise seeding settings here could have silently reached the authoring preview's own mock state, which every prior spec has been careful to keep untouched by real capabilities.
- **Everything else matched design.md going in**: the eleven `applyToggle`/`applySet` capability functions needed no surprises once the generic mock's own semantics (`compiler/emit.js`'s `detail.value ?? cycle-or-hold`) were confirmed by reading `compiler/recipes.js` (a `.set` command's mock always has empty `mockValues`, so nothing to cycle; a `.toggle` command's is always `[false, true]`); `screen-refresh.set`'s cross-import needed no coordination beyond one added line and one added parameter.

## Known limits

Radio-group visual selection does not reflect a bound field on initial mount for any control in this renderer, persisted or not (design.md, "A pre-existing, out-of-scope gap") - a real gap, not introduced here, and not fixed here since fixing it needs a renderer change this package's acceptance does not ask for. `showSideBar`/`showAppPanel` remain unpersisted (no v2 control exists yet). Favorites has no UI path to reach it yet (no heart icon authored, nothing mapped in `capabilities.js` for it). No browser verification occurred in this environment (the same recorded gap every spec since 019 has left); this spec's verification rests on the unit suite plus one direct Node-level check of the regenerated `app/state.js`, not a real page load.
