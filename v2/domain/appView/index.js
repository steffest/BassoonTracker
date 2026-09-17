// Cross-section view routing (spec 070's own UI-alignment pass, steps 4 and
// 6).
//
// The control bar has three buttons - File Operations, Options, Sample Edit
// - that look like one group but are not: confirmed against v1's own real
// source (script/src/ui/app/controlPanel.js) and live in the browser (File
// Operations and Sample Edit can both be open at the same time) that these
// are three *independent* toggle buttons (`Checkboxbutton`), each with its
// own onDown handler, not a single mutually-exclusive radioGroup. Step 4's
// own `setTopView` wrongly coupled all three onto a shared write path; this
// replaces it with the real shape.
//
// File Operations and Options genuinely are mutually exclusive with each
// other (and, since step 6, with Nibbles too - see domain/nibbles/index.js)
// - all three share one slot, appMainPanel.js's own `_currentView`, which
// v1's `EVENT.showView` cases explicitly hide before showing another
// ("diskop_load" hides optionsPanel; "options" hides diskOperations; the
// pluginRenderHook's own "main" target hides both). That slot is
// song-properties-view.value here. Sample Edit lives in a second,
// completely independent slot - patternPanel.js's own `currentView` - never
// touched by any of the appMainPanel-side cases above; that slot is
// pattern-section-view.value, and it is only ever written by
// toggleSampleEditPanel (and by domain/nibbles/index.js's own "main" reset,
// which - like v1's own "main" broadcast - hits both slots at once).
//
// Each button toggles its own slot off if it is already showing (matching
// Checkboxbutton's own `this.isActive ? <close> : <open>` shape) rather than
// only ever setting it - the same "click again to close" behavior v1's own
// buttons have, which a shared radioGroup-style write (step 4's own
// approach) cannot express at all: a v2 radioGroup never even dispatches a
// change event for re-clicking its own already-active item (see
// renderers/canvas/mountGeneric.js's own `previous !== id` guard).

function toggleSection(app, field, value) {
    if (!app || !app.state) return;
    const current = app.state.get(field);
    const next = current === value ? "" : value;
    app.state.set(field, next);
    if (app.log) app.log(`${field}.toggle`, { [field]: next });
    return next;
}

export function toggleFileOperationsView(app) {
    toggleSection(app, "song-properties-view.value", "File Operations");
}

export function toggleOptionsView(app) {
    toggleSection(app, "song-properties-view.value", "Options");
}

export function toggleSampleEditPanel(app) {
    toggleSection(app, "pattern-section-view.value", "Sample Edit");
}
