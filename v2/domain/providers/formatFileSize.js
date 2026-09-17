// Ported verbatim from script/src/lib/util.js#formatFileSize (spec 034):
// a byte count in v1's own two-unit, no-decimal-then-one-decimal shape,
// used by modArchive.js/modulesPl.js for a listing item's `info` text.

export function formatFileSize(size) {
    let unit = "k";
    if (isNaN(size)) size = 0;
    size = Math.round(size / 1000);
    if (size > 1000) {
        size = Math.round(size / 100) / 10;
        unit = "MB";
    }
    return size + unit;
}
