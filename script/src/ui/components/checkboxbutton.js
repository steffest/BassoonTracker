import Button from "./button.js";
import Assets from "../assets.js";
import Y from "../yascal/yascal.js";
import Font from "../font.js";

export default class CheckboxButton extends Button {
    _onDownCallback;

    constructor(properties = {}) {
        super(0, 0, 20, 20);

        this.textAlign   = "left";
        this.paddingLeft = typeof properties.paddingLeft === "number" ? properties.paddingLeft : 30;
        this.font        = properties.font  || Font.ft;
        this.label       = properties.label || "";
        this.checkbox    = properties.checkbox || false;

        if (properties.labels) this.setLabels(properties.labels);

        if (!properties.transparent) {
            this.background       = properties.background       || Assets.buttonDarkBlueScale9;
            this.hoverBackground  = properties.hoverBackground  || Assets.buttonDarkBlueActiveScale9;
            this.activeBackground = properties.activeBackground || Assets.buttonDarkBlueActiveScale9;
        }

        this._onDownCallback = properties.onDown;
    }

    renderInternal() {
        let stateImage, margin;
        if (this.checkbox) {
            stateImage = this._isActive ? Y.getImage("checkbox_on") : Y.getImage("checkbox_off");
            margin = 7;
        } else {
            stateImage = this._isActive ? Y.getImage("radio_active") : Y.getImage("radio_inactive");
            margin = 5;
        }
        this.ctx.drawImage(stateImage, 8, Math.floor(this.height / 2) - margin);
    }

    onDown() {
        this.isActive = !this._isActive;
        if (this._onDownCallback) this._onDownCallback.bind(this).call();
    }
}
