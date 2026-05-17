import UIElement from "../components/element.js";
import Scale9Panel from "./scale9.js";
import Y from '../yascal/yascal.js';
import Input from '../input.js';
import StateManager from '../stateManager.js';
import Tracker from '../../tracker.js';
import Font from "../font.js";

export default class InputBox extends UIElement {
    _value = "";
    _prevValue = "";
    _isActive = false;
    _isCursorVisible = false;
    _cursorPos = -1;
    _placeholder = "";
    _background;

    constructor(x, y, w, h) {
        super(x, y, w, h);

        this._background = new Scale9Panel(0, 0, this.width, this.height, {
            img: Y.getImage("panel_dark"),
            left: 3, top: 3, right: 2, bottom: 2
        });
        this._background.ignoreEvents = true;
        this.addChild(this._background);
    }

    onResize() {
        if (this._background) {
            this._background.setPosition(0, 0);
            this._background.setSize(this.width, this.height);
        }
    }

    get value()       { return this._value; }
    set value(v)      { this._value = v; this.refresh(); }

    get prevValue()   { return this._prevValue; }

    get placeholder() { return this._placeholder; }
    set placeholder(v){ this._placeholder = v; this.refresh(); }

    setValue(newValue, internal) {
        if (newValue !== this._value) this._prevValue = this._value;
        this._value = newValue;
        this.refresh();
        if (!internal && this.onChange) {
            if (this.trackUndo) {
                const editAction = StateManager.createValueUndo(this);
                editAction.name = this.undoLabel || "Change " + this.name;
                if (this.undoInstrument) {
                    editAction.instrument = Tracker.getCurrentInstrumentIndex();
                    editAction.id += editAction.instrument;
                }
                StateManager.registerEdit(editAction);
            }
            this.onChange(this._value);
        }
    }

    activate() {
        if (this._isActive) return;
        this._cursorPos = this._value ? this._value.length - 1 : -1;
        this._isActive = true;
        Input.setFocusElement(this);
        this._pingCursor();
    }

    deActivate(andSubmit) {
        if (this._isActive) {
            this._isCursorVisible = false;
            this._isActive = false;
            this.refresh();
            Input.clearFocusElement();
            if (andSubmit && this.onSubmit) this.onSubmit(this._value);
        }
    }

    onClick() {
        if (!this._isActive) this.activate();
    }

    onKeyDown(keyCode, event) {
        let handled = false;
        switch (keyCode) {
            case 8:
                if (this._value && this._cursorPos >= 0) {
                    this.setValue(this._value.substr(0, this._cursorPos) + this._value.substr(this._cursorPos + 1));
                    this._cursorPos--;
                }
                handled = true;
                break;
            case 9: case 13: case 27:
                this.deActivate(keyCode === 13);
                handled = true;
                break;
            case 37:
                if (this._cursorPos >= 0) this._cursorPos--;
                this.refresh();
                handled = true;
                break;
            case 39:
                if (this._value) {
                    this._cursorPos = Math.min(this._cursorPos + 1, this._value.length - 1);
                    this.refresh();
                }
                handled = true;
                break;
            case 46:
                if (this._value && this._cursorPos < this._value.length - 1) {
                    this.setValue(this._value.substr(0, this._cursorPos + 1) + this._value.substr(this._cursorPos + 2));
                }
                handled = true;
                break;
            case 89: case 90:
                if (Input.isMetaKeyDown()) { this.deActivate(); return; }
                break;
        }
        if (!handled && keyCode > 31) {
            const key = event.key;
            if (key.length === 1 && key.match(/[a-z0-9\._:\-\ #]/i)) {
                this.setValue(this._value.substr(0, this._cursorPos + 1) + key + this._value.substr(this._cursorPos + 1));
                this._cursorPos++;
            }
            handled = true;
        }
        return handled;
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this._background.render();
            const textX = 10;
            if (this._value && Font.med) {
                Font.med.write(this.ctx, this._value, textX, 6, 0);
            } else if (this._placeholder && Font.med) {
                this.ctx.globalAlpha = 0.35;
                Font.med.write(this.ctx, this._placeholder, textX, 6, 0);
                this.ctx.globalAlpha = 1;
            }
            if (this._isCursorVisible) {
                this.ctx.fillStyle = "rgba(255,255,255,0.7)";
                const cursorX = textX + ((this._cursorPos + 1) * 9);
                this.ctx.fillRect(cursorX, 4, 2, this.height - 8);
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _pingCursor() {
        if (!this._isActive) return;
        this._isCursorVisible = !this._isCursorVisible;
        this.refresh();
        setTimeout(() => this._pingCursor(), 300);
    }
}
