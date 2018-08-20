var Editor = (function(){

	var me = {};


	var currentTrack = 0;
	var currentTrackPosition = 0;
	var currentCursorPosition = 0;
	var prevCursorPosition;

	var currentPattern = 0;
	var currentPatternPos = 0;

	var pasteBuffer = {};

	me.getStepsPerTrack = function(){
		return Tracker.inFTMode() ? 8 : 6;
	};

	me.setCurrentCursorPosition = function(index){
		currentCursorPosition = index;

		var stepsPerTrack = me.getStepsPerTrack();

		currentTrack = Math.floor(currentCursorPosition / stepsPerTrack);
		currentTrackPosition = currentCursorPosition % stepsPerTrack;
		if (prevCursorPosition!==currentCursorPosition) {
			EventBus.trigger(EVENT.cursorPositionChange,currentCursorPosition);
		}
		prevCursorPosition = currentCursorPosition;
	};
	me.getCurrentCursorPosition = function(){
		return currentCursorPosition;
	};
	me.moveCursorPosition = function(amount){
		var stepsPerTrack = me.getStepsPerTrack();

		var newPosition = currentCursorPosition+amount;
		var max = Tracker.getTrackCount()*stepsPerTrack - 1;
		if (newPosition > max) newPosition=0;
		if (newPosition < 0) newPosition=max;
		me.setCurrentCursorPosition(newPosition);
	};
	me.getCurrentTrack = function(){
		return currentTrack;
	};
	me.setCurrentTrack = function(track){
		var stepsPerTrack = me.getStepsPerTrack();
		me.setCurrentCursorPosition(track*stepsPerTrack + currentTrackPosition);
	};
	me.getCurrentTrackPosition = function(){
		return currentTrackPosition;
	};
	me.setCurrentTrackPosition = function(position){
		var stepsPerTrack = me.getStepsPerTrack();
		me.setCurrentCursorPosition(currentTrack*stepsPerTrack + position);
	};


	me.putNote = function(instrument,period,noteIndex){
		var note = Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack];
		if (note){
			note.instrument = instrument;
			if (noteIndex){
				note.setIndex(noteIndex);
			}else{
				note.setPeriod(period);
			}
		}
		Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.putNoteParam = function(pos,value){
		var x,y;
		var note = Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack];
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
			if (Tracker.inFTMode()){
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
		Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};


	me.clearTrack = function(){
		var length = Tracker.getCurrentPatternData().length;
		for (var i = 0; i<length;i++){
			var note = Tracker.getSong().patterns[currentPattern][i][currentTrack];
			if (note) note.clear();
		}
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};
	me.clearPattern = function(){
		var length = Tracker.getCurrentPatternData().length;
		for (var i = 0; i<length;i++){
			for (var j = 0; j<Tracker.getTrackCount(); j++){
				var note = Tracker.getSong().patterns[currentPattern][i][j];
				if (note) note.clear();
			}
		}
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};
	me.clearSong = function(){
		var song = Tracker.getSong();
		Tracker.setCurrentPattern(0);
		me.clearPattern();
		var pattern = song.patterns[0];

		song.patterns = [pattern];
		song.length = 1;
		song.restartPosition = 0;

		var patternTable = [];
		for (var i = 0; i < 128; ++i) {
			patternTable[i] = 0;
		}
		song.patternTable = patternTable;

		Tracker.setAmigaSpeed(6);
		Tracker.setBPM(125);
		Tracker.setCurrentSongPosition(1);

		EventBus.trigger(EVENT.songPropertyChange,song);
		EventBus.trigger(EVENT.patternTableChange);
	};

	me.copyTrack = function(trackNumber){
		var hasTracknumber = typeof trackNumber != "undefined";
		if (!hasTracknumber) trackNumber = currentTrack;
		var length = Tracker.getCurrentPatternData().length;
		var data = [];

		console.error(trackNumber);
		for (var i = 0; i<length;i++){
			var note = Tracker.getSong().patterns[currentPattern][i][trackNumber];
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

		for (var j = 0; j<Tracker.getTrackCount(); j++) {
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
			var length = Tracker.getCurrentPatternData().length;
			for (var i = 0; i<length;i++){
				var note = Tracker.getSong().patterns[currentPattern][i][trackNumber];
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
			for (var j = 0; j<Tracker.getTrackCount(); j++) {
				me.pasteTrack(j,data[j]);
			}
			EventBus.trigger(EVENT.patternChange,currentPattern);
			return true;
		}else{
			return false;
		}

	};


	EventBus.on(EVENT.trackerModeChanged,function(mode){
		me.setCurrentTrackPosition(0);
	});


	EventBus.on(EVENT.patternChange,function(pattern){
		currentPattern = pattern;
	});

	EventBus.on(EVENT.patternPosChange,function(patternPos){
		currentPatternPos = patternPos;
	});

	EventBus.on(EVENT.trackCountChange,function(trackCount){
		var max = trackCount*me.getStepsPerTrack();
		if (currentCursorPosition >= max) me.setCurrentTrack(trackCount-1);
	});



	return me;
}());