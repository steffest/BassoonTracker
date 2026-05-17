import UIElement from "./element.js";
import Y from "../yascal/yascal.js";

export default class UIImage extends UIElement {
    _baseImage;

    constructor(x, y, w, h, src) {
        super(x, y, w || 14, h || 14);
        this._baseImage = Y.getImage(src);
    }

    get src()  { return this._src; }
    set src(v) { this._src = v; this._baseImage = Y.getImage(v); this.refresh(); }

    render(internal) {
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this._baseImage) {
                switch (this.scale) {
                    case "stretch":
                        this.ctx.drawImage(this._baseImage, 0, 0, this.width, this.height);
                        break;
                    default: {
                        let marginW = (this.width - this._baseImage.width) >> 1;
                        let marginH = (this.height - this._baseImage.height) >> 1;
                        if (this.verticalAlign === "top") marginH = 0;
                        if (this.horizontalAlign === "right") marginW = this.width - this._baseImage.width;
                        this.ctx.drawImage(this._baseImage, marginW, marginH);
                    }
                }
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
