# 010 — Design: the work packages

Twelve packages plus one cross-cutting harness. Each becomes its own numbered spec when it is started; the number in brackets is only a suggestion of order, not a reservation.

Ordering rule: dependency first, then risk, then visible value. Where those disagree, the package that unblocks more later work goes first.

## P1 — Component registry [done, spec 009]

Declares every component type once, with its property contract, container shape, styling, interactivity, selection semantics and draw kind. Every other package adds to it rather than editing six call sites. A type can be declared before it is implemented, which is how the remaining twenty-odd types get their contracts recorded early.

## P2 — Playback as the first real capability [done, spec 012]

**Goal.** v2 loads a real module and plays it through the transport that already exists.

**Depends on.** Nothing new. The capability seam (`capabilities.js`) and the lazy action modules landed with spec 007.

**Why here.** It is the highest-risk unknown in the whole port and the most independent piece of work. It needs no layout, interaction, document-model or renderer changes, and it is the only package that can invalidate the architecture, so it goes first while it is cheap to react to.

**Design sketch.** Adapt `player/src` (5,593 lines, no UI imports) into `v2/domain/playback/` with recorded provenance, rather than `script/src/tracker.js`, which imports `ui/stateManager.js` and `ui/ui.js`, or `script/src/audio.js`, which creates an `AudioContext` at module-import time. The capability exposes load, play, stop, and an observation of position; the audio context is created on the first user gesture. Scheduling keeps v1's lookahead model (a clock timer, a growing lookahead, whole steps scheduled ahead of the audio clock) and its effect handling, including the roughly 54 effect branches, ported as data-driven as the code allows. Only scalars reach the state store: playback status, song title, position, tempo. The UI reads position by polling the audio clock from the frame loop, never the reverse. `player/src` also carries the MOD and XM read path, which comes along; the rest of the formats are P4.

**Acceptance.** A fixture plays through v2's Play button. An offline render of that fixture matches v1's within a documented tolerance. Changing layout or reloading the skin does not restart playback or recreate the audio context. Nothing under `script/src` is imported. No audio scheduling passes through the store.

**Rough size.** About 5,600 lines adapted, less whatever is dropped; plus the harness in P13.

## P3 — Layout: clipping, scrolling, overlays and z-order [done, spec 013]

**Goal.** The layout engine can express v1's screens without absolute coordinates.

**Depends on.** P1.

**Why here.** Everything with a list, a menu, a dialog or a tooltip is blocked on it, which is most of the remaining UI. It is also the package that repays spec 003's step 4, which promised clipping bounds and never delivered them.

**Design sketch.** The layout result gains a clip rectangle per node, and hit-testing respects it. A viewport container carries a scroll offset, so a list scrolls its content rather than each list reimplementing index windows as v1 does. An overlay layer sits above the tree with explicit z-order for dropdown popups, context menus, tooltips and modal dialogs, and one modal slot that swallows input, mirroring v1's single-modal rule. The authored layout language gains `direction`, alignment and minimum and maximum sizes, and a declared breakpoint mechanism replaces v1's hand-written cascade at 945, 820, 725, 650, 620 and 512 pixels. Inspect mode must keep working through all of it: the inspection overlay is itself an overlay consumer.

**Acceptance.** A list scrolls and clips, a modal traps input and releases it, a dropdown opens above its trigger when it would overflow, hit-testing agrees with what is visible after scroll and resize, and the current application renders unchanged.

## P4 — Interaction: drag, wheel, text, double-click, shortcuts [pointer half done, spec 014]

**Split in two when it was started.** The pointer work and the keyboard work share nothing but the renderer they land in, so each became its own spec and each could be verified on its own. Spec [014](../014-pointer-interaction/requirements.md) delivered capture, drag, wheel, viewport scrolling, double and secondary click, declared behaviors and cursors, the `slider` type, a working `spinBox`, and file drag-and-drop. Spec 015 owes the focus model, text entry, the shortcut table, tooltips, dialog keys and command enablement. The package is complete when both are.

**Also rebuilds command enablement.** Spec 003's `runtime/commands.js`, retired by spec 011, was the only implementation v2 has had of a command registry that answers whether a command *can* run: the renderer drew a disabled control from it and the dispatcher refused to run one. The current pipeline dispatches through action bindings with no such gate. Rebuilding it belongs here, because a disabled control is an interaction state, and P6 then makes it depend on the document.

**Goal.** The input model covers what v1's controls actually need.

**Depends on.** P1, and P3 for overlay and modal routing.

**Why here.** The controller today knows hover, press, focus and Enter or Space. v1 attaches drag, drag-start, wheel, hover-exit and key handlers at over three hundred sites; sliders, knobs, scrollbars, the piano and block selection are all drag, and every numeric control is wheel.

**Design sketch.** Extend the controller vocabulary with drag (captured to the element that received the press, as v1 does), wheel, double-click and secondary click. Add a focus model where the focused element sees keys first and may swallow them, and text entry with a caret, selection and clipboard. Replace v1's roughly fifty-case keyboard switch with a declared shortcut table that the compiler can report on, keeping modifier keys distinct rather than lumping them into one boolean as v1 does. Add file drag-and-drop onto the canvas, cursor shapes, and hover tooltips with a delay. MIDI input stays a capability behind the seam, not input plumbing.

**Acceptance.** A slider drags to a value, a list wheel-scrolls, an input box edits text with a caret, Enter and Escape work in a dialog, a double-click opens something, an authored shortcut fires its command, and every one of those still produces a trace in the Interaction log.

## P5 — The rest of the component catalogue [after P3 and P4]

**Goal.** Every non-specialized v1 screen is authored in YAML from registered types.

**Depends on.** P3, P4.

**Design sketch.** Declare all of v1's types in the registry first, with contracts and `implemented: false`, so the catalogue documents the target before the work starts. Then implement roughly in dependency order: icon, image, inputbox, numberdisplay, spinBox, rangeSlider and sliderBox, knob, scrollbar, listbox, dropdown, menu and submenu, modalDialog, tabPanel, tooltip, collapsePanel, animsprite, buttonGroup. Each brings a draw kind only if it looks like nothing that exists, skin styles for its states, a catalogue entry, State gallery fixtures and tests. The screens then follow: the menu bar, the control panel, the options panel, the info bar, the edit pad and the song and pattern lists.

**Acceptance.** Each type appears in the catalogue with its contract and in the gallery with its states. The options and disk-operation screens are authored YAML with no coordinates. The compiler reports any authored property that is not in a contract.

**Rough size.** Twenty types; v1 spends about 3,400 lines on them, and the ported versions should be smaller because layout, skinning and state come from the system.

## P6 — The document model, undo and selection [after P2]

**Goal.** A song document that is not the UI state store, with editing on top.

**Depends on.** P2, which brings the loader and the model shape.

**Design sketch.** The song lives in a domain module with an explicit API, not a module-private variable reachable only through a getter as in v1. Patterns stay dense per-row-and-channel structures; samples stay typed arrays. The store keeps only the scalars the UI binds to. An edit layer covers v1's seven edit-action kinds with a hundred-step undo and the same coalescing of sequential value edits. Selection becomes an explicit protocol with the eight verbs v1 routes through one global callback, plus a clipboard that is not private to the editor module.

**Acceptance.** Put a note, clear a track, copy and paste a block, undo a hundred steps, and confirm that no song data appears in the outline, the store or a save file that is not a module.

## P7 — The pattern grid [after P3, P4, P6]

**Goal.** The specialized-component contract, proven on the screen that matters most.

**Depends on.** P3, P4, P6.

**Why here.** This is the architectural bet: a component that owns its own drawing and data access without the outline knowing about cells. If it does not hold, the renderer and outline split needs revisiting before the remaining surfaces are attempted.

**Design sketch.** A declared component type with a model accessor, a viewport, a cursor and a selection. It draws only visible cells, with the per-glyph caching v1 already found necessary, and never creates a node per cell. Vertical and horizontal scrolling come from P3's viewport; keyboard navigation and note entry come from P4, including the thirty-one-entry piano key table.

**Acceptance.** Increasing song size does not increase node count. Scrolling, resizing and reloading the skin preserve cursor and selection. Editing a view specification does not copy or serialize the song. Frame work is measured and recorded.

## P8 — Renderer performance [after P7]

**Goal.** Frame budget with playback running and the grid scrolling.

**Depends on.** P7, which is the first workload worth measuring.

**Design sketch.** Coalesce invalidations into one animation frame instead of drawing synchronously on every event. Then, guided by measurement rather than assumption, add per-node dirty regions or per-element buffers; v1 chose per-element canvases with dirty flags bubbling to parents, which is one known-good answer but not the only one. Keep the frame-rate cap, the frame skipping, and the automatic throttle when the audio clock reports missed deadlines. Make devicePixelRatio handling an explicit option, as v1 does.

**Acceptance.** The canvas goes idle after interaction. A grid scroll with playback holds the budget. No perpetual redraw loop.

## P9 — Persistence, providers and file operations [after P4, P5]

**Goal.** The application remembers, and can load and save from where v1 does.

**Design sketch.** A settings capability over local storage with v1's thirteen keys, applied at startup without v1's fifty-millisecond race against widget construction. Favorites. The five providers (own API, ModArchive, modules.pl, HippoPlayer, Dropbox) behind one interface, keeping the existing `api/` endpoints. The disk-operation screens authored in YAML. The format write path completed here if P4 did not need it: MOD and XM out, XI, WAV, the playlist formats, and the container formats.

**Acceptance.** Settings survive a reload. A module loads from each provider. Save and export produce files v1 can read.

## P10 — Features and the plugin path [after P5]

**Goal.** The lazy feature registry the roadmap has always wanted, with the sample editor as its first tenant.

**Design sketch.** Metadata-only registry, dynamic import, explicit idle, loading, ready and failed states, request deduplication, retry, and disposal separate from module caching. v1's three plugins each receive a differently shaped hand-built dependency bag; v2 gives one documented host interface instead. The sample editor is the first feature and is built on P7's specialized-component contract.

**Acceptance.** A cold trace shows no feature code or assets before first open. Opening repeatedly during load creates one instance. Closing during load leaves it closed. A failure can be retried.

## P11 — The remaining specialized surfaces [after P7, P8, P10]

The multitrack arrangement view, the waveform editor, the piano, the envelope editor, the scopes and the VU meters. Each is a specialized component under P7's contract. Together they are about 4,000 lines in v1, plus the sample editor's 4,000 under P10.

## P12 — DOM renderer and accessibility [optional, after P5]

Only if open decision 2 says yes. It proves the interchangeable-renderer claim, and it buys no parity: v1 is one canvas and a twenty-one-element HTML shell.

It does, however, carry the accessibility story, and that story currently does not exist. Spec 003's renderer put a real `<button>` over every control and got focus, accessible names, native activation and disabled state from the platform; spec 011 retired it, and `mountGeneric.js` has only a single focusable canvas. Whether the semantic layer waits for this package or arrives earlier as its own small piece of work is worth deciding on its own merits, not as a side effect of the DOM-renderer question.

## P13 — Parity harness [cross-cutting, starts with P2]

Fixtures and comparisons, not a phase of its own. A fixture set covering representative effects, loops and pattern transitions; offline render comparison with a documented sample rate and tolerance; sequencing traces; and one browser scenario per package. v1 has no automated tests, so every parity claim in this programme rests on fixtures the port itself creates.

## Dependencies

```
P1 (done)
 ├─ P2 (done) ───────┬─ P6 ─┐
 │                   │      │
 ├─ P3 ─┬─ P4 ─┬─ P5 ┼──────┼─ P7 ─ P8 ─┐
 │      │      │     │      │           │
 │      │      └─ P9 ┘      │           ├─ P11
 │      │                   │           │
 │      └───────────────────┘   P10 ────┘
 └─ P12 (optional, after P5)
P13 runs alongside from P2 onward
```

## Milestones

| milestone | packages | what is true when it is reached |
|---|---|---|
| D — it plays | P2, P13 | a real module plays through v2's transport, with recorded parity evidence |
| E — it looks like the tracker | P3, P4, P5 | every non-specialized screen is authored YAML with no coordinates |
| F — it edits | P6, P7, P8 | pattern editing with undo, at frame budget, with playback running |
| G — it ships | P9, P10, P11 | file operations, lazy features and the remaining surfaces |
| H — optional | P12 | a second renderer and an accessibility story |

## Risks

- **Audio parity is the one risk that can invalidate the plan.** Front-loaded in P2 for exactly that reason. If v1's effect behaviour cannot be reproduced from `player/src`, the fallback is adapting `script/src` after cutting its UI imports, which is more work and must be decided before P6 depends on the model.
- **The overlay layer touches hit-testing, which the workbench inspection overlay also uses.** P3 has to keep Inspect and Interact working, and its acceptance says so.
- **The specialized-component contract is the architectural bet.** P7 proves or breaks it. P11 is deliberately downstream of that answer.
- **No baseline to compare against.** v1 has no tests, so P13's fixtures are the only definition of "the same".
- **Scale.** About 25,000 lines of v1 own code against 6,700 in v2 today. Most of v1's UI lines are replaced by authored YAML plus catalogue types rather than ported line for line; the non-UI lines are adapted with provenance. The plan does not assume the total shrinks, only that the UI part does.

## What this changes from the original roadmap

[IMPLEMENTATION-PLAN.md](../../../IMPLEMENTATION-PLAN.md) steps 5 to 9 were written before the existing application was inventoried, and three of their assumptions did not survive it.

- Step 5 put the DOM renderer next. It buys no parity, so it moves to P12 and becomes conditional.
- Step 9 put playback last. It is independent of the UI work and is the largest risk, so it moves to P2.
- Step 4 claimed clipping bounds, coalesced invalidation and a semantic DOM mirror as delivered scope. Clipping and coalescing were never built and are now P3 and P8. The semantic mirror *was* built, but only in spec 003's renderer, which spec [011](../011-retire-spec003-pipeline/requirements.md) retired on 2026-09-10; v2 therefore has no accessibility layer at all today, and P12 is where it returns.

Steps 7 (lazy features) and 8 (a realistic pattern viewport) survive intact as P10 and P7.
