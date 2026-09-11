import { loadCanvasAssets } from "../renderers/canvas/assets.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { COMPONENT_TYPES, UNIVERSAL_PROPERTIES, typeEntries, drawKindOf } from "../runtime/componentTypes.js";

// Workbench-only Components tab (spec 009, closing spec 002's "component
// contracts"): the catalogue of component types, read straight from
// runtime/componentTypes.js.
//
// For the selected type it shows its status, description, container shape,
// styling and interactivity, the properties it accepts with their kinds, a
// sample drawn by the type's own draw kind, and which application nodes use
// it. Read-only: the registry is code, so changing a contract is a code
// change, and property *editing* remains spec 002's pending work.

const SAMPLE_WIDTH = 96;
const SAMPLE_HEIGHT = 24;

function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
}

function flatten(node, out = []) {
    if (!node) return out;
    out.push(node);
    (node.children || []).forEach(child => flatten(child, out));
    return out;
}

function labelText(node) {
    return node.labelVariants && node.labelVariants.length ? node.labelVariants[0] : node.definitionName || node.type;
}

function link(text, title, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "link";
    el.textContent = text;
    if (title) el.title = title;
    el.addEventListener("click", onClick);
    return el;
}

function containerSentence(entry) {
    if (!entry.container) return "leaf: holds no children, so an unknown key is a property mistake";
    const parts = [`children authored in \`${entry.container.childrenIn}:\``];
    if (entry.container.childType) parts.push(`each item becomes a ${entry.container.childType}`);
    if (entry.container.namedSlots) parts.push("any other key is a named child slot");
    if (entry.container.itemActions) parts.push("item actions are resolved onto this node");
    return parts.join(", ");
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onSelectInPreview?: (nodeId: string) => void,
 *   onShowSkin?: (type: string) => void,
 *   onShowGallery?: (nodeId: string) => void
 * }} options
 */
export function createComponentCatalogue(container, options = {}) {
    let outline = null;
    let assets = null;
    let selectedType = null;

    container.innerHTML = "";
    container.classList.add("v2-component-catalogue");

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const picker = document.createElement("select");
    picker.title = "Registered component types";
    picker.addEventListener("change", () => select(picker.value));
    const status = document.createElement("span");
    status.className = "status";
    toolbar.append(picker, status);

    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    const propsEl = document.createElement("div");
    propsEl.className = "properties";
    const usageEl = document.createElement("div");
    usageEl.className = "usage";
    const body = document.createElement("div");
    body.className = "scroller";
    body.append(metaEl, propsEl, usageEl);
    container.append(toolbar, body);

    function nodesUsing(type) {
        return flatten(outline && outline.root).filter(node => node.type === type);
    }

    function renderMeta(type, entry) {
        metaEl.innerHTML = "";
        const heading = document.createElement("div");
        heading.className = "heading";
        heading.textContent = type;
        const badge = document.createElement("span");
        badge.className = entry.implemented ? "badge ok" : "badge planned";
        badge.textContent = entry.implemented ? "implemented" : "declared, not rendered yet";
        heading.append(document.createTextNode("  "), badge);
        metaEl.appendChild(heading);

        const description = document.createElement("div");
        description.className = "description";
        description.textContent = entry.description;
        metaEl.appendChild(description);

        const facts = document.createElement("div");
        facts.className = "facts";
        facts.textContent = [
            containerSentence(entry),
            entry.direction ? `lays its children out as a ${entry.direction}` : null,
            entry.styled ? "has skin artwork" : "no skin artwork",
            entry.interactive ? "interactive: gets a behavior controller" : "not interactive",
            `drawn as "${entry.draw}"`,
            entry.authoredIn ? `authored inside ${entry.authoredIn}` : null
        ].filter(Boolean).join("   ");
        metaEl.appendChild(facts);

        const row = document.createElement("div");
        row.className = "row";
        if (assets && entry.implemented) {
            const { canvas, ctx } = makeCanvas(SAMPLE_WIDTH, SAMPLE_HEIGHT);
            ctx.fillStyle = "#1c1c1c";
            ctx.fillRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
            const style = assets.styleFor(type);
            drawKind(drawKindOf(type)).draw(ctx, assets, style, { x: 2, y: 2, width: SAMPLE_WIDTH - 4, height: SAMPLE_HEIGHT - 4 }, type, {}, { type });
            canvas.title = `${type} drawn in its default style, normal state`;
            canvas.dataset.sample = type;
            row.appendChild(canvas);
        }
        if (entry.styled) row.appendChild(link("show in Skin", "Every variant and state of this type's artwork", () => options.onShowSkin?.(type)));
        if (entry.interactive) {
            const instance = nodesUsing(type).find(node => node.supported !== false);
            if (instance) row.appendChild(link("show in State gallery", "Exercise one of these against mock state", () => options.onShowGallery?.(instance.id)));
        }
        metaEl.appendChild(row);
    }

    function renderProperties(type, entry) {
        propsEl.innerHTML = "";
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = "Properties this type accepts. Anything else authored on it is reported as unknown-component-property.";
        propsEl.appendChild(note);

        const table = document.createElement("table");
        const head = document.createElement("tr");
        for (const column of ["property", "kind", "from", "description"]) {
            const th = document.createElement("th");
            th.textContent = column;
            head.appendChild(th);
        }
        table.appendChild(head);

        const rows = [
            ...Object.entries(entry.properties).map(([name, property]) => ({ name, property, from: type })),
            ...Object.entries(UNIVERSAL_PROPERTIES).map(([name, property]) => ({ name, property, from: "every component" }))
        ];
        for (const { name, property, from } of rows) {
            const tr = document.createElement("tr");
            tr.dataset.property = name;
            tr.className = from === type ? "own" : "universal";
            for (const text of [name, property.kind, from, property.description]) {
                const td = document.createElement("td");
                td.textContent = text;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        if (entry.container) {
            const tr = document.createElement("tr");
            tr.className = "own";
            for (const text of [entry.container.childrenIn, "sequence", type, `Children. ${containerSentence(entry)}.`]) {
                const td = document.createElement("td");
                td.textContent = text;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        propsEl.appendChild(table);
    }

    function renderUsage(type) {
        usageEl.innerHTML = "";
        const nodes = nodesUsing(type);
        usageEl.appendChild(document.createTextNode(`used by ${nodes.length} component${nodes.length === 1 ? "" : "s"} in the current application: `));
        if (nodes.length === 0) usageEl.appendChild(document.createTextNode("none"));
        for (const node of nodes) {
            usageEl.appendChild(link(`${labelText(node)} (${node.id})`, "Select this component in the preview", () => options.onSelectInPreview?.(node.id)));
        }
    }

    function renderSelected() {
        const entry = COMPONENT_TYPES[selectedType];
        if (!entry) {
            metaEl.textContent = "No component type selected.";
            propsEl.innerHTML = "";
            usageEl.innerHTML = "";
            return;
        }
        picker.value = selectedType;
        renderMeta(selectedType, entry);
        renderProperties(selectedType, entry);
        renderUsage(selectedType);
    }

    function renderPicker() {
        picker.innerHTML = "";
        for (const [type, entry] of typeEntries()) {
            const option = document.createElement("option");
            option.value = type;
            const count = nodesUsing(type).length;
            option.textContent = `${type}${entry.implemented ? "" : " (planned)"}${count ? `  x${count}` : ""}`;
            picker.appendChild(option);
        }
    }

    function select(type) {
        if (!COMPONENT_TYPES[type]) return false;
        selectedType = type;
        renderPicker();
        renderSelected();
        return true;
    }

    return {
        /** Re-reads instance counts from a (re)generated outline; the catalogue itself is static. */
        async setOutline(next) {
            outline = next;
            if (next && next.skin) {
                assets = await loadCanvasAssets({ ...next.skin, cacheKey: next.sourceHash || String(Date.now()) });
            }
            const entries = typeEntries();
            const implemented = entries.filter(([, entry]) => entry.implemented).length;
            status.textContent = `${entries.length} registered types, ${implemented} implemented`;
            if (!selectedType || !COMPONENT_TYPES[selectedType]) selectedType = entries[0] ? entries[0][0] : null;
            renderPicker();
            renderSelected();
        },
        /** Shows one type, used by the details panel and the Skin tab. */
        selectType(type) {
            return select(type);
        },
        get selectedType() {
            return selectedType;
        },
        dispose() {
            container.innerHTML = "";
        }
    };
}
