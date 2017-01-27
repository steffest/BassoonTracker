function readRAWsample(file,sample){
	file.goto(0);
	for (var j = 0; j<sample.length; j++){
		var b = file.readByte();
		sample.data.push(b / 127)
	}
}