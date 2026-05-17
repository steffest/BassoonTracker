import UIElement from "./element.js";

export default class Label extends UIElement {
    _label = "";
    _font;
    _textAlign = "left";
    _paddingTop = 0;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "label";
    }

    get label()      { return this._label; }
    set label(v)     { this._label = v; this.refresh(); }

    get font()       { return this._font; }
    set font(v)      { this._font = v; this.refresh(); }

    get textAlign()  { return this._textAlign; }
    set textAlign(v) { this._textAlign = v; this.refresh(); }

    get paddingTop()  { return this._paddingTop; }
    set paddingTop(v) { this._paddingTop = parseInt(v); this.refresh(); }

    setLabels(labels) {
        this.onResize = () => {
            const prev = this._label;
            labels.forEach(item => { if (this.width >= item.width) this._label = item.label; });
            if (prev !== this._label) this.refresh();
        };
    }

    render(internal) {
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this._label) {
                const fontSize = 10;
                let textY = Math.floor((this.height - fontSize) / 2) + this._paddingTop;
                let textX = 10;
                if (this._font) {
                    let textLength;
                    if (this._textAlign === "center") {
                        textLength = this._font.getTextWidth(this._label, 0);
                        textX = Math.floor((this.width - textLength) / 2);
                    }
                    if (this._textAlign === "right") {
                        textLength = this._font.getTextWidth(this._label, 0);
                        textX = Math.floor(this.width - textLength) - 10;
                    }
                    this._font.write(this.ctx, this._label, textX, textY, 0);
                } else {
                    this.ctx.fillStyle = "white";
                    this.ctx.fillText(this._label, textX, textY);
                }
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
