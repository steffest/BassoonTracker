# 018 — Implementation

Status: implemented and verified 2026-09-11.

- [x] `runtime/componentTypes.js`: `rangeSlider` promoted to `implemented: true` (`behavior: "value"`, `behaviorOptions: { mode: "absolute", axis: "x" }`, `draw: "rangeSlider"`, `cursor: "ew-resize"`). `knob` promoted to `implemented: true` (`behavior: "value"`, `behaviorOptions: { mode: "relative", axis: "y" }`, `draw: "knob"`, `styled: false`, `cursor: "ns-resize"`). `scrollbar`'s description updated to record the deliberate deferral.
- [x] `renderers/canvas/mountGeneric.js`: controller construction reads `node.vertical` generically and overrides the axis, alongside the existing type-level `behaviorOptionsOf()`.
- [x] `renderers/canvas/drawKinds.js`: `rangeSlider` (slider's track/thumb math, generalized to `node.vertical`) and `knob` (canvas-primitive arc gauge and pointer) draw kinds. Four new constants (`KNOB_MIN_ANGLE`, `KNOB_MAX_ANGLE`, `KNOB_SIZE`, `KNOB_LABEL_HEIGHT`, `RANGE_SLIDER_LENGTH`).
- [x] `runtime/skinModel.js`: a built-in fallback style for `rangeSlider`, without a fixed `height` (see "found while doing it").
- [x] `tests/valueControls.test.js` (8 cases) and `tests/componentTypes.test.js` (the "remaining declared-not-drawn" list narrowed further).

## Evidence

`node --test "v2/tests/*.test.js"`: 199 tests, all passing, up from 191 (8 new).

`node v2/build.mjs app`: succeeds, 24 loose ends, unchanged - nothing in `app.yaml` authors either type yet; `slider`/`spinBox`'s own generated code is untouched.

One hand-built-tree browser scenario, Playwright/Chromium: a horizontal `rangeSlider`, a vertical one, and a `knob`, all against the built-in fallback skin. 7 checks, all passing: clicking three-quarters along the horizontal track sets ~75; clicking near the top of the vertical track sets a high value and near the bottom a low one (confirming bottom-to-top); dragging up on the knob increases its value and the wheel changes it too; the horizontal `rangeSlider` shows an `ew-resize` cursor and the knob an `ns-resize` one. No console errors. A screenshot after all interactions shows a thin horizontal track, a correctly tall vertical track beneath it, and a rotary dial with its pointer visibly rotated to match a low value.

## Found while doing it

- **A shared style cannot express two different lengths for two different travel axes, and the first draft's built-in style tried to.** It copied `slider`'s `width: 120, height: 20` verbatim, and the vertical branch of `measure()` read `style.height || 120` as the vertical instance's on-screen length - landing on `20`, the *wrong dimension's* value, not merely a small one. The unit tests did not catch this: the first draft of `tests/valueControls.test.js` passed a style with only one axis's dimension set per test case, which never exercised the collision. It was caught by mounting a hand-built tree in a real browser and reading `layoutRects()` back: the vertical track measured `20px` tall, visually indistinguishable from the horizontal one above it. Fixed by introducing `RANGE_SLIDER_LENGTH`, a plain constant used for the vertical instance's length instead of the style, removing the style's now-misleading fixed `height`, and adding a regression test that mounts a style with both dimensions set and asserts the vertical instance is not collapsed by it.
- **Everything else matched the design going in.** Reusing `valueController.js` unchanged for both types, and the generic `node.vertical` axis override, both worked on the first pass; the knob's arc/pointer math needed no correction once the angle convention (`arc`'s `endAngle` is the varying one, not `startAngle`) was gotten right in the test harness itself, not the production code.

## Known limits

`scrollbar` remains declared, not implemented - see requirements.md's scope decision. There is no authored vocabulary for a per-orientation `rangeSlider` length (a vertical instance is always `RANGE_SLIDER_LENGTH` long unless a future spec adds one). `knob`'s drawing is fixed-size (`measure()` ignores the rect it is offered); nothing authors one yet to need it to vary.
