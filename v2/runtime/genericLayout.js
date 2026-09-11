// Generic measurement/layout pass for the compiled component tree (spec 005
// Phase 1, extended by spec 013 with clipping, scroll viewports and an
// overlay layer). A container stacks its children in a column or a row;
// explicit layout.width/height "fixed" or "fill" always win; "auto" falls
// back to an intrinsic size measured bottom-up. Pure: no DOM or canvas
// access, so it is unit-testable with a fake `measureLeaf`.

import { typeDirection, componentType, isContainer } from "./componentTypes.js";

const PADDING = 4;
const GAP = 4;
const MIN_HEIGHT = 20;

// The source graph doesn't always declare row vs. column. Resolution order
// (spec 013): the authored `layout.direction`, then the component type's own
// declared direction (a radioGroup is always a row of choices), then this
// delivery's documented default, where a container with a *fixed* height
// reads as a single toolbar row and an auto/fill-height container stacks its
// children as a column of sections. The last step is kept because the
// current application relies on it for its top bar and control bar.
function isRow(node) {
    const authored = node.layout && node.layout.direction;
    if (authored) return authored === "row";
    const declared = typeDirection(node.type);
    if (declared) return declared === "row";
    return node.layout.height.mode === "fixed";
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

function intersect(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return { x, y, width: Math.max(right - x, 0), height: Math.max(bottom - y, 0) };
}

function measureIntrinsic(node, measureLeaf, cache) {
    if (cache.has(node)) return cache.get(node);
    let size;
    const children = (node.children || []).filter(child => !isOverlay(child));
    if (children.length === 0) {
        size = measureLeaf(node);
    } else if (isRow(node)) {
        const sizes = children.map(child => measureIntrinsic(child, measureLeaf, cache));
        size = {
            width: sizes.reduce((sum, s) => sum + s.width, 0) + GAP * Math.max(0, sizes.length - 1) + PADDING * 2,
            height: Math.max(MIN_HEIGHT, ...sizes.map(s => s.height)) + PADDING * 2
        };
    } else {
        const sizes = children.map(child => measureIntrinsic(child, measureLeaf, cache));
        size = {
            width: Math.max(0, ...sizes.map(s => s.width)) + PADDING * 2,
            height: sizes.reduce((sum, s) => sum + s.height, 0) + GAP * Math.max(0, sizes.length - 1) + PADDING * 2
        };
    }
    cache.set(node, size);
    return size;
}

// Cross-axis sizing (a row's height, or a column's width): "fixed" keeps its
// own size; "fill" *and* "auto" both stretch to the available cross-axis
// space. Unlike the main axis, letting an "auto" cross-axis child keep its
// full intrinsic size would let a tall/wide child spill into its own
// container's siblings instead of just its own main-axis content; stretching
// keeps any overflow contained to where that child draws itself.
function resolvedCrossAxis(node, dimension, available) {
    if (node.layout[dimension].mode === "fixed") return node.layout[dimension].size;
    return available;
}

// Shared distribution: along the main axis, "fixed"/"auto" children keep
// their own size and "fill" children split whatever space is left.
function distributeMainAxis(children, dimension, totalAvailable, measureLeaf, cache) {
    const infos = children.map(child => {
        if (child.layout[dimension].mode === "fixed") return { child, size: child.layout[dimension].size, flexible: false };
        if (child.layout[dimension].mode === "fill") return { child, size: 0, flexible: true };
        return { child, size: measureIntrinsic(child, measureLeaf, cache)[dimension], flexible: false };
    });
    const fixedTotal = infos.filter(i => !i.flexible).reduce((sum, i) => sum + i.size, 0);
    const gapsTotal = GAP * Math.max(0, infos.length - 1);
    const remaining = Math.max(totalAvailable - fixedTotal - gapsTotal, 0);
    const flexCount = infos.filter(i => i.flexible).length;
    const flexSize = flexCount > 0 ? remaining / flexCount : 0;
    return infos.map(info => ({ child: info.child, size: info.flexible ? flexSize : info.size }));
}

function layoutRow(node, rect, context) {
    const innerHeight = Math.max(rect.height - PADDING * 2, MIN_HEIGHT);
    const children = flowChildren(node);
    const sized = distributeMainAxis(children, "width", Math.max(rect.width - PADDING * 2, 0), context.measureLeaf, context.cache);
    let x = rect.x + PADDING;
    const y = rect.y + PADDING;
    sized.forEach(({ child, size }) => {
        const height = resolvedCrossAxis(child, "height", innerHeight);
        layoutNode(child, { x, y, width: size, height }, context);
        x += size + GAP;
    });
}

function layoutColumn(node, rect, context) {
    const innerWidth = Math.max(rect.width - PADDING * 2, 0);
    const children = flowChildren(node);
    const sized = distributeMainAxis(children, "height", Math.max(rect.height - PADDING * 2, 0), context.measureLeaf, context.cache);
    const x = rect.x + PADDING;
    let y = rect.y + PADDING;
    sized.forEach(({ child, size }) => {
        const width = resolvedCrossAxis(child, "width", innerWidth);
        layoutNode(child, { x, y, width, height: size }, context);
        y += size + GAP;
    });
}

/**
 * A viewport lays its content out at its natural height, then translates it
 * by the scroll offset and clips it. The content extent is reported so a
 * scrollbar can size a thumb and so the offset can be clamped: a bad offset
 * must never be able to lose the content.
 */
function layoutViewport(node, rect, context) {
    const children = flowChildren(node);
    if (children.length === 0) return;
    const innerWidth = Math.max(rect.width - PADDING * 2, 0);
    const contentHeight = children.reduce((sum, child, index) => {
        const size = child.layout.height.mode === "fixed"
            ? child.layout.height.size
            : measureIntrinsic(child, context.measureLeaf, context.cache).height;
        return sum + size + (index > 0 ? GAP : 0);
    }, 0);
    context.extents.set(node.id, { width: innerWidth, height: contentHeight });

    const overflow = Math.max(contentHeight - Math.max(rect.height - PADDING * 2, 0), 0);
    const requested = context.scrollOffset(node);
    const offset = Math.min(Math.max(requested, 0), overflow);
    context.offsets.set(node.id, offset);

    let y = rect.y + PADDING - offset;
    for (const child of children) {
        const height = child.layout.height.mode === "fixed"
            ? child.layout.height.size
            : measureIntrinsic(child, context.measureLeaf, context.cache).height;
        const width = resolvedCrossAxis(child, "width", innerWidth);
        layoutNode(child, { x: rect.x + PADDING, y, width, height }, context);
        y += height + GAP;
    }
}

function flowChildren(node) {
    return (node.children || []).filter(child => !isOverlay(child));
}

function layoutNode(node, rect, context) {
    context.rects.set(node.id, rect);
    const clip = clipsContent(node) ? intersect(context.clip, rect) : context.clip;
    context.clips.set(node.id, clip || rect);

    // Overlays are collected wherever they appear and laid out afterwards
    // against the viewport, so a parent's rect and clip never constrain them.
    for (const child of node.children || []) {
        if (isOverlay(child)) context.pendingOverlays.push(child);
    }

    const children = flowChildren(node);
    if (children.length === 0) return;

    const previous = context.clip;
    context.clip = clip;
    if (clipsContent(node)) layoutViewport(node, rect, context);
    else if (isRow(node)) layoutRow(node, rect, context);
    else layoutColumn(node, rect, context);
    context.clip = previous;
}

/**
 * An overlay is sized from its own layout fields where it declares them and
 * from its intrinsic size otherwise, then centred in the viewport. It is
 * clipped only by the viewport, never by whatever it was authored under.
 */
function layoutOverlay(node, viewport, context) {
    const intrinsic = measureIntrinsic(node, context.measureLeaf, context.cache);
    const width = node.layout.width.mode === "fixed" ? node.layout.width.size
        : node.layout.width.mode === "fill" ? viewport.width
        : Math.min(intrinsic.width, viewport.width);
    const height = node.layout.height.mode === "fixed" ? node.layout.height.size
        : node.layout.height.mode === "fill" ? viewport.height
        : Math.min(intrinsic.height, viewport.height);
    const rect = {
        x: Math.round((viewport.width - width) / 2),
        y: Math.round((viewport.height - height) / 2),
        width,
        height
    };
    const previous = context.clip;
    context.clip = { x: 0, y: 0, width: viewport.width, height: viewport.height };
    layoutNode(node, rect, context);
    context.clip = previous;
}

/**
 * @param {object} root the compiled tree (compiler/convert.js), with `id` assigned
 * @param {{ width: number, height: number }} viewport
 * @param {(node: object) => { width: number, height: number }} measureLeaf intrinsic size of a childless node
 * @param {{ scrollOffset?: (node: object) => number }} [options] `scrollOffset` reads a
 *   viewport's offset, normally from application state; defaults to none.
 * @returns {{ rects: Map, clips: Map, extents: Map, offsets: Map, overlays: string[] }}
 */
export function computeGenericLayout(root, viewport, measureLeaf, options = {}) {
    const context = {
        measureLeaf,
        cache: new Map(),
        rects: new Map(),
        clips: new Map(),
        extents: new Map(),
        offsets: new Map(),
        pendingOverlays: [],
        clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        scrollOffset: options.scrollOffset || (() => 0)
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
