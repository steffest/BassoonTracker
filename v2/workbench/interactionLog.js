import { createTraceCollector } from "../runtime/traceCollector.js";

// Workbench-only Interaction log UI (spec 005 IWB-008 / spec 002 COMP-002).
// Displays the trace events the preview iframe (renderer "canvas") and the
// State gallery's live example (renderer "gallery") emit, through one
// bounded collector: pause/resume stop capture, filters are display-only,
// clear resets everything, and paused/filtered/dropped states are each
// reported explicitly so "nothing shown" is never ambiguous.

// Spec 014 added three kinds: a value control's number changing, a
// viewport's applied scroll offset, and a file drop. They are listed here
// because the filter set starts as exactly these kinds, so a kind that is
// missing from this list is silently hidden rather than merely uncoloured.
const KINDS = ["input", "state", "activation", "command", "value", "scroll", "filedrop"];

function formatDetail(entry) {
    switch (entry.kind) {
        case "input": {
            const gesture = entry.dx !== undefined ? `  ${entry.dx},${entry.dy}` : "";
            const notch = entry.deltaY !== undefined ? `  Δy ${entry.deltaY}` : "";
            return `${entry.input}${entry.key ? ` "${entry.key}"` : ""}${gesture}${notch}`;
        }
        case "state": return `${entry.field}: ${String(entry.from)} → ${String(entry.to)}`;
        case "activation": return `${entry.result}${entry.event && entry.event !== "click" ? ` on ${entry.event}` : ""}${entry.detail ? ` (${entry.detail})` : ""}`;
        case "command": return `${entry.command}${entry.event && entry.event !== "click" ? ` on ${entry.event}` : ""}${entry.mockField ? `  ${entry.mockField}: ${String(entry.from)} → ${String(entry.to)}` : ""}`;
        case "value": return `${entry.field}: ${String(entry.from)} → ${String(entry.to)}`;
        case "scroll": return `${entry.field}: ${String(entry.from)} → ${String(entry.to)} px`;
        case "filedrop": return `${entry.files.length} file(s): ${entry.files.join(", ")}  (${entry.bytes} bytes)`;
        default: return JSON.stringify(entry);
    }
}

/**
 * @param {HTMLElement} container
 * @param {{ capacity?: number, onSelectInstance?: (instance: string, renderer: string) => void }} [options]
 */
export function createInteractionLog(container, options = {}) {
    const collector = createTraceCollector({ capacity: options.capacity ?? 500 });
    const filter = { instance: null, kinds: new Set(KINDS) };

    container.innerHTML = "";
    container.classList.add("v2-interaction-log");

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const pauseButton = document.createElement("button");
    pauseButton.type = "button";
    pauseButton.textContent = "Pause";
    pauseButton.addEventListener("click", () => (collector.paused ? collector.resume() : collector.pause()));

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => collector.clear());

    const instanceSelect = document.createElement("select");
    instanceSelect.title = "Filter by component instance (display only)";
    instanceSelect.addEventListener("change", () => { filter.instance = instanceSelect.value || null; render(); });

    const kindBoxes = document.createElement("span");
    kindBoxes.className = "kinds";
    KINDS.forEach(kind => {
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = true;
        box.dataset.kind = kind;
        box.addEventListener("change", () => { box.checked ? filter.kinds.add(kind) : filter.kinds.delete(kind); render(); });
        label.append(box, document.createTextNode(kind));
        kindBoxes.appendChild(label);
    });

    const status = document.createElement("span");
    status.className = "status";

    toolbar.append(pauseButton, clearButton, instanceSelect, kindBoxes, status);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>#</th><th>t ms</th><th>renderer</th><th>instance</th><th>kind</th><th>detail</th></tr>";
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);

    const scroller = document.createElement("div");
    scroller.className = "scroller";
    scroller.appendChild(table);

    container.append(toolbar, scroller);

    function renderInstanceOptions() {
        const current = filter.instance;
        const instances = collector.instances();
        if (current && !instances.includes(current)) instances.push(current);
        instanceSelect.innerHTML = "";
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "all instances";
        instanceSelect.appendChild(all);
        instances.forEach(instance => {
            const option = document.createElement("option");
            option.value = instance;
            option.textContent = instance;
            instanceSelect.appendChild(option);
        });
        instanceSelect.value = current || "";
    }

    let scheduled = false;
    function render() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            renderInstanceOptions();
            const entries = collector.view({ instance: filter.instance, kinds: [...filter.kinds] });
            const total = collector.size;
            const filtered = total - entries.length;
            pauseButton.textContent = collector.paused ? "Resume" : "Pause";
            const parts = [];
            parts.push(collector.paused ? `PAUSED: ${collector.ignoredWhilePaused} event(s) not captured` : "capturing");
            parts.push(`showing ${entries.length} of ${total}${filtered ? ` (${filtered} hidden by filters)` : ""}`);
            parts.push(`dropped ${collector.dropped} (capacity ${collector.capacity})`);
            status.textContent = parts.join(" · ");
            status.classList.toggle("paused", collector.paused);

            const stickToBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
            tbody.innerHTML = "";
            for (const entry of entries) {
                const row = document.createElement("tr");
                row.className = `kind-${entry.kind}`;
                if (entry.kind === "activation" && entry.result !== "dispatched") row.classList.add("muted");
                [entry.seq, entry.t.toFixed(1), entry.renderer || "", entry.instance || "", entry.kind, formatDetail(entry)].forEach(text => {
                    const cell = document.createElement("td");
                    cell.textContent = String(text);
                    row.appendChild(cell);
                });
                row.title = "click: select this instance in the preview";
                row.addEventListener("click", () => options.onSelectInstance?.(entry.instance, entry.renderer));
                tbody.appendChild(row);
            }
            if (stickToBottom) scroller.scrollTop = scroller.scrollHeight;
        });
    }

    const unsubscribe = collector.subscribe(render);
    render();

    return {
        collector,
        /** Records one trace event coming from a renderer (the iframe bridge or the gallery). */
        record(event) { return collector.record(event); },
        render,
        dispose() { unsubscribe(); container.innerHTML = ""; }
    };
}
