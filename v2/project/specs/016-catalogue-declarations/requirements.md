# 016 — The rest of the catalogue, declared

Date: 2026-09-11. Kind: feature. Status: specified. Implements the first step of package **P5** of spec [010](../010-port-roadmap/requirements.md), the port roadmap.

## Purpose

P5's own design sketch says its first step is declarative, not code: "declare all of v1's types in the registry first, with contracts and `implemented: false`, so the catalogue documents the target before the work starts." Nothing has done that yet. Eleven types are implemented (`panel`, `button`, `label`, `viewport`, `radioGroup`, `radioItem`, `checkbox`, `slider`, `spinBox`, `inputbox`) and one is declared but not drawn (`menu`, with an empty contract). Everything else v1 has — a scrollable list, a dropdown, a rotary knob, a numeric LED readout, a modal dialog, tabs, a collapsible group, an animated sprite, a standalone scrollbar, a range slider, a generated file icon — has no entry at all. An author who writes one today gets a bare "unknown component type" diagnostic with no contract to check against and no catalogue page to read.

## Scope decision

P5 as the roadmap sized it is roughly twenty types plus six authored screens (the menu bar, the control panel, the options panel, the info bar, the edit pad, the song and pattern lists) — comparable in size to two or three of the specs before it combined. Splitting it the way P4 split into a pointer half and a keyboard half does not work here, because there is no natural two-way seam: every type is independent of every other, and the screens depend on all of them. The seam the roadmap already names is the right one instead: **declare, then implement, in dependency order.**

This spec is only the first half of that seam: every remaining v1 type gets a registry entry with a real (if intentionally provisional) contract, `implemented: false`, and a documented rationale for its shape — the same state `menu` has had since spec 009, extended to everything else. It draws nothing new and adds no behavior. Each subsequent spec promotes one type (or a small cluster of related ones) to `implemented: true`, exactly as spec 014 promoted `spinBox` and spec 015 promoted `inputbox` — the established, verified way this catalogue grows. The screens are last, once enough of the catalogue exists to author them without inventing coordinates.

One type in the roadmap's list, `checkboxbutton`, is not declared here: reading it (`script/src/ui/components/checkboxbutton.js`) found it to be a `Button` subclass that draws a checkbox or radio glyph beside its label — exactly what v2's existing `checkbox` type already does. It is not carried forward as a separate entry; this is recorded as a decision, not an omission.

## User stories and acceptance

- **CAT-001 — Every remaining v1 type has a catalogue entry:** As an author, I can find every component v1 has in the workbench's catalogue, whether or not it draws yet. Acceptance: `icon`, `image`, `numberDisplay`, `rangeSlider`, `knob`, `scrollbar`, `listbox`, `dropdown`, `submenu`, `modalDialog`, `tabPanel`, `tooltip`, `collapsePanel`, `animSprite` and `buttonGroup` each appear in `runtime/componentTypes.js` with `implemented: false`, a description, and a contract; each renders the existing dashed-box placeholder, exactly as `menu` already does.
- **CAT-002 — A contract catches a mistake even before a type is drawn:** As an author, authoring a property a not-yet-implemented type does not declare is a diagnostic, not silence. Acceptance: `knownProperty()`/`acceptedKeys()` answer correctly for every new type; the compiler's existing unknown-property diagnostic fires for one of them, proven by a test, not only for an implemented type.
- **CAT-003 — Nothing about the implemented catalogue changes:** Acceptance: the eleven implemented types and `menu` are byte-for-byte unchanged in shape; every earlier test and browser scenario still passes; the compiled outline's existing nodes do not change.

## Non-functional requirements

Every new entry is data only, in `runtime/componentTypes.js`, alongside the existing ones — no new file, no new mechanism, no new dependency. A contract here is deliberately not exhaustive: it names what is already known from reading the v1 source (see design.md), and a later implementing spec is expected to extend it, the same way spec 014 added `min`/`max`/`step` to `spinBox`'s contract that a placeholder version would not have needed.

## Scope boundaries

In scope: registry entries only, for the fifteen types named above.

Out of scope: any draw kind, any behavior, any skin style, any State gallery fixture, and any authored use in `app.yaml` — all of that is the corresponding implementing spec's job, one type (or small cluster) at a time, in roughly the dependency order the roadmap's design sketch lists: `icon`/`image`/`numberDisplay`/`animSprite` (simple leaves, no new mechanism), `rangeSlider`/`knob`/`scrollbar` (value-like controls), `listbox` (the first real container-with-selection), `dropdown`/`submenu`/`modalDialog` (build on the overlay/modal mechanism specs 013 and 015 already shipped), `tabPanel`/`collapsePanel`/`buttonGroup` (composition), and finally the six screens. `tooltip` as a *component type* (skinned, animated) is out of scope for its own artwork here; spec 015 already shipped a plain-text, unskinned hover-tooltip mechanism driven by a `tooltip:` property, which this entry's contract cross-references rather than duplicates.
