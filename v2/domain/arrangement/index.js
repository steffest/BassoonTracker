// The multitrack arrangement view's engine (spec 051), opening package P11
// (the remaining specialized surfaces) of the port roadmap.
//
// Ported from script/src/ui/app/components/multitrack.js (per-track block/
// effect segmentation, 639-802) and script/src/ui/app/components/
// dawtrack.js + trackControl.js (the mute/solo interaction rule, which v1
// itself keeps three independent, locally-mirrored copies of - this module
// is the single owner instead, matching requirements.md's own recorded
// consolidation decision).
//
// Like domain/sampleEditor/{loopCreator,resample}.js, this module never
// imports domain/playback/engine/ directly - it reaches pattern/instrument
// data only through domain/song/index.js's own public surface, and engine
// math only through domain/playback/index.js's own public surface.

import * as song from "../song/index.js";
import {
    getFineTuneForNote,
    getFineTuneForPeriod,
    getFtNotePeriod,
    getSampleRateForPeriod,
    getTickTiming,
    emulatesProtracker1OffsetBug,
    usesLinearFrequency,
    setTrackVolumes,
    getTrackScopeData as playbackTrackScopeData
} from "../playback/index.js";

const trackMute = [];
const trackSolo = [];

function applyVolumes() {
    setTrackVolumes(trackMute, trackSolo);
}

export function getTrackMuteSolo(track) {
    return { mute: !!trackMute[track], solo: !!trackSolo[track] };
}

/**
 * Ported from dawtrack.js's muteButton.onClick (138-144). No cascade to
 * other tracks - a known, deliberately preserved v1 quirk (requirements.md
 * ARR-006): muting a currently-soloed track clears only its own solo flag,
 * since v1's own trigger call for this button never passes `wasSolo`.
 */
export function setTrackMute(track, muted) {
    trackMute[track] = !!muted;
    if (trackMute[track]) trackSolo[track] = false;
    applyVolumes();
}

/**
 * Ported from dawtrack.js's soloButton.onClick (130-137) plus the shared
 * trackStateChange handler's own solo/wasSolo cascade (v1's audio.js:
 * 149-163): soloing a track mutes every other track; un-soloing restores
 * every other track's mute flag.
 */
export function setTrackSolo(track, soloed) {
    const wasSolo = !!trackSolo[track];
    trackSolo[track] = !!soloed;
    if (trackSolo[track]) trackMute[track] = false;

    const trackCount = song.getTrackCount();
    if (trackSolo[track]) {
        for (let i = 0; i < trackCount; i++) {
            if (i !== track) { trackMute[i] = true; trackSolo[i] = false; }
        }
    } else if (wasSolo) {
        for (let i = 0; i < trackCount; i++) {
            if (i !== track) { trackMute[i] = false; trackSolo[i] = false; }
        }
    }
    applyVolumes();
}

export function toggleTrackMute(track) {
    setTrackMute(track, !trackMute[track]);
    return !!trackMute[track];
}

export function toggleTrackSolo(track) {
    setTrackSolo(track, !trackSolo[track]);
    return !!trackSolo[track];
}

/** Forwards to domain/song's own undoable mutation - see that module's own moveNote for the shape. */
export function moveNote(srcTrack, srcStep, dstTrack, dstStep) {
    return song.moveNote(srcTrack, srcStep, dstTrack, dstStep);
}

/** Forwards to domain/playback's own live audio-analysis mechanism (spec 052) - the leaf's own live oscilloscope. */
export function getTrackScopeData(track, target) {
    return playbackTrackScopeData(track, target);
}

/**
 * Ported from multitrack.js#_getSampleLengthInSteps (756-802): how many
 * pattern steps a note's own sample plays for before running out, or null
 * when it cannot be estimated (no instrument, no data, an enabled loop -
 * loops play indefinitely - or an unresolvable period). `sampleOffsetBytes`
 * is the running 9xx-effect offset already carried forward by the caller.
 */
function getSampleLengthInSteps(note, instrumentIndex, sampleOffsetBytes) {
    if (!note || !instrumentIndex) return null;
    const instrument = song.getInstrumentAt(instrumentIndex);
    if (!instrument) return null;

    let sample = instrument.sample;
    if (song.inFTMode() && note.index && instrument.samples && instrument.sampleNumberForNotes) {
        const sampleIdx = instrument.sampleNumberForNotes[note.index - 1];
        if (typeof sampleIdx === "number" && instrument.samples[sampleIdx]) sample = instrument.samples[sampleIdx];
    }
    if (!sample || !sample.data || !sample.data.length) return null;
    if (sample.loop && sample.loop.enabled && sample.loop.length > 2) return null;

    let period = note.period || 0;
    let noteIndex = note.index || 0;
    if (song.inFTMode()) {
        if (!noteIndex || noteIndex === 97) return null;
        if (sample.relativeNote) noteIndex += sample.relativeNote;
        if (usesLinearFrequency()) {
            period = 7680 - (noteIndex - 1) * 64;
            if (instrument.getFineTune) period -= instrument.getFineTune() / 2;
        } else {
            const ftPeriod = getFtNotePeriod(noteIndex);
            if (ftPeriod === null) return null;
            period = ftPeriod;
            if (instrument.getFineTune) period = getFineTuneForNote(noteIndex, instrument.getFineTune());
        }
    } else {
        if (!period) return null;
        if (instrument.getFineTune) period = getFineTuneForPeriod(period, instrument.getFineTune());
    }
    if (period <= 0) return null;

    const sampleRate = getSampleRateForPeriod(period);
    if (!sampleRate || sampleRate <= 0) return null;

    const { ticksPerStep, tickTime } = getTickTiming();
    const stepDuration = ticksPerStep * tickTime;
    if (!stepDuration || stepDuration <= 0) return null;

    let sampleLength = sample.data.length;
    if (typeof sampleOffsetBytes === "number" && sampleOffsetBytes > 0) {
        sampleLength = Math.max(1, sampleLength - Math.min(sampleOffsetBytes, sampleLength - 1));
    }

    return Math.max(1, Math.ceil(sampleLength / sampleRate / stepDuration));
}

/** Ported from multitrack.js#_buildPerTrackBlocks (639-729). `pattern` is a pattern index, not implicitly always the current one - domain/song#getPattern's own already-parameterized shape. */
export function getPerTrackBlocks(pattern) {
    const patternData = song.getPattern(pattern);
    if (!patternData) return [];

    const trackCount = song.getTrackCount();
    const result = [];
    for (let t = 0; t < trackCount; t++) result[t] = [];
    const steps = patternData.length;
    const offsetBugEnabled = emulatesProtracker1OffsetBug();

    for (let track = 0; track < trackCount; track++) {
        let pending = null;
        let currentVolume = 100;
        let currentInstrumentIndex = 0;
        let offsetCache = null;

        const pushPending = (endStep) => {
            if (!pending) return;
            let targetEnd = endStep;
            if (typeof pending.maxLengthSteps === "number") {
                targetEnd = Math.min(targetEnd, pending.startStep + pending.maxLengthSteps);
            }
            pending.endStep = Math.max(pending.startStep + 1, targetEnd);
            delete pending.maxLengthSteps;
            result[track].push(pending);
            pending = null;
        };

        for (let step = 0; step < steps; step++) {
            const note = patternData[step] && patternData[step][track];
            const hasNote = note && (note.period || note.index);
            let currentStepOffsetBytes = null;

            const rowInstrumentIndex = (note && note.instrument && note.instrument > 0) ? note.instrument : currentInstrumentIndex;

            if (offsetBugEnabled && hasNote && note && note.effect !== 9 && rowInstrumentIndex && offsetCache && offsetCache.instrument === rowInstrumentIndex) {
                currentStepOffsetBytes = offsetCache.value || 0;
            }

            if (note && note.effect === 9) {
                const stepOffset = (note.param || 0) << 8;
                let offsetValue = stepOffset || (offsetCache ? offsetCache.stepValue || offsetCache.value || 0 : 0);

                if (offsetBugEnabled && !note.instrument && offsetCache) {
                    offsetValue += offsetCache.value || 0;
                }
                currentStepOffsetBytes = offsetValue;
                offsetCache = offsetCache || {};
                offsetCache.value = offsetValue;
                offsetCache.stepValue = stepOffset;
                if (offsetBugEnabled) {
                    if (note.instrument) offsetCache.instrument = note.instrument;
                    if (hasNote) offsetCache.value += stepOffset;
                }
            }

            if (note && typeof note.instrument === "number" && note.instrument > 0) currentInstrumentIndex = note.instrument;
            if (note && note.effect === 12) currentVolume = (note.param || 0) * 100 / 64;
            if (song.inFTMode() && note && note.volumeEffect > 15 && note.volumeEffect <= 80) {
                currentVolume = (note.volumeEffect - 16) * 100 / 64;
            }
            currentVolume = Math.max(0, Math.min(100, currentVolume));

            if (hasNote) {
                pushPending(step);
                let noteVolume = currentVolume;
                const instrumentIndex = (note.instrument && note.instrument > 0) ? note.instrument : currentInstrumentIndex;
                if (instrumentIndex) {
                    const instrument = song.getInstrumentAt(instrumentIndex);
                    if (instrument && instrument.sample) noteVolume = instrument.sample.volume * 100 / 64;
                    if (note.effect === 12) noteVolume = (note.param || 0) * 100 / 64;
                    if (song.inFTMode() && note.volumeEffect > 15 && note.volumeEffect <= 80) {
                        noteVolume = (note.volumeEffect - 16) * 100 / 64;
                    }
                }
                noteVolume = Math.max(0, Math.min(100, noteVolume));
                currentVolume = noteVolume;

                pending = {
                    startStep: step,
                    endStep: steps,
                    instrument: instrumentIndex,
                    name: song.getRawNoteName(note),
                    volume: noteVolume,
                    maxLengthSteps: getSampleLengthInSteps(note, instrumentIndex, currentStepOffsetBytes)
                };
            }
        }
        pushPending(steps);
    }
    return result;
}

/** Ported from multitrack.js#_buildPerTrackEffects (731-747) - pure, no engine math. */
export function getPerTrackEffects(pattern) {
    const patternData = song.getPattern(pattern);
    if (!patternData) return [];
    const trackCount = song.getTrackCount();
    const result = [];
    for (let t = 0; t < trackCount; t++) result[t] = [];
    const steps = patternData.length;
    for (let track = 0; track < trackCount; track++) {
        for (let step = 0; step < steps; step++) {
            const note = patternData[step] && patternData[step][track];
            if (note && (note.effect || note.param)) {
                result[track].push({ step, effect: note.effect || 0, param: note.param || 0 });
            }
        }
    }
    return result;
}
