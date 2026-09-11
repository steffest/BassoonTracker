import {EVENT, LOOPTYPE, SETTINGS, TRACKERMODE} from "../enum.js";
import Instrument from "../models/instrument.js";
import Note from "../models/note.js";
import EventBus from "../eventBus.js";
import Tracker from "../tracker.js";

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
		if (song.typeId === "3CHN") channelCount = 3;
		if (song.typeId === "5CHN") channelCount = 5;
		if (song.typeId === "6CHN") channelCount = 6;
		if (song.typeId === "7CHN") channelCount = 7;
		if (song.typeId === "8CHN") channelCount = 8;
		if (song.typeId === "9CHN") channelCount = 9;
		if (song.typeId === "10CH") channelCount = 10;
		if (song.typeId === "11CH") channelCount = 11;
		if (song.typeId === "12CH") channelCount = 12;
		if (song.typeId === "13CH") channelCount = 13;
		if (song.typeId === "14CH") channelCount = 14;
		if (song.typeId === "15CH") channelCount = 15;
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

				
				for (let j = 0; j<sampleEnd; j++){
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

export default ProTracker;