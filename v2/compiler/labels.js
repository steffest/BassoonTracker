// Comma-separated label variants (spec 005 requirements: "Comma-separated
// labels represent ordered alternatives, longest/preferred first").
// Labels are never rewritten in YAML; this only derives the alternatives.

/**
 * @param {string} raw the authored label text, e.g. "instrument, instr, ins, i"
 * @returns {{ variants: string[], warnings: string[] }}
 */
export function splitLabel(raw) {
    const warnings = [];
    if (typeof raw !== "string" || raw.length === 0) {
        return { variants: [], warnings };
    }
    const parts = raw.split(",").map(part => part.trim());
    const variants = [];
    parts.forEach((part, index) => {
        if (part === "") {
            warnings.push(`empty label variant at position ${index + 1} in "${raw}"`);
            return;
        }
        variants.push(part);
    });
    return { variants, warnings };
}

/**
 * Picks the first variant that fits `maxWidth` per `measure`, falling back
 * to the shortest variant (by measured width) if none fit.
 *
 * @param {string[]} variants ordered longest/preferred first
 * @param {number} maxWidth
 * @param {(text: string) => number} measure
 */
export function pickFittingLabel(variants, maxWidth, measure) {
    if (variants.length === 0) return { text: "", fits: true, clipped: false };
    for (const variant of variants) {
        if (measure(variant) <= maxWidth) return { text: variant, fits: true, clipped: false };
    }
    let shortest = variants[0];
    for (const variant of variants) {
        if (measure(variant) < measure(shortest)) shortest = variant;
    }
    return { text: shortest, fits: false, clipped: true };
}
