// Ported from script/src/models/note.js's own Note.duplicate()/populate() —
// as free functions rather than methods, because the v2 engine's own
// domain/playback/engine/models/note.js (copied from player/src, the
// playback-only subset) never carried these two, and that boundary's
// "byte-identical, three documented divergences" invariant is not this
// spec's to extend with a fourth. See domain/song/README.md.

/** A plain-data snapshot of a note's six fields, independent of the live object. */
export function duplicateNote(note) {
    return {
        instrument: note.instrument || 0,
        period: note.period || 0,
        effect: note.effect || 0,
        param: note.param || 0,
        volumeEffect: note.volumeEffect || 0,
        note: note.index || 0
    };
}

/** Writes a duplicateNote()-shaped snapshot back onto a live note object. */
export function populateNote(note, data) {
    data = data || {};
    note.instrument = data.instrument || 0;
    note.period = data.period || 0;
    note.effect = data.effect || 0;
    note.param = data.param || 0;
    note.volumeEffect = data.volumeEffect || 0;
    note.index = data.note || data.index || 0;
}

/** What duplicateNote() reports for a cell that was empty (no Note instance yet). */
export const EMPTY_NOTE_DATA = Object.freeze({
    instrument: 0, period: 0, effect: 0, param: 0, volumeEffect: 0, note: 0
});
