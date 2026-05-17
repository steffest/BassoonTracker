import UIElement from "./element.js";
import Y from "../yascal/yascal.js";
import Ticker from "../ticker.js";

export default class UIAnimsprite extends UIElement {
    _baseImage;
    _frames;
    _step = 0;

    constructor(x, y, w, h, baseImageName, frames) {
        super(x, y, w || 14, h || 14);
        this._baseImage = Y.getImage(baseImageName);
        this._frames = frames;
    }

    onShow() {
        Ticker.onEachTick2(() => {
            this._step++;
            if (this._step >= this._frames) this._step = 0;
            this.refresh();
        }, 0);
    }

    onHide() {
        Ticker.onEachTick2();
    }

    render(internal) {
        if (this.needsRendering) {
            this.clearCanvas();
            this.ctx.drawImage(this._baseImage, this._step * this.width, 0, this.width, this.height, 0, 0, this.width, this.height);
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
