// Pointer gesture recognition (spec 014 INT-001, INT-002, INT-005).
//
// Pure: no DOM, no canvas, no knowledge of what a node *is*. The renderer
// resolves which node is under a point and passes its id; this module owns
// the three pieces of state that make a gesture a gesture - which node
// captured the pointer, whether the press has become a drag, and when the
// last click happened - and turns raw positions into the semantic input
// vocabulary the behavior controllers understand.
//
// Emitted input types, in the order a full gesture produces them:
//   pointerenter / pointerleave   hover, and press abandonment while captured
//   pointerdown                   a press, addressed to the captured node
//   dragstart / drag / dragend    once the press has moved past the threshold
//   pointerup                     the release, always to the captured node
//   doubleclick                   appended after the second qualifying release
//   secondaryclick                a non-primary press; takes no capture
//
// Every emitted input carries `id`. `drag*` also carry `origin` (the press
// point), `point` (now) and `delta` (now minus origin).

/** Logical pixels of movement before a press counts as a drag. */
export const DRAG_THRESHOLD = 3;
/** Milliseconds within which a second release on the same node is a double-click. */
export const DOUBLE_CLICK_MS = 400;
/** Logical pixels the second release may be away from the first. */
export const DOUBLE_CLICK_SLOP = 5;

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * @param {{ dragThreshold?: number, doubleClickMs?: number, doubleClickSlop?: number }} [options]
 */
export function createPointerRouter(options = {}) {
    const dragThreshold = options.dragThreshold ?? DRAG_THRESHOLD;
    const doubleClickMs = options.doubleClickMs ?? DOUBLE_CLICK_MS;
    const doubleClickSlop = options.doubleClickSlop ?? DOUBLE_CLICK_SLOP;

    // The captured gesture, or null when nothing is held.
    let capture = null;   // { id, origin, point, dragging, inside, button }
    // Which node the *hover* is on. While captured this tracks whether the
    // pointer is inside the captured node, not what is under it.
    let hoverId = null;
    let lastClick = null; // { id, point, time }

    function inputsForHover(nextId, point) {
        const inputs = [];
        if (nextId === hoverId) return inputs;
        if (hoverId) inputs.push({ type: "pointerleave", id: hoverId, point });
        hoverId = nextId;
        if (hoverId) inputs.push({ type: "pointerenter", id: hoverId, point });
        return inputs;
    }

    /**
     * A press. `id` may be null (the background), which still clears the
     * hover and, for a primary press, records that nothing is captured.
     * @param {{ id: string|null, point: {x:number,y:number}, button?: number, time: number,
     *   rect?: {x:number,y:number,width:number,height:number}|null }} event
     */
    function down(event) {
        const point = event.point;
        if ((event.button ?? 0) !== 0) {
            // A secondary press is a gesture on its own: it must not press,
            // drag or activate, so it takes no capture.
            return event.id ? [{ type: "secondaryclick", id: event.id, point, button: event.button }] : [];
        }
        const inputs = inputsForHover(event.id, point);
        capture = null;
        if (!event.id) return inputs;
        capture = { id: event.id, origin: point, point, dragging: false, inside: true, button: 0, rect: event.rect || null };
        inputs.push({ type: "pointerdown", id: event.id, point, local: localPoint(point, capture.rect) });
        return inputs;
    }

    function localPoint(point, rect) {
        if (!rect) return null;
        return { x: point.x - rect.x, y: point.y - rect.y };
    }

    /**
     * A move. `hitId` is what the renderer's hit-test found; while a gesture
     * is captured it is used only to decide whether the pointer is still
     * inside the captured node, never to retarget.
     * @param {{ hitId: string|null, point: {x:number,y:number}, time?: number }} event
     */
    function move(event) {
        const point = event.point;
        if (!capture) return inputsForHover(event.hitId, point);

        const inputs = [];
        capture.point = point;

        // Leaving the captured node releases the held press through the
        // controller's existing "pointerleave releases without activating"
        // rule; coming back re-presses, which is what a native button does.
        const inside = event.hitId === capture.id;
        if (inside !== capture.inside) {
            capture.inside = inside;
            if (inside) {
                inputs.push({ type: "pointerenter", id: capture.id, point });
                inputs.push({ type: "pointerdown", id: capture.id, point, local: localPoint(point, capture.rect) });
                hoverId = capture.id;
            } else {
                inputs.push({ type: "pointerleave", id: capture.id, point });
                hoverId = null;
            }
        }

        const delta = { x: point.x - capture.origin.x, y: point.y - capture.origin.y };
        if (!capture.dragging && Math.hypot(delta.x, delta.y) >= dragThreshold) {
            capture.dragging = true;
            // The delta is measured from the press point, not from here, so
            // the first three pixels of a fast flick are not lost.
            inputs.push({ type: "dragstart", id: capture.id, origin: capture.origin, point, delta, local: localPoint(point, capture.rect) });
        }
        if (capture.dragging) {
            inputs.push({ type: "drag", id: capture.id, origin: capture.origin, point, delta, local: localPoint(point, capture.rect) });
        }
        return inputs;
    }

    /**
     * A release.
     * @param {{ point: {x:number,y:number}, button?: number, time: number }} event
     */
    function up(event) {
        if ((event.button ?? 0) !== 0 || !capture) {
            capture = null;
            return [];
        }
        const point = event.point;
        const held = capture;
        capture = null;
        const inputs = [];
        if (held.dragging) {
            const delta = { x: point.x - held.origin.x, y: point.y - held.origin.y };
            inputs.push({ type: "dragend", id: held.id, origin: held.origin, point, delta, local: localPoint(point, held.rect) });
        }
        inputs.push({ type: "pointerup", id: held.id, point, dragged: held.dragging, inside: held.inside, local: localPoint(point, held.rect) });

        // A drag is not a click, so it neither reports nor arms a double-click.
        if (!held.dragging && held.inside) {
            const isDouble = lastClick && lastClick.id === held.id
                && event.time - lastClick.time <= doubleClickMs
                && distance(lastClick.point, point) <= doubleClickSlop;
            if (isDouble) {
                inputs.push({ type: "doubleclick", id: held.id, point, local: localPoint(point, held.rect) });
                lastClick = null; // a triple click is two doubles, not three
            } else {
                lastClick = { id: held.id, point, time: event.time };
            }
        } else {
            lastClick = null;
        }
        return inputs;
    }

    /** The pointer was lost: a pointercancel, the window blurring, a mode change. */
    function cancel() {
        const inputs = [];
        if (capture) {
            const held = capture;
            capture = null;
            if (held.dragging) inputs.push({ type: "dragend", id: held.id, origin: held.origin, point: held.point, delta: { x: 0, y: 0 }, cancelled: true });
            inputs.push({ type: "pointerleave", id: held.id, point: held.point });
        }
        if (hoverId && !inputs.some(i => i.type === "pointerleave" && i.id === hoverId)) {
            inputs.push({ type: "pointerleave", id: hoverId, point: null });
        }
        hoverId = null;
        lastClick = null;
        return inputs;
    }

    return {
        down,
        move,
        up,
        cancel,
        /** The node holding the pointer, or null. */
        get captureId() { return capture ? capture.id : null; },
        /** Whether the captured press has become a drag. */
        get dragging() { return Boolean(capture && capture.dragging); },
        get hoverId() { return hoverId; }
    };
}
