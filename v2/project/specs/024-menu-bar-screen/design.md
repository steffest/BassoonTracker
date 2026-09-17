# 024 — Design

## Shape of the change

Straight authoring, read from `script/src/ui/app/menu.js`'s own `setItems()` call, not reconstructed from memory: File (New, Load File, Save File, Open Random MOD/XM Song, Open Random Playlist), Edit (Undo, Redo, Cut, Copy, Clear → Track/Pattern/Song/Instruments, Paste, Render Pattern 2 Sample), View (Main, Options, File Operations, Sample Editor, Piano, Nibbles, Performance stats), Help (About, Documentation, Sourcecode on Github). Each item is `type: label` (the same shape spec 020's own submenu examples use) with an `actions: - click: <name>` binding named after v1's own `COMMAND.*` constant (`newFile`, `openFile`, `togglePiano`, ...) - camelCase, so the compiler's own `actionNameAsProse()` reads it exactly as authored, matching every prior spec's convention.

`Clear`'s own four items reuse `track.clear`/`pattern.clear` by name (`clearTrack`/`clearPattern` are exactly the same authored names spec 022's `editPad.yaml` already uses), so the emitter's existing "one module per resolved command" rule collapses them into the one `trackClear.js`/`patternClear.js` action both screens now share - no duplication, and a generated app's Clear-menu item and edit-pad button genuinely run the same code. `Clear Song`/`Clear Instruments` are new subjects for the same `verb-action` recipe (spec 022), resolving to `song.clear`/`instruments.clear`.

`togglePiano` is the one item that happens to match an existing recipe by accident of phrasing (`actionNameAsProse` reads it as "toggle piano", matching `toggle-generic`, relaxed by spec 022 to accept a bare name) - reported here as an observation, not something this spec engineered.

## What this deliberately does not do

Everything spec 022/023 already declared out of scope for the menu bar stays out of scope here too: the vumeter, the Key/Midi indicators, real behavior, hover-switching, arrow-key navigation. Most of the bar's two dozen commands (`new file`, `show options`, `undo`, `cut`, ...) have no existing recipe and are not given one - a real menu is not a reason to invent a recipe for every verb it happens to use; `unresolved-action-reference` is exactly as legitimate an outcome here as it always has been (`action1`/`action2`, the fixture this spec's content replaces, made that same point from day one).
