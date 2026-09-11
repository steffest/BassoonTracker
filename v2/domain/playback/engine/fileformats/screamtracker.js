import Tracker from "../tracker.js";
import {EVENT, LOOPTYPE, TRACKERMODE} from "../enum.js";
import Note from "../models/note.js";
import Instrument from "../models/instrument.js";
import Sample from "../models/sample.js";
import EventBus from "../eventBus.js";

var ScreamTracker = function(){
	var me = {};

	me.load = function(file,name){

		console.log("loading ScreamTracker");
		Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER,true);
		Tracker.useLinearFrequency = false;
		Tracker.clearInstruments(1);

		file.litteEndian = true;

		var mod = {};
		var song = {
			patterns:[],
			instruments:[]
		};

		file.goto(0);
		song.title = file.readString(28);
		mod.magic1 = file.readUbyte();
		mod.fileType = file.readUbyte();
		file.jump(2);
		mod.songlength = file.readWord();
		mod.numberOfInstruments = file.readWord();
		mod.numberOfPatterns = file.readWord();
		mod.flags = file.readWord();
		mod.trackerVersion = file.readWord();
		mod.sampleFormat = file.readWord();
		mod.typeId = file.readString(4);
		mod.globalVolume = file.readUbyte();
		mod.defaultTempo = file.readUbyte();
		mod.defaultBPM = file.readUbyte();
		mod.masterVolume = file.readUbyte();
		mod.ultraClickRemoval = file.readUbyte();
		mod.defaultPanning = file.readUbyte();
		file.jump(8);
		mod.special = file.readWord();

		song.typeId = "SCRM";
		song.sourceType = "S3M";

		var channelMap = [];
		var channelSettings = [];
		var channels = [];
		for (var i = 0; i<32; i++){
			var channelSetting = file.readUbyte();
			channelSettings.push(channelSetting);
			if (channelSetting < 128){
				var channelType = channelSetting & 127;
				channelMap[i] = channels.length;
				channels.push({
					source: i,
					type: channelType,
					panning: channelType < 8 ? 3 : 12
				});
			}
		}

		var orders = [];
		for (i = 0; i<mod.songlength; i++) orders.push(file.readUbyte());

		var instrumentPointers = [];
		for (i = 0; i<mod.numberOfInstruments; i++) instrumentPointers.push(file.readWord() * 16);

		var patternPointers = [];
		for (i = 0; i<mod.numberOfPatterns; i++) patternPointers.push(file.readWord() * 16);

		var sampleLengthModes = getSampleLengthModes(file,instrumentPointers);

		if (mod.defaultPanning === 252){
			for (i = 0; i<32; i++){
				var panning = file.readUbyte();
				if (channelMap[i] !== undefined && panning & 32){
					channels[channelMap[i]].panning = panning & 15;
				}
			}
		}

		var patternTable = [];
		var highestPattern = 0;
		orders.forEach(function(order){
			if (order === 255) return;
			if (order === 254) return;
			patternTable.push(order);
			if (highestPattern < order) highestPattern = order;
		});

		song.patternTable = patternTable;
		song.length = patternTable.length;
		song.channels = channels.length || 1;
		song.restartPosition = 1;
		song.channelSettings = channelSettings;
		song.channelMap = channelMap;
		song.channelPanning = channels.map(function(channel){return channel.panning});

		for (i = 0; i<mod.numberOfPatterns; i++){
			song.patterns.push(readPattern(file,patternPointers[i],channelMap,song.channels));
		}

		var instrumentContainer = [];

		for (i = 1; i<=mod.numberOfInstruments; i++){
			var instrument = readInstrument(file,instrumentPointers[i-1],mod.sampleFormat,sampleLengthModes[i-1]);
			Tracker.setInstrument(i,instrument);
			instrumentContainer.push({label: i + " " + instrument.name, data: i});
		}

		EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
		song.instruments = Tracker.getInstruments();

		if (mod.defaultTempo && mod.defaultTempo !== 255) Tracker.setAmigaSpeed(mod.defaultTempo);
		if (mod.defaultBPM >= 33) Tracker.setBPM(mod.defaultBPM);

		return song;
	};

	function readPattern(file,offset,channelMap,channelCount){
		var patternData = [];

		for (var step = 0; step<64; step++) patternData.push(getEmptyRow(channelCount));
		if (!offset) return patternData;

		file.goto(offset);
		var packedSize = file.readWord();
		var end = offset + packedSize;
		var rowIndex = 0;

		while (file.index < end && rowIndex < 64){
			var what = file.readUbyte();
			if (!what){
				rowIndex++;
			}else{
				var sourceChannel = what & 31;
				var targetChannel = channelMap[sourceChannel];
				var note = targetChannel === undefined ? undefined : patternData[rowIndex][targetChannel];

				if (what & 32){
					var noteValue = file.readUbyte();
					var instrument = file.readUbyte();
					if (note){
						if (noteValue < 254) note.setIndex(getNoteIndex(noteValue));
						if (noteValue === 254) note.setIndex(97);
						note.instrument = instrument;
					}
				}

				if (what & 64){
					var volume = file.readUbyte();
					if (note && volume <= 64) note.volumeEffect = volume + 16;
				}

				if (what & 128){
					var effectType = file.readUbyte();
					var effectParam = file.readUbyte();
					if (note) {
						var effect = mapEffect(effectType,effectParam);
						note.effect = effect.effect;
						note.param = effect.param;
					}
				}
			}
		}

		return patternData;
	}

	function getSampleLengthModes(file,instrumentPointers){
		var result = [];
		var headers = [];
		var oldIndex = file.index;

		for (var i = 0; i<instrumentPointers.length; i++){
			var offset = instrumentPointers[i];
			if (!offset) continue;

			file.goto(offset);
			var type = file.readUbyte();
			if (type !== 1) continue;

			file.jump(12);
			var memSegHi = file.readUbyte();
			var memSegLo = file.readWord();
			var sampleOffset = ((memSegHi << 16) | memSegLo) * 16;
			var length = file.readDWord();
			file.jump(8);
			file.jump(2);
			var packType = file.readUbyte();
			var flags = file.readUbyte();

			if (!packType && sampleOffset && length){
				headers.push({
					index: i,
					offset: sampleOffset,
					length: length,
					bits: (flags & 4) ? 16 : 8
				});
			}
		}

		headers.sort(function(a,b){return a.offset - b.offset;});
		for (i = 0; i<headers.length; i++){
			var header = headers[i];
			if (header.bits !== 16){
				result[header.index] = "bytes";
				continue;
			}

			var nextOffset = file.length;
			for (var j = i + 1; j<headers.length; j++){
				if (headers[j].offset > header.offset){
					nextOffset = headers[j].offset;
					break;
				}
			}

			var available = Math.max(0,nextOffset - header.offset);
			var byteDistance = Math.abs(available - header.length);
			var sampleDistance = Math.abs(available - (header.length * 2));
			result[header.index] = sampleDistance < byteDistance ? "samples" : "bytes";
		}

		file.goto(oldIndex);
		return result;
	}

	function readInstrument(file,offset,sampleFormat,sampleLengthMode){
		var instrument = Instrument();
		instrument.samples = [];
		instrument.sampleNumberForNotes = [];
		for (var i = 0; i<96; i++) instrument.sampleNumberForNotes.push(0);

		var sample = Sample();
		instrument.samples.push(sample);
		instrument.sample = sample;

		if (!offset){
			instrument.setSampleIndex(0);
			return instrument;
		}

		file.goto(offset);
		var type = file.readUbyte();
		instrument.s3mType = type;
		instrument.filename = file.readString(12);

		if (type === 1){
			var memSegHi = file.readUbyte();
			var memSegLo = file.readWord();
			var sampleOffset = ((memSegHi << 16) | memSegLo) * 16;
			var sampleLength = file.readDWord();
			var loopStart = file.readDWord();
			var loopEnd = file.readDWord();
			sample.volume = file.readUbyte();
			file.jump(1);
			var packType = file.readUbyte();
			var flags = file.readUbyte();
			sample.c2spd = file.readDWord() || 8363;
			file.jump(12);
			sample.name = file.readString(28);
			instrument.name = sample.name || instrument.filename;
			instrument.magic = file.readString(4);

			sample.bits = (flags & 4) ? 16 : 8;
			sample.isStereo = !!(flags & 2);
			sample.isPacked = !!packType;
			sample.length = sampleLength;
			sample.loop.start = loopStart;
			sample.loop.length = Math.max(0,loopEnd - loopStart);
			sample.loop.enabled = !!(flags & 1) && sample.loop.length > 2;
			sample.loop.type = LOOPTYPE.FORWARD;

			if (sample.bits === 16 && sampleLengthMode !== "samples"){
				sample.length = sample.length >> 1;
				sample.loop.start = sample.loop.start >> 1;
				sample.loop.length = sample.loop.length >> 1;
			}

			if (sample.isPacked){
				console.warn("Packed S3M samples are not supported: " + instrument.name);
				sample.length = 0;
			}else{
				if (sample.isStereo) console.warn("S3M stereo samples are imported as mono: " + instrument.name);
				readSampleData(file,sampleOffset,sample,sampleFormat);
			}

		}else{
			if (type >= 2){
				file.jump(3);
				var opl = [];
				for (var oi = 0; oi<12; oi++) opl.push(file.readUbyte());
				sample.volume = file.readUbyte();
				instrument.adlibDsk = file.readUbyte();
				file.jump(2);
				sample.c2spd = file.readDWord() || 8363;
				file.jump(12);
				instrument.name = file.readString(28) || instrument.filename;
				instrument.magic = file.readString(4);
				instrument.type = "synth";
				instrument.synth = getAdlibPatch(opl,sample.volume,sample.c2spd);
				if (type > 2) console.warn("S3M AdLib percussion instruments are approximated as melodic synths: " + instrument.name);
			}else{
				file.jump(35);
				instrument.name = file.readString(28) || instrument.filename;
				instrument.magic = file.readString(4);
			}
		}

		instrument.setSampleIndex(0);
		return instrument;
	}

	function getAdlibPatch(opl,volume,c2spd){
		return {
			type: "adlib",
			volume: volume,
			c2spd: c2spd,
			opl: opl,
			adlib: {
				modulatorFlags: opl[0],
				carrierFlags: opl[1],
				modulatorMultiple: opl[0] & 15,
				carrierMultiple: opl[1] & 15,
				modulatorLevel: opl[2] & 63,
				carrierLevel: opl[3] & 63,
				modulatorAttack: opl[4] >> 4,
				modulatorDecay: opl[4] & 15,
				carrierAttack: opl[5] >> 4,
				carrierDecay: opl[5] & 15,
				modulatorSustain: opl[6] >> 4,
				modulatorRelease: opl[6] & 15,
				carrierSustain: opl[7] >> 4,
				carrierRelease: opl[7] & 15,
				modulatorWaveform: opl[8] & 7,
				carrierWaveform: opl[9] & 7,
				feedback: (opl[10] >> 1) & 7,
				connection: opl[10] & 1
			}
		};
	}

	function readSampleData(file,offset,sample,sampleFormat){
		if (!sample.length || !offset) return;

		file.goto(offset);
		var signed = sampleFormat === 1;
		var length = sample.length;

		if (sample.bits === 16){
			for (var i = 0; i<length; i++){
				var w = signed ? file.readShort() : file.readWord() - 32768;
				sample.data.push(w / 32768);
			}
		}else{
			for (i = 0; i<length; i++){
				var b = signed ? file.readByte() : file.readUbyte() - 128;
				sample.data.push(b / 128);
			}
		}
	}

	function getEmptyRow(channelCount){
		var row = [];
		for (var i = 0; i<channelCount; i++) row.push(Note());
		return row;
	}

	function getNoteIndex(value){
		var octave = value >> 4;
		var note = value & 15;
		if (note > 11) return 0;
		return (octave * 12) + note + 1;
	}

	function mapEffect(type,param){
		var effect = {
			effect: 0,
			param: param
		};

		switch(type){
			case 1: // Axx - speed
				effect.effect = 15;
				break;
			case 2: // Bxx - position jump
				effect.effect = 11;
				break;
			case 3: // Cxx - pattern break
				effect.effect = 13;
				break;
			case 4: // Dxy - volume slide
				effect.effect = 10;
				break;
			case 5: // Exx - slide down
				effect.effect = 2;
				break;
			case 6: // Fxx - slide up
				effect.effect = 1;
				break;
			case 7: // Gxx - tone portamento
				effect.effect = 3;
				break;
			case 8: // Hxy - vibrato
				effect.effect = 4;
				break;
			case 9: // Ixy - tremor
				effect.effect = 29;
				break;
			case 10: // Jxy - arpeggio
				effect.effect = 0;
				break;
			case 11: // Kxy - vibrato + volume slide
				effect.effect = 6;
				break;
			case 12: // Lxy - portamento + volume slide
				effect.effect = 5;
				break;
			case 15: // Oxx - sample offset
				effect.effect = 9;
				break;
			case 17: // Qxy - retrigger
				effect.effect = 27;
				break;
			case 18: // Rxy - tremolo
				effect.effect = 7;
				break;
			case 19: // Sxy - special
				effect = mapSpecialEffect(param);
				break;
			case 20: // Txx - tempo
				effect.effect = 15;
				break;
			case 21: // Uxy - fine vibrato
				effect.effect = 4;
				break;
			case 22: // Vxx - global volume
				effect.effect = 16;
				break;
			default:
				if (type) console.warn("Unhandled S3M effect: " + type.toString(16) + " param " + param.toString(16));
				break;
		}

		return effect;
	}

	function mapSpecialEffect(param){
		var x = param >> 4;
		var y = param & 15;
		var effect = {
			effect: 14,
			param: param
		};

		switch(x){
			case 1: // S1x - glissando
				effect.param = 0x30 + y;
				break;
			case 2: // S2x - finetune
				effect.param = 0x50 + y;
				break;
			case 3: // S3x - vibrato waveform
				effect.param = 0x40 + y;
				break;
			case 4: // S4x - tremolo waveform
				effect.param = 0x70 + y;
				break;
			case 8: // S8x - panning
				effect.effect = 8;
				effect.param = y * 17;
				break;
			case 11: // SBx - pattern loop
				effect.param = 0x60 + y;
				break;
			case 12: // SCx - note cut
				effect.param = 0xc0 + y;
				break;
			case 13: // SDx - note delay
				effect.param = 0xd0 + y;
				break;
			case 14: // SEx - pattern delay
				effect.param = 0xe0 + y;
				break;
		}

		return effect;
	}

	return me;
};

export default ScreamTracker;
