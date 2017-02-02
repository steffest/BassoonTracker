var SAMPLETYPE = {
	RAW_8BIT:1,
	WAVE_PCM:2,
	IFF_8SVX:3,
	MP3:4
};

function detectSampleType(file,sample){

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
		decoder(file,sample);
	}else{
		return sampleType;
	}
}

function decodeFileWithAudioContext(file,sample){
	Audio.context.decodeAudioData(
			file.buffer,
			function(buffer) {
				if (!buffer) {
					alert('error decoding file data: ' + url);
					return;
				}
				// todo: show dialog for stereo samples ?
				sample.data = buffer.getChannelData(0);
				sample.length = buffer.length;
			},
			function(error) {
				console.error('decodeAudioData error', error);
			}
	);
}