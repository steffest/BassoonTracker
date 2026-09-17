# 026 — Design

## Shape of the change

`components/controlBar.yaml` gains a `breakpoints:` entry on its own top-level panel (`maxWidth: 650`, switching `direction` to `column` and giving it a taller fixed height so the stacked controls have room - `160`, a plain constant, not derived from v1's own `"2row"` height of 80 doubled from 40, since v2's control bar already carries more rows of controls than v1's did before this cluster) and a new, named `radioGroup` (`topViewGroup`, so its auto-derived identity does not collide with the existing, still-unnamed song/pattern `radioGroup`) with three items - File Operations, Options, Sample Edit - `variant: buttons`, matching how the mode/display rows already look. Its `actions: - change: setTopView` resolves through the existing `set-value` recipe (spec 014) to command `top-view.set`, `mockField: top-view.value` - the field name every `visibleWhen` in this spec names.

`components/optionsPanel.yaml` gains `visibleWhen: { field: top-view.value, oneOf: [Options, ""] }` - the empty string keeps it shown by default (matching its behaviour since spec 022, before any switch existed), in addition to being shown when explicitly picked. `components/fileOperationsPanel.yaml`/`components/sampleEditPanel.yaml` are new, minimal (`visibleWhen` plus one line of prose text) - real content is P9/P10's job; these two exist only to prove the switch actually switches, the same "declared, not fully built" spirit spec 016 established for a placeholder type.

A radio group's own `change` dispatch writes the clicked item's own label text as the field's value (spec 014: `dispatch(group, "change", { value: node.definitionName || labelText(node) })`) - which is why `visibleWhen`'s `oneOf` lists the *exact* authored labels ("File Operations", "Options", "Sample Edit"), not a derived slug.

## The emitter gap this spec found and fixed

`compiler/emit.js` builds a node's `component(...)` call in one of two places: `nodeExpression()`, for a node nested inline inside whatever module its parent belongs to, and a second, separate block for a container that owns its own UI module (`ownModule: true` - every top-level panel `controlBar`/`optionsPanel`/`fileOperationsPanel` etc. are). Spec 025 added `breakpoints`/`visibleWhen` emission to the first and missed the second, because nothing exercised it: the authoring preview mounts the *compiled outline* directly, where both properties are already present as plain data regardless of which emitter code path would have handled them, so the gap was invisible until this spec put `breakpoints` on `controlBar`'s own root (a module-owning node) and asked a *generated* application to honour it. Fixed with the same two-line addition in both places; a new `tests/emit.test.js` case imports the generated `ui/main.js`, walks into `controlBar`/`optionsPanel` (both reached only through the second, module-owning path), and asserts both properties survived.

## What this deliberately does not do

See requirements.md's scope boundaries: no real disk-operations/sample-editor content, no attempt at v1's remaining breakpoint-driven properties, no toggle-off behaviour for the view switch.
