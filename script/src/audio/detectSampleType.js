function detectSampleType(file,sample,next){

	// detects the sample type of a binary stream
	// if sample is given it also reads and decodes it into sample.data

	// let's assume it's a 8-bit raw audio file like found on the amiga ST disks by default
	var sampleType = SAMPLETYPE.RAW_8BIT;
	var decoder = readRAWsample;

	file.goto(0);
	var id = file.readString(4);

	if (id == "RIFF"){
		sampleType = SAMPLETYPE.WAVE_PCM;
		decoder = readRIFFsample;
	}

	if (id == "FORM"){
		file.goto(8);
		var subId = file.readString(4);
		if (subId == "8SVX"){
			sampleType = SAMPLETYPE.IFF_8SVX;
			decoder = read8SVXsample;
		}
	}

	// if the file ends with, .mp3 , let's just assume it is ...
	if (sample && sample.name && sample.name.toLowerCase().slice(-4) == ".mp3"){
		sampleType = SAMPLETYPE.MP3;
		decoder = decodeFileWithAudioContext;
	}

	if (sample && decoder){
		decoder(file,sample,next);
	}else{
		if (next){
			next(sampleType)
		}else{
			return sampleType;
		}
	}
}

function decodeFileWithAudioContext(file,sample,next){
	Audio.context.decodeAudioData(
			file.buffer,
			function(buffer) {
				if (!buffer) {
					alert('error decoding file data: ' + url);
					return;
				}
				// todo: show dialog for stereo samples ?
				sample.data = buffer.getChannelData(0);
				if (sample.data && !sample.data.concat){
					// typed arrays don't have the concat method
					sample.data = Array.from(sample.data);
				}
				sample.length = buffer.length;
				if (next) next();
			},
			function(error) {
				console.error('decodeAudioData error', error);
				if (next) next();
			}
	);
}