import { loadCanvasAssets } from "../renderers/canvas/assets.js";
import { describeResolution } from "../renderers/canvas/buttonSkin.js";
import { drawKind } from "../renderers/canvas/drawKinds.js";
import { drawKindOf, typeEntries } from "../runtime/componentTypes.js";
import { STYLE_STATES, resolveStateAsset } from "../runtime/skinModel.js";
import { setStateAsset, clearStateAsset } from "./skinEdit.js";

// Workbench-only Skin tab (spec 008): read and set how a component type
// looks, per visual state, and see every variety drawn by the live renderer.
//
// Four regions:
//   styles    every type/variant in the authored skin, with its description
//   states    one row per visual state: the source PNG, the drawn result, the
//             asset name with a link to the YAML line, and a picker
//   library   the variant x state matrix for the selected type
//   used by   the application nodes this variant draws
//
// Setting a state's artwork does not write YAML from a model (that would
// reformat the document); it splices the exact scalar through
// ./skinEdit.js and leaves the result as an unsaved buffer the author
// reviews and saves with Ctrl+S, exactly like a hand edit.

const CELL_WIDTH = 84;
const CELL_HEIGHT = 24;
const NONE_VALUE = "__none__";

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

function button(text, title, onClick, className = "link") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = text;
    if (title) el.title = title;
    el.addEventListener("click", onClick);
    return el;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   onOpenSource?: (location: {file: string, range: object}) => void,
 *   onSelectInPreview?: (nodeId: string) => void,
 *   applyEdit?: (edit: {file: string, transform: (text: string) => {text: string, line?: number}, note: string}) => void,
 *   listAssets?: () => Promise<string[]>,
 *   assetBase?: string,
 *   canEdit?: () => boolean
 * }} options
 */
export function createSkinEditor(container, options = {}) {
    const assetBase = options.assetBase || "./assets/skin/";
    let outline = null;
    let skin = null;
    let assets = null;         // loaded canvas assets for the current skin
    let available = [];        // source PNG names offered by the picker
    let selected = null;       // { type, variant }

    container.innerHTML = "";
    container.classList.add("v2-skin-editor");

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const typePicker = document.createElement("select");
    typePicker.title = "Component type";
    const variantPicker = document.createElement("select");
    variantPicker.title = "Style variant of that component type";
    typePicker.addEventListener("change", () => {
        const variants = variantNames(typePicker.value);
        select(typePicker.value, variants[0]);
    });
    variantPicker.addEventListener("change", () => select(typePicker.value, variantPicker.value));
    const openSourceButton = button("Open source", "Open the YAML that defines this style", () => {
        const style = currentStyle();
        if (style && style.source) options.onOpenSource?.(style.source);
    }, "");
    const status = document.createElement("span");
    status.className = "status";
    toolbar.append(typePicker, variantPicker, openSourceButton, status);

    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    const statesEl = document.createElement("div");
    statesEl.className = "states";
    const libraryEl = document.createElement("div");
    libraryEl.className = "library";
    const usageEl = document.createElement("div");
    usageEl.className = "usage";
    const body = document.createElement("div");
    body.className = "scroller";
    body.append(metaEl, statesEl, libraryEl, usageEl);
    container.append(toolbar, body);

    function typeNames() {
        return Object.keys((skin && skin.styles) || {}).sort();
    }
    function variantNames(type) {
        const variants = Object.keys(((skin && skin.styles) || {})[type] || {});
        // "default" first, then alphabetical: variants are read as deltas of it.
        return variants.sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)));
    }
    function currentStyle() {
        if (!selected || !skin) return null;
        return (skin.styles[selected.type] || {})[selected.variant] || null;
    }
    function editable(style) {
        return Boolean(options.canEdit?.() && style && !style.builtin && (style.statesSource || style.source));
    }

    function nodesUsing(type, variant) {
        return flatten(outline && outline.root).filter(node => node.style && node.style.type === type && node.style.variant === variant);
    }

    function assetOf(name) {
        return (skin.assets || []).find(asset => asset.name === name) || null;
    }

    function sourceImage(assetName) {
        const img = document.createElement("img");
        const asset = assetOf(assetName);
        img.className = "png";
        img.alt = assetName || "no artwork";
        img.title = asset ? `${assetBase}${asset.file}` : assetName || "";
        img.src = `${assetBase}${asset ? asset.file : `src/${assetName}.png`}`;
        return img;
    }

    // --- rendering -----------------------------------------------------

    function renderMeta(style) {
        metaEl.innerHTML = "";
        const heading = document.createElement("div");
        heading.className = "heading";
        heading.textContent = `${style.type}/${style.variant}`;
        if (style.extends) heading.textContent += `  (extends ${style.extends})`;
        metaEl.appendChild(heading);

        const description = document.createElement("div");
        description.className = "description";
        description.textContent = style.description || "No description authored for this graphical representation.";
        metaEl.appendChild(description);

        const facts = document.createElement("div");
        facts.className = "facts";
        const insets = style.insets || {};
        facts.append(
            document.createTextNode(`9-slice insets ${insets.left}/${insets.top}/${insets.right}/${insets.bottom}`),
            document.createTextNode(`   default size ${style.width ?? "auto"} x ${style.height ?? "auto"}`),
            document.createTextNode(`   label ${style.label?.align || "left"}${style.label?.font ? ` in font "${style.label.font}"` : ""}`)
        );
        if (style.source) {
            facts.append(document.createTextNode("   "), button(`${style.source.file}:${style.source.range.start.line}`, "Open this style's YAML", () => options.onOpenSource?.(style.source)));
        }
        metaEl.appendChild(facts);
    }

    function renderStates(style) {
        statesEl.innerHTML = "";
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = options.canEdit?.()
            ? "Set the background PNG per visual state. A change edits the skin YAML buffer; review it and press Ctrl+S to save and regenerate."
            : "Read-only on a static host. Run `node v2/server.mjs` and open its URL to set artwork.";
        statesEl.appendChild(note);

        const table = document.createElement("table");
        const head = document.createElement("tr");
        for (const column of ["state", "source PNG", "drawn", "asset", "where it comes from"]) {
            const th = document.createElement("th");
            th.textContent = column;
            head.appendChild(th);
        }
        table.appendChild(head);

        for (const state of STYLE_STATES) {
            const own = style.states && style.states[state];
            const resolution = resolveStateAsset(style, state);
            const row = document.createElement("tr");
            row.dataset.state = state;
            row.className = own && !own.inherited ? "own" : own ? "inherited" : "unset";

            const stateCell = document.createElement("td");
            stateCell.textContent = state;
            row.appendChild(stateCell);

            const pngCell = document.createElement("td");
            if (resolution.asset) pngCell.appendChild(sourceImage(resolution.asset));
            else pngCell.textContent = "—";
            row.appendChild(pngCell);

            const drawnCell = document.createElement("td");
            const { canvas, ctx } = makeCanvas(CELL_WIDTH, CELL_HEIGHT);
            paintCell(ctx, style, state, state);
            canvas.dataset.state = state;
            drawnCell.appendChild(canvas);
            row.appendChild(drawnCell);

            const assetCell = document.createElement("td");
            const picker = document.createElement("select");
            picker.dataset.state = state;
            picker.disabled = !editable(style);
            const noneOption = document.createElement("option");
            noneOption.value = NONE_VALUE;
            noneOption.textContent = own && !own.inherited ? "(remove this override)" : "(not set)";
            picker.appendChild(noneOption);
            for (const name of available) {
                const option = document.createElement("option");
                option.value = name;
                option.textContent = name;
                picker.appendChild(option);
            }
            picker.value = own && !own.inherited ? own.asset : NONE_VALUE;
            if (own && !own.inherited && !available.includes(own.asset)) {
                // An asset with no source file must still be selectable/visible.
                const missing = document.createElement("option");
                missing.value = own.asset;
                missing.textContent = `${own.asset} (missing file)`;
                picker.appendChild(missing);
                picker.value = own.asset;
            }
            picker.addEventListener("change", () => applyStateChange(style, state, picker.value));
            assetCell.appendChild(picker);
            row.appendChild(assetCell);

            const originCell = document.createElement("td");
            originCell.appendChild(document.createTextNode(describeResolution(resolution)));
            const source = own ? own.source : resolution.source;
            if (source) {
                originCell.appendChild(document.createTextNode(" "));
                originCell.appendChild(button(`${source.file}:${source.range.start.line}`, "Open the line that names this artwork", () => options.onOpenSource?.(source)));
            }
            row.appendChild(originCell);
            table.appendChild(row);
        }
        statesEl.appendChild(table);
    }

    // One cell of the library/state table: the style drawn for one state, by
    // the same draw kind the application uses for that component type (spec
    // 009), so a cell cannot illustrate something the renderer would not do.
    function paintCell(ctx, style, state, label) {
        ctx.fillStyle = "#1c1c1c";
        ctx.fillRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
        const rect = { x: 2, y: 2, width: CELL_WIDTH - 4, height: CELL_HEIGHT - 4 };
        return drawKind(drawKindOf(style.type)).draw(ctx, assets, style, rect, label || state, {
            hover: state.includes("hover"),
            pressed: state.includes("pressed"),
            disabled: state === "disabled",
            highlighted: state.includes("active")
        }, { type: style.type });
    }

    function renderLibrary(style) {
        libraryEl.innerHTML = "";
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = `Component library: every ${style.type} variety in every visual state, drawn by the application's own renderer.`;
        libraryEl.appendChild(note);

        const table = document.createElement("table");
        const head = document.createElement("tr");
        head.appendChild(document.createElement("th"));
        for (const state of STYLE_STATES) {
            const th = document.createElement("th");
            th.textContent = state;
            head.appendChild(th);
        }
        table.appendChild(head);

        for (const variant of variantNames(style.type)) {
            const variantStyle = skin.styles[style.type][variant];
            const row = document.createElement("tr");
            row.dataset.variant = variant;
            if (variant === style.variant) row.className = "current";
            const nameCell = document.createElement("td");
            nameCell.appendChild(button(variant, "Show this variant", () => select(style.type, variant)));
            row.appendChild(nameCell);
            for (const state of STYLE_STATES) {
                const cell = document.createElement("td");
                const { canvas, ctx } = makeCanvas(CELL_WIDTH, CELL_HEIGHT);
                const resolution = paintCell(ctx, variantStyle, state, variant);
                canvas.title = describeResolution(resolution);
                canvas.dataset.variant = variant;
                canvas.dataset.state = state;
                cell.appendChild(canvas);
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
        libraryEl.appendChild(table);
    }

    function renderUsage(style) {
        usageEl.innerHTML = "";
        const nodes = nodesUsing(style.type, style.variant);
        usageEl.appendChild(document.createTextNode(`used by ${nodes.length} component${nodes.length === 1 ? "" : "s"}: `));
        if (nodes.length === 0) usageEl.appendChild(document.createTextNode("none in the current application"));
        for (const node of nodes) {
            usageEl.appendChild(button(`${labelText(node)} (${node.id})`, "Select this component in the preview", () => options.onSelectInPreview?.(node.id)));
        }
    }

    function renderSelected() {
        const style = currentStyle();
        if (!style || !assets) {
            metaEl.textContent = skin ? "" : "No skin in the current outline.";
            statesEl.innerHTML = "";
            libraryEl.innerHTML = "";
            usageEl.innerHTML = "";
            return;
        }
        typePicker.value = selected.type;
        variantPicker.value = selected.variant;
        renderMeta(style);
        renderStates(style);
        renderLibrary(style);
        renderUsage(style);
    }

    function renderPickers() {
        typePicker.innerHTML = "";
        for (const type of typeNames()) {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = type;
            typePicker.appendChild(option);
        }
        variantPicker.innerHTML = "";
        if (!selected) return;
        for (const variant of variantNames(selected.type)) {
            const option = document.createElement("option");
            option.value = variant;
            option.textContent = variant;
            variantPicker.appendChild(option);
        }
    }

    // --- editing -------------------------------------------------------

    function applyStateChange(style, state, value) {
        if (!editable(style)) return;
        const file = (style.statesSource || style.source).file;
        const note = value === NONE_VALUE
            ? `removed ${style.type}/${style.variant} ${state}`
            : `${style.type}/${style.variant} ${state} -> ${value}`;
        options.applyEdit?.({
            file,
            note,
            transform: text => (value === NONE_VALUE ? clearStateAsset(text, style, state) : setStateAsset(text, style, state, value))
        });
        setStatus(`${note} (unsaved: press Ctrl+S to save and regenerate)`, "warn");
    }

    function setStatus(text, level) {
        status.textContent = text;
        status.className = `status ${level || ""}`;
    }

    function select(type, variant) {
        if (!skin || !skin.styles[type]) return false;
        const variants = variantNames(type);
        selected = { type, variant: variants.includes(variant) ? variant : variants[0] };
        renderPickers();
        renderSelected();
        return true;
    }

    return {
        /** Re-reads the skin from a (re)generated outline, keeping the selection when it still exists. */
        async setOutline(next) {
            outline = next;
            skin = next && next.skin ? next.skin : null;
            if (!skin) {
                renderSelected();
                return;
            }
            // The cache key makes a regenerated skin reload its artwork instead
            // of reusing the images loaded for the previous generation.
            assets = await loadCanvasAssets({ ...skin, cacheKey: next.sourceHash || String(Date.now()) });
            available = [];
            try {
                available = (await options.listAssets?.()) || [];
            } catch {
                available = [];
            }
            if (available.length === 0) available = (skin.assets || []).map(asset => asset.name);
            available = [...new Set(available)].sort();

            const types = typeNames();
            const keep = selected && types.includes(selected.type) ? selected : null;
            // Opens on the first implemented type the registry lists that this
            // skin styles, rather than naming a component type here.
            const preferred = typeEntries().map(([type]) => type).find(type => types.includes(type)) || types[0];
            selected = keep || (types.length ? { type: preferred, variant: "default" } : null);
            if (selected) selected.variant = variantNames(selected.type).includes(selected.variant) ? selected.variant : variantNames(selected.type)[0];
            renderPickers();
            renderSelected();
            const missing = assets.missing || [];
            setStatus(`${skin.name} skin, ${skin.mode} mode, ${(skin.assets || []).length} assets${missing.length ? `, ${missing.length} missing` : ""}`, missing.length ? "warn" : "");
        },
        /** Shows the style a given style descriptor (from a node) points at. */
        selectStyle(type, variant) {
            return select(type, variant);
        },
        /** Shows the style that draws one application node. */
        selectForNode(nodeId) {
            const node = flatten(outline && outline.root).find(n => n.id === nodeId);
            if (!node || !node.style) return false;
            return select(node.style.type, node.style.variant);
        },
        get selected() {
            return selected ? { ...selected } : null;
        },
        dispose() {
            container.innerHTML = "";
        }
    };
}
