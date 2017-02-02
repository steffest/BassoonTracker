function readRIFFsample(file,sample){
	//format description: http://soundfile.sapp.org/doc/WaveFormat/
	file.litteEndian = true;
	file.goto(4);

	var wave = {};

	wave.chunkSize = file.readDWord();
	wave.format = file.readString(4); // should be "WAVE"
	wave.subChunk = file.readString(4); // should be "fmt "
	wave.subChuckSize = file.readDWord();

	var nextChunkPos = file.index + wave.subChuckSize;

	wave.audioFormat = file.readWord(); // should be 1: PCM
	wave.numberOfChannels = file.readWord();
	wave.sampleRate = file.readDWord();
	wave.byteRate = file.readDWord();
	wave.blockalign = file.readWord();
	wave.bits = file.readWord();

	file.goto(nextChunkPos);
	wave.dataChunk = file.readString(4); // should be "data"
	wave.dataChuckSize = file.readDWord();

	console.error("Wave data:" , wave);

	if (wave.bits == 8){
		sample.length = wave.dataChuckSize;
		for (var i = 0; i<sample.length; i++){
			var b = file.readUbyte();
			b=b-127;
			sample.data.push(b / 127)
		}
	}else{
		// let Audio Content do the decoding
		decodeFileWithAudioContext(file,sample);
	}

}