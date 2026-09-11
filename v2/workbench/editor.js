import {
    EditorView, EditorState, EditorSelection, Compartment, keymap, basicSetup, yaml,
    linter, lintGutter, forceLinting, foldAll, unfoldAll, oneDark
} from "../vendor/codemirror/codemirror.bundle.js";
import { parseYamlDocument } from "../compiler/yaml.js";

// Workbench-only source editor (spec 006): CodeMirror 6 with YAML syntax
// highlighting, fold gutter and a lint gutter. The linter is not a generic
// YAML validator: it runs the project's own compiler/yaml.js parser on the
// buffer, so the editor flags exactly what `PUT /api/source` would reject
// (422), and it overlays the compiler's own diagnostics for this file at
// their source ranges when the host says those ranges are trustworthy (the
// buffer is unchanged since the last generation). Offsets are LF-based on
// both sides: CodeMirror normalizes line breaks and compiler/yaml.js
// computes ranges on LF-normalized text.
//
// Nothing here is imported by the standalone preview.

function clampRange(from, to, length) {
    const a = Math.max(0, Math.min(length, Number.isFinite(from) ? from : 0));
    const b = Math.max(a, Math.min(length, Number.isFinite(to) ? to : a));
    return { from: a, to: b };
}

/**
 * @param {HTMLElement} parent
 * @param {{ onChange?: (text: string) => void, onSave?: () => void, readOnly?: boolean, filePath?: () => string }} [options]
 */
export function createSourceEditor(parent, options = {}) {
    const readOnlyCompartment = new Compartment();
    let externalDiagnostics = [];
    let suppressChange = false;

    function readOnlyExtensions(flag) {
        return [EditorState.readOnly.of(flag), EditorView.editable.of(!flag)];
    }

    function lintSource(view) {
        const text = view.state.doc.toString();
        const length = text.length;
        const out = [];
        const { errors } = parseYamlDocument(text, options.filePath ? options.filePath() : "buffer.yaml");
        for (const error of errors) {
            const start = error.range?.start?.offset ?? 0;
            const end = error.range?.end?.offset ?? start;
            const range = clampRange(start, Math.max(end, start + 1), length);
            out.push({ ...range, severity: "error", source: "yaml", message: error.message });
        }
        for (const d of externalDiagnostics) {
            if (!d.range) continue;
            const range = clampRange(d.range.start.offset, Math.max(d.range.end.offset, d.range.start.offset + 1), length);
            out.push({ ...range, severity: d.severity === "error" ? "error" : "warning", source: "compiler", message: `[${d.code}] ${d.message}` });
        }
        return out.sort((a, b) => a.from - b.from);
    }

    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc: "",
            extensions: [
                basicSetup,
                yaml(),
                oneDark,
                lintGutter(),
                linter(lintSource, { delay: 250 }),
                readOnlyCompartment.of(readOnlyExtensions(Boolean(options.readOnly))),
                keymap.of([{ key: "Mod-s", preventDefault: true, run: () => { options.onSave?.(); return true; } }]),
                EditorView.updateListener.of(update => {
                    if (update.docChanged && !suppressChange) options.onChange?.(update.state.doc.toString());
                }),
                EditorView.theme({
                    "&": { height: "100%", fontSize: "12px", backgroundColor: "#151515" },
                    ".cm-scroller": { fontFamily: "monospace", lineHeight: "1.4" },
                    ".cm-gutters": { backgroundColor: "#181818", borderRight: "1px solid #2a2a2a" },
                    "&.cm-focused": { outline: "none" }
                })
            ]
        })
    });

    return {
        view,
        getText() {
            return view.state.doc.toString();
        },
        /**
         * Replaces the whole document. By default this is a host-driven load
         * (file switch, reload from disk) and does not report a change; pass
         * `notify: true` to treat it as an edit.
         */
        setText(text, { notify = false, selection } = {}) {
            suppressChange = !notify;
            try {
                const sel = selection ? clampRange(selection.from, selection.to, text.length) : { from: 0, to: 0 };
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: text },
                    selection: EditorSelection.single(sel.from, sel.to)
                });
            } finally {
                suppressChange = false;
            }
            if (notify) options.onChange?.(text);
        },
        getSelection() {
            const main = view.state.selection.main;
            return { from: main.from, to: main.to };
        },
        select(from, to, { focus = true } = {}) {
            const range = clampRange(from, to, view.state.doc.length);
            view.dispatch({ selection: EditorSelection.single(range.from, range.to), scrollIntoView: true });
            if (focus) view.focus();
        },
        focus() {
            view.focus();
        },
        setReadOnly(flag) {
            view.dispatch({ effects: readOnlyCompartment.reconfigure(readOnlyExtensions(Boolean(flag))) });
        },
        get readOnly() {
            return view.state.readOnly;
        },
        /** Compiler diagnostics (with `range`) to overlay; pass [] when ranges cannot be trusted. */
        setExternalDiagnostics(list) {
            externalDiagnostics = Array.isArray(list) ? list : [];
            forceLinting(view);
        },
        foldAll() { foldAll(view); },
        unfoldAll() { unfoldAll(view); },
        dispose() { view.destroy(); }
    };
}
