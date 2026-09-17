# 015 — Design

## Shape of the change

Keyboard input follows the same split spec 014 set up for pointer input: pure recognition/parsing in `runtime/`, DOM plumbing only in the renderer.

```
raw DOM keydown/keyup
   |
   v
mountGeneric.js          which node is focused; is a modal present
   |                      -> forwards the key to the focused node's controller first
   v
runtime/textController.js   (only for a focused "text" behavior node)
   |                      -> { handled, changed, value, submitted, reverted, ... }
   v
mountGeneric.js          if unhandled: runtime/shortcuts.js matches the key against
                         the shortcut table built from every node's `shortKey`
                         -> dispatch(id, "click"), respecting `disabled`
```

Nothing here is a new pointer gesture, so `runtime/pointerRouter.js` is untouched; the text controller's pointer input (click-to-place-caret, drag-to-select) reuses the existing capture/drag delivery, adding one new behavior name to the same `runtime/behaviors.js` table spec 014 built.

## Focused-first key routing

`mountGeneric.js`'s `handleKeyDown`/`handleKeyUp` stop special-casing Tab/Enter/Space and instead forward every key to the focused node's controller (if any), through the same `feed()` spec 014 already funnels pointer input through:

```js
function handleKeyDown(event) {
    if (mode !== "interact") return;
    if (event.key === "Tab") { event.preventDefault(); moveFocus(event.shiftKey ? -1 : 1); return; }
    if (event.key === "Escape") { event.preventDefault(); handleEscape(); return; }

    const modal = modalOverlay();
    if (focusedId) {
        const result = feed(focusedId, keyInput(event));
        if (result && result.handled) {
            event.preventDefault();
            if (result.submitted && modal) dispatch(modal.id, "enter");
            return;
        }
    }
    const target = matchShortcut(shortcutTable, event);
    if (target) { event.preventDefault(); activateShortcut(target); return; }
    if (event.key === "Enter" && modal && !focusedId) { event.preventDefault(); dispatch(modal.id, "enter"); }
}
```

`keyInput(event)` is `{ type: "keydown", key, ctrlKey, metaKey, shiftKey }`. Every existing controller already has a `keydown`/`keyup` case (Enter/Space for a button); this only widens what reaches it and adds the same for `keyup`. A button on an arbitrary key still reports `handled: false`, so nothing about spec 014's button/value/scroll behaviour changes — INT-019 is this file's regression list, and the same buttons, sliders and spin boxes from spec 014's scenario are re-run to prove it.

**Why the shortcut table is not consulted when a control is focused and ignores the key.** It is: `result.handled` being false is exactly the fallthrough. The requirement (INT-015) is narrower than it sounds — a focused text field *handles* every printable key itself (see below), so a same-letter shortcut elsewhere is never reached while typing, without the renderer needing to know that "text" is the reason.

## Modal-scoped focus and dialog keys

`moveFocus(direction)` computes its candidate list from `modalOverlay()` when one is present:

```js
function focusable() {
    const modal = modalOverlay();
    if (!modal) return interactiveIds;
    const within = new Set(flatten(modal).map(n => n.id));
    return interactiveIds.filter(id => within.has(id));
}
```

`handleEscape()`:

```js
function handleEscape() {
    if (focusedId) {
        feed(focusedId, { type: "keydown", key: "Escape" }); // lets a text control revert itself
        feed(focusedId, { type: "blur" });
        focusedId = null;
    }
    const modal = modalOverlay();
    if (modal) dispatch(modal.id, "escape");
}
```

Escape always blurs whatever was focused (a plain button has no "Escape" case in its controller, so this is the only thing that happens for it) and always fires the open modal's `escape`, regardless of what had focus — a user backing out of a dialog should not have to un-focus a button first. Enter is deliberately not symmetric: it only reaches the modal when nothing consumed it (no focused control) or a text field's own Enter says it submitted, so a focused OK/Cancel button's own activation is never doubled by a second, modal-level `enter`.

`escape` and `enter` join `click`/`change`/`doubleClick`/`secondaryClick` as dispatchable events (spec 014 already generalized `dispatch(id, event, detail)` for exactly this reason); no component type declares a handler for either yet; the mechanism is verified by mounting a hand-built tree with a `modal: true` overlay, the same technique spec 013 used to verify clipping and the modal input gate before any type declared them.

## The text behavior

One new controller, `runtime/textController.js`, and one new type, `inputbox`, with `behavior: "text"`, `cursor: "text"`, `draw: "inputbox"`.

Like the value controller, **the bound field is authoritative for the committed string**; the controller does not hold it. What it does hold, in its `state` (alongside `hover`/`pressed`/`focused`/`disabled`, so `visualStateOf` exposes them to the draw kind for free): `caret` (an index into the string) and `selectionStart` (an index, or `null`). `contextFor()` grows one more case, supplying the current string and, for a pointer input with a resolved point, the character index under it:

```js
} else if (behavior === "text") {
    extra.value = String(mockState.get(node.field) ?? "");
    if (input.local) extra.charIndex = charIndexAt(node, input.local.x); // font-dependent; renderer-side
}
```

`charIndexAt` walks the label's characters accumulating `font.getTextWidth` until it passes the local x, exactly the inverse of how the draw kind will place the caret. It lives in the renderer (`mountGeneric.js`), not the controller, because it needs the loaded font; the controller only ever sees the resolved index.

Inputs the controller handles, all pure integer/string arithmetic on `input.value`/`input.caret`/`input.selectionStart`:

| input | effect |
|---|---|
| `pointerdown` | focus; caret = `charIndex`; selection cleared; remembers the press index as a drag anchor |
| `drag` | selection = `[anchorIndex, charIndex]`; caret = `charIndex` |
| `keydown "ArrowLeft"/"ArrowRight"` | caret ±1, clamped; with Shift, extends/creates the selection instead of just moving |
| `keydown "Home"/"End"` | caret to 0/length, same Shift rule |
| `keydown "Backspace"/"Delete"` | deletes the selection if one exists, else one character before/after the caret; `changed: true` |
| a single printable character (`key.length === 1`, no Ctrl/Meta) | replaces the selection or inserts at the caret; `changed: true` |
| `ctrl/meta+A` | selects the whole string |
| `ctrl/meta+C`/`X` | `clipboardWrite` is the selected text (`X` also deletes it, `changed: true`) |
| `ctrl/meta+V` (carries `clipboardText`) | replaces the selection or inserts at the caret; `changed: true` |
| `keydown "Enter"` | `submitted: true`, no text change |
| `keydown "Escape"` | `reverted: true`, `revertTo` is the value captured on `focus` |
| `focus` | records `revertTo = input.value`; caret to the string's end |

**A controller's own `pointerdown` case is not where focus is captured.** `buttonController` and `valueController` both set their `focused` flag directly from `pointerdown`, because neither needs anything *else* to happen at that moment. A text control does: `revertTo` must be the value at the moment focus arrived, not whatever `pointerdown`'s own bookkeeping happens to see. So `mountGeneric.js`'s `handlePointerDown` sends an explicit `{ type: "focus" }` before the pointerdown itself whenever the pressed node differs from whatever was focused a moment ago - the same event `moveFocus` (Tab) already sent, now sent by both paths that can newly focus a node, not just one of them. Found by the browser scenario, not the unit tests: the pure tests all constructed `focus` explicitly, which hid that the renderer's pointer path never had, until this fix, sent one at all.

`feed()` grows the two outcomes a value control's `changed`/`scrollTo` pair already established a place for:

```js
if (result.changed && (typeof result.value === "number" || typeof result.value === "string")) applyValue(node, result.value);
...
if (result.submitted) dispatch(id, "submit");
if (result.reverted) applyValue(node, result.revertTo);
```

`applyValue` was already type-agnostic (it writes a field and fires `change`); the `typeof` check widening to include `string` is the only change needed there. Reverting is "write this value back," so it reuses the same path rather than inventing a second one — the field visibly changes back, and a `change` handler sees that as a change, which it is.

**Clipboard is in-app only, and that was a finding, not the original plan.** The first draft of this design wired the browser's native `copy`/`cut`/`paste` `ClipboardEvent`s alongside the in-app one, on the assumption (stated in spec 014's precedent for other DOM events) that a focused element gets them for its own keyboard shortcut. It does not: verified empirically in Chromium, with `page.keyboard.press("Control+v")` and with `context.grantPermissions(["clipboard-read", "clipboard-write"])` granted, a canvas with no native text selection and no `contenteditable` never receives a `copy`, `cut` or `paste` event for the keyboard shortcut - the browser's default action that would dispatch one simply does not apply to it. (A real user's context-menu "Paste" cannot reach it either: `handleContextMenu` already prevents the browser's own menu throughout Interact mode.) The three listeners this design originally added were consequently dead code reachable by nothing, so they were removed rather than left as an inert bridge nobody could exercise or verify.

What actually works, and is what INT-013's acceptance and the unit tests rest on: `runtime/textController.js` never touches `navigator.clipboard` or a `ClipboardEvent`; `clipboardWrite`/`clipboardText` are plain result/input fields. The renderer keeps one in-memory string, `lastClipboard`, that Ctrl+C/X write to (from `result.clipboardWrite`) and that rides along on *every* keydown as `clipboardText` (`keyInput()` in `mountGeneric.js`), so the controller's own `Ctrl/Cmd+V` case can paste it without any event ever needing to fire. Cut/copy/paste work end to end inside the application, with no permissions and no async gap; they do not reach the operating system's clipboard, and nothing here claims they do.

## Drawing

One new draw kind, `inputbox`, in `renderers/canvas/drawKinds.js`:

- the style's background (a panel, exactly like a slider's track);
- the label text (already resolved by `textOf(node)`, since a `field`-bound label was already generic before this spec), or, when the field is empty, the style-dimmed `placeholder` property (the one new property `inputbox` declares beyond `field`, matching v1's `InputBox.placeholder`);
- a selection highlight — a translucent fill from `getTextWidth(text.slice(0, selStart))` to `getTextWidth(text.slice(0, selEnd))` — drawn only while focused and a selection exists;
- the caret — a 1px vertical bar at `getTextWidth(text.slice(0, caret))` — drawn only while focused, and blinking via the existing per-frame redraw driven by any state change rather than a new timer (a caret move already redraws; while idle it simply stays solid, which is a smaller, honest scope cut from v1's 300ms blink and is recorded as such).

No new artwork: `runtime/skinModel.js`'s built-in fallback skin gets an `inputbox` entry the same shape as `slider`'s, backed by `panel_dark`. A real authored skin style is not added, because nothing in the current application YAML uses an `inputbox` yet — same call spec 013 made for the overlay layer before any type used it.

## The shortcut table

`runtime/shortcuts.js`, pure:

```js
parseShortcut("Ctrl+Shift+S") -> { key: "s", ctrl: true, shift: true, alt: false, meta: false }
matchesShortcut(parsed, { key, ctrlKey, shiftKey, altKey, metaKey }) -> boolean
buildShortcutTable(nodes) -> Map<string, nodeId>   // keyed by the normalized signature
```

A single letter/digit key normalizes to lowercase; anything longer (`"Escape"`, `"F5"`, `"ArrowLeft"`) is compared against `KeyboardEvent.key` case-insensitively. This is the "modifier keys distinct" requirement the roadmap named: v1 has one `isMetaKeyDown` boolean; here Ctrl, Shift, Alt and Meta are four independent flags, so `Ctrl+S` and `Ctrl+Shift+S` are different shortcuts rather than one collapsing into the other.

`mountGeneric.js` builds the table once at mount from every node's `shortKey` (already a recorded, if previously inert, property since spec 009) and consults it in the keydown fallthrough above. `activateShortcut(id)`:

```js
function activateShortcut(id) {
    const controller = controllers.get(id);
    if (controller && controller.state.disabled) {
        trace("activation", { instance: id, result: "blocked-disabled", detail: "shortcut ignored; control is disabled" });
        return;
    }
    trace("input", { instance: id, input: "shortcut" });
    dispatch(id, "click");
}
```

A duplicate `shortKey` across two nodes keeps the first registration and is reported with `console.warn`; a compiler-time diagnostic for it is a smaller follow-up, not this spec (there is no other authored-content conflict check that runs at runtime instead of compile time yet, and adding the compiler plumbing for one property is disproportionate here).

## Command enablement: `disabledWhen`

`runtime/components.js` grows the same passthrough `highlightedWhen` already has:

```js
if (typeof props.disabledWhen === "function") out.disabledWhen = props.disabledWhen;
```

`mountGeneric.js` gets `syncDisabled()`, structurally identical to the existing `highlightSnapshot`/`traceHighlightChanges` pair, called once at the top of `relayout()` (which already runs after every state change and every gesture):

```js
function syncDisabled() {
    for (const node of allNodes) {
        if (typeof node.disabledWhen !== "function") continue;
        const controller = controllers.get(node.id);
        if (!controller) continue;
        let value = false;
        try { value = Boolean(node.disabledWhen(mockState)); }
        catch (error) { console.error(`[v2] disabledWhen failed for ${node.id}`, error); }
        if (controller.state.disabled !== value) setDisabled(node.id, value);
    }
}
```

This is the mechanism spec 011 flagged as owed and the roadmap assigned here; it is not yet reachable from authored YAML, because there is no document state worth disabling a control on until P6. `disabledWhen` today is for hand-written trees and generated-app glue code, exactly where `highlightedWhen` started before spec 012 gave it a real rule to read.

## Tooltips

No component type, no draw kind, no skin entry — a `tooltip:` universal property (a plain string, carried in `components.js` and `compiler/convert.js` next to `shortKey`/`color`) and a small piece of renderer state, the same weight as the existing `dropActive` flag:

```js
let tooltipTimer = null, tooltipFor = null, tooltipPoint = null;
const TOOLTIP_DELAY_MS = 500;
```

`handlePointerMove` clears the pending timer and hides the tooltip whenever the hit node changes; if the new node has a non-empty `tooltip`, it schedules `setTimeout(..., TOOLTIP_DELAY_MS)` that sets `tooltipFor` and redraws. A press, a mode switch, or the pointer leaving the canvas cancels it immediately. `draw()` paints it last, after the drop-zone border: a small filled/stroked box (`ctx.fillRect`/`strokeRect`, the same primitives `drawOverlayOutline` already uses) sized from `assets.font.getTextWidth`, positioned from the last pointer point and clamped inside the canvas.

Showing and hiding both trace: `trace("tooltip", { instance, text, shown })`. `workbench/interactionLog.js`'s `KINDS` list gets `"tooltip"` added, and `formatDetail` a case for it — spec 014 found out the hard way that a kind missing from that list is invisible rather than merely uncoloured, so this is checked directly in this spec's browser scenario rather than assumed.

The 500ms delay and the lack of a blink timer on the text caret are both named departures from v1 (which shows a tooltip instantly and blinks a caret every 300ms); v1 never had this data point since it has no delay logic at all to point at, so this is a design choice, not a divergence discovered mid-port, and it costs nothing to change later.

## What this deliberately does not do

- **No tracker-specific keys.** Note entry, octave F-keys and hex/decimal step values read from the pattern grid's document, which does not exist until P6/P7. This spec's shortcut table and text controller are generic; the pattern grid will very likely want its own key routing layered in front of them, not inside them.
- **No compiler vocabulary for `disabledWhen`.** The hook exists and is synced; nothing in YAML can author it yet, because there is no document state to name.
- **No OS clipboard integration.** Tried, found not to reach a plain canvas in practice (see above), and removed rather than kept as inert code. A real bridge, if ever wanted, needs a different mechanism entirely - most likely a hidden, off-screen `contenteditable` or `<textarea>` kept focused in parallel with the canvas, which is a real design commitment (focus management for two elements, IME implications) and not something to smuggle in as a side effect of this spec.
- **No caret blink.** A redraw already happens on every relevant state change; adding a timer purely to blink one pixel is not worth a new redraw source before P8 measures redraw cost.
- **No mouse-drag text selection across a scrolled/long field.** `inputbox` today is one line with no internal scrolling; that need does not exist until a screen wants a longer field.
- **No new component type.** `inputbox` is the one exception, promoted for the same reason `spinBox` was in spec 014: an acceptance line names it directly and nothing else in the catalogue exercises the path. `modalDialog`, `tooltip` and `dropdown` stay P5.
