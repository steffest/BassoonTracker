# 004 — Design and findings

Historical decisions refined by spec 005: mandatory authored IDs, compactLabel and typed executable YAML bindings were rejected by the user. Use names/generated IDs, comma-label variants and prose-to-outline interpretation with warnings. The recommendations below record the earlier proposal, not current requirements. Type/layout separation and the noDependencies spelling were applied on 2026-09-10.

Pipeline: app.yaml and references → parse → resolve → validate → normalize → outline.json → runtime layout, renderers and named behavior modules.

YAML is the sole authority. Natural-language descriptions document intent; executable semantics require typed fields or registered policies. AI may help translate prose into those fields during authoring, but deterministic generation must not guess behavior. A future readable full-app report can be derived from YAML.

## Findings in current files

- app.rules says noDependecies; the file is noDependencies.yaml.
- controlBar declares radioGroup and items as separate content entries; items should be nested in that group.
- 'panel, full width, fixed height' mixes type and layout. Use type: panel and separate layout fields/defaults.
- action1/action2 have no definitions. Recording uses prose, while toggleplay has a description but no executable binding, precondition or event identity.
- Give all instances stable IDs independent of labels, including the two notification lights. Use explicit component refs.
- 'Key, K' is one label string. Use label and compactLabel.
- horizontalResize expresses intent but needs a named layout policy, priorities and fallbacks.
- noDependencies.yaml is a scalar document; standardize rules as id/description mappings with optional enforceable policy fields.

These recommendations leave the user's YAML unchanged until a language/compiler is implemented.

## Minimal language

Use stable IDs, explicit refs, typed properties and one content-list shape. List source modules in app.yaml so resolution is intentional. Reject duplicate keys/IDs, unresolved refs, cycles and unsupported fields. Track file/document paths in diagnostics. Separate descriptive rules from enforceable ones. Bind actions and selectors to registered capabilities, never arbitrary embedded script strings.

Example direction, not an implemented schema:

```yaml
id: playButton
type: button
label: Play
compactLabel: P
on:
  activate: toggleplay
bindings:
  active: playback.isPlaying
```

Select a deliberately reviewed YAML parser for the authoring tool, isolated from shipped runtime. A small vendored parser with license/provenance may fit the dependency policy. Avoid implementing full YAML with regex. If third-party authoring code is forbidden, specify a smaller language explicitly. Parser choice remains open.

## Generation and compatibility

The existing outline is hand-authored schema version 1 for the transport/list example. The validator supports editor-workspace regions, not the supplied menu/radioGroup/meters hierarchy. Preserve working JSON until generated replacement validates. Start with a supported subset, then extend the schema/runtime incrementally with tests.

Emit deterministic source hashes, compiler/schema versions and node provenance, avoiding generation timestamps. A check mode recomputes without writing and reports drift. Validate completely before replacement; on failure show stale preview status. Workbench saves YAML and invokes generation through the optional Node authoring service. Static runtime loads JSON only.

Git replaces manual application-spec versions, component baseline copies and revision directories. Keep current component IDs and explicit schema compatibility; earlier coherent contracts/code/assets are recovered from Git. Numbered specs remain records of why changes happened. final-spec.md remains a labeled historical narrative, not current authority.

Git currently reports all v2 files as untracked; no recoverable committed v2 history is claimed or created by this change.
