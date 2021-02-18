var SoundTracker = function(){
	var me = {};

	me.load = function(file,name){

		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER,true);
        Tracker.useLinearFrequency = false;
		Tracker.clearInstruments(15);

		var song = {
			patterns:[],
			restartPosition: 1
		};

		var patternLength = 64;
		var instrumentCount = 15;


		//see https://www.aes.id.au/modformat.html
		// and ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt for differences

		song.typeId = "ST";
		song.channels = 4;
		song.title = file.readString(20,0);

		var sampleDataOffset = 0;
		for (i = 1; i <= instrumentCount; ++i) {
			var sampleName = file.readString(22);
			var sampleLength = file.readWord(); // in words

			var instrument = Instrument();
			instrument.name = sampleName;

			instrument.sample.length = instrument.realLen = sampleLength << 1;
			instrument.sample.volume   = file.readWord();
			// NOTE: does the high byte of the volume sometimes contain finetune data?
			instrument.setFineTune(0);
			instrument.sample.loop.start     = file.readWord(); // in bytes!
			instrument.sample.loop.length   = file.readWord() << 1;

			instrument.sample.loop.enabled = instrument.sample.loop.length>2;
			instrument.sample.loop.type = LOOPTYPE.FORWARD;

			// if an instrument contains a loops, only the loop part is played
			// TODO

			instrument.pointer = sampleDataOffset;
			sampleDataOffset += instrument.sample.length;
			instrument.setSampleIndex(0);
			Tracker.setInstrument(i,instrument);

		}
		song.instruments = Tracker.getInstruments();

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
					trackStep.instrument = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
					trackStep.param  = trackStepInfo & 0xff;

					row.push(trackStep);
				}

				// fill with empty data for other channels
				for (channel = 4; channel < Tracker.getTrackCount(); channel++){
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
				console.log("Reading sample from 0x" + file.index + " with length of " + instrument.sample.length + " bytes and repeat length of " + instrument.sample.loop.length);

				var sampleEnd = instrument.sample.length;

				for (j = 0; j<sampleEnd; j++){
					var b = file.readByte();
					// ignore first 2 bytes
					if (j<2)b=0;
					instrument.sample.data.push(b / 127)
				}

				instrumentContainer.push({label: i + " " + instrument.name, data: i});
			}
		}
        EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);

		return song;
	};

	return me;
};