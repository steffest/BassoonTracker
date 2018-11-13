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
			data.push(note.duplicate());
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
				note.populate(source);
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

	me.insertNote = function(){
		var end = Tracker.getSong().patterns[currentPattern].length-2;
		var start = currentPatternPos;

		for (var i = end; i>=start; i--){
			var from = Tracker.getSong().patterns[currentPattern][i][currentTrack];
			var to = Tracker.getSong().patterns[currentPattern][i+1][currentTrack];

			to.instrument = from.instrument;
			to.period = from.period;
			to.effect = from.effect;
			to.volumeEffect = from.volumeEffect;
			to.param = from.param;
			to.index = from.index;
		}

		from = Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack];
		if (from) from.clear();

		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.removeNote = function(track,step){
		if (typeof track === "undefined") track = currentTrack;
		if (typeof step === "undefined") step = currentPatternPos;

		if (step===0) return;

		var start = step;
		var end = Tracker.getSong().patterns[currentPattern].length-1;

		for (var i = start; i<=end; i++){
			var from = Tracker.getSong().patterns[currentPattern][i][track];
			var to = Tracker.getSong().patterns[currentPattern][i-1][track];

			to.instrument = from.instrument;
			to.period = from.period;
			to.effect = from.effect;
			to.volumeEffect = from.volumeEffect;
			to.param = from.param;
			to.index = from.index;
		}

		from = Tracker.getSong().patterns[currentPattern][end][track];
		if (from) from.clear();

		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.renderTrackToBuffer = function(fileName,target){
		var song = Tracker.getSong();
		var step = 0;
		var patternStep = Tracker.getCurrentSongPosition();
		var thisPatternLength = Tracker.getCurrentPatternData().length;

		// apparently needs some leading time, otherwise the first note is not rendered.
		var time = 0.1;


		var props =  Tracker.getProperties();
		var ticksPerStep = props.ticksPerStep;
		var tickTime = props.tickTime;

		var patternCount = 1;

        patternStep = 0;
        patternCount = 8;


		var maxPosition = patternStep+patternCount;
		maxPosition = Math.min(maxPosition,song.length);
		patternCount = maxPosition-patternStep;

		// TODO - we should first calculate the real length of the pattern, scanning all tempo changes.
		var length = (ticksPerStep * tickTime * thisPatternLength * patternCount) + 0.2;
		Audio.startRendering(length);

		while (patternStep<maxPosition){
			console.log("rendering step " + patternStep);
			var patternIndex = song.patternTable[patternStep];
			var currentPatternData = song.patterns[patternIndex];
			thisPatternLength = currentPatternData.length;

			while (step<thisPatternLength){
				Tracker.playPatternStep(step,time,currentPatternData);
				time += ticksPerStep * tickTime;
				step++;
			}
			step = 0;
			patternStep++;
		}

		Audio.stopRendering(function(result){

			// TODO cutoff the first 0.1 seconds -> start time

			// save to wav
			var b = new Blob([result], {type: "octet/stream"});
			fileName = fileName || Tracker.getSong().title.replace(/ /g, '-').replace(/\W/g, '') + ".wav" || "module-export.wav";

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

    me.save = function(filename,target){
        UI.setStatus("Exporting ...",true);
        me.buildBinary(Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){
            var b = new Blob([file.buffer], {type: "application/octet-stream"});

            var fileName = filename || me.getFileName();

            if (target === "dropbox"){
                Dropbox.putFile("/" + fileName,b,function(success){
                    if (success){
                        UI.setStatus("");
                    }else{
                        UI.setStatus("Error while saving to Dropbox ...");
                    }
                });
            }else{
                saveAs(b,fileName);
                UI.setStatus("");
            }
        });
    };

    me.importSample = function(file,name){
        console.log("Reading instrument " + name + " with length of " + file.length + " bytes to index " + Tracker.getCurrentInstrumentIndex());

        var instrument = Tracker.getCurrentInstrument() || Instrument();

        instrument.name = name;
        instrument.sample.length = file.length;
        instrument.sample.loop.start = 0;
        instrument.sample.loop.length = 0;
        instrument.setFineTune(0);
        instrument.sample.volume = 64;
        instrument.sample.data = [];
        instrument.sample.name = name;

        detectSampleType(file,instrument.sample);

        EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
        EventBus.trigger(EVENT.instrumentNameChange,Tracker.getCurrentInstrumentIndex());

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