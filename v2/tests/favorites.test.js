import { test } from "node:test";
import assert from "node:assert/strict";
import { isFavorite, toggleFavorite, getPlaylist } from "../domain/settings/favorites.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";

test("toggling a url on then off agrees with isFavorite at each step", () => {
    const storage = createFakeStorage();
    const url = "demo/wizballalt.mod";
    assert.equal(isFavorite(url, storage), false);

    toggleFavorite(url, "Wizball", storage);
    assert.equal(isFavorite(url, storage), true);

    toggleFavorite(url, "Wizball", storage);
    assert.equal(isFavorite(url, storage), false);
});

test("toggleFavorite falls back to the url's own file name when no title is given", () => {
    const storage = createFakeStorage();
    toggleFavorite("some/path/song.mod", undefined, storage);
    assert.equal(getPlaylist(storage).modules[0].title, "song.mod");
});

test("getPlaylist returns v1's exact three-line placeholder when empty", () => {
    const playlist = getPlaylist(createFakeStorage());
    assert.equal(playlist.title, "Favorites");
    assert.deepEqual(playlist.modules.map(m => m.title), [
        "No favorites yet...",
        "Press the heart icon",
        "to add one!"
    ]);
});

test("getPlaylist returns the real list once something is favorited", () => {
    const storage = createFakeStorage();
    toggleFavorite("demo/a.mod", "A", storage);
    toggleFavorite("demo/b.mod", "B", storage);
    const playlist = getPlaylist(storage);
    assert.deepEqual(playlist.modules, [
        { url: "demo/a.mod", title: "A" },
        { url: "demo/b.mod", title: "B" }
    ]);
});

test("a corrupt favorites blob is treated as empty", () => {
    const storage = createFakeStorage({ favorites: "{not json" });
    assert.equal(isFavorite("anything", storage), false);
    assert.equal(getPlaylist(storage).modules.length, 3);
});
