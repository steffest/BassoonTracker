// Pure hit-testing, ancestry and pointer-mapping helpers for the inspection
// overlay (spec 005 IWB-002 "Hover inspection", IWB-003 "Source selection").
// No DOM/canvas access, so this is directly unit-testable; renderers/canvas/
// mountGeneric.js is the only caller.

/**
 * Finds the deepest visible node under `point`, by paint order: later
 * entries were drawn on top, so scanning backwards and returning the first
 * rect containing the point matches "hit-test deepest visible node by paint
 * order" without needing a separate z-index concept.
 *
 * Spec 013: a point must be inside the node's `clip` as well as its rect, so
 * a control scrolled out of a viewport cannot be clicked where it is not
 * visible. `clip` is optional, and a node without one is unclipped.
 *
 * @param {Array<{id: string, rect: object|undefined, clip: object|undefined}>} paintOrderNodes root-first, the order the renderer paints in
 * @param {{x: number, y: number}} point in the same logical coordinate space as the rects
 * @returns {string|null} the hit node's id, or null if the point hit nothing (background)
 */
export function hitTestPoint(paintOrderNodes, point) {
    for (let i = paintOrderNodes.length - 1; i >= 0; i--) {
        const node = paintOrderNodes[i];
        if (!node.rect) continue;
        if (!contains(node.rect, point)) continue;
        if (node.clip && !contains(node.clip, point)) continue;
        return node.id;
    }
    return null;
}

function contains(rect, point) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

/**
 * Root-to-target id chain for breadcrumbs (IWB-003 "a parent breadcrumb
 * selects the parent"), or null if targetId isn't part of this tree.
 *
 * @param {object} root a node with { id, children }
 * @param {string} targetId
 * @returns {string[]|null}
 */
export function ancestryChain(root, targetId) {
    const path = [];
    function visit(node) {
        path.push(node.id);
        if (node.id === targetId) return true;
        for (const child of node.children || []) {
            if (visit(child)) return true;
        }
        path.pop();
        return false;
    }
    return visit(root) ? path : null;
}

/**
 * Maps a client-space pointer event into the canvas's own logical (CSS
 * pixel) coordinate space. The canvas already absorbs devicePixelRatio
 * through its internal width/height and ctx.setTransform (renderers/canvas/
 * mountGeneric.js); what's left to correct for here is any *further*
 * mismatch between the element's intrinsic CSS box and its actual rendered
 * bounding box - a page zoom level or a CSS transform on an ancestor.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{left:number, top:number, width:number, height:number}} boundingRect element.getBoundingClientRect()
 * @param {number} logicalWidth canvas.clientWidth (the layout's viewport.width)
 * @param {number} logicalHeight canvas.clientHeight (the layout's viewport.height)
 * @returns {{x: number, y: number}}
 */
export function mapPointerToLogical(clientX, clientY, boundingRect, logicalWidth, logicalHeight) {
    const scaleX = boundingRect.width > 0 ? logicalWidth / boundingRect.width : 1;
    const scaleY = boundingRect.height > 0 ? logicalHeight / boundingRect.height : 1;
    return {
        x: (clientX - boundingRect.left) * scaleX,
        y: (clientY - boundingRect.top) * scaleY
    };
}
