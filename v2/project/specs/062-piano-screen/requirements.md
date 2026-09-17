# 062 — Piano screen (placement)

Date: 2026-09-15. Kind: feature. Status: specified. Closes the piano's own three-part arc (060 engine, 061 leaf, 062 screen) and, with it, P11 - the port roadmap's last package of remaining specialized surfaces.

## Purpose

Places `pianoView` (spec 061) for the first time: a toggle-shown panel with a close button and an octave spinbox, matching v1's own docked, bottom-of-screen piano panel.

## What v1 actually does (read from source, not assumed)

- `script/src/app.js:93-94`: `COMMAND.togglePiano` triggers `EVENT.toggleView("piano")`.
- `script/src/ui/mainPanel.js:51-73,194-197`: owns the actual panel (`App_pianoView()`), hidden by default. On `EVENT.toggleView("piano")`, toggles it and shrinks the remaining main-content height by `Layout.pianoHeight` (200px at the default/largest breakpoint - `script/src/ui/app/layout.js:73`, smaller at narrower breakpoints, which this port does not build, matching every other breakpoint-driven layout decision already recorded, e.g. spec 049) whenever it is shown - it sits *below* whichever of the classic grid/multitrack view/Nibbles is currently showing, not instead of it.
- `script/src/ui/app/pianoView.js` itself (already read in full for spec 060/061): a close button (`COMMAND.togglePiano` again - the same toggle both opens and closes it) and an octave `SpinBox` (`min`/`max` depending on tracker format - already exactly `domain/song#getCurrentOctave`/`setCurrentOctave`'s own clamp, spec 031/060/061), alongside the `pianoView` key grid itself.
- `script/src/ui/app/components/patternSidebar.js:58-65`: a second entry point, a sidebar button also triggering `COMMAND.togglePiano` - out of scope here (see Decisions; the existing View-menu "Piano" label, `app.yaml:108-111`, already reaches the same command).

## Decisions and assumptions

- **`piano.active`, resolved via the existing `toggle-generic` recipe with no new vocabulary** - confirmed empirically: `togglePiano` -> "toggle piano" -> `piano.toggle` command, `piano.active` mock field. The View menu's existing "Piano" label (`app.yaml:108-111`) already targets `togglePiano`; nothing there needs to change.
- **A new sibling in `normalMainView`'s own content list** (spec 048), gated `visibleWhen: {field: piano.active, oneOf: [true]}` - the same boolean-`oneOf` shape `nibblesInfoPanel` (`app.yaml`) already uses, not a string-valued view-mode field the way `main-view.value`/`pattern-view.value` are. Placed *last* in that list (after `songProperties`), matching v1's own bottom-docked position - and, since it is gated independently of `main-view.value`, it can show or hide regardless of whether the classic grid, multitrack view, or Nibbles is active underneath, exactly mirroring v1's own "sits below whichever view" behavior.
- **A fixed `height: 200`, no responsive breakpoint sizing** - v1's own `Layout.pianoHeight` varies by breakpoint (200/150/100); this port does not build responsive breakpoints (an already-recorded scope boundary, e.g. spec 049), so the single, largest value is used, the same simplification every other fixed-size specialized-leaf panel in this port already makes.
- **A real capability for the octave spinbox.** Unlike `pattern-view.set`/`top-view.set` (pure UI state, deliberately mocked), the octave genuinely drives what note a click on the piano plays (`domain/song#getCurrentOctave`, read directly by `runtime/pianoController.js`, spec 061) - there is real behavior for a capability to have. `current-octave.set`/`current-octave.value` resolve via the existing `set-value` recipe with no new vocabulary. Authored with the wide FT ceiling (`min: 0, max: 7`) and the narrower ProTracker range enforced inside the capability itself (via `domain/song#setCurrentOctave`'s own existing clamp/no-op) - the same shape spec 050's own finetune capability already established for a tracker-format-dependent range.
- **The close button reuses the same `togglePiano` action** the View-menu label already does (v1's own close button does exactly this too - the same command opens and closes). Labeled "Close" (this port's own established convention for a plain dismiss action, e.g. the loop creator's "Cancel" - not v1's own bare "x" glyph, which this port does not reproduce anywhere else either).
- **The sidebar toggle button (`patternSidebar.js`) is out of scope**, recorded rather than dropped: a second entry point to the identical `togglePiano` command the View menu already reaches - a real, freely-buildable follow-up (an icon-only button in whatever this port's own equivalent of the pattern sidebar turns out to be, itself unbuilt), not a blocker for closing this arc.

## User stories and acceptance

- **PIANO-SCREEN-001 — Hidden by default, shown when `piano.active` is true.** `computeGenericLayout()` against the real, compiled `app.yaml`: with `piano.active` unset (falsy, the real app's own seeded default), the piano panel and everything inside it (`pianoView`, the octave spinbox, the close button) are absent; with it `true`, all three are present, sized, and positioned below `songProperties`.
- **PIANO-SCREEN-002 — Shows regardless of `main-view.value`/`pattern-view.value`.** The panel is present with `piano.active: true` whether `main-view.value` is unset (normal) or `"Nibbles"`, and whether `pattern-view.value` is `""`/`"Column view"` or `"Row view"` - independent gates, not a shared one.
- **PIANO-SCREEN-003 — The octave spinbox is a real capability.** `current-octave.set` calls `domain/song#setCurrentOctave` and republishes the actual resulting (possibly clamped/unchanged) value - not a generated mock.
- **PIANO-SCREEN-004 — No regressions.** Full unit suite passes; `node compiler/generate.js` shows no new warnings; `node build.mjs app` succeeds with only the expected new loose ends (none, if `piano.toggle`/`current-octave.set` are both real - confirmed by reading `LOOSE-ENDS.md` back, not assumed).

## Non-functional requirements

- Headless verification only (no browser-automation dependency in this environment, the same recorded reason every spec since 019 has given).

## Scope boundaries

In scope: a new `components/pianoPanel.yaml`, `app.yaml`'s updated `normalMainView` content list, one new `domain/song/index.js` capability (the octave spinbox), `capabilities.js`'s new mapping, and every test this placement touches.

Out of scope, recorded rather than dropped:

- The pattern-sidebar's own second `togglePiano` entry point (`patternSidebar.js`) - this port's own pattern sidebar is unbuilt.
- Responsive breakpoint sizing for the panel's own height.
- Recording notes into the pattern from a piano click (spec 060's own recorded exclusion, unchanged).

**Closes P11.** No further specialized surfaces are recorded as remaining once this spec lands.
