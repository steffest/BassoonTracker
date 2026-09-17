# 022 — the screens

Date: 2026-09-11. Kind: feature. Status: specified. Implements the screens step of package **P5** of spec [010](../010-port-roadmap/requirements.md), the port roadmap, following spec [021](../021-composition-types/requirements.md) - the last implementing cluster, which closed out the component catalogue. Spec 016's design.md named this step last on purpose: "the screens are last, once enough of the catalogue exists to author them without inventing coordinates."

## Purpose

Six v1 surfaces were named as P5's remaining work: the menu bar, the control panel, the options panel, the info bar, the edit pad, and the song and pattern lists. This spec reads each one's actual v1 source rather than assuming, and authors every one that the current catalogue and mechanism can actually express with no coordinates. Two cannot be, for reasons specific to each, and are recorded rather than forced.

## Inventory (read from v1 source, 2026-09-11)

| screen | v1 source | shape | this spec |
|---|---|---|---|
| info bar | `script/src/ui/infopanel.js` (188 lines) | a status/title text and a "more info" button; favorite, share and an animated spinner are secondary affordances with no v2 assets to draw them | authored |
| edit pad | `script/src/ui/editPanel.js` (85 lines) | two columns (Track, Pattern) of three buttons each (clear/copy/paste) | authored |
| options panel | `script/src/ui/optionsPanel.js` (311 lines) | seven labelled rows, each a set of mutually exclusive choices and, for four of them, an accompanying checkbox | authored |
| song and pattern list | `script/src/ui/app/components/songPatternList.js` (136 lines) | a scrollable list of pattern-table entries plus four buttons (step the highlighted entry up/down, insert, delete) | authored |
| menu bar | `script/src/ui/app/menu.js` (190 lines) | a `Menu` component with up to three levels of `subItems` (File > Edit > Clear, for one) | **deferred** - needs `menu` promoted from a placeholder first |
| control panel | `script/src/ui/app/controlPanel.js` (398 lines) | tracker-mode buttons, a visible-track-count selector, a two-button view switch, all read against six hand-written breakpoints (945/820/725/650/620/512px) and an inter-panel view-routing event (`EVENT.showView`) | **deferred** - needs the declared breakpoint mechanism spec 013 already flagged as owed to "the screens", which turns out still not to exist, plus a view-routing concept nothing in v2 has yet |

`script/src/ui/app/components/songControl.js` (119 lines - the song/pattern play-type radio group plus Play/Record) is not a new screen: it is what `components/controlBar.yaml` already authors, and reads as a near-exact match once compared line for line.

## User stories and acceptance

- **SCR-001 — The info bar shows what is playing and can open more information:** As a user, a status/title label (bound to a state field) and a "More info" button sit in a horizontal bar. Acceptance: the label draws whatever field it is bound to; the button is a real, focusable, clickable control.
- **SCR-002 — The edit pad offers clear/copy/paste for the current track and pattern:** As a user, six buttons, two columns of three under "Track"/"Pattern" labels, each dispatch their own command. Acceptance: `track.clear`/`track.copy`/`track.paste`/`pattern.clear`/`pattern.copy`/`pattern.paste` each resolve to a real (mocked) command, not an unresolved reference.
- **SCR-003 — The options panel offers every v1 setting as a labelled, mutually exclusive choice, with a checkbox where v1 has one:** As a user, seven rows, each a label and a `radioGroup` of choices; four of the seven also show a `checkbox`. Acceptance: every row's choice-group and every checkbox dispatch their own command, resolving through the prose-action vocabulary with no unresolved reference.
- **SCR-004 — The song and pattern list shows the pattern table and can be edited:** As a user, a `listbox` of pattern-table entries sits beside four buttons (step up, step down, insert, delete). Acceptance: selecting an item and each button dispatch their own command; the list scrolls like any other listbox.
- **SCR-005 — No regressions:** Acceptance: the unit suite passes; the current application (its existing four sections) renders and compiles exactly as before; `node build.mjs app`/`dist` succeed.

## Non-functional requirements

Every new screen is authored YAML under `project/specs/application/current/components/`, referenced from `app.yaml` exactly the way `controlBar`/`songProperties` already are - a bare scalar content item. No new component type, draw kind, or runtime mechanism is needed for any of the four; every one is expressible in the catalogue spec 021 completed. Where an authored command has no existing recipe match, the prose-action vocabulary (`compiler/recipes.js`) gains a small, generic addition rather than a screen-specific one - consistent with how `toggle-play-state`/`set-value` already work for every screen, not just the one that first needed them.

## Scope boundaries

In scope: `components/infoBar.yaml`, `components/editPad.yaml`, `components/optionsPanel.yaml`, `components/songPatternList.yaml`, wired into `app.yaml`; two small, generic prose-action recipe additions (`compiler/recipes.js`) that the four screens' commands need and no existing recipe covers.

Out of scope, each recorded as a real, specific gap rather than folded into this spec's scope:

- **The menu bar.** `menu` stays a placeholder (spec 016's own decision, upheld through specs 020/021); promoting it - including its `subItems` nesting, which is exactly `submenu`'s own shape from spec 020 - is its own future spec.
- **The control panel.** Needs two things nothing in v2 has yet: a declared breakpoint mechanism (spec 013's design sketch named this, then deferred it to "the screens" in its own tasks.md; this spec is the one that discovered it is still not built) and a view-routing concept for switching which panel is visible in response to a command (v1's `EVENT.showView`) - the closest existing mechanism, `tabPanel`, shows one *authored child* at a time and does not route a whole separate panel tree by command. Building either speculatively, for a screen that is not otherwise ready, would be shaping mechanism to a guess.
- **The favorite/share buttons and the animated spinner** on the info bar - no v2 skin assets exist for any of the three (heart, share, "boing" spinner strip), and inventing them is authoring art, not a screen.
- **Real behavior.** Every authored command is a real, resolved (mocked) command binding, exactly like every existing screen's; none has a real capability yet (P6's document model and P9's settings/persistence own that). This is consistent with `controlBar.yaml`'s own current state, not a new gap this spec introduces.
- Browser verification: not performed, for the same reason specs 019-021 recorded none - this environment still has no Playwright/Chromium install (checked again for this spec).
