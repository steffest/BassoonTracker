# 039 — The feature registry

Date: 2026-09-13. Kind: feature. Status: specified. Opens package **P10** (features and the plugin path) of the [port roadmap](../010-port-roadmap/requirements.md), following P9's closure. The mechanism package 010's own design sketch calls for; the sample editor and Nibbles - P10's two named tenants - are later specs, the same two-step shape every prior package used (P7's grid before its screen, P9's providers before its screen, P9's `fileBrowser` before its screen).

## Purpose

P9 is done for the slices this port has built (settings, providers, disk operations, module export). P10 is next on the roadmap: "the lazy feature registry the roadmap has always wanted, with the sample editor and Nibbles as its tenants." Reading `script/plugins/{registry,loader}.js` and `script/src/app.js`'s own three `Plugin.load(...)` call sites in full found that P10's own acceptance criteria (a cold trace, deduplication, close-during-load, retry) are properties of the *loader*, not of any one plugin - every one of them is checkable against a hand-built mock feature, with no need to have ported the sample editor or Nibbles first. This spec is that loader.

## What v1 actually does (read from source, not assumed)

- **`script/plugins/registry.js`** is a flat, static map (`{Nibbles, Generator, SampleEditor}`, each a manifest with `name`/`entry`/`load`/`assets`) - metadata only, no eager import; `load` is a plain `() => import("./x.js")` closure per plugin.
- **`script/plugins/loader.js#Plugin.load(plugin, next)`** already has almost exactly the state machine P10's design sketch asks for, discovered by tracing it rather than assumed from the sketch's own prose: a plugin starts absent from its own `plugins` map (idle); the first `load()` call creates an entry and starts `Promise.all([loadAssets(manifest), loadModule(manifest)])`, stored as `loadedPlugin.loading`; a concurrent second call while that promise is pending returns the *same* promise (`if (loadedPlugin && loadedPlugin.loading) return loadedPlugin.loading.then(...)`) - real deduplication, not assumed; on success, `loaded: true` and `loading: null`; on failure, `loading: null` but `loaded` stays `false` and the *same* entry stays in the map - so a third call finds neither `loaded` nor `loading` truthy, falls through, and builds a brand-new entry, retrying the import from scratch. **Retry-after-failure already falls out of the existing state check, not a feature v1 built on purpose** - worth noting since it means this port's own retry behavior is free once the same three states are copied faithfully.
- **What v1's loader does *not* have**: any "closed" concept at all. `Plugin.load`'s only job is getting the module; `App.js`'s own call sites (`Plugin.load("SampleEditor", callback)`) decide what to do with the result - call `.init()`, then `EventBus.trigger(EVENT.showView, "sample")`. There is no guard against a user closing the sample editor's panel *while* its module is still loading and having it pop open anyway once the import resolves - v1 simply doesn't have fast-enough hardware for this race to matter in practice, but P10's own design sketch asks for it explicitly ("closing during load leaves it closed"), so this spec adds the one thing v1 never needed.
- **Three different, hand-built dependency bags**, one per plugin, all built inline in `app.js`'s own `switch` (`COMMAND.showSampleEditor`/`nibbles`/`generator` cases, 73-92, 159-186, 187-200): SampleEditor gets `{UI: {core, font, EventBus, EVENT, COMMAND, Layout, Input, Y, Tracker, Assets}}`; Nibbles gets a *differently shaped* one carrying raw v1 UI element constructors (`element`, `image`, `scale9Panel`, `label`, `button`, `radioGroup`, `checkbox`, `panel`) instead of `core`, since it builds its own UI tree directly; Generator (out of scope, open decision 3) gets a third, simpler shape again. None of v1's own three shapes are v2-shaped at all (no `EventBus`/`EVENT`/`COMMAND` constants, no raw element constructors, no `Y`/yascal sprite system exist in v2), so "one documented host interface" cannot mean "consolidate v1's three bags" - it has to be designed fresh, and design.md below deliberately keeps it to exactly what this spec's own mock feature needs, not a guess at what the sample editor or Nibbles will eventually want.

## Decisions and assumptions

- **A metadata-only registry, `domain/features/index.js`**, is a plain object (name → `{ load: () => Promise<Module> }`), matching v1's own `registry.js` shape - no eager import, confirmed the same way FB-00x tests confirm a cold trace.
- **The state machine is per-feature, keyed by name**: `idle → loading → ready`, or `loading → failed` (from which the *next* open attempt starts a fresh `loading` from `idle` again - the same fall-through v1's own loader already gives for free, ported deliberately this time, not accidentally). `open`/`closed` is a second, independent flag on top of this - "ready" and "open" are orthogonal (a feature can be `ready` and `closed`, e.g. after the user closes it once loaded).
- **Closing during load is a real guard, not a race left to chance.** `openFeature`'s own resolution checks, at the moment the import settles, whether the feature is still the one the caller asked to see; if `closeFeature` ran in the meantime, the loaded module is kept (still `ready`, still cached) but the caller's own "show it" callback is never invoked.
- **The host interface is exactly the existing generated-application `AppContext`** (`{ state, feature, log, media }`, already documented in `app/main.js`'s own JSDoc) plus one addition this spec needs and no more: a `container`-shaped hook is deliberately *not* invented here, since nothing in this spec has a screen to mount into yet. A real tenant's own spec is expected to extend this once a real need is known, not guessed at now.
- **Verified against a hand-built mock feature**, the same precedent every mechanism-first package in this roadmap has already set (patternGrid, `fileBrowser`, the overlay layer) - no sample editor, no Nibbles, ported here.

## User stories and acceptance

- **FEATURE-001 — A cold trace shows no feature code or assets before first open.** `domain/features/index.js`'s own registry never calls a manifest's `load()` until `openFeature()` is invoked for that name. Acceptance: a unit test asserting a registered manifest's `load` function is never called by merely importing/registering it.
- **FEATURE-002 — Opening repeatedly during load creates exactly one instance.** Two (or more) concurrent `openFeature(name)` calls while a load is in flight all resolve to the *same* module instance, and the manifest's own `load()` is called exactly once. Acceptance: a unit test with a manifest whose `load()` is a deliberately-delayed promise, called twice before it settles.
- **FEATURE-003 — Closing during load leaves it closed.** `openFeature(name, onReady)` starts a load, `closeFeature(name)` runs before it resolves; `onReady` is never called, but the feature's own state ends up `ready` (the module is cached) and `closed` (not shown) - a *subsequent* `openFeature` call reuses the cached module without a second import. Acceptance: a unit test proving both halves - no callback fired, and no second `load()` call on the next open.
- **FEATURE-004 — A failure can be retried.** A manifest whose `load()` rejects once leaves the feature `failed`; a second `openFeature(name)` call retries (calls `load()` again) rather than staying permanently broken. Acceptance: a unit test with a manifest that rejects the first time and resolves the second.
- **FEATURE-005 — No regressions.** Full unit suite passes; no YAML/compiler/renderer change (this spec has no screen, no component type, no capability wired to a command yet - see Scope boundaries).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given) - nothing here touches a canvas or a DOM element; the registry is pure state plus dynamic `import()`, testable with a hand-built module URL or an injected loader function.
- No new component type, no YAML, no capabilities.js mapping - a capability (mechanism) spec only, matching spec 035's own shape.

## Scope boundaries

In scope: `domain/features/index.js`, a `README.md`, and tests for all of the above.

Out of scope, recorded rather than silently dropped:

- **The sample editor, Nibbles** - P10's own two named tenants; each a separate, later spec porting real v1 code (~4,300 and ~1,300+ lines respectively) through this mechanism.
- **The generator** - open decision 3 already excludes it ("the generator waits").
- **Any UI/screen for opening a feature** - `showSampleEditor`/`nibbles`'s own `unresolved-action-reference` entries in `app/LOOSE-ENDS.md` stay unresolved until a real tenant exists to wire them to.
- **A richer host interface** (container mounting, a plugin-specific capability surface) - deliberately not designed ahead of a real tenant's own, concrete need.
