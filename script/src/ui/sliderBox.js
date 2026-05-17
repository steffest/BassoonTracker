import UIElement from "./components/element.js";
import RangeSlider from "./components/rangeSlider.js";
import NumberDisplay from "./components/numberdisplay.js";
import StateManager from "./stateManager.js";
import Tracker from "../tracker.js";
import Y from "./yascal/yascal.js";

export default class SliderBox extends UIElement {
    _label = "";
    _value = 0;
    _prevValue = 0;
    _min = 0;
    _max = 100;
    _padLength = 4;
    _padChar = " ";
    _onChange = null;
    _vertical = false;
    _disabled = false;
    _font = null;

    _labelX = 0;
    _labelY = 0;
    _digitX = 0;
    _digitY = 0;
    _digitW = 40;
    _digitH = 20;
    _sliderHeight = 20;
    _sliderWidth = 20;

    _slider;
    _numberDisplay;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "sliderBox";

        this._slider = new RangeSlider(0, 0, this._sliderWidth, this._sliderHeight);
        this._slider.min = this._min;
        this._slider.max = this._max;
        this._slider.onChange = (v) => { if (v !== this._value) this.setValue(v); };
        this._slider.onMouseWheel = (touchData) => this.onMouseWheel(touchData);
        this.addChild(this._slider);

        this._numberDisplay = new NumberDisplay(0, 0, this._digitW, this._digitH);
        this._numberDisplay.min = this._min;
        this._numberDisplay.max = this._max;
        this._numberDisplay.padLength = 4;
        this._numberDisplay.size = "small";
        this._numberDisplay.onChange = (v) => { if (v !== this._value) this.setValue(v); };
        this._numberDisplay.paddingBottom = -1;
        this.addChild(this._numberDisplay);
    }

    get label()    { return this._label; }
    set label(v)   { this._label = v; this.refresh(); }

    get value()    { return this._value; }
    set value(v)   { this.setValue(v); }

    get min()      { return this._min; }
    set min(v)     { this.setMin(v); }

    get max()      { return this._max; }
    set max(v)     { this.setMax(v); }

    get onChange() { return this._onChange; }
    set onChange(v){ this._onChange = v; }

    get vertical() { return this._vertical; }
    set vertical(v){
        this._vertical = !!v;
        if (this._slider) this._slider.vertical = this._vertical;
        this.refresh();
    }

    get font()    { return this._font; }
    set font(v)   { this._font = v; this.refresh(); }

    get isDisabled() { return this._disabled; }
    set isDisabled(v){ this._disabled = !!v; this.ignoreEvents = this._disabled; this.refresh(); }

    setValue(newValue, internal) {
        if (newValue !== this._value) this._prevValue = this._value;
        this._value = newValue;
        this._slider.setValue(this._value, internal);
        this._numberDisplay.setValue(this._value, internal);
        this.refresh();
        if (!internal && this._onChange) {
            if (this.trackUndo) {
                const editAction = StateManager.createValueUndo(this);
                editAction.name = this.undoLabel || "Change " + this.name;
                if (this.undoInstrument) {
                    editAction.instrument = Tracker.getCurrentInstrumentIndex();
                    editAction.id += editAction.instrument;
                }
                StateManager.registerEdit(editAction);
            }
            this._onChange(this._value);
        }
    }

    getValue()     { return this._value; }
    getPrevValue() { return this._prevValue; }

    setMax(newMax, skipCheck) {
        this._max = newMax;
        if (!skipCheck && this._value > this._max) this.setValue(this._max);
        this._slider.max = this._max;
        this._numberDisplay._max = this._max;
        this._numberDisplay.needsRendering = true;
    }

    setMin(newMin, skipCheck) {
        this._min = newMin;
        if (!skipCheck && this._value < this._min) this.setValue(this._min);
        this._slider.min = this._min;
        this._numberDisplay._min = this._min;
        this._numberDisplay.needsRendering = true;
    }

    onResize() {
        this._digitW = 40;
        this._digitH = 20;
        if (this._padLength === 5) this._digitW = 48;

        if (this._vertical) {
            this._slider.setSize(this._sliderWidth, this.height - 36);
            this._slider.setPosition(Math.floor((this.width - this._sliderWidth) / 2), 0);
            this._digitX = Math.floor((this.width - this._digitW) / 2);
            this._digitY = this.height - 32;
            if (this._font) {
                this._labelX = Math.floor((this.width - this._font.getTextWidth(this._label, 0)) / 2);
            }
            this._labelY = this.height - 10;
        } else {
            this._slider.setSize(this.width, this._sliderHeight);
            this._slider.setPosition(0, this.height - this._sliderHeight);
            this._digitX = this.width - this._digitW;
            this._digitY = 2;
        }

        this._numberDisplay.setSize(this._digitW, this._digitH);
        this._numberDisplay.setPosition(this._digitX, this._digitY);
    }

    onMouseWheel(touchData) {
        if (touchData.mouseWheels[0] > 0) {
            this.setValue(Math.min(this._value + 1, this._max));
        } else {
            this.setValue(Math.max(this._value - 1, this._min));
        }
    }

    render(internal) {
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            this._slider.render();
            this._numberDisplay.render();

            if (this._font) {
                this._font.write(this.ctx, this._label, this._labelX, this._labelY, 0);
            } else {
                this.ctx.fillStyle = "white";
                this.ctx.fillText(this._label, this._labelX, this._labelY);
            }

            if (this._vertical) {
                const lineVer = Y.getImage("line_ver");
                if (lineVer) this.ctx.drawImage(lineVer, this.width - 2, 0, 2, this.height);
            }

            if (this._disabled) {
                this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
                this.ctx.fillRect(1, 0, this.width - 1, this.height);
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        if (!this.isVisible()) return;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
