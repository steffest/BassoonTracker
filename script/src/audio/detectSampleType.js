function detectSampleType(file,sample,next){

	// detects the sample type of a binary stream
	// if sample is given it also reads and decodes it into sample.data

	// let's assume it's a 8-bit raw audio file like found on the amiga ST disks by default
	var sampleType = SAMPLETYPE.RAW_8BIT;
	var decoder = readRAWsample;
	
	// if we have original samplerate we can use WebAudio to decode most formats
	var ext = "";
	if (sample && sample.name) {
		ext = sample.name.split(".").pop().toLowerCase();
	}

	sample.info = getSamplerate(file, ext);

	switch (sample.info.type) {
		case "WAVE_PCM":
		case "RIFF":
		case "MP3":
		case "FLAC":
		case "OGG":
		case "OPUS":
			sampleType = SAMPLETYPE[sample.info.type];
			decoder = decodeFileWithAudioContext; //readRIFFsample;
			break;
		case "FORM":
			file.goto(8);
			var subId = file.readString(4);
			if (subId == "8SVX"){
				sampleType = SAMPLETYPE.IFF_8SVX;
				decoder = read8SVXsample;
			}
			break;
		default:
			console.log('Unknown sample format, expect RAW_8BIT:', sample.info)
			break;
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
	// need to use original samplerate, not the one defined in users OS/Browser
	Audio.converter = new AudioContext( {sampleRate: sample.info.sampleRate} );
	if (Audio.converter.sampleRate !== sample.info.sampleRate) {
		console.log('Could not initiate desired sampleRate of '+ sample.info.sampleRate +' instead got '+ Audio.converter.sampleRate);
	}
	Audio.converter.decodeAudioData(
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