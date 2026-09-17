// Favorites (spec 033): a second, independent localStorage key
// ("favorites"), a plain array of {url, title}. Ported from
// script/src/models/favorites.js, minus its EventBus wiring - no control
// dispatches a favorite-toggle command yet (no heart icon is authored in
// the current YAML), so there is nothing to map in capabilities.js today.
// toggleFavorite() takes (url, title) directly rather than reading
// Tracker.getCurrentUrl()/getSong() itself, so this module stays headless
// and has no dependency on domain/playback - the capability wiring that
// reads "the current song" belongs to a later, disk-operation-screen spec.

import { createStorage } from "./storage.js";

const FAVORITES_KEY = "favorites";

// script/src/models/favorites.js#getPlaylist's own three-line placeholder, verbatim.
const EMPTY_LINES = ["No favorites yet...", "Press the heart icon", "to add one!"];

function load(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(FAVORITES_KEY));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function isFavorite(url, storage = createStorage()) {
    return load(storage).some(item => item.url === url);
}

/** Adds `{url, title}` if not already a favorite, otherwise removes it. Returns the new list. */
export function toggleFavorite(url, title, storage = createStorage()) {
    const favorites = load(storage);
    const next = isFavorite(url, storage)
        ? favorites.filter(item => item.url !== url)
        : [...favorites, { url, title: title || url.split("/").pop() }];
    storage.setItem(FAVORITES_KEY, JSON.stringify(next));
    return next;
}

/** A playlist-shaped view (script/src/filesystem.js's own `/favorites.pls` special case), with v1's exact empty-state placeholder. */
export function getPlaylist(storage = createStorage()) {
    const modules = load(storage);
    return {
        title: "Favorites",
        icon: "icons/fav.png",
        modules: modules.length ? modules : EMPTY_LINES.map(title => ({ title }))
    };
}
