function readRIFFsample(file,sample,next){
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

    if (wave.bits === 8){
        sample.length = wave.dataChuckSize;
        for (var i = 0; i<sample.length; i++){
            var b = file.readUbyte();
            b=b-128;
            sample.data.push(b / 128)
        }
    }else{
        // let Audio Content do the decoding
        decodeFileWithAudioContext(file,sample,next);
    }

}


function encodeRIFFsample(sampleData,bits){

	var length = sampleData.length;

	var sampleRate = 8000; // how can we know this from raw samples?
	var byteRate = sampleRate;

	if (bits === 16){
        length = sampleData.length * 2;
        byteRate = sampleRate * 2;
	}

	var chunkLength = length;
	if (chunkLength%2 === 1) chunkLength++;

    var buffer = new ArrayBuffer(46 + chunkLength);
	var file = new BinaryStream(buffer,false);
    file.goto(0);

    /* RIFF identifier */
	file.writeString('RIFF');

    /* RIFF chunk length */
	file.writeDWord(38 + chunkLength);

    /* RIFF type */
    file.writeString('WAVE');

    /* format chunk identifier */
    file.writeString('fmt ');

    /* format chunk length */
    file.writeDWord(18);

    /* sample format (PCM) */
    file.writeWord(1);

    /* channel count */
    file.writeWord(1);

    /* sample rate */
    file.writeDWord(sampleRate);

    /* byte rate (sample rate * block align) */
    file.writeDWord(byteRate);

    /* block align (channel count * bytes per sample) */
    file.writeWord(Math.floor(bits/8));

    /* bits per sample */
    file.writeWord(bits);

	/* padding (optional, most wave writers seem to prefer this) */
	file.writeWord(0);

    /* data chunk identifier */
    file.writeString('data');

    /* data chunk length */
    file.writeDWord(length);

    if (bits === 16){
        for (var i = 0; i<sampleData.length; i++){
            file.writeWord((sampleData[i]*32767));
        }
    }else{
        for (var i = 0; i<sampleData.length; i++){
            file.writeUByte(Math.round(sampleData[i]*127) + 127);
        }
	}

	// pad byte
	if (length<chunkLength) file.writeUByte(0);

    return file;

}