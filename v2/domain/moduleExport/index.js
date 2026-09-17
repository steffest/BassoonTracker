// The module-export capability (spec 037), completing package P9's own
// stated acceptance clause "exports are readable by v1". Wired to the File
// menu's own `saveFile` item (authored since the application's first
// cumulative spec, previously an unresolved-action-reference no-op) through
// compiler/recipes.js's own "save" verb addition and capabilities.js's
// "file.save" mapping.

import Tracker from "../playback/engine/tracker.js";
import { write as writeMod } from "./protracker.js";
import { write as writeXm, writeXI } from "./fasttracker.js";
import { writeWav, writeRaw } from "./sample.js";

/**
 * Ported from script/src/tracker.js#getFileName (2468-2471) - UI-only code,
 * not part of the ported playback engine. One deliberate fix, not a literal
 * port: v1's own version hardcodes a ".mod" extension for the no-filename
 * fallback regardless of format, so a brand-new XM song saved before ever
 * being given a name would be written as "<title>.mod" despite being XM
 * content - a real, easily-avoidable defect, not a behavior worth matching
 * (the same kind of call spec 034 made fixing hippo.js's own crash).
 */
function fileName(extension) {
    const song = Tracker.getSong();
    if (!song) return `new.${extension}`;
    if (song.filename) return song.filename;
    return song.title ? `${song.title.replace(/ /g, "-").replace(/\W/g, "")}.${extension}` : `new.${extension}`;
}

// Shared by exportModule and exportSample (spec 064): a plain browser
// download via Blob/URL.createObjectURL/a synthetic <a> click.
function downloadBuffer(buffer, name) {
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * The `file.save` capability. Dispatches to the MOD or XM writer depending
 * on which format is currently loaded, exactly as v1's own
 * `Editor.buildBinary` does.
 */
export async function exportModule(app) {
    const isXm = Tracker.inFTMode();
    const { buffer, truncated } = isXm ? writeXm() : writeMod();
    if (truncated && app && app.log) app.log("file.save", { warning: "more than 31 instruments; only the first 31 were exported" });

    const name = fileName(isXm ? "xm" : "mod");
    downloadBuffer(buffer, name);
    if (app && app.log) app.log("file.save", { name });
}

function instrumentBaseName(instrument, instrumentIndex) {
    const raw = (instrument && instrument.name) || `sample-${instrumentIndex}`;
    return raw.replace(/ /g, "-").replace(/\W/g, "") || `sample-${instrumentIndex}`;
}

/**
 * The sample-export capability (spec 064), ported from
 * script/src/ui/diskOp_Save.js's sample-export branch (82-131). `format` is
 * one of "xi", "wav8", "wav16", "raw8"; anything else falls back to "wav8",
 * matching that panel's own default-selected radio item. Not wired to any
 * YAML/capabilities.js entry yet - see requirements.md's own recorded
 * decision; a later "save/export screen" spec is expected to call this.
 */
export async function exportSample(app, format) {
    const instrumentIndex = Tracker.getCurrentInstrumentIndex();
    const instrument = Tracker.getInstrument(instrumentIndex);
    if (!instrument) return;
    const baseName = instrumentBaseName(instrument, instrumentIndex);

    if (format === "xi") {
        const result = writeXI(instrumentIndex);
        if (!result) return;
        const name = `${baseName}.xi`;
        downloadBuffer(result.buffer, name);
        if (app && app.log) app.log("sample.export", { name, format });
        return;
    }

    const sample = instrument.sample;
    if (!sample || !sample.data) return;

    let result;
    let extension;
    if (format === "wav16") { result = writeWav(sample.data, 16); extension = "wav"; }
    else if (format === "raw8") { result = writeRaw(sample.data); extension = "sample"; }
    else { result = writeWav(sample.data, 8); extension = "wav"; } // "wav8", and the default

    const name = `${baseName}.${extension}`;
    downloadBuffer(result.buffer, name);
    if (app && app.log) app.log("sample.export", { name, format });
}

// The save/export screen's own format radioGroup (spec 067) dispatches a
// clicked item's own label, not the internal format code exportSample
// itself expects - this table is the one place that translation happens.
const SAMPLE_FORMAT_LABELS = { "WAV 8-bit": "wav8", "WAV 16-bit": "wav16", "RAW 8-bit": "raw8", XI: "xi" };
let sampleExportFormat = "wav8";

/** The `sample-format.set` capability (spec 067) - the radioGroup's own `change` handler. */
export function setSampleExportFormat(app, detail) {
    sampleExportFormat = SAMPLE_FORMAT_LABELS[detail && detail.value] || "wav8";
}

/**
 * The `sample.export` capability (spec 067) - the save/export screen's own
 * "Export Sample" button. A thin wrapper over exportSample(app, format)
 * (spec 064, unchanged and still directly callable/testable on its own)
 * supplying whatever format the radioGroup above last selected.
 */
export async function exportSampleSelection(app) {
    return exportSample(app, sampleExportFormat);
}
