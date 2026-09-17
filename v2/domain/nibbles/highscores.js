// Nibbles' own high-score table (spec 047), mirroring domain/settings/
// favorites.js's exact shape (spec 033): a small, independent localStorage
// key, a plain array, defensive JSON parsing with a hand-authored fallback.
// Keeps v1's own storage key ("nibblesHighscore") verbatim, so an existing
// user's saved scores carry over - ported from
// script/plugins/games/nibbles/nibbles.js:57-75.
//
// The name-entry dialog (host.UI.showDialog, a raw v1-only modal API with
// no v2 equivalent) and the table's own visual rendering are screen
// territory - a later spec's own. This module only answers "does this
// score qualify, and at what rank" and "insert this entry."

import { createStorage } from "../settings/storage.js";

const HIGHSCORE_KEY = "nibblesHighscore";
const MAX_ENTRIES = 10;

// nibbles.js:57-68, verbatim.
const DEFAULT_TABLE = [
    { name: "Vogue", score: 2000000, level: 26 },
    { name: "Mr. H", score: 2000000, level: 27 },
    { name: "Steffest", score: 1000000, level: 28 },
    { name: "LizardKing", score: 100000, level: 12 },
    { name: "Jogeir", score: 90000, level: 11 },
    { name: "Dr. Awesome", score: 80000, level: 8 },
    { name: "4mat", score: 70000, level: 7 },
    { name: "Romeo Knight", score: 60000, level: 5 },
    { name: "HoffMan", score: 5000, level: 2 },
    { name: "Aceman", score: 4000, level: 1 }
];

function load(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(HIGHSCORE_KEY));
        return Array.isArray(parsed) ? parsed : DEFAULT_TABLE;
    } catch {
        return DEFAULT_TABLE;
    }
}

export function getHighScores(storage = createStorage()) {
    return load(storage);
}

/**
 * Ported from nibbles.js#checkHighScore's own lookup (190-191), with one
 * fix: v1 guards with `index>0`, which silently refuses to ever record a
 * new *first-place* score (index 0) - a real, easily-confirmed v1 bug (no
 * comment or test anywhere suggests it is deliberate), not reproduced here.
 * @returns {number} the qualifying index (0-based, insert-before position),
 *   or -1 when the score does not beat any entry in the table.
 */
export function qualifies(score, storage = createStorage()) {
    return load(storage).findIndex(item => item.score < score);
}

/** Ported from nibbles.js's own splice/pop pair (196-197). No-op if `qualifies()` would return -1 for this score. */
export function insertHighScore(name, score, level, storage = createStorage()) {
    const table = load(storage);
    const index = qualifies(score, storage);
    if (index === -1) return table;
    const next = table.slice();
    next.splice(index, 0, { name, score, level });
    if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
    storage.setItem(HIGHSCORE_KEY, JSON.stringify(next));
    return next;
}
