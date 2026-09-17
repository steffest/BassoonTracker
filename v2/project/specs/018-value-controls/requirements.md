# 018 — Value controls: rangeSlider and knob

Date: 2026-09-11. Kind: feature. Status: specified. Implements the second implementing cluster of package **P5** of spec [010](../010-port-roadmap/requirements.md), the port roadmap, following spec [017](../017-leaf-types/requirements.md)'s leaf cluster.

## Purpose

Spec 016 declared `rangeSlider`, `knob` and `scrollbar` together as "value-like controls", the roadmap's next cluster after the leaves. Reading both v1 sources confirmed the grouping: `rangeSlider` (`script/src/ui/components/rangeSlider.js`) is a bounded value on a track, exactly what `slider`'s existing `value` behavior already models, and `knob` (`script/src/ui/components/knob.js`) is a bounded value moved by a vertical drag, exactly what `spinBox`'s relative mode already models. Neither needed a new controller - only a new draw kind each - which is the clearest sign a cluster is genuinely "simple" in the sense spec 017 first tried to apply to `numberDisplay` and found did not hold there.

## Scope decision

`scrollbar` is declared but not implemented here. Spec 016's own contract for it already said why: it is "specialized-view territory (P7/P11) more than generic-catalogue territory," for a track whose visible window and total extent are both authored - a waveform or arrangement view, neither of which exists. Implementing it now would mean shaping its contract to a guess rather than a real consumer, the same reasoning that moved `numberDisplay` out of spec 017's cluster. It stays for whichever specialized view first needs it.

## User stories and acceptance

- **VAL-001 — A rangeSlider holds a bounded value on a track:** As an author, `type: rangeSlider, field: some.field` behaves exactly like `slider` (press jumps to position, drag follows the pointer, wheel steps by `step`) because it is the same controller. Acceptance: dragging, pressing and the wheel all reach the bound field the same way `slider`'s do; `min`/`max` behave identically.
- **VAL-002 — A rangeSlider can be laid out vertically:** As an author, `vertical: true` on a `rangeSlider` makes it read top-to-bottom instead of left-to-right - the value increases toward the top, matching the "up is more" convention every mixer fader uses. Acceptance: the controller's own axis and the draw kind's own layout both follow `vertical`, read generically (by property name, not by checking the node's type) in exactly one place each; a vertical instance's on-screen length comes from a fixed constant, not from the skin style, because one shared style cannot express two different lengths for two different travel axes (found and fixed during this spec's own browser verification - see design.md and tasks.md).
- **VAL-003 — A knob holds a bounded value moved by a vertical drag:** As an author, `type: knob, field: some.field` changes its value by dragging vertically (up increases) and by the wheel, defaulting to the 0-100 range v1's own knob used. Acceptance: drag and wheel both reach the bound field; the drawn pointer angle increases monotonically with the value across the whole range; a `disabled` knob is dimmed and does not respond to either.
- **VAL-004 — v1's click-toggles-its-own-disabled quirk is not carried forward:** Acceptance: nothing in the knob's behavior disables itself on a plain click; disabling is external, exactly as it is for every other control (`disabledWhen`, or the workbench's debug panel).
- **VAL-005 — No regressions:** Acceptance: the unit suite passes; `slider` and `spinBox`'s own behavior and drawing are unchanged, since neither's registry entry or draw kind was touched; `node build.mjs app` still succeeds with the same loose-ends count.

## Non-functional requirements

No new controller, no new file under `runtime/` beyond what spec 017 already added - both types reuse `runtime/valueController.js` exactly as `slider`/`spinBox` already do. The per-instance vertical-axis override is one generic, two-line addition where controllers are built, gated on a plain property name (`node.vertical`), not on a type name.

## Scope boundaries

In scope: `rangeSlider`, `knob`, their draw kinds, and the generic per-node axis override.

Out of scope: `scrollbar` (see scope decision above); any skin vocabulary for a per-orientation style length (`rangeSlider`'s vertical length is a code constant, not authorable, until a real vertical instance needs one to be); any authored use in `app.yaml`.
