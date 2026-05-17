import Ticker from "./ticker.js";
import NumberDisplay from "./components/numberdisplay.js";
import Assets from "./assets.js";
import Font from "./font.js";

export default class SpinBox extends NumberDisplay {
    _spinLabel = "";
    _spinLabels = null;
    _spinFont = null;
    _buttonDown;
    _buttonUp;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "spinBox";

        this._buttonDown = Assets.generate("button20_20");
        this._buttonDown.name = "buttonDown";
        this._buttonDown.label = "↓";
        this._buttonDown.onDown = () => {
            if (this.isDisabled) return;
            this.updateValue(this.getValue() - this._step);
            Ticker.onEachTick4(() => {
                this.updateValue(this.getValue() - this._step);
            }, 10);
        };
        this._buttonDown.onTouchUp = () => { Ticker.onEachTick4(); };
        this.addChild(this._buttonDown);

        this._buttonUp = Assets.generate("button20_20");
        this._buttonUp.name = "buttonUp";
        this._buttonUp.label = "↑";
        this._buttonUp.onDown = () => {
            if (this.isDisabled) return;
            this.updateValue(this.getValue() + this._step);
            Ticker.onEachTick4(() => {
                this.updateValue(this.getValue() + this._step);
            }, 10);
        };
        this._buttonUp.onTouchUp = () => { Ticker.onEachTick4(); };
        this.addChild(this._buttonUp);
    }

    get label()  { return this._spinLabel; }
    set label(v) { this._spinLabel = v; this.refresh(); }

    get labels()    { return this._spinLabels; }
    set labels(v)   { this._spinLabels = v; }
    setLabels(v)    { this.labels = v; }

    get font()  { return this._spinFont; }
    set font(v) { this._spinFont = v; this.refresh(); }

    getValue() { return this._value; }

    setMax(v, skipCheck) {
        if (skipCheck) { this._max = v; } else { this.max = v; }
    }

    setMin(v, skipCheck) {
        if (skipCheck) { this._min = v; } else { this.min = v; }
    }

    renderInternal() {
        if (this._spinLabel) {
            if (this._spinFont) {
                this._spinFont.write(this.ctx, this._spinLabel, 6, 11, 0);
            } else {
                this.ctx.fillStyle = "white";
                this.ctx.fillText(this._spinLabel, 10, 10);
            }
        }
        this._buttonUp.render();
        this._buttonDown.render();
    }

    onResize() {
        super.onResize();
        if (this._spinLabels) {
            this._spinLabels.forEach(item => {
                if (this.width >= item.width) this._spinLabel = item.label;
            });
        }

        if (this._fontSize === "big") {
            const halfH = Math.floor(this.height / 2);
            this._buttonUp.setPosition(this.width - this._buttonUp.width, 0);
            this._buttonUp.setSize(this._buttonUp.width, halfH);
            this._buttonDown.setPosition(this._buttonUp.left, this.height - halfH);
            this._buttonDown.setSize(this._buttonDown.width, halfH);

            this.paddingLeft   = 2;
            this.paddingRight  = this._buttonUp.width;
            this.paddingBottom = -1;
            this.paddingTop    = -1;
        } else {
            this._buttonDown.setPosition(this.width - this._buttonDown.width, 3);
            this._buttonUp.setPosition(this.width - this._buttonUp.width - this._buttonDown.width, 3);

            this.paddingLeft   = this._buttonUp.left - (this.padLength * 8) - 10 - 4;
            this.paddingRight  = this._buttonUp.width + this._buttonDown.width + 1;
            this.paddingBottom = this.height - this._buttonUp.height - 8;
        }
    }
}
