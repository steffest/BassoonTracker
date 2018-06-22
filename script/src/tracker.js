var periodNoteTable = {};
var periodFinetuneTable = {};
var nameNoteTable = {};
var noteNames = [];
var FTNotes = [];
var FTPeriods = [];

var Tracker = (function(){

	// TODO: strip UI stuff
	var me = {};

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
	var trackerMode = TRACKERMODE.PROTRACKER;

	var swing = 0; // swing in milliseconds. NOTE: this is not part of any original Tracker format, just nice to have on beat sequences

	var pasteBuffer = {};

	var tracks = getUrlParameter("tracks");
	if (tracks == 8) trackCount = 8;
	if (tracks == 16) trackCount = 16;
	if (tracks == 22) trackCount = 22;
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

	me.init = function(config){
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
				if (ftNote.modperiod) FTPeriods[ftNote.modperiod] = ftCounter;
				ftCounter++;
			}
		}

		if (config) {
			Audio.init();
			if (config.plugin) UI.initPlugin(config);
		}

	};

	me.setCurrentInstrumentIndex = function(index){
		if (song.instruments[index]){
			currentInstrumentIndex = index;
			if (prevInstrumentIndex!=currentInstrumentIndex) EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
			prevInstrumentIndex = currentInstrumentIndex;
		}
	};

	me.getCurrentInstrumentIndex = function(){
		return currentInstrumentIndex;
	};

	me.getCurrentInstrument = function(){
		return instruments[currentInstrumentIndex];
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

		var stepsPerTrack = me.inFTMode() ? 8 : 6;

		currentTrack = Math.floor(currentCursorPosition / stepsPerTrack);
		currentTrackPosition = currentCursorPosition % stepsPerTrack;
		if (prevCursorPosition!=currentCursorPosition) EventBus.trigger(EVENT.cursorPositionChange,currentCursorPosition);
		prevCursorPosition = currentTrackPosition;
	};
	me.getCurrentCursorPosition = function(){
		return currentCursorPosition;
	};
	me.moveCursorPosition = function(amount){
		var stepsPerTrack = me.inFTMode() ? 8 : 6;

		var newPosition = currentCursorPosition+amount;
		var max = trackCount*stepsPerTrack - 1;
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
		Audio.checkState();
		me.setPlayType(PLAYTYPE.song);
		isPlaying = true;
		//Audio.startRecording();
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.playPattern = function(){
		me.stop();
        Audio.checkState();
		currentPatternPos = 0;
		me.setPlayType(PLAYTYPE.pattern);
		isPlaying = true;
		playPattern(currentPattern);
		EventBus.trigger(EVENT.playingChange,isPlaying);
	};

	me.stop = function(){
		if (clock) clock.stop();
		Audio.disable();
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

	me.save = function(filename,target){
		console.error(target);
		me.buildBinary(me.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){
			var b = new Blob([file.buffer], {type: "application/octet-stream"});

			var fileName = filename || me.getFileName();

			if (target === "dropbox"){
				Dropbox.putFile("/" + fileName,b);
			}else{
				saveAs(b,fileName);
			}
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
		if (UI) UI.setStatus("Playing");
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
                            thisPatternLength = playPatternData.length;
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

		// hmmm ... Whut?
		// The Speed setting influences other effects too,
		// on Amiga players the effects are processed each tick, so the speed setting on a later channel can influence the effects on a previous channel ...
		// This is implemented by setting the speed before all other effects
		// example: see the ED2 command pattern 0, track 3, step 32 in AceMan - Dirty Tricks.mod
		// not sure this is 100% correct, but in any case it's more correct then setting it at the track it self.
		// Thinking ... ... yes ... should be fine as no speed related effects are processed on tick 0?

		for (var i = 0; i<tracks; i++){
			note = patternStep[i];
			if (note && note.effect && note.effect == 15){
				if (note.param <= 32){
					if (note.param == 0) note.param = 1;
					Tracker.setAmigaSpeed(note.param);
				}else{
					Tracker.setBPM(note.param)
				}
			}
		}
		// --- end Whut? ---



		for (var i = 0; i<tracks; i++){
			var note = patternStep[i];
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
			defaultVolume = typeof trackNotes[track].currentVolume == "number" ? trackNotes[track].currentVolume : defaultVolume;

			if (SETTINGS.emulateProtracker1OffsetBug && instrumentIndex && trackEffectCache[track].offset){
				if (trackEffectCache[track].offset.instrument == instrumentIndex){
					console.log("applying instrument offset cache to instrument " + instrumentIndex);
					trackEffects.offset = trackEffectCache[track].offset;
				}
			}
		}

		if (typeof note.instrument == "number"){
			instrument = me.getInstrument(note.instrument);
			if (instrument) {
				defaultVolume = 100 * (instrument.volume/64);

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

			if (noteIndex === 97){
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
                if (instrument && instrument.relativeNote) noteIndex +=  instrument.relativeNote;
                var ftNote = FTNotes[noteIndex];
                if (ftNote) notePeriod = ftNote.period;
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

            	// Are these even implemented in FastTracker or Milckytracker?
				// Values above 80 can't even be set ?
            	switch(x){
					case 6:
						// volume slide down
						break;
					case 7:
						// volume slide up
						break;
					case 8:
						// Fine volume slide down
						console.warn("Fine volume slide down not implemented");
						break;
					case 9:
						// Fine volume slide up
						console.warn("Fine volume slide up not implemented");
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
						console.warn("Set panning not implemented " + ve);
						break;
					case 13:
						// Panning slide left
						console.warn("Panning slide left not implemented");
						break;
					case 14:
						// Panning slide right
						console.warn("Panning slide right not implemented");
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

					var root = notePeriod || trackNotes[track].startPeriod;
					var finetune = 0;


					//todo: when a instrument index is present other than the previous index, but no note
					// how does this work?
					// see example just_about_seven.mod

					// check if the instrument is finetuned
					var playingInstrument = instrumentIndex || trackNotes[track] ? trackNotes[track].currentInstrument : 0;
					if (playingInstrument){
						instrument = me.getInstrument(playingInstrument);
						if (instrument){
							finetune = instrument.getFineTune();
							if (finetune) root = Audio.getFineTuneForPeriod(root,finetune);
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
				// the ProTracker clone of 8bitbubsy does this completely compatible to PT2.

				var target = notePeriod;

				// avoid using the fineTune of another instrument if another instrument index is present
				if (trackNotes[track].currentInstrument) instrumentIndex = trackNotes[track].currentInstrument;

				if (target && instrumentIndex){
					// check if the instrument is finetuned
					var instrument = me.getInstrument(instrumentIndex);
					if (instrument && instrument.finetune){
						target = Audio.getFineTuneForPeriod(target,instrument.finetune);
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
					canUseGlissando: true
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
					if (instrument && instrument.finetune){
						target = Audio.getFineTuneForPeriod(target,instrument.finetune);
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
				// TODO: implement
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
				result.patternBreak = true;
				result.positionBreak = true;
				result.targetSongPosition = note.param;
				result.targetPatternPosition = 0;
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
							if (instrumentIndex){
								var instrument = me.getInstrument(instrumentIndex);
								trackEffects.fineTune = {
									original: instrument.finetune,
									instrument: instrument
								};
								instrument.finetune = subValue;
								if (subValue>7) instrument.finetune = subValue-15;
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
							console.error(trackEffects.fade);
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
			trackNotes[track].currentInstrument = instrumentIndex;

			// reset temporary instrument settings
			if (trackEffects.fineTune && trackEffects.fineTune.instrument){
				trackEffects.fineTune.instrument.finetune = trackEffects.fineTune.original || 0;
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
	me.cutNote = cutNote;

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
						trackEffectCache[track].defaultSlideTarget = effects.slide.target;
						if (targetPeriod<effects.slide.target){
							targetPeriod += value;
							if (targetPeriod>effects.slide.target) targetPeriod = effects.slide.target;
						}else{
							targetPeriod -= value;
							if (targetPeriod<effects.slide.target) targetPeriod = effects.slide.target;
						}
					}else{
						targetPeriod += effects.slide.value;
						if (trackEffectCache[track].defaultSlideTarget) trackEffectCache[track].defaultSlideTarget += effects.slide.value;
					}

					targetPeriod = Audio.limitAmigaPeriod(targetPeriod);

					var newPeriod = targetPeriod;
					if (effects.slide.canUseGlissando && trackEffectCache[track].glissando){
						newPeriod = Audio.getNearestSemiTone(targetPeriod,trackNote.instrumentIndex);
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
			var instrumentIndex = trackNote.instrumentIndex;
			var notePeriod = trackNote.startPeriod;
			volume = trackNote.startVolume;

			var triggerStep = effects.reTrigger.value || 1;
			while (triggerStep<ticksPerStep){
				var triggerTime = time + (triggerStep * tickTime);
				cutNote(track,triggerTime);
				trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,effects,triggerTime);
				triggerStep += triggerStep;
			}
		}

	}

	me.renderTrackToBuffer = function(fileName,target){
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


			if (target === "dropbox"){
				Dropbox.putFile("/" + fileName,b);
			}else{
				saveAs(b,fileName);
			}


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
		}
		console.log(song.patterns[currentPattern]);


		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.getTrackCount = function(){
		return trackCount;
	};

	me.setTrackCount = function(count){
		trackCount = count;

		for (var i=trackNotes.length;i<trackCount;i++){
			trackNotes.push({});
			trackEffectCache.push({});
		}
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

	me.putNote = function(instrument,period,noteIndex){
		var note = song.patterns[currentPattern][currentPatternPos][currentTrack];
		if (note){
			note.instrument = instrument;
			if (noteIndex){
				note.setIndex(noteIndex);
			}else{
				note.setPeriod(period);
			}
		}
		song.patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.putNoteParam = function(pos,value){
		var x,y;
		var note = song.patterns[currentPattern][currentPatternPos][currentTrack];
		if (note){
			if (pos == 1 || pos == 2){
				var instrument = note.instrument;
				x = instrument >> 4;
				y = instrument & 0x0f;
				if (pos == 1) x = value;
				if (pos == 2) y = value;
				note.instrument = (x << 4) + y;
			}

			var xmOffset = 0;
			if (me.inFTMode()){
				xmOffset = 2;

				if (pos == 3  || pos == 4){
					var vparam = note.volumeEffect;
					x = vparam >> 4;
					y = vparam & 0x0f;
					if (pos == 3) x = value+1;
					if (pos == 4) y = value;
					note.volumeEffect = (x << 4) + y;
				}
			}

			if (pos == 3 + xmOffset) note.effect = value;
			if (pos == 4 + xmOffset || pos == 5 + xmOffset){
				var param = note.param;
				x = param >> 4;
				y = param & 0x0f;
				if (pos == 4 + xmOffset) x = value;
				if (pos == 5 + xmOffset) y = value;
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

	me.getTimeStates = function(){
		return trackerStates;
	};

	me.load = function(url,skipHistory,next){
		url = url || "demomods/StardustMemories.mod";

		if (UI){
			UI.setInfo("");
			UI.setLoading();
		}

		var process=function(result){
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


				if (isMod) checkAutoPlay(skipHistory);
				if (next) next();
			});
		}

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

			if (UI) UI.setStatus("Extracting Zip file");
			zip.workerScriptsPath = "script/src/lib/zip/";

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

		if (result.isMod && result.loader){
			isMod = true;
			if (me.isPlaying()) me.stop();
			resetDefaultSettings();

			song = result.loader().load(file,name);
			song.filename = name;

			onModuleLoad();

		}

		if (result.isSample){
			me.importSample(file,name);
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
		instrument.sampleIndex = index;
		instruments[index] = instrument;
	};

	me.importSample = function(file,name){
		console.log("Reading instrument " + name + " with length of " + file.length + " bytes to index " + currentInstrumentIndex);

		var instrument = instruments[currentInstrumentIndex] || Instrument();

		instrument.name = name;
		instrument.sample.length = file.length;
		instrument.loopStart = 0;
		instrument.loopRepeatLength = 0;
		instrument.finetune = 0;
		instrument.volume = 100;
		instrument.sample.data = [];

		detectSampleType(file,instrument.sample);

		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
		EventBus.trigger(EVENT.instrumentNameChange,currentInstrumentIndex);

	};


	// returns a binary stream
	me.buildBinary = function(type,next){

		type = type || MODULETYPE.mod;
		var writer;

		if (type === MODULETYPE.mod){
			writer = ProTracker();

		}

		if (type === MODULETYPE.xm){
			writer = FastTracker();
		}

		if (writer) writer.write(next);

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
			if (note) note.clear();
		}
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};
	me.clearPattern = function(){
		var length = currentPatternData.length;
		for (var i = 0; i<length;i++){
			for (var j = 0; j<trackCount; j++){
				var note = song.patterns[currentPattern][i][j];
				if (note) note.clear();
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
				instrument: note.instrument,
				period : note.period,
				effect: note.effect,
				param: note.param,
				volumeEffect: note.volumeEffect,
				note: note.index
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
		console.log("paste",trackNumber,data[0]);

		if (data){
			var length = currentPatternData.length;
			for (var i = 0; i<length;i++){
				var note = song.patterns[currentPattern][i][trackNumber];
				var source = data[i];
				note.instrument = source.instrument;
				note.period = source.period;
				note.effect = source.effect;
				note.volumeEffect = source.volumeEffect;
				note.param = source.param;
				note.index = source.index;
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
		var instrumentContainer = [];
		for (i = 1; i <= 31; ++i) {
			instruments[i] = Instrument();
			instrumentContainer.push({label: i + " ", data: i});
		}
		song.instruments = instruments;

		EventBus.trigger(EVENT.instrumentListChange,instrumentContainer);
		EventBus.trigger(EVENT.instrumentChange,currentInstrumentIndex);
	};

	me.setTrackerMode = function(mode){
		trackerMode = mode;
        SETTINGS.emulateProtracker1OffsetBug = !me.inFTMode();
		EventBus.trigger(EVENT.trackerModeChanged,mode);
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
		instruments = [];

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



	return me;
}());