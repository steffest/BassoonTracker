import UIElement from "./element.js";

export default class Panel extends UIElement {
    _backgroundColor;
    _borderColor;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "panel";
    }

    get backgroundColor()  { return this._backgroundColor; }
    set backgroundColor(v) { this._backgroundColor = v; this.refresh(); }

    get borderColor()  { return this._borderColor; }
    set borderColor(v) { this._borderColor = v; this.refresh(); }

    sortZIndex() {
        this.children.sort((a, b) => a.zIndex === b.zIndex ? 0 : (a.zIndex > b.zIndex ? 1 : -1));
    }

    onClick() {}

    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;
        if (this.needsRendering) {
            if (this.renderOverride) {
                this.renderOverride();
            } else {
                this.clearCanvas();
                if (this._backgroundColor) {
                    this.ctx.fillStyle = this._backgroundColor;
                    this.ctx.fillRect(0, 0, this.width, this.height);
                }
                if (this._borderColor) {
                    this.ctx.strokeStyle = this._borderColor;
                    this.ctx.rect(0, 0, this.width, this.height);
                    this.ctx.stroke();
                }
                this.children.forEach(elm => elm.render());
                if (this.renderInternal) this.renderInternal();
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
