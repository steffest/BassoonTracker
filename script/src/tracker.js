var periodNoteTable = {};
var periodFinetuneTable = {};
var nameNoteTable = {};
var noteNames = [];
var FTNotes = [];
var FTPeriods = [];

var Tracker = (function(){

	// TODO: strip UI stuff
	var me = {};
	me.isMaster = true;

	var clock;

	var isRecording = false;
	var isPlaying = false;

	var song;
	var instruments = [];

	var currentInstrumentIndex = 1;
	var prevInstrumentIndex;
	var currentPattern = 0;
	var prevPattern;
	var currentPatternPos = 0;
	var prevPatternPos;
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
	var trackerMode = TRACKERMODE.PROTRACKER;

	var swing = 0; // swing in milliseconds. NOTE: this is not part of any original Tracker format, just nice to have on beat sequences

	var trackNotes = [];
	var trackEffectCache = [];
	var trackerStates = [];
	var patternLoopStart = [];
	var patternLoopCount = [];
	
	//console.log("ticktime: " + tickTime);

	me.init = function(config){

		for (var i=0;i<trackCount;i++){
			trackNotes.push({});
			trackEffectCache.push({});
		}
		
		for (var i = -8; i<8;i++){
			periodFinetuneTable[i] = {};
		}

		for (var key in NOTEPERIOD){
			if (NOTEPERIOD.hasOwnProperty(key)){
				var note = NOTEPERIOD[key];
				periodNoteTable[note.period] = note;
				nameNoteTable[note.name] = note;
				noteNames.push(note.name);

				// build fineTune table
				if (note.tune){
					for (i = -8; i<8;i++){
						var table =  periodFinetuneTable[i];
						var index = i+8;
						table[note.tune[index]] = note.period;
					}
				}
			}
		}

		var ftCounter = 0;
		for (key in FTNOTEPERIOD){
			if (FTNOTEPERIOD.hasOwnProperty(key)){
				var ftNote = FTNOTEPERIOD[key];
				if (!ftNote.period) ftNote.period = 1;
				FTNotes.push(ftNote);
				FTPeriods[ftNote.period] = ftCounter;
				if (ftNote.modPeriod) FTPeriods[ftNote.modPeriod] = ftCounter;
				ftCounter++;
			}
		}

		if (config) {
			Host.init();
			Audio.init(config.audioContext,config.audioDestination);
			if (config.plugin){
				me.isPlugin = true;
				UI.initPlugin(config);
				if (typeof config.isMaster === "boolean") me.isMaster = config.isMaster;
				if (config.handler){
					EventBus.on(EVENT.songBPMChange,function(bpm){
						config.handler(EVENT.songBPMChange,bpm);
					});
					EventBus.on(EVENT.songBPMChangeIgnored,function(bpm){
						config.handler(EVENT.songBPMChangeIgnored,bpm);
					});



					EventBus.on(EVENT.songSpeedChange,function(speed){
						config.handler(EVENT.songSpeedChange,speed);
					});
					EventBus.on(EVENT.songSpeedChangeIgnored,function(speed){
						config.handler(EVENT.songSpeedChangeIgnored,speed);
					});


					EventBus.on(EVENT.patternEnd,function(time){
						config.handler(EVENT.patternEnd,time);
					});
				}
			}
		}

	};
	
	me.setMaster = function(value){
		me.isMaster = value;
	}

	me.isMaster = function(){
		return !!me.isMaster;
	}

	me.setCurrentInstrumentIndex = function(index){
		if (song.instruments[index]){
			currentInstrumentIndex = index;
			if (prevInstrumentIndex!=currentInstrumentIndex) EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
			prevInstrumentIndex = currentInstrumentIndex;
		}else{
			if (index<=me.getMaxInstruments()){
				for (var i = song.instruments.length, max = index;i<=max;i++){
					me.setInstrument(i,Instrument());
				}

				var instrumentContainer = [];
				for (i = 1;i<=max;i++){
					var instrument = song.instruments[i] || {name:""};
					instrumentContainer.push({label: i + " " + instrument.name, data: i});
					EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
				}

				currentInstrumentIndex = index;
				if (prevInstrumentIndex!=currentInstrumentIndex) EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
				prevInstrumentIndex = currentInstrumentIndex;
			}
		}
	};

	me.getCurrentInstrumentIndex = function(){
		return currentInstrumentIndex;
	};

	me.getCurrentInstrument = function(){
		return instruments[currentInstrumentIndex];
	};

	me.getMaxInstruments = function(){
		return me.inFTMode() ? 128 : 31;
	};

	me.setCurrentPattern = function(index){
		currentPattern = index;
		currentPatternData = song.patterns[currentPattern];

		if (!currentPatternData){
			// insert empty pattern;
			currentPatternData = getEmptyPattern();
			song.patterns[currentPattern] = currentPatternData;
		}
		patternLength = currentPatternData.length;
		if (prevPattern!=currentPattern) EventBus.trigger(EVENT.patternChange,currentPattern);
		prevPattern = currentPattern;
	};
	me.getCurrentPattern = function(){
		return currentPattern;
	};
	me.getCurrentPatternData = function(){
		return currentPatternData;
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
		if (prevPatternPos!=currentPatternPos) EventBus.trigger(EVENT.patternPosChange,{current: currentPatternPos, prev: prevPatternPos});
		prevPatternPos = currentPatternPos;
	};
	me.getCurrentPatternPos = function(){
		return currentPatternPos;
	};
	me.moveCurrentPatternPos = function(amount){
		var newPos = currentPatternPos + amount;
		var max = patternLength-1;
		if (newPos<0) newPos = max;
		if (newPos>max) newPos = 0;
		me.setCurrentPatternPos(newPos);
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

	me.setPlayType = function(playType){
		currentPlayType = playType;
		EventBus.trigger(EVENT.playTypeChange,currentPlayType);
	};
	me.getPlayType = function(){
		return currentPlayType;
	};

	me.playSong = function(){
		me.stop();
		Audio.checkState();
		//Audio.setMasterVolume(1);
		me.setPlayType(PLAYTYPE.song);
		isPlaying = true;
		//Audio.startRecording();
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.playPattern = function(){
		me.stop();
        Audio.checkState();
		//Audio.setMasterVolume(1);
		currentPatternPos = 0;
		me.setPlayType(PLAYTYPE.pattern);
		isPlaying = true;
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.stop = function(){
		if (clock) clock.stop();
		Audio.disable();
		if (!me.isPlugin) Audio.setMasterVolume(1);
		if (UI) {
			UI.setStatus("Ready");
			Input.clearInputNotes();
		}

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

	me.pause = function(){
		// this is only called when speed is set to 0
		if (clock) clock.stop();
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
		if (UI) UI.setStatus("Playing");
		patternLoopStart = [];
		patternLoopCount = [];

		currentPatternData = song.patterns[patternIndex];
		var thisPatternLength = currentPatternData.length;
		var stepResult = {};

		// look-ahead playback - far less demanding, works OK on mobile devices
		var p =  0;
		var time = Audio.context.currentTime + 0.1; //  add small delay to allow some time to render the first notes before playing


		// start with a small delay then make it longer
		// this is because Chrome on Android doesn't start playing until the first batch of scheduling is done?

		var delay = 0.2;
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
			Audio.clearScheduledNotesCache();


			while (time<maxTime){

				// ignore speed==0 when autoplay is active (Playlists)
                if(stepResult.pause && !Tracker.autoPlay){
                    // speed is set to 0
					if (!stepResult.pasuseHandled){
                        var delta = time - Audio.context.currentTime;
                        if (delta>0){
                        	setTimeout(function(){
                        		me.pause();
                        		// in Fasttracker this repeats the current step with the previous speed - including effects.
								// (which seems totally weird)
								me.setAmigaSpeed(6);
							},Math.round(delta*1000)+100);
						}
                        stepResult.pasuseHandled=true;
					}
					return;
                }
                
                me.setStateAtTime(time,{patternPos: p, songPos: playSongPosition});
                if (!UI) me.setCurrentSongPosition(playSongPosition);

				if (stepResult.patternDelay){
					// the E14 effect is used: delay Pattern but keep processing effects
					stepResult.patternDelay--;

					for (i = 0; i<trackCount; i++){
						applyEffects(i,time);
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
							if (nextPosition>=song.length) {
								nextPosition = song.restartPosition ? song.restartPosition-1 : 0;
								EventBus.trigger(EVENT.songEnd);
							}
							if (nextPosition>=song.length) nextPosition = 0;
							playSongPosition = nextPosition;
							patternIndex = song.patternTable[playSongPosition];
							playPatternData = song.patterns[patternIndex];

							// some invalid(?) XM files have non-existent patterns in their song list - eg. cybernautic_squierl.xm
							if (!playPatternData) {
								playPatternData =  getEmptyPattern();
								song.patterns[patternIndex] = playPatternData;
							}

                            thisPatternLength = playPatternData.length;
							if (stepResult.patternBreak){
								p = stepResult.targetPatternPosition || 0;
								if (p>playPatternData.length) p=0; // occurs in the wild - example "Lake Of Sadness" - last pattern
                            }
						}else{
							if (stepResult.patternBreak) {
								p = stepResult.targetPatternPosition || 0;
								if (p>patternLength) p=0;
							}
						}
						EventBus.trigger(EVENT.patternEnd,time - ticksPerStep * tickTime);
					}
				}

			}

			// check if a playing note has looping parameters that needs further scheduling

            for (i = 0; i<trackCount; i++){
                var trackNote = trackNotes[i];
                if (trackNote && trackNote.time && trackNote.scheduled){

					var instrument = me.getInstrument(trackNote.instrumentIndex);
					if(instrument){

					}

                	if (trackNote.scheduled.volume){
                		if ((time + delay) >= trackNote.scheduled.volume){
							var scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.volumeEnvelope,trackNote.scheduled.volume,2);
							trackNote.scheduled.volume += scheduledtime;
                        }
					}

					if (trackNote.scheduled.panning){
						if ((time + delay) >= trackNote.scheduled.panning){
							scheduledtime = instrument.scheduleEnvelopeLoop(trackNote.panningEnvelope,trackNote.scheduled.panning,2);
							trackNote.scheduled.panning += scheduledtime;
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
		var tracks = trackCount;
		var result = {};
		var r;

		// hmmm ... Whut?
		// The Speed setting influences other effects too,
		// on Amiga players the effects are processed each tick, so the speed setting on a later channel can influence the effects on a previous channel ...
		// This is implemented by setting the speed before all other effects
		// example: see the ED2 command pattern 0, track 3, step 32 in AceMan - Dirty Tricks.mod
		// not sure this is 100% correct, but in any case it's more correct then setting it at the track it self.
		// Thinking ... ... yes ... should be fine as no speed related effects are processed on tick 0?
		//
		

		for (var i = 0; i<tracks; i++){
			note = patternStep[i];
			if (note && note.effect && note.effect === 15){
				if (note.param < 32){
					//if (note.param == 0) note.param = 1;
					Tracker.setAmigaSpeed(note.param);
					if (note.param === 0) result.pause = true;
				}else{
					Tracker.setBPM(note.param)
				}
			}
		}
		// --- end Whut? ---



		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
			if (note){
                var songPos = {position: songPostition, step: step};

                var playtime = time;
                if (swing){
                    var swingTime = ((Math.random() * swing * 2) - swing) / 1000;
                    playtime += swingTime;
                }


                r = playNote(note,i,playtime,songPos);
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

		var instrumentIndex = note.instrument;
		var notePeriod = note.period;
		var noteIndex = note.index;


		if (notePeriod && !instrumentIndex){
			// reuse previous instrument
			instrumentIndex = trackNotes[track].currentInstrument;
			defaultVolume = typeof trackNotes[track].currentVolume === "number" ? trackNotes[track].currentVolume : defaultVolume;

			if (SETTINGS.emulateProtracker1OffsetBug && instrumentIndex && trackEffectCache[track].offset){
				if (trackEffectCache[track].offset.instrument === instrumentIndex){
					console.log("applying instrument offset cache to instrument " + instrumentIndex);
					trackEffects.offset = trackEffectCache[track].offset;
				}
			}
		}


		if (typeof note.instrument === "number"){
			instrument = me.getInstrument(note.instrument);
			if (instrument) {
				defaultVolume = 100 * (instrument.sample.volume/64);

				if (SETTINGS.emulateProtracker1OffsetBug){
					// reset instrument offset when a instrument number is present;
					trackEffectCache[track].offset = trackEffectCache[track].offset || {};
					trackEffectCache[track].offset.value = 0;
					trackEffectCache[track].offset.instrument = note.instrument;
				}
			}
		}



		var volume = defaultVolume;
		var doPlayNote = true;


		if (typeof instrumentIndex === "number"){
			instrument = me.getInstrument(instrumentIndex);
		}


		if (noteIndex && me.inFTMode()){

			if (noteIndex === 97) {
				noteIndex = NOTEOFF;
			}

			if (noteIndex === NOTEOFF){
				var offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
				if (offInstrument){
					volume = offInstrument.noteOff(time,trackNotes[track]);
				}else{
					console.log("no instrument on track " + track);
					volume = 0;
				}
				defaultVolume = volume;
				doPlayNote = false;
			}else{

				if (instrument){
					instrument.setSampleForNoteIndex(noteIndex);

					if (instrument.sample.relativeNote) noteIndex += instrument.sample.relativeNote;
					// TODO - check of note gets out of range
					// but apparently they still get played ... -> extend scale to 9, 10 or 11 octaves ?
					// see jt_letgo.xm instrument 6 (track 20) for example
				}

				if (me.useLinearFrequency){
					notePeriod = 7680 - (noteIndex-1)*64;
				}else{
					var ftNote = FTNotes[noteIndex];
					if (ftNote) notePeriod = ftNote.period;
				}
			}
		}


		var value = note.param;
		var x,y;

		var result = {};

        if (note.volumeEffect && me.inFTMode()){
        	var ve = note.volumeEffect;
            x = ve >> 4;
			y = ve & 0x0f;

            if (ve>15 && ve<=80){
                volume = ((ve-16)/64)*100;
                defaultVolume = volume;

				// note this is not relative to the default instrument volume but sets the instrument volume
				trackEffects.volume = {
					value: volume
				};
            }else{

            	switch(x){
					case 6:
						// volume slide down
                        trackEffects.fade = {
                            value: y * -1 * 100/64
                        };
						break;
					case 7:
						// volume slide up
                        trackEffects.fade = {
                            value: y * 100/64
                        };
						break;
					case 8:
						// Fine volume slide down
						trackEffects.fade = {
							value: -y * 100/64,
							fine: true
						};
						break;
					case 9:
						// Fine volume slide up
						trackEffects.fade = {
							value: y * 100/64,
							fine: true
						};
						break;
					case 10:
						// set vibrato speed
						console.warn("set vibrato speed not implemented");
						break;
					case 11:
						// Vibrato
						console.warn("Vibrato not implemented");
						break;
					case 12:
						// Set panning
						trackEffects.panning = {
							value: (ve-192)*17,
							slide: false
						};
						break;
					case 13:
						// Panning slide left
						console.warn("Panning slide left not implemented - track " + track);
						trackEffects.panning = {
							value: ve,
							slide: true
						};
						break;
					case 14:
						// Panning slide right
						console.warn("Panning slide right not implemented - track " + track);
						break;
					case 15:
						// Tone porta
						console.warn("Tone Porta not implemented");
						break;
				}
			}

        }

		switch(note.effect){
			case 0:
				// Arpeggio
				if (value){
					x = value >> 4;
					y = value & 0x0f;


					var finetune = 0;


					//todo: when a instrument index is present other than the previous index, but no note
					// how does this work?
					// see example just_about_seven.mod

                    instrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);

					if (me.inFTMode()){
                        if (instrument){
							var _noteIndex = noteIndex || trackNotes[track].noteIndex;
							var root = instrument.getPeriodForNote(_noteIndex,true);
                            if (noteIndex === NOTEOFF) {
                                trackEffects.arpeggio = trackEffectCache[track].arpeggio;
                            }else{
                                trackEffects.arpeggio = {
                                    root: root,
                                    interval1: root - instrument.getPeriodForNote(_noteIndex+x,true),
                                    interval2: root - instrument.getPeriodForNote(_noteIndex+y,true),
                                    step:1
                                };

                                trackEffectCache[track].arpeggio = trackEffects.arpeggio
							}
                        }
					}else{
                        root = notePeriod || trackNotes[track].startPeriod;
                        // check if the instrument is finetuned
                        if (instrument){
                            finetune = instrument.getFineTune();
                            if (finetune) root = Audio.getFineTuneForPeriod(root,finetune);
                        }

                        trackEffects.arpeggio = {
                            root: root,
                            interval1: root-Audio.getSemiToneFrom(root,x,finetune),
                            interval2: root-Audio.getSemiToneFrom(root,y,finetune),
                            step:1
                        };
					}


				}

				// set volume, even if no effect present
				// note: this is consistent with the Protracker 3.15 and later playback
				// on Protracker 2.3 and 3.0, the volume effect seems much bigger - why ? (see "nugget - frust.mod")
				if (note.instrument){
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

				if (me.inFTMode()){
					if (!value && trackEffectCache[track].slideUp) value = trackEffectCache[track].slideUp.value;
				}

				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideUp = trackEffects.slide;
				break;
			case 2:
				// Slide Down

				// note: on protracker 2 and 3 , the effectcache is NOT used on this effect
				// it is on Milkytracker (in all playback modes)

				if (me.inFTMode()){
					if (!value && trackEffectCache[track].slideDown) value = trackEffectCache[track].slideDown.value;
				}

				trackEffects.slide = {
					value: value
				};
				trackEffectCache[track].slideDown = trackEffects.slide;
				break;
			case 3:
				// Slide to Note - if there's a note provided, it is not played directly,
				// if the instrument number is set, the default volume of that instrument will be set

				// if value == 0 then the old slide will continue

				doPlayNote = false;
				// note: protracker2 switches samples on the fly if the instrument index is different from the previous instrument ...
				// Should we implement that?
				// fasttracker does not.
				// protracker 3 does not
				// milkytracker tries, but not perfect
				// the ProTracker clone of 8bitbubsy does this completely compatible to protracker2.

				var target = notePeriod;
				if (me.inFTMode() && noteIndex === NOTEOFF) target = 0;

				// avoid using the fineTune of another instrument if another instrument index is present
				if (trackNotes[track].currentInstrument) instrumentIndex = trackNotes[track].currentInstrument;

				if (target && instrumentIndex){
					// check if the instrument is finetuned
					var instrument = me.getInstrument(instrumentIndex);
					if (instrument && instrument.getFineTune()){
                        target = me.inFTMode() ?  instrument.getPeriodForNote(noteIndex,true) : Audio.getFineTuneForPeriod(target,instrument.getFineTune());
					}
				}

				var prevSlide = trackEffectCache[track].slide;

				if (prevSlide){
					if (!value) value = prevSlide.value;
				}
				if (!target) {
					target = trackEffectCache[track].defaultSlideTarget;
				}

				trackEffects.slide = {
					value: value,
					target: target,
					canUseGlissando: true,
					resetVolume: !!note.instrument,
					volume: defaultVolume
				};
				trackEffectCache[track].slide = trackEffects.slide;

				if (note.instrument){
					trackEffects.volume = {
						value: defaultVolume
					};
				}

				break;
			case 4:
				// vibrato
				// reset volume and vibrato timer if instrument number is present
				if (note.instrument) {
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
				target = notePeriod;

				if (target && instrumentIndex){
					// check if the instrument is finetuned
					instrument = me.getInstrument(instrumentIndex);
					if (instrument && instrument.getFineTune()){
						// TODO - in FT mode - should we use getFineTuneForBote even when linearFrequency is used ?
                        target = me.inFTMode() ?  Audio.getFineTuneForNote(noteIndex,instrument.getFineTune()) : Audio.getFineTuneForPeriod(target,instrument.getFineTune());
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

				if (note.instrument){
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
						resetOnStep: !!note.instrument // volume only needs resetting when the instrument number is given, other wise the volue is remembered from the preious state
					};
					trackEffectCache[track].fade = trackEffects.fade;
				}

				break;


			case 6:
				// Continue Vibrato and do volume slide

				// reset volume and vibrato timer if instrument number is present
				if (note.instrument) {
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
				}else{
					// on Fasttracker this command is remembered - on Protracker it is not.
					if (Tracker.inFTMode()){
						if (trackEffectCache[track].fade) trackEffects.fade = trackEffectCache[track].fade;
					}
				}

				if (trackEffectCache[track].vibrato) trackEffects.vibrato = trackEffectCache[track].vibrato;
				break;
			case 7:
				// Tremolo
				// note: having a instrument number without a period doesn't seem te have any effect (protracker)
				// when only a period -> reset the wave form / timer

				if (notePeriod && !note.instrument) {
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
				trackEffects.panning = {
					value:value,
					slide: false
				};
				break;
			case 9:
				// Set instrument offset

				/* quirk in Protracker 1 and 2 ?
				 if NO NOTE is given but a instrument number is present,
				 then the offset is remembered for the next note WITHOUT instrument number
				 but only when the derived instrument number is the same as the offset instrument number
				 see "professional tracker" mod for example

				 also:
				 * if no instrument number is present: don't reset the offset
				  -> the effect cache of the previous 9 command of the instrument is used
				 * if a note is present REAPPLY the offset in the effect cache (but don't set start of instrument)
				  -> the effect cache now contains double the offset

				 */

				value =  value << 8 ;
				if (!value && trackEffectCache[track].offset){
					value = trackEffectCache[track].offset.stepValue || trackEffectCache[track].offset.value || 0;
				}
				var stepValue = value;

				if (SETTINGS.emulateProtracker1OffsetBug && !note.instrument && trackEffectCache[track].offset){
					// bug in PT1 and PT2: add to existing offset if no instrument number is given
					value += trackEffectCache[track].offset.value;
				}

				trackEffects.offset = {
					value: value,
					stepValue: stepValue
				};

				// note: keep previous trackEffectCache[track].offset.instrument intact
				trackEffectCache[track].offset = trackEffectCache[track].offset || {};
				trackEffectCache[track].offset.value = trackEffects.offset.value;
				trackEffectCache[track].offset.stepValue = trackEffects.offset.stepValue;


				if (SETTINGS.emulateProtracker1OffsetBug){

					// quirk in PT1 and PT2: remember instrument offset for instrument
					if (note.instrument) {
						//console.log("set offset cache for instrument " + note.instrument);
						trackEffectCache[track].offset.instrument = note.instrument;
					}

					// bug in PT1 and PT2: re-apply instrument offset in effect cache
					if (notePeriod) {
						//console.log("re-adding offset in effect cache");
						trackEffectCache[track].offset.value += stepValue;
					}

				}

				if (note.instrument){
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
					resetOnStep: !!note.instrument // volume only needs resetting when the instrument number is given, otherwise the volume is remembered from the previous state
				};

				//!!! in FT2 this effect is remembered - in Protracker it is not
				if (me.inFTMode()){
					trackEffectCache[track].fade = trackEffects.fade;
				}

				break;
			case 11:
				// Position Jump

				// quickfix for autoplay ...
				if (!Tracker.autoPlay){
					result.patternBreak = true;
					result.positionBreak = true;
					result.targetSongPosition = note.param;
					result.targetPatternPosition = 0;
				}
				break;
			case 12:
				//volume
				volume = (note.param/64)*100;
				// not this is not relative to the default instrument volume but sets the instrument volume
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
				break;
			case 14:
				// Subeffects
				var subEffect = value >> 4;
				var subValue = value & 0x0f;
					switch (subEffect){
						case 0:
							if (!me.inFTMode()) Audio.setAmigaLowPassFilter(!subValue,time);
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
						case 2: // Fine slide down
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
							if (instrumentIndex){
								var instrument = me.getInstrument(instrumentIndex);
								trackEffects.fineTune = {
									original: instrument.getFineTune(),
									instrument: instrument
								};
								instrument.setFineTune(subValue);
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
				// Note: shouldn't this be "set speed at time" instead of setting it directly?
				// TODO: -> investigate
				// TODO: Yes ... this is actually quite wrong FIXME !!!!
				
				// Note 2: this hase moved to the beginning of the "row" sequence:
				// we scan all tracks for tempo changes and set them before processing any other command.
				// this is consistant with PT and FT

				//if (note.param < 32){
				//	//if (note.param == 0) note.param = 1;
				//	Tracker.setAmigaSpeed(note.param,time);
				//}else{
				//	Tracker.setBPM(note.param)
				//}
				break;

            case 16:
                //Fasttracker only - global volume
				value = Math.min(value,64);
				if (!me.isPlugin) Audio.setMasterVolume(value/64,time);
                break;
			case 17:
				//Fasttracker only - global volume slide

				x = value >> 4;
				y = value & 0x0f;
				var currentVolume = Audio.getLastMasterVolume()*64;

				var amount = 0;
				if (x){
					var targetTime = time + (x * tickTime);
					amount = x*(ticksPerStep-1);
				}else if (y){
					targetTime = time + (y * tickTime);
					amount = -y*(ticksPerStep-1);
				}

				if (amount){
					value = (currentVolume+amount)/64;
					value = Math.max(0,value);
					value = Math.min(1,value);

					Audio.slideMasterVolume(value,targetTime);
				}

				break;
			case 20:
				//Fasttracker only - Key off
				if (me.inFTMode()){
					offInstrument = instrument || me.getInstrument(trackNotes[track].currentInstrument);
					if (note.param && note.param>=ticksPerStep){
						// ignore: delay is too large
					}else{
						doPlayNote = false;
						if (offInstrument){
							if (note.param){
								trackEffects.noteOff = {
									value: note.param
								}
								doPlayNote = true;
							}else{
								volume = offInstrument.noteOff(time,trackNotes[track]);
								defaultVolume = volume;
							}
						}else{
							console.log("no instrument on track " + track);
							defaultVolume = 0;
						}
					}
				}
				break;
            case 21:
                //Fasttracker only - Set envelope position
                console.warn("Set envelope position not implemented");
                break;
			case 25:
				//Fasttracker only - Panning slide
				console.warn("Panning slide not implemented - track " + track);
				break;
			case 27:
				//Fasttracker only - Multi retrig note
				// still not 100% sure how this is supposed to work ...
				// see https://forum.openmpt.org/index.php?topic=4999.15
				// see lupo.xm for an example (RO1 command)
				trackEffects.reTrigger = {
					value: note.param
				};
				break;
			case 29:
				//Fasttracker only - Tremor
				console.warn("Tremor not implemented");
				break;
			case 33:
				//Fasttracker only - Extra fine porta
				console.warn("Extra fine porta not implemented");
				break;
			default:
				console.warn("unhandled effect: " + note.effect);
		}

		if (doPlayNote && instrumentIndex && notePeriod){
			// cut off previous note on the same track;
			cutNote(track,time);
			trackNotes[track] = {};

			if (instrument){
				trackNotes[track] = instrument.play(noteIndex,notePeriod,volume,track,trackEffects,time);
			}

			//trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
			trackEffectCache[track].defaultSlideTarget = trackNotes[track].startPeriod;
		}


		if (instrumentIndex) {
			trackNotes[track].currentInstrument =  instrumentIndex;

			// reset temporary instrument settings
			if (trackEffects.fineTune && trackEffects.fineTune.instrument){
				trackEffects.fineTune.instrument.setFineTune(trackEffects.fineTune.original || 0);
			}
		}

		if (instrument && instrument.hasVibrato()){
            trackNotes[track].hasAutoVibrato = true;
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
	me.cutNote = cutNote;

	function applyAutoVibrato(trackNote,currentPeriod){

        var instrument = me.getInstrument(trackNote.instrumentIndex);
        if (instrument){
            var _freq = -instrument.vibrato.rate/40;
            var _amp = instrument.vibrato.depth/8;
            if (me.useLinearFrequency) _amp *= 4;
            trackNote.vibratoTimer = trackNote.vibratoTimer||0;

            if (instrument.vibrato.sweep && trackNote.vibratoTimer<instrument.vibrato.sweep){
                var sweepAmp = 1-((instrument.vibrato.sweep-trackNote.vibratoTimer)/instrument.vibrato.sweep);
                _amp *= sweepAmp;
            }
            var instrumentVibratoFunction = instrument.getAutoVibratoFunction();
            var targetPeriod = instrumentVibratoFunction(currentPeriod,trackNote.vibratoTimer,_freq,_amp);
            trackNote.vibratoTimer++;
            return targetPeriod
        }
        return currentPeriod;
	}

	function applyEffects(track,time){

		var trackNote = trackNotes[track];
		var effects = trackNote.effects;

		if (!trackNote) return;
		if (!effects) return;

		var value;
		var autoVibratoHandled = false;

        trackNote.startVibratoTimer = trackNote.vibratoTimer||0;

        if (trackNote.resetPeriodOnStep && trackNote.source){
			// vibrato or arpeggio is done
			// for slow vibratos it seems logical to keep the current frequency, but apparently most trackers revert back to the pre-vibrato one
			var targetPeriod = trackNote.currentPeriod || trackNote.startPeriod;
			me.setPeriodAtTime(trackNote,targetPeriod,time);
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

		if (effects.panning){
			value = effects.panning.value;
			if (value === 255) value = 254;
			if (trackNote.panning){
				trackNote.panning.pan.setValueAtTime((value-127)/127,time);
			}
		}

		if (effects.fade){
			value = effects.fade.value;
			var currentVolume;
			var startTick = 1;

			if (effects.fade.resetOnStep){
				currentVolume = trackNote.startVolume;
			}else{
				currentVolume = trackNote.currentVolume;
			}

			var steps = ticksPerStep;
			if (effects.fade.fine){
				// fine Volume Up or Down
				startTick = 0;
				steps = 1;
			}

			for (var tick = startTick; tick < steps; tick++){
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
				var targetPeriod = currentPeriod;


				var steps = ticksPerStep;
				if (effects.slide.fine){
					// fine Slide Up or Down
					steps = 2;
				}

				var slideValue = effects.slide.value;
				if (me.inFTMode() && me.useLinearFrequency) slideValue = effects.slide.value*4;
				value = Math.abs(slideValue);

				//console.error(currentPeriod,slideValue);

				if (me.inFTMode() && effects.slide.resetVolume && (trackNote.volumeFadeOut || trackNote.volumeEnvelope)){
					// crap ... this should reset the volume envelope to the beginning ... annoying ...
					var instrument = me.getInstrument(trackNote.instrumentIndex);
					if (instrument) instrument.resetVolume(time,trackNote);

				}

                trackNote.vibratoTimer = trackNote.startVibratoTimer;

				// TODO: Why don't we use a RampToValueAtTime here ?
				for (var tick = 1; tick < steps; tick++){
					if (effects.slide.target){
						trackEffectCache[track].defaultSlideTarget = effects.slide.target;
						if (targetPeriod<effects.slide.target){
							targetPeriod += value;
							if (targetPeriod>effects.slide.target) targetPeriod = effects.slide.target;
						}else{
							targetPeriod -= value;
							if (targetPeriod<effects.slide.target) targetPeriod = effects.slide.target;
						}
					}else{
						targetPeriod += slideValue;
						if (trackEffectCache[track].defaultSlideTarget) trackEffectCache[track].defaultSlideTarget += slideValue;
					}

					if (!me.inFTMode()) targetPeriod = Audio.limitAmigaPeriod(targetPeriod);

					var newPeriod = targetPeriod;
					if (effects.slide.canUseGlissando && trackEffectCache[track].glissando){
						newPeriod = Audio.getNearestSemiTone(targetPeriod,trackNote.instrumentIndex);
					}

					//console.error("***");
					//console.error(targetPeriod);

					if (targetPeriod !== trackNote.currentPeriod){
						trackNote.currentPeriod = targetPeriod;

                        if (trackNote.hasAutoVibrato && me.inFTMode()){
                            targetPeriod = applyAutoVibrato(trackNote,newPeriod);
                            autoVibratoHandled = true;
                        }
						me.setPeriodAtTime(trackNote,newPeriod,time + (tick*tickTime));

					}
				}
			}
		}

		if (effects.arpeggio){
			if (trackNote.source){

				var currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
				var targetPeriod;

				trackNote.resetPeriodOnStep = true;
                trackNote.vibratoTimer = trackNote.startVibratoTimer;

				for (var tick = 0; tick < ticksPerStep; tick++){
					var t = tick%3;

					if (t == 0) targetPeriod = currentPeriod;
					if (t == 1 && effects.arpeggio.interval1) targetPeriod = currentPeriod - effects.arpeggio.interval1;
					if (t == 2 && effects.arpeggio.interval2) targetPeriod = currentPeriod - effects.arpeggio.interval2;

                    if (trackNote.hasAutoVibrato && me.inFTMode()){
                        targetPeriod = applyAutoVibrato(trackNote,targetPeriod);
                        autoVibratoHandled = true;
                    }

                    me.setPeriodAtTime(trackNote,targetPeriod,time + (tick*tickTime));

				}
			}
		}

		if (effects.vibrato || (trackNote.hasAutoVibrato && !autoVibratoHandled)){
            effects.vibrato = effects.vibrato || {freq:0,amplitude:0};
			var freq = effects.vibrato.freq;
			var amp = effects.vibrato.amplitude;
			if (me.inFTMode() && me.useLinearFrequency) amp *= 4;

			trackNote.vibratoTimer = trackNote.vibratoTimer||0;

			if (trackNote.source) {
				trackNote.resetPeriodOnStep = true;
				currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;

                trackNote.vibratoTimer = trackNote.startVibratoTimer;
				for (var tick = 0; tick < ticksPerStep; tick++) {
					targetPeriod = vibratoFunction(currentPeriod,trackNote.vibratoTimer,freq,amp);

					// should we add or average the 2 effects?
					if (trackNote.hasAutoVibrato && me.inFTMode()){
                        targetPeriod = applyAutoVibrato(trackNote,targetPeriod);
                        autoVibratoHandled = true;
					}else{
                        trackNote.vibratoTimer++;
					}

					// TODO: if we ever allow multiple effect on the same tick then we should rework this as you can't have concurrent "setPeriodAtTime" commands
					me.setPeriodAtTime(trackNote,targetPeriod,time + (tick*tickTime));

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
			if (trackNote.volume) {
				trackNote.volume.gain.setValueAtTime(0,time + (effects.cutNote.value*tickTime));
			}
			trackNote.currentVolume = 0;
		}

		if (effects.noteOff){
			var instrument = me.getInstrument(trackNote.instrumentIndex);
			if (instrument){
				trackNote.currentVolume = instrument.noteOff(time + (effects.noteOff.value*tickTime),trackNote);
			}
		}

		if (effects.reTrigger){
			var instrumentIndex = trackNote.instrumentIndex;
			var notePeriod = trackNote.startPeriod;
			volume = trackNote.startVolume;
			var noteIndex = trackNote.noteIndex;

			var triggerStep = effects.reTrigger.value || 1;
			var triggerCount = triggerStep;
			while (triggerCount<ticksPerStep){
				var triggerTime = time + (triggerCount * tickTime);
				cutNote(track,triggerTime);
				trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,effects,triggerTime,noteIndex);
				triggerCount += triggerStep;
			}
		}

	}




	me.setBPM = function(newBPM,sender){
		var fromMaster = (sender && sender.isMaster); 
		if (me.isMaster || fromMaster){
			console.log("set BPM: " + bpm + " to " + newBPM);
			if (clock) clock.timeStretch(Audio.context.currentTime, [mainTimer], bpm / newBPM);
			if (!fromMaster) EventBus.trigger(EVENT.songBPMChangeIgnored,bpm);
			bpm = newBPM;
			tickTime = 2.5/bpm;
			EventBus.trigger(EVENT.songBPMChange,bpm);
		}else{
			EventBus.trigger(EVENT.songBPMChangeIgnored,newBPM);
		}
	};
	
	me.getBPM = function(){
		return bpm;
	};

	me.setAmigaSpeed = function(speed,sender){
		// 1 tick is 0.02 seconds on a PAL Amiga
		// 4 steps is 1 beat
		// the speeds sets the amount of ticks in 1 step
		// default is 6 -> 60/(6*0.02*4) = 125 bpm

		var fromMaster = (sender && sender.isMaster);
		if (me.isMaster || fromMaster){
			//note: this changes the speed of the song, but not the speed of the main loop
			ticksPerStep = speed;
			EventBus.trigger(EVENT.songSpeedChange,speed);
		}else{
			EventBus.trigger(EVENT.songSpeedChangeIgnored,speed);
		}

		
	};

	me.getAmigaSpeed = function(){
		return ticksPerStep;
	};

	me.getSwing = function(){
		return swing;
	};

	me.setSwing = function(newSwing){
		swing = newSwing;
	};

	me.getPatternLength = function(){
		return patternLength;
	};

	me.setPatternLength = function(value){
		patternLength = value;

		var currentLength = song.patterns[currentPattern].length;
		if (currentLength === patternLength) return;

		if (currentLength < patternLength){
			for (var step = currentLength; step<patternLength; step++){
				var row = [];
				var channel;
				for (channel = 0; channel < trackCount; channel++){
					row.push(Note());
				}
				song.patterns[currentPattern].push(row);
			}
		}else{
			song.patterns[currentPattern] = song.patterns[currentPattern].splice(0,patternLength);
			if (currentPatternPos>=patternLength){
				me.setCurrentPatternPos(patternLength-1);
			}
		}


		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.getTrackCount = function(){
		return trackCount;
	};

	me.setTrackCount = function(count){
		trackCount = count;

		for (var i=trackNotes.length;i<trackCount;i++) trackNotes.push({});
		for (i=trackEffectCache.length;i<trackCount;i++) trackEffectCache.push({});

		EventBus.trigger(EVENT.trackCountChange,trackCount);
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

	me.getTimeStates = function(){
		return trackerStates;
	};

	me.setPeriodAtTime = function(trackNote,period,time){
        // TODO: shouldn't we always set the full samplerate from the period?

		period = Math.max(period,1);

        if (me.inFTMode() && me.useLinearFrequency){
            var sampleRate = (8363 * Math.pow(2,((4608 - period) / 768)));
            var rate = sampleRate / Audio.context.sampleRate;
        }else{
            rate = (trackNote.startPeriod / period);
            rate = trackNote.startPlaybackRate * rate;
        }

        // note - seems to be a weird bug in chrome ?
        // try setting it twice with a slight delay
        // TODO: retest on Chrome windows and other browsers
        trackNote.source.playbackRate.setValueAtTime(rate,time);
        trackNote.source.playbackRate.setValueAtTime(rate,time + 0.005);
	};

	me.load = function(url,skipHistory,next,initial){
		url = url || "demomods/StardustMemories.mod";

		if (url.indexOf("://")<0 && url.indexOf("/") !== 0) url = Host.getBaseUrl() + url;

		if (UI){
			UI.setInfo("");
			UI.setLoading();
		}

		var process=function(result){

			// initial file is overridden by a load command of the host;
			if (initial && !Host.useInitialLoad) return;

			me.processFile(result,name,function(isMod){
				if (UI) UI.setStatus("Ready");

				if (isMod){
					var infoUrl = "";
					var source = "";

					if (typeof url === "string"){
						if (url.indexOf("modarchive.org")>0){
							var id = url.split('moduleid=')[1];
							song.filename = id.split("#")[1] || id;
							id = id.split("#")[0];
							id = id.split("&")[0];

							source = "modArchive";
							infoUrl = "https://modarchive.org/index.php?request=view_by_moduleid&query=" + id;
							EventBus.trigger(EVENT.songPropertyChange,song);
						}

						if (url.indexOf("modules.pl")>0){
							id = url.split('modules.pl/')[1];
							song.filename = id.split("#")[1] || id;
							id = id.split("#")[0];
							id = id.split("&")[0];

							source = "modules.pl";
							infoUrl = "http://www.modules.pl/?id=module&mod=" + id;
							EventBus.trigger(EVENT.songPropertyChange,song);
						}

						if (url.indexOf("&path=")>0){
							id = url.split('&path=')[1];
							id = id.split(":")[1] || id;
							id = id.split("#")[0];
							id = id.split("&")[0];
							song.filename = id;
							EventBus.trigger(EVENT.songPropertyChange,song);
						}
					}

					if (UI) UI.setInfo(song.title,source,infoUrl);
				}

				if (UI && isMod && !skipHistory){

					var path = window.location.pathname;
					var filename = path.substring(path.lastIndexOf('/')+1);

					if (window.history.pushState){
						window.history.pushState({},name, filename + "?file=" + encodeURIComponent(url));
					}
				}

				if (isMod)checkAutoPlay(skipHistory);
				if (next) next();
			});
		};

		var name = "";
		if (typeof url === "string"){
			name = url.substr(url.lastIndexOf("/")+1);
			loadFile(url,function(result){
				process(result);
			})
		}else{
			name = url.name || "";
			skipHistory = true;
			process(url.buffer || url);
		}

	};

	var checkAutoPlay = function(skipHistory){
		var autoPlay = getUrlParameter("autoplay");
		if (Tracker.autoPlay) autoPlay = "1";
		if (!UI && skipHistory) autoPlay = "1";
		if ((autoPlay == "true")  || (autoPlay == "1")){
			Tracker.playSong();
		}
	};

	me.handleUpload = function(files){
		console.log("file uploaded");
		if (files.length){
			var file = files[0];

			var reader = new FileReader();
			reader.onload = function(){
				me.processFile(reader.result,file.name,function(isMod){
					if (UI) UI.setStatus("Ready");
				});
			};
			reader.readAsArrayBuffer(file);
		}
	};

	me.processFile = function(arrayBuffer, name , next){

		var isMod = false;
		var file = new BinaryStream(arrayBuffer,true);
		var result = FileDetector.detect(file,name);
		

		if (result && result.name == "ZIP"){
			console.log("extracting zip file");

			if (UI) UI.setStatus("Extracting Zip file",true);
			if (typeof UZIP !== "undefined") {
				// using UZIP: https://github.com/photopea/UZIP.js
				var myArchive = UZIP.parse(arrayBuffer);
				console.log(myArchive);
				for (var name in myArchive) {
					me.processFile(myArchive[name].buffer, name, next);
					break; // just use first entry
				}
			} else {
				// if UZIP wasn't loaded use zip.js
				zip.workerScriptsPath = "script/src/lib/zip/";
				zip.useWebWorkers = Host.useWebWorkers;
	
				//ArrayBuffer Reader and Write additions: https://github.com/gildas-lormeau/zip.js/issues/21
	
				zip.createReader(new zip.ArrayBufferReader(arrayBuffer), function(reader) {
					var zipEntry;
					var size = 0;
					reader.getEntries(function(entries) {
						if (entries && entries.length){
							entries.forEach(function(entry){
								if (entry.uncompressedSize>size){
									size = entry.uncompressedSize;
									zipEntry = entry;
								}
							});
						}
						if (zipEntry){
							zipEntry.getData(new zip.ArrayBufferWriter,function(data){
								if (data && data.byteLength) {
									me.processFile(data,name,next);
								}
							})
						}else{
							console.error("Zip file could not be read ...");
							if (next) next(false);
						}
					});
				}, function(error) {
					console.error("Zip file could not be read ...");
					if (next) next(false);
				});
			}
		}

		if (result.isMod && result.loader){
			isMod = true;
			if (me.isPlaying()) me.stop();
			resetDefaultSettings();

			song = result.loader().load(file,name);
			song.filename = name;

			onModuleLoad();

		}

		if (result.isSample){
			// check for player only lib
			if (typeof Editor !== "undefined") {
				Editor.importSample(file,name);
			}
		}

		if (next) next(isMod);

	};

	me.getSong = function(){
		return song;
	};

	me.getInstruments = function(){
		return instruments;
	};

	me.getInstrument = function(index){
		return instruments[index];
	};

	me.setInstrument = function(index, instrument){
		instrument.instrumentIndex = index;
		instruments[index] = instrument;
	};


	function onModuleLoad(){
		if (UI) UI.setInfo(song.title);

		if (song.channels) me.setTrackCount(song.channels);

		prevPatternPos = undefined;
		prevInstrumentIndex = undefined;
		prevPattern = undefined;
		prevSongPosition = undefined;

		me.setCurrentSongPosition(0);
		me.setCurrentPatternPos(0);
		me.setCurrentInstrumentIndex(1);

		me.clearEffectCache();

		EventBus.trigger(EVENT.songLoaded,song);
		EventBus.trigger(EVENT.songPropertyChange,song);
	}

	function resetDefaultSettings(){
		EventBus.trigger(EVENT.songBPMChangeIgnored,0);
		EventBus.trigger(EVENT.songSpeedChangeIgnored,0);
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
		me.useLinearFrequency = false;
		me.setTrackerMode(TRACKERMODE.PROTRACKER,true);
		if (!me.isPlugin) Audio.setMasterVolume(1);
		Audio.setAmigaLowPassFilter(false,0);
		if (typeof StateManager !== "undefined") StateManager.clear();
	}

	me.clearEffectCache = function(){
		trackEffectCache = [];

		for (var i=0;i<trackCount;i++){
			trackEffectCache.push({});
		}
	};

	me.clearInstruments = function(count){
		if (!song) return;
		var instrumentContainer = [];
		var max  = count || song.instruments.length-1;
        instruments = [];
		for (i = 1; i <= max; i++) {
            me.setInstrument(i,Instrument());
			instrumentContainer.push({label: i + " ", data: i});
		}
		song.instruments = instruments;

		EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
	};

	me.setTrackerMode = function(mode,force){

		var doChange = function(){
			trackerMode = mode;
			SETTINGS.emulateProtracker1OffsetBug = !me.inFTMode();
			EventBus.trigger(EVENT.trackerModeChanged,mode);
		}

		//do some validation when changing from FT to MOD
		if (mode === TRACKERMODE.PROTRACKER && !force){
			if (Tracker.getInstruments().length>32){
				UI.showDialog("WARNING !!!//This file has more than 31 instruments./If you save this file as .MOD, only the first 31 instruments will be included.//Are you sure you want to continue?",function(){
					doChange();
				},function(){

				});
			}else{
				doChange();
			}
		}else{
			doChange();
		}
	};
	me.getTrackerMode = function(){
		return trackerMode;
	};
	me.inFTMode = function(){
		return trackerMode === TRACKERMODE.FASTTRACKER
	};


	me.new = function(){
		resetDefaultSettings();
		song = {
			patterns:[],
			instruments:[]
		};
        me.clearInstruments(31);

		song.typeId = "M.K.";
		song.title = "new song";
		song.length = 1;
		song.restartPosition = 0;

		song.patterns.push(getEmptyPattern());

		var patternTable = [];
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = 0;
		}
		song.patternTable = patternTable;

		onModuleLoad();
	};


	me.clearInstrument = function(){
		instruments[currentInstrumentIndex]=Instrument();
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
		EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);
	};

	me.getFileName = function(){
		return song.filename || (song.title ? song.title.replace(/ /g, '-').replace(/\W/g, '') + ".mod" : "new.mod");
	};

	function getEmptyPattern(){
		var result = [];
		for (var step = 0; step<patternLength; step++){
			var row = [];
			var channel;
			for (channel = 0; channel < trackCount; channel++){
				row.push(Note());
			}
			result.push(row);
		}
		return result;
	}

	me.useLinearFrequency = true;



	return me;
}());
