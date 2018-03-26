var ProTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER);


		var song = {
			patterns:[]
		};

		var patternLength = 64;
		var sampleCount = 31;
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
		for (i = 1; i <= sampleCount; ++i) {
			var sampleName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var sample = {
				name: sampleName,
				data: []
			};

			sample.length = sample.realLen = sampleLength << 1;
			sample.finetune = file.readUbyte();
			if (sample.finetune>7) sample.finetune -= 16;
			sample.volume   = file.readUbyte();
			sample.loopStart     = file.readWord() << 1;
			sample.loopRepeatLength   = file.readWord() << 1;

			sample.pointer = sampleDataOffset;
			sampleDataOffset += sample.length;
			Tracker.setSample(i,sample);

		}
		song.samples = Tracker.getSamples();

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
					trackStep.sample = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					trackStep.param  = trackStepInfo & 0xff;

					row.push(trackStep);
				}

				// fill with empty data for other channels
				// TODO: not needed anymore ?
				for (channel = channelCount; channel < Tracker.getTrackCount(); channel++){
					row.push({note:0,effect:0,sample:0,param:0});
				}


				patternData.push(row);
			}
			song.patterns.push(patternData);

			//file.jump(1024);
		}

		var sampleContainer = [];

		for(i=1; i <= sampleCount; i++) {
			sample = Tracker.getSample(i);
			if (sample){
				console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + " bytes and repeat length of " + sample.loopRepeatLength);
				//this.samples[i] = ds.readInt8Array(this.inst[i].sampleLength*2);

				var sampleEnd = sample.length;

				if (sample.loopRepeatLength>2 && SETTINGS.unrollShortLoops && sample.loopRepeatLength<1000){
					// cut off trailing bytes for short looping samples
					sampleEnd = Math.min(sampleEnd,sample.loopStart + sample.loopRepeatLength);
					sample.length = sampleEnd;
				}

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					sample.data.push(b / 127)
				}

				// unroll short loops?
				// web audio loop start/end is in seconds
				// doesn't work that well with tiny loops

				if ((SETTINGS.unrollShortLoops || SETTINGS.unrollLoops) && sample.loopRepeatLength>2){
					// TODO: pingpong and reverse loops in XM files? -> unroll once and append the reversed loop

					var loopCount = Math.ceil(40000 / sample.loopRepeatLength) + 1;

					if (!SETTINGS.unrollLoops) loopCount = 0;

					var resetLoopNumbers = false;
					var loopLength = 0;
					if (SETTINGS.unrollShortLoops && sample.loopRepeatLength<1600){

						loopCount = Math.floor(1000/sample.loopRepeatLength);
						resetLoopNumbers = true;
					}

					for (var l=0;l<loopCount;l++){
						var start = sample.loopStart;
						var end = start + sample.loopRepeatLength;
						for (j=start; j<end; j++){
							sample.data.push(sample.data[j]);
						}
						loopLength += sample.loopRepeatLength;
					}

					if (resetLoopNumbers && loopLength){
						sample.loopRepeatLength += loopLength;
						sample.length += loopLength;
					}
				}

				sampleContainer.push({label: i + " " + sample.name, data: i});
			}
		}
		if (UI) UI.mainPanel.setInstruments(sampleContainer);

		return song;
	};

	return me;
};