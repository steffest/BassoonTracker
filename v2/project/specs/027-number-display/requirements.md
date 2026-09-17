# 027 — numberDisplay

Date: 2026-09-11. Kind: feature. Status: specified. Implements `numberDisplay`, the one type spec 017 moved out of its own "simple leaves" cluster after finding it was a real, bounded, editable control rather than a leaf - the last piece of package **P5**'s component catalogue left unimplemented, now that all six of P5's named screens are authored (specs 022-026).

## Purpose

`script/src/ui/components/numberdisplay.js` (257 lines), read again in full for this spec: a fixed-width, left-padded digit string (`padLength`, default 4) with a caret, editable by click-to-place-the-caret then typed digits, Backspace/Delete, ArrowUp/Down or the wheel. The one fact that decides its whole design: v1 re-parses the *entire padded string* as an integer on every edit (a typed digit, a deletion) and only ever clamps the result to `[min, max]` - never snaps it to a step grid, unlike a slider's drag or a spin box's wheel. ArrowUp/Down always move the value by exactly 1 regardless of the authored `step`, which governs only the wheel. Neither `runtime/valueController.js` (bounds, but no caret) nor `runtime/textController.js` (a caret, but no bounds and no re-parse-as-integer step) fit this shape alone, confirming spec 016's own open question: it needs a controller of its own.

## User stories and acceptance

- **NUMDISP-001 — A bounded, digit-padded number, editable by caret and keyboard:** As an author, `type: numberDisplay, field: tracks.value, min: 2, max: 32, padLength: 2` draws a left-padded readout; clicking places a caret, typing a digit or `-` splices it into the padded string and re-parses the whole thing as an integer, Backspace/Delete remove the digit before/at the caret and re-parse the same way, ArrowLeft/Right move the caret (never left of where the real digits start), ArrowUp/Down move the value by exactly 1, the wheel moves it by the authored `step`. Acceptance: every one of v1's own edit operations is unit-tested directly against the new controller, including that typing/deleting only clamps and never snaps to a step grid.
- **NUMDISP-002 — No regressions:** Acceptance: the unit suite passes (with the two existing tests that used a still-placeholder type as their example moved from `numberDisplay`, now implemented, to `scrollbar`); `node build.mjs app`/`dist` succeed unchanged, since nothing yet authors a `numberDisplay`.

## Non-functional requirements

The new controller (`behavior: "digitEntry"`) is gated the same way every other behavior is - a registry entry, one factory in `runtime/behaviors.js` - and its activation flows entirely through `mountGeneric.js`'s existing generic `{ changed, value }` handling (`applyValue()`), needing no new branch there at all, the same reuse spec 018's `rangeSlider`/`knob` already demonstrated for a type that turned out to fit an existing shape closely (here, only the *result* shape is shared, not the controller itself).

## Scope boundaries

In scope: `runtime/numberDisplayController.js` (the `digitEntry` behavior); promoting `numberDisplay` to `implemented: true` with a `padLength` property added to its contract; a draw kind; `compiler/emit.js` field seeding.

Out of scope: the LED font itself and its three size variants (`size: "small"/"medium"/"big"`) - accepted and validated, but drawn with the same built-in font every other unstyled P5 type uses, matching spec 010's decision to reduce visual fidelity; a blinking caret (static while focused, the same simplification spec 015 already made for `inputbox`); any authored use in `app.yaml` (nothing currently authors one - v1's own uses, the track-count/BPM/octave readouts, belong to screens not yet authored, or already covered by `spinBox` where one already is, e.g. `controlBar.yaml`'s own track-count control). Browser verification: not performed, for the same reason specs 019-026 recorded none.
