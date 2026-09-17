# 027 — Tasks

- [x] Re-read `script/src/ui/components/numberdisplay.js` in full; confirmed the re-parse-as-integer/clamp-never-snap edit model rules out reusing `valueController`/`textController` as-is.
- [x] `runtime/numberDisplayController.js` (new): the `digitEntry` behavior - `paddedValue()`/`clampOnly()` exported for reuse, focus/click caret placement, ArrowLeft/Right caret movement clamped to the real digits, ArrowUp/Down (+/-1, ignoring `step`), Backspace/Delete, digit/`-` insertion, the wheel (+/- `step`, clamped), Enter blurs (no revert/submit distinction, matching v1).
- [x] `runtime/behaviors.js`: registers `digitEntry`.
- [x] `runtime/componentTypes.js`: `numberDisplay` promoted (`implemented: true`, `behavior: "digitEntry"`, `draw: "numberDisplay"`, `cursor: "text"`, new `padLength` property).
- [x] `renderers/canvas/drawKinds.js`: `numberDisplay` draw kind (padded label, a static caret while focused, a disabled dim).
- [x] `renderers/canvas/mountGeneric.js`: `textOf()`'s `"digitEntry"` case (the padded string, via the same `paddedValue()`/`clampOnly()`); `contextFor()`'s `"digitEntry"` case (bounds, clamped value, padLength, charIndex). No change to `feed()` - the controller's `{ changed, value }` result already flows through the existing generic `applyValue()` path.
- [x] `compiler/emit.js`: seeds a `numberDisplay`'s own field to `boundsOf(node).min`.
- [x] `tests/numberDisplay.test.js` (new): registry facts; `paddedValue`/`clampOnly` directly; every controller edit operation (focus/caret placement, digit splice, clamp-never-snap, Backspace/Delete, ArrowUp/Down ignoring step, the wheel using step, ArrowLeft/Right's clamp, Enter, a non-digit key, disabled, `setDisabled`); a shallow draw-kind smoke test.
- [x] `tests/compiler.test.js`, `tests/componentTypes.test.js`: the two "declared but not implemented" example usages moved from `numberDisplay` to `scrollbar`.
- [x] `node --test "v2/tests/*.test.js"` passes (313, up from 295); `node build.mjs app`/`dist` succeed unchanged (nothing yet authors one).
- [x] `project/progress.md`, `010-port-roadmap/tasks.md`: record this spec; package P5 is now fully closed.
