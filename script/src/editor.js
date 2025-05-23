import EventBus from './eventBus.js';
import {COMMAND, EVENT, FILETYPE, MODULETYPE, SETTINGS, TRACKERMODE} from "./enum.js";
import Tracker, {periodNoteTable, nameNoteTable, FTNotes} from './tracker.js';
import {getUrlParameter} from "./lib/util.js";
import Host from "./host.js";
import Audio from "./audio.js";
import StateManager from "./ui/stateManager.js";
import Note from "./models/note.js";
import {audioBufferToWav} from "./lib/audioBufferToWav.js";
import UI from "./ui/ui.js";
import Dropbox from "./provider/dropbox.js";
import Logger from "./log.js";
import Instrument from "./models/instrument.js";
import ModalDialog from "./ui/components/modalDialog.js";
import FastTracker from "./fileformats/fasttracker.js";
import ProTracker from "./fileformats/protracker.js";
import BassoonProvider from "./provider/bassoon.js";
import Playlist from "./models/playlist.js";
import {detectSampleType} from "./audio/detectSampleType.js";
import {saveFile} from "./filesystem.js";


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


	me.putNote = function(instrument,period,noteIndex,volume){
		var note = Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack] || new Note();
		var editAction = StateManager.createNoteUndo(currentPattern,currentTrack,currentPatternPos,note);
		
		if (note){
			note.instrument = instrument;
			if (noteIndex){
				note.setIndex(noteIndex);
			}else{
				note.setPeriod(period);
			}
			if (typeof volume === "number"){
				if (Tracker.inFTMode()){
					note.volumeEffect = volume + 16;
				}else{
					note.effect = 12;
					note.param = volume;
				}
				
			}
		}
		
		editAction.data[0].to = note.duplicate();
		StateManager.registerEdit(editAction);
		
		Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};

	me.putNoteParam = function(pos,value){
		var x,y;
		var note = Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack];
		var editAction = StateManager.createNoteUndo(currentPattern,currentTrack,currentPatternPos,note);
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
					x = (vparam >> 4) || 1;
					y = vparam & 0x0f;
					if (pos == 3) x = value+1;
					if (pos == 4) y = value;
					note.volumeEffect = (x << 4) + y;
					if (note.volumeEffect<16){note.volumeEffect=0}
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

		editAction.data[0].to = note.duplicate();
		StateManager.registerEdit(editAction);
		
		Tracker.getSong().patterns[currentPattern][currentPatternPos][currentTrack] = note;
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};


	me.clearTrack = function(){
		var length = Tracker.getCurrentPatternData().length;
		var editAction = StateManager.createTrackUndo(currentPattern);
		editAction.name = "Clear Track";
		for (var i = 0; i<length;i++){
			var note = Tracker.getSong().patterns[currentPattern][i][currentTrack];
			if (note) {
				StateManager.addNote(editAction,currentTrack,i,note);
				note.clear();
			}
		}
		StateManager.registerEdit(editAction);
		EventBus.trigger(EVENT.patternChange,currentPattern);
	};
	me.clearPattern = function(){
		var length = Tracker.getCurrentPatternData().length;
		var editAction = StateManager.createPatternUndo(currentPattern);
		editAction.name = "Clear Pattern";
		for (var i = 0; i<length;i++){
			for (var j = 0; j<Tracker.getTrackCount(); j++){
				var note = Tracker.getSong().patterns[currentPattern][i][j];
				if (note) {
					StateManager.addNote(editAction,j,i,note);
					note.clear();
				}
			}
		}
		StateManager.registerEdit(editAction);
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
		
		for (var i = 0; i<length;i++){
			var note = Tracker.getSong().patterns[currentPattern][i][trackNumber] || new Note();
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

	me.pasteTrack = function(trackNumber,trackData,parentEditAction){
		var hasTracknumber = typeof trackNumber != "undefined";
		var data = trackData;
		if (!hasTracknumber) {
			trackNumber = currentTrack;
			data = pasteBuffer.track;
		}
		if (data){
			var editAction;
			if (parentEditAction){
				editAction = parentEditAction;
			}else{
				var editAction = StateManager.createTrackUndo(currentPattern);
				editAction.name = "Paste Track";
			}
			var length = Tracker.getCurrentPatternData().length;
			var patternData = Tracker.getSong().patterns[currentPattern];
			for (var i = 0; i<length;i++){
				var note = patternData[i][trackNumber];
				if (!note){
					note = new Note();
					patternData[i][trackNumber] = note;
				}
				var source = data[i];
				var noteInfo = StateManager.addNote(editAction,trackNumber,i,note);
				noteInfo.to = source; // should we duplicate source?
				note.populate(source);
			}
			
			if (!hasTracknumber) EventBus.trigger(EVENT.patternChange,currentPattern);
			if (!parentEditAction){
				StateManager.registerEdit(editAction);
			}
			return true;
		}else{
			return false;
		}

	};

	me.pastePattern = function(){
		var data = pasteBuffer.pattern;
		if (data){
			var editAction = StateManager.createPatternUndo(currentPattern);
			editAction.name = "Paste Pattern";
			for (var j = 0; j<Tracker.getTrackCount(); j++) {
				me.pasteTrack(j,data[j],editAction);
			}
			StateManager.registerEdit(editAction);
			EventBus.trigger(EVENT.patternChange,currentPattern);
			return true;
		}else{
			return false;
		}




		var length = Tracker.getCurrentPatternData().length;

		editAction.name = "Clear Pattern";
		for (var i = 0; i<length;i++){
			for (var j = 0; j<Tracker.getTrackCount(); j++){
				var note = Tracker.getSong().patterns[currentPattern][i][j];
				if (note) {
					StateManager.addNote(editAction,j,i,note);
					note.clear();
				}
			}
		}
		StateManager.registerEdit(editAction);
		EventBus.trigger(EVENT.patternChange,currentPattern);



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


	me.addToPatternTable = function(index,patternIndex){
		var song = Tracker.getSong();
		if (typeof index == "undefined") index = song.length;
		patternIndex = patternIndex||0;

		if (index === song.length){
			song.patternTable[index] = patternIndex;
			song.length++;
		}else{
			for (var i = song.length; i>index; i--){
				song.patternTable[i] = song.patternTable[i-1];
			}
			song.patternTable[index] = patternIndex;
			song.length++;
		}

		EventBus.trigger(EVENT.songPropertyChange,song);
		EventBus.trigger(EVENT.patternTableChange);


	};

	me.removeFromPatternTable = function(index){
		var song = Tracker.getSong();
		if (song.length<2) return;
		if (typeof index == "undefined") index = song.length-1;

		if (index === song.length-1){
			song.patternTable[index] = 0;
			song.length--;
		}else{
			for (var i=index; i<song.length; i++){
				song.patternTable[i] = song.patternTable[i+1];
			}
			song.length--;
		}

		var currentSongPosition = Tracker.getCurrentSongPosition(); 
		if (currentSongPosition === song.length){
			Tracker.setCurrentSongPosition(currentSongPosition-1);
		}

		EventBus.trigger(EVENT.songPropertyChange,song);
		EventBus.trigger(EVENT.patternTableChange);

	};

	me.renderTrackToBuffer = function(fileName,target){

		// TODO: timing is off when not played first?
		// TODO: when rendering to sample - we should switch to mono first

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

		Audio.stopRendering(function(renderedBuffer){
			
			// TODO cutoff the first 0.1 seconds -> start time

			var saveToFile = false;

			// save to wav
			if (saveToFile){
				var result = audioBufferToWav(renderedBuffer);
				var b = new Blob([result], {type: "octet/stream"});
				fileName = fileName || Tracker.getSong().title.replace(/ /g, '-').replace(/\W/g, '') + ".wav" || "module-export.wav";

				//if (target === "dropbox"){
				//	Dropbox.putFile("/" + fileName,b);
				//}else{
					saveFile(b,fileName);
				//}
			}else{
				me.buffer2Sample(renderedBuffer);
			}


		});
	};

    me.save = function(filename,target){
        UI.setStatus("Exporting ...",true);
        me.buildBinary(Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){
            var b = new Blob([file.buffer], {type: "application/octet-stream"});

            var fileName = filename || Tracker.getFileName();
            
            if (typeof target === "function"){
            	target(b);
            	return;
			}

            if (target === "dropbox"){
                Logger.info("save to dropbox " + fileName);
                Dropbox.putFile("/" + fileName,b,function(success){
                    if (success){
                        UI.setStatus("");
                    }else{
                        UI.setStatus("Error while saving to Dropbox ...");
                    }
                });
            }else{
                Logger.info("save " + fileName);
                saveFile(b,fileName);
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

        detectSampleType(file,instrument.sample,function(){
        	// some decoders are async: retrigger event on callback
			EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
			EventBus.trigger(EVENT.instrumentNameChange,Tracker.getCurrentInstrumentIndex());
			checkSample();
		});

        EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
        EventBus.trigger(EVENT.instrumentNameChange,Tracker.getCurrentInstrumentIndex());

        function checkSample(){
        	if (Tracker.getTrackerMode() === TRACKERMODE.PROTRACKER){
        		// max sampleLength is 1FFFE
        		if (instrument.sample.length > 131070){
					var dialog = ModalDialog();
					dialog.setProperties({
						width: UI.mainPanel.width,
						height: UI.mainPanel.height,
						top: 0,
						left: 0,
						ok: true
					});
					dialog.onClick = dialog.close;

					dialog.setText("Warning//The maximum sample lenght in .MOD format is 128kb//If you save in .MOD format/this sample will be truncated.//Please try downsampling or trimming the sample/to below 131072 bytes/or switch to .XM format");

					UI.setModalElement(dialog);
				}
			}
		}

    };

	me.buffer2Sample = function(buffer){

		var instrument = Tracker.getCurrentInstrument() || Instrument();
		var name = "pattern " + Tracker.getCurrentPattern();
		instrument.name = name;
		instrument.sample.loop.start = 0;
		instrument.sample.loop.length = 0;
		instrument.setFineTune(0);
		instrument.sample.volume = 64;
		instrument.sample.name = name;

		var numChannels = buffer.numberOfChannels;
		var sampleRate = buffer.sampleRate;
		var data = buffer.getChannelData(0); // TODO: mix stereo;

		instrument.sample.data = [];

		// downsample to ... 22050 ... 11025 ?
		var leadingTimeCount = Math.floor(Audio.context.sampleRate/10);

		// TODO - is creating a fixed length Float32Array faster ?
		for (let i = leadingTimeCount, len = data.length; i<len; i+=4){
			instrument.sample.data.push(data[i]);
		}
		instrument.sample.length = instrument.sample.data.length;

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
    
    me.loadInitialFile = function(){
		// load demo mod at startup
		//Tracker.load('demomods/spacedeb.mod');

		var initialFile = getUrlParameter("file");
		if (initialFile){
			initialFile = decodeURIComponent(initialFile);

			initialFile = unpackUrl(initialFile);

			if (initialFile.substr(0,7).toLowerCase() === "http://" && document.location.protocol === "https:"){
				// proxy plain HTTP requests as this won't work over HTTPS
				initialFile = BassoonProvider.proxyUrl(initialFile);
			}else if (initialFile.substr(0,6).toLowerCase() === "proxy/"){
				initialFile = BassoonProvider.proxyUrl(initialFile.substr(6));
			}
		}else{
			if (SETTINGS.loadInitialFile) initialFile = Host.initialFile || Host.getBaseUrl() + 'demomods/Tinytune.mod';
		}
		if (initialFile) Tracker.load(initialFile,true,function(fileType){
			if (fileType === FILETYPE.module){
				// load default playlist;
				Tracker.load(Host.getRemoteUrl() + 'playlists/demosongs.json',true,null,false,true);
			}
			if (fileType === FILETYPE.playlist){
				let index = 0;
				if ('URLSearchParams' in window) {
					const url = new URL(window.location);
					index = parseInt(url.searchParams.get("index"));
					if (isNaN(index)) index = 0;
				}
				if (index){
					Playlist.play(index);
				}else{
					Playlist.next();
				}

			}
		},true);

	}

	function unpackUrl(url){
		console.log("unpacking url " + url);
		var id;
		if (typeof url === "string") {
			if (url.indexOf("ma-") === 0) {
				id = url.substr(3);
				return "https://api.modarchive.org/downloads.php?moduleid=" + id;
			}
			if (url.indexOf("playlist-") === 0) {
				id = url.substr(9);
				return "playlists/" + id + ".json";
			}
			if(url==="favorites"){
				return "/favorites.pls";
			}
		}
		return url;
	}

	function packUrl(url){
		console.log("packing url " + url);
		if (typeof url === "string"){
			if (url.indexOf("api.modarchive.org")>=0){
				var moduleid = url.match(/moduleid=([0-9]+)/);
				if (moduleid && moduleid[1]) return ("ma-" + moduleid[1]);
			}
			if (url.indexOf("playlists/")>=0){
				var playlist = url.match(/playlists\/([A-Za-z0-9]+)\.json/);
				if (playlist && playlist[1]) return ("playlist-" + playlist[1]);
			}
			if (url === "/favorites.pls") return "favorites";
		}
		return url;
	}

	me.unpackUrl = unpackUrl;
	me.packUrl = packUrl;


	EventBus.on(EVENT.trackerModeChanged,function(mode){
		me.setCurrentTrackPosition(0);
	});

	EventBus.on(EVENT.patternChange,function(pattern){
		currentPattern = pattern;
	});

	EventBus.on(EVENT.patternPosChange,function(positions){
		currentPatternPos = positions.current;
	});

	EventBus.on(EVENT.trackCountChange,function(trackCount){
		var max = trackCount*me.getStepsPerTrack();
		if (currentCursorPosition >= max) me.setCurrentTrack(trackCount-1);
	});


	window.batchEdit = function(){
		let editor = {};

		// change all notes in current song
		editor.octaveDown = index=>{
			let song = Tracker.getSong();
			song.patterns.forEach((pattern,patternIndex)=>{
				pattern.forEach((row,rowIndex)=>{
					row.forEach((note,trackIndex)=>{
						if (note && note.period && note.instrument === index){
							let n = periodNoteTable[note.period];
							if (!n){
								console.error("no note found for period " + note.period);
								return;
							}

							if (n.name.indexOf("-1")>0){
								console.error("note is already at lowest octave");
								return;
							}
							let newNoteName = n.name.replace("2","1").replace("3","2");
							let newNote = nameNoteTable[newNoteName];
							if (!newNote){
								console.error("no note found for name " + newNoteName);
								return;
							}

							note.period = newNote.period;
						}
					});
				});
			});

			EventBus.trigger(EVENT.patternChange,currentPattern);
		}

		editor.printUseCount = ()=>{
			let song = Tracker.getSong();
			let useCount = {};
			song.patterns.forEach((pattern,patternIndex)=>{
				pattern.forEach((row,rowIndex)=>{
					row.forEach((note,trackIndex)=>{
						if (note && note.instrument){
							if (!useCount[note.instrument]) useCount[note.instrument] = 0;
							useCount[note.instrument]++;
						}
					});
				});
			});
			console.log(useCount);
		}

		return editor;
	}();



	window.exportRBBS = function(){
		let panel = document.createElement("div");
		panel.style.width = "400px";
		panel.style.height = "300px";
		panel.style.overflow = "auto";
		panel.style.backgroundColor = "silver";
		panel.style.position = "absolute";
		panel.style.top = "50%";
		panel.style.left = "50%";
		panel.style.transform = "translate(-50%,-50%)";
		panel.style.zIndex = "100";
		panel.style.border = "5px solid silver";

		let textarea = document.createElement("textarea");
		textarea.style.width = "100%";
		textarea.style.height = "260px";
		textarea.style.resize = "none";

		let button = document.createElement("button");
		button.innerText = "Close";
		button.style.width = "100%";
		button.style.height = "30px";
		button.style.marginTop = "5px";
		button.onclick = function(){
			document.body.removeChild(panel);
		};

		panel.appendChild(textarea);
		panel.appendChild(button);

		document.body.appendChild(panel);


		let song = Tracker.getSong();
		console.log(song);

		let output = [];
		output.push("const toneOC = [");

		for (let i = 0; i<song.length; i++){
			let pattern = song.patterns[song.patternTable[i]];
			console.error(pattern);

			pattern.forEach((step,stepIndex)=>{
				let note = step[0];
				if (note && note.period){
					let n = periodNoteTable[note.period];
					if (n && n.name){
						let duration = 1;
						let pause = 0;
						let isPaused = false;
						for (let j = stepIndex+1; j<pattern.length; j++){
							let nextNote = pattern[j][0];
							if (nextNote && nextNote.period){
								break;
							}
							if (nextNote.effect === 12 && !nextNote.param){
								isPaused = true;
							}

							if (isPaused){
								pause++;
							}else{
								duration++;
							}
						}

						let noteName = n.name;
						if (note.index){
							var ftNote = FTNotes[note.index];
							if (ftNote) noteName = ftNote.name;
						}
						noteName = noteName.replace("#","S");
						noteName = noteName.replace("-","_");

						output.push("    new Attention.ToneProfile(" + noteName + ", t*" + duration + "),");
						if (isPaused && pause<20){
							output.push("    new Attention.ToneProfile(0, t*" + pause + "),");
						}

					}else{
						console.error("no note found for period " + note.period);
					}
				}
			})
		}

		output.push("];");

		textarea.value = output.join("\n");



	}

	EventBus.on(COMMAND.exportFile,window.exportRBBS);



	return me;
}());

export default Editor;