# 016 — Implementation

Status: implemented and verified 2026-09-11.

- [x] `runtime/componentTypes.js`: fifteen new entries — `icon`, `image`, `numberDisplay`, `rangeSlider`, `knob`, `scrollbar`, `listbox`, `dropdown`, `submenu`, `modalDialog`, `tabPanel`, `tooltip`, `collapsePanel`, `animSprite`, `buttonGroup` — each `implemented: false`, `styled: false`, `interactive: false`, `draw: "placeholder"`, with a contract and a one-paragraph rationale (see design.md's table). `checkboxbutton` deliberately not added (same shape as the existing `checkbox`).
- [x] `tests/componentTypes.test.js`: a new case naming all fifteen and asserting each is registered, unimplemented, placeholder-drawn, unstyled and controller-less; plus the fix below.
- [x] `tests/compiler.test.js`: a new case authoring an unknown property on `dropdown` (one of the fifteen), proving the unknown-component-property diagnostic is general and not something that only happens to work for `menu`.

## Evidence

`node --test "v2/tests/*.test.js"`: 180 tests, all passing, up from 178 (two new cases).

`node v2/build.mjs app`: succeeds, 24 loose ends, unchanged from before this spec — expected, since nothing in `app.yaml` authors any of the fifteen names yet.

No browser verification: nothing here draws, so there is nothing a screenshot would show beyond the existing placeholder box, already covered by the generic registry tests and the unit test above.

## Found while doing it

- **Three of the first-draft contracts shadowed a universal property.** `icon`'s and `animSprite`'s obvious property name, `name`, is already `UNIVERSAL_PROPERTIES.name` (identity within the parent); `knob`'s and `collapsePanel`'s obvious `label` is already the universal label. The existing "every entry is complete and internally consistent" test (spec 009) caught all of it immediately: `icon`/`animSprite` were renamed to `icon`/`sprite`, and `knob`/`collapsePanel` simply had the redundant property removed, since the universal one already covers what they needed to say.
- **`container.childType` must name a registered type, and `listItem`/`tab` are not.** `listbox`, `dropdown` and `tabPanel` were first drafted with `childType: "listItem"`/`"tab"`, mirroring how `radioGroup` names `radioItem`. The same existing test caught this too (`childType` is asserted registered). Rather than invent two more placeholder types with no source to justify their shape, all three were changed to bare `{ childrenIn: "items" }`, with menu's own precedent (`{ childrenIn: "items", itemActions: true }`, no `childType`) as the model for "the child shape is not settled yet." `buttonGroup`'s `childType: "button"` was kept, since `button` is a real, already-implemented type and the reference is meaningful.

## Known limits

Every one of the fifteen draws the placeholder box; none has a draw kind, a skin style, a State gallery fixture, or an authored use. `numberDisplay`'s controller reuse, `knob`'s click-toggles-disabled behaviour, whether `collapsePanel` collapses anything, and what `buttonGroup` is actually for are open questions, recorded in design.md's table rather than decided here. The next spec (or specs) in package P5 pick an implementing cluster from the dependency order design.md lists and promote it to `implemented: true`, the way spec 014 promoted `spinBox` and spec 015 promoted `inputbox`.
