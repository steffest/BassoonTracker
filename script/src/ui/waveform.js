UI.WaveForm = function(){

	var me = UI.element();
	var currentSampleData;
	var currentInstrument;
	var isPlaying;
	var isDraggingRange;
	var startPlayTime;
	var sampleRate;
	var sampleLength;
	var dragRangeStart;
	var dragRangeEnd;
	var dragMarker = 0;
	var activeDragMarker = 0;
	var dragMarkerStart = 0;
	var isDown = false;

	var MARKERTYPE = {
		start: 1,
		end: 2
	};

	var waveformDisplay = UI.element();

	var background = UI.scale9Panel(0,0,me.width,me.height,{
		img: Y.getImage("panel_dark"),
		left:3,
		top:3,
		right:2,
		bottom: 2
	});
	background.ignoreEvents = true;


	function isRefreshing(){
		return isPlaying || isDraggingRange;
	}

	EventBus.on(EVENT.screenRefresh,function(){
		if (!isRefreshing()) return;
		if (!me.isVisible()) return;
		me.refresh();
	});

	me.onDragStart = function(touchData){

		var x = touchData.startX - me.left;

		if (currentInstrument.loop.enabled){

			markerX = getLoopMarkerPos(MARKERTYPE.end);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.end;
				dragMarkerStart = currentInstrument.loop.length;
				return;
			}

			var markerX = getLoopMarkerPos(MARKERTYPE.start);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.start;
				dragMarkerStart = currentInstrument.loop.start;
				return;
			}

		}


		isDraggingRange = true;
		dragRangeStart = dragRangeEnd = touchData.startX - me.left;
	};

	me.onDrag = function(touchData){
		if (dragMarker){
			activeDragMarker = dragMarker;
			var pixelValue = currentInstrument.sample.length/me.width;
			var delta = touchData.dragX-touchData.startX;
			var value = dragMarkerStart + Math.round(pixelValue*delta);
			if (!Tracker.inFTMode()) value -= value%2;

			var newProps = {};

			if (dragMarker === MARKERTYPE.start){
				value = Math.min(value,sampleLength-2);
				value = Math.max(value,0);
				newProps.loopStart = value;

				if ((newProps.loopStart + currentInstrument.loop.length)>sampleLength){
					newProps.loopLength = sampleLength - newProps.loopStart;
				}
			}else{
				value = Math.max(value,2);
				value = Math.min(value,sampleLength-currentInstrument.loop.start);

				newProps.loopLength = value;
			}

			EventBus.trigger(EVENT.samplePropertyChange,newProps);
			//me.refresh();
			return;
		}
		dragRangeEnd = touchData.dragX - me.left;
	};

	me.onTouchUp = function(touchData){
		isDraggingRange = false;
		dragMarker = 0;
		isDown = false;
	};

	me.onDown = function(touchData){
		isDown = true;
	};

	me.onHover = function(data){

		var prevDragMarker = activeDragMarker;
		if (!isDown) activeDragMarker = 0;

		if (currentInstrument.loop.enabled){

			if (!isDraggingRange && !dragMarker && !isDown){


				var x = me.eventX;
				var y = me.eventY;
				console.error(x,y);

				markerX = getLoopMarkerPos(MARKERTYPE.end);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.end;
					if (prevDragMarker !== activeDragMarker){
						me.refresh();
						return;
					}
				}

				markerX = getLoopMarkerPos(MARKERTYPE.start);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.start;
					if (prevDragMarker !== activeDragMarker){
						me.refresh();
						return;
					}
				}

				if (prevDragMarker !== activeDragMarker){
					me.refresh();
				}

			}

		}



	};

	me.onResize = function(){
		waveformDisplay.setPosition(0,0);
		waveformDisplay.setSize(me.width,me.height);
	};

	me.setInstrument = function(instrument){
		currentInstrument = instrument;
		if (instrument){
			currentSampleData = currentInstrument.sample.data;
			sampleLength = currentSampleData.length;
		}else{
			currentSampleData = undefined;
			sampleLength = 0;
		}
		isPlaying = false;
		waveformDisplay.needsRendering = true;
		me.refresh();
	};

	me.play = function(period){
		isPlaying = true;
		startPlayTime = new Date().getTime();
		sampleRate = Audio.getSampleRateForPeriod(period);
		me.refresh();
	};

	me.render = function(){
		console.error(activeDragMarker);
		//   TODO: put wave on separate canvas
		if (this.needsRendering) {

			if (waveformDisplay.needsRendering){

				console.error("update wave");

				waveformDisplay.clearCanvas();

				waveformDisplay.ctx.fillStyle = "rgb(13, 19, 27)";
				waveformDisplay.ctx.fillRect(0, 0, me.width, me.height);
				waveformDisplay.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

				if (background.width != me.width) background.setSize(me.width,me.height);
				waveformDisplay.ctx.drawImage(background.render(true),0,0,me.width,me.height);

				if (currentSampleData && currentSampleData.length && me.width){
					// instrument 1 value each pixel
					var step = sampleLength / me.width;
					var mid = me.height/2;

					waveformDisplay.ctx.beginPath();

					var maxHeight = (me.height/2) - 2;

					for (var i = 0; i<me.width; i++){
						var index = Math.floor(i*step);
						var peak = currentSampleData[index] * maxHeight;

						if(i === 0) {
							waveformDisplay.ctx.moveTo(i, mid + peak);
						} else {
							waveformDisplay.ctx.lineTo(i,mid + peak);
						}
					}
					waveformDisplay.ctx.stroke();
				}
				waveformDisplay.needsRendering = false;
			}
			me.ctx.drawImage(waveformDisplay.canvas,0,0);


			if (isPlaying && sampleLength){
				var now = new Date().getTime();
				var delta = now - startPlayTime;
				var index = (sampleRate * delta)/1000;

				if (currentInstrument.loop.enabled && index>currentInstrument.loop.start){
					index = currentInstrument.loop.start + ((index-currentInstrument.loop.start)%currentInstrument.loop.length);
					//isPlaying=false;
					var pos = (index / sampleLength) * me.width;
					me.ctx.fillStyle = "rgb(241, 162, 71)";
					me.ctx.fillRect(pos,0,1,me.height);
				}else{
					if (index>sampleLength){
						isPlaying=false;
					}else{
						var pos = (index / sampleLength) * me.width;
						me.ctx.fillStyle = "rgb(241, 162, 71)";
						me.ctx.fillRect(pos,0,1,me.height);
					}
				}
			}

			if (currentInstrument.loop.length>2 || currentInstrument.loop.enabled){

				var color = currentInstrument.loop.enabled ? "rgb(241, 220, 71)" : "rgba(150, 150, 150,0.7)";

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.start) me.ctx.fillStyle = "white";
				var lineX = getLoopMarkerPos(MARKERTYPE.start);
				me.ctx.fillRect(lineX,0,1,me.height);
				me.ctx.fillRect(lineX-4,0,4,10);

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.end) me.ctx.fillStyle = "white";
				lineX = getLoopMarkerPos(MARKERTYPE.end);
				me.ctx.fillRect(lineX,0,1,me.height);
				me.ctx.fillRect(lineX+1,0,4,10);
			}

			if (isDraggingRange){
				me.ctx.fillStyle = "rgba(241, 162, 71,0.3)";
				me.ctx.fillRect(dragRangeStart,0,dragRangeEnd-dragRangeStart,me.height);
			}

		}
		this.needsRendering = false;


		me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);

	};



	function getLoopMarkerPos(type){
		var lineX;
		var loopStart = currentInstrument.loop.start || 0;

		if (type === MARKERTYPE.start){
			lineX = Math.floor((loopStart/sampleLength) * me.width);
			return Math.max(5,lineX);
		}

		lineX = Math.floor(((loopStart + currentInstrument.loop.length)/sampleLength) * me.width);
		return(Math.min(lineX,me.width-6));


	}

	return me;

};

