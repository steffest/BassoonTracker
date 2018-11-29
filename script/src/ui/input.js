var Input = (function(){

	var me={};

	var touchData = {};
	touchData.touches = [];
	touchData.mouseWheels = [];
	var focusElement;
	var currentEventTarget;
	var resizeTimer = 0;
	var isTouched = false;
	var inputNotes = []; // keep track of notes played through keyboard input
	var keyDown = {};
	var isMetaKeyDown = false;

	var currentOctave = 2;
	var maxOctave = 3;
	var minOctave = 1;

	var prevHoverTarget;
	var prevIndex = 13;

	me.init = function(){

		// mouse, touch and key handlers

		canvas.addEventListener("mousedown",handleTouchDown,false);
		canvas.addEventListener("mousemove",handleTouchMove,false);
		canvas.addEventListener("mouseup",handleTouchUp,false);

		canvas.addEventListener("touchstart", handleTouchDown,false);
		canvas.addEventListener("touchmove", handleTouchMove,false);
		canvas.addEventListener("touchend", handleTouchUp,false);

		if (window.navigator.msPointerEnabled){
			canvas.addEventListener("MSPointerDown", handleTouchDown,false);
			canvas.addEventListener("MSPointerMove", handleTouchMove,false);
			canvas.addEventListener("MSPointerEnd", handleTouchUp,false);
		}

		canvas.addEventListener("mousewheel", handleMouseWheel,false);
		canvas.addEventListener("DOMMouseScroll", handleMouseWheel,false);

		document.addEventListener("keydown",handleKeyDown,false);
		document.addEventListener("keyup",handleKeyUp,false);

		canvas.addEventListener("dragenter", handleDragenter, false);
		canvas.addEventListener("dragover", handleDragover, false);
		canvas.addEventListener("drop", handleDrop, false);

		window.addEventListener("paste", handlePaste,false);
		window.addEventListener("copy", handleCopy,false);
		window.addEventListener("cut", handleCut,false);
		window.addEventListener("delete", handleDelete,false);

		if (!App.isPlugin) window.addEventListener("resize",handleResize,false);


		function handleTouchDown(event){

			event.preventDefault();

			if (!isTouched){
				// first touch - init media on IOS and Android
				// note: audioContext.resume must be called on touchup, touchdown is too soon.

				if (typeof Audio !== "undefined" && Audio.playSilence){

					if (Audio.context && Audio.context.state !== "suspended"){
						Audio.playSilence();
						isTouched = true;
					}
				}
			}


			if (event.touches && event.touches.length>0){
				var touches = event.changedTouches;
				for (var i=0; i < touches.length; i++) {
					var touch = touches[i];
					initTouch(touch.identifier,touch.pageX,touch.pageY);
				}
			}else{
				var touchIndex = getTouchIndex("notouch");
				if (touchIndex>=0) touchData.touches.splice(touchIndex, 1);
				initTouch("notouch",event.pageX,event.pageY);
				//initTouch("notouch",event.clientX,event.clientY);
			}

			function initTouch(id,x,y){
				touchData.isTouchDown = true;

				var rect = canvas.getBoundingClientRect();
				x -= (rect.left + window.pageXOffset);
				y -= (rect.top + window.pageYOffset);

				currentEventTarget = UI.getModalElement() ||  UI.getEventElement(x,y);

				var thisTouch = {
					id: id,
					x: x,
					y: y,
					startX: x,
					startY: y,
					UIobject: currentEventTarget,
					isMeta: event.shiftKey || event.metaKey || event.ctrlKey || event.altKey
				};

				touchData.touches.push(thisTouch);

				if (thisTouch.UIobject){
					if (thisTouch.UIobject.onDragStart) thisTouch.UIobject.onDragStart(thisTouch);
					if (thisTouch.UIobject.onDown) thisTouch.UIobject.onDown(thisTouch);

					//console.log(thisTouch.UIobject);
				}
			}
		}

		function handleTouchMove(event){
			event.preventDefault();
			var rect = canvas.getBoundingClientRect();

			if (event.touches && event.touches.length>0){
				var touches = event.changedTouches;

				for (var i=0; i < touches.length; i++) {
					var touch = touches[i];
					updateTouch(getTouchIndex(touch.identifier),touch.pageX-rect.left,touch.pageY-rect.top);
				}
			}else{
				var _x = event.pageX-rect.left;
				var _y = event.pageY-rect.top;
				updateTouch(getTouchIndex("notouch"),event.pageX-rect.left,event.pageY-rect.top);
				touchData.currentMouseX = _x;
				touchData.currentMouseY = _y;
				touchData.mouseMoved = new Date().getTime();

				if (SETTINGS.useHover){
					var hoverEventTarget = UI.getEventElement(_x,_y);
					if (hoverEventTarget && hoverEventTarget.onHover) hoverEventTarget.onHover(touchData);

					if (prevHoverTarget && prevHoverTarget != hoverEventTarget){
						if (prevHoverTarget.onHoverExit) prevHoverTarget.onHoverExit(touchData,hoverEventTarget);
					}
					prevHoverTarget = hoverEventTarget;
				}

			}

			function updateTouch(touchIndex,x,y){
				if (touchIndex>=0){
					var thisTouch =touchData.touches[touchIndex];

					thisTouch.x = x-window.pageXOffset;
					thisTouch.y = y-window.pageYOffset;

					touchData.touches.splice(touchIndex, 1, thisTouch);

					if (touchData.isTouchDown && thisTouch.UIobject){
						if (thisTouch.UIobject.onDrag){
							thisTouch.dragX = x;
							thisTouch.dragY = y;
							thisTouch.UIobject.onDrag(thisTouch);
						}
					}
				}
			}
		}

		function handleTouchUp(event){

			touchData.isTouchDown = false;

			if (event && event.touches){
				var touches = event.changedTouches;

				for (var i=0; i < touches.length; i++) {
					var touch = touches[i];
					endTouch(getTouchIndex(touch.identifier));
				}

				if (event.touches.length === 0){
					resetInput();
				}
			}else{
				endTouch(getTouchIndex("notouch"));
				resetInput();
			}

			function endTouch(touchIndex){
				if (touchIndex>=0){
					var thisTouch =touchData.touches[touchIndex];
					var deltaX = thisTouch.startX-thisTouch.x;
					var deltaY = thisTouch.startY-thisTouch.y;
					var distance = Math.sqrt( deltaX*deltaX + deltaY*deltaY );
					var clearSelection = true;
					if (thisTouch.UIobject){
						var elm = thisTouch.UIobject;
						if (elm.keepSelection) clearSelection = false;

						if (distance<8 && elm.onClick){
							elm.onClick(thisTouch);
						}

						if (elm.onTouchUp) elm.onTouchUp(thisTouch);
					}

					if (clearSelection && distance<8) UI.clearSelection();

					touchData.touches.splice(touchIndex, 1);
				}
			}

			function resetInput(){
				//Input.isDown(false);
				//Input.isUp(false);
				//Input.isLeft(false);
				//Input.isRight(false);
			}

		}

		function handleKeyDown(event){

			var keyboardTable = KEYBOARDTABLE[SETTINGS.keyboardTable] || KEYBOARDTABLE.azerty;

			var keyCode = event.keyCode;
			var key = event.key;

			var meta={
				shift: event.shiftKey,
				control: event.ctrlKey,
				alt: event.altKey,
				command: event.metaKey
			};
			isMetaKeyDown = (meta.command || meta.control || meta.alt || meta.shift);

			if (!key && event.keyIdentifier){
				// safari on osX ...
				var id = event.keyIdentifier;
				id = id.replace("U+","");
				key = String.fromCharCode(parseInt(id,16)).toLowerCase();
			}

			//console.log(keyCode);

			if (focusElement && focusElement.onKeyDown){
				var handled = focusElement.onKeyDown(keyCode,event);
				if (handled) return;
			}

            switch(keyCode){
                case 8:// backspace
                    if (Tracker.isRecording()){
                        if (isMetaKeyDown) {
							Editor.removeNote();
							Tracker.moveCurrentPatternPos(-1);
						}else{
                            pos = Editor.getCurrentTrackPosition();
                            if (pos===0){
                                Editor.putNote(0,0);
                            }else{
                                Editor.putNoteParam(pos,0);
                            }
                            Tracker.moveCurrentPatternPos(1);
                        }
                        return;
                    }else{
                        Tracker.playPatternStep(Editor.getCurrentTrackPosition());
                        Tracker.moveCurrentPatternPos(-1);
                        // on Mac this should probably be delete ...
                    }

                    return;
				case 9:// tab
					event.stopPropagation();
					event.preventDefault();
					Editor.moveCursorPosition(Editor.getStepsPerTrack());
					return;
                case 13:// enter
					if (Tracker.isRecording() && isMetaKeyDown){
						Editor.insertNote();
						Tracker.moveCurrentPatternPos(1);
					}else{
						Tracker.togglePlay();
					}
                    return;
                case 16:// shift
                    //Tracker.playPattern();
                    break;
				case 27:// esc
					UI.clearSelection();
					break;
                case 32:// space
                    Tracker.toggleRecord();
                    return;
                case 33:// pageup
                    var step = Math.floor(Tracker.getPatternLength()/4);
                    if (step === 0) step = 1;
                    var pos = Math.floor(Tracker.getCurrentPatternPos()/step) * step;
                    if (Tracker.getCurrentPatternPos()===pos) pos -= step;
                    if (pos<0) pos=0;
                    Tracker.setCurrentPatternPos(pos);
                    return;
                case 34:// pagedown
                    step = Math.floor(Tracker.getPatternLength()/4);
                    if (step === 0) step = 1;
                    pos = Math.ceil(Tracker.getCurrentPatternPos()/step) * step;
                    if (Tracker.getCurrentPatternPos()===pos) pos += step;
                    if (pos>=Tracker.getPatternLength()-1) pos=Tracker.getPatternLength()-1;
                    Tracker.setCurrentPatternPos(pos);
                    return;
                case 35:// end
                    Tracker.setCurrentPatternPos(Tracker.getPatternLength()-1);
                    return;
                case 36:// home
                    Tracker.setCurrentPatternPos(0);
                    return;
                case 37:// left
                    Editor.moveCursorPosition(-1);
                    return;
                case 38:// up
                    Tracker.moveCurrentPatternPos(-1);
                    return;
                case 39:// right
                    Editor.moveCursorPosition(1);
                    return;
                case 40: // down
                    Tracker.moveCurrentPatternPos(1);
                    return;
                case 46: // delete
                    if (Tracker.isRecording()){
                    	pos = Editor.getCurrentTrackPosition();
                    	if (pos===0){
                            Editor.putNote(0,0);
						}else{
                            Editor.putNoteParam(pos,0);
						}
                        Tracker.moveCurrentPatternPos(1);
                    }
                    return;
                case 112: //F1
                case 113: //F2
                case 114: //F3
                case 115: //F4
                case 116: //F5
                case 117: //F6
                case 118: //F7
                    me.setCurrentOctave(keyCode-111);
                    return;
                case 119: //F8
                case 120: //F9
                case 121: //F10
                case 122: //F11
                case 123: //F12
                    return;
                case 221: // ¨^
                    return;
            }


			if (key && (keyCode>40) && (keyCode<230)){

				if (isMetaKeyDown && keyCode>=65 && keyCode<=90){
					// A-Z with shift key
					console.log("meta " + keyCode);

					event.stopPropagation();
					event.preventDefault();

					switch (keyCode) {
						case 65: //a - select all
							EventBus.trigger(EVENT.commandSelectAll);
							return;
						case 67: //c - copy
							UI.copySelection(true);
							return;
						case 86: //v - paste
							UI.pasteSelection(true);
							return;
						case 88: //x - cut
							UI.cutSelection(true);
							return;
						case 89: //z - redo
							EventBus.trigger(EVENT.commandRedo);
							return;
						case 90: //z - undo
							EventBus.trigger(EVENT.commandUndo);
							return;
					}

					return;
				}


                var index = -1;
				var keyboardNote = keyboardTable[key];

				if (typeof keyboardNote === "number"){
					index = (currentOctave*12) + keyboardNote;
					if (keyboardNote === 0) index = 0;
				}

				me.handleNoteOn(index,key);
			}

		}

		function handleKeyUp(event){
			var key = event.key;

			if (!key && event.keyIdentifier){
				// safari on osX ...
				var id = event.keyIdentifier;
				id = id.replace("U+","");
				key = String.fromCharCode(parseInt(id,16)).toLowerCase();
			}

            var keyCode = event.keyCode;

			if (isMetaKeyCode(keyCode)) isMetaKeyDown = false;

            if (key && (keyCode>40) && (keyCode<200)){
                var keyboardTable = KEYBOARDTABLE[SETTINGS.keyboardTable] || KEYBOARDTABLE.azerty;
                var keyboardNote = keyboardTable[key];

                if (typeof keyboardNote === "number"){
                    return me.handleNoteOff((currentOctave*12) + keyboardNote);
                }
            }


		}


		function handleMouseWheel(event){
			if (touchData.currentMouseX){

				var x = touchData.currentMouseX;
				var y = touchData.currentMouseY;

				var target = UI.getEventElement(x,y);

				if (target && target.onMouseWheel){

					var deltaY = event.wheelDeltaY || event.wheelDelta || -event.detail;
					var deltaX = event.wheelDeltaX || 0;

					touchData.mouseWheels.unshift(deltaY);
					if (touchData.mouseWheels.length > 10) touchData.mouseWheels.pop();

					target.onMouseWheel(touchData);

				}
			}
		}


		function handleDragenter(e) {
			e.stopPropagation();
			e.preventDefault();
		}

		function handleDragover(e) {
			e.stopPropagation();
			e.preventDefault();
		}

		function handleDrop(e) {
			e.stopPropagation();
			e.preventDefault();

			var dt = e.dataTransfer;
			var files = dt.files;

			Tracker.handleUpload(files);
		}


		function handleResize(){
			if (!App.isPlugin) {
				// throttle resize events - resizing is expensive as all the canvas cache needs to be regenerated
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(function () {
					UI.setSize(window.innerWidth, window.innerHeight)
				}, 100);
			}
		}

		function handlePaste(e) {
			UI.pasteSelection(true);
		}

		function handleCopy(e) {
			UI.copySelection(true);
		}

		function handleCut(e) {
			UI.cutSelection(true);
		}

		function handleDelete(e) {
			console.error("delete");
		}

		function isMetaKeyCode(keyCode){
			return ((keyCode === 16) || (keyCode === 17) || (keyCode === 18) || (keyCode === 91) || (keyCode === 93));
		}


		handleResize();

	};

	var getTouchIndex = function (id) {
		for (var i=0; i < touchData.touches.length; i++) {
			if (touchData.touches[i].id === id) {
				return i;
			}
		}
		return -1;
	};


	me.setFocusElement = function(element){
		if (focusElement && focusElement.deActivate) focusElement.deActivate();
		focusElement = element;

		var name = element.name || element.type;
		if (name) console.log("setting focus to " + name);
	};
	me.clearFocusElement = function(){
		if (focusElement && focusElement.deActivate) focusElement.deActivate();
		focusElement = undefined;
	};


	function clearInputNote(){
		// stops the oldest input note
		if (inputNotes.length){
			var note = inputNotes.shift();
			if (note.source){
				try{
					note.source.stop();
				}catch(e){

				}
			}
		}
	}

	me.clearInputNotes = function(){
		while (inputNotes.length) clearInputNote();
	};

	me.getCurrentOctave =function(){
		return currentOctave;
	};

	me.setCurrentOctave =function(value){
		if (value<=maxOctave && value>=minOctave){
			currentOctave = value;
			EventBus.trigger(EVENT.octaveChanged,currentOctave);
		}
	};

	// handles the input for an indexed note
	me.handleNoteOn = function(index,key,offset){

        var note;
        var doPlay = true;
        var noteOctave;
        var noteIndex;
        var baseNote;

        if (index>=0){
			prevIndex = index;
			UI.clearSelection();

            noteOctave = Math.floor((index-1)/12) + 1;
            noteIndex = (index-1)%12 + 1;
            baseNote = OCTAVENOTES[noteIndex];

            if (baseNote){
                if (Tracker.inFTMode()){
                    // get FT note
                    if (baseNote.name === "OFF"){
                        note = {
                            period: 1,
                            index: 0
                        };
                        doPlay = false;
                    }else{
                        var fNote = FTNotes[index];
                        if (fNote){
                            note = {
                                period: fNote.period,
                                index: index
                            }
                        }
                    }

                }else{
                    var noteName = baseNote.name + (noteOctave-1);
                    note = NOTEPERIOD[noteName];
                }
			}
		}


        if (Tracker.isRecording()){
            if (Editor.getCurrentTrackPosition() > 0){
                // cursorPosition is not on note
                doPlay = false;
                var re = /[0-9A-Fa-f]/g;
                var value = -1;
                key = key||"";

                if (re.test(key)){
                    value = parseInt(key,16);
                }else{
                    if (Tracker.inFTMode() && Editor.getCurrentTrackPosition() === 5){
                        // Special Fasttracker commands // should we allow all keys ?
                        re = /[0-9A-Za-z]/g;
                        if (re.test(key)) value = parseInt(key,36)
                    }
                }

                if (value >= 0){
                    Editor.putNoteParam(Editor.getCurrentTrackPosition(),value);
                    Tracker.moveCurrentPatternPos(1);
                }
            }else{
                if (keyDown[index]) return;
                if (note){
                    Editor.putNote(Tracker.getCurrentInstrumentIndex(),note.period,note.index);
                    if (Tracker.isPlaying()){
                        //doPlay = false;
                    }else{
                        Tracker.moveCurrentPatternPos(1);
                    }
                }
            }
        }

        if (doPlay && note){
            if (keyDown[index]) return;

            var instrument = Tracker.getCurrentInstrument();

            if (instrument){
                if (note.index){
                    instrument.setSampleForNoteIndex(note.index);
                    if (instrument.sample.relativeNote){
                        note.index += instrument.sample.relativeNote;
                        var ftNote = FTNotes[note.index];
                        if (ftNote) note.period = ftNote.period;
                    }
                }

                Audio.checkState();
                var effects = undefined;

                if (offset){
                	effects = {
                		offset:{
                			value: offset
						}
					}
				}

                keyDown[index] = instrument.play(note.index,note.period,undefined,undefined,effects);
                keyDown[index].instrument = instrument;
                keyDown[index].isKey = true;
                inputNotes.push(keyDown[index]);
                if (inputNotes.length>64){
                    clearInputNote();
                }
                EventBus.trigger(EVENT.pianoNoteOn,index);
            }
        }



	};

	me.handleNoteOff = function(index){
		if (!SETTINGS.sustainKeyboardNotes && keyDown[index] && keyDown[index].source && Audio.context){
            EventBus.trigger(EVENT.pianoNoteOff,index);
            try{
                if (keyDown[index].instrument){
                    keyDown[index].instrument.noteOff(Audio.context.currentTime,keyDown[index]);
                }else{
                    keyDown[index].source.stop();
                }
            }catch(e){

            }
        }
        keyDown[index] = false;
	};

	me.isMetaKeyDown = function(){
		return isMetaKeyDown;
	};

	me.getPrevIndex = function(){
		return prevIndex;
	};


	EventBus.on(EVENT.second,function(){
		// check for looping parameters on playing input notes
		if (!Audio.context) return;
		var time = Audio.context.currentTime;
		var delay = 2;

		inputNotes.forEach(function(note){
			if (note && note.time && note.scheduled){

				if (note.scheduled.volume){
					if ((time + delay) >= note.scheduled.volume){
						if(note.instrument){
							var scheduledtime = note.instrument.scheduleEnvelopeLoop(note.volumeEnvelope,note.scheduled.volume,2);
							note.scheduled.volume += scheduledtime;
						}
					}
				}

				if (note.scheduled.panning){
					if ((time + delay) >= note.scheduled.panning){
						if(note.instrument){
							scheduledtime = note.instrument.scheduleEnvelopeLoop(note.panningEnvelope,note.scheduled.panning,2);
							note.scheduled.panning += scheduledtime;
						}
					}
				}

			}

		});
	});


	EventBus.on(EVENT.trackerModeChanged,function(mode){
		if (Tracker.inFTMode()){
            maxOctave = 7;
            minOctave = 0;
			me.setCurrentOctave(currentOctave+2);
		}else{
            maxOctave = 3;
            minOctave = 1;
			me.setCurrentOctave(Math.min(Math.max(currentOctave-2,minOctave),maxOctave));
		}
	});


	return me;

}());



