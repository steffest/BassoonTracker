UI.PianoView = function(){

	var me = UI.element();
	var keyWidth = 64;

	var keys = [];
	var bKeys = [];
	var periodKeys = {};
	var keyDown = [];
	var keyPlayed = [];
	var touchKey = {};

	var keyImg = Y.getImage("pianokey_white");
	var keyImgDown = Y.getImage("pianokey_white_down");
	var bKeyImg = Y.getImage("pianokey_black");
	var bKeyImgDown = Y.getImage("pianokey_black_down");
	//me.hide();

	var background = UI.scale9Panel(0,0,me.width,me.height,UI.Assets.panelMainScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var properties = ["left","top","width","height","name","type","zIndex"];
	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		if (me.setLayout) me.setLayout(me.left,me.top,me.width, me.height);
	};

	me.setLayout = function(){
		background.setSize(me.width,me.height);
	};


	if (!keys.length){
		for (var note in NOTEPERIOD){
			if (NOTEPERIOD.hasOwnProperty(note)){
				if (note.indexOf("s")<0){
					// white key
					periodKeys[NOTEPERIOD[note].period] = keys.length;
					keys.push(note);
				}else{
					// black key
					periodKeys[NOTEPERIOD[note].period] = 1000 + bKeys.length;
					bKeys.push(note);
				}

			}
		}
	}

	EventBus.on(EVENT.noteOn,function(event,note){
		if (note && note.startPeriod){
			var keyIndex = periodKeys[note.startPeriod];
			if (keyIndex >= 0){
				keyDown[keyIndex] = {
					startTime: Audio.context.currentTime,
					source: note.source
				};
				me.refresh();
			}
		}
	});

	EventBus.on(EVENT.noteOff,function(event,note){
		if (note && note.startPeriod){
			var keyIndex = periodKeys[note.startPeriod];
			if (keyIndex >= 0){
				keyDown[keyIndex] = false;
				me.refresh();
			}
		}
	});

	var keyNoteOn = function(key){
		if (keys[key]){
			var note =  NOTEPERIOD[keys[key]];

			if (note && note.period){

				if (Tracker.isRecording()){
					if (Tracker.getCurrentTrackPosition() > 0){
						// cursorPosition is not on note
						// play anyway but don't input
					}else{
						Tracker.putNote(Tracker.getCurrentSampleIndex(),note.period);
						if (Tracker.isPlaying()){

						}else{
							Tracker.moveCurrentPatternPos(1);
						}
					}
				}

				var playedNote = Audio.playSample(Tracker.getCurrentSampleIndex(),note.period);
				keyPlayed[key] = playedNote;
				EventBus.trigger(EVENT.noteOn,playedNote);

			}
		}
	};

	var keyNoteOff = function(key){
		if (keys[key] && keyPlayed[key]){
			var note =  NOTEPERIOD[keys[key]];
			if (note && note.period){
				EventBus.trigger(EVENT.noteOff,keyPlayed[key]);
				if (keyPlayed[key].volume){
					keyPlayed[key].volume.gain.linearRampToValueAtTime(0,Audio.context.currentTime + 0.5)
				}else{
					keyPlayed[key].source.stop();
				}
				keyPlayed[key] = false;
			}
		}
	};

	me.onTouchDown = function(data){
		var x = me.eventX;
		var key = Math.floor(x/(keyWidth-4));
		touchKey[data.id] = key;
		keyNoteOn(key);
	};

	me.onTouchUp = function(data){
		var x = data.dragX || me.eventX;
		var key = Math.floor(x/(keyWidth-4));
		touchKey[data.id] = false;
		keyNoteOff(key);
	};

	me.onDrag = function(data){
		var x = data.dragX;
		var key = Math.floor(x/(keyWidth-4));

		if (touchKey[data.id] != key){
			console.error("new key " , key);
			keyNoteOff(touchKey[data.id]);
			touchKey[data.id] = key;
			keyNoteOn(key);
		}
	};

	me.render = function(internal){
		if (!me.isVisible()) return;

		internal = !!internal;

		if (this.needsRendering){
			me.clearCanvas();

			background.render();

			// draw white keys
			var keyTop = 20;
			var keyHeight = me.height - keyTop;

			var keyX = 0;
			var keyOverlap = 4;

			var counter = 0;
			while (keyX<me.width){

				var img = keyDown[counter] ? keyImgDown : keyImg;
				me.ctx.drawImage(img,keyX,keyTop,keyWidth,keyHeight);

				counter++;
				keyX += (keyWidth - keyOverlap);

			}

			// draw black keys
			var bKeyWidth = 48;
			var bKeyHeight = Math.floor(keyHeight/1.7);
			var bkeyX = keyWidth - bKeyWidth/2 - 2;
			counter = 0;
			var keyCounter = 0;

			while (bkeyX<me.width){
				var octaveIndex = counter%7;

				var bImg = keyDown[1000+ keyCounter] ? bKeyImgDown : bKeyImg;

				if (octaveIndex != 2 && octaveIndex != 6){
					me.ctx.drawImage(bImg,bkeyX,keyTop,bKeyWidth,bKeyHeight);
					keyCounter++
				}
				counter++;

				bkeyX += (keyWidth - keyOverlap);
			}

		}

		this.needsRendering = false;
		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	return me;

};

