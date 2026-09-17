# 039 — Tasks

Status: implemented and verified 2026-09-13.

- [x] Read `script/plugins/{registry,loader}.js` and `script/src/app.js`'s three `Plugin.load(...)` call sites in full before designing.
- [x] `domain/features/index.js` (new): `registerFeature`, `openFeature`, `closeFeature`, `featureState`, `resetFeature`/`resetAllFeatures` (test-only).
- [x] `domain/features/README.md` (new): what this is, provenance, why the host interface is deliberately undesigned so far.
- [x] `tests/features.test.js` (new, 8 cases): FEATURE-001 through 004, plus an unregistered name, closing an already-ready feature, idempotent reopen, and a bare (no-`default`) module.
- [x] `node --test tests/*.test.js` passes.
- [x] `node build.mjs app`/`dist`: unaffected (no YAML/compiler/capabilities.js change - confirmed, not just assumed, by rebuilding and diffing the loose-ends count).
- [x] `v2/project/progress.md`, `010-port-roadmap/tasks.md`: recorded.
- [x] `v2/project/specs/index.md`: marked implemented and verified.

## Verification plan

Headless only (no browser-automation dependency in this environment, same recorded reason as every spec since 019) - nothing here touches a canvas or a DOM element, so this is not one of the specs where that matters. Verified entirely against hand-built mock features with a controllable (`deferredManifest()`) load promise, the same precedent every mechanism-first spec in this roadmap has set.

## Evidence

`node --test tests/*.test.js`: 515 tests, all passing, up from 507 (8 new in `tests/features.test.js`).

`node build.mjs app`: succeeds, exit 0, loose ends unchanged at 78 - confirms this spec genuinely touched no YAML/compiler/capability surface. `node build.mjs dist`: unaffected (still blocked only by the same pre-existing `esbuild` version mismatch every spec since 019 has recorded, unrelated to this work).

## Found while doing it

- **v1's own loader already gives retry-after-failure for free, by accident, not by design** - tracing `Plugin.load` line by line (rather than trusting the roadmap's own "retry" wording as a feature v1 built on purpose) found it falls out of the same two `if` checks used for the "already loaded"/"already loading" cases: after a failure, neither is true, so a third call simply falls through and starts over. This port makes the same three-state check explicit instead of incidental, and the "closed while loading" guard (which v1 genuinely never had) is the one real new piece of logic.
- **The host interface could not be "v1's three bags, consolidated"** - reading `app.js`'s own three `COMMAND.show*`/`nibbles`/`generator` cases in full found each dependency bag genuinely different in shape (SampleEditor's own `core`+font+Tracker+Assets vs. Nibbles' raw UI-element-constructor bag vs. Generator's simpler one), and none of the three resembling anything v2 already has (no `EventBus`/`EVENT`/`COMMAND` constants, no `Y`/yascal, no raw element constructors exist in this codebase). Recorded as a real finding in requirements.md rather than forcing a fabricated unification - the actual interface is left for whichever spec ports a real tenant first.

## Known limits

No real tenant exists yet - the sample editor and Nibbles are each a separate, later spec, and neither `showSampleEditor` nor `nibbles` in `app/LOOSE-ENDS.md` is resolved by this spec. The host interface a real feature module receives is not designed beyond what this spec's own mock feature needed (nothing) - a real, and possibly nontrivial, design decision left for the first real tenant's own spec.
