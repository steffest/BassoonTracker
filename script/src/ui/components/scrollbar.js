import Scale9Panel from "./scale9.js";
import UI from "../ui.js";

export default class Scrollbar extends Scale9Panel {
    _options;
    _dragMode;
    _dragStartLeft;
    _dragStartWidth;

    constructor(x, y, w, h, base, options = {}) {
        super(x, y, w, h, base);
        this.type = "scrollbar";
        this._options = {
            edgeSize:     options.edgeSize     || 6,
            minWidth:     options.minWidth     || 18,
            zoom:         options.zoom,
            cursor:       options.cursor,
            resizeCursor: options.resizeCursor,
            trackLeft:    options.trackLeft,
            trackWidth:   options.trackWidth,
            onDragStart:  options.onDragStart,
            onScroll:     options.onScroll,
            onZoom:       options.onZoom,
        };
    }

    onDragStart(touchData) {
        this._dragMode       = this._getDragMode(touchData.startX);
        this._dragStartLeft  = this.left;
        this._dragStartWidth = this.width;
        if (this._options.onDragStart) this._options.onDragStart(this._dragMode, touchData);
    }

    onDrag(touchData) {
        if (!this._dragMode) return;
        const trackLeft  = this._getTrackLeft();
        const trackWidth = this._getTrackWidth();
        const minWidth   = Math.min(this._options.minWidth, trackWidth);
        const delta      = touchData.deltaX;
        let newLeft  = this._dragStartLeft;
        let newWidth = this._dragStartWidth;

        if (this._dragMode === "left") {
            const right = this._dragStartLeft + this._dragStartWidth;
            newLeft  = Math.max(trackLeft, Math.min(this._dragStartLeft + delta, right - minWidth));
            newWidth = right - newLeft;
        } else if (this._dragMode === "right") {
            newWidth = Math.max(minWidth, Math.min(this._dragStartWidth + delta, trackLeft + trackWidth - this._dragStartLeft));
        } else {
            newLeft = Math.max(trackLeft, Math.min(this._dragStartLeft + delta, trackLeft + trackWidth - this._dragStartWidth));
        }

        this.setPosition(Math.round(newLeft), this.top);
        this.setSize(Math.round(newWidth), this.height);

        if (this._dragMode === "middle") {
            if (this._options.onScroll) this._options.onScroll(this.left, touchData);
        } else {
            if (this._options.onZoom) this._options.onZoom(this.left, this.width, this._dragMode, touchData);
        }
    }

    onHover() {
        UI.setCursor(this._getDragMode(this.eventX) === "middle"
            ? (this._options.cursor       || "default")
            : (this._options.resizeCursor || "ew-resize"));
    }

    onHoverExit() {
        UI.setCursor(this._options.cursor || "default");
    }

    _getDragMode(x) {
        if (!this._options.zoom) return "middle";
        if (x <= this._options.edgeSize) return "left";
        if (x >= this.width - this._options.edgeSize) return "right";
        return "middle";
    }

    _getTrackLeft() {
        const tl = this._options.trackLeft;
        if (typeof tl === "function") return tl();
        return typeof tl === "number" ? tl : 0;
    }

    _getTrackWidth() {
        const tw = this._options.trackWidth;
        if (typeof tw === "function") return tw();
        return tw || (this.parent ? this.parent.width : this.width);
    }
}
