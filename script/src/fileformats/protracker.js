var ProTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER,true);
        Tracker.useLinearFrequency = false;
        Tracker.clearInstruments(31);

		var song = {
			patterns:[],
			restartPosition: 1
		};

		var patternLength = 64;
		var instrumentCount = 31;
		var channelCount = 4;


		//see https://www.aes.id.au/modformat.html

		song.typeId = file.readString(4,1080);
		song.title = file.readString(20,0);

		if (song.typeId === "2CHN") channelCount = 2;
		if (song.typeId === "6CHN") channelCount = 6;
		if (song.typeId === "8CHN") channelCount = 8;
		if (song.typeId === "10CH") channelCount = 10;
		if (song.typeId === "12CH") channelCount = 12;
		if (song.typeId === "14CH") channelCount = 14;
		if (song.typeId === "16CH") channelCount = 16;
		if (song.typeId === "18CH") channelCount = 18;
		if (song.typeId === "20CH") channelCount = 20;
		if (song.typeId === "22CH") channelCount = 22;
		if (song.typeId === "24CH") channelCount = 24;
		if (song.typeId === "26CH") channelCount = 26;
		if (song.typeId === "28CH") channelCount = 28;
		if (song.typeId === "30CH") channelCount = 30;
		if (song.typeId === "32CH") channelCount = 32;

		song.channels = channelCount;

		var sampleDataOffset = 0;
		for (i = 1; i <= instrumentCount; ++i) {
			var instrumentName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var instrument = Instrument();
			instrument.name = instrumentName;

			instrument.sample.length = instrument.sample.realLen = sampleLength << 1;
			var finetune = file.readUbyte();
			if (finetune>16) finetune = finetune%16;
			if (finetune>7) finetune -= 16;
			instrument.setFineTune(finetune);
			instrument.sample.volume   = file.readUbyte();
			instrument.sample.loop.start    = file.readWord() << 1;
			instrument.sample.loop.length   = file.readWord() << 1;

			instrument.sample.loop.enabled = instrument.sample.loop.length>2;
			instrument.sample.loop.type = LOOPTYPE.FORWARD;

			instrument.pointer = sampleDataOffset;
			sampleDataOffset += instrument.sample.length;
			instrument.setSampleIndex(0);
			Tracker.setInstrument(i,instrument);

			
		}
		song.instruments = Tracker.getInstruments();


		file.goto(950);
		song.length = file.readUbyte();
		file.jump(1); // 127 byte

		var patternTable = [];
		var highestPattern = 0;
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = file.readUbyte();
			if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
		}
		song.patternTable = patternTable;

		file.goto(1084);

		// pattern data

		for (i = 0; i <= highestPattern; ++i) {

			var patternData = [];

			for (var step = 0; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < channelCount; channel++){
					var note = Note();
					var trackStepInfo = file.readUint();

					note.setPeriod((trackStepInfo >> 16) & 0x0fff);
					note.effect = (trackStepInfo >>  8) & 0x0f;
					note.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					note.param  = trackStepInfo & 0xff;

					row.push(note);
				}

				// fill with empty data for other channels
				// TODO: not needed anymore ?
				for (channel = channelCount; channel < Tracker.getTrackCount(); channel++){
					row.push(Note())
				}


				patternData.push(row);
			}
			song.patterns.push(patternData);

			//file.jump(1024);
		}

		var instrumentContainer = [];

		for(i=1; i <= instrumentCount; i++) {
			instrument = Tracker.getInstrument(i);
			if (instrument){
				console.log(
					"Reading sample from 0x" + file.index + " with length of " + instrument.sample.length + " bytes and repeat length of " + instrument.sample.loop.length);


				var sampleEnd = instrument.sample.length;

				if (instrument.sample.loop.length>2 && SETTINGS.unrollShortLoops && instrument.sample.loop.length<1000){
					// cut off trailing bytes for short looping samples
					sampleEnd = Math.min(sampleEnd,instrument.sample.loop.start + instrument.sample.loop.length);
					instrument.sample.length = sampleEnd;
				}

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					instrument.sample.data.push(b / 127)
				}

				// unroll short loops?
				// web audio loop start/end is in seconds
				// doesn't work that well with tiny loops

				if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && instrument.sample.loop.length>2){

					var loopCount = Math.ceil(40000 / instrument.sample.loop.length) + 1;

					if (!SETTINGS.unrollLoops) loopCount = 0;

					var resetLoopNumbers = false;
					var loopLength = 0;
					if (SETTINGS.unrollShortLoops && instrument.sample.loop.length<1600){

						loopCount = Math.floor(1000/instrument.sample.loop.length);
						resetLoopNumbers = true;
					}

					for (var l=0;l<loopCount;l++){
						var start = instrument.sample.loop.start;
						var end = start + instrument.sample.loop.length;
						for (j=start; j<end; j++){
							instrument.sample.data.push(instrument.sample.data[j]);
						}
						loopLength += instrument.sample.loop.length;
					}

					if (resetLoopNumbers && loopLength){
						instrument.sample.loop.length += loopLength;
						instrument.sample.length += loopLength;
					}
				}

				instrumentContainer.push({label: i + " " + instrument.name, data: i});
			}
		}
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);

		return song;
	};

	//<!--
	me.write = function(next){

		var song = Tracker.getSong();
		var instruments = Tracker.getInstruments();
		var trackCount = Tracker.getTrackCount();
		var patternLength = Tracker.getPatternLength();

		// get filesize

		var fileSize = 20 + (31*30) + 1 + 1 + 128 + 4;

		var highestPattern = 0;
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			highestPattern = Math.max(highestPattern,p);
		}

		fileSize += ((highestPattern+1)* (trackCount * 256));

		if (Tracker.getInstruments().length>32){
			UI.showDialog("WARNING !!!//This file has more than 31 instruments.//Only the first 31 instruments will be included.");
		}
		var startI = 1;
		var endI = 31;
		var i;

		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument){
				// reset to first sample in case we come from a XM file
				instrument.setSampleIndex(0);
				fileSize += instrument.sample.length;
			}else{
				// +4 ?
			}
		}

		var arrayBuffer = new ArrayBuffer(fileSize);
		var file = new BinaryStream(arrayBuffer,true);

		// write title
		file.writeStringSection(song.title,20);

		// write instrument data
		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument){
				// limit instrument size to 128k
				//TODO: show a warning when this is exceeded ...
				instrument.sample.length = Math.min(instrument.sample.length, 131070); // = FFFF * 2

				file.writeStringSection(instrument.name,22);
				file.writeWord(instrument.sample.length >> 1);
				file.writeUByte(instrument.sample.finetune);
				file.writeUByte(instrument.sample.volume);
				file.writeWord(instrument.sample.loop.start >> 1);
				file.writeWord(instrument.sample.loop.length >> 1);
			}else{
				file.clear(30);
			}
		}


		file.writeUByte(song.length);
		file.writeUByte(127);

		// patternPos
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			file.writeUByte(p);
		}

		file.writeString( trackCount == 8 ? "8CHN" : "M.K.");

		// pattern Data

		for (i=0;i<=highestPattern;i++){

			var patternData = song.patterns[i];

			// TODO - should be patternLength of pattern;
			for (var step = 0; step<patternLength; step++){
				var row = patternData[step];
				for (var channel = 0; channel < trackCount; channel++){
					if (row){
						var trackStep = row[channel];
						var uIndex = 0;
						var lIndex = trackStep.instrument;

						if (lIndex>15){
							uIndex = 16; // TODO: Why is this 16 and not 1 ? Nobody wanted 255 instruments instead of 31 ?
							lIndex = trackStep.instrument - 16;
						}

						var v = (uIndex << 24) + (trackStep.period << 16) + (lIndex << 12) + (trackStep.effect << 8) + trackStep.param;
						file.writeUint(v);
					}else{
						file.writeUint(0);
					}

				}
			}
		}

		// sampleData;
		for (i = startI;i<=endI;i++){
			var instrument = instruments[i];
			if (instrument && instrument.sample.data && instrument.sample.length){
				// should we put repeat info here?
				//file.clear(2);
				var d;
				// instrument length is in word
				for (var j = 0; j < instrument.sample.length; j++){
					d = instrument.sample.data[j] || 0;
					file.writeByte(Math.round(d*127));
				}
				console.log("write instrument with " + instrument.sample.length + " length");
			}else{
				// still write 4 bytes?
			}
		}


		if (next) next(file);
	};
	//-->

	return me;
};