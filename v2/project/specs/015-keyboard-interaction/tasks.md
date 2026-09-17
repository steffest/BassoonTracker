# 015 — Implementation

Status: implemented and verified 2026-09-11.

- [x] `runtime/textController.js`: the `text` behavior — caret, selection, printable insert, Backspace/Delete, Home/End and arrow keys with Shift-extend, Ctrl/Cmd+A/C/X/V (an in-app clipboard, not the OS one — see below), Enter (`submitted`) and Escape (`reverted`, restoring the value captured on `focus`). Pure, no DOM, no font.
- [x] `runtime/shortcuts.js`: `parseShortcut`/`matchesShortcut`/`shortcutSignature`/`buildShortcutTable`/`matchShortcutTable` — modifiers matched independently, not folded into one flag.
- [x] `runtime/behaviors.js`: `text` added to the one behavior-name -> factory table.
- [x] `runtime/componentTypes.js`: `shortKey` moved from a `button`-only property to `UNIVERSAL_PROPERTIES` (it was already copied onto every node unconditionally in `components.js`, so this only corrects what the registry claimed); a new `tooltip` universal property; the `inputbox` type (`behavior: "text"`, `cursor: "text"`, `draw: "inputbox"`, `field` and `placeholder`).
- [x] `runtime/components.js`: `tooltip` carried the same way `shortKey`/`color` are; the `disabledWhen(state)` hook, alongside `highlightedWhen`.
- [x] `compiler/convert.js`, `compiler/emit.js`: `tooltip` authored/emitted the same way `shortKey`/`color` are.
- [x] `renderers/canvas/drawKinds.js`: the `inputbox` draw kind — background, text or dimmed placeholder, a translucent selection highlight, a caret, both only while focused.
- [x] `runtime/skinModel.js`: a built-in fallback style for `inputbox`, the same shape as `slider`'s.
- [x] `renderers/canvas/mountGeneric.js`:
  - `handleKeyDown`/`handleKeyUp` forward every key to the focused control first (`keyInput()`), falling through to the shortcut table only when unhandled; Tab and Escape stay special-cased ahead of that.
  - `handleEscape()`: blurs whatever was focused (after offering it the key, so a text control can revert) and, independently, fires an open modal's `escape` — regardless of what had focus.
  - A focused text control's `submitted` result also fires the open modal's `enter`; a fallback fires it when Enter reaches nobody at all. A focused button's own Enter is never doubled by either path.
  - `focusableIds()`/`moveFocus()`: Tab cycles only a modal's descendants while one is present, mirroring spec 013's pointer-side `hitTest()` gate.
  - `activateShortcut()`: the shortcut table built once at mount from every node's `shortKey`; blocked and traced like any other disabled activation.
  - `syncDisabled()`: `disabledWhen` evaluated at the top of every `relayout()`, next to the existing `highlightSnapshot`/`traceHighlightChanges` pair, driving the same `setDisabled` the workbench's debug panel already used.
  - Hover-delay tooltips: `updateTooltipHover()`/`hideTooltip()`/`drawTooltip()` — plain renderer-local state (no pure module; see design.md), drawn ad hoc with no new component type.
  - `contextFor()`/`charIndexAt()`: resolves a pointer's local x to a character index for click-to-place-caret and drag-to-select, the one piece of this spec that needs a loaded font and therefore could not live in `runtime/`.
  - `handlePointerDown` now sends an explicit `{ type: "focus" }` to a newly-focused node, not only `moveFocus` (Tab) — see "found while doing it".
- [x] `workbench/interactionLog.js`: `tooltip` added to `KINDS` and to `formatDetail`.
- [x] `tests/keyboardInteraction.test.js` (17 cases): shortcut parsing/matching/table, and the text controller's typing, arrow/Home/End with Shift-extend, Backspace/Delete on a selection, select-all/copy/cut/paste, submit/revert, disabled/unfocused blocking, and pointer-driven caret/selection.
- [x] `tests/componentTypes.test.js`: one existing assertion corrected (`shortKey`'s `where` moved from `"type"` to `"universal"`), matching the property's move.

## Evidence

`node --test "v2/tests/*.test.js"`: 178 tests, all passing, up from 161 (17 new, one corrected).

`node v2/build.mjs app`: succeeds; the compiled skin picks up the new `inputbox` builtin style automatically (`app/skin.js` regenerated). `node v2/build.mjs dist` could not be run in this environment — the installed `esbuild` binary is for `win32-x64`, not this machine's platform, a pre-existing mismatch unrelated to this spec (`node_modules/@esbuild/win32-x64` is the only platform package present). The authored application's loose-ends count is unchanged at 24; nothing in `app.yaml` uses `inputbox`, `tooltip` or `shortKey` yet, since no shipped screen needs one (same call spec 013 made for the overlay layer before any type used it).

Two hand-built-tree browser scenarios, driven with real Chromium via Playwright (`chromium-cli` was not available in this environment; installed `playwright` and its Chromium browser instead — see design.md's clipboard section for what that installation also revealed).

**Scenario A** (no modal — shortcut, disabledWhen, tooltip, text editing): 9 checks, all passing.
| check | result |
|---|---|
| Ctrl+K activates its button from anywhere | fires |
| toggling `enabled` false disables the target button (visually dimmed) | fires, dimmed |
| clicking the disabled target does nothing | no activation |
| toggling `enabled` true re-enables it | clickable again |
| hovering 150ms | no tooltip yet |
| hovering 750ms total | tooltip shown, text correct, positioned near the cursor |
| moving away | tooltip hidden |
| Ctrl+A then typing replaces the whole selection | `"hel"` -> `"X"` |
| Ctrl+V pastes the in-app clipboard | `"X"` -> `"Xhel"` |
| Escape reverts to the value at the most recent focus, not the mid-edit one | `"Xhel"`, mid-edit `"Xhelmore"`, after Escape `"Xhel"` |

**Scenario B** (a hand-built `modal: true` overlay, the mechanism verified the same way spec 013 verified clipping — see design.md's scope decision): 7 checks, all passing.
| check | result |
|---|---|
| clicking a button outside the modal | nothing (spec 013's pointer gate, re-confirmed) |
| Tab+Enter cycled ten times | only ever activates the modal's own button, never the outside one |
| the modal's own text field is clickable and editable | yes |
| Escape reverts that field to its pre-focus value | yes (`""`) |
| Escape also fires the modal's `escape`, regardless of what had focus | yes |
| Enter with nothing focused fires the modal's `enter` | yes |
| Enter on a focused OK button activates only that button, no doubled `enter` | yes |

## Found while doing it

- **A pointer-focused control never actually captured a "focus" moment.** `buttonController` and `valueController` both set their own `focused` flag from their `pointerdown` case, so nothing in `mountGeneric.js` ever sent a separate `{ type: "focus" }` event on a mouse click — only `moveFocus` (Tab) did. That was invisible until a control needed something *else* to happen exactly at the moment focus arrives: `revertTo` for Escape. The first version of the browser scenario caught it immediately — Escape reverted to whatever was currently typed, a no-op, because `revertTo` had last been set (if ever) by a Tab, not by the click that actually focused the field. Every unit test had been passing because each one constructed its own `{ type: "focus" }` input directly, which is exactly the case that hid the gap: the pure tests were correct about what the controller does with a focus event, not about whether the renderer ever sent one from a click. Fixed in `handlePointerDown`: it now sends `{ type: "focus" }` itself when the pressed node differs from whatever was focused a moment ago, so both paths that can newly focus a node send the same event.

- **The native OS clipboard bridge this design started with does not work, and was removed rather than kept as a fallback nobody could exercise.** The plan was `copy`/`cut`/`paste` `ClipboardEvent`s alongside the in-app clipboard, following spec 014's precedent that a focused canvas receives ordinary DOM events. Verified empirically (Playwright driving real Chromium, with and without `clipboard-read`/`clipboard-write` permissions granted): a canvas with no native text selection and no `contenteditable` never receives one of these events for the keyboard shortcut, because the browser's default action that would dispatch it does not apply to a plain canvas at all — and the browser's own context menu, the other way a user reaches "Paste", is already prevented throughout Interact mode by `handleContextMenu`. The three listeners were dead code reachable by nothing, so `Ctrl+V` was rewired to read the in-app clipboard directly at `keydown`, which is what the browser scenario above actually exercises. Recorded in design.md rather than silently dropped, because "wire the obvious DOM event" reads as a safe assumption right up until it is tested.

- **Everything else landed as designed.** The modal-scoped Tab, the Escape/Enter cascade rules (unconditional for Escape, conditional for Enter to avoid doubling a focused button's own activation), `disabledWhen`/`syncDisabled`, the shortcut table, and the tooltip timer all matched their design.md description on the first pass through the browser scenarios; only the two items above needed a correction.

## Known limits

Tracker-specific keyboard behaviour (note entry, octave F-keys, hex/decimal step values) is not here; it belongs to the pattern grid and document model, P6/P7. There is no compiler vocabulary for authoring `disabledWhen` from YAML yet — the mechanism exists, nothing in `app.yaml` drives it, because there is no document state worth disabling a control on until P6. `modalDialog`, `tooltip` and `dropdown` remain undeclared component types (P5); this spec only built the mechanisms they will need, verified against a hand-built tree, exactly as spec 013 did for the overlay layer. There is no mouse-drag text selection across a scrolled/long field (`inputbox` is one line with no internal scrolling), no caret blink, and no OS clipboard integration (see above). Package **P4 is now complete** (spec 014's pointer half plus this spec's keyboard half).
