import UIElement from "./element.js";
import Y from "../yascal/yascal.js";

export default class Checkbox extends UIElement {
    _checked = false;

    constructor(x, y, w, h) {
        super(x, y, w || 14, h || 14);
        this.type = "checkbox";
    }

    get checked()  { return this._checked; }
    set checked(v) { this._checked = !!v; this.refresh(); }

    setState(checked, internal) {
        this._checked = !!checked;
        this.refresh();
        if (this.onToggle && !internal) this.onToggle(this._checked);
    }

    check()   { this.setState(true); }
    unCheck() { this.setState(false); }
    toggle()  { this.setState(!this._checked); }
    onClick() { this.setState(!this._checked); }

    render(internal) {
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this.clearCanvas();
            const stateImage = this._checked ? Y.getImage("checkbox_on") : Y.getImage("checkbox_off");
            this.ctx.drawImage(stateImage, 0, 0);
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
