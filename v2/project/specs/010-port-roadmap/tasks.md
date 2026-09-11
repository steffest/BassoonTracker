# 010 — Progress

Status: in progress. This spec is a plan; its "implementation" is the allocation of the packages below as their own numbered specs, so nothing here is code. Three packages are done — P1 as spec 009, P2 as spec 012, P3 as spec 013 — and P4 is half done: its pointer work landed as spec 014 and its keyboard work is spec 015, which is next.

Each package is checked off when *its* spec reaches implemented-and-verified, not when it is allocated.

## Packages

- [x] **P1 — Component registry.** Allocated as spec [009](../009-component-registry/requirements.md); implemented and verified 2026-09-10.
- [x] **P2 — Playback capability.** Allocated as spec [012](../012-playback-capability/requirements.md); implemented and verified 2026-09-10. Both fixtures load and play, the engine is unit-tested headless, the context is created on the click, and no audio scheduling passes through the store. The offline comparison against v1's own engine moved to P13, which is where it belongs.
- [x] **P3 — Layout: clipping, scrolling, overlays, z-order.** Allocated as spec [013](../013-layout-foundations/requirements.md); implemented and verified 2026-09-10. Clipping, a scroll viewport, the overlay layer with a modal slot and authored direction all landed; the current application renders unchanged. Two pieces moved on purpose: interactive scrolling (wheel, drag, a scrollbar thumb) needs P4 and goes with it, and a dropdown flipping above its trigger needs the dropdown type from P5.
- [~] **P4 — Interaction: drag, wheel, text, double-click, shortcuts.** Split in two when it was started, because the pointer work and the keyboard work share nothing but the renderer they land in and each is worth verifying on its own.
  - [x] **The pointer half**, allocated as spec [014](../014-pointer-interaction/requirements.md); implemented and verified 2026-09-10. Pointer capture and drag, wheel routed up the ancestry, a viewport scrolled by wheel, drag and thumb, double and secondary click, a behavior and a cursor declared per component type, the `slider` type, `spinBox` promoted from a placeholder to a working control, and file drag-and-drop that loads a module through a reserved host capability. Of the package's stated acceptance, a slider drags to a value, a list wheel-scrolls, a double-click fires, and every gesture appears in the Interaction log.
  - [ ] **The keyboard half**, to be allocated as spec 015: the focus model where the focused element sees keys first and may swallow them, text entry with a caret, selection and clipboard, the declared shortcut table replacing v1's fifty-case switch, hover tooltips with a delay, Enter and Escape in a dialog, and rebuilding command enablement (see the note under this package in design.md). Of the acceptance, an input box editing with a caret, Enter and Escape in a dialog, and an authored shortcut firing its command remain.
- [ ] **P5 — The rest of the component catalogue.** Verification: every v1 type is declared with a contract; each implemented one has a draw kind, skin styles, a catalogue entry, gallery fixtures and tests; the options and disk-operation screens are authored YAML with no coordinates.
- [ ] **P6 — Document model, undo, selection.** Verification: note and track and pattern edits, block copy and paste, a hundred-step undo; no song data in the outline or the store.
- [ ] **P7 — The pattern grid.** Verification: node count independent of song size; cursor and selection survive scroll, resize and skin reload; frame work recorded.
- [ ] **P8 — Renderer performance.** Verification: idle after settle; a grid scroll with playback holds the frame budget; no perpetual redraw.
- [ ] **P9 — Persistence, providers, file operations.** Verification: settings survive a reload; a module loads from each provider; exports are readable by v1.
- [ ] **P10 — Features and the plugin path.** Verification: a cold trace shows no feature code before first open; repeated opening during load creates one instance; closing during load leaves it closed; a failure retries.
- [ ] **P11 — The remaining specialized surfaces.** Verification: per surface, against its v1 counterpart.
- [ ] **P12 — DOM renderer and accessibility.** Conditional on open decision 2.
- [ ] **P13 — Parity harness.** Started by spec 012: three fixtures under `v2/tests/fixtures/` and a stub context that records the schedule, so the engine's behaviour is asserted in Node. Still to do: the offline render comparison against v1's own engine, with a documented sample rate and tolerance.

## Milestones

- [~] **D — it plays** (P2 done, P13 partly): the generated application plays real modules; the render comparison against v1 remains.
- [~] **E — it looks like the tracker** (P3 done, P4's pointer half done, P4's keyboard half and P5 remain)
- [ ] **F — it edits** (P6, P7, P8)
- [ ] **G — it ships** (P9, P10, P11)
- [ ] **H — optional** (P12)

## Open decisions to resolve

Recorded in [requirements.md](requirements.md); each blocks only the package that needs it.

- [ ] 1. Visual fidelity: all 10 fonts and about 113 sprites, or a smaller authored skin? (blocks nothing; changes P5's size)
- [ ] 2. Is the DOM renderer required? (decides P12)
- [ ] 3. Which plugins port? (scopes P10 and P11)
- [ ] 4. Does the existing `api/` stay? (scopes P9)
- [ ] 5. Is MP3 export dropped, or is a vendored encoder accepted? (scopes P9)
- [ ] 6. Are the Amiga host integrations in scope? (assumed no)

## Notes

The inventory this plan rests on was taken on 2026-09-10 from `script/src`, `script/plugins` and `player/src`, and is summarised in [requirements.md](requirements.md). If the v1 application changes materially before a package starts, re-measure that package's area first: several of its numbers are counts of things a single authoring session can change.
