// A pure, dependency-free formatter (spec 071), split out of domain/song/
// index.js the same way keyboardNotes.js already is - so a display helper
// with no state of its own does not bloat the one file everything else in
// this domain imports.

/** Ported from script/src/lib/util.js:16-21 verbatim. */
export function formatInstrumentIndex(index) {
    // hex digits 1-F are a single character while 10+ take two, so pad the
    // single-character ones with a trailing space to keep names aligned
    let hex = index.toString(16).toUpperCase();
    if (hex.length === 1) hex += " ";
    return hex;
}
