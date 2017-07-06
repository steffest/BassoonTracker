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

	var vibratoFunction;
	var tremoloFunction;

	var bpm = 125; // bmp
	var ticksPerStep = 6;
	var tickTime = 2.5/bpm;
	var tickCounter = 0;
	var mainTimer;

	var trackCount = 4;
	var patternLength = 64;

	var pasteBuffer = {};

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
	var patternLoopStart = [];
	var patternLoopCount = [];

	for (var i=0;i<trackCount;i++){
		trackNotes.push({});
		trackEffectCache.push({});
	}

	console.log("ticktime: " + tickTime);

	me.setCurrentSampleIndex = function(index){
		if (song.samples[index]){
			currentSampleIndex = index;
			if (prevSampleIndex!=currentSampleIndex) EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
			prevSampleIndex = currentSampleIndex;
		}
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

		if (!currentPatternData){
			// insert empty pattern;
			currentPatternData = getEmptyPattern();
			song.patterns[currentPattern] = currentPatternData;
		}
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

			if (fromUserInteraction && me.isPlaying()){
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

	me.stop = function(){
		if (clock) clock.stop();
		Audio.disable();
		UI.setStatus("Ready");
		Input.clearInputNotes();
		me.clearEffectCache();
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

	me.save = function(filename){
		me.buildBinary(MODULETYPE.mod,function(file){
			var b = new Blob([file.buffer], {type: "application/octet-stream"});

			var fileName = filename || me.getFileName();
			saveAs(b,fileName);

			//Dropbox.putFile(fileName,b);
		});
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
		UI.setStatus("Playing");
		patternLoopStart = [];
		patternLoopCount = [];

		currentPatternData = song.patterns[patternIndex];
		var thisPatternLength = currentPatternData.length;
		var stepResult = {};

		// look-ahead playback - far less demanding, works OK on mobile devices
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

				if (stepResult.patternDelay){
					// the E14 effect is used: delay Pattern but keep processing effects
					stepResult.patternDelay--;

					for (i = 0; i<trackCount; i++){
						applyEffects(i,time)
					}

					time += ticksPerStep * tickTime;
				}else{
					stepResult = playPatternStep(p,time,playPatternData,playSongPosition);
					time += ticksPerStep * tickTime;
					p++;

					if (p>=thisPatternLength || stepResult.patternBreak){
						if (!(stepResult.positionBreak && stepResult.targetSongPosition == playSongPosition)){
							//We're not in a pattern loop
							patternLoopStart = [];
							patternLoopCount = [];
						}
						p=0;
						if (Tracker.getPlayType() == PLAYTYPE.song){
							var nextPosition = stepResult.positionBreak ? stepResult.targetSongPosition : ++playSongPosition;
							if (nextPosition>=song.length) nextPosition = 0;
							playSongPosition = nextPosition;
							patternIndex = song.patternTable[playSongPosition];
							playPatternData = song.patterns[patternIndex];
							if (stepResult.patternBreak) p = stepResult.targetPatternPosition || 0;
						}else{
							if (stepResult.patternBreak) p = stepResult.targetPatternPosition || 0;
						}
					}
				}



			}


		},0.01).repeat(delay).tolerance({early: 0.1});

	}


	function playPatternStep(step,time,patternData,songPostition){

		patternData = patternData || currentPatternData;
		// note: patternData can be different than currentPatternData when playback is active with long look ahead times

		var patternStep = patternData[step];
		var tracks = patternStep.length;
		var result = {};
		var r;
		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
			var songPos = {position: songPostition, step: step};
			r = playNote(note,i,time,songPos);
			if (r.patternBreak) {
				result.patternBreak = true;
				result.targetPatternPosition = r.targetPatternPosition || 0;
			}
			if (r.positionBreak) {
				result.positionBreak = true;
				result.targetPatternPosition = r.targetPatternPosition || 0;
				result.targetSongPosition = r.targetSongPosition || 0;
			}
			if (r.patternDelay) result.patternDelay = r.patternDelay;
		}

		for (i = 0; i<tracks; i++){
			applyEffects(i,time)
		}


		return result;
	}

	me.playPatternStep = playPatternStep;

	function playNote(note,track,time,songPos){

		var defaultVolume = 100;
		var trackEffects = {};


		var sampleIndex = note.sample;

		if (note.period && !note.sample){
			// reuse previous Sample
			sampleIndex = trackNotes[track].currentSample;
			defaultVolume = typeof trackNotes[track].currentVolume == "number" ? trackNotes[track].currentVolume : defaultVolume;

			if (SETTINGS.emulateProtracker1OffsetBug && sampleIndex && trackEffectCache[track].offset){
				if (trackEffectCache[track].offset.sample == sampleIndex){
					console.log("applying sample offset cache to sample " + sampleIndex);
					trackEffects.offset = trackEffectCache[track].offset;
				}
			}
		}

		if (typeof note.sample == "number"){
			var sample = me.getSample(note.sample);
			if (sample) {
				defaultVolume = 100 * (sample.volume/64);

				if (SETTINGS.emulateProtracker1OffsetBug){
					// reset sample offset when a sample number is present;
					trackEffectCache[track].offset = trackEffectCache[track].offset || {};
					trackEffectCache[track].offset.value = 0;
					trackEffectCache[track].offset.sample = note.sample;
				}
			}
		}

		var notePeriod = note.period;

		var volume = defaultVolume;
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
					var finetune = 0;


					//todo: when a sample index is present other than the previous index, but no note
					// how does this work?
					// see example just_about_seven.mod

					// check if the sample is finetuned
					var playingSample = sampleIndex || trackNotes[track] ? trackNotes[track].currentSample : 0;
					if (playingSample){
						sample = me.getSample(playingSample);
						if (sample && sample.finetune){
							finetune = sample.finetune;
							root = Audio.getFineTunePeriod(root,finetune);
						}
					}

					trackEffects.arpeggio = {
						root: root,
						interval1: root-Audio.getSemiToneFrom(root,x,finetune),
						interval2: root-Audio.getSemiToneFrom(root,y,finetune),
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
				value = value * -1;
				// note: on protracker 2 and 3 , the effectcache is NOT used on this effect
				// it is on Milkytracker (in all playback modes)
				//if (!value && trackEffectCache[track].slideUp) value = trackEffectCache[track].slideUp.value;
				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideUp = trackEffects.slide;
				break;
			case 2:
				// Slide Down
				// note: on protracker 2 and 3 , the effectcache is NOT used on this effect
				// it is on Milkytracker (in all playback modes)
				//if (!value && trackEffectCache[track].slideDown) value = trackEffectCache[track].slideDown.value;
				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideDown = trackEffects.slide;
				break;
			case 3:
				// Slide to Note - if there's a note provided, it is not played directly,
				// if the sample number is set, the default volume of that sample will be set

				// if value == 0 then the old slide will continue

				doPlayNote = false;
				var target = note.period;

				if (target && sampleIndex){
					// check if the sample is finetuned
					var sample = me.getSample(sampleIndex);
					if (sample && sample.finetune){
						target = Audio.getFineTunePeriod(target,sample.finetune);
					}
				}

				var prevSlide = trackEffectCache[track].slide;

				if (prevSlide){
					if (!target) target = prevSlide.target;
					if (!value) value = prevSlide.value;
				}

				trackEffects.slide = {
					value: value,
					target: target,
					canUseGlissando: true
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

				if (target && sampleIndex){
					// check if the sample is finetuned
					var sample = me.getSample(sampleIndex);
					if (sample && sample.finetune){
						target = Audio.getFineTunePeriod(target,sample.finetune);
					}
				}

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
				value = note.param;
				if (!value){
					// don't do volume slide
				}else{
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
					trackEffectCache[track].fade = trackEffects.fade;
				}

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
				if (note.param){
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
				}

				if (trackEffectCache[track].vibrato) trackEffects.vibrato = trackEffectCache[track].vibrato;
				break;
			case 7:
				// Tremolo
				// note: having a sample number without a period doesn't seem te have any effect (protracker)
				// when only a period -> reset the wave form / timer

				if (note.period && !note.sample) {
					if (trackNotes[track].startVolume) {
						trackEffects.volume = {
							value: volume
						};
					}

					trackNotes[track].tremoloTimer = 0;
				}

				x = value >> 4;
				y = value & 0x0f;

				//var amplitude = y * (ticksPerStep-1); Note: this is the formula in the mod spec, but this seems way off;
				var amplitude = y;
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

				/* quirk in Protracker 1 and 2 ?
				 if NO NOTE is given but a sample number is present,
				 then the offset is remembered for the next note WITHOUT sample number
				 but only when the derived sample number is the same as the offset sample number
				 see "professional tracker" mod for example

				 also:
				 * if no sample number is present: don't reset the offset
				  -> the effect cache of the previous 9 command of the sample is used
				 * if a note is present REAPPLY the offset in the effect cache (but don't set start of sample)
				  -> the effect cache now contains double the offset

				 */

				value =  value << 8 ;
				if (!value && trackEffectCache[track].offset){
					value = trackEffectCache[track].offset.stepValue || trackEffectCache[track].offset.value || 0;
				}
				var stepValue = value;

				if (SETTINGS.emulateProtracker1OffsetBug && !note.sample && trackEffectCache[track].offset){
					// bug in PT1 and PT2: add to existing offset if no sample number is given
					value += trackEffectCache[track].offset.value;
				}

				trackEffects.offset = {
					value: value,
					stepValue: stepValue
				};

				// note: keep previous trackEffectCache[track].offset.sample in tact
				trackEffectCache[track].offset = trackEffectCache[track].offset || {};
				trackEffectCache[track].offset.value = trackEffects.offset.value;
				trackEffectCache[track].offset.stepValue = trackEffects.offset.stepValue;


				if (SETTINGS.emulateProtracker1OffsetBug){

					// quirk in PT1 and PT2: remember sample offset for sample
					if (note.sample) {
						//console.log("set offset cache for sample " + note.sample);
						trackEffectCache[track].offset.sample = note.sample;
					}

					// bug in PT1 and PT2: re-apply sample offset in effect cache
					if (note.period) {
						//console.log("re-adding offset in effect cache");
						trackEffectCache[track].offset.value += stepValue;
					}

				}

				if (note.sample){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

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
					resetOnStep: !!note.sample // volume only needs resetting when the sample number is given, otherwise the volume is remembered from the previous state
				};

				break;
			case 11:
				// Position Jump
				result.patternBreak = true;
				result.positionBreak = true;
				result.targetSongPosition = note.param;
				result.targetPatternPosition = 0;
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
				x = value >> 4;
				y = value & 0x0f;
				result.targetPatternPosition = x*10 + y;
				if (result.targetPatternPosition >= patternLength) result.targetPatternPosition=0;
				break;
			case 14:
				// Subeffects
				var subEffect = value >> 4;
				var subValue = value & 0x0f;
					switch (subEffect){
						case 0:
							Audio.setAmigaLowPassFilter(!subValue,time);
							break;
						case 1: // Fine slide up
							subValue = subValue*-1;
							if (!subValue && trackEffectCache[track].fineSlide) subValue = trackEffectCache[track].fineSlide.value;
							trackEffects.slide = {
								value: subValue,
								fine: true
							};
							trackEffectCache[track].fineSlide = trackEffects.slide;
							break;
						case 2: // Fine slide up
							if (!subValue && trackEffectCache[track].fineSlide) subValue = trackEffectCache[track].fineSlide.value;
							trackEffects.slide = {
								value: subValue,
								fine: true
							};
							trackEffectCache[track].fineSlide = trackEffects.slide;
							break;
						case 3: // set glissando control
							trackEffectCache[track].glissando = !!subValue;
							break;
						case 4: // Set Vibrato Waveform
							switch(subValue){
								case 1: vibratoFunction = Audio.waveFormFunction.saw; break;
								case 2: vibratoFunction = Audio.waveFormFunction.square; break;
								case 3: vibratoFunction = Audio.waveFormFunction.sine; break; // random
								case 4: vibratoFunction = Audio.waveFormFunction.sine; break; // no retrigger
								case 5: vibratoFunction = Audio.waveFormFunction.saw; break; // no retrigger
								case 6: vibratoFunction = Audio.waveFormFunction.square; break; // no retrigger
								case 7: vibratoFunction = Audio.waveFormFunction.sine; break; // random, no retrigger
								default: vibratoFunction = Audio.waveFormFunction.sine; break;
							}
							break;
						case 5: // Set Fine Tune
							if (sampleIndex){
								var sample = me.getSample(sampleIndex);
								trackEffects.fineTune = {
									original: sample.finetune,
									sample: sample
								};
								sample.finetune = subValue;
								if (subValue>7) sample.finetune = subValue-15;
							}
							break;
						case 6: // Pattern Loop
							if (subValue){
								patternLoopCount[track] = patternLoopCount[track] || 0;
								if (patternLoopCount[track]<subValue){
									patternLoopCount[track]++;
									result.patternBreak = true;
									result.positionBreak = true;
									result.targetSongPosition = songPos.position; // keep on same position
									result.targetPatternPosition = patternLoopStart[track] || 0; // should we default to 0 if no start was set or just ignore?

									console.log("looping to " + result.targetPatternPosition + " for "  + patternLoopCount[track] + "/" + subValue);
								}else{
									patternLoopCount[track] = 0;
								}
							}else{
								console.log("setting loop start to " + songPos.step + " on track " + track);
								patternLoopStart[track] = songPos.step;
							}
							break;
						case 7: // Set Tremolo WaveForm
							switch(subValue){
								case 1: tremoloFunction = Audio.waveFormFunction.saw; break;
								case 2: tremoloFunction = Audio.waveFormFunction.square; break;
								case 3: tremoloFunction = Audio.waveFormFunction.sine; break; // random
								case 4: tremoloFunction = Audio.waveFormFunction.sine; break; // no retrigger
								case 5: tremoloFunction = Audio.waveFormFunction.saw; break; // no retrigger
								case 6: tremoloFunction = Audio.waveFormFunction.square; break; // no retrigger
								case 7: tremoloFunction = Audio.waveFormFunction.sine; break; // random, no retrigger
								default: tremoloFunction = Audio.waveFormFunction.sine; break;
							}
							break;
							break;
						case 8: // Set Panning - is this used ?
							console.warn("Set Panning - not implemented");
							break;
						case 9: // Retrigger Note
							if (subValue){
								trackEffects.reTrigger = {
									value: subValue
								}
							}
							break;
						case 10: // Fine volume slide up
							subValue = subValue * 100/64;
							trackEffects.fade = {
								value: subValue,
								fine: true
							};
							break;
						case 11: // Fine volume slide down

							subValue = subValue * 100/64;

							trackEffects.fade = {
								value: -subValue,
								fine: true
							};
							break;
						case 12: // Cut Note
							if (subValue){
								if (subValue<ticksPerStep){
									trackEffects.cutNote = {
										value: subValue
									}
								}
							}else{
								doPlayNote = false;
							}
							break;
						case 13: // Delay Sample start
							if (subValue){
								if (subValue<ticksPerStep){
									time += tickTime * subValue;
								}else{
									doPlayNote = false;
								}
							}
							break;
						case 14: // Pattern Delay
							result.patternDelay = subValue;
							break;
						case 15: // Invert Loop
							// Don't think is used somewhere - ignore
							break;
						default:
							console.warn("Subeffect " + subEffect + " not implemented");
					}
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
			cutNote(track,time);
			trackNotes[track] = Audio.playSample(sampleIndex,notePeriod,volume,track,trackEffects,time);
		}


		if (note.sample || sampleIndex) {
			trackNotes[track].currentSample = note.sample || sampleIndex;

			// reset temporary sample settings
			if (trackEffects.fineTune && trackEffects.fineTune.sample){
				trackEffects.fineTune.sample.finetune = trackEffects.fineTune.original || 0;
			}

		}
		trackNotes[track].effects = trackEffects;
		trackNotes[track].note = note;

		return result;
	}

	function cutNote(track,time){
		// ramp to 0 volume to avoid clicks
		try{
			if (trackNotes[track].source) {
				var gain = trackNotes[track].volume.gain;
				gain.setValueAtTime(trackNotes[track].currentVolume/100,time-0.002);
				gain.linearRampToValueAtTime(0,time);
				trackNotes[track].source.stop(time+0.02);
				//trackNotes[track].source.stop(time);
			}
		}catch (e){

		}
	}

	function applyEffects(track,time){

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
			var volume = effects.volume.value;
			if (trackNote.volume){
				//trackNote.startVolume = volume; // apparently the startVolume is not set here but the default volume of the note is used?
				trackNote.volume.gain.setValueAtTime(volume/100,time);
			}
			trackNote.currentVolume = volume;
		}

		if (effects.fade){
			value = effects.fade.value;
			var currentVolume;

			if (effects.fade.resetOnStep){
				currentVolume = trackNote.startVolume;
			}else{
				currentVolume = trackNote.currentVolume;
			}

			var steps = ticksPerStep;
			if (effects.fade.fine){
				// fine Volume Up or Down
				steps = 1;
			}

			for (var tick = 0; tick < steps; tick++){
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

				var steps = ticksPerStep;
				if (effects.slide.fine){
					// fine Slide Up or Down
					steps = 2;
				}

				for (var tick = 1; tick < steps; tick++){
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

					targetPeriod = Audio.limitAmigaPeriod(targetPeriod);

					var newPeriod = targetPeriod;
					if (effects.slide.canUseGlissando && trackEffectCache[track].glissando){
						newPeriod = Audio.getNearestSemiTone(targetPeriod,trackNote.sampleIndex);
					}

					if (newPeriod != trackNote.currentPeriod){
						trackNote.currentPeriod = targetPeriod;
						var rate = (trackNote.startPeriod / newPeriod);

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

					targetPeriod = vibratoFunction(currentPeriod,trackNote.vibratoTimer,freq,amp);
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

					_volume = tremoloFunction(_volume,trackNote.tremoloTimer,freq,amp);

					if (_volume<0) _volume=0;
					if (_volume>100) _volume=100;

					trackNote.volume.gain.setValueAtTime(_volume/100,time + (tick*tickTime));
					trackNote.currentVolume = _volume;
					trackNote.tremoloTimer++;
				}
			}

		}

		if (effects.cutNote){
			trackNote.volume.gain.setValueAtTime(0,time + (effects.cutNote.value*tickTime));
			trackNote.currentVolume = 0;
		}

		if (effects.reTrigger){
			var sampleIndex = trackNote.sampleIndex;
			var notePeriod = trackNote.startPeriod;
			volume = trackNote.startVolume;

			var triggerStep = effects.reTrigger.value || 1;
			while (triggerStep<ticksPerStep){
				var triggerTime = time + (triggerStep * tickTime);
				cutNote(track,triggerTime);
				trackNotes[track] = Audio.playSample(sampleIndex,notePeriod,volume,track,effects,triggerTime);
				triggerStep += triggerStep;
			}
		}

	}

	me.renderTrackToBuffer = function(fileName){
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

		Audio.stopRendering(function(result){
			// save to wav
			var b = new Blob([result], {type: "octet/stream"});
			fileName = fileName || me.getSong().title.replace(/ /g, '-').replace(/\W/g, '') + ".wav" || "module-export.wav";
			saveAs(b,fileName);

			//var output = context.createBufferSource();
			//output.buffer = renderedBuffer;
			//output.connect(context.destination);
			//output.start();

		});
	};

	me.setBPM = function(newBPM){
		console.log("set BPM: " + bpm + " to " + newBPM);
		if (clock) clock.timeStretch(Audio.context.currentTime, [mainTimer], bpm / newBPM);
		bpm = newBPM;
		tickTime = 2.5/bpm;
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
		var result = undefined;
		for(var i = 0, len = trackerStates.length; i<len;i++){
			var state = trackerStates[0];
			if (state.time<time){
				result = trackerStates.shift().state;
			}else{
				return result;
			}
		}
		return result;
	};


	me.load = function(url,skipHistory){
		url = url || "demomods/StardustMemories.mod";
		var name = url.substr(url.lastIndexOf("/")+1);

		UI.setInfo("");
		UI.setStatus("Loading");

		loadFile(url,function(result){
			var isMod = me.processFile(result,name);
			UI.setStatus("Ready");

			if (isMod){
				var infoUrl = "";
				var source = "";

				if (url.indexOf("modarchive.org")>0){
					var id = url.split('moduleid=')[1];
					song.filename = id.split("#")[1] || id;
					id = id.split("#")[0];
					id = id.split("&")[0];

					source = "modArchive";
					infoUrl = "https://modarchive.org/index.php?request=view_by_moduleid&query=" + id;
					EventBus.trigger(EVENT.songPropertyChange,song);
				}
				UI.setInfo(song.title,source,infoUrl);
			}

			if (isMod && !skipHistory){

				var path = window.location.pathname;
				var filename = path.substring(path.lastIndexOf('/')+1);

				if (window.history.pushState){
					window.history.pushState({},name, filename + "?file=" + encodeURIComponent(url));
				}
			}


			var autoPlay = getUrlParameter("autoplay");
			if ((autoPlay == "true")  || (autoPlay == "1")){
				Tracker.playSong();
			}
		})
	};

	me.handleUpload = function(files){
		console.log("file uploaded");
		if (files.length){
			var file = files[0];

			var reader = new FileReader();
			reader.onload = function(){
				me.processFile(reader.result,file.name);
				UI.setStatus("Ready");
			};
			reader.readAsArrayBuffer(file);
		}
	};

	me.processFile = function(arrayBuffer, name){

		var isMod = false;
		var file = new BinaryStream(arrayBuffer,true);
		var result = FileDetector.detect(file,name);

		if (result.isMod && result.loader){
			isMod = true;
			if (me.isPlaying()) me.stop();
			resetDefaultSettings();

			song = result.loader().load(file,name);
			song.filename = name;

			onModuleLoad();

			//Audio.playSample(1);
		}

		if (result.isSample){
			me.importSample(file,name);
		}

		return isMod;

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

	me.setSample = function(index,sample){
		samples[index] = sample;
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


	// returns a binary stream
	me.buildBinary = function(type,next){


		type = type || MODULETYPE.mod;

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
				//TODO: show a warning when this is exceeded ...
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

		if (next) next(file);

	};

	function onModuleLoad(){
		UI.mainPanel.setPatternTable(song.patternTable);
		UI.setInfo(song.title);

		prevPatternPos = undefined;
		prevSampleIndex = undefined;
		prevPattern = undefined;
		prevSongPosition = undefined;

		me.setCurrentSongPosition(0);
		me.setCurrentPatternPos(0);
		me.setCurrentSampleIndex(1);

		me.clearEffectCache();

		EventBus.trigger(EVENT.songPropertyChange,song);
	}

	function resetDefaultSettings(){
		me.setAmigaSpeed(6);
		me.setBPM(125);

		vibratoFunction = Audio.waveFormFunction.sine;
		tremoloFunction = Audio.waveFormFunction.sine;

		trackEffectCache = [];
		trackNotes = [];
		for (var i=0;i<trackCount;i++){
			trackNotes.push({});
			trackEffectCache.push({});
		}
	}

	me.clearTrack = function(){
		var length = currentPatternData.length;
		for (var i = 0; i<length;i++){
			var note = song.patterns[currentPattern][i][currentTrack];
			if (note){
				note.sample = 0;
				note.period = 0;
				note.effect = 0;
				note.param = 0;
			}
		}
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};
	me.clearPattern = function(){
		var length = currentPatternData.length;
		for (var i = 0; i<length;i++){
			for (var j = 0; j<trackCount; j++){
				var note = song.patterns[currentPattern][i][j];
				if (note){
					note.sample = 0;
					note.period = 0;
					note.effect = 0;
					note.param = 0;
				}
			}
		}
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.copyTrack = function(trackNumber){
		var hasTracknumber = typeof trackNumber != "undefined";
		if (!hasTracknumber) trackNumber = currentPattern;
		var length = currentPatternData.length;
		var data = [];

		for (var i = 0; i<length;i++){
			var note = song.patterns[currentPattern][i][trackNumber];
			data.push({
				sample: note.sample,
				period : note.period,
				effect: note.effect,
				param: note.param
			});
		}
		if (hasTracknumber){
			return data;
		}else{
			pasteBuffer.track = data;
		}

	};

	me.copyPattern = function(){
		var data = [];

		for (var j = 0; j<trackCount; j++) {
			var row = me.copyTrack(j);
			data.push(row);
		}
		pasteBuffer.pattern = data;
	};


	me.getPasteData = function(){
		return pasteBuffer;
	};

	me.pasteTrack = function(trackNumber,trackData){
		var hasTracknumber = typeof trackNumber != "undefined";
		var data = trackData;
		if (!hasTracknumber) {
			trackNumber = currentTrack;
			data = pasteBuffer.track;
		}
		console.error("paste",trackNumber,data[0]);

		if (data){
			var length = currentPatternData.length;
			for (var i = 0; i<length;i++){
				var note = song.patterns[currentPattern][i][trackNumber];
				var source = data[i];
				note.sample = source.sample;
				note.period = source.period;
				note.effect = source.effect;
				note.param = source.param;
			}
			if (!hasTracknumber) EventBus.trigger(EVENT.patternChange,currentPattern);

			return true;
		}else{
			return false;
		}

	};

	me.pastePattern = function(){

		var data = pasteBuffer.pattern;
		if (data){
			for (var j = 0; j<trackCount; j++) {
				me.pasteTrack(j,data[j]);
			}
			EventBus.trigger(EVENT.patternChange,currentPattern);
			return true;
		}else{
			return false;
		}

	};

	me.clearEffectCache = function(){
		trackEffectCache = [];

		for (var i=0;i<trackCount;i++){
			trackEffectCache.push({});
		}
	};

	me.clearInstruments = function(){
		// samples
		var sampleContainer = [];
		for (i = 1; i <= 31; ++i) {
			samples[i] = getEmptySample();
			sampleContainer.push({label: i + " ", data: i});
		}
		song.samples = samples;
		UI.mainPanel.setInstruments(sampleContainer);
		EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
	};


	me.new = function(){
		resetDefaultSettings();
		song = {
			patterns:[],
			samples:[]
		};
		samples = [];

		song.typeId = "M.K.";
		song.title = "new song";
		song.length = 1;

		song.patterns.push(getEmptyPattern());
		me.clearInstruments();


		var patternTable = [];
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = 0;
		}
		song.patternTable = patternTable;



		onModuleLoad();
	};

	me.clearSample = function(){
		samples[currentSampleIndex]=getEmptySample();
		EventBus.trigger(EVENT.sampleChange,currentSampleIndex);
		EventBus.trigger(EVENT.sampleNameChange,currentSampleIndex);
	};

	me.getFileName = function(){
		return song.filename || (song.title ? song.title.replace(/ /g, '-').replace(/\W/g, '') + ".mod" : "new.mod");
	};

	function getEmptyPattern(){
		var result = [];
		for (var step = 0; step<patternLength; step++){
			var row = [];
			var channel;
			for (channel = 0; channel < 4; channel++){
				row.push({note:0,effect:0,sample:0,param:0});
			}
			result.push(row);
		}
		return result;
	}


	function getEmptySample(){
		return {
			length: 0,
			finetune: 0,
			volume : 100,
			loopStart: 0,
			loopRepeatLength: 0,
			name: "",
			data: []
		};
	}

	return me;
}());