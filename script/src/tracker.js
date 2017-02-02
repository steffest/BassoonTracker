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
	var prevSongPosition = 0;

	var bpm = 125; // bmp
	var ticksPerStep = 6;
	var tickTime = 2.5/bpm;
	var tickCounter = 0;

	var trackCount = 4;
	var patternLength = 64;

	var tracks = getUrlParameter("tracks");
	if (tracks == 8) trackCount = 8;
	if (tracks == 16) trackCount = 16;
	if (tracks == 32) trackCount = 32;
	if (tracks == 64) trackCount = 64;
	if (tracks == 128) trackCount = 128;
	if (tracks == 256) trackCount = 256;
	if (tracks == 512) trackCount = 512;
	if (tracks == 1024) trackCount = 1024;

	var trackNotes = [];
	var trackEffectCache = [];
	var trackerStates = [];

	for (var i=0;i<trackCount;i++){
		trackNotes.push({});
		trackEffectCache.push({});
	}

	console.error("ticktime: " + tickTime);

	me.playBackEngine = PLAYBACKENGINE.SIMPLE;

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
		var max = trackCount*6 - 1;
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
	me.setCurrentSongPosition = function(position,fromUserInteraction){
		currentSongPosition = position;
		if (currentSongPosition != prevSongPosition){
			EventBus.trigger(EVENT.songPositionChange,currentSongPosition);
			if (song.patternTable) me.setCurrentPattern(song.patternTable[currentSongPosition]);
			prevSongPosition = currentSongPosition;

			if (fromUserInteraction && me.isPlaying() && me.playBackEngine == PLAYBACKENGINE.SIMPLE){
				me.stop();
				me.togglePlay();
			}
		}
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
		isPlaying = true;
		//Audio.startRecording();
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

	me.playSimple = function(){
		me.playBackEngine = PLAYBACKENGINE.SIMPLE;
		me.playSong();
	};

	me.stop = function(){
		if (clock) clock.stop();
		Audio.disable();
		Input.clearInputNotes();
		//Audio.stopRecording();

		for (var i = 0; i<trackCount; i++){
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

	me.togglePlay = function(){
		if (me.isPlaying()){
			me.stop();
		}else{
			if (currentPlayType == PLAYTYPE.pattern){
				me.playPattern();
			}else{
				me.playSong();
			}
		}
	};

	me.save = function(){
		//saveFile(window.bin,"test.mod");
		//var b = new Blob([window.bin], {type: "octet/stream"});
		//saveAs(b,"test.mod");

		me.buildBinary();
	};

	me.getProperties = function(){
		return{
			ticksPerStep: ticksPerStep,
			tickTime: tickTime
		}
	};

	function playPattern(patternIndex){
		patternIndex = patternIndex || 0;

		clock = clock || new WAAClock(Audio.context);
		clock.start();
		Audio.enable();

		currentPatternData = song.patterns[patternIndex];
		var thisPatternLength = currentPatternData.length;
		var stepResult;

		if (me.playBackEngine == PLAYBACKENGINE.FULL){
			mainTimer = clock.setTimeout(function(event) {
				if (tickCounter == 0){
					var p = currentPatternPos;
					stepResult = playPatternStep(p,event.deadline);
					p++;

					if (p>=thisPatternLength || stepResult.patternBreak){
						p=0;
						if (Tracker.getPlayType() == PLAYTYPE.song){
							var nextPosition = stepResult.positionBreak ? stepResult.targetPosition : currentSongPosition+1;
							if (nextPosition>=song.length) nextPosition = 0;
							me.setCurrentSongPosition(nextPosition);

						}
					}
					Tracker.setCurrentPatternPos(p);
				}
				processPatterTick();

				tickCounter++;

				if (tickCounter>=ticksPerStep) tickCounter=0;
			},0.01).repeat(tickTime).tolerance({early: 0.01})
		}else{

			// look-ahead playback - for less demanding, works OK on mobile devices
			var p =  0;
			var time = Audio.context.currentTime + 0.01;

			// start with a small delay then make it longer
			// this is because Chrome on Android doesn't start playing until the first batch of scheduling is done?

			var delay = 0.1;
			var playingDelay = 1;

			var playPatternData = currentPatternData;
			var playSongPosition = currentSongPosition;
			trackerStates = [];

			mainTimer = clock.setTimeout(function(event) {

				if (p>1){
					delay = playingDelay;
					mainTimer.repeat(delay);
				}

				var maxTime = event.deadline + delay;

				while (time<maxTime){

					me.setStateAtTime(time,{patternPos: p, songPos: playSongPosition});

					var stepResult = playPatternStep(p,time,playPatternData);
					time += ticksPerStep * tickTime;
					p++;

					if (p>=thisPatternLength || stepResult.patternBreak){
						p=0;
						if (Tracker.getPlayType() == PLAYTYPE.song){
							var nextPosition = stepResult.positionBreak ? stepResult.targetPosition : ++playSongPosition;
							if (nextPosition>=song.length) nextPosition = 0;
							playSongPosition = nextPosition;
							var patternIndex = song.patternTable[playSongPosition];
							playPatternData = song.patterns[patternIndex];
							//me.setCurrentSongPosition(nextPosition);
							// set currentSongPosition in Audio data;

						}
					}
				}


			},0.01).repeat(delay).tolerance({early: 0.1});
		}


	}


	function playPatternStep(step,time,patternData){

		patternData = patternData || currentPatternData;
		// note: patternData can be different than currentPatternData when playback is active with long look ahead times

		var patternStep = patternData[step];
		var tracks = patternStep.length;
		var result = {};
		var r;
		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
			r = playNote(note,i,time);
			if (r.patternBreak) result.patternBreak = true;
			if (r.positionBreak) {
				result.positionBreak = true;
				result.targetPosition = r.targetPosition || 0;
			}
		}

		for (i = 0; i<tracks; i++){
			applyEffects(i,time)
		}


		return result;
	}

	me.playPatternStep = playPatternStep;

	function processPatterTick(){

		for (var track = 0; track<trackCount; track++){
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
							trackNotes[track].hasArpeggio = true;
						}

					}
				}else{
					// reset arpeggio if present
					if (trackNotes[track].hasArpeggio){
						period = note.currentPeriod || note.startPeriod;
						var rate = (note.startPeriod / period);
						if (rate && trackNotes[track].source) trackNotes[track].source.playbackRate.value = trackNotes[track].startPlaybackRate * rate;
						trackNotes[track].hasArpeggio = false;
					}


				}
			}
		}
	}


	function playNote(note,track,time){
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

					//todo: when a sample index is present other than the previous index, but no note
					// how does this work?
					// see example just_about_seven.mod

					trackEffects.arpeggio = {
						root: root,
						interval1: root-Audio.getSemiToneFrom(root,x),
						interval2: root-Audio.getSemiToneFrom(root,y),
						step:1
					};
				}

				// set volume, even if no effect present
				// note: this is consistent with the Protracker 3.15 and later playback
				// on Protracker 2.3 and 3.0, the volume effect seems much bigger - why ? (see "nugget - frust.mod")
				if (note.sample){
					trackEffects.volume = {
						value: defaultVolume
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

				var prevSlide = trackEffectCache[track].slide;

				if (!target) target = prevSlide.target;
				if (!value) value = prevSlide.value;

				trackEffects.slide = {
					value: value,
					target: target
				};
				trackEffectCache[track].slide = trackEffects.slide;

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

				var freq = (x*ticksPerStep)/64;

                var prevVibrato = trackEffectCache[track].vibrato;
				if (x == 0 && prevVibrato) freq = prevVibrato.freq;
				if (y == 0 && prevVibrato) y = prevVibrato.amplitude;

				trackEffects.vibrato = {
					amplitude: y,
					freq: freq
				};
				trackEffectCache[track].vibrato = trackEffects.vibrato;

				break;
			case 5:
				// continue slide to note
				doPlayNote = false;
				var target = note.period;
				value = 1;

				var prevSlide = trackEffectCache[track].slide;
				if (prevSlide){
					if (!target) target = prevSlide.target  || 0;
					value = prevSlide.value;
				}

				trackEffects.slide = {
					value: value,
					target: target
				};
				trackEffectCache[track].slide = trackEffects.slide;

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
				trackEffectCache[track].fade = trackEffects.fade;

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

				var amplitude = y * (ticksPerStep-1);
				var freq = (x*ticksPerStep)/64;

				var prevTremolo = trackEffectCache[track].tremolo;

				if (x==0 && prevTremolo) freq = prevTremolo.freq;
				if (y==0 && prevTremolo) amplitude = prevTremolo.amplitude;

				trackEffects.tremolo = {
					amplitude:amplitude,
					freq: freq
				};
				trackEffectCache[track].tremolo = trackEffects.tremolo;

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
					value = note.param >> 4;
				}

				// this is based on max volume of 64 -> normalize to 100;
				value = value * 100/64;

				if (!note.param){
					var prevFade = trackEffectCache[track].fade;
					if (prevFade) value = prevFade.value;
				}

				trackEffects.fade = {
					value: value,
					resetOnStep: !!note.sample // volume only needs resetting when the sample number is given, otherwise the volue is remembered from the preious state
				};
				trackEffectCache[track].fade = trackEffects.fade;

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
					trackNotes[track].source.stop(time);
				}
			}catch (e){

			}

			trackNotes[track] = Audio.playSample(sampleIndex,notePeriod,volume,track,trackEffects,time);
		}else{
			if (trackEffects && me.playBackEngine == PLAYBACKENGINE.FULL){
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

	function applyEffects(track,time){

		if (me.playBackEngine != PLAYBACKENGINE.SIMPLE) return;

		var trackNote = trackNotes[track];
		var effects = trackNote.effects;

		if (!trackNote) return;
		if (!effects) return;

		var value;

		if (trackNote.resetPeriodOnStep && trackNote.source){
			// vibrato or arpeggio is done
			// for slow vibratos it seems logical to keep the current frequency, but apparently most trackers revert back to the pre-vibrato one
			var targetPeriod = trackNote.currentPeriod || trackNote.startPeriod;
			var rate = (trackNote.startPeriod / targetPeriod);
			trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time);
			trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time + 0.01);
			trackNote.resetPeriodOnStep = false;
		}

		if (effects.volume){
			if (trackNote.volume){
				var volume = effects.volume.value;
				trackNote.startVolume = volume;
				trackNote.volume.gain.setValueAtTime(volume/100,time);
			}
		}

		if (effects.fade){
			value = effects.fade.value;
			var currentVolume;

			if (effects.fade.resetOnStep){
				currentVolume = trackNote.startVolume;
			}else{
				currentVolume = trackNote.currentVolume;
			}

			for (var tick = 0; tick < ticksPerStep; tick++){
				if (trackNote.volume){
					trackNote.volume.gain.setValueAtTime(currentVolume/100,time + (tick*tickTime));
					currentVolume += value;
					currentVolume = Math.max(currentVolume,0);
					currentVolume = Math.min(currentVolume,100);
				}
			}

			trackNote.currentVolume = currentVolume;

		}

		if (effects.slide){
			if (trackNote.source){
				var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
				var currentRate = trackNote.startPlaybackRate;
				var targetPeriod = currentPeriod;

				value = Math.abs(effects.slide.value);

				for (var tick = 1; tick < ticksPerStep; tick++){
					if (effects.slide.target){
						if (targetPeriod<effects.slide.target){
							targetPeriod += value;
							if (targetPeriod>effects.slide.target) targetPeriod = effects.slide.target;
						}else{
							targetPeriod -= value;
							if (targetPeriod<effects.slide.target) targetPeriod = effects.slide.target;
						}
					}else{
						targetPeriod += effects.slide.value;
					}



					if (targetPeriod != trackNote.currentPeriod){
						trackNote.currentPeriod = targetPeriod;
						var rate = (trackNote.startPeriod / targetPeriod);

						// note - seems to be a weird bug in chrome ?
						// try setting it twice with a slight delay
						// TODO: retest on Chrome windows and other browsers
						trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time + (tick*tickTime));
						trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time + (tick*tickTime) + 0.005);

						//trackNote.source.playbackRate.value = trackNote.startPlaybackRate * rate;
					}
				}
				//trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate,time + (ticksPerStep*tickTime)+0.2);
			}
		}

		if (effects.arpeggio){
			if (trackNote.source){

				var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
				var currentRate = trackNote.startPlaybackRate;
				var targetPeriod;

				trackNote.resetPeriodOnStep = true;

				for (var tick = 0; tick < ticksPerStep; tick++){
					var t = tick%3;

					if (t == 0) targetPeriod = currentPeriod;
					if (t == 1 && effects.arpeggio.interval1) targetPeriod = currentPeriod - effects.arpeggio.interval1;
					if (t == 2 && effects.arpeggio.interval2) targetPeriod = currentPeriod - effects.arpeggio.interval2;

					var rate = (currentPeriod / targetPeriod);
					trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time + (tick*tickTime));
				}
			}
		}

		if (effects.vibrato){
			var freq = effects.vibrato.freq;
			var amp = effects.vibrato.amplitude;

			trackNote.vibratoTimer = trackNote.vibratoTimer||0;


			if (trackNote.source) {
				trackNote.resetPeriodOnStep = true;
				currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;

				for (var tick = 0; tick < ticksPerStep; tick++) {
					var periodChange = Math.sin(trackNote.vibratoTimer * freq) * amp;

					targetPeriod = currentPeriod + periodChange;
					var rate = (trackNote.startPeriod / targetPeriod);
					trackNote.source.playbackRate.setValueAtTime(trackNote.startPlaybackRate * rate,time + (tick*tickTime));
					trackNote.vibratoTimer++;
				}
			}

		}


		if (effects.tremolo){
			var freq = effects.tremolo.freq;
			var amp = effects.tremolo.amplitude;

			trackNote.tremoloTimer = trackNote.tremoloTimer||0;

			if (trackNote.volume) {
				var _volume = trackNote.startVolume;

				for (var tick = 0; tick < ticksPerStep; tick++) {

					var volumeChange = Math.sin(trackNote.tremoloTimer * freq) * amp;
					_volume += volumeChange;
					if (_volume<0) _volume=0;
					if (_volume>100) _volume=100;

					trackNote.volume.gain.setValueAtTime(_volume/100,time + (tick*tickTime));
					trackNote.currentVolume = _volume;
					trackNote.tremoloTimer++;
				}
			}

		}


	}

	me.renderTrackToBuffer = function(){
		me.playBackEngine = PLAYBACKENGINE.SIMPLE;

		var step = 0;
		var patternStep = 0;
		var thisPatternLength = 64;
		var time = 0;

		//var length = (ticksPerStep * tickTime * thisPatternLength) * song.length;
		var length = (ticksPerStep * tickTime * thisPatternLength);
		Audio.startRendering(length);


		//while (patternStep<song.length){
		//	var patternIndex = song.patternTable[patternStep];
		//	currentPatternData = song.patterns[patternIndex];
			while (step<thisPatternLength){
				var stepResult = playPatternStep(step,time);
				time += ticksPerStep * tickTime;
				step++;
			}
			step = 0;
			patternStep++;
		//}

		Audio.stopRendering();
	};

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

	me.getPatterLength = function(){
		return patternLength;
	};

	me.getTrackCount = function(){
		return trackCount;
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

	me.setStateAtTime = function(time,state){
		trackerStates.push({time:time,state:state});
	};

	me.getStateAtTime = function(time){

		// set time a bit ahead, seems more responsive
		// DON'T add more then the tickTime otherwise the UI starts skipping steps
		//time += tickTime;

		var result = undefined;
		for(var i = 0, len = trackerStates.length; i<len;i++){
			var state = trackerStates[0];
			if (state.time<time){
				result = trackerStates.shift().state;
			}else{
				return result;
			}
		}
	};

	me.load = function(url){
		url = url || "demomods/StardustMemories.mod";
		var name = url.substr(url.lastIndexOf("/")+1);
		loadFile(url,function(result){
			me.parse(result,name);
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
		if (id == "FLT4") isMod = true;

		if (isMod){

			if (me.isPlaying()) me.stop();
			resetDefaultSettings();


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

			for(i=1; i < samples.length; i++) {
				sample = samples[i];
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

		detectSampleType(file,sample);

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

				// limit sample size to 128k
				//TODO: show a warning whan this is exceeded ...
				sample.length = Math.min(sample.length, 131070); // = FFFF * 2

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

		for (i=0;i<=highestPattern;i++){

			// TODO: patternData
			//file.clear(1024);

			var patternData = song.patterns[i];

			for (var step = 0; step<patternLength; step++){
				var row = patternData[step];
				for (var channel = 0; channel < trackCount; channel++){
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

		prevPatternPos = undefined;
		prevSampleIndex = undefined;
		prevPattern = undefined;
		prevSongPosition = undefined;

		me.setCurrentSongPosition(0);
		me.setCurrentPatternPos(0);
		me.setCurrentSampleIndex(1);

		EventBus.trigger(EVENT.songPropertyChange,song);
	}

	function resetDefaultSettings(){
		me.setAmigaSpeed(6);
		me.setBPM(125);
	}


	return me;
}());