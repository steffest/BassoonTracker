import UIElement from "./element.js";
import Y from "../yascal/yascal.js";
import StateManager from "../stateManager.js";
import Tracker from "../../tracker.js";
import Input from "../input.js";
import Font from "../font.js";

export default class NumberDisplay extends UIElement {
    _value = 0;
    _prevValue = 0;
    _min = 0;
    _max = 100;
    _step = 1;
    _padChar = " ";
    _padding = 0;
    _hasFocus = false;
    _cursorPos = 0;
    _isCursorVisible = false;
    _onChange;
    _fontSize = "medium";
    _font;
    _autoPadding = false;

    _fontOffsets = {
        small:  { x: 4, y: 3, c:  0 },
        medium: { x: 6, y: 7, c:  0 },
        big:    { x: 7, y: 4, c: -2 },
    };
    _fontOffset;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "numberDisplay";
        this.isActive = false;
        this.padLength = 4;
        this._fontOffset = this._fontOffsets.medium;
        this._font = Font.led;
    }

    get value()     { return this._value; }
    set value(v)    { this._value = v; this.refresh(); }

    get prevValue() { return this._prevValue; }

    getValue()     { return this._value; }
    getPrevValue() { return this._prevValue; }

    get min()  { return this._min; }
    set min(v) { this._min = v; if (this._value < v) this.setValue(v); }

    get max()  { return this._max; }
    set max(v) {
        this._max = v;
        if (this._max > 9999 && this.padLength < 5) this.padLength = 5;
        if (this._value > v) this.setValue(v);
    }

    get step()  { return this._step; }
    set step(v) { this._step = v; }

    get onChange()  { return this._onChange; }
    set onChange(v) { this._onChange = v; }

    get size()  { return this._fontSize; }
    set size(v) {
        this._fontSize = v;
        this._font = v === "big" ? Font.ledBig : Font.led;
        this._fontOffset = this._fontOffsets[v] || this._fontOffsets.medium;
        this.refresh();
    }

    get autoPadding()  { return this._autoPadding; }
    set autoPadding(v) { this._autoPadding = !!v; }

    get isDisabled()  { return this._isDisabled; }
    set isDisabled(v) {
        this._isDisabled = !!v;
        if (v) this.isActive = false;
        this.refresh();
    }

    setValue(val, internal) {
        if (val !== this._value) this._prevValue = this._value;
        this._value = val;
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

    updateValue(newValue) {
        if (newValue > this._max) newValue = this._max;
        if (newValue < this._min) newValue = this._min;
        this.setValue(newValue);
    }

    setFocus(state) {
        this._hasFocus = !!state;
        if (this._hasFocus) {
            Input.setFocusElement(this);
            this._cursorPos = this._padValue().length;
            this._pingCursor();
        } else {
            Input.clearFocusElement();
        }
        this.refresh();
    }

    togglFocus() { this.setFocus(!this._hasFocus); }

    activate() {
        this._hasFocus = true;
        this._cursorPos = this._padValue().length;
        this._isCursorVisible = true;
        this._pingCursor();
    }

    deActivate() {
        if (this._hasFocus) {
            this._hasFocus = false;
            this._isCursorVisible = false;
            this.refresh();
            Input.clearFocusElement();
        }
    }

    onClick() {
        if (this._isDisabled) return;
        if (!this._onChange) return;
        this.togglFocus();
    }

    onMouseWheel(touchData) {
        if (this._isDisabled) return;
        if (!this._onChange) return;
        if (touchData.mouseWheels[0] > 0) {
            this.updateValue(this._value + this._step);
        } else {
            this.updateValue(this._value - this._step);
        }
    }

    onKeyDown(code, event) {
        const keyCode = event.keyCode;
        const key = event.key;

        switch (keyCode) {
            case 8:  this._extract(-1); break;
            case 9: case 13: case 27: Input.clearFocusElement(); break;
            case 37: this._setCursorPos(this._cursorPos - 1); break;
            case 38: this.updateValue(this._value + 1); break;
            case 39: this._setCursorPos(this._cursorPos + 1); break;
            case 40: this.updateValue(this._value - 1); break;
            case 46: this._extract(0); break;
        }

        switch (key) {
            case "0": case "1": case "2": case "3": case "4":
            case "5": case "6": case "7": case "8": case "9":
            case "-": this._inject(key); break;
        }

        return true;
    }

    onResize() {
        if (this._autoPadding) this.padLength = Math.floor(this.width / 8) - 1;
    }

    render(internal) {
        if (!this.isVisible()) return;

        const bgImage = this._hasFocus ? "panel_inset_dark_active" : "panel_inset_dark_inactive";

        if (this.needsRendering) {
            internal = !!internal;
            this.ctx.clearRect(0, 0, this.width, this.height);

            const x = this.paddingLeft || this._padding;
            const y = this.paddingTop  || this._padding;
            const w = this.width  - x - (this.paddingRight  || this._padding);
            const h = this.height - y - (this.paddingBottom || this._padding);
            this.ctx.drawImage(Y.getImage(bgImage), x, y, w, h);

            if (this._font) {
                const fx = x + this._fontOffset.x;
                const fy = this._fontOffset.y;
                this._font.write(this.ctx, this._padValue(), fx, fy, 0);

                if (this._isCursorVisible) {
                    this.ctx.fillStyle = "rgba(255,201,65,0.7)";
                    const cursorX = fx + this._cursorPos * this._font.charWidth + this._fontOffset.c;
                    this.ctx.fillRect(cursorX, fy, 2, this._font.charHeight);
                }
            }

            if (this.renderInternal) this.renderInternal();

            if (this._isDisabled) {
                this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
                this.ctx.fillRect(0, 0, this.width, this.height);
            }
        }

        this.needsRendering = false;
        if (internal) return this.canvas;
        if (this.canvas.width) this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _padValue() {
        let result = "" + this._value;
        while (result.length < this.padLength) result = this._padChar + result;
        return result;
    }

    _pingCursor() {
        if (this._hasFocus) {
            this._isCursorVisible = !this._isCursorVisible;
            setTimeout(() => this._pingCursor(), 300);
        } else {
            this._isCursorVisible = false;
        }
        this.refresh();
    }

    _setCursorPos(newValue) {
        const max = this._padValue().length;
        const min = max - ("" + this._value).length;
        this._cursorPos = Math.min(max, Math.max(min, newValue));
        this.refresh();
    }

    _extract(offset) {
        const a = this._padValue().split("");
        a.splice(this._cursorPos + offset, 1);
        let v = parseInt(a.join("").trim());
        if (isNaN(v)) v = 0;
        this.updateValue(v);
    }

    _inject(n) {
        const a = this._padValue().split("");
        a.splice(this._cursorPos, 0, n);
        let v = parseInt(a.join("").trim());
        if (isNaN(v)) v = 0;
        this.updateValue(v);
    }
}
