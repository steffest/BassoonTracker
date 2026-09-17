import { test } from "node:test";
import assert from "node:assert/strict";
import { getHighScores, qualifies, insertHighScore } from "../domain/nibbles/highscores.js";
import { createFakeStorage } from "./helpers/fakeStorage.js";

// Spec 047: mirrors tests/favorites.test.js's own convention.

test("a fresh (never-stored) table is v1's own ten seed entries", () => {
    const table = getHighScores(createFakeStorage());
    assert.equal(table.length, 10);
    assert.equal(table[0].name, "Vogue");
    assert.equal(table[table.length - 1].name, "Aceman");
});

test("a corrupt stored blob falls back to the seed table", () => {
    const table = getHighScores(createFakeStorage({ nibblesHighscore: "{not json" }));
    assert.equal(table.length, 10);
    assert.equal(table[0].name, "Vogue");
});

test("qualifies finds the correct rank, including rank 0 - a real v1 bug (index>0) not reproduced here", () => {
    const storage = createFakeStorage();
    assert.equal(qualifies(3000000, storage), 0, "beats even the very best score");
    assert.equal(qualifies(50000, storage), 8);
    assert.equal(qualifies(1, storage), -1, "beats nothing");
});

test("insertHighScore shifts lower entries down and drops the last, keeping the table at ten", () => {
    const storage = createFakeStorage();
    const before = getHighScores(storage);
    const next = insertHighScore("Tester", 3000000, 15, storage);

    assert.equal(next.length, 10);
    assert.deepEqual(next[0], { name: "Tester", score: 3000000, level: 15 });
    assert.deepEqual(next[1], before[0], "the old #1 shifted down to #2");
    assert.deepEqual(next[9], before[8], "the old #9 shifted down to #10");
    // the old #10 (Aceman) fell off the end entirely
    assert.ok(!next.some(item => item.name === "Aceman"));
});

test("insertHighScore is a no-op when the score does not qualify", () => {
    const storage = createFakeStorage();
    const before = getHighScores(storage);
    const next = insertHighScore("Tester", 1, 1, storage);
    assert.deepEqual(next, before);
});

test("insertHighScore actually persists - a second read sees the new entry", () => {
    const storage = createFakeStorage();
    insertHighScore("Tester", 3000000, 15, storage);
    assert.equal(getHighScores(storage)[0].name, "Tester");
});
