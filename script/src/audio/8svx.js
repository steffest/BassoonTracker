export function read8SVXsample(file,sample){
	// format description on http://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice

	console.log("reading 8SVX sample");

	var oneShotHiSamples = 0;
	var repeatHiSamples = 0;

	// IFF file
	function readChunk(){
		var chunk = {};
		chunk.name = file.readString(4);
		chunk.size = file.readDWord();
		return chunk;
	}

	file.litteEndian = false;
	file.goto(12);

	// look for BODY chunk
	var chunk = readChunk();
	while (chunk.name != "BODY" && !file.isEOF(10)){

		if (chunk.name == "VHDR"){
			oneShotHiSamples = file.readDWord();
			repeatHiSamples  = file.readDWord();
			file.jump(chunk.size - 8); // skip samplesPerHiCycle, samplesPerSec, ctOctave, sCompression, volume
		} else if (chunk.name == "NAME"){
			sample.name = file.readString(chunk.size);
		} else {
			file.jump(chunk.size);
		}

		// IFF chunks are padded to even byte boundaries
		if (chunk.size & 1) file.jump(1);

		chunk = readChunk();
	}

	if (chunk.name == "BODY"){
		for (var j = 0; j < chunk.size; j++){
			var b = file.readByte();
			sample.data.push(b / 128);
		}

		if (repeatHiSamples > 2){
			sample.loop.start   = oneShotHiSamples;
			sample.loop.length  = repeatHiSamples;
			sample.loop.enabled = true;
			sample.loop.type    = 1; // FORWARD
		}
	}
}