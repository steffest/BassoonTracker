var Tracker = (function(){
	var me = {};

	var clock;

	var isRecording = false;
	var isPlaying = false;

	var song;
	var samples = [];

	var currentSampleIndex = 1;
	var prevSampleIndex;
	var currentPattern = 0;
	var prevPattern;
	var currentPatternPos = 0;
	var prevPatternPos;
	var currentTrack = 0;
	var currentTrackPosition = 0;
	var currentCursorPosition = 0;
	var prevCursorPosition;
	var currentPlayType = PLAYTYPE.song;
	var currentPatternData;

	var currentSongPosition = 0;

	var trackNotes = [{},{},{},{}];
	var trackEffectCache = [{},{},{},{}];

	var bpm = 125; // bmp
	var ticksPerStep = 6;
	var tickTime = 2.5/bpm;
	var tickCounter = 0;

	console.error("ticktime: " + tickTime);

	me.setCurrentSampleIndex = function(index){
		currentSampleIndex = index;
		if (prevSampleIndex!=currentSampleIndex) EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
		prevSampleIndex = currentSampleIndex;
	};

	me.getCurrentSampleIndex = function(){
		return currentSampleIndex;
	};

	me.getCurrentSample = function(){
		return samples[currentSampleIndex];
	};

	me.setCurrentPattern = function(index){
		currentPattern = index;
		currentPatternData = song.patterns[currentPattern];
		if (prevPattern!=currentPattern) EventBus.trigger(EVENT.patternChange,currentPattern);
		prevPattern = currentPattern;
	};
	me.getCurrentPattern = function(){
		return currentPattern;
	};
	me.updatePatternTable = function(index,value){
		song.patternTable[index] = value;
		EventBus.trigger(EVENT.patternTableChange,value);
		if (index == currentSongPosition) {
			prevPattern = undefined;
			Tracker.setCurrentPattern(value);
		}
	};

	me.setCurrentPatternPos = function(index){
		currentPatternPos = index;
		if (prevPatternPos!=currentPatternPos) EventBus.trigger(EVENT.patternPosChange,currentPatternPos);
		prevPatternPos = currentPatternPos;
	};
	me.getCurrentPatternPos = function(){
		return currentPatternPos;
	};
	me.moveCurrentPatternPos = function(amount){
		var newPos = currentPatternPos + amount;
		var max = 63;
		if (newPos<0) newPos = max;
		if (newPos>max) newPos = 0;
		me.setCurrentPatternPos(newPos);
	};


	me.setCurrentCursorPosition = function(index){
		currentCursorPosition = index;
		currentTrack = Math.floor(currentCursorPosition / 6);
		currentTrackPosition = currentCursorPosition % 6;
		if (prevCursorPosition!=currentCursorPosition) EventBus.trigger(EVENT.cursorPositionChange,currentCursorPosition);
		prevCursorPosition = currentTrackPosition;
	};
	me.getCurrentCursorPosition = function(){
		return currentCursorPosition;
	};
	me.moveCursorPosition = function(amount){
		var newPosition = currentCursorPosition+amount;
		var max = 4*6 - 1;
		if (newPosition > max) newPosition=0;
		if (newPosition < 0) newPosition=max;
		me.setCurrentCursorPosition(newPosition);
	};
	me.getCurrentTrack = function(){
		return currentTrack;
	};
	me.getCurrentTrackPosition = function(){
		return currentTrackPosition;
	};
	me.getCurrentSongPosition = function(){
		return currentSongPosition;
	};
	me.setCurrentSongPosition = function(position){
		currentSongPosition = position;
		EventBus.trigger(EVENT.songPositionChange,currentSongPosition);
		if (song.patternTable) me.setCurrentPattern(song.patternTable[currentSongPosition]);
	};

	me.addToPatternTable = function(index,patternIndex){
		if (typeof index == "undefined") index = song.length;
		patternIndex = patternIndex||0;

		if (index == song.length){
			song.patternTable[index] = patternIndex;
			song.length++;
		}else{
			// TODO: insert pattern;
		}

		EventBus.trigger(EVENT.songPropertyChange,song);
		EventBus.trigger(EVENT.patternTableChange);


	};

	me.removeFromPatternTable = function(index){
		if (song.length<2) return;
		if (typeof index == "undefined") index = song.length-1;

		if (index == song.length-1){
			song.patternTable[index] = 0;
			song.length--;
		}else{
			// TODO: remove pattern and shift other patterns up;
		}

		if (currentSongPosition == song.length){
			me.setCurrentSongPosition(currentSongPosition-1);
		}

		EventBus.trigger(EVENT.songPropertyChange,song);
		EventBus.trigger(EVENT.patternTableChange);


	};

	me.setPlayType = function(playType){
		currentPlayType = playType;
		EventBus.trigger(EVENT.playTypeChange,currentPlayType);
	};
	me.getPlayType = function(){
		return currentPlayType;
	};

	me.playSong = function(){
		me.stop();
		me.setPlayType(PLAYTYPE.song);
		//me.setCurrentSongPosition(0);
		isPlaying = true;
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.playPattern = function(){
		me.stop();
		currentPatternPos = 0;
		me.setPlayType(PLAYTYPE.pattern);
		isPlaying = true;
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.stop = function(){
		if (clock) clock.stop();

		for (var i = 0; i<4; i++){
			if (trackNotes[i].source){
				try{
					trackNotes[i].source.stop();
				}catch (e){

				}

			}
		}

		isPlaying = false;
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.save = function(){
		//saveFile(window.bin,"test.mod");
		var b = new Blob([window.bin], {type: "octet/stream"});
		saveAs(b,"test.mod");
	};


	function playPattern(patternIndex){
		patternIndex = patternIndex || 0;

		clock = clock || new WAAClock(Audio.context);
		clock.start();

		currentPatternData = song.patterns[patternIndex];
		var patternLength = currentPatternData.length;
		var stepResult;


		mainTimer = clock.setTimeout(function(event) {
			if (tickCounter == 0){
				var p = currentPatternPos;
				stepResult = playPatternStep(p);
				p++;

				if (p>=patternLength || stepResult.patternBreak){
					p=0;
					if (Tracker.getPlayType() == PLAYTYPE.song){
						var nextPosition = stepResult.positionBreak ? stepResult.targetPosition : ++currentSongPosition;
						me.setCurrentSongPosition(nextPosition);

					}
				}
				Tracker.setCurrentPatternPos(p);
			}
			processPatterTick();

			tickCounter++;

			if (tickCounter>=ticksPerStep) tickCounter=0;
		},0.01).repeat(tickTime).tolerance({early: 0.01})
	}

	function playPatternStep(step){
		var patternStep = currentPatternData[step];
		var tracks = patternStep.length;
		var result = {};
		var r;
		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
			r = playNote(note,i);
			if (r.patternBreak) result.patternBreak = true;
			if (r.positionBreak) {
				result.positionBreak = true;
				result.targetPosition = r.targetPosition || 0;
			}
		}
		return result;
	}

	me.playPatternStep = playPatternStep;

	function processPatterTick(){
		var tracks = 4;
		for (var track = 0; track<tracks; track++){
			var note = trackNotes[track];
			if (note){
				var effects = note.effects;
				var period;
				if (effects && Object.keys(effects).length){

					if (effects.fade){
						var volume = 0;
						if (tickCounter==0 && effects.fade.resetOnStep){
							volume = note.startVolume;
						}else{
							if (note.volume) {
								volume = (note.volume.gain.value*100) + effects.fade.value;
								if (volume<0) volume=0;
								if (volume>100) volume=100;
							}
						}

						if (trackNotes[track].volume) trackNotes[track].volume.gain.value = volume/100;
						trackNotes[track].currentVolume = volume;

					}
					if (effects.slide){
						if (tickCounter>0){
							//period slide
							period = note.currentPeriod || note.startPeriod;

							if (effects.slide.target){
								var value = Math.abs(effects.slide.value);
								if (period<effects.slide.target){
									period += value;
									if (period>effects.slide.target) period = effects.slide.target;
								}else{
									period -= value;
									if (period<effects.slide.target) period = effects.slide.target;
								}
							}else{
								period += (effects.slide.value);
							}

							trackNotes[track].currentPeriod = period;
							if (trackNotes[track].source){
								var rate = (note.startPeriod / period);
								//trackNotes[i].source.playbackRate.value = rate;

								// note: on safari the playbackrate of the buffer is already != 1 because the samplerate is fixed to the samplerate of the audio context

								trackNotes[track].source.playbackRate.value = trackNotes[track].startPlaybackRate * rate;

							}

						}
					}

					if (effects.vibrato){
						var freq = effects.vibrato.freq;
						var amp = effects.vibrato.amplitude;

						trackNotes[track].vibratoTimer = trackNotes[track].vibratoTimer||0;

						var periodChange = Math.sin(trackNotes[track].vibratoTimer * freq) * amp;

						var period = note.currentPeriod || note.startPeriod;
						period += periodChange;

						if (trackNotes[track].source){
							var rate = (note.startPeriod / period);
							trackNotes[track].source.playbackRate.value = trackNotes[track].startPlaybackRate * rate;
						}
						trackNotes[track].vibratoTimer++;

					}

					if (effects.tremolo){
						var freq = effects.tremolo.freq;
						var amp = effects.tremolo.amplitude;

						trackNotes[track].tremoloTimer = trackNotes[track].tremoloTimer||0;

						var volumeChange = Math.sin(trackNotes[track].tremoloTimer * freq) * amp;

						var _volume = note.startVolume;
						_volume += volumeChange;
						if (_volume<0) _volume=0;
						if (_volume>100) _volume=100;

						console.error(_volume);

						if (trackNotes[track].volume) trackNotes[track].volume.gain.value = _volume/100;
						trackNotes[track].currentVolume = _volume;

						trackNotes[track].tremoloTimer++;

					}

					if (effects.arpeggio){
						var step = tickCounter % 3;

						period = note.currentPeriod || note.startPeriod;
						if (step==1 && effects.arpeggio.interval1) period -= effects.arpeggio.interval1;
						if (step==2 && effects.arpeggio.interval2) period -= effects.arpeggio.interval2;


						if (trackNotes[track].source){
							var rate = (note.startPeriod / period);
							trackNotes[track].source.playbackRate.value = trackNotes[track].startPlaybackRate * rate;
						}

					}
				}else{
					// reset arpeggio if present
					period = note.currentPeriod || note.startPeriod;
					var rate = (note.startPeriod / period);
					if (rate && trackNotes[track].source) trackNotes[track].source.playbackRate.value = trackNotes[track].startPlaybackRate * rate;

				}
			}
		}
	}


	function playNote(note,track){
		var defaultVolume = 100;

		var sampleIndex = note.sample;

		if (note.period && !note.sample){
			// reuse previous Sample (and volume ?)
			sampleIndex = trackNotes[track].currentSample;
			defaultVolume = typeof trackNotes[track].currentVolume == "number" ? trackNotes[track].currentVolume : defaultVolume;
		}

		if (typeof note.sample == "number"){
			var sample = Tracker.getSample(note.sample);
			if (sample) defaultVolume = 100 * (sample.volume/64);
		}

		var notePeriod = note.period;

		var volume = defaultVolume;
		var trackEffects = {};
		var doPlayNote = true;
		var value = note.param;
		var x,y;

		var result = {};

		switch(note.effect){
			case 0:
				// Arpeggio
				if (value){
					x = value >> 4;
					y = value & 0x0f;

					var root = notePeriod || trackNotes[track].startPeriod;

					trackEffects.arpeggio = {
						root: root,
						interval1: root-Audio.getSemiToneFrom(root,x),
						interval2: root-Audio.getSemiToneFrom(root,y),
						step:1
					};
				}
				break;
			case 1:
				// Slide Up
				trackEffects.slide = {
					value: note.param * -1
				};
				break;
			case 2:
				// Slide Down
				trackEffects.slide = {
					value: note.param
				};
				break;
			case 3:
				// Slide to Note - if there's a note provided, it is not played directly,
				// but the default volume of that note will be set
				//(not really sure the volume, but stardust memories pattern 5 seems to indicate so)

				// if value == 0 then the old slide will continue

				doPlayNote = false;
				var target = note.period;

				if (target){
					trackEffectCache[track].slidePeriod = target;
				}else{
					target = trackEffectCache[track].slidePeriod  || 0
				}
				if (value){
					trackEffectCache[track].slideValue = value;
				}else{
					value = trackEffectCache[track].slideValue || 1;
				}

				trackEffects.slide = {
					value: value,
					target: target
				};
				if (note.sample){
					trackEffects.volume = {
						value: defaultVolume
					};
				}


				break;
			case 4:
				// vibrato
				// reset volume and vibrato timer if sample number is present
				if (note.sample) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].vibratoTimer = 0;
				}

				x = value >> 4;
				y = value & 0x0f;

				if (x==0 && y==0 && trackEffectCache[track].vibrato){
					trackEffects.vibrato = trackEffectCache[track].vibrato;
				}else{
					trackEffects.vibrato = {
						amplitude: y,
						freq: (x*ticksPerStep)/64
					};
					trackEffectCache[track].vibrato = trackEffects.vibrato;
				}
				break;
			case 5:
				// continue slide to note
				doPlayNote = false;
				var target = note.period;

				if (target){
					trackEffectCache[track].slidePeriod = target;
				}else{
					target = trackEffectCache[track].slidePeriod  || 0
				}
				value = trackEffectCache[track].slideValue || 1;

				trackEffects.slide = {
					value: value,
					target: target
				};
				if (note.sample){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				// and do volume slide
				if (note.param < 16){
					// slide down
					value = value * -1;
				}else{
					// slide up
					//value = note.param & 0x0f;
					value = note.param >> 4;
				}

				// this is based on max volume of 64 -> normalize to 100;
				value = value * 100/64;

				trackEffects.fade = {
					value: value,
					resetOnStep: !!note.sample // volume only needs resetting when the sample number is given, other wise the volue is remembered from the preious state
				};

				break;


			case 6:
				// Continue Vibrato and do volume slide

				// reset volume and vibrato timer if sample number is present
				if (note.sample) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].vibratoTimer = 0;
				}

				if (note.param < 16){
					// volume slide down
					value = value * -1;
				}else{
					// volume slide up
					value = note.param & 0x0f;
				}

				// this is based on max volume of 64 -> normalize to 100;
				value = value * 100/64;

				trackEffects.fade = {
					value: value
				};

				if (trackEffectCache[track].vibrato) trackEffects.vibrato = trackEffectCache[track].vibrato;
				break;
			case 7:
				// Tremolo
				// reset volume if sample number is present
				if (note.sample) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].tremoloTimer = 0;
				}

				x = value >> 4;
				y = value & 0x0f;

				if (x==0 && y==0 && trackEffectCache[track].tremolo){
					trackEffects.tremolo = trackEffectCache[track].tremolo;
				}else{
					trackEffects.tremolo = {
						amplitude: y * (ticksPerStep-1),
						freq: (x*ticksPerStep)/64
					};
					trackEffectCache[track].tremolo = trackEffects.tremolo;
				}

				break;
			case 8:
				// Set Panning position
				// TODO: implement
				break;
			case 9:
				// Set sample offset
				trackEffects.offset = {
					value: value << 8
				};
				break;
			case 10:
				// volume slide
				if (note.param < 16){
					// slide down
					value = value * -1;
				}else{
					// slide up
					//value = note.param & 0x0f;
					value = note.param >> 4;
				}

				// this is based on max volume of 64 -> normalize to 100;
				value = value * 100/64;

				trackEffects.fade = {
					value: value,
					resetOnStep: !!note.sample // volume only needs resettin when the sample number is given, other wise the volue is remembered from the preious state
				};
				break;
			case 11:
				// Position Jump
				result.patternBreak = true;
				result.positionBreak = true;
				result.targetPosition = note.param;
				break;
			case 12:
				//volume
				volume = (note.param/64)*100;
				// not this is not relative to the default sample volume but sets the sample volume
				trackEffects.volume = {
					value: volume
				};
				break;
			case 13:
				// Pattern Break
				result.patternBreak = true;
				break;
			case 14:
				// Subeffects
				// TODO: implement
				console.warn("Subeffect not implemented");
				break;
			case 15:
				//speed
				if (note.param <= 32){
					if (note.param == 0) note.param = 1;
					Tracker.setAmigaSpeed(note.param);
				}else{
					Tracker.setBPM(note.param)
				}
				break;
		}

		if (doPlayNote && sampleIndex && notePeriod){
			// cut off previous note on the same track;
			try{
				if (trackNotes[track].source) {
					trackNotes[track].source.stop();
				}
			}catch (e){

			}

			trackNotes[track] = Audio.playSample(sampleIndex,notePeriod,volume,track,trackEffects);
		}else{
			if (trackEffects){
				if (trackNotes[track].source){
					// effect on currently playing sample
					if (trackEffects.volume){
						volume = trackEffects.volume.value;
						//var sample = Tracker.getSample(trackNotes[track].sampleIndex);
						//if (sample){
						//	volume = volume * (sample.volume/64);
							trackNotes[track].startVolume = volume;
							trackNotes[track].volume.gain.value = volume/100;
						//}

					}
				}
			}

		}

		if (note.sample || sampleIndex) {
			trackNotes[track].currentSample = note.sample || sampleIndex;
		}
		trackNotes[track].effects = trackEffects;
		trackNotes[track].note = note;

		return result;
	}


	me.setBPM = function(newBPM){
		if (clock) clock.timeStretch(Audio.context.currentTime, [mainTimer], bpm / newBPM);
		bpm = newBPM;
		EventBus.trigger(EVENT.songBPMChange,bpm);
	};

	me.getBPM = function(){
		return bpm;
	};

	me.setAmigaSpeed = function(speed){
		// 1 tick is 0.02 seconds on a PAL Amiga
		// 4 steps is 1 beat
		// the speeds sets the amount of ticks in 1 step
		// defauilt is 6 -> 60/(6*0.02*4) = 125 bpm
		console.log("setAmigaSpeed",speed);
		//note: this changes the speed of the song, but not the speed of the main loop
		ticksPerStep = speed;
	};

	me.getAmigaSpeed = function(){
		return ticksPerStep;
	};

	me.toggleRecord = function(){
		me.stop();
		isRecording = !isRecording;
		EventBus.trigger(EVENT.recordingChange,isRecording);
	};

	me.isPlaying = function(){
		return isPlaying;
	};
	me.isRecording = function(){
		return isRecording;
	};

	me.putNote = function(sample,period){
		var note = song.patterns[currentPattern][currentPatternPos][currentTrack];
		if (note){
			note.sample = sample;
			note.period = period;
		}
		song.patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.putNoteParam = function(pos,value){
		var x,y;
		var note = song.patterns[currentPattern][currentPatternPos][currentTrack];
		if (note){
			if (pos == 1 || pos == 2){
				var sample = note.sample;
				x = sample >> 4;
				y = sample & 0x0f;
				if (pos == 1) x = value;
				if (pos == 2) y = value;
				note.sample = (x << 4) + y;
			}

			if (pos == 3) note.effect = value;
			if (pos == 4 || pos == 5){
				var param = note.param;
				x = param >> 4;
				y = param & 0x0f;
				if (pos == 4) x = value;
				if (pos == 5) y = value;
				note.param = (x << 4) + y;
			}
		}
		song.patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};



	me.load = function(url){
		url = url || "demomods/StardustMemories.mod";
		loadFile(url,function(result){
			me.parse(result);
		})
	};

	me.handleUpload = function(files){
		console.log("file uploaded");
		if (files.length){
			var file = files[0];

			var reader = new FileReader();
			reader.onload = function(){
				me.parse(reader.result,file.name);
			};
			reader.readAsArrayBuffer(file);
		}
	};

	me.parse = function(arrayBuffer,name){

		var isMod = false;
		var length = arrayBuffer.byteLength;
		var file = new BinaryStream(arrayBuffer,true);
		var id = "";

		if (length>1100){
			id = file.readString(4,1080); // M.K.
		}
		console.log("Format ID: " + id);

		if (id == "M.K.") isMod = true;

		if (isMod){
			song = {
				patterns:[]
			};

			console.log("loaded");
			window.bin = arrayBuffer;

			//see https://www.aes.id.au/modformat.html

			song.typeId = id;
			var title = file.readString(20,0);
			console.log("Title: " + title);
			song.title = title;

			var sampleDataOffset = 0;
			for (i = 1; i <= 31; ++i) {
				var sampleName = file.readString(22);
				var sampleLength = file.readWord(); // in words


				//if (!sampleLength) {
				//	samples[i] = undefined;
				//	file.jump(6);
				//	continue;
				//}

				var sample = {
					name: sampleName,
					data: []
				};

				sample.length = sample.realLen = sampleLength << 1;
				sample.finetune = file.readUbyte();
				sample.volume   = file.readUbyte();
				sample.loopStart     = file.readWord() << 1;
				sample.loopRepeatLength   = file.readWord() << 1;

				sample.pointer = sampleDataOffset;
				sampleDataOffset += sample.length;
				samples[i] = sample;


			}
			song.samples = samples;

			file.goto(950);
			song.length = file.readUbyte();
			file.jump(1); // 127 byte

			var patternTable = [];
			var highestPattern = 0;
			for (var i = 0; i < 128; ++i) {
				//patternTable[i] = file.readUbyte() << 8;
				patternTable[i] = file.readUbyte();
				if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
			}
			song.patternTable = patternTable;

			file.goto(1084);

			// pattern data
			var numChannels = 4;
			var patternLength = 64;

			for (i = 0; i <= highestPattern; ++i) {

				var patternData = [];

				for (var step = 0; step<patternLength; step++){
					var row = [];
					for (var channel = 0; channel < numChannels; channel++){
						var trackStep = {};
						var trackStepInfo = file.readUint();

						trackStep.period = (trackStepInfo >> 16) & 0x0fff;
						trackStep.effect = (trackStepInfo >>  8) & 0x0f;
						trackStep.sample = (trackStepInfo >> 24) & 0xf0 | (trackStepInfo >> 12) & 0x0f;
						trackStep.param  = trackStepInfo & 0xff;


						if (trackStep.period && trackStep.period>856) console.error(channel,trackStep);


						row.push(trackStep);
					}
					patternData.push(row);
				}
				song.patterns.push(patternData);

				//file.jump(1024);
			}


			var sampleContainer = [];

			for(i=1; i < samples.length; i++) {
				sample = samples[i];
				if (sample){
					console.log("Reading sample from 0x" + file.index + " with length of " + sample.length + " bytes and repeat length of " + sample.loopRepeatLength);
					//this.samples[i] = ds.readInt8Array(this.inst[i].sampleLength*2);

					for (j = 0; j<sample.length; j++){
						var b = file.readByte();
						// ignore first 2 bytes
						if (j>1){
							sample.data.push(b / 127)
						}
					}

					// unroll short loops
					// web audio loop start/end is in seconds
					// doesn't work that well with tiny chip tune loops
					// especially when sliding notes

					// TODO: implement proper looping
					if (sample.loopStart && sample.loopRepeatLength>1){
						// TODO: pingpong and reverse loops ? -> unroll once and append the reversed loop

						var loopCount = Math.ceil(40000 / sample.loopRepeatLength) + 1;

						if (!SETTINGS.unrollLoops) loopCount = 0;

						for (var l=0;l<loopCount;l++){
							var start = sample.loopStart + 1;
							var end = start + sample.loopRepeatLength;
							for (j=start; j<end; j++){
								sample.data.push(sample.data[j]);
							}
						}
					}

					sampleContainer.push({label: i + " " + sample.name, data: i});
				}
			}
			UI.mainPanel.setInstruments(sampleContainer);

			onModuleLoad();


			//Audio.playSample(1);
		}else{
			// load as sample
			me.importSample(file,name);
		}

	};

	me.getSong = function(){
		return song;
	};

	me.getSamples = function(){
		return samples;
	};

	me.getSample = function(index){
		return samples[index];
	};

	me.importSample = function(file,name){
		console.log("Reading sample " + name + " with length of " + file.length + " bytes to index " + currentSampleIndex);

		var sample = samples[currentSampleIndex] || {};

		sample.name = name;
		sample.length = file.length;
		sample.loopStart = 0;
		sample.loopRepeatLength = 0;
		sample.finetune = 0;
		sample.volume = 100;
		sample.data = [];

		file.goto(0);
		for (j = 0; j<sample.length; j++){
			var b = file.readByte();
			sample.data.push(b / 127)
		}

		EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
		EventBus.trigger(EVENT.sampleNameChange,currentSampleIndex);

	};

	me.buildBinary = function(){

		/*
		  filesize:

		20 + (31*30) + 1 + 1 + 128 + 4

		*/

		// get filesize

		var fileSize = 20 + (31*30) + 1 + 1 + 128 + 4;

		var highestPattern = 0;
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			highestPattern = Math.max(highestPattern,p);
		}

		fileSize += ((highestPattern+1)*1024);

		samples.forEach(function(sample){
			if (sample){
				fileSize += sample.length;
			}else{
				 // +4 ?
			}
		});


		var i;
		var arrayBuffer = new ArrayBuffer(fileSize);
		var file = new BinaryStream(arrayBuffer,true);

		// write title
		file.writeStringSection(song.title,20);

		// write sample data
		samples.forEach(function(sample){
			if (sample){
				file.writeStringSection(sample.name,22);
				file.writeWord(sample.length >> 1);
				file.writeUByte(sample.finetune);
				file.writeUByte(sample.volume);
				file.writeWord(sample.loopStart >> 1);
				file.writeWord(sample.loopRepeatLength >> 1);
			}else{
				file.clear(30);
			}
		});

		file.writeUByte(song.length);
		file.writeUByte(127);

		// patternPos
		for (i = 0;i<128;i++){
			var p = song.patternTable[i] || 0;
			file.writeUByte(p);
		}
		file.writeString("M.K.");

		// pattern Data
		var numChannels = 4;
		var patternLength = 64;

		for (i=0;i<=highestPattern;i++){

			// TODO: patternData
			//file.clear(1024);

			var patternData = song.patterns[i];

			for (var step = 0; step<patternLength; step++){
				var row = patternData[step];
				for (var channel = 0; channel < numChannels; channel++){
					var trackStep = row[channel];
					var uIndex = 0;
					var lIndex = trackStep.sample;

					if (lIndex>15){
						uIndex = 16; // TODO: Why is this 16 and not 1 ? Nobody wanted 255 instruments instead of 31 ?
						lIndex = trackStep.sample - 16;
					}

					var v = (uIndex << 24) + (trackStep.period << 16) + (lIndex << 12) + (trackStep.effect << 8) + trackStep.param;
					file.writeUint(v);
				}
			}
		}

		// sampleData;
		samples.forEach(function(sample){
			if (sample && sample.data && sample.length){
				// should we put repeat info here?
				file.clear(2);
				var d;
				// sample length is in word
				for (i = 0; i < sample.length-2; i++){
					d = sample.data[i] || 0;
					file.writeByte(Math.round(d*127));
				}
				console.error("write sample with " + sample.length + " length");
			}else{
				// still write 4 bytes?
			}
		});


		var b = new Blob([file.buffer], {type: "application/octet-stream"});
		saveAs(b,"test.mod");



	};

	function onModuleLoad(){
		UI.mainPanel.setPatternTable(song.patternTable);

		me.setCurrentSongPosition(0);
		me.setCurrentPatternPos(0);
		me.setCurrentSampleIndex(1);

		EventBus.trigger(EVENT.songPropertyChange,song);
	}


	return me;
}());