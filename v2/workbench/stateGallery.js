import { loadCanvasAssets } from "../renderers/canvas/assets.js";
import { drawButton, BUTTON_VISUAL_STATES } from "../renderers/canvas/buttonSkin.js";
import { createButtonController } from "../runtime/buttonController.js";
import { seedMockState } from "../renderers/canvas/mountGeneric.js";
import { interactiveTypeNames, selectionModeOf } from "../runtime/componentTypes.js";

// Workbench-only State gallery (spec 005 IWB-008 / spec 002 COMP-002).
// For a chosen supported button (or radio item) from the compiled outline it
// draws every supported visual state as a *forced* fixture - default, hover,
// pressed, focused, disabled, plus on/off for controls that carry a
// visual-state binding - using the exact same drawButton() as the live
// renderer, so the illustration cannot drift from reality. Fixtures are
// static pixels: they own no controller and can dispatch nothing.
//
// Below them, a *live example* runs the real behavior controller against its
// own private mock state and traces into the workbench's Interaction log
// under renderer "gallery" - never into the application preview, so
// exercising it can never invoke an application command. A disabled toggle
// lets an author verify that a disabled activation attempt produces no
// command, since nothing in the current app.yaml is disabled.

const FIXTURE_WIDTH = 96;
const FIXTURE_HEIGHT = 24;
// Spec 009: which types are interactive is the registry's answer, not a
// second copy of the renderer's list.
const INTERACTIVE_TYPES = new Set(interactiveTypeNames());

function flatten(node, out = []) {
    out.push(node);
    (node.children || []).forEach(child => flatten(child, out));
    return out;
}

function labelText(node) {
    return node.labelVariants && node.labelVariants.length > 0 ? node.labelVariants[0] : node.definitionName || node.type;
}

function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas, ctx };
}

/**
 * @param {HTMLElement} container
 * @param {{ onTrace: (entry: object) => void, onOpenSource?: (location: {file: string, range: object}) => void, onSelectInPreview?: (nodeId: string) => void }} options
 */
export function createStateGallery(container, options) {
    let assets = null;
    let outline = null;
    let nodes = [];
    let selectedId = null;
    let live = null; // { dispose }

    container.innerHTML = "";
    container.classList.add("v2-state-gallery");

    const header = document.createElement("div");
    header.className = "toolbar";
    const picker = document.createElement("select");
    picker.title = "Supported interactive components in the current outline";
    picker.addEventListener("change", () => { selectedId = picker.value; renderSelected(); });
    const openSourceButton = document.createElement("button");
    openSourceButton.type = "button";
    openSourceButton.textContent = "Open source";
    openSourceButton.addEventListener("click", () => {
        const node = currentNode();
        if (node) options.onOpenSource?.(node.source);
    });
    const selectPreviewButton = document.createElement("button");
    selectPreviewButton.type = "button";
    selectPreviewButton.textContent = "Select in preview";
    selectPreviewButton.addEventListener("click", () => {
        const node = currentNode();
        if (node) options.onSelectInPreview?.(node.id);
    });
    header.append(picker, openSourceButton, selectPreviewButton);

    const fixturesEl = document.createElement("div");
    fixturesEl.className = "fixtures";
    const liveEl = document.createElement("div");
    liveEl.className = "live";
    const infoEl = document.createElement("div");
    infoEl.className = "info";
    container.append(header, fixturesEl, liveEl, infoEl);

    // Spec 008: a fixture must be drawn with the same style the application
    // uses for that node, or the illustration is of a different button.
    function styleOfNode(node) {
        return assets.styleFor(node.style ? node.style.type : node.type, node.style ? node.style.variant : null);
    }

    function currentNode() {
        return nodes.find(n => n.id === selectedId) || null;
    }

    function fixtureList(node) {
        const list = BUTTON_VISUAL_STATES.map(name => ({
            caption: name,
            state: name === "default" ? {} : { [name === "focused" ? "focused" : name]: true }
        }));
        const visual = (node.bindings || []).find(b => b.kind === "visual-state" && b.state === "highlighted");
        if (visual) {
            list.push({ caption: `on (${visual.mockField} = ${String(visual.activeValue)})`, state: { highlighted: true } });
            list.push({ caption: `off (${visual.mockField} ≠ ${String(visual.activeValue)})`, state: { highlighted: false } });
        } else if (selectionModeOf(node.type) === "exclusiveWithinParent") {
            list.push({ caption: "selected (exclusive-within-parent mock state)", state: { highlighted: true } });
        }
        return list;
    }

    function renderFixtures(node) {
        fixturesEl.innerHTML = "";
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = `Illustrative: forced states of ${node.style ? `style ${node.style.type}/${node.style.variant}` : "the default style"}, drawn with the live renderer's drawButton(); no controller, no commands.`;
        fixturesEl.appendChild(note);
        const row = document.createElement("div");
        row.className = "row";
        for (const fixture of fixtureList(node)) {
            const cell = document.createElement("figure");
            const { canvas, ctx } = makeCanvas(FIXTURE_WIDTH, FIXTURE_HEIGHT);
            ctx.fillStyle = "#1c1c1c";
            ctx.fillRect(0, 0, FIXTURE_WIDTH, FIXTURE_HEIGHT);
            drawButton(ctx, assets, { x: 2, y: 2, width: FIXTURE_WIDTH - 4, height: FIXTURE_HEIGHT - 4 }, labelText(node), fixture.state, styleOfNode(node));
            canvas.dataset.fixture = fixture.caption;
            const caption = document.createElement("figcaption");
            caption.textContent = fixture.caption;
            cell.append(canvas, caption);
            row.appendChild(cell);
        }
        fixturesEl.appendChild(row);
    }

    function renderLive(node) {
        if (live) live.dispose();
        liveEl.innerHTML = "";
        const title = document.createElement("div");
        title.className = "note";
        title.textContent = "Live example: real controller + private mock state; traces to the Interaction log as renderer \"gallery\". Never touches the preview or application commands.";
        liveEl.appendChild(title);

        const rowEl = document.createElement("div");
        rowEl.className = "row";
        const { canvas, ctx } = makeCanvas(FIXTURE_WIDTH, FIXTURE_HEIGHT);
        canvas.tabIndex = 0;
        canvas.className = "live-canvas";
        canvas.title = "pointer: press/release; keyboard: focus then Enter or Space";
        const readout = document.createElement("div");
        readout.className = "readout";
        const disabledLabel = document.createElement("label");
        const disabledBox = document.createElement("input");
        disabledBox.type = "checkbox";
        disabledBox.dataset.role = "gallery-disabled";
        disabledLabel.append(disabledBox, document.createTextNode(" disabled"));
        rowEl.append(canvas, disabledLabel, readout);
        liveEl.appendChild(rowEl);

        const controller = createButtonController();
        const instance = `gallery:${node.id}`;
        const mock = seedMockState(new Map(), node.bindings || []);
        const visual = (node.bindings || []).find(b => b.kind === "visual-state" && b.state === "highlighted");
        const commands = (node.bindings || []).filter(b => b.origin === "action" && b.kind === "command");
        let seq = 0;
        const origin = performance.now();
        const trace = (kind, payload) => options.onTrace({ kind, seq: ++seq, t: Math.round((performance.now() - origin) * 10) / 10, renderer: "gallery", instance, ...payload });

        const highlighted = () => Boolean(visual && mock.get(visual.mockField) === visual.activeValue);
        function draw() {
            ctx.fillStyle = "#1c1c1c";
            ctx.fillRect(0, 0, FIXTURE_WIDTH, FIXTURE_HEIGHT);
            drawButton(ctx, assets, { x: 2, y: 2, width: FIXTURE_WIDTH - 4, height: FIXTURE_HEIGHT - 4 }, labelText(node), { ...controller.state, highlighted: highlighted() }, styleOfNode(node));
            const s = controller.state;
            const flags = ["hover", "pressed", "focused", "disabled"].filter(f => s[f]);
            const mockText = [...mock].map(([k, v]) => `${k}=${String(v)}`).join(" ");
            readout.textContent = `state: ${flags.join(" ") || "default"}${highlighted() ? " highlighted" : ""}${mockText ? `   mock: ${mockText}` : ""}`;
        }
        function activate() {
            const was = highlighted();
            if (commands.length === 0) {
                trace("activation", { result: "inert", detail: "no supported command binding" });
            } else {
                trace("activation", { result: "dispatched", detail: `${commands.map(b => b.command).join(", ")} (gallery mock only)` });
                for (const binding of commands) {
                    let from = null, to = null;
                    if (binding.mockField && Array.isArray(binding.mockValues) && binding.mockValues.length) {
                        from = mock.get(binding.mockField);
                        to = binding.mockValues[(binding.mockValues.indexOf(from) + 1) % binding.mockValues.length];
                        mock.set(binding.mockField, to);
                    }
                    trace("command", { command: binding.command, mockField: binding.mockField || null, from, to });
                }
            }
            if (highlighted() !== was) trace("state", { field: "highlighted", from: was, to: highlighted() });
        }
        function feed(input) {
            trace("input", { input: input.type, key: input.key || null });
            const result = controller.handle(input);
            result.transitions.forEach(t => trace("state", { field: t.field, from: t.from, to: t.to }));
            if (result.blocked) trace("activation", { result: `blocked-${result.blocked}`, detail: result.blocked === "disabled" ? "control is disabled; no command" : "control is not focused" });
            if (result.activated) activate();
            draw();
        }
        const handlers = {
            pointerenter: () => feed({ type: "pointerenter" }),
            pointerleave: () => feed({ type: "pointerleave" }),
            pointerdown: () => { canvas.focus({ preventScroll: true }); feed({ type: "pointerdown" }); },
            pointerup: () => feed({ type: "pointerup" }),
            focus: () => feed({ type: "focus" }),
            blur: () => feed({ type: "blur" }),
            keydown: event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); feed({ type: "keydown", key: event.key }); } },
            keyup: event => { if (event.key === " ") { event.preventDefault(); feed({ type: "keyup", key: event.key }); } }
        };
        Object.entries(handlers).forEach(([type, fn]) => canvas.addEventListener(type, fn));
        disabledBox.addEventListener("change", () => {
            controller.setDisabled(disabledBox.checked).forEach(t => trace("state", { field: t.field, from: t.from, to: t.to }));
            draw();
        });
        draw();
        live = {
            dispose() { Object.entries(handlers).forEach(([type, fn]) => canvas.removeEventListener(type, fn)); }
        };
    }

    function renderInfo(node) {
        infoEl.innerHTML = "";
        const bindings = document.createElement("div");
        bindings.appendChild(document.createTextNode("generated bindings: "));
        if (!node.bindings || node.bindings.length === 0) bindings.appendChild(document.createTextNode("none"));
        node.bindings?.forEach(binding => {
            const link = document.createElement("button");
            link.type = "button";
            link.className = "link";
            link.textContent = binding.kind === "command"
                ? `${binding.origin}/${binding.code} → ${binding.command}`
                : `${binding.origin}/${binding.code} → ${binding.state || binding.kind}${binding.mockField ? ` when ${binding.mockField} = ${String(binding.activeValue)}` : ""}`;
            link.title = "open the source that produced this binding";
            link.addEventListener("click", () => options.onOpenSource?.(binding.source));
            bindings.appendChild(link);
        });
        infoEl.appendChild(bindings);

        const related = (outline?.diagnostics || []).filter(d => d.nodeId === node.id);
        const diag = document.createElement("div");
        diag.appendChild(document.createTextNode(`diagnostics for this node: ${related.length === 0 ? "none" : ""}`));
        related.forEach(d => {
            const link = document.createElement("button");
            link.type = "button";
            link.className = "link warn";
            link.textContent = `[${d.severity}] ${d.code}: ${d.message}`;
            link.addEventListener("click", () => d.range && options.onOpenSource?.({ file: d.file, range: d.range }));
            diag.appendChild(link);
        });
        infoEl.appendChild(diag);
    }

    function renderSelected() {
        const node = currentNode();
        if (!node || !assets) {
            fixturesEl.textContent = nodes.length === 0 ? "No supported interactive components in the current outline." : "";
            liveEl.innerHTML = "";
            infoEl.innerHTML = "";
            return;
        }
        renderFixtures(node);
        renderLive(node);
        renderInfo(node);
    }

    function renderPicker() {
        picker.innerHTML = "";
        nodes.forEach(node => {
            const option = document.createElement("option");
            option.value = node.id;
            option.textContent = `${node.type} "${labelText(node)}"${node.style && node.style.variant !== "default" ? ` [${node.style.variant}]` : ""}  (${node.id})`;
            picker.appendChild(option);
        });
        if (!nodes.some(n => n.id === selectedId)) selectedId = nodes[0]?.id || null;
        picker.value = selectedId || "";
    }

    return {
        /** Re-reads the interactive nodes from a (re)generated outline, keeping the current pick when it still exists. */
        async setOutline(next) {
            outline = next;
            // The cache key reloads artwork when a regenerated skin changed it.
            assets = await loadCanvasAssets(next.skin ? { ...next.skin, cacheKey: next.sourceHash || String(Date.now()) } : undefined);
            nodes = flatten(outline.root).filter(n => n.supported !== false && INTERACTIVE_TYPES.has(n.type));
            renderPicker();
            renderSelected();
        },
        select(nodeId) {
            if (nodes.some(n => n.id === nodeId)) { selectedId = nodeId; picker.value = nodeId; renderSelected(); return true; }
            return false;
        },
        get selectedId() { return selectedId; },
        dispose() { if (live) live.dispose(); container.innerHTML = ""; }
    };
}
