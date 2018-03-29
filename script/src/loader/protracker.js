var ProTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER);


		var song = {
			patterns:[]
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
			instrument.finetune = file.readUbyte();
			if (instrument.finetune>7) instrument.finetune -= 16;
			instrument.volume   = file.readUbyte();
			instrument.loopStart     = file.readWord() << 1;
			instrument.loopRepeatLength   = file.readWord() << 1;

			instrument.pointer = sampleDataOffset;
			sampleDataOffset += instrument.sample.length;
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
					var trackStep = {};
					var trackStepInfo = file.readUint();

					trackStep.period = (trackStepInfo >> 16) & 0x0fff;
					trackStep.effect = (trackStepInfo >>  8) & 0x0f;
					trackStep.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					trackStep.param  = trackStepInfo & 0xff;

					row.push(trackStep);
				}

				// fill with empty data for other channels
				// TODO: not needed anymore ?
				for (channel = channelCount; channel < Tracker.getTrackCount(); channel++){
					row.push({note:0,effect:0,instrument:0,param:0});
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
				console.log(instrument);
				console.log(
					"Reading sample from 0x" + file.index + " with length of " + instrument.sample.length + " bytes and repeat length of " + instrument.loopRepeatLength);


				var sampleEnd = instrument.sample.length;

				if (instrument.loopRepeatLength>2 && SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1000){
					// cut off trailing bytes for short looping samples
					sampleEnd = Math.min(sampleEnd,instrument.loopStart + instrument.loopRepeatLength);
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

				if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && instrument.loopRepeatLength>2){
					// TODO: pingpong and reverse loops in XM files? -> unroll once and append the reversed loop

					var loopCount = Math.ceil(40000 / instrument.loopRepeatLength) + 1;

					if (!SETTINGS.unrollLoops) loopCount = 0;

					var resetLoopNumbers = false;
					var loopLength = 0;
					if (SETTINGS.unrollShortLoops && instrument.loopRepeatLength<1600){

						loopCount = Math.floor(1000/instrument.loopRepeatLength);
						resetLoopNumbers = true;
					}

					for (var l=0;l<loopCount;l++){
						var start = instrument.loopStart;
						var end = start + instrument.loopRepeatLength;
						for (j=start; j<end; j++){
							instrument.sample.data.push(instrument.sample.data[j]);
						}
						loopLength += instrument.loopRepeatLength;
					}

					if (resetLoopNumbers && loopLength){
						instrument.loopRepeatLength += loopLength;
						instrument.sample.length += loopLength;
					}
				}

				instrumentContainer.push({label: i + " " + instrument.name, data: i});
			}
		}
		if (UI) UI.mainPanel.setInstruments(instrumentContainer);

		return song;
	};

	return me;
};