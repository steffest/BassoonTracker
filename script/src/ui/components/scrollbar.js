import Scale9Panel from "./scale9.js";
import UI from "../ui.js";

let Scrollbar = function(x, y, w, h, base, options) {
	var me = Scale9Panel(x, y, w, h, base);
	me.type = "scrollbar";

	options = options || {};
	options.edgeSize  = options.edgeSize  || 6;
	options.minWidth  = options.minWidth  || 18;

	var dragMode;
	var dragStartLeft;
	var dragStartWidth;

	me.onDragStart = function(touchData) {
		dragMode = getDragMode(touchData.startX);
		dragStartLeft = me.left;
		dragStartWidth = me.width;
		if (options.onDragStart) options.onDragStart(dragMode, touchData);
	};

	me.onDrag = function(touchData) {
		if (!dragMode) return;

		var trackLeft = getTrackLeft();
		var trackWidth = getTrackWidth();
		var minWidth = Math.min(options.minWidth, trackWidth);
		var delta = touchData.deltaX;
		var newLeft = dragStartLeft;
		var newWidth = dragStartWidth;

		if (dragMode === "left") {
			var right = dragStartLeft + dragStartWidth;
			newLeft = Math.min(dragStartLeft + delta, right - minWidth);
			newLeft = Math.max(trackLeft, newLeft);
			newWidth = right - newLeft;
		} else if (dragMode === "right") {
			newWidth = dragStartWidth + delta;
			newWidth = Math.max(minWidth, newWidth);
			newWidth = Math.min(newWidth, trackLeft + trackWidth - dragStartLeft);
		} else {
			newLeft = dragStartLeft + delta;
			newLeft = Math.max(trackLeft, newLeft);
			newLeft = Math.min(newLeft, trackLeft + trackWidth - dragStartWidth);
		}

		me.setPosition(Math.round(newLeft), me.top);
		me.setSize(Math.round(newWidth), me.height);

		if (dragMode === "middle") {
			if (options.onScroll) options.onScroll(me.left, touchData);
		} else {
			if (options.onZoom) options.onZoom(me.left, me.width, dragMode, touchData);
		}
	};

	me.onHover = function() {
		UI.setCursor(getDragMode(me.eventX) === "middle"
			? (options.cursor || "default")
			: (options.resizeCursor || "ew-resize"));
	};

	me.onHoverExit = function() {
		UI.setCursor(options.cursor || "default");
	};

	function getDragMode(x) {
		if (!options.zoom) return "middle";
		if (x <= options.edgeSize) return "left";
		if (x >= me.width - options.edgeSize) return "right";
		return "middle";
	}

	function getTrackLeft() {
		if (typeof options.trackLeft === "function") return options.trackLeft();
		return typeof options.trackLeft === "number" ? options.trackLeft : 0;
	}

	function getTrackWidth() {
		if (typeof options.trackWidth === "function") return options.trackWidth();
		return options.trackWidth || (me.parent ? me.parent.width : me.width);
	}

	return me;
};

export default Scrollbar;
