var Input = (function(){

	var me={};

	var touchData = {};
	touchData.touches = [];
	touchData.mouseWheels = [];
	var focusElement;
	var currentEventTarget;
	var resizeTimer = 0;
	var isTouched = false;

	var keyboardTable = KEYBOARDTABLE.azerty;

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

		canvas.addEventListener("keydown",handleKeyDown,false);

		canvas.addEventListener("dragenter", handleDragenter, false);
		canvas.addEventListener("dragover", handleDragover, false);
		canvas.addEventListener("drop", handleDrop, false);

		window.addEventListener("resize",handleResize,false);

		function handleTouchDown(event){

			event.preventDefault();

			if (!isTouched){
				// first touch - init media on IOS
				isTouched = true;
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
				x -= rect.left;
				y -= rect.top;

				currentEventTarget = UI.getEventElement(x,y);
				console.error("final target:",currentEventTarget);

				var thisTouch = {
					id: id,
					x: x,
					y: y,
					startX: x,
					startY: y,
					UIobject: currentEventTarget
				};

				touchData.touches.push(thisTouch);

				if (thisTouch.UIobject && thisTouch.UIobject.onDragStart){
					thisTouch.UIobject.onDragStart(thisTouch);
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
			}

			function updateTouch(touchIndex,x,y){
				if (touchIndex>=0){
					var thisTouch =touchData.touches[touchIndex];

					thisTouch.x = x;
					thisTouch.y = y;

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

				if (event.touches.length == 0){
					resetInput();
				}
			}else{
				endTouch(getTouchIndex("notouch"));
				resetInput();
			}

			function endTouch(touchIndex){
				if (touchIndex>=0){
					var thisTouch =touchData.touches[touchIndex];
					if (thisTouch.UIobject){
						var elm = thisTouch.UIobject;
						if (elm.onClick) elm.onClick(thisTouch);
						if (elm.onTouchUp) elm.onTouchUp(thisTouch);
					}
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
			var keyCode = event.keyCode;
			var key = event.key;

			if (focusElement && focusElement.onKeyDown){
				var handled = focusElement.onKeyDown(keyCode,e);
				if (handled) return;
			}

			if (key && (keyCode>40) && (keyCode<200)){
				var note = keyboardTable[key];
				var doPlay = true;
				if (Tracker.isRecording()){
					if (Tracker.getCurrentTrackPosition() > 0){
						// cursorPosition is not on note
						doPlay = false;
						var re = /[0-9A-Fa-f]/g;
						if (re.test(key)){
							Tracker.putNoteParam(Tracker.getCurrentTrackPosition(),parseInt(key,16));
							Tracker.moveCurrentPatternPos(1);
						}
					}else{
						if (note){
							Tracker.putNote(Tracker.getCurrentSampleIndex(),note.period);
							if (Tracker.isPlaying()){
								doPlay = false;
							}else{
								Tracker.moveCurrentPatternPos(1);
							}
						}
					}
				}

				if (doPlay && note){
					Audio.playSample(Tracker.getCurrentSampleIndex(),note.period);
					return;
				}

			}

			switch(keyCode){
				case 8:// backspace
					if (Tracker.isRecording()){
						Tracker.putNote(0,0);
						Tracker.moveCurrentPatternPos(1);
					}else{
						Tracker.playPatternStep(Tracker.getCurrentTrackPosition());
						Tracker.moveCurrentPatternPos(-1);
						// on Mac this should probably be delete ...
					}

					break;
				case 13:// enter
					Tracker.playPatternStep(Tracker.getCurrentTrackPosition());
					Tracker.moveCurrentPatternPos(1);
					break;
				case 16:// shift
					//Tracker.playPattern();
					break;
				case 32:// space
					Tracker.toggleRecord();
					break;
				case 35:// end
					Tracker.setCurrentPatternPos(63);
					break;
				case 36:// home
					Tracker.setCurrentPatternPos(0);
					break;
				case 37:// left
					Tracker.moveCursorPosition(-1);
					break;
				case 38:// up
					Tracker.moveCurrentPatternPos(-1);
					break;
				case 39:// right
					Tracker.moveCursorPosition(1);
					break;
				case 40: // down
					Tracker.moveCurrentPatternPos(1);
					break;
				case 46: // delete
					if (Tracker.isRecording()){
						Tracker.putNote(0,0);
						Tracker.moveCurrentPatternPos(1);
					}
					break;
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
			// throttle resize events - resizing is expensive as all the canvas cache needs to be regenerated
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function(){
				me.setSize(window.innerWidth,window.innerHeight)
			},100);
		}


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


	return me;

}());



