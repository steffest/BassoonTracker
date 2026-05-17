import UIElement from "./element.js";

export default class Scale9Panel extends UIElement {
    _base;

    constructor(x, y, w, h, base) {
        super(x, y, w || 1, h || 1);
        this.type = "scale9";
        this._base = base || {};
        this._base.scale = this._base.scale || "stretch";
    }

    setBase(config) {
        if (config.img       !== undefined) this._base.img    = config.img;
        if (config.scale     !== undefined) this._base.scale  = config.scale;
        if (config.imgTop    !== undefined) this._base.top    = config.imgTop;
        if (config.imgBottom !== undefined) this._base.bottom = config.imgBottom;
        if (config.imgLeft   !== undefined) this._base.left   = config.imgLeft;
        if (config.imgRight  !== undefined) this._base.right  = config.imgRight;
        this.refresh();
    }

    _createCanvas() {
        const b   = this._base;
        const img = b.img;
        if (!img) return;

        const centerW       = img.width  - b.left - b.right;
        const centerH       = img.height - b.top  - b.bottom;
        const targetCenterW = this.width  - b.left - b.right;
        const targetCenterH = this.height - b.top  - b.bottom;

        this.clearCanvas();

        if (b.top  && b.left)  this.ctx.drawImage(img, 0, 0, b.left, b.top, 0, 0, b.left, b.top);
        if (b.top)              this.ctx.drawImage(img, b.left, 0, centerW, b.top, b.left, 0, targetCenterW, b.top);
        if (b.top  && b.right) this.ctx.drawImage(img, b.left + centerW, 0, b.right, b.top, b.left + targetCenterW, 0, b.right, b.top);
        if (b.left)             this.ctx.drawImage(img, 0, b.top, b.left, centerH, 0, b.top, b.left, targetCenterH);

        if (b.scale === "stretch") {
            this.ctx.drawImage(img, b.left, b.top, centerW, centerH, b.left, b.top, targetCenterW, targetCenterH);
        }
        if (b.scale === "repeatX") {
            let tx = b.left, tMax = b.left + targetCenterW;
            while (tx < tMax) {
                let tw = centerW;
                if (tx + tw > tMax) tw = tMax - tx;
                this.ctx.drawImage(img, b.left, b.top, tw, centerH, tx, b.top, tw, centerH);
                tx += tw;
            }
        }
        if (b.scale === "repeatY") {
            let ty = b.top, tMax = b.top + targetCenterH;
            while (ty < tMax) {
                let th = centerH;
                if (ty + th > tMax) th = tMax - ty;
                this.ctx.drawImage(img, b.left, b.top, centerW, th, b.left, ty, centerW, th);
                ty += th;
            }
        }

        if (b.right)             this.ctx.drawImage(img, b.left + centerW, b.top, b.right, centerH, b.left + targetCenterW, b.top, b.right, targetCenterH);
        if (b.bottom && b.left)  this.ctx.drawImage(img, 0, b.top + centerH, b.left, b.bottom, 0, b.top + targetCenterH, b.left, b.bottom);
        if (b.bottom)            this.ctx.drawImage(img, b.left, b.top + centerH, centerW, b.bottom, b.left, b.top + targetCenterH, targetCenterW, b.bottom);
        if (b.bottom && b.right) this.ctx.drawImage(img, b.left + centerW, b.top + centerH, b.right, b.bottom, b.left + targetCenterW, b.top + targetCenterH, b.right, b.bottom);
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this._createCanvas();
            this.children.forEach(elm => elm.render());
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top);
    }
}
