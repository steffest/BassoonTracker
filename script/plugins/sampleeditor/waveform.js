import UIElement from "../../src/ui/components/element.js";
import Scale9Panel from "../../src/ui/components/scale9.js";
import Scrollbar from "../../src/ui/components/scrollbar.js";
import EventBus from "../../src/eventBus.js";
import {EVENT, SELECTION} from "../../src/enum.js";
import Audio from "../../src/audio.js";
import UI from "../../src/ui/ui.js";
import StateManager from "../../src/ui/stateManager.js";
import Tracker from "../../src/tracker.js";
import Input from "../../src/ui/input.js";
import Y from "../../src/ui/yascal/yascal.js";
import SampleProcessing from "./sampleProcessing.js";

let WaveForm = function(){

	var me = new UIElement();
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
	var rangeHandleSnapshot = null;
	var rangeHandleEditAction = null;
	var rangeHandleDirty = false;
	var dragSampleIndex = -1;
	var dragSampleStartValue = 0;
	var activeSampleMarkerIndex = -1;
	var sampleEditAction = null;
	var sampleEditDirty = false;
	var drawMode = false;
	var isDrawing = false;
	var prevDrawX = 0;
	var prevDrawY = 0;
	var drawEditSnapshot = null;
	var drawEditFrom = -1;
	var drawEditTo = -1;

	me.setDrawMode = function(enabled){
		drawMode = enabled;
	};

	me.isDrawMode = function(){
		return drawMode;
	};
	var MARKERTYPE = {
		loopStart: 1,
		loopEnd: 2,
		rangeStart: 3,
		rangeEnd: 4,
		rangeVolumeLeft: 5,
		rangeVolumeCenter: 6,
		rangeVolumeRight: 7
	};

	me.menuHeight = 0;
	me.onZoomChange = null;

	me.getZoomState = function() {
		return { zoomStart: zoomStart, zoomLength: zoomLength || sampleLength };
	};

	me.invalidateWave = function() {
		waveformDisplay.needsRendering = true;
		me.refresh();
	};

	var loopCreator = null;
	var hissReductionPanel = null;

	me.addLoopCreator = function(lc) {
		loopCreator = lc;
		me.addChild(lc);
	};

	me.addHissReductionPanel = function(hrp) {
		hissReductionPanel = hrp;
		me.addChild(hrp);
	};

	me.setZoomState = function(state) {
		if (!sampleLength) return;
		zoomStart  = state.zoomStart  || 0;
		zoomLength = state.zoomLength || sampleLength;
		zoomEnd    = zoomStart + zoomLength;
		zoom       = sampleLength / zoomLength;
		hasHorizontalScrollBar = zoom > 1;
		if (hasHorizontalScrollBar) syncScrollBarToZoom();
		waveformDisplay.needsRendering = true;
		me.refresh();
		// Deliberately does NOT fire onZoomChange to avoid feedback loops
	};

	var waveformDisplay = new UIElement();

	var background = new Scale9Panel(0,0,me.width,me.height,{
		img: Y.getImage("panel_dark"),
		left:3,
		top:3,
		right:2,
		bottom: 2
	});
	background.ignoreEvents = true;

	var scrollBar = new Scrollbar(1, 0, 100, 18, {
		img: Y.getImage("bar"),
		left: 2,
		top: 2,
		right: 3,
		bottom: 3
	}, {
		zoom: true,
		trackLeft: 1,
		trackWidth: function(){ return getScrollTrackWidth(); },
		minWidth: 18,
		edgeSize: 6,
		onScroll: updateZoomFromScrollBar,
		onZoom: updateZoomFromScrollBar
	});
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
		if (!hasHorizontalScrollBar) return;
		setScrollBarBounds(scrollBar.left + delta,scrollBar.width);
		updateZoomFromScrollBar();
		
	}

	me.onDragStart = function(touchData){

		var x = touchData.startX;
		var y = touchData.startY;

		if (rangeLength > 0) {
			var hitType = null;
			if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeLeft))   hitType = MARKERTYPE.rangeVolumeLeft;
			else if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeRight))  hitType = MARKERTYPE.rangeVolumeRight;
			else if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeCenter)) hitType = MARKERTYPE.rangeVolumeCenter;

			if (hitType !== null) {
				dragMarker = hitType;
				activeDragMarker = hitType;
				rangeHandleSnapshot = currentSampleData.slice(rangeStart, rangeStart + rangeLength);
				rangeHandleEditAction = StateManager.createSampleUndo(SELECTION.REPLACE, rangeStart, rangeLength);
				rangeHandleEditAction.data = rangeHandleSnapshot.slice(0);
				rangeHandleEditAction.name = "Range Volume Adjust";
				rangeHandleDirty = false;
				return;
			}
		}

		if (!drawMode && currentInstrument.sample.loop.enabled){

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

		if (drawMode && currentSampleData){
			var waveTop = me.menuHeight || 0;
			var waveH = me.height - waveTop;
			var mid = waveH >> 1;
			var maxHeight = (waveH / 2) - 2;
			var si = Math.round(zoomStart + (x / me.width) * zoomLength);
			si = Math.max(0, Math.min(sampleLength - 1, si));
			var val = Math.min(1, Math.max(-1, (waveTop + mid - y) / maxHeight));
			drawEditSnapshot = currentSampleData.slice();
			drawEditFrom = si;
			drawEditTo = si;
			isDrawing = true;
			prevDrawX = x;
			prevDrawY = y;
			currentSampleData[si] = val;
			currentInstrument.sample.data = currentSampleData;
			waveformDisplay.needsRendering = true;
			me.refresh();
			return;
		}

		if (getPixelsPerSample() >= 3 && currentSampleData){
			var nearIndex = getNearestSampleMarker(x, y);
			if (nearIndex >= 0){
				dragSampleIndex = nearIndex;
				dragSampleStartValue = currentSampleData[nearIndex];
				sampleEditAction = StateManager.createSampleUndo(SELECTION.REPLACE, nearIndex, 1);
				sampleEditAction.data = [dragSampleStartValue];
				sampleEditAction.name = "Edit Sample Point";
				sampleEditDirty = false;
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

		if (isDrawing && currentSampleData){
			var waveTop = me.menuHeight || 0;
			var waveH = me.height - waveTop;
			var mid = waveH >> 1;
			var maxHeight = (waveH / 2) - 2;
			var cx = touchData.x;
			var cy = touchData.startY + touchData.deltaY;
			var si1 = Math.round(zoomStart + (prevDrawX / me.width) * zoomLength);
			var si2 = Math.round(zoomStart + (cx / me.width) * zoomLength);
			si1 = Math.max(0, Math.min(sampleLength - 1, si1));
			si2 = Math.max(0, Math.min(sampleLength - 1, si2));
			var v1 = Math.min(1, Math.max(-1, (waveTop + mid - prevDrawY) / maxHeight));
			var v2 = Math.min(1, Math.max(-1, (waveTop + mid - cy) / maxHeight));
			var fromSI = Math.min(si1, si2);
			var toSI = Math.max(si1, si2);
			for (var dsi = fromSI; dsi <= toSI; dsi++){
				var t = (fromSI === toSI) ? 0 : (dsi - fromSI) / (toSI - fromSI);
				if (si2 < si1) t = 1 - t;
				currentSampleData[dsi] = v1 + t * (v2 - v1);
			}
			drawEditFrom = Math.min(drawEditFrom, fromSI);
			drawEditTo = Math.max(drawEditTo, toSI);
			prevDrawX = cx;
			prevDrawY = cy;
			currentInstrument.sample.data = currentSampleData;
			waveformDisplay.needsRendering = true;
			me.refresh();
			return;
		}

		if (dragSampleIndex >= 0){
			var waveTop = me.menuHeight || 0;
			var waveH = me.height - waveTop;
			var maxHeight = (waveH / 2) - 2;
			var newValue = Math.min(1, Math.max(-1, dragSampleStartValue - (touchData.deltaY / maxHeight)));
			currentSampleData[dragSampleIndex] = newValue;
			currentInstrument.sample.data = currentSampleData;
			sampleEditDirty = true;
			waveformDisplay.needsRendering = true;
			me.refresh();
			return;
		}

		if (dragMarker === MARKERTYPE.rangeVolumeLeft ||
		    dragMarker === MARKERTYPE.rangeVolumeCenter ||
		    dragMarker === MARKERTYPE.rangeVolumeRight) {

			activeDragMarker = dragMarker;
			var waveH = me.height - (me.menuHeight || 0);
			var deltaY = touchData.deltaY || 0;
			var scale = Math.max(0, 1 - (deltaY / (waveH / 2)));
			var len = rangeHandleSnapshot.length;

			for (var i = 0; i < len; i++) {
				var s;
				if (dragMarker === MARKERTYPE.rangeVolumeCenter) {
					s = scale;
				} else if (dragMarker === MARKERTYPE.rangeVolumeLeft) {
					var t = len > 1 ? i / (len - 1) : 0;
					s = scale + (1 - scale) * t;
				} else {
					var t = len > 1 ? i / (len - 1) : 1;
					s = 1 + (scale - 1) * t;
				}
				currentSampleData[rangeStart + i] = Math.min(Math.max(rangeHandleSnapshot[i] * s, -1), 1);
			}

			currentInstrument.sample.data = currentSampleData;
			rangeHandleDirty = true;
			waveformDisplay.needsRendering = true;
			me.refresh();
			return;
		}

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
		isDown = false;

		if (isDrawing){
			isDrawing = false;
			if (drawEditSnapshot && drawEditFrom >= 0){
				var drawLen = drawEditTo - drawEditFrom + 1;
				var drawAction = StateManager.createSampleUndo(SELECTION.REPLACE, drawEditFrom, drawLen);
				drawAction.data = drawEditSnapshot.slice(drawEditFrom, drawEditTo + 1);
				drawAction.dataTo = currentSampleData.slice(drawEditFrom, drawEditTo + 1);
				drawAction.name = "Draw Samples";
				StateManager.registerEdit(drawAction);
				ignoreInstrumentChange = true;
				EventBus.trigger(EVENT.instrumentChange, Tracker.getCurrentInstrumentIndex());
				ignoreInstrumentChange = false;
			}
			drawEditSnapshot = null;
			drawEditFrom = -1;
			drawEditTo = -1;
		}

		if (dragSampleIndex >= 0){
			if (sampleEditAction && sampleEditDirty){
				sampleEditAction.dataTo = [currentSampleData[dragSampleIndex]];
				StateManager.registerEdit(sampleEditAction);
				ignoreInstrumentChange = true;
				EventBus.trigger(EVENT.instrumentChange, Tracker.getCurrentInstrumentIndex());
				ignoreInstrumentChange = false;
			}
			sampleEditAction = null;
			sampleEditDirty = false;
			dragSampleIndex = -1;
		}

		if (dragMarker === MARKERTYPE.rangeVolumeLeft ||
		    dragMarker === MARKERTYPE.rangeVolumeCenter ||
		    dragMarker === MARKERTYPE.rangeVolumeRight) {
			if (rangeHandleEditAction && rangeHandleDirty) {
				rangeHandleEditAction.dataTo = currentSampleData.slice(rangeStart, rangeStart + rangeLength);
				StateManager.registerEdit(rangeHandleEditAction);
				ignoreInstrumentChange = true;
				EventBus.trigger(EVENT.instrumentChange, Tracker.getCurrentInstrumentIndex());
				ignoreInstrumentChange = false;
			}
			rangeHandleEditAction = null;
			rangeHandleSnapshot = null;
			rangeHandleDirty = false;
		}

		dragMarker = 0;

		if (rangeLength) UI.setSelection(me.processSelection);
	};

	me.onDown = function(touchData){
		isDown = true;
	};


	me.onHover = function(data){

		if (drawMode){
			UI.setCursor("crosshair");
			return;
		}

		if (!isDraggingRange && !dragMarker && !isDown){

			var prevDragMarker = activeDragMarker;
			var prevSampleMarker = activeSampleMarkerIndex;
			if (!isDown) activeDragMarker = 0;
			activeSampleMarkerIndex = -1;

			var x = me.eventX;
			var y = me.eventY;

			if (rangeLength > 0) {
				var hType = null;
				if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeLeft))        hType = MARKERTYPE.rangeVolumeLeft;
				else if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeRight))  hType = MARKERTYPE.rangeVolumeRight;
				else if (isNearRangeHandle(x, y, MARKERTYPE.rangeVolumeCenter)) hType = MARKERTYPE.rangeVolumeCenter;
				if (hType !== null) {
					activeDragMarker = hType;
					UI.setCursor("ns-resize");
					if (prevDragMarker !== activeDragMarker) me.refresh();
					return;
				}
			}

			if (rangeStart>=0){
				markerX = getRangeMarkerPos(MARKERTYPE.rangeStart);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.rangeStart;
					UI.setCursor("ew-resize");
					if (prevDragMarker !== activeDragMarker)me.refresh();
					return;
				}
			}

			if (rangeEnd>=0){
				var markerX = getRangeMarkerPos(MARKERTYPE.rangeEnd);
				if (Math.abs(x-markerX)<5){
					activeDragMarker = MARKERTYPE.rangeEnd;
					UI.setCursor("ew-resize");
					if (prevDragMarker !== activeDragMarker) me.refresh();
					return;
				}
			}

			if (currentInstrument.sample.loop.enabled){

					markerX = getLoopMarkerPos(MARKERTYPE.loopEnd);
					if (Math.abs(x-markerX)<5){
						activeDragMarker = MARKERTYPE.loopEnd;
						UI.setCursor("ew-resize");
						if (prevDragMarker !== activeDragMarker)me.refresh();
						return;
					}

					markerX = getLoopMarkerPos(MARKERTYPE.loopStart);
					if (Math.abs(x-markerX)<5){
						activeDragMarker = MARKERTYPE.loopStart;
						UI.setCursor("ew-resize");
						if (prevDragMarker !== activeDragMarker)me.refresh();
						return;
					}

			}

			if (getPixelsPerSample() >= 3 && currentSampleData){
				var nearIndex = getNearestSampleMarker(x, y);
				if (nearIndex >= 0){
					activeSampleMarkerIndex = nearIndex;
					UI.setCursor("ns-resize");
					if (prevDragMarker !== activeDragMarker || prevSampleMarker !== activeSampleMarkerIndex) me.refresh();
					return;
				}
			}

			if (prevDragMarker !== activeDragMarker || prevSampleMarker !== activeSampleMarkerIndex){
				UI.setCursor("default");
				me.refresh();
			}
		}

	};

	me.onHoverExit = function() {
		UI.setCursor("default");
	};

	me.onResize = function(){
		var waveTop = me.menuHeight || 0;
		waveformDisplay.setPosition(0, waveTop);
		waveformDisplay.setSize(me.width, me.height - waveTop);
		waveformDisplay.needsRendering = true;

		scrollBar.setPosition(scrollBar.left, me.height - 18);
		if (zoom>1){
			syncScrollBarToZoom();
		}

		if (loopCreator && loopCreator.isVisible()) resizeLoopCreator();
		if (hissReductionPanel && hissReductionPanel.isVisible()) resizeHissReductionPanel();
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


		hasHorizontalScrollBar = zoom>1;

		if (hasHorizontalScrollBar){
			if (zoomEnd>sampleLength){
				zoomStart = sampleLength - zoomLength;
				zoomEnd = sampleLength;
			}
			syncScrollBarToZoom();
		}
		waveformDisplay.refresh();
		me.refresh();
		if (me.onZoomChange) me.onZoomChange(me.getZoomState());

		if (loopCreator && loopCreator.isVisible()) resizeLoopCreator();
		if (hissReductionPanel && hissReductionPanel.isVisible()) resizeHissReductionPanel();
	};

	function resizeHissReductionPanel() {
		if (!hissReductionPanel) return;
		var scrollH = hasHorizontalScrollBar ? 18 : 0;
		hissReductionPanel.menuHeight = me.menuHeight;
		hissReductionPanel.setPosition(0, 0);
		hissReductionPanel.setSize(me.width, me.height - scrollH);
		if (hissReductionPanel.onResize) hissReductionPanel.onResize();
	}

	function resizeLoopCreator() {
		if (!loopCreator) return;
		var scrollH = hasHorizontalScrollBar ? 18 : 0;
		loopCreator.menuHeight = me.menuHeight;
		loopCreator.setPosition(0, 0);
		loopCreator.setSize(me.width, me.height - scrollH);
		if (loopCreator.onResize) loopCreator.onResize();
	}

	function getScrollTrackWidth(){
		return Math.max(me.width - 2,1);
	}

	function setScrollBarBounds(left,width){
		var trackLeft = 1;
		var trackWidth = getScrollTrackWidth();
		var minWidth = Math.min(18,trackWidth);

		width = Math.max(width,minWidth);
		width = Math.min(width,trackWidth);
		left = Math.max(trackLeft,left);
		left = Math.min(left,trackLeft + trackWidth - width);

		scrollBar.setPosition(Math.round(left),scrollBar.top);
		scrollBar.setSize(Math.round(width),18);
	}

	function syncScrollBarToZoom(){
		if (!sampleLength) return;

		var trackWidth = getScrollTrackWidth();
		var left = 1 + Math.floor((zoomStart/sampleLength) * trackWidth);
		var width = Math.ceil((zoomLength/sampleLength) * trackWidth);
		setScrollBarBounds(left,width);
	}

	function updateZoomFromScrollBar(){
		if (!sampleLength) return;

		var trackWidth = getScrollTrackWidth();
		var left = Math.max(scrollBar.left - 1,0);
		var right = Math.min(left + scrollBar.width,trackWidth);

		zoomStart = Math.floor((left/trackWidth) * sampleLength);
		zoomEnd = Math.ceil((right/trackWidth) * sampleLength);
		zoomEnd = Math.max(zoomEnd,zoomStart + 1);
		zoomEnd = Math.min(zoomEnd,sampleLength);
		zoomLength = zoomEnd - zoomStart;
		zoom = sampleLength/zoomLength;
		hasHorizontalScrollBar = zoom>1;

		waveformDisplay.refresh();
		me.refresh();
		if (me.onZoomChange) me.onZoomChange(me.getZoomState());
	}


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
		var waveTop = me.menuHeight || 0;
		var waveH   = me.height - waveTop;

		if (loopCreator && loopCreator.isVisible() && loopCreator.needsRendering) {
			this.needsRendering = true;
		}

		if (this.needsRendering) {

			if (waveformDisplay.needsRendering){

				waveformDisplay.clearCanvas();

				waveformDisplay.ctx.fillStyle = "rgb(13, 19, 27)";
				waveformDisplay.ctx.fillRect(0, 0, me.width, waveH);

				if (background.width !== me.width) background.setSize(me.width, waveH);
				waveformDisplay.ctx.drawImage(background.render(true), 0, 0, me.width, waveH);


				// center lines
				var mid = waveH>>1;
				var mid2 = mid>>1;
				waveformDisplay.ctx.strokeStyle = 'rgba(0, 200, 180, 0.5)';
				waveformDisplay.ctx.beginPath();
				waveformDisplay.ctx.moveTo(0, mid);
				waveformDisplay.ctx.lineTo(me.width, mid);
				waveformDisplay.ctx.stroke();

				waveformDisplay.ctx.strokeStyle = 'rgba(0, 200, 180, 0.2)';
				waveformDisplay.ctx.beginPath();
				waveformDisplay.ctx.moveTo(0, mid+mid2);
				waveformDisplay.ctx.lineTo(me.width, mid+mid2);
				waveformDisplay.ctx.stroke();

				waveformDisplay.ctx.beginPath();
				waveformDisplay.ctx.moveTo(0, mid-mid2);
				waveformDisplay.ctx.lineTo(me.width, mid-mid2);
				waveformDisplay.ctx.stroke();


				waveformDisplay.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';





				if (currentSampleData && currentSampleData.length && me.width){

					if (zoom === 1){
						zoomStart = 0;
						zoomEnd = sampleLength;
					}

					zoomLength = zoomEnd-zoomStart;

					var step = zoomLength / me.width;
					waveformDisplay.ctx.beginPath();

					var maxHeight = (waveH / 2) - 2;

					for (var i = 0; i<me.width; i++){
						var index = Math.floor(i*step);
						var peak = currentSampleData[zoomStart + index] * -maxHeight;

						if(i === 0) {
							waveformDisplay.ctx.moveTo(i, mid + peak);
						} else {
							waveformDisplay.ctx.lineTo(i, mid + peak);
						}
					}
					waveformDisplay.ctx.stroke();

				}
				waveformDisplay.needsRendering = false;
			}
			me.ctx.drawImage(waveformDisplay.canvas, 0, waveTop);

			if (currentSampleData && zoomLength > 0){
				var pixPerSample = getPixelsPerSample();
				if (pixPerSample >= 3){
					var mh = 1;
					var firstSample = Math.max(0, Math.ceil(zoomStart));
					var lastSample = Math.min(sampleLength - 1, Math.floor(zoomEnd));
					for (var si = firstSample; si <= lastSample; si++){
						var sc = getSampleMarkerCoords(si);
						var drawY = Math.max(waveTop + mh, Math.min(waveTop + waveH - mh - 1, sc.y));
						var isActiveSample = (si === activeSampleMarkerIndex || si === dragSampleIndex);
						me.ctx.fillStyle = isActiveSample ? "white" : "rgba(255, 220, 0, 0.85)";
						me.ctx.fillRect(sc.x - mh, drawY - mh, mh * 2 + 1, mh * 2 + 1);
					}
				}
			}

			if (isPlaying && sampleLength){
				var now = new Date().getTime();
				var delta = now - startPlayTime;
				var index = playingOffset + (sampleRate * delta)/1000;

				if (currentInstrument.sample.loop.enabled && index>currentInstrument.sample.loop.start){
					index = currentInstrument.sample.loop.start + ((index-currentInstrument.sample.loop.start)%currentInstrument.sample.loop.length);
					//isPlaying=false;
					var pos = (index / sampleLength) * me.width;
					me.ctx.fillStyle = "rgb(241, 162, 71)";
					me.ctx.fillRect(pos, waveTop, 1, waveH);
				}else{
					if (index>sampleLength){
						isPlaying=false;
					}else{
						var pos = (index / sampleLength) * me.width;
						me.ctx.fillStyle = "rgb(241, 162, 71)";
						me.ctx.fillRect(pos, waveTop, 1, waveH);
					}
				}
			}

			if (currentInstrument && currentInstrument.sample && (currentInstrument.sample.loop.length>2 || currentInstrument.sample.loop.enabled)){

				var color = currentInstrument.sample.loop.enabled ? "rgb(241, 220, 71)" : "rgba(150, 150, 150,0.7)";

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.loopStart) me.ctx.fillStyle = "white";
				var lineX = getLoopMarkerPos(MARKERTYPE.loopStart);
				me.ctx.fillRect(lineX, waveTop, 1, waveH - 1);
				me.ctx.fillRect(lineX-4, waveTop, 4, 10);

				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.loopEnd) me.ctx.fillStyle = "white";
				lineX = getLoopMarkerPos(MARKERTYPE.loopEnd);
				me.ctx.fillRect(lineX, waveTop, 1, waveH - 1);
				me.ctx.fillRect(lineX+1, waveTop, 4, 10);
			}

			var rangeLineX1 = -1;
			var rangeLineX2 = -1;

			if (rangeEnd>=0){
				color = "rgb(241, 131, 71)";
				me.ctx.fillStyle = color;
				if (activeDragMarker === MARKERTYPE.rangeEnd) me.ctx.fillStyle = "white";
				rangeLineX2 = getRangeMarkerPos(MARKERTYPE.rangeEnd);
				me.ctx.fillRect(rangeLineX2, waveTop, 1, waveH - 1);
				me.ctx.fillRect(rangeLineX2+1, waveTop + 11, 4, 10);
			}

			if (rangeStart>=0){
				if (rangeStart<zoomStart){
					rangeLineX1=0;
				}else{
					color = "rgb(241, 131, 71)";
					me.ctx.fillStyle = color;
					if (activeDragMarker === MARKERTYPE.rangeStart) me.ctx.fillStyle = "white";
					rangeLineX1 = getRangeMarkerPos(MARKERTYPE.rangeStart);
					me.ctx.fillRect(rangeLineX1, waveTop, 1, waveH - 1);
					me.ctx.fillRect(rangeLineX1-4, waveTop + 11, 4, 10);
				}

				if ((rangeStart+rangeLength)<zoomStart){
					rangeLineX1 = rangeLineX2 = -1;
				}
			}


			var rawRangeLineX2 = rangeLineX2;

			if (rangeLineX1 !== rangeLineX2){
				if (rangeLineX1>=0){
					rangeLineX2 = Math.min(rangeLineX2, me.width);
					if (rangeLineX2 <= 0) rangeLineX2 = me.width;
				}
				me.ctx.fillStyle = "rgba(241, 162, 71,0.1)";
				me.ctx.fillRect(rangeLineX1, waveTop, rangeLineX2-rangeLineX1, waveH);
			}

			if (rangeLength > 0 && (rangeLineX1 >= 0 || rawRangeLineX2 >= 0)) {
				var hx1 = rangeLineX1 >= 0 ? rangeLineX1 : 0;
				var hx2 = rawRangeLineX2 >= 0 ? rawRangeLineX2 : me.width;
				var hxC = Math.round((hx1 + hx2) / 2);
				var hY  = waveTop + Math.floor(waveH / 2);
				var hw  = 5;

				me.ctx.strokeStyle = "rgba(241, 162, 71, 0.35)";
				me.ctx.lineWidth = 1;
				me.ctx.beginPath();
				me.ctx.moveTo(hx1, hY);
				me.ctx.lineTo(hx2, hY);
				me.ctx.stroke();

				var handleTypes = [
					{x: hx1, type: MARKERTYPE.rangeVolumeLeft,   visible: rangeLineX1 > 0},
					{x: hxC, type: MARKERTYPE.rangeVolumeCenter, visible: true},
					{x: hx2, type: MARKERTYPE.rangeVolumeRight,  visible: rawRangeLineX2 > 0}
				];
				handleTypes.forEach(function(h) {
					if (!h.visible) return;
					var isActive = activeDragMarker === h.type;
					me.ctx.fillStyle   = isActive ? "white" : "rgba(241, 200, 80, 0.9)";
					me.ctx.strokeStyle = "rgba(180, 130, 40, 0.9)";
					me.ctx.lineWidth   = 1;
					me.ctx.fillRect(h.x - hw, hY - hw, hw * 2 + 1, hw * 2 + 1);
					me.ctx.strokeRect(h.x - hw + 0.5, hY - hw + 0.5, hw * 2, hw * 2);
				});
			}

			if (loopCreator && loopCreator.isVisible()) {
				loopCreator.render();
			}

			if (hissReductionPanel && hissReductionPanel.isVisible()) {
				hissReductionPanel.render();
			}

			if (hasHorizontalScrollBar){
				scrollBar.render();
			}

		}
		this.needsRendering = false;

		me.parentCtx.drawImage(me.canvas, me.left, me.top, me.width, me.height);

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

	function getRangeHandleY() {
		var waveTop = me.menuHeight || 0;
		return waveTop + Math.floor((me.height - waveTop) / 2);
	}

	function getRangeHandleX(type) {
		var x1 = getRangeMarkerPos(MARKERTYPE.rangeStart);
		var x2 = getRangeMarkerPos(MARKERTYPE.rangeEnd);
		if (type === MARKERTYPE.rangeVolumeLeft) return x1;
		if (type === MARKERTYPE.rangeVolumeRight) return x2;
		var cx1 = x1 < 0 ? 0 : x1;
		var cx2 = x2 < 0 ? me.width : x2;
		return Math.round((cx1 + cx2) / 2);
	}

	function isNearRangeHandle(x, y, type) {
		if (!rangeLength) return false;
		var hx = getRangeHandleX(type);
		if (hx < 0) return false;
		var hy = getRangeHandleY();
		return Math.abs(x - hx) <= 7 && Math.abs(y - hy) <= 7;
	}

	function xToZoomX(x){
		if (x<zoomStart) return -1;
	}

	function getPixelsPerSample(){
		return zoomLength > 0 ? me.width / zoomLength : 0;
	}

	function getSampleMarkerCoords(sampleIndex){
		var waveTop = me.menuHeight || 0;
		var waveH = me.height - waveTop;
		var mid = waveH >> 1;
		var maxHeight = (waveH / 2) - 2;
		var x = Math.round(((sampleIndex - zoomStart) / zoomLength) * me.width);
		var y = waveTop + mid + currentSampleData[sampleIndex] * -maxHeight;
		return {x: x, y: y};
	}

	function getNearestSampleMarker(x, y){
		if (!currentSampleData || !zoomLength) return -1;
		var pixPerSample = getPixelsPerSample();
		if (pixPerSample < 3) return -1;
		var sampleIndex = Math.round(zoomStart + (x / me.width) * zoomLength);
		sampleIndex = Math.max(0, Math.min(sampleLength - 1, sampleIndex));
		var coords = getSampleMarkerCoords(sampleIndex);
		var markerHalf = Math.min(3, Math.max(1, Math.floor(pixPerSample / 3)));
		if (Math.abs(y - coords.y) <= markerHalf + 3){
			return sampleIndex;
		}
		return -1;
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

	var sampleProcessing = SampleProcessing({
		splitRange: splitRange,
		joinRange: joinRange,
		getRange: function(){ return {rangeStart: rangeStart, rangeLength: rangeLength}; },
		getLoop: function(){
			if (!currentInstrument) return null;
			var loop = currentInstrument.sample.loop;
			if (!loop || (!loop.enabled && loop.length <= 2)) return null;
			return {start: loop.start || 0, length: loop.length || 0};
		},
		setLoop: function(start, length){
			if (!currentInstrument) return;
			currentInstrument.sample.loop.start = start;
			currentInstrument.sample.loop.length = length;
			ignoreInstrumentChange = true;
			EventBus.trigger(EVENT.instrumentChange, Tracker.getCurrentInstrumentIndex());
			ignoreInstrumentChange = false;
			waveformDisplay.refresh();
			me.refresh();
		}
	});
	
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

	me.adjustVolume = sampleProcessing.adjustVolume;
	me.trim = sampleProcessing.trim;
	me.reverse = sampleProcessing.reverse;
	me.invert = sampleProcessing.invert;

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

export default WaveForm;

