# 022 — Design

## No new mechanism; two small vocabulary additions

Every one of the four screens is expressible in the catalogue as it stood after spec 021: `panel`, `label`, `button`, `radioGroup`/`radioItem`, `checkbox` and `listbox` are all it takes. The only real gap authoring them surfaced was in `compiler/recipes.js`'s prose-action vocabulary, which had exactly two shapes (`toggle X`/`toggle X on click` and `set X`) and nothing for a one-shot command with no value and no on/off state - clearing a track, inserting a pattern-table entry. Both additions are documented in requirements.md and covered by `tests/recipes.test.js`.

## Screen by screen

- **`components/infoBar.yaml`**: a `panel` (`layout: { width: fill, height: fixed }`, matching `controlBar`'s own top-level shape) containing one field-bound `label` (the status/title text - v1 concatenates `"${status}: ${info}"` when a status is set; this spec authors one label bound to a single field rather than porting that string-building, which is P6/a real capability's job once there is a real status to show) and one `button` ("More info"). Favorite, share and the spinner are out of scope (see requirements.md).
- **`components/editPad.yaml`**: a `panel` with two child `panel`s ("Track", "Pattern" - each a `label` over three `button`s: Clear/Copy/Paste). `buttonGroup` was considered for the two columns; a plain `panel` was used instead because each column also needs its own header `label`, which `buttonGroup`'s bare `{ childrenIn: "items" }` has nowhere to put (its items are the buttons themselves, not a label-plus-buttons composite) - not a gap, just the wrong tool for a labelled column.
- **`components/optionsPanel.yaml`**: seven `panel` rows, each a `label` (the row's own heading) plus a `radioGroup` (the row's mutually exclusive choices, `variant: buttons` matching `controlBar`'s own already-authored mode/display rows) and, for four of the seven, a `checkbox`. Every row's `radioGroup` carries `actions: - change: setX`; every checkbox carries `actions: - click: toggleX`.
- **`components/songPatternList.yaml`**: a `panel` (`direction: row`) containing a `listbox` (`field: song.position`, three placeholder items standing in for real pattern-table entries, which do not exist until P6's document model does) and a column of four `button`s (step up/down, insert, delete), each with its own `actions:`.

All four are added to `app.yaml`'s `main` content as bare scalar references, the same way `controlBar`/`songProperties` already are. `infoBar` replaces the ad hoc three-label `statusBar` panel `app.yaml` had authored directly (song title/playback status/"main status" as three separate labels with no real screen behind them) rather than sitting alongside it, since it is a closer, single-purpose port of the same idea `statusBar` was standing in for.

## What this deliberately does not do

- **No menu bar, no control panel.** See requirements.md's scope boundaries for exactly what each needs first.
- **No new component type, draw kind, or layout mechanism.** Every screen is composition of already-implemented types.
- **No real capability behind any authored command.** Every command dispatches through the same mocked-command path every existing screen's does; wiring one to a real document/settings module is P6/P9's job.
- **No breakpoints, no responsive relabeling** (v1's info bar shortens "More Info" to "info" to "i" as it narrows; its options panel switches from one row of controls to a 4-column grid under 600px). Reduced visual fidelity was already decided (spec 010's open decision 1); a fixed, single layout per screen is consistent with every earlier authored screen.
