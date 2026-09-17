# 016 — Design

## Shape of the change

Fifteen new entries in `runtime/componentTypes.js`'s `COMPONENT_TYPES`, each shaped like `menu`'s existing placeholder:

```js
rangeSlider: {
    description: "...",
    implemented: false,
    container: null,               // or a container shape, for the four that hold children
    styled: false,
    interactive: false,
    selection: null,
    direction: null,
    draw: "placeholder",
    authoredIn: null,
    properties: { /* what is already known */ }
}
```

Nothing reads `behavior`, `cursor` or `draw: "placeholder"` differently for these than it already does for `menu`: `isStyledType`/`behaviorOf`/`cursorOf` all gate on `implemented`, so a placeholder type draws the existing dashed box and declares no controller, with no branch anywhere needing to know these fifteen names exist. `knownProperty()`/`acceptedKeys()` do not gate on `implemented` at all, which is the entire point — a contract exists and is checked before the type can be drawn.

## The fifteen entries

Each row names its v1 source (for provenance) and the contract this spec gives it. "Container" means it holds authored children; the shape is the best guess from the v1 source and is expected to be revisited when the type is actually implemented, the same way `spinBox`'s contract grew a `min`/`max`/`step` it did not have as a placeholder.

| type | v1 source | container | contract (properties) | why |
|---|---|---|---|---|
| `icon` | `ui/components/icon.js` | leaf | `icon` (reference: which file-type icon) | Not a `UIElement` in v1 at all — a singleton that draws a coloured file-type glyph into a listbox row's canvas. Declared as a small leaf type because an author authoring a `listbox` row template needs a way to say "put the file icon here", and the roadmap names it as one of the twenty. |
| `image` | `ui/components/image.js` | leaf | `src` (reference: sprite name), `scale` (reference: `"stretch"` or natural size) | A named sprite drawn at natural size (centred, with `horizontalAlign`/`verticalAlign`) or stretched. No interaction state at all in v1. |
| `numberDisplay` | `ui/components/numberdisplay.js` (257 lines) | leaf | `field`, `min`, `max`, `step`, `size` (reference: `"small"`/`"medium"`/`"big"`, an LED font size) | A digit-padded LED-font readout, editable by click-to-focus then digit keys, arrows and Home/End-style cursor motion, or by wheel. Closer to a hybrid of `spinBox` and `inputbox` than either alone: it wants `valueController`'s bounds and `textController`'s caret, over a fixed-width digit string rather than free text. Left undecided here on purpose; whichever it reuses is an implementing-spec decision, not a declaration-spec one. |
| `rangeSlider` | `ui/components/rangeSlider.js` (154 lines) | leaf | `field`, `min`, `max`, `vertical` (kind `text`, coerced to boolean at implementation) | v1's other bounded-value drag control: a knob image on a repeating track, with a vertical orientation `slider` does not have. The roadmap's design sketch lists "rangeSlider and sliderBox" together; no `sliderBox` source file exists anywhere in `script/`, so only `rangeSlider` is declared — inventing a contract for a file that is not there would be a guess dressed as a fact. Likely absorbed into `slider`'s existing `value` behavior with a vertical axis when implemented, rather than becoming a second controller. |
| `knob` | `ui/components/knob.js` | leaf | `field` (the universal `label` already covers the text drawn beneath it) | A rotary 0–100 control: vertical drag changes the value, a plain click (movement under a threshold) toggles `disabled`. That click-toggles-disabled behaviour is v1's own and is flagged here rather than silently carried forward, since it is an unusual thing for a "disabled" flag to do to itself. |
| `scrollbar` | `ui/components/scrollbar.js` | leaf | `field` | Standalone, not a viewport's built-in thumb (spec 013/014 already gave a `viewport` its own): a resizable *range* — drag the middle to scroll, drag either edge to zoom — used where a track's visible window and its total extent are both authored, such as a waveform or arrangement view. Specialized-view territory (P7/P11) more than generic-catalogue territory; declared here because the roadmap lists it, but it may end up implemented alongside whichever specialized view first needs it rather than in isolation. |
| `listbox` | `ui/components/listbox.js` (399 lines) | `{ childrenIn: "items" }` | `field` (selected index), `reorderable` | A scrollable, selectable list with its own up/down buttons and scrollbar, optional custom per-row rendering, and optional drag-to-reorder. The largest of the fifteen; real screens need it (the song list, the sample list, the disk browser), so it is early in the implementing order despite its size. |
| `dropdown` | `ui/components/dropdown.js` (301 lines) | `{ childrenIn: "items" }` | `field` | A closed control showing the selected item that opens a popup list on click. Builds directly on the `layer: "overlay"` / `modal: true` mechanism specs 013 and 015 already shipped and verified — opening one is expected to need no new layout or input mechanism, only a type that uses the existing ones. |
| `submenu` | `ui/components/submenu.js` (210 lines) | `{ childrenIn: "items", itemActions: true }` | none yet | A nested flyout of commands, opened from a `menu` item. Depends on `menu` itself being implemented first, which this spec does not do (`menu` stays exactly as spec 009 left it: declared, `implemented: false`, empty contract) — promoting `menu` and `submenu` together is an implementing spec's call, not this one's. |
| `modalDialog` | `ui/components/modalDialog.js` (135 lines, already read in full for spec 015) | `{ childrenIn: "content" }` | `text`, `ok`, `cancel`, `input` | A centred overlay: a message, optional OK/Cancel buttons, an optional embedded text field. This is the type spec 015's Escape/Enter cascade and spec 013's modal gate were built *for*, verified against a hand-built throwaway type standing in for exactly this. Implementing it should mean wiring a real type onto mechanism that already works, not inventing new mechanism. |
| `tabPanel` | `ui/components/tabPanel.js` (137 lines) | `{ childrenIn: "items" }` | none yet | A row of tab buttons, each showing one child panel; only one is visible at a time. Its v1 implementation also hard-codes a footer strip and a specific tracker layout constant (`Layout.trackControlHeight`), neither of which belongs in a generic catalogue type — the implementing spec's job is to separate "which child is showing" (generic) from "the tracker's own tab bar" (an authored screen built from it). |
| `tooltip` | `ui/components/tooltip.js` (156 lines) | leaf | none yet | Spec 015 already shipped hover-after-a-delay, driven by a plain string `tooltip:` property on *any* type, with no skin and no animation — real, tested, and load-bearing today. This catalogue entry is for what v1's version adds on top: Scale9 panel artwork and an opacity fade. It is declared, `implemented: false`, so the gap between "a tooltip shows" (done) and "a tooltip is skinned and animated" (not done) is visible in the catalogue rather than only in prose. |
| `collapsePanel` | `ui/components/collapsePanel.js` (33 lines) | `{ childrenIn: "content" }` | none (the universal `label` already covers the header text) | A `Panel` subclass with a labelled header background; nothing in the 33 lines actually collapses anything — the name promises more than the v1 code does. Declared under its v1 name for continuity; whether the implemented version actually adds expand/collapse (which nothing in v1 exercises) is an open question for its implementing spec, not settled here. |
| `animSprite` | `ui/components/animsprite.js` (37 lines) | leaf | `sprite` (reference: sprite sheet), `frames` (number) | A frame strip stepped once per tick by v1's `Ticker`. v2's renderer has no per-frame animation clock at all today (redraw is driven by state changes and input, per spec 013/014's design), so implementing this for real is the smallest piece of new *mechanism* in the whole list, not just a new draw kind. |
| `buttonGroup` | none — no v1 source | `{ childrenIn: "items", childType: "button" }` | none yet | Not a port: v1 has no formal grouping type, only ad hoc rows of buttons the layout code happens to place together. The roadmap's design sketch names it anyway, most plausibly to give an author a way to lay out and label a cluster of buttons (a transport row, a set of view toggles) without `radioGroup`'s exclusivity. Declared with the least confidence of the fifteen; its contract is empty on purpose, pending its implementing spec deciding what it is actually for. |

`checkboxbutton` (`ui/components/checkboxbutton.js`, 45 lines) is not in this table: it is a `Button` subclass drawing a checkbox/radio glyph beside its label, and v2's `checkbox` type (spec 009) already does exactly that. Carrying it forward as a second, near-identical entry would be the kind of premature duplication the project avoids elsewhere.

## What this deliberately does not do

- **No draw kinds, no skin styles, no behaviors.** Every one of the fifteen draws the existing `placeholder` box. `styled: false` for all of them, so `isStyledType` (which gates on both `styled` and `implemented`) never asks the skin loader for artwork that does not exist.
- **No decisions the contract table above flags as open** (`numberDisplay`'s controller reuse, `knob`'s click-toggles-disabled behaviour, whether `collapsePanel` collapses anything, what `buttonGroup` is even for) are made here. Flagging them in the table is the deliverable; deciding them is each type's own implementing spec.
- **No authored use anywhere.** Nothing in `project/specs/application/current/*.yaml` references any of these fifteen names. The catalogue documents them; nothing consumes them yet.
