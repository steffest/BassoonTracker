function loadFile(url,next) {
    var req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function (event) {
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            if (next) next(arrayBuffer);
        } else {
            console.error("unable to load", url);
            if (next) next(false);
        }
    };
    req.send(null);
}

function saveFile(b,filename){
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    url = window.URL.createObjectURL(b);
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function BinaryStream(arrayBuffer, bigEndian){
    var obj = {
        index: 0,
        litteEndian : !bigEndian
    };

    obj.goto = function(value){
        value = (value < 0) ? 0 : (value > this.length) ? this.length : value;
        this.index = value;
    };

    obj.jump = function(value){
        this.goto(this.index + value);
    };

    obj.readByte = function(position){
        this.index = position || this.index;
        var b = this.dataView.getInt8(this.index);
        this.index++;
        return b;
    };

    obj.readUbyte = function(position){
        this.index = position || this.index;
        var b = this.dataView.getUint8(this.index);
        this.index++;
        return b;
    };

    obj.readUint = function(position){
        this.index = position || this.index;
        var i = this.dataView.getUint32(this.index,this.litteEndian);
        this.index+=4;
        return i;
    };

    obj.readBytes = function(len,position) {
            var buffer = new Int8Array(len);
            var i = this.index;
            var src = this.dataView;
            if ((len += i) > this.length) len = this.length;
            var offset = 0;

            for (; i < len; ++i)
                buffer.setUint8(offset++, src.getUint8(i));
            this.index = len;
            return buffer;
        };

    obj.readString = function(len,position){
        var i = position || this.index;
        if(position === 0) i=0;
        var src = this.dataView;
        var text = "";

        if ((len += i) > this.length) len = this.length;

        for (; i < len; ++i)
            text += String.fromCharCode(src.getUint8(i));

        this.index = len;
        return text;
    };

    // same as readUshort
    obj.readWord = function(position){
        this.index = position || this.index;
        var w = this.dataView.getUint16(this.index, this.litteEndian);
        this.index += 2;
        return w;
    };

    obj.buffer = arrayBuffer;
    obj.dataView = new DataView(arrayBuffer);
    obj.length = arrayBuffer.byteLength;

    return obj;
}

/*
XMPlayer.handleDrop = function(e) {
    console.log(e);
    e.preventDefault();
    var elem = document.getElementById("playercontainer");
    elem.className = "playercontainer";
    var files = e.target.files || e.dataTransfer.files;
    if (files.length < 1) return false;
    var reader = new FileReader();
    reader.onload = function(e) {
        XMPlayer.stop();
        loadXMAndInit(e.target.result);
    };
    reader.readAsArrayBuffer(files[0]);
    return false;
};
    */