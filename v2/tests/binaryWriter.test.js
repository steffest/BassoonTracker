import { test } from "node:test";
import assert from "node:assert/strict";
import { createBinaryWriter } from "../domain/moduleExport/binaryWriter.js";

function writerOf(size) {
    const buffer = new ArrayBuffer(size);
    return { file: createBinaryWriter(buffer), view: new DataView(buffer) };
}

test("writeByte/writeUByte advance the index by one and are readable back", () => {
    const { file, view } = writerOf(4);
    file.writeByte(-1);
    file.writeUByte(200);
    assert.equal(file.index, 2);
    assert.equal(view.getInt8(0), -1);
    assert.equal(view.getUint8(1), 200);
});

test("writeUint/writeWord are big-endian by default, matching MOD's own multi-byte fields", () => {
    const { file, view } = writerOf(6);
    file.writeUint(0x01020304);
    file.writeWord(0x0506);
    assert.equal(view.getUint32(0, false), 0x01020304);
    assert.equal(view.getUint16(4, false), 0x0506);
    assert.equal(file.index, 6);
});

test("createBinaryWriter(buffer, false) writes little-endian, matching XM/XI's own multi-byte fields (spec 038)", () => {
    const buffer = new ArrayBuffer(6);
    const file = createBinaryWriter(buffer, false);
    const view = new DataView(buffer);
    file.writeUint(0x01020304);
    file.writeWord(0x0506);
    assert.equal(view.getUint32(0, true), 0x01020304, "little-endian read-back matches what was written");
    assert.equal(view.getUint32(0, false), 0x04030201, "the opposite byte order from the big-endian default");
    assert.equal(view.getUint16(4, true), 0x0506);
});

test("writeString writes ASCII bytes with no terminator and advances by the string's own length", () => {
    const { file, view } = writerOf(4);
    file.writeString("M.K.");
    assert.equal(file.index, 4);
    assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), "M.K.");
});

test("fill/clear write count zero (or given) bytes and advance the index", () => {
    const { file, view } = writerOf(3);
    file.fill(5, 2);
    file.clear(1);
    assert.equal(view.getUint8(0), 5);
    assert.equal(view.getUint8(1), 5);
    assert.equal(view.getUint8(2), 0);
    assert.equal(file.index, 3);
});

test("writeStringSection truncates a too-long value and pads a too-short one", () => {
    const { file, view } = writerOf(5);
    file.writeStringSection("abcdefg", 5);
    assert.equal(file.index, 5);
    assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3), view.getUint8(4)), "abcde");

    const short = writerOf(5);
    short.file.writeStringSection("ab", 5, 0x2A);
    assert.equal(short.view.getUint8(2), 0x2A, "padded with the given pad value");
    assert.equal(short.view.getUint8(4), 0x2A);
});

test("goto/jump move the cursor explicitly, clamped into range", () => {
    const { file } = writerOf(4);
    file.goto(2);
    assert.equal(file.index, 2);
    file.jump(-1);
    assert.equal(file.index, 1);
    file.goto(100);
    assert.equal(file.index, 3, "clamped to length - 1");
    file.goto(-5);
    assert.equal(file.index, 0);
});

test("isEOF reports true once the cursor reaches the end, honoring a margin", () => {
    const { file } = writerOf(2);
    assert.equal(file.isEOF(), false);
    file.writeByte(1);
    file.writeByte(1);
    assert.equal(file.isEOF(), true);
    assert.equal(file.isEOF(5), true, "a margin never makes an already-past-the-end cursor report false");
});
