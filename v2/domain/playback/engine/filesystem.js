export function BinaryStream(arrayBuffer, bigEndian){
    var obj = {
        index: 0,
        litteEndian : !bigEndian
    };

    obj.goto = function(value){
        setIndex(value);
    };

    obj.jump = function(value){
        this.goto(this.index + value);
    };

    obj.readByte = function(position){
        setIndex(position);
        var b = this.dataView.getInt8(this.index);
        this.index++;
        return b;
    };

    obj.readUbyte = function(position){
        setIndex(position);
        var b = this.dataView.getUint8(this.index);
        this.index++;
        return b;
    };

    obj.readUint = function(position){
        setIndex(position);
        var i = this.dataView.getUint32(this.index,this.litteEndian);
        this.index+=4;
        return i;
    };

    obj.readBytes = function(len,position,buffer) {
        setIndex(position);
        if (!buffer) buffer = new Uint8Array(len);
        var i = this.index;
        var offset = 0;
        for (; offset < len; offset++) buffer[offset] = this.dataView.getInt8(i+offset);

        this.index += len;
        return buffer;
    };

    obj.readString = function(len,position){
        setIndex(position);
        var i = this.index;
        var src = this.dataView;
        var text = "";

        if ((len += i) > this.length) len = this.length;

        for (; i < len; ++i){
            var c = src.getUint8(i);
            if (c == 0) break;
            text += String.fromCharCode(c);
        }

        this.index = len;
        return text;
    };

    // same as readUshort
    obj.readWord = function(position){
        setIndex(position);
        var w = this.dataView.getUint16(this.index, this.litteEndian);
        this.index += 2;
        return w;
    };

    obj.readLong = obj.readDWord = obj.readUint;

    obj.readShort = function(value,position){
        setIndex(position);
        var w = this.dataView.getInt16(this.index, this.litteEndian);
        this.index += 2;
        return w;
    };

    obj.isEOF = function(margin){
        margin = margin || 0;
        return this.index >= (this.length-margin);
    };

    obj.toString = function(){
        return new TextDecoder().decode(arrayBuffer);
    };

    function setIndex(value){
        value = value === 0 ? value : value || obj.index;
        if (value<0) value = 0;
        if (value >= obj.length) value = obj.length-1;

        obj.index = value;
    }

    if (arrayBuffer) {
        obj.buffer = arrayBuffer;
        obj.dataView = new DataView(arrayBuffer);
        obj.length = arrayBuffer.byteLength;
    }

    return obj;
}