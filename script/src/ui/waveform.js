UI.WaveForm = function(){

	var me = UI.element();
	me.name = "Waveform";
	var currentSampleData;
	var currentInstrument;
	var isPlaying;
	var isDraggingRange;
	var hasRange;
	var startPlayTime;
	var sampleRate;
	var sampleLength;
	var dragRangeStart;
	var dragRangeEnd;
	var rangeStart = -1;
	var rangeEnd = -1;
	var rangeLength = 0;
	var dragMarker = 0;
	var activeDragMarker = 0;
	var dragMarkerStart = 0;
	var isDown = false;
	var zoom = 1;
	var zoomStart = 0;
	var zoomEnd = 0;
	var zoomLength = 0;
	var hasHorizontalScrollBar;
	var ignoreInstrumentChange;
	var rangeCache = [];
	var playingOffset = 0;

	var MARKERTYPE = {
		loopStart: 1,
		loopEnd: 2,
		rangeStart: 3,
		rangeEnd: 4
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

	var scrollBar = UI.scale9Panel(1,0,100,18,{
		img: Y.getImage("bar"),
		left:2,
		top:2,
		right:3,
		bottom: 3
	});

	scrollBar.onDragStart=function(){
		//if (Tracker.isPlaying()) return;
		scrollBar.startDragIndex = zoomStart;
		scrollBar.startLeft = scrollBar.left;
	};

	scrollBar.onDrag=function(touchData){
		var delta =  touchData.deltaX;
		var newPos = scrollBar.startLeft + delta;
		var min = 1;
		var max = me.width - scrollBar.width - 1;

		newPos = Math.max(newPos,min);
		newPos = Math.min(newPos,max);

		scrollBar.setPosition(newPos,scrollBar.top);

		var range = newPos/(max-min);
		zoomLength = zoomEnd - zoomStart;
		zoomStart = Math.floor((sampleLength-zoomLength) * range);
		zoomEnd = zoomStart + zoomLength;
		waveformDisplay.refresh();



	};
	me.addChild(scrollBar);


	function isRefreshing(){
		return isPlaying || isDraggingRange;
	}

	EventBus.on(EVENT.screenRefresh,function(){
		if (!isRefreshing()) return;
		if (!me.isVisible()) return;
		me.refresh();
	});
	
	
	me.scroll = function(delta){
		var newPos = scrollBar.left + delta;
		var min = 1;
		var max = me.width - scrollBar.width - 1;

		newPos = Math.max(newPos,min);
		newPos = Math.min(newPos,max);

		scrollBar.setPosition(newPos,scrollBar.top);

		var range = newPos/(max-min);
		zoomLength = zoomEnd - zoomStart;
		zoomStart = Math.floor((sampleLength-zoomLength) * range);
		zoomEnd = zoomStart + zoomLength;
		waveformDisplay.refresh();
		
	}

	me.onDragStart = function(touchData){

		var x = touchData.startX;

		if (currentInstrument.sample.loop.enabled){

			var markerX = getLoopMarkerPos(MARKERTYPE.loopEnd);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.loopEnd;
				dragMarkerStart = currentInstrument.sample.loop.length;
				return;
			}

			markerX = getLoopMarkerPos(MARKERTYPE.loopStart);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.loopStart;
				dragMarkerStart = currentInstrument.sample.loop.start;
				return;
			}

		}

		if (rangeLength){
			markerX = getRangeMarkerPos(MARKERTYPE.rangeEnd);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.rangeEnd;
				dragMarkerStart = rangeLength;
				return;
			}
		}

		if (rangeStart>=0){
			markerX = getRangeMarkerPos(MARKERTYPE.rangeStart);
			if (Math.abs(x-markerX)<5){
				dragMarker = MARKERTYPE.rangeStart;
				dragMarkerStart = rangeStart;
				return;
			}
		}

		isDraggingRange = true;
		dragRangeStart = dragRangeEnd = touchData.startX;

		var pixelValue = (currentInstrument.sample.length/me.width)/zoom;
		rangeStart = rangeEnd = Math.round(zoomStart + (dragRangeStart * pixelValue));
		rangeLength = 0;
		EventBus.trigger(EVENT.samplePropertyChange,{
			rangeLength: rangeLength
		});
	};

	me.onDrag = function(touchData){
		var pixelValue = (currentInstrument.sample.length/me.width)/zoom;

		if (dragMarker && (dragMarker === MARKERTYPE.loopStart || dragMarker === MARKERTYPE.loopEnd)){
			activeDragMarker = dragMarker;
			var delta = touchData.deltaX;
			var value = dragMarkerStart + Math.round(pixelValue*delta);
			if (!Tracker.inFTMode()) value -= value%2;

			var newProps = {};

			if (dragMarker === MARKERTYPE.loopStart){
				value = Math.min(value,sampleLength-2);
				value = Math.max(value,0);
				newProps.loopStart = value;

				if ((newProps.loopStart + currentInstrument.sample.loop.length)>sampleLength){
					newProps.loopLength = sampleLength - newProps.loopStart;
				}
			}else{
				value = Math.max(value,2);
				value = Math.min(value,sampleLength-currentInstrument.sample.loop.start);

				newProps.loopLength = value;
			}

			EventBus.trigger(EVENT.samplePropertyChange,newProps);
			me.refresh();
			return;
		}


		if (dragMarker && (dragMarker === MARKERTYPE.rangeStart || dragMarker === MARKERTYPE.rangeEnd)){
			activeDragMarker = dragMarker;
			delta = touchData.deltaX;
			value = dragMarkerStart + Math.round(pixelValue*delta);



			if (dragMarker === MARKERTYPE.rangeStart){
				value = Math.min(value,sampleLength-2);
				value = Math.max(value,0);
				rangeStart = value;

				if ((rangeStart + rangeLength)>sampleLength){
					rangeLength = sampleLength - rangeStart;
				}
			}else{
				value = Math.max(value,2);
				value = Math.min(value,sampleLength-rangeStart);
				rangeLength = value;
			}

			EventBus.trigger(EVENT.samplePropertyChange,{
				rangeLength: rangeLength
			});
			me.refresh();
			return;
		}


		dragRangeEnd = touchData.x;
		rangeEnd = Math.round(zoomStart + (dragRangeEnd * pixelValue));
		rangeEnd = Math.max(rangeEnd,0);
		rangeLength = rangeEnd - rangeStart;

		EventBus.trigger(EVENT.samplePropertyChange,{
			rangeLength: Math.abs(rangeLength)
		});
	};

	me.onTouchUp = function(touchData){

		if (isDraggingRange){
			if (rangeStart>rangeEnd){
				rangeLength = rangeStart-rangeEnd;
				rangeStart = rangeEnd;
				rangeEnd = rangeStart+rangeLength;
				me.refresh();
			}
		}

		isDraggingRange = false;
		dragMarker = 0;
		isDown = false;

		if (rangeLength) UI.setSelection(me.processSelection);
	};

	me.onDown = function(touchData){
		isDown = true;
	};

	me.onHover = function(data){

		if (!isDraggingRange && !dragMarker && !isDown){

			var prevDragMarker = activeDragMarker;
			if (!isDown) activeDragMarker = 0;

			var x = me.eventX;
			var y = me.eventY;

			if (rangeStart>=0){
				markerX = getRangeMarkerPos(MARKERTYPE.rangeStart);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.rangeStart;
					if (prevDragMarker !== activeDragMarker)me.refresh();
					return;
				}
			}

			if (rangeEnd>=0){
				var markerX = getRangeMarkerPos(MARKERTYPE.rangeEnd);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.rangeEnd;
					if (prevDragMarker !== activeDragMarker) me.refresh();
					return;
				}
			}


			if (currentInstrument.sample.loop.enabled){

					markerX = getLoopMarkerPos(MARKERTYPE.loopEnd);
					if (Math.abs(x-markerX)<5){
						activeDragMarker = MARKERTYPE.loopEnd;
						if (prevDragMarker !== activeDragMarker)me.refresh();
						return;
					}

					markerX = getLoopMarkerPos(MARKERTYPE.loopStart);
					if (Math.abs(x-markerX)<5){
						activeDragMarker = MARKERTYPE.loopStart;
						if (prevDragMarker !== activeDragMarker)me.refresh();
						return;
					}

			}

			if (prevDragMarker !== activeDragMarker){
				me.refresh();
			}
		}

	};

	me.onResize = function(){
		waveformDisplay.setPosition(0,0);
		waveformDisplay.setSize(me.width,me.height);

		scrollBar.setPosition(scrollBar.left,me.height - 18);
		if (zoom>1){
			scrollBar.setSize(Math.floor(me.width/zoom),18);
		}

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

		EventBus.trigger(EVENT.samplePropertyChange,{
			sampleLength: sampleLength,
            loopLength: instrument ? instrument.sample.loop.length : 0,
			internal:true
		});

		if (ignoreInstrumentChange) return;

		isPlaying = false;
		me.zoom(1);
		rangeStart=-1;
		rangeEnd=-1;
		rangeLength=0;
		me.refresh();
	};

	me.play = function(period,offset){
		if (zoom>1) return;
		offset = offset || 0;
		
		playingOffset = offset;
		isPlaying = true;
		startPlayTime = new Date().getTime();
		sampleRate = Audio.getSampleRateForPeriod(period);
		me.refresh();
	};

	me.playSection = function(section){
		if (section === "range"){
			Input.handleNoteOn(Input.getPrevIndex(),undefined,rangeStart);
		}
		if (section === "loop"){
			Input.handleNoteOn(Input.getPrevIndex(),undefined,currentInstrument.sample.loop.start);
		}

	};

	me.stop = function(){
		isPlaying = false;
		me.refresh();
	};

	me.zoom = function(amount){

		var handled = false;
		if (amount === "range"){
			if (rangeLength){
				// zoom to range
				zoomStart = rangeStart;
				zoomLength = rangeLength;
				zoomEnd = zoomStart + zoomLength;
				zoom = sampleLength/zoomLength;

				var sWidth = me.width/zoom;
				var sMax = me.width-sWidth-2;
				scrollBar.setPosition(Math.floor((zoomStart/(sampleLength-zoomLength))*sMax),scrollBar.top);
				handled = true;
			}else{
				// zoom to entire sample
				amount=1;
			}
		}

		if (amount === "loop"){
			if (currentInstrument.sample.loop.enabled){
				zoomStart = currentInstrument.sample.loop.start;
				zoomLength = currentInstrument.sample.loop.length;
				zoomEnd = zoomStart + zoomLength;
				zoom = sampleLength/zoomLength;

				sWidth = me.width/zoom;
				sMax = me.width-sWidth-2;
				scrollBar.setPosition(Math.floor((zoomStart/(sampleLength-zoomLength))*sMax),scrollBar.top);
			}
			handled = true;
		}

		if (amount === 1 || zoom === 1){
			zoom = 1;
			zoomStart = 0;
		}

		if (!handled){
			zoom *= amount;
			zoom = Math.max(zoom,1);

			zoomLength = Math.floor(sampleLength/zoom);
			zoomEnd = zoomStart + zoomLength;
		}


		scrollBar.setSize(Math.floor(me.width/zoom),18);
		hasHorizontalScrollBar = zoom>1;

		if (hasHorizontalScrollBar){
			if (zoomEnd>sampleLength){
				zoomStart = sampleLength - zoomLength;
				zoomEnd = sampleLength;
				scrollBar.setPosition(me.width - scrollBar.width - 1,scrollBar.top);
			}
		}
		waveformDisplay.refresh();
		me.refresh();

	};


	me.select = function(range,start,length){

		switch (range){
			case "all":
				rangeStart = 0;
				rangeEnd = currentSampleData.length;
				rangeLength = currentSampleData.length;
				me.refresh();
				break;
			case "none":
				rangeStart = -1;
				rangeEnd = -1;
				rangeLength = 0;
				me.refresh();
				break;
			case "loop":
				if (currentInstrument.sample.loop.length>2){
					rangeStart = currentInstrument.sample.loop.start;
					rangeLength = currentInstrument.sample.loop.length;
					rangeEnd = rangeStart+rangeLength;
					me.refresh();
				}
				break;
			case "start":
				rangeStart = 0;
				rangeLength = rangeEnd - rangeStart;
				me.refresh();
				break;
			case "end":
				rangeEnd = currentSampleData.length;
				rangeLength = rangeEnd - rangeStart;
				me.refresh();
				break;
			case "range":
				rangeStart = start;
				rangeLength = length;
				rangeEnd = rangeStart + rangeLength;
				me.refresh();
				break;
		}

		EventBus.trigger(EVENT.samplePropertyChange,{
			rangeLength: rangeLength
		});

		UI.setSelection(me.processSelection);
	};


	me.render = function(){
		//   TODO: put wave on separate canvas
		if (this.needsRendering) {

			if (waveformDisplay.needsRendering){

				console.log("updating wave");

				waveformDisplay.clearCanvas();

				waveformDisplay.ctx.fillStyle = "rgb(13, 19, 27)";
				waveformDisplay.ctx.fillRect(0, 0, me.width, me.height);
				waveformDisplay.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

				if (background.width !== me.width) background.setSize(me.width,me.height);
				waveformDisplay.ctx.drawImage(background.render(true),0,0,me.width,me.height);

				if (currentSampleData && currentSampleData.length && me.width){

					if (zoom === 1){
						zoomStart = 0;
						zoomEnd = sampleLength;
					}

					zoomLength = zoomEnd-zoomStart;


					// instrument 1 value each pixel
					var step = zoomLength / me.width;
					var mid = me.height/2;
					waveformDisplay.ctx.beginPath();

					var maxHeight = (me.height/2) - 2;

					for (var i = 0; i<me.width; i++){
						var index = Math.floor(i*step);
						var peak = currentSampleData[zoomStart + index] * -maxHeight;

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
				var index = playingOffset + (sampleRate * delta)/1000;

				if (currentInstrument.sample.loop.enabled && index>currentInstrument.sample.loop.start){
					index = currentInstrument.sample.loop.start + ((index-currentInstrument.sample.loop.start)%currentInstrument.sample.loop.length);
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

			if (currentInstrument.sample.loop.length>2 || currentInstrument.sample.loop.enabled){

				var color = currentInstrument.sample.loop.enabled ? "rgb(241, 220, 71)" : "rgba(150, 150, 150,0.7)";

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.loopStart) me.ctx.fillStyle = "white";
				var lineX = getLoopMarkerPos(MARKERTYPE.loopStart);
				me.ctx.fillRect(lineX,0,1,me.height-1);
				me.ctx.fillRect(lineX-4,0,4,10);

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.loopEnd) me.ctx.fillStyle = "white";
				lineX = getLoopMarkerPos(MARKERTYPE.loopEnd);
				me.ctx.fillRect(lineX,0,1,me.height-1);
				me.ctx.fillRect(lineX+1,0,4,10);
			}

			var rangeLineX1 = -1;
			var rangeLineX2 = -1;

			if (rangeEnd>=0){
				color = "rgb(241, 131, 71)";
				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.rangeEnd) me.ctx.fillStyle = "white";
				rangeLineX2 = getRangeMarkerPos(MARKERTYPE.rangeEnd);
				me.ctx.fillRect(rangeLineX2,0,1,me.height-1);
				me.ctx.fillRect(rangeLineX2+1,11,4,10);
			}

			if (rangeStart>=0){
				if (rangeStart<zoomStart){
					rangeLineX1=0;
				}else{
					color = "rgb(241, 131, 71)";
					me.ctx.fillStyle = color;
					if (activeDragMarker === MARKERTYPE.rangeStart) me.ctx.fillStyle = "white";
					rangeLineX1 = getRangeMarkerPos(MARKERTYPE.rangeStart);
					me.ctx.fillRect(rangeLineX1,0,1,me.height-1);
					me.ctx.fillRect(rangeLineX1-4,11,4,10);
				}

				if ((rangeStart+rangeLength)<zoomStart){
					rangeLineX1 = rangeLineX2 = -1;
				}
			}


			if (rangeLineX1 !== rangeLineX2){
				if (rangeLineX1>=0){
					rangeLineX2 = Math.min(rangeLineX2,me.width);
					if (rangeLineX2 <= 0) rangeLineX2 = me.width;
				}
				me.ctx.fillStyle = "rgba(241, 162, 71,0.1)";
				me.ctx.fillRect(rangeLineX1,0,rangeLineX2-rangeLineX1,me.height);
			}


			if (hasHorizontalScrollBar){
				scrollBar.render();
			}


		}
		this.needsRendering = false;


		me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);

	};



	function getLoopMarkerPos(type){
		var lineX;
		var loopStart = currentInstrument.sample.loop.start || 0;


		if (type === MARKERTYPE.loopStart){
			if (loopStart<zoomStart) return -10;
			if (loopStart>zoomEnd) return -10;
			zoomLength = zoomEnd-zoomStart;

			lineX = Math.floor(((loopStart-zoomStart)/zoomLength) * me.width);
			return Math.max(zoomStart>5?0:5,lineX);
		}

		var point = (loopStart + currentInstrument.sample.loop.length);
		if (point<zoomStart) return -10;
		if (point>zoomEnd) return -10;

		lineX = Math.floor(((point-zoomStart)/zoomLength) * me.width);
		return(Math.min(lineX,me.width-(zoomEnd>sampleLength-6?6:0)));
	}

	function getRangeMarkerPos(type){
		var lineX;

		if (type === MARKERTYPE.rangeStart){
			if (rangeStart<zoomStart) return -10;
			if (rangeStart>zoomEnd) return -10;
			zoomLength = zoomEnd-zoomStart;

			lineX = Math.floor(((rangeStart-zoomStart)/zoomLength) * me.width);
			return Math.max(zoomStart>5?0:5,lineX);
		}

		var point = (rangeStart + rangeLength);
		if (point<zoomStart) return -10;
		if (point>zoomEnd) return -10;

		lineX = Math.floor(((point-zoomStart)/zoomLength) * me.width);
		return(Math.min(lineX,me.width-(zoomEnd>sampleLength-6?6:0)));
	}

	function xToZoomX(x){
		if (x<zoomStart) return -1;
	}


	// effects
	function splitRange(useEmptyRange){
		var result = {};
		if (rangeLength){
			result.tail = currentSampleData.slice(rangeStart + rangeLength);
			result.range = currentSampleData.slice(rangeStart,rangeStart + rangeLength);
			result.head = currentSampleData.slice(0,rangeStart);
		}else{
			if (useEmptyRange){
				result.range = [];
				result.tail = currentSampleData.slice(rangeStart);
				result.head = currentSampleData.slice(0,rangeStart);
			}else{
				result.tail = [];
				result.range = currentSampleData.slice(0,currentSampleData.length);
				result.head = [];
			}

		}

		return result;
	}

	function joinRange(parts){
		currentSampleData = parts.head.concat(parts.range).concat(parts.tail);
		currentInstrument.sample.data = currentSampleData;
		currentInstrument.sample.length = currentSampleData.length;
		ignoreInstrumentChange = true;
		EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
		ignoreInstrumentChange = false;
		waveformDisplay.refresh();
		me.refresh();
	}
	
	function checkLoop(){
		var ls = currentInstrument.sample.loop.start;
		var ll = currentInstrument.sample.loop.length;
		var sl = currentInstrument.sample.length
		
		if (ls<0) ls=0;
		if (ll<0) ll=0;
		
		if ((ls+ll)>sl){
			if (ls>sl){
				ls=sl;
			}
			ll=sl-ls;
		}
		
		if (ls!==currentInstrument.sample.loop.start || ll!==currentInstrument.sample.loop.length){
			currentInstrument.sample.loop.start=ls;
			currentInstrument.sample.loop.length=ll;
			
			ignoreInstrumentChange = true;
			EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
			ignoreInstrumentChange = false;
			waveformDisplay.refresh();
			me.refresh();
		}
	}
	
	function restoreLoop(action){
		if (action.loopStart || action.loopLength){
			currentInstrument.sample.loop.start = action.loopStart || 0;
			currentInstrument.sample.loop.length = action.loopLength || 0;

			ignoreInstrumentChange = true;
			EventBus.trigger(EVENT.instrumentChange,Tracker.getCurrentInstrumentIndex());
			ignoreInstrumentChange = false;
		}
		
	}


	me.adjustVolume = function(amount){
		var data = splitRange();

		//console.error(currentSampleData.length,data.range.length);
		var scale,i,len;
		var update = false;

		
		var editAction = StateManager.createSampleUndo(SELECTION.REPLACE,rangeStart,rangeLength);
		editAction.data = data.range.slice(0);
		editAction.name = "Adjust Volume";

		if (amount === "max"){
			var min = 0;
			var max = 0;
			for (i = 0, len = data.range.length; i<len; i++){
				min = Math.min(min,data.range[i]);
				max = Math.max(max,data.range[i]);
			}
			scale = 1/Math.max(max,-min);
			if (scale>1){
				for (i = 0, len = data.range.length; i<len; i++){
					data.range[i] = data.range[i]*scale;
				}
				update = true;
			}
		}

		if (amount === "fadein"){
			for (i = 0, len = data.range.length-1; i<=len; i++){
				scale = i/len;
				data.range[i] = data.range[i]*scale;
			}
			update = true;
		}
		if (amount === "fadeout"){
			for (i = 0, len = data.range.length-1; i<=len; i++){
				scale = 1-i/len;
				data.range[i] = data.range[i]*scale;
			}
			update = true;
		}

		if (!update){
			if (typeof amount === "number"){
				scale = 1 + (1/amount);
				for (i = 0, len = data.range.length-1; i<=len; i++){
					data.range[i] = Math.min(Math.max(data.range[i]*scale,-1),1);
				}
			}
			update = true;
		}

		if (update){
			editAction.dataTo = data.range.slice(0);
			StateManager.registerEdit(editAction);
			joinRange(data);
		}
	};

	me.reverse = function(){
		var data = splitRange();

		var editAction = StateManager.createSampleUndo(SELECTION.REPLACE,rangeStart,rangeLength);
		editAction.data = data.range.slice(0);
		editAction.name = "Reverse Sample";
		
		data.range = data.range.reverse();

		editAction.dataTo = data.range.slice(0);
		StateManager.registerEdit(editAction);
		
		joinRange(data);
	};

	me.invert = function(){
		var data = splitRange();

		var editAction = StateManager.createSampleUndo(SELECTION.REPLACE,rangeStart,rangeLength);
		editAction.data = data.range.slice(0);
		editAction.name = "Reverse Sample";
		
		
		for (var i = 0, len = data.range.length-1; i<=len; i++){
			data.range[i] = -data.range[i];
		}

		editAction.dataTo = data.range.slice(0);
		StateManager.registerEdit(editAction);
		
		joinRange(data);
	};

	me.resample = function(direction){
		var data = splitRange();
		var newRange = [];

		var editAction = StateManager.createSampleUndo(SELECTION.REPLACE,rangeStart,rangeLength);
		editAction.data = data.range.slice(0);
		editAction.name = "Resample Sample";
		editAction.loopStart = currentInstrument.sample.loop.start;
		editAction.loopLength = currentInstrument.sample.loop.length;


		if (direction === "up"){
			for (var i = 0, len = data.range.length; i<len; i++){
				// should we interpolate?
				newRange.push(data.range[i]);
				newRange.push(data.range[i]);
			}
			currentInstrument.sample.loop.start = Math.floor(currentInstrument.sample.loop.start*2);
			currentInstrument.sample.loop.length = Math.floor(currentInstrument.sample.loop.length*2);
			rangeStart = rangeStart*2;
			rangeLength = rangeLength*2;
			rangeEnd = rangeStart + rangeLength;
		}else{
			for (var i = 0, len = data.range.length; i<len; i+=2){
				newRange.push(data.range[i]);
			}
			currentInstrument.sample.loop.start = Math.floor(currentInstrument.sample.loop.start/2);
			currentInstrument.sample.loop.length = Math.floor(currentInstrument.sample.loop.length/2);
			rangeStart = Math.floor(rangeStart/2);
			rangeLength = Math.floor(rangeLength/2);
			rangeEnd = rangeStart + rangeLength;
		}
		if (!Tracker.inFTMode()){
			currentInstrument.sample.loop.start = currentInstrument.sample.loop.start - currentInstrument.sample.loop.start%2;
			currentInstrument.sample.loop.length = currentInstrument.sample.loop.length - currentInstrument.sample.loop.length%2;
		}
		data.range = newRange;

		editAction.dataTo = newRange.slice(0);
		StateManager.registerEdit(editAction);


		joinRange(data);
	};

	me.processSelection = function(state){
		if (!me.isVisible()) return;
		switch (state) {
			case SELECTION.RESET:
				// keep selection persistent
				return false;
			case SELECTION.CLEAR:
				me.adjustVolume(0);
				break;
			case SELECTION.COPY:
			case SELECTION.CUT:
				if (rangeLength>0){
					var data = splitRange();
					rangeCache = data.range.slice(0);

					if (state === SELECTION.CUT){

						var editAction = StateManager.createSampleUndo(SELECTION.CUT,rangeStart,rangeLength);
						editAction.data = data.range.slice(0);
						editAction.name = "cut sample";
						editAction.loopStart = currentInstrument.sample.loop.start
						editAction.loopLength = currentInstrument.sample.loop.length
						StateManager.registerEdit(editAction);
						

						data.range = [];
						joinRange(data);
						checkLoop();
						rangeLength = 0;
						rangeEnd = rangeStart + rangeLength;
						EventBus.trigger(EVENT.samplePropertyChange,{
							rangeLength: rangeLength
						});
						me.refresh();
					}
				}
				break;
			case SELECTION.DELETE:
				if (rangeLength>0){
					var data = splitRange();
					data.range = [];
					joinRange(data);
					rangeLength = 0;
					rangeEnd = rangeStart + rangeLength;
					EventBus.trigger(EVENT.samplePropertyChange,{
						rangeLength: rangeLength
					});
					me.refresh();
				}
				break;
			case SELECTION.PASTE:
				
				//console.error(rangeCache.length,rangeStart)
				data = splitRange(true);
				
				if (rangeStart<0){
					// no selection - paste at end of sample
					rangeStart = currentSampleData.length;
				}

				var editAction = StateManager.createSampleUndo(SELECTION.PASTE,rangeStart,rangeCache.length);
				editAction.name = "paste sample";
				editAction.data = data.range.slice(0);
				editAction.dataTo = rangeCache.slice(0);
				editAction.loopStart = currentInstrument.sample.loop.start;
				editAction.loopLength = currentInstrument.sample.loop.length;
				
				StateManager.registerEdit(editAction);
				
				if (rangeStart>=0){
					data.range = rangeCache;
				}else{
					data.tail = data.tail.concat(rangeCache);
					
				}
				joinRange(data);
				checkLoop();
				
				// paste clears the selection by default
				setTimeout(function(){
					me.select("range",rangeStart,rangeCache.length);
				},10);

				break;
			case SELECTION.POSITION:

				break;
		}
	};


	EventBus.on(EVENT.commandSelectAll,function(){
		if (me.isVisible()){
			me.select("all");
		}
	});

	EventBus.on(EVENT.commandProcessSample,function(action){
		if (me.isVisible()){
			if (action.undo){
				switch (action.action){
					case SELECTION.CUT:
						me.select("range",action.from,0);
						var data = splitRange(true);
						data.range = action.data;
						joinRange(data);
						restoreLoop(action);
						me.select("range",action.from,action.data.length);
						break;
					case SELECTION.PASTE:
						me.select("range",action.from,action.to);
						var data = splitRange(true);
						data.range = action.data;
						joinRange(data);
						restoreLoop(action);
						me.select("range",action.from,action.data.length);
						
						
						break;
					case SELECTION.REPLACE:
						me.select("range",action.from,action.to);
						var data = splitRange();
						data.range = action.data;
						joinRange(data);
						if (action.to){
							me.select("range",action.from,action.data.length);
						}
						break;
				}
			}

			if (action.redo){
				switch (action.action){
					case SELECTION.CUT:
						me.select("range",action.from,action.data.length);
						var data = splitRange();
						data.range = [];
						joinRange(data);
						me.select("range",action.from,0);
						break;
					case SELECTION.PASTE:
						me.select("range",action.from,action.data.length || 0);
						var data = splitRange(true);
						data.range = action.dataTo;
						joinRange(data);
						checkLoop();
						me.select("range",action.from,action.dataTo.length);
						break;
					case SELECTION.REPLACE:
						me.select("range",action.from,action.to);
						var data = splitRange();
						data.range = action.dataTo;
						joinRange(data);
						if (action.to){
							me.select("range",action.from,action.data.length);
						}
						break;
				}
			}

		}
	});

	return me;

};

