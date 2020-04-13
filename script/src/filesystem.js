function loadFile(url,next) {
    var req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function (event) {
        var arrayBuffer = req.response;
        if (arrayBuffer && req.status === 200) {
            if (next) next(arrayBuffer);
        } else {
            console.error("unable to load", url);
            // do not call if player only
            if (typeof Editor !== "undefined") {
              if (next) next(false);
            }
        }
    };
    req.send(null);
}

function saveFile(b,filename){
	//<!--
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    url = window.URL.createObjectURL(b);
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
	//-->
}

function BinaryStream(arrayBuffer, bigEndian){
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

	obj.writeByte = function(value,position){
		setIndex(position);
		this.dataView.setInt8(this.index,value);
		this.index++;
	};

	obj.readUbyte = function(position){
		setIndex(position);
		var b = this.dataView.getUint8(this.index);
		this.index++;
		return b;
	};

	obj.writeUByte = function(value,position){
		setIndex(position);
		this.dataView.setUint8(this.index,value);
		this.index++;
	};

	obj.readUint = function(position){
		setIndex(position);
		var i = this.dataView.getUint32(this.index,this.litteEndian);
		this.index+=4;
		return i;
	};

	obj.writeUint = function(value,position){
		setIndex(position);
		this.dataView.setUint32(this.index,value,this.litteEndian);
		this.index+=4;
	};

	obj.readBytes = function(len,position) {
		setIndex(position);
		var buffer = new Uint8Array(len);
		var i = this.index;
		var src = this.dataView;
		if ((len += i) > this.length) len = this.length;
		var offset = 0;

		for (; i < len; ++i)
			buffer.setUint8(offset++, this.dataView.getUint8(i));
		this.index = len;
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

	obj.writeString = function(value,position){
		setIndex(position);
		var src = this.dataView;
		var len = value.length;
		for (var i = 0; i < len; i++) src.setUint8(this.index + i,value.charCodeAt(i));
		this.index += len;
	};

	obj.writeStringSection = function(value,max,paddValue,position){
		setIndex(position);
		max = max || 1;
		value = value || "";
		paddValue = paddValue || 0;
		var len = value.length;
		if (len>max) value = value.substr(0,max);
		obj.writeString(value);
		obj.fill(paddValue,max-len);
	};

	// same as readUshort
	obj.readWord = function(position){
		setIndex(position);
		var w = this.dataView.getUint16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.writeWord = function(value,position){
		setIndex(position);
		this.dataView.setUint16(this.index,value,this.litteEndian);
		this.index += 2;
	};

	obj.readLong = obj.readDWord = obj.readUint;
	obj.writeLong = obj.writeDWord = obj.writeUint;

	obj.readShort = function(value,position){
		setIndex(position);
		var w = this.dataView.getInt16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.clear = function(length){
		obj.fill(0,length);
	};

	obj.fill = function(value,length){
		value = value || 0;
		length = length || 0;
		for (var i = 0; i<length; i++){
			obj.writeByte(value);
		}
	};

	obj.isEOF = function(margin){
		margin = margin || 0;
		return this.index >= (this.length-margin);
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
