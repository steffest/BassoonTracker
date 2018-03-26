var SoundTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER);

		var song = {
			patterns:[]
		};

		var patternLength = 64;
		var sampleCount = 15;


		//see https://www.aes.id.au/modformat.html
		// and ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt for differences

		song.typeId = "ST";
		song.channels = 4;
		song.title = file.readString(20,0);

		var sampleDataOffset = 0;
		for (i = 1; i <= sampleCount; ++i) {
			var sampleName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var sample = {
				name: sampleName,
				data: []
			};

			sample.length = sample.realLen = sampleLength << 1;
			sample.volume   = file.readWord();
			// NOTE: does the high byte of the volume someties contain finetune data?
			sample.finetune = 0;
			sample.loopStart     = file.readWord(); // in bytes!
			sample.loopRepeatLength   = file.readWord() << 1;

			// if a sample contains a loops, only the loop part is played
			// TODO

			sample.pointer = sampleDataOffset;
			sampleDataOffset += sample.length;
			Tracker.setSample(i,sample);

		}
		song.samples = Tracker.getSamples();

		file.goto(470);

		song.length = file.readUbyte();
		song.speed = file.readUbyte();

		var patternTable = [];
		var highestPattern = 0;
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = file.readUbyte();
			if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
		}
		song.patternTable = patternTable;

		file.goto(600);

		// pattern data

		for (i = 0; i <= highestPattern; ++i) {

			var patternData = [];

			for (var step = 0; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < 4; channel++){
					var trackStep = {};
					var trackStepInfo = file.readUint();

					trackStep.period = (trackStepInfo >> 16) & 0x0fff;
					trackStep.effect = (trackStepInfo >>  8) & 0x0f;
					trackStep.sample = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					trackStep.param  = trackStepInfo & 0xff;

					row.push(trackStep);
				}

				// fill with empty data for other channels
				for (channel = 4; channel < Tracker.getTrackCount(); channel++){
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

				if (sample.loopRepeatLength>2 ){
					// cut off trailing bytes for short looping samples
					//sampleEnd = Math.min(sampleEnd,sample.loopStart + sample.loopRepeatLength);
					//sample.length = sampleEnd;
				}

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					sample.data.push(b / 127)
				}

				sampleContainer.push({label: i + " " + sample.name, data: i});
			}
		}
		UI.mainPanel.setInstruments(sampleContainer);

		return song;
	};

	return me;
};