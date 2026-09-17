# UI layout model

Recorded 2026-09-16, from the user directly, correcting a wrong architectural conclusion the [visual parity plan](010-port-roadmap/visual-parity-plan.md)'s own audit reached (it read a bordered box with an "X" close button as a floating overlay over an always-visible main screen - the resemblance is real, but the mechanism underneath it is not an overlay at all). This document is steering, alongside [product.md](product.md): read it before authoring or restructuring any screen-level YAML.

## The model

The application is divided into fixed **horizontal sections**, stacked top to bottom, each spanning the full width:

1. **Menu bar section**
2. **Song properties section**
3. **Control bar section**
4. **Pattern section** - itself split **vertically** into a sidebar and a main area (the only nested split in the model; every other section is a plain horizontal band)
5. **Piano section**

Each section can show one of several **"full section" panels** - alternative content that entirely fills that one section. Only one such panel is active per section at a time. Switching which one is active is a same-section swap, not a stack, not a new layer, not a window.

**Where the specific screens live:**

- **Options, File Operations, Nibbles** each swap into the **song properties section**.
- **Sample Edit** swaps into the **pattern section** (alongside/replacing the classic grid or multitrack view, respecting that section's own sidebar split).

## Why this matters, and the mistake it corrects

A panel like Options has a close ("X") button, which looks exactly like a floating overlay's own dismiss control. **It isn't one.** Clicking it does not close a layer stacked on top of something else - it returns *that section* to its own default content. The panel was never drawn over anything; it was drawn *instead of* that section's default view, in that section's own space, sized to that section's own space - nothing more.

The wrong conclusion this corrects: reading "a bordered, closable box with content underneath still visible elsewhere on screen" as "v1 uses floating overlays over a single always-visible main screen, and v2 should build a real overlay/z-order mechanism to match." The other regions were visible in those screenshots because *they are separate sections*, unaffected by whichever panel is currently swapped into the song-properties section specifically - not because anything was layered on top of anything.

**The actual goal - stated explicitly by the user:** avoid floating panels as much as possible, specifically to avoid panel overlap/clutter. Every section "clicks into place": each section always shows exactly one of its own available alternative views, swapped in, never stacked as a floating layer over another section's content.

This is a real, deliberate design goal, **not** a strict, already-fully-realized invariant - the user's own words: "this might change in the future, and it's not 100% consistent, but still: that's the goal." Treat it as the target every screen-layout decision should default toward, not as a constraint nothing may ever cross.

## What this means for v2's own structure

v2's current `normalMainView` conflates several of v1's own distinct sections into one combined vertical stack (`fileOperationsPanel`/`optionsPanel`/`sampleEditPanel`/`editPad`/`patternViewPanel`/`songPatternList`/`songProperties` are all siblings gated by the same `main-view.value`, with the first three additionally gated by `top-view.value`). Because `optionsPanel` and its siblings are not scoped to their own, independent "song properties section" region, a tall swapped-in panel pushes every *later* sibling in that same combined stack down or off-screen, rather than affecting only its own section's own space.

The real fix direction, following from this model: give v2's own layout real, separate, fixed sections matching the five above (each its own visibleWhen-swap zone with its own bounded space), rather than one large combined region. `optionsPanel`/`fileOperationsPanel`/`nibblesPanel` belong in a "song properties section" region, swapped in place of whatever that section's own default content is - not pushed into the same stack as `editPad`/`patternViewPanel`/`songPatternList` (which belong to the pattern section's own default state, alongside `sampleEditPanel` as that section's own alternative).

**Do not build an overlay/z-order mechanism to chase this.** The [visual parity plan](010-port-roadmap/visual-parity-plan.md)'s own Task 5 ("design and land the overlay mechanism") was based on the wrong reading and should be re-scoped as "give each of v1's five sections its own real, independent swap zone" instead - a restructuring of which field gates which sibling group, not a new rendering/z-order capability.
