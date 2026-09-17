// Physical-key-to-note resolution (spec 031), ported from
// script/src/enum.js's KEYBOARDKEYS/OCTAVENOTES/KEYBOARDTABLE.main
// (419-505) and script/src/ui/input.js's handleNoteOn (734-772) and its
// FastTracker volume-mnemonic switch (790-806).
//
// Pure: no Tracker/Note import, like noteData.js/selection.js - testable
// with plain numbers and fake tables, never a loaded song.

/**
 * `event.code` (the physical key, not the shifted/localized character) to
 * KEYBOARDKEYS' own semitone-offset number, inlined - the enum itself is
 * not needed anywhere else, unlike OCTAVENOTES' note-name strings below.
 * 0 = OFF (note-off), 1-12 = C..B at the current octave, 13-24 = C..B one
 * octave up, 25-27 = C..D two octaves up.
 */
export const KEYBOARD_TABLE = {
    KeyZ: 1, KeyX: 3, KeyC: 5, KeyV: 6, KeyB: 8, KeyN: 10, KeyM: 12,
    Comma: 13, Period: 15,
    KeyS: 2, KeyD: 4, KeyG: 7, KeyH: 9, KeyJ: 11,
    KeyQ: 13, KeyW: 15, KeyE: 17, KeyR: 18, KeyT: 20, KeyY: 22, KeyU: 24, KeyI: 25, KeyO: 27,
    Digit2: 14, Digit3: 16, Digit5: 19, Digit6: 21, Digit7: 23, Digit9: 26,
    Backquote: 0, Backslash: 0
};

const OCTAVE_NOTE_NAMES = { 0: "OFF", 1: "C", 2: "Cs", 3: "D", 4: "Ds", 5: "E", 6: "F", 7: "Fs", 8: "G", 9: "Gs", 10: "A", 11: "As", 12: "B" };

/** @returns {number|null} the KEYBOARD_TABLE offset for `code`, or null if unmapped. */
export function keyboardNoteFor(code) {
    const value = KEYBOARD_TABLE[code];
    return typeof value === "number" ? value : null;
}

/**
 * Ported from handleNoteOn (input.js:744-772). `offset` is KEYBOARD_TABLE-
 * space (0 = OFF, 1-27 = semitones from octave*12). `tables.notePeriod` is
 * v1's NOTEPERIOD (name+octave -> {period}); `tables.ftNotes` is FTNotes
 * (index -> {period}).
 *
 * Returns null for an offset with no resolvable note at this octave/format
 * - in particular, a ProTracker-mode note-off: NOTEPERIOD has no "OFF"
 * entries at all, because the Amiga MOD format itself cannot represent a
 * note-off. That is a real format limitation, matched deliberately, not a
 * gap in this resolver.
 */
export function resolveNote(offset, octave, ftMode, tables) {
    // v1's own override (input.js:538): the OFF key's combined index is
    // forced to literal 0 regardless of octave - octave*12+0 would resolve
    // to a *different* noteIndex below and never find "OFF" at all.
    const index = offset === 0 ? 0 : octave * 12 + offset;
    const noteOctave = Math.floor((index - 1) / 12) + 1;
    const noteIndex = ((index - 1) % 12) + 1;
    const name = OCTAVE_NOTE_NAMES[noteIndex];
    if (!name) return null;
    if (ftMode) {
        if (name === "OFF") return { period: 1, index: 0 };
        const ftNote = tables.ftNotes[index];
        return ftNote ? { period: ftNote.period, index } : null;
    }
    if (name === "OFF") return null; // NOTEPERIOD has no OFF entries - MOD cannot represent a note-off
    const entry = tables.notePeriod[name + (noteOctave - 1)];
    return entry ? { period: entry.period, index: 0 } : null;
}

const FT_VOLUME_MNEMONICS = {
    "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
    "-": 5, "+": 6,
    d: 7, D: 7, u: 8, U: 8, s: 9, S: 9, v: 10, V: 10, p: 11, P: 11,
    "<": 12, ">": 13, M: 14
};

const HEX_CHAR = /^[0-9A-Fa-f]$/;
const BASE36_CHAR = /^[0-9A-Za-z]$/;

/**
 * Ported from handleNoteOn's hex/mnemonic block (input.js:781-808). `column`
 * is domain/song's own 1-based-from-note-column cursor position (never 0:
 * the note column has no hex entry, handled by resolveNote instead).
 * @returns {number|null} 0-255, or null for a character not recognized in this column right now.
 */
export function resolveColumnValue(column, key, ftMode) {
    if (ftMode && column === 3) {
        const value = FT_VOLUME_MNEMONICS[key];
        return typeof value === "number" ? value : null;
    }
    if (ftMode && column === 5) {
        return BASE36_CHAR.test(key) ? parseInt(key, 36) : null;
    }
    return HEX_CHAR.test(key) ? parseInt(key, 16) : null;
}
