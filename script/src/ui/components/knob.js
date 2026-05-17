import UIElement from "./element.js";
import Y from "../yascal/yascal.js";
import Font from "../font.js";

export default class Knob extends UIElement {
    _label = "";
    _font;
    _value = 50;
    _startValue = 50;
    _img;
    _imgDisabled;
    _front;
    _padding = 16;

    constructor(x, y) {
        const img     = Y.getImage("knob_back");
        const padding = 16;
        super(x || 0, y || 0, img.width + padding * 2, img.height + padding * 2);
        this.type         = "knob";
        this._img         = img;
        this._imgDisabled = Y.getImage("knob_back_inactive");
        this._front       = Y.getImage("knob_front");
    }

    get label()      { return this._label; }
    set label(v)     { this._label = v; this.refresh(); }

    get font()       { return this._font; }
    set font(v)      { this._font = v; this.refresh(); }

    get value()      { return this._value; }
    set value(v)     { this._value = Math.max(0, Math.min(100, v)); this.refresh(); }

    get disabled()  { return this._disabled; }
    set disabled(v) { this._disabled = !!v; this.refresh(); }

    toggleDisabled() {
        this._disabled = !this._disabled;
        if (this.onToggle) this.onToggle(!this._disabled);
        this.refresh();
    }

    onDragStart() { this._startValue = this._value; }

    onDrag(touchData) {
        if (this._disabled) return;
        this._value = Math.max(0, Math.min(100, this._startValue - touchData.deltaY));
        this.refresh();
        if (this.onChange) this.onChange(this._value);
    }

    onClick(e) {
        if (Math.abs(e.x - e.startX) < 3 && Math.abs(e.y - e.startY) < 3) this.toggleDisabled();
    }

    render(internal) {
        if (this.needsRendering) {
            internal = !!internal;
            this.clearCanvas();

            const scale = 0.8;
            const imgw  = this._img.width  * scale;
            const imgh  = this._img.height * scale;
            const w     = imgw / 2;
            const h     = imgh / 2;
            const p     = this._padding;

            this.ctx.save();
            this.ctx.translate(p + w, p + h);
            this.ctx.drawImage(this._disabled ? this._imgDisabled : this._img, -w, -h, imgw, imgh);

            const minAngle  = -230, maxAngle = 50;
            const maxRange  = Math.abs(minAngle) + maxAngle;
            const angleValue = minAngle + (this._value / 100) * maxRange;

            this.ctx.fillStyle = this._disabled ? "rgba(170,170,170,0.5)" : "rgba(130,200,255,0.5)";
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, minAngle * Math.PI / 180, angleValue * Math.PI / 180, false);
            this.ctx.arc(0, 0, 25, angleValue * Math.PI / 180, minAngle * Math.PI / 180, true);
            this.ctx.fill();

            const rotAngle = (this._value / 100) * 320 - 160;
            this.ctx.rotate(rotAngle * Math.PI / 180);
            this.ctx.drawImage(this._front, -w, -h, imgw, imgh);
            this.ctx.restore();

            if (this._label && Font.small) {
                const labelX = p + w - (this._label.length * 3);
                Font.small.write(this.ctx, this._label, labelX, imgh + p + 4);
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
