// A write-only binary cursor over an ArrayBuffer (spec 037), ported from the
// write half of script/src/filesystem.js's own BinaryStream (57-218). New v2
// code, not a divergence of domain/playback/engine/filesystem.js's read-only
// port (spec 012): that folder's own "byte-identical, three divergences,
// nothing else" rule is about player/src, which never wrote anything, so
// there is nothing there to diverge from.
//
// Big-endian by default (MOD's own multi-byte fields, matching
// `new BinaryStream(arrayBuffer, true)`'s "bigEndian" flag in v1);
// `createBinaryWriter(arrayBuffer, false)` (spec 038, XM/XI's own
// little-endian fields) matches that same constructor's `false` case -
// the identical two-value flag v1's own BinaryStream already has, not a
// second, new concept.

export function createBinaryWriter(arrayBuffer, bigEndian = true) {
    const dataView = new DataView(arrayBuffer);
    const length = arrayBuffer.byteLength;
    const littleEndian = !bigEndian;
    let index = 0;

    // Ported verbatim from filesystem.js's own setIndex: 0 is a real
    // position, any other falsy value keeps the current index, and both
    // ends are clamped into range.
    function setIndex(value) {
        value = value === 0 ? value : value || index;
        if (value < 0) value = 0;
        if (value >= length) value = length - 1;
        index = value;
    }

    const writer = {
        get index() { return index; },
        get buffer() { return arrayBuffer; },

        goto(value) { setIndex(value); },
        jump(value) { setIndex(index + value); },

        writeByte(value, position) {
            setIndex(position);
            dataView.setInt8(index, value);
            index++;
        },
        writeUByte(value, position) {
            setIndex(position);
            dataView.setUint8(index, value);
            index++;
        },
        writeUint(value, position) {
            setIndex(position);
            dataView.setUint32(index, value, littleEndian);
            index += 4;
        },
        writeWord(value, position) {
            setIndex(position);
            dataView.setUint16(index, value, littleEndian);
            index += 2;
        },
        writeString(value, position) {
            setIndex(position);
            for (let i = 0; i < value.length; i++) dataView.setUint8(index + i, value.charCodeAt(i));
            index += value.length;
        },
        fill(value, count) {
            value = value || 0;
            count = count || 0;
            for (let i = 0; i < count; i++) writer.writeByte(value);
        },
        clear(count) {
            writer.fill(0, count);
        },
        writeStringSection(value, max, padValue, position) {
            setIndex(position);
            max = max || 1;
            value = value || "";
            if (value.length > max) value = value.substr(0, max);
            writer.writeString(value);
            writer.fill(padValue, max - value.length);
        },
        isEOF(margin) {
            margin = margin || 0;
            return index >= length - margin;
        }
    };

    // Ported aliases, matching filesystem.js's own `readLong = readDWord = readUint`.
    writer.writeLong = writer.writeDWord = writer.writeUint;

    return writer;
}
