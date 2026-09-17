# Feature registry

The lazy feature registry. Spec [039](../../project/specs/039-feature-registry/requirements.md), opening package **P10** (features and the plugin path) of the [port roadmap](../../project/specs/010-port-roadmap/requirements.md).

```
index.js   registerFeature, openFeature, closeFeature, featureState
```

## What this is

A metadata-only table (a feature's name → `{ load: () => Promise<Module> }`) plus a small per-feature state machine: `idle → loading → ready`, or `loading → failed` (from which the next open retries from `idle` again), and `open`/`closed` as a second, independent flag on top of that - a feature can be `ready` and `closed` (loaded once, hidden now), and reopening it never re-imports its module.

## Provenance

Ported in spirit, not in code, from `script/plugins/registry.js` (a flat, static manifest map) and `script/plugins/loader.js#Plugin.load` (already, if by accident, giving in-flight deduplication and retry-after-failure - tracing it found that v1's own two `if` checks simply fall through to a fresh load whenever neither `loaded` nor `loading` is true, which is exactly retry, never built on purpose). What v1's loader never had: any "closed" concept - `app.js`'s own call sites decide what to do with a loaded module with no guard against a user closing a feature's panel while its own import is still in flight. This registry adds that guard explicitly.

## The host interface

Deliberately not designed here beyond what this spec's own mock feature needs (nothing - see design.md). v1's three real plugins (SampleEditor, Nibbles, Generator) each received a differently-shaped, hand-built dependency bag (`app.js`'s own `COMMAND.showSampleEditor`/`nibbles`/`generator` cases) - none of them v2-shaped (no `EventBus`/`EVENT`/`COMMAND`, no raw UI element constructors), so "one documented host interface" could not mean consolidating v1's three; it needs designing fresh, against a real tenant's own concrete need. That is a later spec's job - the sample editor or Nibbles, whichever is ported first.

## What this deliberately does not do

- **The sample editor, Nibbles** - P10's own two named tenants; each a separate, later spec.
- **The generator** - excluded by the port roadmap's own resolved open decision 3.
- **Any UI/screen for opening a feature** - `showSampleEditor`/`nibbles`'s own `unresolved-action-reference` entries in `app/LOOSE-ENDS.md` stay unresolved until a real tenant exists.
