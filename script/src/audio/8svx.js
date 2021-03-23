function read8SVXsample(file,sample){
	// format description on http://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice

	console.error("reading 8SVX sample");

	// IFF file
	function readChuck(){
		var chunk = {};
		chunk.name = file.readString(4);
		chunk.size = file.readDWord();
		return chunk;
	}

	file.litteEndian = false;
	file.goto(12);

	// look for BODY chunck
	var chunk = readChuck();
	while (chunk.name != "BODY" && !file.isEOF(10)){

		if (chunk.name == "NAME"){
			sample.name = file.readString(chunk.size);
		}else{
			file.jump(chunk.size);

			// TODO: should we read the header to find loop repeat points?
			// can't seem to find an example file that uses that.
		}
		chunk = readChuck();
	}

	if (chunk.name == "BODY"){
		for (var j = 0; j<chunk.size; j++){
			var b = file.readByte();
			sample.data.push(b / 127)
		}
	}
}