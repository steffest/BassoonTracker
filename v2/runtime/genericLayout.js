// Generic measurement/layout pass for the compiled component tree (spec 005
// Phase 1, extended by spec 013 with clipping, scroll viewports and an
// overlay layer). A container stacks its children in a column or a row;
// explicit layout.width/height "fixed" or "fill" always win; "auto" falls
// back to an intrinsic size measured bottom-up. Pure: no DOM or canvas
// access, so it is unit-testable with a fake `measureLeaf`.

import { typeDirection, componentType, isContainer, packedRowHeightOf } from "./componentTypes.js";

const PADDING = 4;
const GAP = 4;
const MIN_HEIGHT = 20;
// A packed row's own intrinsic width leaves no room for a container margin
// (there is none - rows span the container's full width), only for a
// submenu item's own left text inset plus a nested item's own ">" arrow, the
// same rough allowance v1's own `paddingLeft * 2 + 6` (submenu.js:145) made.
const PACKED_ROW_WIDTH_PAD = 20;

/**
 * v1's own real "5-column" viewport-relative width (`script/src/ui/app/
 * layout.js#setLayout`): `col1W = floor((viewportWidth - 6*margin - 3) / 5)`,
 * `col2W = col1W*2 + margin`, and the menu bar's own real width is
 * `Math.max(col2W, 250)` (`script/src/ui/app/menu.js`'s own `onPanelResize`).
 * Ported exactly, not approximated with a fixed constant (found live: an
 * earlier pass here used a flat 300px stand-in, which is not pixel parity at
 * any viewport width other than the one it happened to be tuned against) -
 * ` layout.width: "col2"` is the only current author of this mode.
 */
function col5Width(w) { return Math.floor((w - 27) / 5) * 5 + 16; }
function columnMargin(w) { return Math.floor((w - col5Width(w)) / 2); }
function col1Width(w) { return Math.floor((w - 27) / 5); }
function patternTrackFrame(w, visibleTracksValue) {
    const col1 = col1Width(w);
    const margin = columnMargin(w);
    const visibleTracks = Math.max(1, Number(visibleTracksValue) || 4);
    const showSidebar = visibleTracks < 17 && w > 620;
    const available = showSidebar ? col1 * 4 + 12 : col5Width(w);
    const left = showSidebar ? margin + col1 + 4 : margin;
    const trackWidth = Math.floor((available - 4 * (visibleTracks - 1)) / visibleTracks);
    const firstTrackOffset = trackWidth < 125 ? 18 : 0;
    return { x: left + firstTrackOffset, width: available - firstTrackOffset };
}
function controlButtonsLeft(w) {
    const col1 = col1Width(w);
    return columnMargin(w) + 4 + col1 + (w < 820 ? Math.floor(col1 / 2) : 0);
}
function modeButtonsLeft(w) {
    if (w < 650) return Math.floor(col5Width(w) / 3) * 2 - 60;
    const col1 = col1Width(w);
    const col4 = columnMargin(w) + 3 * (col1 + 4);
    return col4 - (w < 820 ? Math.floor(col1 / 2) : 0);
}
function modeButtonsWidth(w) {
    const col1 = col1Width(w);
    if (w < 650) return Math.floor(col5Width(w) / 3) + 64;
    return col1 * 2 + 4 + (w < 820 ? Math.floor(col1 / 2) : 0);
}
// v1 advances through the four overlapping 26px Display buttons by 25px,
// then leaves four pixels before the first 32px view button. The resulting
// edge is one pixel left of the earlier approximation because the last
// Display button's width is not another advance.
function modeAuxButtonsLeft(w) { return modeButtonsLeft(w) + modeButtonsWidth(w) - 63; }
function col1ThirdWidth(w) { return Math.floor(col1Width(w) / 3); }
function col2HalfThirdWidth(w) {
    const col1 = col1Width(w);
    return Math.floor(((col1 * 2 + 4) + Math.floor(col1 / 2) + 4) / 3);
}
function controlViewButtonWidth(w) {
    const available = w < 650 ? col5Width(w) : w < 820 ? col1Width(w) : col1Width(w) * 2 + 4;
    return Math.floor(available / 3);
}
function spacing(node, context) {
    const layout = effectiveLayout(node, context);
    return { padding: layout.padding ?? PADDING, gap: layout.gap ?? GAP };
}

function col2Width(viewportWidth) {
    const margin = 4;
    const col1W = Math.floor((viewportWidth - 6 * margin - 3) / 5);
    const col2W = col1W * 2 + margin;
    return Math.max(col2W, 250);
}

// The same two-column span without menu.js's own 250px minimum. AppMainPanel
// uses the raw Layout.col2W value for its logo and instrument regions.
function col2ExactWidth(viewportWidth) {
    return col1Width(viewportWidth) * 2 + 4;
}

function col3Left(viewportWidth) {
    return columnMargin(viewportWidth) + 2 * (col1Width(viewportWidth) + 4);
}

function col2Left(viewportWidth) {
    return columnMargin(viewportWidth) + col1Width(viewportWidth) + 4;
}

function col4Left(viewportWidth) {
    return columnMargin(viewportWidth) + 3 * (col1Width(viewportWidth) + 4);
}

function formulaWidth(mode, viewportWidth) {
    if (mode === "col1") return col1Width(viewportWidth);
    if (mode === "col1Minus5") return col1Width(viewportWidth) - 5;
    if (mode === "col2") return col2Width(viewportWidth);
    if (mode === "col2Exact") return col2ExactWidth(viewportWidth);
    if (mode === "col5") return col5Width(viewportWidth);
    if (mode === "col1Third") return col1ThirdWidth(viewportWidth);
    if (mode === "col2HalfThird") return col2HalfThirdWidth(viewportWidth);
    if (mode === "controlViewButton") return controlViewButtonWidth(viewportWidth);
    if (mode === "modeDisplay") return modeButtonsWidth(viewportWidth) - 126;
    return null;
}

/**
 * A node's own layout, with the most specific matching breakpoint override
 * merged on top (spec 025: `node.breakpoints`, `{ maxWidth, layout }` pairs
 * compiled from the authored `breakpoints:` sequence; spec 075 adds
 * `maxHeight` alongside it, the same shape, for a threshold on the
 * viewport's own height instead of its width - v1's own hand-written
 * cascade, `script/src/ui/app/layout.js`, mixes both kinds of threshold
 * freely, e.g. `mainWidth<650` alongside `me.height<800`). "Most specific
 * matching" mirrors that same cascade: each successive threshold narrows
 * further, so when several are at or beyond the current viewport, the one
 * with the smallest threshold value is the most specific and wins - across
 * both dimensions at once, since nothing authored today needs both on the
 * very same breakpoint entry, but a caller author could. A breakpoint only
 * ever carries the fields it authored (compiled that way), so one that only
 * overrides `direction` never resets `width`, and one that only sets
 * `maxHeight` matches regardless of the viewport's own width.
 */
function effectiveLayout(node, context) {
    if (!node.breakpoints || !node.breakpoints.length) return node.layout;
    let winner = null;
    let winnerScore = Infinity;
    for (const bp of node.breakpoints) {
        const widthOk = bp.maxWidth === undefined || (Number.isFinite(context.viewportWidth) && context.viewportWidth <= bp.maxWidth);
        const heightOk = bp.maxHeight === undefined || (Number.isFinite(context.viewportHeight) && context.viewportHeight <= bp.maxHeight);
        if (!widthOk || !heightOk) continue;
        const score = Math.min(bp.maxWidth ?? Infinity, bp.maxHeight ?? Infinity);
        if (score < winnerScore) { winner = bp; winnerScore = score; }
    }
    if (!winner) return node.layout;
    return {
        ...node.layout, ...winner.layout,
        width: winner.layout.width !== undefined ? winner.layout.width : node.layout.width,
        height: winner.layout.height !== undefined ? winner.layout.height : node.layout.height,
        direction: winner.layout.direction !== undefined ? winner.layout.direction : node.layout.direction,
        resizable: winner.layout.resizable !== undefined ? winner.layout.resizable : node.layout.resizable
    };
}

// The source graph doesn't always declare row vs. column. Resolution order
// (spec 013): the authored `layout.direction`, then the component type's own
// declared direction (a radioGroup is always a row of choices), then this
// delivery's documented default, where a container with a *fixed* height
// reads as a single toolbar row and an auto/fill-height container stacks its
// children as a column of sections. The last step is kept because the
// current application relies on it for its top bar and control bar.
function isRow(node, context) {
    const layout = effectiveLayout(node, context);
    const authored = layout && layout.direction;
    if (authored) return authored === "row";
    const declared = typeDirection(node.type);
    if (declared) return declared === "row";
    return layout.height.mode === "fixed";
}

/**
 * A node with an unmet `visibleWhen` (spec 025) is absent from layout
 * entirely - the same effect a closed overlay or a collapsed container's
 * content already has.
 *
 * `oneOf`'s own entries are always plain strings (compiler/yaml.js has no
 * boolean/number literal type at all - every scalar is a string, coerced by
 * whichever consumer needs a different type; `visibleWhen.oneOf: [true]`
 * compiles to the string "true", not the boolean). A field driven by a real
 * capability (as opposed to a generated mock's own string-labeled toggle)
 * can easily hold a genuine JS boolean instead (e.g.
 * domain/settings#applyToggle's own `next`, spec 062's own `piano.active`) -
 * so the live value is coerced to a string before comparing, the same type
 * every `oneOf` entry already is. Found as a real, confirmed, previously
 * untested bug (spec 062): `nibbles-info-visible.value` (spec 049) has had
 * this identical shape since it was authored and would never actually show
 * its own panel either.
 */
function isVisible(node, context) {
    if (effectiveLayout(node, context)?.collapseEmpty && !(node.children || []).some(child => isVisible(child, context))) return false;
    if (!node.visibleWhen) return true;
    const value = context.stateValueOf(node.visibleWhen.field);
    return node.visibleWhen.oneOf.includes(String(value));
}

/** A viewport clips its content and may scroll it; nothing else clips. */
function clipsContent(node) {
    const entry = componentType(node.type);
    return Boolean(entry && entry.clips);
}

/** An overlay is positioned against the viewport instead of in flow. */
function isOverlay(node) {
    const entry = componentType(node.type);
    return Boolean(entry && entry.layer === "overlay");
}

/** A tabPanel-like container shows exactly one child's subtree at a time (spec 021). */
function tabHeaderOf(node) {
    const entry = componentType(node.type);
    return (entry && entry.tabHeader) || null;
}

/** A collapsePanel-like container's children may be absent from layout entirely (spec 021). */
function isCollapsible(node) {
    const entry = componentType(node.type);
    return Boolean(entry && entry.collapsible);
}

function intersect(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return { x, y, width: Math.max(right - x, 0), height: Math.max(bottom - y, 0) };
}

function measureIntrinsic(node, context) {
    if (context.cache.has(node)) return context.cache.get(node);
    let size;
    const { padding, gap } = spacing(node, context);
    const children = flowChildren(node, context);
    if (children.length === 0) {
        size = context.measureLeaf(node);
    } else if (isRow(node, context)) {
        const sizes = children.map(child => measureIntrinsic(child, context));
        size = {
            width: sizes.reduce((sum, s) => sum + s.width, 0) + gap * Math.max(0, sizes.length - 1) + padding * 2,
            height: Math.max(MIN_HEIGHT, ...sizes.map(s => s.height)) + padding * 2
        };
    } else if (packedRowHeightOf(node.type)) {
        const rowHeight = packedRowHeightOf(node.type);
        const sizes = children.map(child => measureIntrinsic(child, context));
        size = {
            width: Math.max(0, ...sizes.map(s => s.width)) + PACKED_ROW_WIDTH_PAD,
            height: children.length * rowHeight
        };
    } else {
        const sizes = children.map(child => measureIntrinsic(child, context));
        size = {
            width: Math.max(0, ...sizes.map(s => s.width)) + padding * 2,
            height: sizes.reduce((sum, s) => sum + s.height, 0) + gap * Math.max(0, sizes.length - 1) + padding * 2
        };
    }
    context.cache.set(node, size);
    return size;
}

// Cross-axis sizing (a row's height, or a column's width): "fixed" keeps its
// own size; "fill" *and* "auto" both stretch to the available cross-axis
// space. Unlike the main axis, letting an "auto" cross-axis child keep its
// full intrinsic size would let a tall/wide child spill into its own
// container's siblings instead of just its own main-axis content; stretching
// keeps any overflow contained to where that child draws itself.
function resolvedCrossAxis(node, dimension, available, context) {
    const layout = effectiveLayout(node, context);
    if (layout[dimension].mode === "fixed") return layout[dimension].size;
    const formula = formulaWidth(layout[dimension].mode, context.viewportWidth);
    if (formula !== null) return formula;
    return available;
}

// Shared distribution: along the main axis, "fixed"/"auto" children keep
// their own size and "fill" children split whatever space is left. With the
// container's own `layout.distribute: "floor"` every flexible share is the
// integer division instead of the exact fraction, and the remainder is left
// unused past the last child - v1's own even-column arithmetic
// (script/src/ui/optionsPanel.js:276, and the same shape in every other v1
// panel that divides a width by a column count).
function distributeMainAxis(children, dimension, totalAvailable, context, gap = GAP, distribute = null) {
    const infos = children.map(child => {
        const layout = effectiveLayout(child, context);
        if (layout[dimension].mode === "fixed") return { child, size: layout[dimension].size, flexible: false };
        const formula = formulaWidth(layout[dimension].mode, context.viewportWidth);
        if (formula !== null) return { child, size: formula, flexible: false };
        if (layout[dimension].mode === "fill") return { child, size: 0, flexible: true };
        return { child, size: measureIntrinsic(child, context)[dimension], flexible: false };
    });
    const fixedTotal = infos.filter(i => !i.flexible).reduce((sum, i) => sum + i.size, 0);
    const gapsTotal = gap * Math.max(0, infos.length - 1);
    const remaining = Math.max(totalAvailable - fixedTotal - gapsTotal, 0);
    const flexCount = infos.filter(i => i.flexible).length;
    let flexSize = flexCount > 0 ? remaining / flexCount : 0;
    if (distribute === "floor") flexSize = Math.floor(flexSize);
    return infos.map(info => ({ child: info.child, size: info.flexible ? flexSize : info.size }));
}

function layoutRow(node, rect, context) {
    const { padding, gap } = spacing(node, context);
    const innerHeight = Math.max(rect.height - padding * 2, MIN_HEIGHT);
    const children = flowChildren(node, context);
    const sized = distributeMainAxis(children, "width", Math.max(rect.width - padding * 2, 0), context, gap, effectiveLayout(node, context).distribute);
    let x = rect.x + padding;
    const y = rect.y + padding;
    sized.forEach(({ child, size }) => {
        const height = resolvedCrossAxis(child, "height", innerHeight, context);
        layoutNode(child, { x, y, width: size, height }, context);
        x += size + gap;
    });
}

function layoutColumn(node, rect, context) {
    const { padding, gap } = spacing(node, context);
    const rowHeight = packedRowHeightOf(node.type);
    if (rowHeight) {
        // No padding, no gap - submenu's own rows are packed edge-to-edge at
        // one fixed height (spec 083's own pixel-parity follow-up), the
        // generic column's usual padding/gap would leave the hover highlight
        // (from the real per-child rect this same pass produces) unaligned
        // with the divider lines the submenu draw kind paints between rows.
        let y = rect.y;
        flowChildren(node, context).forEach(child => {
            layoutNode(child, { x: rect.x, y, width: rect.width, height: rowHeight }, context);
            y += rowHeight;
        });
        return;
    }
    const innerWidth = Math.max(rect.width - padding * 2, 0);
    const children = flowChildren(node, context);
    const sized = distributeMainAxis(children, "height", Math.max(rect.height - padding * 2, 0), context, gap, effectiveLayout(node, context).distribute);
    const x = rect.x + padding;
    let y = rect.y + padding;
    sized.forEach(({ child, size }) => {
        const width = resolvedCrossAxis(child, "width", innerWidth, context);
        layoutNode(child, { x, y, width, height: size }, context);
        y += size + gap;
    });
}

/**
 * A viewport lays its content out at its natural height, then translates it
 * by the scroll offset and clips it. The content extent is reported so a
 * scrollbar can size a thumb and so the offset can be clamped: a bad offset
 * must never be able to lose the content.
 */
function layoutViewport(node, rect, context) {
    const children = flowChildren(node, context);
    if (children.length === 0) return;
    const innerWidth = Math.max(rect.width - PADDING * 2, 0);
    const contentHeight = children.reduce((sum, child, index) => {
        const layout = effectiveLayout(child, context);
        const size = layout.height.mode === "fixed" ? layout.height.size : measureIntrinsic(child, context).height;
        return sum + size + (index > 0 ? GAP : 0);
    }, 0);
    context.extents.set(node.id, { width: innerWidth, height: contentHeight });

    const overflow = Math.max(contentHeight - Math.max(rect.height - PADDING * 2, 0), 0);
    const requested = context.scrollOffset(node);
    const offset = Math.min(Math.max(requested, 0), overflow);
    context.offsets.set(node.id, offset);

    let y = rect.y + PADDING - offset;
    for (const child of children) {
        const layout = effectiveLayout(child, context);
        const height = layout.height.mode === "fixed" ? layout.height.size : measureIntrinsic(child, context).height;
        const width = resolvedCrossAxis(child, "width", innerWidth, context);
        layoutNode(child, { x: rect.x + PADDING, y, width, height }, context);
        y += height + GAP;
    }
}

/**
 * A node absent from the flow: an overlay (laid out separately, against the
 * viewport) or one whose `visibleWhen` (spec 025) the current state does not
 * satisfy - a node with an unmet `visibleWhen` is dropped here, before it
 * would ever reach `layoutNode`, so it (and its own subtree) gets no rect,
 * no clip, and is never drawn or hit-tested, the same "absent from layout
 * entirely" effect a closed overlay or a collapsed container's content
 * already has.
 */
function flowChildren(node, context) {
    return (node.children || []).filter(child => !isOverlay(child) && !effectiveLayout(child, context)?.position && isVisible(child, context));
}

/**
 * A tabPanel-like container (spec 021): only the active item's subtree gets
 * a rect at all - every other item is treated exactly as a closed overlay
 * already is, absent from layout, drawing and hit-testing alike. The header
 * strip itself is not a laid-out child; the draw kind paints it directly
 * from the item labels and `tabHeader.height`, and the renderer resolves a
 * click against that same height, so nothing here allocates space for it
 * beyond reserving it out of the content area.
 */
function layoutTabs(node, rect, context, header) {
    const items = flowChildren(node, context);
    const xOffset = Number(node.contentOffsetX) || 0;
    const yOffset = Number.isFinite(Number(node.contentOffsetY)) ? Number(node.contentOffsetY) : header.height;
    const contentRect = {
        x: rect.x + xOffset,
        y: rect.y + yOffset,
        width: Math.max(rect.width + (Number(node.contentWidthOffset) || 0), 0),
        height: Math.max(rect.height + (Number(node.contentHeightOffset) || -header.height), 0)
    };
    if (items.length === 0) return;
    const requested = context.activeTab(node);
    const activeIndex = Math.min(Math.max(Number.isFinite(requested) ? requested : 0, 0), items.length - 1);
    const active = items[activeIndex];
    const layout = effectiveLayout(active, context);
    const width = layout.width.mode === "fixed" ? layout.width.size : contentRect.width;
    const height = (layout.height.mode === "fixed" ? layout.height.size : contentRect.height) + (Number(layout.heightOffset) || 0);
    layoutNode(active, { x: contentRect.x, y: contentRect.y, width, height }, context);
}

function layoutNode(node, rect, context) {
    const own = effectiveLayout(node, context);
    const selfWidthFactor = typeof own.offsetX === "string" && own.offsetX.endsWith("selfWidth")
        ? Number(own.offsetX.slice(0, -"selfWidth".length) || 1)
        : null;
    const offsetX = Number.isFinite(selfWidthFactor) ? rect.width * selfWidthFactor : (own.offsetX || 0);
    rect = { ...rect, x: rect.x + offsetX, y: rect.y + (own.offsetY || 0), width: rect.width + (own.widthOffset || 0) };
    if (own.horizontalFrame === "patternTracks") {
        const frame = patternTrackFrame(context.viewportWidth, context.stateValueOf("tracks.value"));
        rect = { ...rect, x: frame.x, width: frame.width };
    }
    context.rects.set(node.id, rect);
    const clip = clipsContent(node) ? intersect(context.clip, rect) : context.clip;
    context.clips.set(node.id, clip || rect);

    // Overlays are collected wherever they appear and laid out afterwards
    // against the viewport, so a parent's rect and clip never constrain them.
    // Spec 020: a closed overlay (context.overlayOpen says so) is skipped
    // entirely here - no rect, no clip, no entry in `overlays` for it or its
    // subtree - which is what lets a dropdown popup or a dialog be absent
    // most of the time instead of always present the way spec 013/015's own
    // hand-built test type was.
    for (const child of node.children || []) {
        if (isOverlay(child) && context.overlayOpen(child)) context.pendingOverlays.push(child);
    }

    // Spec 021: the same "absent from layout" effect, for two non-overlay
    // cases - a tabPanel's inactive items, and every child of a collapsed
    // collapsePanel.
    const header = tabHeaderOf(node);
    if (header) {
        const previous = context.clip;
        context.clip = clip;
        layoutTabs(node, rect, context, header);
        context.clip = previous;
        return;
    }

    const children = (isCollapsible(node) && context.collapsed(node)) ? [] : flowChildren(node, context);
    if (isCollapsible(node) && context.collapsed(node)) return;

    const previous = context.clip;
    context.clip = clip;
    if (clipsContent(node)) layoutViewport(node, rect, context);
    else if (isRow(node, context)) layoutRow(node, rect, context);
    else layoutColumn(node, rect, context);
    for (const child of node.children || []) {
        const layout = effectiveLayout(child, context);
        if (!layout.position || isOverlay(child) || !isVisible(child, context)) continue;
        const frame = layout.position === "viewport" ? { x: 0, y: 0, width: context.viewportWidth, height: context.viewportHeight } : rect;
        const edge = value => value === "columnMargin"
            ? columnMargin(context.viewportWidth)
            : value === "col2Left" ? col2Left(context.viewportWidth)
            : value === "col3Left" ? col3Left(context.viewportWidth)
            : value === "col4Left" ? col4Left(context.viewportWidth)
            : value === "controlButtonsLeft" ? controlButtonsLeft(context.viewportWidth)
            : value === "modeButtonsLeft" ? modeButtonsLeft(context.viewportWidth)
            : value === "modeAuxButtonsLeft" ? modeAuxButtonsLeft(context.viewportWidth) : value;
        const left = edge(layout.left), right = edge(layout.right);
        const width = resolvedCrossAxis(child, "width", frame.width - (left || 0) - (right || 0), context);
        const height = resolvedCrossAxis(child, "height", frame.height - (layout.top || 0) - (layout.bottom || 0), context);
        layoutNode(child, { x: frame.x + (left ?? (right === undefined ? 0 : frame.width - right - width)), y: frame.y + (layout.top ?? (layout.bottom === undefined ? 0 : frame.height - layout.bottom - height)), width, height }, context);
    }
    context.clip = previous;
}

/**
 * Where an anchored overlay lands (spec 020): against the edge of another
 * node's own rect rather than centred in the viewport. The preferred edge
 * flips to its opposite when it would put any part of the overlay outside
 * the viewport, and the cross axis is clamped so it never runs off either
 * side - the same "a bad position cannot lose the content" spirit spec 013's
 * scroll clamp already holds to.
 */
// An anchor can ask to overlap its own target by a few pixels instead of
// sitting flush against its edge - a nested submenu's own real amount (v1's
// own `left = this.left + this.width - 20`,
// script/src/ui/components/submenu.js:118, set by mountGeneric.js's own
// `openOverlay` only for a nested trigger's popup) - without it, moving the
// pointer diagonally from the trigger into its own nested flyout crosses a
// gap of plain background and fires a `pointerleave` before ever reaching it
// (spec 083's own pixel-parity follow-up). Zero for every other anchored
// overlay, unchanged from before.
function anchoredRect(target, size, edge, viewport, overlap = 0) {
    const clamp = (value, max) => Math.min(Math.max(value, 0), Math.max(max, 0));
    if (edge === "right" || edge === "left") {
        const fitsRight = target.x + target.width + size.width <= viewport.width;
        const opensRight = (edge === "right") === fitsRight;
        const x = opensRight ? target.x + target.width - overlap : target.x - size.width + overlap;
        return { x: clamp(x, viewport.width - size.width), y: clamp(target.y, viewport.height - size.height), width: size.width, height: size.height };
    }
    const fitsBelow = target.y + target.height + size.height <= viewport.height;
    const y = (edge === "below") === fitsBelow ? target.y + target.height : target.y - size.height;
    return { x: clamp(target.x, viewport.width - size.width), y: clamp(y, viewport.height - size.height), width: size.width, height: size.height };
}

/**
 * An overlay is sized from its own layout fields where it declares them and
 * from its intrinsic size otherwise. It is positioned against `node.anchor`
 * (spec 020: `{ targetId, edge }`, set at open time by whatever opened it)
 * when the target's rect is known, and centred in the viewport otherwise -
 * which is every overlay before spec 020, so that behaviour is unchanged. It
 * is clipped only by the viewport, never by whatever it was authored under.
 */
function layoutOverlay(node, viewport, context) {
    const intrinsic = measureIntrinsic(node, context);
    const layout = effectiveLayout(node, context);
    const width = layout.width.mode === "fixed" ? layout.width.size
        : layout.width.mode === "fill" ? viewport.width
        : Math.min(intrinsic.width, viewport.width);
    const height = layout.height.mode === "fixed" ? layout.height.size
        : layout.height.mode === "fill" ? viewport.height
        : Math.min(intrinsic.height, viewport.height);
    const target = node.anchor && node.anchor.targetId ? context.rects.get(node.anchor.targetId) : null;
    const rect = target
        ? anchoredRect(target, { width, height }, node.anchor.edge, viewport, node.anchor.overlap || 0)
        : { x: Math.round((viewport.width - width) / 2), y: Math.round((viewport.height - height) / 2), width, height };
    const previous = context.clip;
    context.clip = { x: 0, y: 0, width: viewport.width, height: viewport.height };
    layoutNode(node, rect, context);
    context.clip = previous;
}

/**
 * @param {object} root the compiled tree (compiler/convert.js), with `id` assigned
 * @param {{ width: number, height: number }} viewport
 * @param {(node: object) => { width: number, height: number }} measureLeaf intrinsic size of a childless node
 * @param {{ scrollOffset?: (node: object) => number, overlayOpen?: (node: object) => boolean,
 *   activeTab?: (node: object) => number, collapsed?: (node: object) => boolean,
 *   stateValueOf?: (field: string) => any }} [options]
 *   `scrollOffset` reads a viewport's offset, normally from application state; defaults to
 *   none. `overlayOpen` (spec 020) says whether an overlay node currently participates in
 *   layout at all; defaults to always open, which is every caller before spec 020.
 *   `activeTab`/`collapsed` (spec 021) say which of a tabPanel-like node's items is showing
 *   and whether a collapsible-like node's children are laid out at all; both default to their
 *   pre-021 behaviour (tab index 0; never collapsed). `stateValueOf` (spec 025) resolves a
 *   `visibleWhen.field`; defaults to always `undefined`, so a node with no `visibleWhen` is
 *   the only thing every pre-025 caller ever has, and stays visible exactly as before.
 * @returns {{ rects: Map, clips: Map, extents: Map, offsets: Map, overlays: string[] }}
 */
export function computeGenericLayout(root, viewport, measureLeaf, options = {}) {
    const context = {
        measureLeaf,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        cache: new Map(),
        rects: new Map(),
        clips: new Map(),
        extents: new Map(),
        offsets: new Map(),
        pendingOverlays: [],
        clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        scrollOffset: options.scrollOffset || (() => 0),
        overlayOpen: options.overlayOpen || (() => true),
        activeTab: options.activeTab || (() => 0),
        collapsed: options.collapsed || (() => false),
        stateValueOf: options.stateValueOf || (() => undefined)
    };

    layoutNode(root, { x: 0, y: 0, width: viewport.width, height: viewport.height }, context);

    // Overlays may themselves contain overlays, so this drains a queue.
    const overlays = [];
    while (context.pendingOverlays.length) {
        const node = context.pendingOverlays.shift();
        overlays.push(node.id);
        layoutOverlay(node, viewport, context);
    }

    return { rects: context.rects, clips: context.clips, extents: context.extents, offsets: context.offsets, overlays };
}

export { isContainer };
