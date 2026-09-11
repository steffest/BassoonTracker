import { computeGenericLayout } from "../../runtime/genericLayout.js";
import { hitTestPoint, ancestryChain, mapPointerToLogical } from "../../runtime/hitTest.js";
import { createBehaviorController } from "../../runtime/behaviors.js";
import { createPointerRouter } from "../../runtime/pointerRouter.js";
import { boundsOf, valueFieldOf, quantize } from "../../runtime/valueController.js";
import { thumbMetrics } from "../../runtime/scrollbar.js";
import { ensureIds } from "../../runtime/components.js";
import { loadCanvasAssets } from "./assets.js";
import { drawKind } from "./drawKinds.js";
import { drawKindOf, behaviorOf, behaviorOptionsOf, cursorOf, selectionModeOf, componentType } from "../../runtime/componentTypes.js";

// Renders the generic tree produced by compiler/convert.js. Unlike mount.js
// (the fixed transport/instrument-list template from spec 003), this
// renderer walks an arbitrary panel/button/radioGroup/label tree and draws
// an inspectable placeholder box for anything `supported: false` instead of
// silently dropping it (spec 005 design.md "Never silently drop an
// unsupported component").
//
// Spec 005 Phase 2 ("Point to source"): Inspect mode hovers/selects nodes
// and reports their source location. Phase 4 ("Component development
// tools"): Interact mode feeds pointer/keyboard input to a per-control
// behavior controller and dispatches the
// node's generated `command` bindings against a *mock* state (the
// `mockField`/`mockValues` the compiler's recipes emitted) - there is still
// no real tracker; the mock is explicit, and every input, state transition,
// activation result and command is emitted as a trace event so a hosting
// workbench can show input -> state -> command. When embedded in an iframe
// (v2/workbench.html), events are posted to window.parent using a small
// structured message protocol (design.md "iframe message bridge"); when
// opened standalone (v2/preview-app.html), the same toolbar/breadcrumbs work
// with no parent listening and no trace collector is ever loaded.
//
// Spec 014 replaced the four hand-tracked pointer variables with two pure
// pieces of runtime: runtime/pointerRouter.js turns positions into gestures
// (capture, drag, double-click, secondary click) and runtime/behaviors.js
// decides which controller a node gets from its registry entry. This file
// therefore names no component type and no gesture threshold; what is left
// here is DOM plumbing, state writes, tracing and drawing.

function flatten(node, out = []) {
    out.push(node);
    (node.children || []).forEach(child => flatten(child, out));
    return out;
}

function labelText(node) {
    return node.labelVariants && node.labelVariants.length > 0 ? node.labelVariants[0] : node.definitionName || node.type;
}

// Command bindings define a field's initial value (mockValues[0]); a
// visual-state binding on the same field only supplies a fallback when no
// command drives it. Order matters because a rule is usually authored (and
// therefore listed) before the action that changes what it observes.
export function seedMockState(mockState, bindings) {
    for (const binding of bindings) {
        if (binding.mockField && Array.isArray(binding.mockValues) && binding.mockValues.length && !mockState.has(binding.mockField)) {
            mockState.set(binding.mockField, binding.mockValues[0]);
        }
    }
    for (const binding of bindings) {
        if (binding.kind === "visual-state" && binding.mockField && !mockState.has(binding.mockField)) {
            mockState.set(binding.mockField, typeof binding.activeValue === "boolean" ? false : null);
        }
    }
    // A command whose value comes from the gesture (spec 014) declares no mock
    // values, so it is seeded last and empty, and is still visible in the
    // State gallery before anything has changed it.
    for (const binding of bindings) {
        if (binding.kind === "command" && binding.mockField && !mockState.has(binding.mockField)) {
            mockState.set(binding.mockField, "");
        }
    }
    return mockState;
}

function parentOf(root, id) {
    const chain = ancestryChain(root, id);
    return chain && chain.length > 1 ? chain[chain.length - 2] : null;
}

/**
 * @param {HTMLElement} container an empty element to mount into
 * @param {object} outline the app-outline.json document ({ root, diagnostics, sourceHash, ... })
 * @param {{ mode?: "inspect"|"interact", tools?: boolean, onTrace?: (entry: object) => void,
 *   state?: { get: Function, set: Function, getState?: Function, onAnyChange?: Function },
 *   appContext?: object, assetBase?: string|URL }} [options]
 *   `tools: false` mounts the user-facing application only: no Inspect/Interact
 *   toolbar, no breadcrumbs, no diagnostics panel (diagnostics still go to the
 *   console), always in Interact mode. Used by v2/app.html and generated apps.
 *   `state` replaces the internal mock-state map (generated apps pass their
 *   runtime/appState.js store); `appContext` is what a node's `onActivate`
 *   hook receives; `assetBase` points the skin loader at a copied asset dir.
 */
export async function mountGenericRenderer(container, outline, options = {}) {
    // Spec 008: the artwork description travels with the outline (or with the
    // generated app's own skin module), so the renderer draws whatever the
    // authored skin says and falls back to the built-in one when a document
    // predates skins (spec 003's outline.json).
    const assets = await loadCanvasAssets(outline.skin, options.assetBase);
    const { root, diagnostics = [] } = outline;
    ensureIds(root);
    const allNodes = flatten(root);
    const nodeById = new Map(allNodes.map(node => [node.id, node]));

    const toolsEnabled = options.tools !== false;
    let mode = !toolsEnabled || options.mode === "interact" ? "interact" : "inspect";
    let hoveredId = null;      // inspect-mode hover (overlay only)
    let selectedId = null;
    let layoutResult = null;
    let paintOrder = [];

    // --- interaction model (Interact mode only) -------------------------
    // Spec 014: which controller a node gets is declared by its type
    // (`behavior` in runtime/componentTypes.js) and built by one factory
    // table, so this loop names no component type and no behavior.
    const controllers = new Map();
    const behaviorNames = new Map(); // id -> the behavior name its controller implements
    const radioSelection = new Map(); // radioGroup id -> selected item id (UI state; no command exists for it yet)
    for (const node of allNodes) {
        if (node.supported === false) continue;
        const behavior = behaviorOf(node.type);
        const controller = behavior ? createBehaviorController(behavior, behaviorOptionsOf(node.type)) : null;
        if (!controller) continue;
        controllers.set(node.id, controller);
        behaviorNames.set(node.id, behavior);
    }
    // Either the host's real state store (generated apps) or a private map
    // seeded from the outline's mock bindings (authoring preview).
    const mockState = options.state
        ? {
            get: field => options.state.get(field),
            set: (field, value) => options.state.set(field, value),
            entries: () => Object.entries(typeof options.state.getState === "function" ? options.state.getState() : {}),
            has: field => typeof options.state.getState === "function" && field in options.state.getState()
        }
        : (() => {
            // A value control and a scroll viewport each need a *numeric*
            // field before the first draw, and they own the field they name,
            // so they are seeded before the bindings are. That is the order
            // the emitter uses too, which is why the preview and the
            // generated application start from the same numbers (spec 014).
            const map = new Map();
            for (const node of allNodes) {
                const behavior = behaviorOf(node.type);
                if (behavior === "value") {
                    const field = valueFieldOf(node);
                    if (field) map.set(field, boundsOf(node).min);
                } else if (behavior === "scroll" && node.field) {
                    map.set(node.field, 0);
                }
            }
            seedMockState(map, allNodes.flatMap(node => node.bindings || []));
            return { get: f => map.get(f), set: (f, v) => map.set(f, v), entries: () => [...map], has: f => map.has(f) };
        })();
    const interactiveIds = [...controllers.keys()];
    let focusedId = null;
    let traceSeq = 0;
    let dropActive = false;      // a file drag is currently over the canvas
    let lastDragTrace = 0;       // spec 014 INT-009: at most one drag trace per frame
    const timeOrigin = performance.now();
    const pointer = createPointerRouter();

    const shell = document.createElement("div");
    shell.className = "v2-generic-shell";
    Object.assign(shell.style, { display: "flex", flexDirection: "column", width: "100%", height: "100%" });

    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
        display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px",
        background: "#222", borderBottom: "1px solid #333", font: "11px monospace", color: "#ccc", flexWrap: "wrap"
    });

    const inspectButton = document.createElement("button");
    inspectButton.type = "button";
    inspectButton.textContent = "Inspect";
    const interactButton = document.createElement("button");
    interactButton.type = "button";
    interactButton.textContent = "Interact";
    [inspectButton, interactButton].forEach(btn => {
        Object.assign(btn.style, { font: "inherit", padding: "2px 8px", cursor: "pointer" });
    });
    inspectButton.addEventListener("click", () => setMode("inspect"));
    interactButton.addEventListener("click", () => setMode("interact"));

    const breadcrumbs = document.createElement("span");
    Object.assign(breadcrumbs.style, { display: "flex", gap: "2px", flexWrap: "wrap" });

    const mockReadout = document.createElement("span");
    Object.assign(mockReadout.style, { marginLeft: "auto", color: "#8a8", whiteSpace: "nowrap" });

    toolbar.append(inspectButton, interactButton, breadcrumbs, mockReadout);

    const canvasHolder = document.createElement("div");
    Object.assign(canvasHolder.style, { position: "relative", flex: "1", minHeight: "0" });

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.outline = "none";
    canvas.tabIndex = 0;
    const ctx = canvas.getContext("2d");
    canvasHolder.appendChild(canvas);

    const diagnosticsPanel = document.createElement("div");
    diagnosticsPanel.className = "v2-diagnostics-panel";
    Object.assign(diagnosticsPanel.style, {
        maxHeight: "30%", overflow: "auto", background: "#181818", color: "#ddd",
        font: "11px monospace", padding: "6px 8px", borderTop: "1px solid #333"
    });

    if (toolsEnabled) shell.append(toolbar, canvasHolder, diagnosticsPanel);
    else shell.append(canvasHolder);
    container.appendChild(shell);

    function postToParent(type, payload) {
        if (window.parent === window) return;
        window.parent.postMessage({ type, revision: outline.sourceHash, ...payload }, window.location.origin);
    }

    // Every trace event is stamped here, at the emitting boundary, with one
    // sequence counter and one time origin, so a collector can order input /
    // state / command entries correctly even if messages arrive batched.
    function trace(kind, payload) {
        traceSeq += 1;
        const entry = { kind, seq: traceSeq, t: Math.round((performance.now() - timeOrigin) * 10) / 10, renderer: "canvas", ...payload };
        postToParent("v2:trace", entry);
        if (typeof options.onTrace === "function") options.onTrace(entry);
    }

    function renderMockReadout() {
        const parts = [];
        for (const [field, value] of mockState.entries()) parts.push(`${field}=${value}`);
        mockReadout.textContent = mode === "interact" && parts.length ? `mock: ${parts.join("  ")}` : "";
    }

    function renderBreadcrumbs() {
        breadcrumbs.innerHTML = "";
        if (!selectedId) return;
        const chain = ancestryChain(root, selectedId) || [];
        chain.forEach((id, index) => {
            if (index > 0) breadcrumbs.appendChild(document.createTextNode(" > "));
            const crumb = document.createElement("button");
            crumb.type = "button";
            crumb.textContent = labelText(nodeById.get(id)) || id;
            Object.assign(crumb.style, {
                font: "inherit", padding: "1px 4px", cursor: "pointer",
                background: id === selectedId ? "#e0c060" : "transparent",
                color: id === selectedId ? "#222" : "#8cf", border: "1px solid #444"
            });
            crumb.addEventListener("click", () => selectNode(id));
            breadcrumbs.appendChild(crumb);
        });
    }

    function selectNode(id, extra = {}) {
        if (!nodeById.has(id)) return false;
        selectedId = id;
        renderBreadcrumbs();
        draw();
        const node = nodeById.get(id);
        postToParent("v2:select", {
            nodeId: id,
            ancestry: ancestryChain(root, id),
            source: node.source,
            refSource: node.refSource,
            bindings: node.bindings,
            style: node.style || null,
            componentType: node.type,
            rect: layoutResult ? layoutResult.rects.get(id) || null : null,
            interactive: controllers.has(id),
            disabled: controllers.has(id) ? controllers.get(id).state.disabled : false,
            ...extra
        });
        return true;
    }

    function releaseInteraction() {
        // Leaving Interact mode must not activate anything. Cancelling the
        // gesture ends any drag and releases a held press without
        // dispatching, and the blur drops focus (spec 014 INT-001).
        deliver(pointer.cancel());
        if (focusedId) feed(focusedId, { type: "blur" });
        focusedId = null;
        dropActive = false;
    }

    function setMode(next) {
        if (next !== "inspect" && next !== "interact") return;
        if (!toolsEnabled && next === "inspect") return; // the plain application has no inspection surface
        if (mode === "interact" && next === "inspect") releaseInteraction();
        mode = next;
        if (mode !== "inspect" && hoveredId) {
            hoveredId = null;
            postToParent("v2:hover", { nodeId: null, ancestry: null });
        }
        inspectButton.style.fontWeight = mode === "inspect" ? "bold" : "normal";
        interactButton.style.fontWeight = mode === "interact" ? "bold" : "normal";
        renderMockReadout();
        draw();
        // Lets a hosting workbench restore the mode after it reloads this
        // frame following a save/regeneration.
        postToParent("v2:mode", { mode });
    }

    function renderDiagnostics() {
        if (!toolsEnabled) {
            // User-facing app: the list stays out of the UI but still reaches
            // the console, so a stale/partial generation is never silent.
            diagnostics.forEach(d => console[d.severity === "error" ? "error" : "warn"](`[${d.code}] ${d.message}`));
            if (diagnostics.length) console.info(`[v2] ${diagnostics.length} generation diagnostic(s); open workbench.html to inspect them`);
            return;
        }
        if (diagnostics.length === 0) {
            diagnosticsPanel.textContent = "0 warnings.";
            return;
        }
        diagnosticsPanel.innerHTML = "";
        const heading = document.createElement("div");
        heading.textContent = `${diagnostics.length} diagnostic(s):`;
        heading.style.marginBottom = "4px";
        diagnosticsPanel.appendChild(heading);
        diagnostics.forEach(d => {
            const line = document.createElement("div");
            const location = d.range ? `${d.file}:${d.range.start.line}` : d.file || "";
            line.textContent = `[${d.severity}] ${d.code} — ${d.message} (${location})`;
            line.style.color = d.severity === "error" ? "#ff8080" : "#e0c060";
            diagnosticsPanel.appendChild(line);
        });
        // Mirrors the browser list to the console (IWB-005: diagnostics
        // appear in both places).
        diagnostics.forEach(d => console[d.severity === "error" ? "error" : "warn"](`[${d.code}] ${d.message}`));
    }

    // --- drawing --------------------------------------------------------

    // The style that draws this node: the compiler resolved the variant, this
    // only has to find it in the loaded skin.
    function styleOf(node) {
        return assets.styleFor(node.style ? node.style.type : node.type, node.style ? node.style.variant : null);
    }


    // Spec 009: a node's draw kind owns both how it paints and how big it is,
    // so neither this function nor draw() names a component type.
    function kindOf(node) {
        return drawKind(node.supported === false ? "placeholder" : drawKindOf(node.type));
    }

    // Spec 012: a node with a `field` draws the value of that state field
    // instead of its authored text, which is how the status bar shows what is
    // playing. Any state change already triggers a redraw.
    // Spec 013: clipping, overlays and one modal slot.
    function clipOf(node) {
        return layoutResult ? layoutResult.clips.get(node.id) || null : null;
    }

    function isOverlayNode(node) {
        const entry = componentType(node.type);
        return Boolean(entry && entry.layer === "overlay");
    }

    /** The topmost modal overlay in the current layout, if any. */
    function modalOverlay() {
        if (!layoutResult || !layoutResult.overlays.length) return null;
        for (let i = layoutResult.overlays.length - 1; i >= 0; i--) {
            const node = nodeById.get(layoutResult.overlays[i]);
            const entry = node && componentType(node.type);
            if (entry && entry.modal) return node;
        }
        return null;
    }

    /**
     * Draws one node inside its clip. The save/clip/restore is skipped when
     * the clip already contains the rect, which is the common case, and the
     * draw is skipped entirely when the clip is empty.
     */
    function drawNode(node, rect) {
        const clip = clipOf(node);
        const clipped = clip && !(clip.x <= rect.x && clip.y <= rect.y
            && clip.x + clip.width >= rect.x + rect.width
            && clip.y + clip.height >= rect.y + rect.height);
        if (clip && (clip.width <= 0 || clip.height <= 0)) return;
        if (clipped) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(clip.x, clip.y, clip.width, clip.height);
            ctx.clip();
        }
        kindOf(node).draw(ctx, assets, styleOf(node), rect, textOf(node), visualStateOf(node), node);
        if (clipped) ctx.restore();
    }

    function textOf(node) {
        if (!node.field) return labelText(node);
        const value = mockState.get(node.field);
        return value === undefined || value === null ? "" : String(value);
    }

    function measureLeaf(node) {
        return kindOf(node).measure(assets, styleOf(node), textOf(node));
    }

    function isHighlighted(node) {
        if (typeof node.highlightedWhen === "function") {
            try { return Boolean(node.highlightedWhen(mockState)); } catch (error) { console.error(`[v2] highlightedWhen failed for ${node.id}`, error); return false; }
        }
        if (selectionModeOf(node.type) === "exclusiveWithinParent") {
            const group = parentOf(root, node.id);
            if (group && radioSelection.get(group) === node.id) return true;
        }
        return (node.bindings || []).some(b => b.kind === "visual-state" && b.state === "highlighted" && mockState.get(b.mockField) === b.activeValue);
    }

    // Spec 014: a draw kind that paints a number or a thumb needs more than
    // the interaction flags, and the renderer is the only place that can
    // resolve them. `stateFlags` ignores both extras.
    function visualStateOf(node) {
        const controller = controllers.get(node.id);
        const state = controller ? controller.state : {};
        const extra = {};
        const behavior = behaviorNames.get(node.id);
        if (behavior === "value") {
            extra.value = numericValueOf(node);
        } else if (behavior === "scroll" && layoutResult) {
            const extent = layoutResult.extents.get(node.id);
            if (extent) extra.scroll = { extent, offset: layoutResult.offsets.get(node.id) || 0 };
        }
        return { ...state, highlighted: isHighlighted(node), ...extra };
    }

    function drawOverlayOutline(rect, color, dashed) {
        ctx.save();
        if (dashed) ctx.setLineDash([4, 2]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(rect.width - 2, 0), Math.max(rect.height - 2, 0));
        ctx.restore();
    }

    function draw() {
        if (!layoutResult) return;
        const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
        ctx.clearRect(0, 0, viewport.width, viewport.height);
        ctx.fillStyle = "#1c1c1c";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const overlayIds = new Set(layoutResult.overlays);
        for (const node of allNodes) {
            if (overlayIds.has(node.id)) continue;
            const rect = layoutResult.rects.get(node.id);
            if (rect) drawNode(node, rect);
        }
        // Overlays paint after the tree, in declared order, and are followed
        // by their own children so a dialog's contents land on top of it.
        for (const id of layoutResult.overlays) {
            const overlay = nodeById.get(id);
            if (!overlay) continue;
            for (const node of flatten(overlay)) {
                const rect = layoutResult.rects.get(node.id);
                if (rect) drawNode(node, rect);
            }
        }

        // The inspection overlay never alters layout/app state (IWB-002); it
        // only draws on top. Hover is inspect-mode-only; selection persists
        // across mode switches where its node still exists (IWB-007).
        if (mode === "inspect" && hoveredId && hoveredId !== selectedId) {
            const rect = layoutResult.rects.get(hoveredId);
            if (rect) drawOverlayOutline(rect, "#7fd4ff", true);
        }
        if (selectedId) {
            const rect = layoutResult.rects.get(selectedId);
            if (rect) drawOverlayOutline(rect, "#e0c060", false);
        }
        // A file drag has to be acknowledged, or a drop looks like it did
        // nothing (spec 014 INT-008).
        if (dropActive) drawOverlayOutline({ x: 0, y: 0, width: viewport.width, height: viewport.height }, "#7fd4ff", true);
    }

    /**
     * Re-measures and re-lays out, then redraws. Separate from the canvas
     * resize because a *state* change can move things - a scroll offset, or a
     * field-bound label whose text changed width - and paying for a canvas
     * resize on every state change would be wasteful. Coalescing both into
     * one animation frame is package P8, which wants measurement first.
     */
    function relayout() {
        const viewport = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
        layoutResult = computeGenericLayout(root, viewport, measureLeaf, {
            scrollOffset: node => {
                if (!node.field) return 0;
                const value = Number(mockState.get(node.field));
                return Number.isFinite(value) ? value : 0;
            }
        });
        // Hit-testing scans this backwards, so overlays go last: painted on
        // top, hit first.
        const overlayIds = new Set(layoutResult.overlays);
        const entry = node => ({ id: node.id, rect: layoutResult.rects.get(node.id), clip: layoutResult.clips.get(node.id) });
        paintOrder = [
            ...allNodes.filter(node => !overlayIds.has(node.id)).map(entry),
            ...layoutResult.overlays.flatMap(id => flatten(nodeById.get(id) || { children: [] }).map(entry))
        ];
        draw();
    }

    /** The canvas element's backing size, which only the viewport size changes. */
    function recomputeLayout() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round((canvas.clientWidth || 1) * dpr);
        canvas.height = Math.round((canvas.clientHeight || 1) * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        relayout();
    }

    function pointFromEvent(event) {
        return mapPointerToLogical(event.clientX, event.clientY, canvas.getBoundingClientRect(), canvas.clientWidth, canvas.clientHeight);
    }

    // --- Interact mode: controllers, mock dispatch, tracing ------------

    function highlightSnapshot() {
        const snapshot = new Map();
        for (const id of controllers.keys()) snapshot.set(id, isHighlighted(nodeById.get(id)));
        return snapshot;
    }

    function traceHighlightChanges(before) {
        for (const [id, was] of before) {
            const now = isHighlighted(nodeById.get(id));
            if (now !== was) trace("state", { instance: id, field: "highlighted", from: was, to: now });
        }
    }

    /**
     * Writes a state field, tolerating one that the host store does not
     * declare. That can only happen for a hand-written tree, because the
     * emitter declares every field a bound node needs; swallowing it there
     * keeps one undeclared field from breaking every later input, and says so.
     */
    function setField(field, value) {
        try {
            mockState.set(field, value);
            return true;
        } catch (error) {
            console.warn(`[v2] state field "${field}" is not declared by the host store; the change was dropped`, error);
            return false;
        }
    }

    /** The code hook for one event, if the node carries one. */
    function handlerFor(node, event) {
        if (node.on && typeof node.on[event] === "function") return node.on[event];
        // `onActivate` predates named events and stays the click hook.
        if (event === "click" && typeof node.onActivate === "function") return node.onActivate;
        return null;
    }

    /**
     * Runs whatever a node has bound to one event (spec 014 generalizes the
     * old click-only `activate`). `click` comes from an activation, `change`
     * from a value or a radio selection, `doubleClick` and `secondaryClick`
     * from the gestures of the same name. A binding with no `event` is a
     * click, which is how every pre-014 outline keeps working.
     */
    function dispatch(id, event, detail = {}) {
        const node = nodeById.get(id);
        if (!node) return;
        const before = highlightSnapshot();
        if (event === "click" && selectionModeOf(node.type) === "exclusiveWithinParent") {
            const group = parentOf(root, id);
            const previous = radioSelection.get(group) || null;
            radioSelection.set(group, id);
            trace("activation", { instance: id, result: "selected", detail: `radio selection ${previous || "none"} -> ${id}` });
            traceHighlightChanges(before);
            // A radio group's choices are authored as items, so the `change`
            // action belongs to the group; the item that was picked is the value.
            if (group && previous !== id) dispatch(group, "change", { value: node.definitionName || labelText(node) });
            draw();
            return;
        }
        const handler = handlerFor(node, event);
        if (handler) {
            // Generated/hand-written apps: the node carries its behavior as
            // code. The hook may be async (lazy-loaded feature modules).
            trace("activation", { instance: id, result: "dispatched", event, detail: `handler ${event}` });
            Promise.resolve()
                .then(() => handler(options.appContext || { state: mockState, node }, detail))
                .then(() => { traceHighlightChanges(before); renderMockReadout(); relayout(); },
                      error => console.error(`[v2] ${event} handler failed for ${node.id}`, error));
            return;
        }
        const commands = (node.bindings || []).filter(b => b.origin === "action" && b.kind === "command"
            && (b.event === event || (event === "click" && !b.event)));
        if (commands.length === 0) {
            if (event === "click") {
                trace("activation", { instance: id, result: "inert", detail: "no supported command binding" });
                console.info(`[interact] "${labelText(node)}" activated: inert (no supported command binding)`);
            }
            return;
        }
        trace("activation", { instance: id, result: "dispatched", event, detail: commands.map(b => b.command).join(", ") });
        for (const binding of commands) {
            let from = null;
            let to = null;
            if (binding.mockField && detail.value !== undefined) {
                // The gesture carries the new value, so the mock does not
                // have to guess it from a cycle.
                from = detail.from !== undefined ? detail.from : mockState.get(binding.mockField);
                to = detail.value;
                setField(binding.mockField, to);
            } else if (binding.mockField && Array.isArray(binding.mockValues) && binding.mockValues.length) {
                from = mockState.get(binding.mockField);
                const index = binding.mockValues.indexOf(from);
                to = binding.mockValues[(index + 1) % binding.mockValues.length];
                setField(binding.mockField, to);
            }
            trace("command", { instance: id, command: binding.command, event, mockField: binding.mockField || null, from, to });
            console.info(`[interact] dispatched "${binding.command}" (mock) ${binding.mockField ? `${binding.mockField}: ${from} -> ${to}` : ""}`.trim());
        }
        traceHighlightChanges(before);
        renderMockReadout();
        relayout();
    }

    function rectOf(id) {
        return (id && layoutResult && layoutResult.rects.get(id)) || null;
    }

    /** A viewport's content size, applied offset and whether it can scroll at all. */
    function scrollInfoOf(node) {
        if (!layoutResult || behaviorNames.get(node.id) !== "scroll") return null;
        return {
            extent: layoutResult.extents.get(node.id) || null,
            offset: layoutResult.offsets.get(node.id) || 0,
            // With no bound field there is nowhere to put an offset, so the
            // box does not scroll and must not swallow the wheel.
            scrollable: Boolean(node.field)
        };
    }

    /** This control's value, from the field that holds it, clamped and snapped. */
    function numericValueOf(node) {
        return quantize(Number(mockState.get(valueFieldOf(node))), boundsOf(node));
    }

    /**
     * What the controller needs to know about the node it belongs to. The
     * behavior name selects which extras are worth resolving, so a button
     * never pays for a scroll lookup.
     */
    function contextFor(node, input) {
        const rect = rectOf(node.id);
        const extra = { rect };
        if (rect && input.point) extra.local = input.local || { x: input.point.x - rect.x, y: input.point.y - rect.y };
        const behavior = behaviorNames.get(node.id);
        if (behavior === "value") {
            extra.bounds = boundsOf(node);
            extra.value = numericValueOf(node);
        } else if (behavior === "scroll") {
            const scroll = scrollInfoOf(node);
            if (scroll) Object.assign(extra, scroll);
        }
        return extra;
    }

    // A drag fires per pointer move; one trace entry per animation frame is
    // enough to read the gesture and keeps the Interaction log usable
    // (spec 014 INT-009).
    function traceInput(id, input) {
        const detail = {};
        if (input.delta) { detail.dx = Math.round(input.delta.x); detail.dy = Math.round(input.delta.y); }
        if (input.type === "wheel") detail.deltaY = input.deltaY;
        if (input.type === "drag") {
            const now = performance.now();
            if (now - lastDragTrace < 16) return;
            lastDragTrace = now;
        }
        trace("input", { instance: id, input: input.type, key: input.key || null, ...detail });
    }

    /** Writes a value control's new value, then tells its `change` action. */
    function applyValue(node, value) {
        const field = valueFieldOf(node);
        const from = mockState.get(field);
        if (!setField(field, value)) return;
        trace("value", { instance: node.id, field, from, to: value });
        // `from` travels with the change, because this write already happened
        // and a command reading the field now would report "1 -> 1".
        dispatch(node.id, "change", { value, from });
        relayout();
    }

    /** Writes a viewport's requested offset; the layout clamps it (spec 013). */
    function applyScroll(node, requested) {
        if (!node.field) return;
        const from = Number(mockState.get(node.field)) || 0;
        if (!setField(node.field, Math.max(0, Math.round(requested)))) return;
        relayout();
        trace("scroll", { instance: node.id, field: node.field, from, to: layoutResult.offsets.get(node.id) || 0 });
    }

    /**
     * @param {{ quietIfIgnored?: boolean }} [options] suppresses the trace when
     *   the controller did nothing with the input, which is how a wheel can be
     *   offered to each ancestor in turn without filling the log.
     */
    function feed(id, input, options = {}) {
        const controller = controllers.get(id);
        if (!controller) return null;
        const node = nodeById.get(id);
        const result = controller.handle({ ...input, ...contextFor(node, input) });
        if (!options.quietIfIgnored || result.handled || result.transitions.length || result.blocked) traceInput(id, input);
        result.transitions.forEach(t => trace("state", { instance: id, field: t.field, from: t.from, to: t.to }));
        if (result.blocked) trace("activation", { instance: id, result: `blocked-${result.blocked}`, detail: result.blocked === "disabled" ? "control is disabled; no command" : "control is not focused" });
        if (result.changed && typeof result.value === "number") applyValue(node, result.value);
        else if (result.changed && typeof result.scrollTo === "number") applyScroll(node, result.scrollTo);
        else if (result.activated) dispatch(id, "click");
        else if (result.transitions.length) draw();
        return result;
    }

    /**
     * Hands the router's semantic inputs to their nodes. The two gestures
     * that are not controller inputs at all - a double-click and a secondary
     * click - go straight to their event, so a type that ignores them
     * behaves exactly as it did before they existed.
     */
    function deliver(inputs) {
        for (const input of inputs) {
            if (input.type === "doubleclick" || input.type === "secondaryclick") {
                if (!input.id) continue;
                traceInput(input.id, input);
                dispatch(input.id, input.type === "doubleclick" ? "doubleClick" : "secondaryClick", { point: input.point });
                continue;
            }
            feed(input.id, input);
        }
    }

    /** The cursor for what the pointer is over, or for what it is dragging. */
    function applyCursor(hitId) {
        if (mode === "inspect") { canvas.style.cursor = "crosshair"; return; }
        // While a drag runs, the dragged control owns the cursor wherever the
        // pointer goes; that is the whole point of capture.
        const id = pointer.dragging ? pointer.captureId : hitId;
        const node = id ? nodeById.get(id) : null;
        if (!node) { canvas.style.cursor = "default"; return; }
        let cursor = cursorOf(node.type);
        if (behaviorNames.get(node.id) === "scroll") {
            const scroll = scrollInfoOf(node);
            const metrics = scroll && scroll.scrollable ? thumbMetrics(rectOf(node.id), scroll.extent, scroll.offset) : null;
            if (!metrics) cursor = "default";
            else if (pointer.dragging && pointer.captureId === node.id) cursor = "grabbing";
        }
        canvas.style.cursor = cursor;
    }

    function setDisabled(id, disabled) {
        const controller = controllers.get(id);
        if (!controller) return;
        controller.setDisabled(disabled).forEach(t => trace("state", { instance: id, field: t.field, from: t.from, to: t.to }));
        draw();
    }

    function moveFocus(direction) {
        if (interactiveIds.length === 0) return;
        const index = focusedId ? interactiveIds.indexOf(focusedId) : -1;
        const next = interactiveIds[(index + direction + interactiveIds.length) % interactiveIds.length];
        if (focusedId && focusedId !== next) feed(focusedId, { type: "blur" });
        focusedId = next;
        feed(focusedId, { type: "focus" });
    }

    /**
     * Spec 013 LAY-005: while a modal overlay is present, a hit outside its
     * subtree is not a hit at all. One gate for every pointer path, so
     * Inspect and Interact route identically.
     */
    function hitTest(point) {
        const hitId = hitTestPoint(paintOrder, point);
        const modal = modalOverlay();
        if (!modal) return hitId;
        if (!hitId) return null;
        const chain = ancestryChain(modal, hitId);
        return chain ? hitId : null;
    }

    function handlePointerMove(event) {
        const point = pointFromEvent(event);
        const hitId = hitTest(point);
        if (mode === "inspect") {
            if (hitId === hoveredId) return;
            hoveredId = hitId;
            draw();
            postToParent("v2:hover", { nodeId: hitId, ancestry: hitId ? ancestryChain(root, hitId) : null, rect: hitId ? layoutResult.rects.get(hitId) || null : null });
            return;
        }
        deliver(pointer.move({ hitId, point, time: event.timeStamp }));
        applyCursor(hitId);
    }

    function handlePointerLeave() {
        if (mode === "inspect") {
            if (!hoveredId) return;
            hoveredId = null;
            draw();
            postToParent("v2:hover", { nodeId: null, ancestry: null });
            return;
        }
        deliver(pointer.cancel());
        applyCursor(null);
    }

    function handlePointerDown(event) {
        if (mode !== "interact") return;
        const point = pointFromEvent(event);
        const hitId = hitTest(point);
        canvas.focus({ preventScroll: true });
        const target = controllers.has(hitId) ? hitId : null;
        if (focusedId && focusedId !== target) {
            feed(focusedId, { type: "blur" });
            focusedId = null;
        }
        if (target) focusedId = target;
        // The element-level capture is what makes a drag survive leaving the
        // canvas; the router's capture is what makes it stay on one node.
        if (typeof canvas.setPointerCapture === "function" && event.pointerId !== undefined) {
            try { canvas.setPointerCapture(event.pointerId); } catch { /* a synthetic event has no pointer to capture */ }
        }
        deliver(pointer.down({ id: hitId, point, button: event.button, time: event.timeStamp, rect: rectOf(hitId) }));
        applyCursor(hitId);
    }

    function handlePointerUp(event) {
        if (mode !== "interact") return;
        const point = pointFromEvent(event);
        deliver(pointer.up({ point, button: event.button, time: event.timeStamp }));
        applyCursor(hitTest(point));
    }

    function handlePointerCancel() {
        if (mode !== "interact") return;
        deliver(pointer.cancel());
        applyCursor(null);
    }

    /**
     * The wheel goes to the deepest node under the pointer whose controller
     * does something with it, and to its ancestors otherwise. Each candidate
     * is simply offered the input and asked whether it handled it, so this
     * function knows nothing about which behaviors care about a wheel.
     */
    function handleWheel(event) {
        if (mode !== "interact") return;
        const point = pointFromEvent(event);
        const chain = ancestryChain(root, hitTest(point)) || [];
        for (let i = chain.length - 1; i >= 0; i--) {
            if (!controllers.has(chain[i])) continue;
            const result = feed(chain[i], { type: "wheel", point, deltaY: event.deltaY, deltaX: event.deltaX }, { quietIfIgnored: true });
            if (result && result.handled) {
                event.preventDefault();
                return;
            }
        }
    }

    // A secondary click is a gesture of the application's, so the browser
    // menu must not take it (spec 014 INT-005).
    function handleContextMenu(event) {
        if (mode === "interact") event.preventDefault();
    }

    // --- file drag-and-drop (spec 014 INT-008) -------------------------

    function draggingFiles(event) {
        const types = event.dataTransfer ? event.dataTransfer.types : null;
        return Boolean(types && [...types].includes("Files"));
    }

    function handleDragOver(event) {
        if (!draggingFiles(event)) return;
        // Without this the browser navigates away from the application.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (!dropActive) { dropActive = true; draw(); }
    }

    function handleDragLeave() {
        if (!dropActive) return;
        dropActive = false;
        draw();
    }

    function handleDrop(event) {
        if (!draggingFiles(event)) return;
        event.preventDefault();
        dropActive = false;
        draw();
        const files = [...(event.dataTransfer.files || [])];
        trace("filedrop", { instance: null, files: files.map(file => file.name), bytes: files.reduce((sum, file) => sum + file.size, 0) });
        const open = options.appContext && typeof options.appContext.openFiles === "function" ? options.appContext.openFiles : null;
        if (!open) {
            // The authoring preview supplies no app context on purpose, so a
            // drop there is a trace and nothing else: opening the workbench
            // must never start an audio device (spec 012).
            console.info(`[v2] ${files.length} file(s) dropped; this host has no openFiles hook`);
            return;
        }
        Promise.resolve()
            .then(() => open(files))
            .then(() => { renderMockReadout(); relayout(); },
                  error => console.error("[v2] openFiles failed", error));
    }

    function handleClick(event) {
        if (mode !== "inspect") return; // Interact mode activates on pointerup through the controller, never here.
        const hitId = hitTest(pointFromEvent(event));
        if (!hitId) return;
        // Inspection never dispatches the component's application command
        // (IWB-003); it only selects, regardless of what the node does.
        selectNode(hitId);
    }

    function handleKeyDown(event) {
        if (mode !== "interact") return;
        if (event.key === "Tab") {
            event.preventDefault();
            moveFocus(event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (focusedId) feed(focusedId, { type: "keydown", key: event.key });
        }
    }

    function handleKeyUp(event) {
        if (mode !== "interact") return;
        if (event.key === " " && focusedId) {
            event.preventDefault();
            feed(focusedId, { type: "keyup", key: event.key });
        }
    }

    function handleCanvasBlur() {
        if (mode !== "interact") return;
        deliver(pointer.cancel());
        if (focusedId) feed(focusedId, { type: "blur" });
        focusedId = null;
    }

    function handleMessage(event) {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const message = event.data;
        if (!message || typeof message !== "object") return;
        if (message.type === "v2:setMode") setMode(message.mode);
        else if (message.type === "v2:selectId") selectNode(message.nodeId, message.restore ? { restored: true } : {});
        else if (message.type === "v2:setDisabled") setDisabled(message.nodeId, Boolean(message.disabled));
    }

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("dragleave", handleDragLeave);
    canvas.addEventListener("drop", handleDrop);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("blur", handleCanvasBlur);
    window.addEventListener("message", handleMessage);

    renderDiagnostics();
    setMode(mode);

    const resizeObserver = new ResizeObserver(() => recomputeLayout());
    resizeObserver.observe(canvasHolder);
    recomputeLayout();

    // Any state change from anywhere (an action finishing later, a capability
    // module) must be reflected in the highlights.
    // A state change can move things, not only recolour them: a viewport's
    // offset and a field-bound label's width both come from state, so this
    // re-lays out rather than only redrawing. (Spec 013 only redrew, which
    // meant a scroll offset written from outside did not move the content.)
    const unsubscribeState = typeof options.state?.onAnyChange === "function"
        ? options.state.onAnyChange(() => { renderMockReadout(); relayout(); })
        : null;

    postToParent("v2:ready", { sourceFiles: outline.sourceFiles, interactive: interactiveIds });

    return {
        setMode,
        selectNode,
        setDisabled,
        get mockState() { return new Map(mockState.entries()); },
        /** The applied scroll offset per viewport, for tests and tooling. */
        layoutOffsets() { return layoutResult ? new Map(layoutResult.offsets) : new Map(); },
        /** Where each node ended up, so a caller can aim at one without guessing. */
        layoutRects() { return layoutResult ? new Map(layoutResult.rects) : new Map(); },
        dispose() {
            if (unsubscribeState) unsubscribeState();
            resizeObserver.disconnect();
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerleave", handlePointerLeave);
            canvas.removeEventListener("pointerdown", handlePointerDown);
            canvas.removeEventListener("pointerup", handlePointerUp);
            canvas.removeEventListener("pointercancel", handlePointerCancel);
            canvas.removeEventListener("wheel", handleWheel);
            canvas.removeEventListener("contextmenu", handleContextMenu);
            canvas.removeEventListener("dragover", handleDragOver);
            canvas.removeEventListener("dragleave", handleDragLeave);
            canvas.removeEventListener("drop", handleDrop);
            canvas.removeEventListener("click", handleClick);
            canvas.removeEventListener("keydown", handleKeyDown);
            canvas.removeEventListener("keyup", handleKeyUp);
            canvas.removeEventListener("blur", handleCanvasBlur);
            window.removeEventListener("message", handleMessage);
            container.removeChild(shell);
        }
    };
}
