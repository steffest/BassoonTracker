import { computeGenericLayout } from "../../runtime/genericLayout.js";
import { hitTestPoint, ancestryChain, mapPointerToLogical } from "../../runtime/hitTest.js";
import { createBehaviorController } from "../../runtime/behaviors.js";
import { createPointerRouter } from "../../runtime/pointerRouter.js";
import { boundsOf, valueFieldOf, quantize } from "../../runtime/valueController.js";
import { scrollFieldOf } from "../../runtime/listController.js";
import { rowsFieldOf } from "../../runtime/fileBrowserController.js";
import { clampOffset as clampRowOffset } from "./fileBrowserGeometry.js";
import { paddedValue, clampOnly as clampNumberDisplay } from "../../runtime/numberDisplayController.js";
import { thumbMetrics } from "../../runtime/scrollbar.js";
import { buildShortcutTable, matchShortcutTable } from "../../runtime/shortcuts.js";
import { advanceSprites, anyFrameChanged } from "../../runtime/animationClock.js";
import { createFrameGovernor } from "../../runtime/frameGovernor.js";
import { ensureIds } from "../../runtime/components.js";
import { synthesizeOverlayChildren } from "../../runtime/overlaySynthesis.js";
import { loadCanvasAssets } from "./assets.js";
import { drawKind } from "./drawKinds.js";
import { drawKindOf, behaviorOf, behaviorOptionsOf, cursorOf, selectionModeOf, componentType, isAnimatedType, isTickingType } from "../../runtime/componentTypes.js";

// Spec 015: how long the pointer must rest on a `tooltip`-bearing node before
// its text appears. v1 shows one instantly; this is a deliberate choice, not
// a divergence discovered mid-port, since v1 has no delay logic to point at.
const TOOLTIP_DELAY_MS = 500;

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

/**
 * Spec 071: a *compiled* node's own `labelVariants` (compiler/convert.js's
 * own `applyLabel`) is already the single source of truth for whether it
 * has a label at all - an authored `label: ""` correctly compiles to `[]`,
 * distinct from no `label:` key at all only in that the compiler already
 * decided not to fall back to the node's own name that time. Falling back
 * here too, unconditionally, silently overrode that decision (found while
 * placing this whole application's first image-only button, `logoBanner` -
 * v1's own logo has no text on it at all, but its own bare authored name
 * rendered on top of the artwork regardless). The name/type fallback stays,
 * but only for a node that never went through the compiler's own label
 * resolution in the first place (`labelVariants` itself absent, not just
 * empty) - a hand-built tree (a test fixture, the workbench's own synthetic
 * nodes), which the compiler never touches at all.
 */
function labelText(node) {
    if (Array.isArray(node.labelVariants)) return node.labelVariants[0] || "";
    return node.definitionName || node.type;
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
    // Spec 020: a dropdown's popup and a modal dialog's OK/Cancel/input are
    // not authored - built once, here, so both the authoring preview and a
    // generated application (which share this one file) get them the same way.
    synthesizeOverlayChildren(root);
    const allNodes = flatten(root);
    const nodeById = new Map(allNodes.map(node => [node.id, node]));

    const toolsEnabled = options.tools !== false;
    let mode = !toolsEnabled || options.mode === "interact" ? "interact" : "inspect";
    let hoveredId = null;      // inspect-mode hover (overlay only)
    let selectedId = null;
    let layoutResult = null;
    let paintOrder = [];
    // Spec 030: the live modifier keys at the moment of the last pointer
    // event, read only by patternGrid's own "grid" behavior (selection-drag
    // vs pan-drag) via contextFor(). Set from the native event itself rather
    // than threaded through runtime/pointerRouter.js, so that module's own
    // emitted shapes and tests stay exactly as spec 014/015/019 left them.
    const pointerModifiers = { meta: false, ctrl: false };

    // --- interaction model (Interact mode only) -------------------------
    // Spec 014: which controller a node gets is declared by its type
    // (`behavior` in runtime/componentTypes.js) and built by one factory
    // table, so this loop names no component type and no behavior.
    const controllers = new Map();
    const behaviorNames = new Map(); // id -> the behavior name its controller implements
    const radioSelection = new Map(); // radioGroup id -> selected item id (UI state; no command exists for it yet)
    // Spec 020: every overlay-type node starts closed. This is the runtime
    // fact runtime/genericLayout.js's new `overlayOpen` option reads; nothing
    // about "which types are overlays" is decided here, only "is this
    // particular instance currently one of them".
    const overlayOpenState = new Map();
    for (const node of allNodes) {
        const entry = componentType(node.type);
        if (entry && entry.layer === "overlay") overlayOpenState.set(node.id, false);
    }
    for (const node of allNodes) {
        if (node.supported === false) continue;
        const behavior = behaviorOf(node.type);
        // A node's own `vertical` (spec 018: rangeSlider) overrides the
        // type's declared axis; read generically, by property name, not by
        // checking what type the node is.
        const options = { ...behaviorOptionsOf(node.type) };
        if (node.vertical) options.axis = "y";
        // A node's own `envelopeType` (spec 056: envelopeView) picks which
        // of the current instrument's two envelopes this instance
        // addresses - the same "read generically, by property name" shape
        // `vertical` already has above.
        if (node.envelopeType) options.envelopeType = node.envelopeType;
        const controller = behavior ? createBehaviorController(behavior, options) : null;
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
                } else if (behavior === "list") {
                    const field = valueFieldOf(node);
                    if (field) map.set(field, 0);
                    map.set(scrollFieldOf(node), 0);
                } else if (behavior === "rowList") {
                    // Unlike a listbox's authored items, a fileBrowser starts
                    // with no rows at all until a capability publishes some
                    // (spec 035 has none yet) - -1 means "nothing selected",
                    // never 0, which would claim an empty list's first row.
                    const field = valueFieldOf(node);
                    if (field) map.set(field, -1);
                    map.set(scrollFieldOf(node), 0);
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

    // Spec 015: the declared shortcut table, built once from every node's
    // `shortKey`. A duplicate keeps the first registration and is reported
    // rather than silently overwritten.
    const shortcutTable = buildShortcutTable(allNodes, (signature, existingId, duplicateId) => {
        console.warn(`[v2] shortcut "${signature}" is already bound to "${existingId}"; "${duplicateId}"'s shortKey is ignored`);
    });
    // The in-app clipboard cut/copy/paste always use (spec 015): deterministic,
    // no permissions, no async gap. Ctrl+V reads it directly at keydown; see
    // design.md for why a native ClipboardEvent bridge was tried and dropped.
    let lastClipboard = "";
    // Hover-delay tooltip state (spec 015), the same weight as dropActive above.
    let tooltipTimer = null;
    let tooltipTarget = null;    // node id the pending timer is counting down for
    let tooltipFor = null;       // node id currently showing its tooltip
    let tooltipPoint = null;     // last pointer point, for placement

    // Spec 017: the animation clock. Only nodes whose type declares
    // `animated: true` and that have a bound field are driven; the loop
    // itself only runs while at least one exists, so a tree with none pays
    // nothing extra (see startAnimationClock() below, called after mount).
    const animatedNodes = allNodes.filter(node => isAnimatedType(node.type) && node.field);
    const spriteClock = new Map(animatedNodes.map(node => [node.id, { frame: Number(mockState.get(node.field)) || 0, elapsed: 0 }]));
    let animationFrameHandle = null;
    let animationLastTime = null;

    // Spec 047: a second, independent clock for a "ticks: true" node (so far
    // only nibblesGrid) - a whole simulation step has no bound field's frame
    // count to advance, and needs to run even without one, so it is kept
    // apart from the sprite clock above rather than folded into it (the same
    // choice spec 032's own coalesced-draw loop already made against the
    // sprite clock: "the same start/stop shape ... applied here to
    // everything else instead of unifying the two").
    const tickingNodes = allNodes.filter(node => isTickingType(node.type));
    let tickAnimationFrameHandle = null;
    let tickLastTime = null;

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
        markNeedsDraw();
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
        hideTooltip();
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
        markNeedsDraw();
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

    /**
     * A dropdown's closed control shows the selected item's own label, not
     * the raw field value (which is an index, exactly like listbox's) - the
     * label lives on the synthesized popup's own child at that index (spec 020).
     */
    function dropdownSelectedLabel(node) {
        const popup = (node.children || [])[0];
        if (!popup) return "";
        const index = Number(mockState.get(node.field));
        const item = Number.isFinite(index) ? (popup.children || [])[index] : null;
        return item ? labelText(item) : "";
    }

    function textOf(node) {
        // A dropdown's own field is always set by synthesis (spec 020); a
        // menuTrigger (spec 023) shares the "disclose" behavior but never
        // has one, so it falls through to its own plain authored label,
        // never a selected-item lookup that has nothing to look up.
        if (behaviorNames.get(node.id) === "disclose" && node.field) return dropdownSelectedLabel(node);
        // A numberDisplay's own drawn text is its padded digit string (spec
        // 027), not the raw field value - the same source of truth the
        // controller's own caret math and the draw kind both need, so
        // resolving it once, here, keeps drawing and hit-testing in sync.
        if (behaviorNames.get(node.id) === "digitEntry") {
            const value = clampNumberDisplay(Number(mockState.get(valueFieldOf(node))), boundsOf(node));
            return paddedValue(value, node.padLength || 4);
        }
        if (!node.field) return labelText(node);
        const value = mockState.get(node.field);
        return value === undefined || value === null ? "" : String(value);
    }

    function measureLeaf(node) {
        return kindOf(node).measure(assets, styleOf(node), textOf(node), node);
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
        } else if (behavior === "list" && layoutResult) {
            const extent = layoutResult.extents.get(node.id);
            if (extent) extra.scroll = { extent, offset: layoutResult.offsets.get(node.id) || 0 };
            const selectedIndex = Number(mockState.get(valueFieldOf(node)));
            const selectedChild = Number.isFinite(selectedIndex) ? (node.children || [])[selectedIndex] : null;
            extra.selectedItemRect = selectedChild ? layoutResult.rects.get(selectedChild.id) || null : null;
        } else if (behavior === "flyout" && layoutResult) {
            // A submenu's own draw kind needs the hovered row's rect (it has
            // no other way to know where the renderer put it, exactly like
            // listbox's selectedItemRect above) and which rows are currently
            // disabled, resolved the same generic way isHighlighted() already
            // resolves any other node's state.
            const children = node.children || [];
            const hoverIndex = controller.state.hoverIndex;
            const hoverChild = Number.isFinite(hoverIndex) ? children[hoverIndex] : null;
            extra.hoverItemRect = hoverChild ? layoutResult.rects.get(hoverChild.id) || null : null;
            extra.itemDisabled = children.map(child => typeof child.disabledWhen === "function" ? Boolean(child.disabledWhen(mockState)) : false);
        } else if (behavior === "rowList") {
            // fileBrowser (spec 035): rows and scroll offset both come from
            // mockState, not layoutResult - there are no children to derive
            // an extent from, so the content height is the rows array's own
            // length, computed the same way the controller clamps it.
            const rows = mockState.get(rowsFieldOf(node)) || [];
            extra.rows = rows;
            const rect = rectOf(node.id);
            extra.offset = clampRowOffset(Number(mockState.get(scrollFieldOf(node))) || 0, rows.length, rect ? rect.height : 0);
            const selected = Number(mockState.get(valueFieldOf(node)));
            extra.selectedIndex = Number.isFinite(selected) ? selected : -1;
        } else if (behavior === "tabs") {
            const index = Number(mockState.get(valueFieldOf(node)));
            extra.activeIndex = Number.isFinite(index) ? index : 0;
        } else if (behavior === "collapsible") {
            extra.collapsed = Boolean(mockState.get(valueFieldOf(node)));
        } else if (!behavior && node.field) {
            // A non-interactive type with a bound field reads its raw value
            // generically (spec 017): so far only animSprite's frame index,
            // but nothing here needs to name that type to do it.
            extra.fieldValue = mockState.get(node.field);
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

    function performDraw() {
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
        if (tooltipFor && tooltipPoint) drawTooltip(tooltipFor, tooltipPoint, viewport);
    }

    /**
     * No component type, no draw kind, no skin entry (spec 015): a tooltip is
     * a plain `tooltip:` property drawn ad hoc, the same weight as the
     * drop-zone border above, because `tooltip` the *component type* stays
     * P5's, per spec 013's design.md.
     */
    function drawTooltip(id, point, viewport) {
        const node = nodeById.get(id);
        const text = node && node.tooltip;
        if (!text) return;
        const font = assets.font;
        const padding = 4;
        const width = font.getTextWidth(text) + padding * 2;
        const height = font.charHeight + padding * 2;
        const x = Math.min(Math.max(point.x + 12, 0), Math.max(viewport.width - width, 0));
        const y = Math.min(Math.max(point.y + 16, 0), Math.max(viewport.height - height, 0));
        ctx.save();
        ctx.fillStyle = "rgba(20,20,20,0.95)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "#e0c060";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
        ctx.restore();
        font.write(ctx, text, x + padding, y + padding);
    }

    /**
     * Re-measures and re-lays out, then redraws. Separate from the canvas
     * resize because a *state* change can move things - a scroll offset, or a
     * field-bound label whose text changed width - and paying for a canvas
     * resize on every state change would be wasteful. Called directly, right
     * now, only from `onAnimationFrame()` (spec 032) - everything else asks
     * for one via `markNeedsRelayout()` instead of calling this.
     */
    function performRelayout() {
        syncDisabled();
        const viewport = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
        layoutResult = computeGenericLayout(root, viewport, measureLeaf, {
            scrollOffset: node => {
                // A listbox's offset lives at its own derived field (spec
                // 019): `node.field` is its selection, not its scroll.
                const field = behaviorNames.get(node.id) === "list" ? scrollFieldOf(node) : node.field;
                if (!field) return 0;
                const value = Number(mockState.get(field));
                return Number.isFinite(value) ? value : 0;
            },
            overlayOpen: node => Boolean(overlayOpenState.get(node.id)),
            // Spec 021: both read the same bound field a tabPanel's/
            // collapsePanel's own behavior already writes through applyValue(),
            // so the layout that decides what is shown and the state that
            // decides it can never disagree.
            activeTab: node => {
                const value = Number(mockState.get(valueFieldOf(node)));
                return Number.isFinite(value) ? value : 0;
            },
            collapsed: node => Boolean(mockState.get(valueFieldOf(node))),
            // Spec 025: view-routing generalized to any node - a
            // `visibleWhen.field` is just another state field, read the same
            // way every other bound field already is.
            stateValueOf: field => mockState.get(field)
        });
        // Hit-testing scans this backwards, so overlays go last: painted on
        // top, hit first.
        const overlayIds = new Set(layoutResult.overlays);
        const entry = node => ({ id: node.id, rect: layoutResult.rects.get(node.id), clip: layoutResult.clips.get(node.id) });
        paintOrder = [
            ...allNodes.filter(node => !overlayIds.has(node.id)).map(entry),
            ...layoutResult.overlays.flatMap(id => flatten(nodeById.get(id) || { children: [] }).map(entry))
        ];
        performDraw();
    }

    /**
     * The canvas element's backing size, which only the viewport size and
     * "Optimize High DPI" (spec 032) change. Off by default, matching v1's
     * own `useDevicePixelRatio = false` (ui.js:28) - the store already seeds
     * `high-dpi.active: false`, so this was the only missing piece.
     */
    function recomputeLayout() {
        const highDpi = Boolean(mockState.get("high-dpi.active"));
        const dpr = highDpi ? (window.devicePixelRatio || 1) : 1;
        canvas.width = Math.round((canvas.clientWidth || 1) * dpr);
        canvas.height = Math.round((canvas.clientHeight || 1) * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        markNeedsRelayout();
    }

    // --- coalesced drawing (spec 032) ------------------------------------
    // Every draw-triggering event asks for one via markNeedsDraw()/
    // markNeedsRelayout() instead of calling performDraw()/performRelayout()
    // directly; at most one requestAnimationFrame is ever pending at a time,
    // and it stops rescheduling itself once nothing is left to do (PERF-002)
    // - the same start/stop shape runtime/animationClock.js's own loop
    // already has for sprite animation (spec 017), applied here to
    // everything else instead of unifying the two.

    const frameGovernor = createFrameGovernor();
    let frameHandle = null;
    let pending = null; // null | "draw" | "relayout" - "relayout" subsumes a plain "draw"

    function requestFrame(kind) {
        if (pending !== "relayout") pending = kind;
        if (frameHandle !== null) return;
        frameHandle = requestAnimationFrame(onAnimationFrame);
    }

    function onAnimationFrame(now) {
        frameHandle = null;
        const skipCount = Number(mockState.get("screen-refresh.value")) || 0;
        if (!frameGovernor.shouldDraw(now, skipCount)) {
            frameHandle = requestAnimationFrame(onAnimationFrame); // still pending; try again next frame
            return;
        }
        const kind = pending;
        pending = null;
        if (kind === "relayout") performRelayout();
        else if (kind === "draw") performDraw();
    }

    function markNeedsDraw() { requestFrame("draw"); }
    function markNeedsRelayout() { requestFrame("relayout"); }

    // --- overlay open/close (spec 020) -----------------------------------
    // The one new piece of runtime state this cluster needs: whether an
    // overlay-type node currently participates in layout at all. Exposed on
    // the mounted instance's public API (below) alongside setMode/selectNode,
    // since an application opens a modalDialog, and a hand-built test tree
    // opens a submenu, the same way - there is no authored vocabulary for it
    // (design.md "what this deliberately does not do").

    function openOverlay(id, { anchorTo, edge } = {}) {
        const node = nodeById.get(id);
        if (!node || !overlayOpenState.has(id)) return;
        if (anchorTo) node.anchor = { targetId: anchorTo, edge: edge || "below" };
        if (overlayOpenState.get(id)) return;
        overlayOpenState.set(id, true);
        trace("overlay", { instance: id, open: true });
        markNeedsRelayout();
    }

    function closeOverlay(id) {
        if (!overlayOpenState.get(id)) return;
        overlayOpenState.set(id, false);
        trace("overlay", { instance: id, open: false });
        markNeedsRelayout();
    }

    function toggleOverlay(id, opts) {
        if (overlayOpenState.get(id)) closeOverlay(id);
        else openOverlay(id, opts);
    }

    /**
     * The generic shape a modalDialog's Escape/Enter/OK/Cancel all resolve
     * to: dispatch a "close" event naming which one happened (and the
     * embedded text field's value, if it has one) on the overlay itself, then
     * close it. Used for any modal overlay, not only modalDialog by name -
     * harmless for one with no embedded input, since `input` is simply
     * undefined then.
     */
    function dismissOverlay(id, result) {
        const node = nodeById.get(id);
        if (!node) return;
        const input = (node.children || []).find(child => behaviorNames.get(child.id) === "text");
        const value = input ? mockState.get(input.field) : undefined;
        dispatch(id, "close", { result, value });
        closeOverlay(id);
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
            markNeedsDraw();
            return;
        }
        const handler = handlerFor(node, event);
        if (handler) {
            // Generated/hand-written apps: the node carries its behavior as
            // code. The hook may be async (lazy-loaded feature modules).
            trace("activation", { instance: id, result: "dispatched", event, detail: `handler ${event}` });
            Promise.resolve()
                .then(() => handler(options.appContext || { state: mockState, node }, detail))
                .then(() => { traceHighlightChanges(before); renderMockReadout(); markNeedsRelayout(); },
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
        markNeedsRelayout();
    }

    function rectOf(id) {
        return (id && layoutResult && layoutResult.rects.get(id)) || null;
    }

    /** A viewport's or a listbox's content size, applied offset and whether it can scroll at all. */
    function scrollInfoOf(node) {
        const behavior = behaviorNames.get(node.id);
        if (!layoutResult || (behavior !== "scroll" && behavior !== "list")) return null;
        return {
            extent: layoutResult.extents.get(node.id) || null,
            offset: layoutResult.offsets.get(node.id) || 0,
            // A viewport with no bound field has nowhere to put an offset, so
            // it does not scroll and must not swallow the wheel; a listbox
            // always has one, derived from its own id (spec 019), regardless
            // of whether a selection field was authored.
            scrollable: behavior === "list" ? true : Boolean(node.field)
        };
    }

    /** Which authored item (a direct child) a point lands inside, for a listbox's click-to-select (spec 019). */
    function itemIndexAt(node, point) {
        if (!point) return null;
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
            const rect = rectOf(children[i].id);
            if (rect && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return i;
        }
        return null;
    }

    /**
     * Which tab a point falls in, for a tabPanel's own header strip (spec
     * 021): unlike `itemIndexAt`, this does not read a per-child rect - only
     * the *active* item ever has one, since every other item's subtree is
     * absent from layout entirely. The header is divided into equal-width
     * slots instead (design.md explains why not per-label widths), and a
     * point below it selects nothing.
     */
    function tabIndexAt(node, point) {
        const rect = rectOf(node.id);
        const items = node.children || [];
        if (!rect || !point || items.length === 0) return null;
        const entry = componentType(node.type);
        const height = (entry && entry.tabHeader && entry.tabHeader.height) || 0;
        if (point.y < rect.y || point.y > rect.y + height) return null;
        if (point.x < rect.x || point.x > rect.x + rect.width) return null;
        const index = Math.floor((point.x - rect.x) / (rect.width / items.length));
        return Math.min(Math.max(index, 0), items.length - 1);
    }

    /**
     * The nearest ancestor (including itself) that has a controller, or the
     * raw id when none does. A listbox's items are plain child nodes of any
     * type (spec 016/019), most with no controller of their own, so a press
     * on one must still reach the listbox that contains it - the same
     * "bubble to whatever can handle it" a native list gives its rows for
     * free. Every other type keeps its exact prior routing: this returns the
     * hit id unchanged whenever it already has a controller or nothing in
     * its ancestry does.
     */
    function controllableTarget(hitId) {
        if (!hitId || controllers.has(hitId)) return hitId;
        const chain = ancestryChain(root, hitId) || [];
        for (let i = chain.length - 2; i >= 0; i--) {
            if (controllers.has(chain[i])) return chain[i];
        }
        return hitId;
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
        } else if (behavior === "list") {
            const scroll = scrollInfoOf(node);
            if (scroll) Object.assign(extra, scroll);
            if (input.point) extra.itemIndex = itemIndexAt(node, input.point);
        } else if (behavior === "text") {
            extra.value = String(mockState.get(node.field) ?? "");
            if (extra.local) extra.charIndex = charIndexAt(node, extra.local.x);
        } else if (behavior === "flyout") {
            if (input.point) extra.itemIndex = itemIndexAt(node, input.point);
            const item = extra.itemIndex !== null && extra.itemIndex !== undefined ? (node.children || [])[extra.itemIndex] : null;
            extra.itemDisabled = Boolean(item && typeof item.disabledWhen === "function" && item.disabledWhen(mockState));
        } else if (behavior === "tabs") {
            // A tab strip never scrolls (spec 021): no per-child rects exist
            // for anything but the active item, so `scrollInfoOf`'s own
            // extent/offset lookup does not apply here.
            extra.scrollable = false;
            extra.extent = null;
            extra.offset = 0;
            if (input.point) extra.itemIndex = tabIndexAt(node, input.point);
        } else if (behavior === "digitEntry") {
            extra.bounds = boundsOf(node);
            extra.value = clampNumberDisplay(Number(mockState.get(valueFieldOf(node))), extra.bounds);
            extra.padLength = node.padLength || 4;
            if (extra.local) extra.charIndex = charIndexAt(node, extra.local.x);
        } else if (behavior === "grid") {
            // No mockState read at all (spec 030): patternGrid's controller
            // reads/writes domain/song directly, not a bound field. Only
            // geometry and the live pointer modifiers are resolved here.
            extra.metaKey = pointerModifiers.meta;
            extra.ctrlKey = pointerModifiers.ctrl;
        } else if (behavior === "rowList") {
            // fileBrowser (spec 035): the controller computes its own
            // itemIndex/scrollTo from these (renderers/canvas/
            // fileBrowserGeometry.js) - there is no per-child rect to test
            // against and no layout-derived extent to reuse (design.md).
            extra.rows = mockState.get(rowsFieldOf(node)) || [];
            extra.offset = Number(mockState.get(scrollFieldOf(node))) || 0;
        } else if (behavior === "waveform") {
            // waveformView (spec 041): like "grid", no mockState read at all
            // - the controller reads/writes domain/song and
            // domain/sampleEditor directly. Only the ctrl modifier (pan vs.
            // zoom on wheel) is resolved here.
            extra.ctrlKey = pointerModifiers.ctrl;
        } else if (behavior === "loopCreator") {
            // loopCreatorView (spec 044): like "waveform", no mockState read
            // at all - the controller reads/writes
            // domain/sampleEditor/loopCreator.js directly. Only the ctrl
            // modifier (pan vs. zoom on wheel) is resolved here.
            extra.ctrlKey = pointerModifiers.ctrl;
        } else if (behavior === "multitrack") {
            // multitrackView (spec 052): like "waveform"/"loopCreator", no
            // mockState read at all - the controller reads/writes
            // domain/song and domain/arrangement directly. Only the ctrl
            // modifier (pan vs. zoom on wheel) is resolved here.
            extra.ctrlKey = pointerModifiers.ctrl;
        }
        return extra;
    }

    /**
     * The character index nearest a local x, for click-to-place-caret and
     * drag-to-select (spec 015). Font-dependent, so it lives here rather than
     * in runtime/textController.js, which never resolves pixels to characters.
     */
    function charIndexAt(node, localX) {
        const style = styleOf(node);
        const font = labelFontOf(style);
        const text = textOf(node);
        let x = (style && style.label && style.label.offsetX) || 0;
        for (let i = 0; i < text.length; i++) {
            const width = font.getTextWidth(text[i]);
            if (localX < x + width / 2) return i;
            x += width;
        }
        return text.length;
    }

    function labelFontOf(style) {
        return style && style.label && style.label.font ? assets.fontFor(style.label.font) : assets.font;
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
        markNeedsRelayout();
    }

    /**
     * Writes a viewport's, a listbox's or a fileBrowser's requested offset.
     * A viewport's/listbox's is clamped by the next layout pass (spec 013);
     * a fileBrowser's arrives already clamped by its own controller (spec
     * 035 - there is no layout-derived extent for a childless leaf to clamp
     * against), so its trace reads the field back directly rather than a
     * `layoutResult` entry that would never exist for it. Both behaviors'
     * offset lives at the same derived field (spec 019's `scrollFieldOf`),
     * never `node.field`, which either uses for its selection.
     */
    function applyScroll(node, requested) {
        const behavior = behaviorNames.get(node.id);
        const field = (behavior === "list" || behavior === "rowList") ? scrollFieldOf(node) : node.field;
        if (!field) return;
        const from = Number(mockState.get(field)) || 0;
        if (!setField(field, Math.max(0, Math.round(requested)))) return;
        markNeedsRelayout();
        const to = behavior === "rowList" ? (Number(mockState.get(field)) || 0) : (layoutResult.offsets.get(node.id) || 0);
        trace("scroll", { instance: node.id, field, from, to });
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
        // A slider's value is a number and an inputbox's is a string; both are
        // "the field this control owns changed", written the same way (spec 015).
        if (result.changed && (typeof result.value === "number" || typeof result.value === "string")) applyValue(node, result.value);
        else if (result.changed && typeof result.scrollTo === "number") applyScroll(node, result.scrollTo);
        else if (result.activated) {
            if (node.dialogResult) {
                // A modal dialog's synthesized OK/Cancel button (spec 020):
                // close its parent overlay reporting which one was pressed,
                // rather than dispatching a command this synthetic node was
                // never given.
                dismissOverlay(parentOf(root, id), node.dialogResult);
            } else if (behaviorNames.get(id) === "disclose") {
                // A dropdown's own click, or a menuTrigger's (spec 023),
                // opens/closes its synthesized popup instead of dispatching a
                // command - neither has anything of its own to dispatch to;
                // selecting an item (dropdown) or executing one (a menu's
                // submenu) is what dispatches. `popupEdge` is a menuTrigger's
                // own instance property, set once at synthesis time
                // (design.md); a dropdown never sets it and keeps "below".
                const popup = (node.children || [])[0];
                if (popup) {
                    // Spec 023: opening one child's own popup closes any
                    // sibling's that was already open, but only within a
                    // container that opted in (`exclusiveOverlayChildren`) -
                    // a lone dropdown's parent never does, so this is a
                    // no-op for every dropdown that predates this rule.
                    const parentId = parentOf(root, id);
                    const parentNode = parentId ? nodeById.get(parentId) : null;
                    if (parentNode && componentType(parentNode.type).exclusiveOverlayChildren) {
                        for (const sibling of parentNode.children || []) {
                            if (sibling.id === id) continue;
                            const siblingPopup = (sibling.children || [])[0];
                            if (siblingPopup) closeOverlay(siblingPopup.id);
                        }
                    }
                    toggleOverlay(popup.id, { anchorTo: id, edge: node.popupEdge || "below" });
                }
            } else if (behaviorNames.get(id) === "collapsible") {
                // A collapsePanel's own click toggles its bound field (spec
                // 021), through the same applyValue() every value-like
                // control already writes its field with, rather than
                // dispatching a command.
                applyValue(node, !Boolean(mockState.get(valueFieldOf(node))));
            } else {
                // A behavior may name which child it activated (spec 020's
                // submenu, by item index); every earlier behavior activates
                // the node itself, unchanged.
                const item = result.itemIndex !== null && result.itemIndex !== undefined ? (node.children || [])[result.itemIndex] : null;
                if (item && item.selectionCommand) {
                    // patternGrid's synthesized selection menu (spec 030): a
                    // plain data property, exactly as `dialogResult` already
                    // is on a modal dialog's synthesized OK/Cancel - nothing
                    // authored this item, so it answers to the mechanism
                    // that built it rather than to dispatch()'s command
                    // table. The grid itself is this submenu's own parent.
                    const gridId = parentOf(root, id);
                    const gridController = gridId ? controllers.get(gridId) : null;
                    if (gridController && typeof gridController.runSelectionCommand === "function") {
                        gridController.runSelectionCommand(item.selectionCommand);
                    }
                } else {
                    dispatch(item ? item.id : id, "click");
                }
            }
        }
        else if (behaviorNames.get(id) === "grid") {
            // patternGrid's own controller (spec 030) mutates domain/song
            // directly rather than reporting a value/scroll/activation, so
            // none of the branches above ever fire for it; a handled input
            // still has to repaint, and a completed selection drag opens the
            // synthesized selection menu right where dropdown's own click
            // opens its popup.
            if (result.openSelectionMenu) {
                const popup = (node.children || [])[0];
                if (popup) toggleOverlay(popup.id, { anchorTo: id, edge: "below" });
            }
            if (result.handled) markNeedsDraw();
        }
        else if (result.transitions.length) markNeedsDraw();
        // Spec 020: resolving an input inside a modal overlay - a selection
        // (dropdownPopup) or an activation (submenu) - closes it, gated on
        // the registry's own `.modal` fact so nothing here is aware either
        // type exists by name.
        if ((result.changed || result.activated) && componentType(node.type).modal) closeOverlay(id);
        // Spec 015: a text control's own outcomes, independent of the chain
        // above (Enter/Escape never also change the text in the same input).
        if (typeof result.clipboardWrite === "string") lastClipboard = result.clipboardWrite;
        if (result.submitted) dispatch(id, "submit");
        if (result.reverted) applyValue(node, result.revertTo);
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
        markNeedsDraw();
    }

    /**
     * Command enablement (spec 015 INT-016): `disabledWhen` is evaluated after
     * every state change, exactly where highlightedWhen already is, and drives
     * the same `disabled` flag every controller already blocks activation on.
     */
    function syncDisabled() {
        for (const node of allNodes) {
            if (typeof node.disabledWhen !== "function") continue;
            const controller = controllers.get(node.id);
            if (!controller) continue;
            let value = false;
            try { value = Boolean(node.disabledWhen(mockState)); }
            catch (error) { console.error(`[v2] disabledWhen failed for ${node.id}`, error); }
            if (controller.state.disabled !== value) setDisabled(node.id, value);
        }
    }

    /**
     * The ids Tab may land on: every interactive node, or, while a modal
     * overlay is present, only its descendants (spec 015 INT-012) - the
     * keyboard equivalent of spec 013's pointer gate in hitTest() above.
     */
    function focusableIds() {
        const modal = modalOverlay();
        if (!modal) return interactiveIds;
        const within = new Set(flatten(modal).map(node => node.id));
        return interactiveIds.filter(id => within.has(id));
    }

    function moveFocus(direction) {
        const ids = focusableIds();
        if (ids.length === 0) return;
        const index = focusedId ? ids.indexOf(focusedId) : -1;
        const next = ids[(index + direction + ids.length) % ids.length];
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

    // --- hover-delay tooltips (spec 015 INT-017) -------------------------
    // The same weight as dropActive: plain renderer-local state, no pure
    // module, because there is nothing here worth unit-testing without a
    // browser (see design.md "what this deliberately does not do").

    function hideTooltip() {
        if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
        tooltipTarget = null;
        if (!tooltipFor) return;
        const node = nodeById.get(tooltipFor);
        trace("tooltip", { instance: tooltipFor, text: (node && node.tooltip) || "", shown: false });
        tooltipFor = null;
        markNeedsDraw();
    }

    /** Moving within the same node's rect must not keep restarting the delay. */
    function updateTooltipHover(hitId, point) {
        tooltipPoint = point;
        if (hitId === tooltipFor || hitId === tooltipTarget) return;
        hideTooltip();
        const node = hitId ? nodeById.get(hitId) : null;
        const text = node && node.tooltip;
        if (!text) return;
        tooltipTarget = hitId;
        tooltipTimer = setTimeout(() => {
            tooltipTimer = null;
            tooltipTarget = null;
            tooltipFor = hitId;
            trace("tooltip", { instance: hitId, text, shown: true });
            markNeedsDraw();
        }, TOOLTIP_DELAY_MS);
    }

    // --- animation clock (spec 017) --------------------------------------

    function animationTick(time) {
        if (animationLastTime === null) animationLastTime = time;
        const delta = time - animationLastTime;
        animationLastTime = time;
        const before = animatedNodes.map(node => ({ frame: spriteClock.get(node.id).frame }));
        const after = advanceSprites(
            animatedNodes.map(node => ({ id: node.id, frames: node.frames, frameDelay: node.frameDelay, ...spriteClock.get(node.id) })),
            delta
        );
        after.forEach(result => spriteClock.set(result.id, { frame: result.frame, elapsed: result.elapsed }));
        if (anyFrameChanged(before.map((b, i) => ({ id: animatedNodes[i].id, frame: b.frame })), after)) {
            animatedNodes.forEach(node => setField(node.field, spriteClock.get(node.id).frame));
            markNeedsDraw();
        }
        animationFrameHandle = requestAnimationFrame(animationTick);
    }

    function startAnimationClock() {
        if (animatedNodes.length === 0 || animationFrameHandle !== null) return;
        animationFrameHandle = requestAnimationFrame(animationTick);
    }

    function stopAnimationClock() {
        if (animationFrameHandle !== null) cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
        animationLastTime = null;
    }

    // --- tick clock (spec 047) --------------------------------------------

    function tickAnimationFrame(time) {
        if (tickLastTime === null) tickLastTime = time;
        const delta = time - tickLastTime;
        tickLastTime = time;
        tickingNodes.forEach(node => {
            const controller = controllers.get(node.id);
            if (controller && typeof controller.onFrame === "function") controller.onFrame(delta);
        });
        markNeedsDraw();
        tickAnimationFrameHandle = requestAnimationFrame(tickAnimationFrame);
    }

    function startTickClock() {
        if (tickingNodes.length === 0 || tickAnimationFrameHandle !== null) return;
        tickAnimationFrameHandle = requestAnimationFrame(tickAnimationFrame);
    }

    function stopTickClock() {
        if (tickAnimationFrameHandle !== null) cancelAnimationFrame(tickAnimationFrameHandle);
        tickAnimationFrameHandle = null;
        tickLastTime = null;
    }

    function handlePointerMove(event) {
        pointerModifiers.meta = Boolean(event.metaKey);
        pointerModifiers.ctrl = Boolean(event.ctrlKey);
        const point = pointFromEvent(event);
        const hitId = hitTest(point);
        if (mode === "inspect") {
            if (hitId === hoveredId) return;
            hoveredId = hitId;
            markNeedsDraw();
            postToParent("v2:hover", { nodeId: hitId, ancestry: hitId ? ancestryChain(root, hitId) : null, rect: hitId ? layoutResult.rects.get(hitId) || null : null });
            return;
        }
        updateTooltipHover(hitId, point);
        const routedId = controllableTarget(hitId);
        deliver(pointer.move({ hitId: routedId, point, time: event.timeStamp }));
        // Spec 020: a submenu previews whichever row is under the pointer,
        // updated on every move within it - the router above only reports
        // pointerenter/pointerleave at the *controllable node's* granularity,
        // which never changes while moving between two rows of the same
        // submenu, so this feeds it the point directly instead. Spec 056:
        // envelopeView needs the identical thing (which point is nearest
        // the pointer, continuously, not just on entering/leaving the whole
        // node) - widened rather than given a second, parallel mechanism.
        const routedBehavior = behaviorNames.get(routedId);
        if (routedBehavior === "flyout" || routedBehavior === "envelope") {
            feed(routedId, { type: "pointermove", point }, { quietIfIgnored: true });
        }
        applyCursor(routedId);
    }

    function handlePointerLeave() {
        if (mode === "inspect") {
            if (!hoveredId) return;
            hoveredId = null;
            markNeedsDraw();
            postToParent("v2:hover", { nodeId: null, ancestry: null });
            return;
        }
        hideTooltip();
        deliver(pointer.cancel());
        applyCursor(null);
    }

    function handlePointerDown(event) {
        if (mode !== "interact") return;
        pointerModifiers.meta = Boolean(event.metaKey);
        pointerModifiers.ctrl = Boolean(event.ctrlKey);
        hideTooltip();
        const point = pointFromEvent(event);
        const hitId = hitTest(point);
        // Spec 020: a click that lands nowhere inside the open modal - on
        // whatever is behind it, or on nothing at all - dismisses it, but
        // only for a modal that opts in (`.dismissOnOutsideClick`); a real
        // modalDialog does not declare it, matching v1, where only OK/Cancel/
        // Escape close a message dialog.
        const openModal = modalOverlay();
        if (!hitId && openModal && componentType(openModal.type).dismissOnOutsideClick) {
            dismissOverlay(openModal.id, "cancel");
            return;
        }
        const routedId = controllableTarget(hitId);
        canvas.focus({ preventScroll: true });
        const target = controllers.has(routedId) ? routedId : null;
        const previousFocus = focusedId;
        if (focusedId && focusedId !== target) {
            feed(focusedId, { type: "blur" });
            focusedId = null;
        }
        if (target) {
            focusedId = target;
            // A controller's "pointerdown" case already sets its own focused
            // flag, which is all a button needs; a text control also needs
            // the explicit "focus" event, because that is the only moment it
            // captures the value Escape should revert to (spec 015 INT-014).
            if (target !== previousFocus) feed(target, { type: "focus" });
        }
        // The element-level capture is what makes a drag survive leaving the
        // canvas; the router's capture is what makes it stay on one node.
        if (typeof canvas.setPointerCapture === "function" && event.pointerId !== undefined) {
            try { canvas.setPointerCapture(event.pointerId); } catch { /* a synthetic event has no pointer to capture */ }
        }
        deliver(pointer.down({ id: routedId, point, button: event.button, time: event.timeStamp, rect: rectOf(routedId) }));
        applyCursor(routedId);
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
        if (!dropActive) { dropActive = true; markNeedsDraw(); }
    }

    function handleDragLeave() {
        if (!dropActive) return;
        dropActive = false;
        markNeedsDraw();
    }

    function handleDrop(event) {
        if (!draggingFiles(event)) return;
        event.preventDefault();
        dropActive = false;
        markNeedsDraw();
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
            .then(() => { renderMockReadout(); markNeedsRelayout(); },
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

    function keyInput(type, event) {
        // clipboardText rides along on every key so a focused text control's
        // Ctrl/Cmd+V can paste from the in-app clipboard without a real
        // "paste" ClipboardEvent, which does not fire on a plain canvas
        // (verified empirically; see design.md).
        // Spec 031: `code` (the physical key, not the shifted/localized
        // character) and `repeat` (OS key-repeat) are read only by
        // patternGrid's own "grid" behavior, for its keyboard note-entry
        // table and repeat guard - every other controller ignores both.
        return { type, key: event.key, code: event.code, repeat: event.repeat, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, clipboardText: lastClipboard };
    }

    /**
     * Escape always blurs whatever was focused - a plain button has no
     * "Escape" case, so this is the only thing that happens for it - and
     * always fires an open modal's `escape`, regardless of what had focus, so
     * backing out of a dialog never requires un-focusing a button first
     * (spec 015 INT-014).
     */
    function handleEscape() {
        const modal = modalOverlay();
        if (focusedId) {
            feed(focusedId, { type: "keydown", key: "Escape" }); // lets a text control revert itself
            feed(focusedId, { type: "blur" });
            focusedId = null;
        }
        // Spec 020: Escape now actually closes whatever it cascades to,
        // dispatching "escape" first so an authored on.escape hook still runs
        // before the default dismissal.
        if (modal) { dispatch(modal.id, "escape"); dismissOverlay(modal.id, "cancel"); }
    }

    /** A declared `shortKey` fires its command from anywhere (spec 015 INT-015). */
    function activateShortcut(id) {
        const controller = controllers.get(id);
        if (controller && controller.state.disabled) {
            trace("activation", { instance: id, result: "blocked-disabled", detail: "shortcut ignored; control is disabled" });
            return;
        }
        trace("input", { instance: id, input: "shortcut" });
        dispatch(id, "click");
    }

    function handleKeyDown(event) {
        if (mode !== "interact") return;
        if (event.key === "Tab") {
            event.preventDefault();
            moveFocus(event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            handleEscape();
            return;
        }
        const modal = modalOverlay();
        // The focused control sees every key first and may swallow it (spec
        // 015 INT-011); a shortcut is only consulted once it does not.
        if (focusedId) {
            const result = feed(focusedId, keyInput("keydown", event));
            if (result && result.handled) {
                event.preventDefault();
                // Spec 020: submitting a focused control inside a modal (an
                // embedded inputbox's own Enter) closes it, reporting "ok" -
                // matching v1's own modalDialog, where the input's onSubmit
                // closes the dialog the same way its own Enter does. "enter"
                // still dispatches first, so an authored on.enter hook runs
                // before the default dismissal (as "escape" already does above).
                if (result.submitted && modal) { dispatch(modal.id, "enter"); dismissOverlay(modal.id, "ok"); }
                return;
            }
        }
        const shortcutTarget = matchShortcutTable(shortcutTable, event);
        if (shortcutTarget) {
            event.preventDefault();
            activateShortcut(shortcutTarget);
            return;
        }
        // Nothing consumed Enter: an open modal's default action, since
        // nothing else claimed it (a focused button's own Enter already
        // returned above, so this cannot double-fire one).
        if (event.key === "Enter" && modal && !focusedId) {
            event.preventDefault();
            dispatch(modal.id, "enter");
            dismissOverlay(modal.id, "ok");
            return;
        }
        // Space would otherwise scroll the page while the canvas holds focus,
        // exactly as it always has, focused control or not.
        if (event.key === " ") event.preventDefault();
    }

    function handleKeyUp(event) {
        if (mode !== "interact") return;
        if (!focusedId) return;
        const result = feed(focusedId, keyInput("keyup", event));
        if (result && result.handled) event.preventDefault();
    }

    function handleCanvasBlur() {
        if (mode !== "interact") return;
        deliver(pointer.cancel());
        if (focusedId) feed(focusedId, { type: "blur" });
        focusedId = null;
        hideTooltip();
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
    startAnimationClock();
    startTickClock();

    // Any state change from anywhere (an action finishing later, a capability
    // module) must be reflected in the highlights.
    // A state change can move things, not only recolour them: a viewport's
    // offset and a field-bound label's width both come from state, so this
    // re-lays out rather than only redrawing. (Spec 013 only redrew, which
    // meant a scroll offset written from outside did not move the content.)
    const unsubscribeState = typeof options.state?.onAnyChange === "function"
        // Spec 032: "high-dpi.active" changes the canvas's own backing size
        // (a recomputeLayout() concern), not merely what gets drawn inside
        // it - every other field only needs a relayout.
        ? options.state.onAnyChange(path => {
            renderMockReadout();
            if (path === "high-dpi.active") recomputeLayout();
            else markNeedsRelayout();
        })
        : null;

    postToParent("v2:ready", { sourceFiles: outline.sourceFiles, interactive: interactiveIds });

    return {
        setMode,
        selectNode,
        setDisabled,
        /** Shows an overlay (a modalDialog, or a hand-built tree's own flyout); spec 020. */
        openOverlay,
        closeOverlay,
        toggleOverlay,
        get mockState() { return new Map(mockState.entries()); },
        /** The applied scroll offset per viewport, for tests and tooling. */
        layoutOffsets() { return layoutResult ? new Map(layoutResult.offsets) : new Map(); },
        /** Where each node ended up, so a caller can aim at one without guessing. */
        layoutRects() { return layoutResult ? new Map(layoutResult.rects) : new Map(); },
        dispose() {
            if (unsubscribeState) unsubscribeState();
            resizeObserver.disconnect();
            stopAnimationClock();
            stopTickClock();
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
            hideTooltip();
            window.removeEventListener("message", handleMessage);
            container.removeChild(shell);
        }
    };
}
