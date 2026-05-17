import Y from "../yascal/yascal.js";
import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";

export default class RangeSlider extends UIElement {
    _knob;
    _knobVert;
    _back;
    _vertical = false;
    _maxHeight = 0;
    _knobLeft = 0;
    _knobTop = 0;
    _startKnobLeft = 0;
    _startKnobTop = 0;
    _min = 0;
    _max = 100;
    _value = 0;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "rangeslider";

        this._knob          = Y.getImage("slider_knob");
        this._knobVert      = Y.getImage("slider_knob_vert") || this._knob;
        const backImage     = Y.getImage("slider_back");

        this._back = new Scale9Panel(0, 0, 0, 0, {
            img: backImage, left: 4, right: 4, top: 0, bottom: 0, scale: "repeatX"
        });
        this._back.ignoreEvents = true;
        this.addChild(this._back);
    }

    get value() { return this._value; }
    set value(v) { this._value = v; this.refresh(); }

    get min()  { return this._min; }
    set min(v) { this._min = v; if (this._value < v) this.setValue(v); }

    get max()  { return this._max; }
    set max(v) { this._max = v; if (this._value > v) this.setValue(v); }

    get vertical()  { return this._vertical; }
    set vertical(v) {
        this._vertical = !!v;
        if (v) {
            this._back.setBase({
                img: Y.getImage("slider_back_vert") || Y.getImage("slider_back"),
                imgLeft: 0, imgRight: 0, imgTop: 4, imgBottom: 4, scale: "repeatY"
            });
        }
        this.refresh();
    }

    setValue(v, internal) {
        if (v > this._max) v = this._max;
        if (v < this._min) v = this._min;
        const hasChanged = !internal && this._value !== v;
        this._value = v;

        if (this._vertical) {
            const relMax = this._max - this._min;
            this._knobTop = this._maxHeight * (1 - (v - this._min) / relMax);
        } else {
            this._knobLeft = (this.width - this._knob.width) * v / this._max;
        }

        this.refresh();
        if (hasChanged && this.onChange) this.onChange(this._value);
    }

    setMax(newMax, skipCheck) {
        this._max = newMax;
        if (!skipCheck && this._value > this._max) this.setValue(this._max);
    }

    setMin(newMin, skipCheck) {
        this._min = newMin;
        if (!skipCheck && this._value < this._min) this.setValue(this._min);
    }

    onResize() {
        if (!this._knobVert) return;
        this._maxHeight = this.height - this._knobVert.height + 3;
        this._back.setSize(this.width, this.height);
        this.setValue(this._value, true);
    }

    onDragStart() {
        this._startKnobLeft = this._knobLeft;
        this._startKnobTop  = this._knobTop;
    }

    onDrag(touchData) {
        if (this._vertical) {
            this._knobTop = Math.max(0, Math.min(this._maxHeight, this._startKnobTop + touchData.deltaY));
            if (this._maxHeight > this._knob.height) {
                const relMax = this._max - this._min;
                this._value = (this._min + relMax) - Math.round(relMax * this._knobTop / this._maxHeight);
            } else {
                this._value = this._max;
            }
        } else {
            const maxWidth = this.width - this._knob.width;
            this._knobLeft = Math.max(0, Math.min(maxWidth, this._startKnobLeft + touchData.deltaX));
            this._value = maxWidth > this._knob.width ? Math.round(this._max * this._knobLeft / maxWidth) : 0;
        }
        this.refresh();
        if (this.onChange) this.onChange(this._value);
    }

    render(internal) {
        if (this.needsRendering) {
            internal = !!internal;
            this.clearCanvas();

            const cx = Math.floor(this.width / 2) + 3;
            const cw = 6;
            let ch = this.height;
            if (this._min < 0) ch = Math.floor(ch / 2);

            this.ctx.fillStyle = "rgba(255,255,255,0.1)";
            this.ctx.beginPath();
            this.ctx.moveTo(cx, ch);
            this.ctx.lineTo(cx, 2);
            this.ctx.lineTo(cx + cw, 2);
            this.ctx.fill();

            if (this._min < 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(cx - 6, ch);
                this.ctx.lineTo(cx - 6, this.height);
                this.ctx.lineTo(cx - 6 - cw, this.height);
                this.ctx.fill();
            } else {
                this.ctx.beginPath();
                this.ctx.moveTo(cx - 6, ch);
                this.ctx.lineTo(cx - 6, 2);
                this.ctx.lineTo(cx - 6 - cw, 2);
                this.ctx.fill();
            }

            this._back.render();
            if (this._vertical) {
                this.ctx.drawImage(this._knobVert, -1, this._knobTop, this._knobVert.width, this._knobVert.height);
            } else {
                this.ctx.drawImage(this._knob, this._knobLeft, -1, this._knob.width, this._knob.height);
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
