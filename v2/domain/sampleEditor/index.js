// The sample editor's own first slice (spec 040), package P10's first named
// tenant. Selection over the current instrument's sample data, and four
// operations ported from script/plugins/sampleeditor/sampleProcessing.js,
// each undoable through domain/song's own shared history (the EDITACTION.SAMPLE
// seam spec 028 planted on purpose - see domain/song/README.md and this
// module's own README.md).
//
// This module never imports domain/playback/engine/ directly; it reaches the
// current instrument and registers undo entries only through
// domain/song/index.js's own public surface, an ordinary inter-module
// dependency, not a new documented exception.
//
// Spec 042 adds the screen this module was always headless without: an
// instrument selector/name field and a handful of instrument-metadata
// fields (volume, loop enabled/start/length), plus thin, zero-argument
// capability wrappers around the four operations above, all now reachable
// from real YAML (project/specs/application/current/components/
// sampleEditPanel.yaml) for the first time. Instrument-property edits below
// are deliberately NOT undoable - see requirements.md's own scope boundary
// on this (v1's own trackUndo/undoInstrument mechanism replays through a
// live UI control object, a shape domain/song/editHistory.js's own
// EDITACTION.VALUE case still carries verbatim but that nothing in v2 has
// ever registered - porting it properly is a later, separate concern).
//
// Spec 045 adds the loop creator's own menu bar and screen wiring on top -
// this module's first import of its own sibling domain/sampleEditor/
// loopCreator.js (spec 043), the same "index.js is the public dispatcher,
// the sibling is internal" shape domain/moduleExport/index.js already has
// for protracker.js/fasttracker.js.
//
// Spec 046 adds the resample panel the same way, via a second sibling
// (./resample.js) - the second of P10's three separable sample-editor
// sub-features spec 040 recorded (the hiss-reduction panel is left for a
// later spec). Unlike the loop creator, nothing is mutated until Apply
// (resample.applyResample) runs, so there is no live-preview snapshot for
// Cancel to restore.

import * as song from "../song/index.js";
import { EDITACTION } from "../song/index.js";
import { normalize, fadeIn, fadeOut, adjustVolumePercent, reverseRange, invertRange, trimBounds } from "./processing.js";
import * as loopCreator from "./loopCreator.js";
import * as resample from "./resample.js";
import * as envelope from "./envelope.js";

let selectionStart = 0;
let selectionLength = 0; // 0 = "the whole sample"

export function getSampleSelection() {
    return { start: selectionStart, length: selectionLength };
}

export function setSampleSelection(start, length) {
    selectionStart = Math.max(0, start || 0);
    selectionLength = Math.max(0, length || 0);
}

export function resetSampleSelection() {
    selectionStart = 0;
    selectionLength = 0;
}

/** @returns {{start: number, head: number[], range: number[], tail: number[]}} */
function splitRange(instrument) {
    const data = instrument.sample.data;
    if (selectionLength) {
        return {
            start: selectionStart,
            head: data.slice(0, selectionStart),
            range: data.slice(selectionStart, selectionStart + selectionLength),
            tail: data.slice(selectionStart + selectionLength)
        };
    }
    return { start: 0, head: [], range: data.slice(0), tail: [] };
}

function joinRange(instrument, parts) {
    instrument.sample.data = [...parts.head, ...parts.range, ...parts.tail];
    instrument.sample.length = instrument.sample.data.length;
}

/**
 * Runs `transform` over the current selection's own range, registers one
 * undo entry, and writes the result back - the shared bookkeeping every
 * operation below needs, matching sampleProcessing.js's own
 * `applyRangeTransform` (and each operation's own inline copy of the same
 * shape) folded into one place.
 * @param {string} name shown by domain/song#getUndoLabel/getRedoLabel.
 * @param {(range: number[]) => boolean|void} transform mutates `range` in
 *   place; returning `false` means "nothing changed" (matches
 *   processing.js's own normalize/fadeIn/fadeOut convention).
 * @returns {boolean} whether an edit was made.
 */
function withRange(name, transform) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample || !instrument.sample.data) return false;
    const parts = splitRange(instrument);
    const before = parts.range.slice();
    const changed = transform(parts.range) !== false;
    if (!changed) return false;

    joinRange(instrument, parts);
    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: parts.start,
        to: selectionLength,
        data: before,
        dataTo: parts.range.slice(),
        name
    });
    return true;
}

/** @param {"max"|"fadein"|"fadeout"|number} amount */
export function adjustVolume(amount) {
    if (amount === "max") return withRange("Adjust Volume", normalize);
    if (amount === "fadein") return withRange("Adjust Volume", range => { fadeIn(range); });
    if (amount === "fadeout") return withRange("Adjust Volume", range => { fadeOut(range); });
    if (typeof amount === "number" && amount !== 0) return withRange("Adjust Volume", range => { adjustVolumePercent(range, amount); });
    return false;
}

export function reverse() {
    return withRange("Reverse Sample", reverseRange);
}

export function invert() {
    return withRange("Invert Sample", invertRange);
}

/**
 * Strips near-silent head/tail from the current selection, never past the
 * sample's own loop end, keeping the loop's own start point meaningful
 * (shifted the same way v1's own trim() does) - see design.md.
 */
export function trim() {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample || !instrument.sample.data) return false;

    const parts = splitRange(instrument);
    const loop = instrument.sample.loop;
    const relativeLoop = loop && loop.length > 2 ? { start: loop.start - parts.start, length: loop.length } : null;
    const bounds = trimBounds(parts.range, relativeLoop);
    if (!bounds) return false;

    const before = parts.range.slice();
    parts.range = parts.range.slice(bounds.start, bounds.end + 1);
    joinRange(instrument, parts);
    song.registerSampleEdit({
        type: EDITACTION.SAMPLE,
        instrument: song.getCurrentInstrumentIndex(),
        from: parts.start,
        to: selectionLength,
        data: before,
        dataTo: parts.range.slice(),
        name: "Trim Sample"
    });

    if (loop && loop.length > 2 && loop.start >= parts.start) {
        const newStart = Math.max(parts.start, loop.start - bounds.start) & ~1;
        const newLength = loop.length & ~1;
        if (newStart !== loop.start || newLength !== loop.length) {
            loop.start = newStart;
            loop.length = newLength;
        }
    }
    return true;
}

// --- the screen's own capability surface (spec 042) ------------------------

/** State fields the sample-editor screen publishes, when the application binds them. */
export const STATE_FIELDS = {
    instrumentIndex: "instrument-index.value",
    instrumentName: "instrument-name.value",
    volume: "sample-volume.value",
    loopEnabled: "loop-enabled.active",
    loopStart: "loop-start.value",
    loopLength: "loop-length.value",
    // Spec 050: the FT-only side panel.
    finetune: "finetune.value",
    panning: "panning.value",
    fadeout: "fadeout.value",
    relativeNote: "relative-note.value",
    vibratoSpeed: "vibrato-speed.value",
    vibratoDepth: "vibrato-depth.value",
    vibratoSweep: "vibrato-sweep.value",
    vibratoWave: "vibrato-wave.value",
    // Spec 057: the envelope screen - six fields per envelope type, the
    // surrounding checkboxes/spinboxes only (the envelope's own points stay
    // outside the store, read directly by envelopeView's own controller/
    // draw kind - spec 056's own contract, unchanged).
    volumeEnvelopeEnabled: "volume-envelope-enabled.active",
    volumeEnvelopeSustain: "volume-envelope-sustain.active",
    volumeEnvelopeSustainPoint: "volume-envelope-sustain-point.value",
    volumeEnvelopeLoop: "volume-envelope-loop.active",
    volumeEnvelopeLoopStart: "volume-envelope-loop-start.value",
    volumeEnvelopeLoopEnd: "volume-envelope-loop-end.value",
    panningEnvelopeEnabled: "panning-envelope-enabled.active",
    panningEnvelopeSustain: "panning-envelope-sustain.active",
    panningEnvelopeSustainPoint: "panning-envelope-sustain-point.value",
    panningEnvelopeLoop: "panning-envelope-loop.active",
    panningEnvelopeLoopStart: "panning-envelope-loop-start.value",
    panningEnvelopeLoopEnd: "panning-envelope-loop-end.value"
};

// sampleView.js's own waveLabels order (329).
const VIBRATO_WAVE_LABELS = ["Sine", "Square", "Saw", "Saw Inverse"];

function publish(app, field, value) {
    if (!app || !app.state || value === undefined) return;
    try {
        app.state.set(field, value);
    } catch {
        /* not bound by this application */
    }
}

/**
 * Pushes the current instrument's own fields into the store - called after
 * every edit below, and whenever the instrument changes, the same moment
 * v1's own `EVENT.instrumentChange` handler does (sampleView.js:934-985).
 */
export function publishInstrumentFields(app) {
    publish(app, STATE_FIELDS.instrumentIndex, song.getCurrentInstrumentIndex());
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) {
        publish(app, STATE_FIELDS.instrumentName, "");
        publish(app, STATE_FIELDS.volume, 0);
        publish(app, STATE_FIELDS.loopEnabled, false);
        publish(app, STATE_FIELDS.loopStart, 0);
        publish(app, STATE_FIELDS.loopLength, 0);
        publish(app, STATE_FIELDS.finetune, 0);
        publish(app, STATE_FIELDS.panning, 0);
        publish(app, STATE_FIELDS.fadeout, 0);
        publish(app, STATE_FIELDS.relativeNote, 0);
        publish(app, STATE_FIELDS.vibratoSpeed, 0);
        publish(app, STATE_FIELDS.vibratoDepth, 0);
        publish(app, STATE_FIELDS.vibratoSweep, 0);
        publish(app, STATE_FIELDS.vibratoWave, VIBRATO_WAVE_LABELS[0]);
    } else {
        publish(app, STATE_FIELDS.instrumentName, instrument.name || "");
        publish(app, STATE_FIELDS.volume, instrument.sample.volume || 0);
        publish(app, STATE_FIELDS.loopEnabled, Boolean(instrument.sample.loop.enabled));
        publish(app, STATE_FIELDS.loopStart, instrument.sample.loop.start || 0);
        publish(app, STATE_FIELDS.loopLength, instrument.sample.loop.length || 0);
        publish(app, STATE_FIELDS.finetune, instrument.getFineTune());
        publish(app, STATE_FIELDS.panning, instrument.sample.panning || 0);
        publish(app, STATE_FIELDS.fadeout, instrument.fadeout || 0);
        publish(app, STATE_FIELDS.relativeNote, instrument.sample.relativeNote || 0);
        publish(app, STATE_FIELDS.vibratoSpeed, (instrument.vibrato && instrument.vibrato.rate) || 0);
        publish(app, STATE_FIELDS.vibratoDepth, (instrument.vibrato && instrument.vibrato.depth) || 0);
        publish(app, STATE_FIELDS.vibratoSweep, (instrument.vibrato && instrument.vibrato.sweep) || 0);
        publish(app, STATE_FIELDS.vibratoWave, VIBRATO_WAVE_LABELS[(instrument.vibrato && instrument.vibrato.type) || 0]);
    }
    // Spec 057: unconditional either way - getEnvelope's own no-instrument
    // default is already all-falsy, so this needs no branch of its own.
    publishEnvelopeFields(app, "volume");
    publishEnvelopeFields(app, "panning");
}

/**
 * Republishes all six of one envelope type's own fields - addPoint/
 * removePoint can silently re-clamp three of them (spec 055's own
 * clampIndices), so every mutation republishes the whole small set rather
 * than tracking which one operation can affect which field. Safe
 * unconditionally, including with no current instrument at all -
 * getEnvelope's own no-instrument default is already all-falsy (spec 055).
 */
function publishEnvelopeFields(app, type) {
    const env = envelope.getEnvelope(type);
    const prefix = type === "volume" ? "volumeEnvelope" : "panningEnvelope";
    publish(app, STATE_FIELDS[`${prefix}Enabled`], env.enabled);
    publish(app, STATE_FIELDS[`${prefix}Sustain`], env.sustain);
    publish(app, STATE_FIELDS[`${prefix}SustainPoint`], env.sustainPoint);
    publish(app, STATE_FIELDS[`${prefix}Loop`], env.loop);
    publish(app, STATE_FIELDS[`${prefix}LoopStart`], env.loopStartPoint);
    publish(app, STATE_FIELDS[`${prefix}LoopEnd`], env.loopEndPoint);
}

// --- the envelope screen (spec 057) -----------------------------------------
//
// One small internal factory instead of sixteen hand-written near-
// duplicates (eight operations x two envelope types) - see requirements.md's
// Decisions for why this is real, not premature, duplication removal.

function envelopeCapabilities(type) {
    return {
        setEnabled(app, detail) {
            envelope.setEnabled(type, Boolean(detail && detail.value));
            publishEnvelopeFields(app, type);
        },
        addPoint(app) {
            envelope.addPoint(type);
            publishEnvelopeFields(app, type);
        },
        removePoint(app) {
            envelope.removePoint(type);
            publishEnvelopeFields(app, type);
        },
        setSustain(app, detail) {
            envelope.setSustain(type, Boolean(detail && detail.value));
            publishEnvelopeFields(app, type);
        },
        setSustainPoint(app, detail) {
            envelope.setSustainPoint(type, Math.round(Number(detail && detail.value)) || 0);
            publishEnvelopeFields(app, type);
        },
        setLoop(app, detail) {
            envelope.setLoop(type, Boolean(detail && detail.value));
            publishEnvelopeFields(app, type);
        },
        setLoopStart(app, detail) {
            envelope.setLoopStart(type, Math.round(Number(detail && detail.value)) || 0);
            publishEnvelopeFields(app, type);
        },
        setLoopEnd(app, detail) {
            envelope.setLoopEnd(type, Math.round(Number(detail && detail.value)) || 0);
            publishEnvelopeFields(app, type);
        }
    };
}

const volumeEnvelopeCapabilities = envelopeCapabilities("volume");
const panningEnvelopeCapabilities = envelopeCapabilities("panning");

export const setVolumeEnvelopeEnabled = volumeEnvelopeCapabilities.setEnabled;
export const addVolumeEnvelopePoint = volumeEnvelopeCapabilities.addPoint;
export const removeVolumeEnvelopePoint = volumeEnvelopeCapabilities.removePoint;
export const setVolumeEnvelopeSustain = volumeEnvelopeCapabilities.setSustain;
export const setVolumeEnvelopeSustainPoint = volumeEnvelopeCapabilities.setSustainPoint;
export const setVolumeEnvelopeLoop = volumeEnvelopeCapabilities.setLoop;
export const setVolumeEnvelopeLoopStart = volumeEnvelopeCapabilities.setLoopStart;
export const setVolumeEnvelopeLoopEnd = volumeEnvelopeCapabilities.setLoopEnd;

export const setPanningEnvelopeEnabled = panningEnvelopeCapabilities.setEnabled;
export const addPanningEnvelopePoint = panningEnvelopeCapabilities.addPoint;
export const removePanningEnvelopePoint = panningEnvelopeCapabilities.removePoint;
export const setPanningEnvelopeSustain = panningEnvelopeCapabilities.setSustain;
export const setPanningEnvelopeSustainPoint = panningEnvelopeCapabilities.setSustainPoint;
export const setPanningEnvelopeLoop = panningEnvelopeCapabilities.setLoop;
export const setPanningEnvelopeLoopStart = panningEnvelopeCapabilities.setLoopStart;
export const setPanningEnvelopeLoopEnd = panningEnvelopeCapabilities.setLoopEnd;

// --- the FT-only side panel (spec 050) --------------------------------------

/** Ported from sampleView.js's own fineTuneSlider.onChange + trackerModeChanged's own setMin/setMax (265-266, 1005-1006) - the authored ceiling is the wide (FastTracker) range; ProTracker's own narrower range is enforced here, not in YAML, the same "authored ceiling, real clamp" shape setLoopStart/setLoopLength already use. */
export function setFinetune(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const [min, max] = song.inFTMode() ? [-128, 127] : [-8, 7];
    const value = Math.max(min, Math.min(max, Math.round(Number(detail && detail.value)) || 0));
    instrument.setFineTune(value);
    publish(app, STATE_FIELDS.finetune, instrument.getFineTune());
}

/** Ported from sampleView.js's own panningSlider.onChange (270). */
export function setPanning(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const value = Math.max(-127, Math.min(127, Math.round(Number(detail && detail.value)) || 0));
    instrument.sample.panning = value;
    publish(app, STATE_FIELDS.panning, value);
}

/** Ported from sampleView.js's own fadeOutSlider.onChange (305). */
export function setFadeout(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(4095, Math.round(Number(detail && detail.value)) || 0));
    instrument.fadeout = value;
    publish(app, STATE_FIELDS.fadeout, value);
}

/** Ported from sampleView.js's own spinBoxRelativeNote.onChange (309). */
export function setRelativeNote(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const value = Math.max(-127, Math.min(128, Math.round(Number(detail && detail.value)) || 0));
    instrument.sample.relativeNote = value;
    publish(app, STATE_FIELDS.relativeNote, value);
}

/** Ported from sampleView.js's own spinBoxVibratoSpeed.onChange (315). */
export function setVibratoSpeed(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(63, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.rate = value;
    publish(app, STATE_FIELDS.vibratoSpeed, value);
}

/** Ported from sampleView.js's own spinBoxVibratoDepth.onChange (320). */
export function setVibratoDepth(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(15, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.depth = value;
    publish(app, STATE_FIELDS.vibratoDepth, value);
}

/** Ported from sampleView.js's own spinBoxVibratoSweep.onChange (325). */
export function setVibratoSweep(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    const value = Math.max(0, Math.min(255, Math.round(Number(detail && detail.value)) || 0));
    instrument.vibrato.sweep = value;
    publish(app, STATE_FIELDS.vibratoSweep, value);
}

/** Ported from sampleView.js's own setVibratoWave (919-929), by label rather than index. */
export function setVibratoWave(app, detail) {
    const index = VIBRATO_WAVE_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    const instrument = song.getCurrentInstrument();
    if (!instrument) return false;
    instrument.vibrato.type = index;
    publish(app, STATE_FIELDS.vibratoWave, detail.value);
    return true;
}

/**
 * The instrument spinBox's own capability. Clamps to `[1, getMaxInstruments()]`
 * silently (matching `Tracker.setCurrentInstrumentIndex`'s own no-op past
 * that ceiling in ProTracker mode - see domain/song/index.js), resets the
 * sample selection the same way `waveform.js#setInstrument` does
 * (waveform.js:613-620: v1 resets its own zoom and range together on every
 * instrument switch), and republishes every field regardless of whether the
 * requested index was valid, so a rejected drag snaps the control straight
 * back to the real current index rather than showing a stale one.
 */
export function setInstrumentIndex(app, detail) {
    const requested = Math.round(Number(detail && detail.value));
    if (Number.isFinite(requested)) {
        song.setCurrentInstrumentIndex(Math.max(1, Math.min(song.getMaxInstruments(), requested)));
    }
    resetSampleSelection();
    publishInstrumentFields(app);
    if (app && app.log) app.log("instrument-index.set", { [STATE_FIELDS.instrumentIndex]: song.getCurrentInstrumentIndex() });
}

/** Ported from sampleView.js's own `instrumentName.onChange` (71-77). */
export function setInstrumentName(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument) return;
    instrument.name = String(detail && detail.value !== undefined ? detail.value : "");
    // Spec 071: the song-properties section's own instrument listbox shows
    // this same name - an ordinary door-to-door call, not a new exception
    // (this module already reaches domain/song's own public surface for
    // everything else it touches).
    song.publishInstrumentRows(app);
    if (app && app.log) app.log("instrument-name.set", { [STATE_FIELDS.instrumentName]: instrument.name });
}

/** Ported from sampleView.js's own `volumeSlider.onChange` (262). */
export function setVolume(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const value = Math.max(0, Math.min(64, Math.round(Number(detail && detail.value)) || 0));
    instrument.sample.volume = value;
    publish(app, STATE_FIELDS.volume, value);
    if (app && app.log) app.log("sample-volume.set", { [STATE_FIELDS.volume]: value });
}

/** Ported from sampleView.js's own `loopEnabledCheckbox.onToggle` (526-533). */
export function toggleLoopEnabled(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    const current = Boolean(instrument.sample.loop.enabled);
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    instrument.sample.loop.enabled = next;
    publish(app, STATE_FIELDS.loopEnabled, next);
    if (app && app.log) app.log("loop-enabled.toggle", { [STATE_FIELDS.loopEnabled]: next });
}

/** Ported from sampleView.js's own `repeatSpinbox.onChange` (274-285): clamped against the sample's own current length, not this spinBox's own static authored max. */
export function setLoopStart(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    let value = Math.max(0, Math.round(Number(detail && detail.value)) || 0);
    const length = instrument.sample.length || 0;
    if (value + instrument.sample.loop.length > length) value = Math.max(0, length - instrument.sample.loop.length);
    instrument.sample.loop.start = value;
    publish(app, STATE_FIELDS.loopStart, value);
    if (app && app.log) app.log("loop-start.set", { [STATE_FIELDS.loopStart]: value });
}

/** Ported from sampleView.js's own `repeatLengthSpinbox.onChange` (288-301). */
export function setLoopLength(app, detail) {
    const instrument = song.getCurrentInstrument();
    if (!instrument || !instrument.sample) return;
    let value = Math.max(0, Math.round(Number(detail && detail.value)) || 0);
    const length = instrument.sample.length || 0;
    if (instrument.sample.loop.start + value > length) value = Math.max(0, length - instrument.sample.loop.start);
    instrument.sample.loop.length = value;
    publish(app, STATE_FIELDS.loopLength, value);
    if (app && app.log) app.log("loop-length.set", { [STATE_FIELDS.loopLength]: value });
}

/** Every button below is zero-argument and already exists above; this just gives each its own `(app, detail)` capability shape and republishes the fields an operation can invalidate (trim's own length change, in particular). */
function withOperation(app, command, run) {
    const changed = run() !== false;
    if (changed) publishInstrumentFields(app);
    if (app && app.log) app.log(command, { changed });
    return changed;
}

export function normalizeSample(app) { return withOperation(app, "sample.normalize", () => adjustVolume("max")); }
export function fadeInSample(app) { return withOperation(app, "sample.fade-in", () => adjustVolume("fadein")); }
export function fadeOutSample(app) { return withOperation(app, "sample.fade-out", () => adjustVolume("fadeout")); }
export function trimSample(app) { return withOperation(app, "sample.trim", () => trim()); }
export function reverseSample(app) { return withOperation(app, "sample.reverse", () => reverse()); }
export function invertSample(app) { return withOperation(app, "sample.invert", () => invert()); }

// --- the loop creator's own menu bar and screen wiring (spec 045) ----------

const LOOP_PRESET_LABELS = ["Select", "Fade in Head", "Fade out Tail", "Cross Fade"];

/**
 * Which of the sample-edit panel's own mutually-exclusive sub-views is
 * showing: `""` (normal), `"loop-creator"` or `"resample"` (spec 046). One
 * shared field, not one boolean per sub-view - `visibleWhen` (spec 025)
 * only ever reads a single field per node, so two independent boolean
 * fields could not mutually exclude a third sub-view once spec 046 added
 * one. This renames spec 045's own `loop-creator.mode` (which only ever
 * needed to distinguish two states) - see spec 046's own requirements.md
 * "Found while doing it" note.
 */
function setSampleEditView(app, view) {
    if (app && app.state) app.state.set("sample-edit-view.value", view);
}

/**
 * The "Create Loop" button's own capability - opens spec 043's own session
 * for the current instrument and switches the sample-editor panel to show
 * it. Distinct from `loopCreator.js`'s own `openLoopCreator(instrument)`,
 * which this wraps - see that module's own header comment on this naming
 * precedent (spec 043 already does the same for `setLoopStart`/
 * `setLoopLength`).
 */
export function openLoopCreator(app) {
    const opened = loopCreator.openLoopCreator(song.getCurrentInstrument());
    if (opened) setSampleEditView(app, "loop-creator");
    if (app && app.log) app.log("loop-creator.open", { opened });
    return opened;
}

export function saveLoopCreator(app) {
    const saved = loopCreator.saveLoopCreator();
    setSampleEditView(app, "");
    if (app && app.log) app.log("loop-creator.save", { saved });
    return saved;
}

export function cancelLoopCreator(app) {
    const cancelled = loopCreator.cancelLoopCreator();
    setSampleEditView(app, "");
    if (app && app.log) app.log("loop-creator.cancel", { cancelled });
    return cancelled;
}

export function toggleSnapToZero(app, detail) {
    const current = loopCreator.getLoopCreatorState().snapToZero;
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    loopCreator.setSnapToZero(next);
    if (app && app.state) app.state.set("snap-to-zero.active", next);
    if (app && app.log) app.log("snap-to-zero.toggle", { next });
    return next;
}

export function setLoopPreset(app, detail) {
    const index = LOOP_PRESET_LABELS.indexOf(detail && detail.value);
    if (index < 0) return false;
    return loopCreator.applyLoopPreset(index);
}

// --- the resample panel (spec 046) -----------------------------------------

function publishResampleFields(app) {
    const state = resample.getResampleState();
    publish(app, "resample-source-rate.value", Math.round(state.sourceRate));
    publish(app, "resample-source-size.value", state.sourceBytes);
    publish(app, "resample-target-index.value", state.targetIndex);
    publish(app, "resample-target-note.value", resample.getTargetNoteName());
    publish(app, "resample-target-rate.value", Math.round(resample.getTargetRate()));
    publish(app, "resample-target-size.value", Math.round(state.sourceBytes * resample.getTargetRate() / state.sourceRate));
}

/** The "Resample" button's own capability - opens spec 046's own session for the current instrument. */
export function openResample(app) {
    const opened = resample.openResample(song.getCurrentInstrument());
    if (opened) {
        setSampleEditView(app, "resample");
        publishResampleFields(app);
    }
    if (app && app.log) app.log("resample.open", { opened });
    return opened;
}

/** Ported from resamplePanel.js's own onKeyDown target - driven by an authored spinBox instead (see requirements.md). */
export function setResampleTargetIndex(app, detail) {
    resample.setTargetIndex(detail && detail.value);
    publishResampleFields(app);
    if (app && app.log) app.log("resample-target-index.set", { value: resample.getResampleState().targetIndex });
}

export function toggleResampleInterpolate(app, detail) {
    const current = app && app.state ? Boolean(app.state.get("resample-interpolate.active")) : false;
    const next = detail && typeof detail.value === "boolean" ? detail.value : !current;
    if (app && app.state) app.state.set("resample-interpolate.active", next);
    if (app && app.log) app.log("resample-interpolate.toggle", { next });
    return next;
}

/** Reads the interpolate checkbox's own current value from the store, since nothing else in this module tracks it separately (see design.md). */
export function saveResample(app) {
    const interpolate = Boolean(app && app.state && app.state.get("resample-interpolate.active"));
    const saved = resample.applyResample(interpolate);
    setSampleEditView(app, "");
    if (saved) publishInstrumentFields(app); // the loop bounds resample scales are the same fields spec 042 already publishes
    if (app && app.log) app.log("resample.save", { saved });
    return saved;
}

export function cancelResample(app) {
    resample.closeResample();
    setSampleEditView(app, "");
    if (app && app.log) app.log("resample.cancel", {});
    return true;
}
