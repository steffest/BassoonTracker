import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import EventBus from "../../eventBus.js";
import {EVENT} from "../../enum.js";
import Y from "../yascal/yascal.js";
import Font from "../font.js";

export default class ToolTip extends UIElement {
    _text = "";
    _startOpacity = -2;
    _endOpacity = 2.5;
    _opacityStep = 0.1;
    _opacity;
    _prevLeft;
    _prevTop;
    _background;
    _overlay;
    _busHandler;

    constructor(x, y) {
        super(x || 0, y || 0, 100, 50);
        this.type         = "tooltip";
        this.ignoreEvents = true;
        this._opacity     = this._startOpacity;

        this._background = new Scale9Panel(0, 0, this.width, this.height, {
            img: Y.getImage("tooltip"), left: 8, top: 8, right: 11, bottom: 11
        });
        this.addChild(this._background);

        this._overlay = new Scale9Panel(0, 0, this.width, this.height, {
            img: Y.getImage("tooltip_extra"), left: 8, top: 2, right: 11, bottom: 3
        });

        this._busHandler = EventBus.on(EVENT.screenRefresh, () => {
            if (this._opacity > 1) {
                this._opacity += this._opacityStep;
                if (this._opacity > this._endOpacity) this._opacity = this._startOpacity;
            }
            if (!this._visible) return;
            if (this._opacity > this._startOpacity && this._opacity < 1) {
                this._opacity += this._opacityStep;
                if (this._opacity > 1) this._opacity = 1;
                this.needsRendering = true;
            }
        });
    }

    get text()  { return this._text; }
    set text(v) {
        if (v !== this._text) {
            this._text = v;
            if (this._opacity > 1) this._opacity = 1;
            this.needsRendering = true;
        }
    }

    // Called each frame by the tooltip positioning system to update position and text
    update(props) {
        if (typeof props.text !== "undefined") {
            if (props.text !== this._text) {
                this._text = props.text;
                if (this._opacity > 1) this._opacity = 1;
                this.needsRendering = true;
            }
        }
        if (typeof props.left   !== "undefined") this._left   = props.left;
        if (typeof props.top    !== "undefined") this._top    = props.top;
        if (typeof props.width  !== "undefined") this._width  = props.width;
        if (typeof props.height !== "undefined") this._height = props.height;

        if (this._text && this._opacity < 0 && (this._left !== this._prevLeft || this._top !== this._prevTop)) {
            this._opacity = this._startOpacity + this._opacityStep;
        }
        this._prevLeft = this._left;
        this._prevTop  = this._top;
    }

    isVisibleAndNotTransparent() {
        return this.isVisible() && this._opacity > 0;
    }

    onHide() {
        this._opacity = this._opacity >= 1 ? 1.1 : this._startOpacity;
    }

    destroy() {
        if (this._busHandler !== undefined) EventBus.off(EVENT.screenRefresh, this._busHandler);
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (!this._text)       return;
        if (this._opacity <= 0) return;

        if (this.needsRendering) {
            this.clearCanvas();
            let key, keyW;
            let w     = Font.smallDark.getTextWidth(this._text) + 30;
            let h     = 29;
            let label = this._text;
            let line1 = "";
            let line2 = "";

            if (this._text.indexOf("[") > 0) {
                key   = this._text.split("[")[1].split("]")[0];
                label = this._text.split("[")[0].trim();
                w     = Font.smallDark.getTextWidth(label) + 30;
                keyW  = Font.small.getTextWidth(key);
                w     = Math.max(w, keyW);
                h    += 10;
            }

            if (w > 150) {
                const parts = label.split(" ");
                let i = 0;
                const half = label.length / 2;
                while (line1.length < half && i < parts.length) { line1 += parts[i] + " "; i++; }
                while (i < parts.length) { line2 += parts[i] + " "; i++; }
                label = line1.trim();
                if (line2) {
                    h += 10;
                    w = Math.max(Font.smallDark.getTextWidth(line1), Font.smallDark.getTextWidth(line2)) + 30;
                }
            }

            // bypass setter to avoid recursive refresh in the middle of rendering
            this._width = w; this.canvas.width = w;
            this._height = h; this.canvas.height = h;

            this._background.setSize(w, h);
            this._background.render();

            if (key) {
                this._overlay.setSize(w - 13, 12);
                const c = this._overlay.render(true);
                this.ctx.drawImage(c, 4, h - 21);
                const kw = Font.smallDark.getTextWidth(key);
                Font.small.write(this.ctx, key, this.width - kw - 17, h - 17, 0);
            }

            Font.smallDark.write(this.ctx, label, 13, 9, 0);
            if (line2) Font.smallDark.write(this.ctx, line2, 13, 19, 0);
        }
        this.needsRendering = false;

        if (internal) return this.canvas;
        if (this._opacity < 1) this.parentCtx.globalAlpha = this._opacity;
        if (this._opacity > 1) this._opacity = 1;
        let left = this.left + Math.floor(this._opacity * 10);
        if (left + this.width > this.parent.width) left = this.parent.width - this.width;
        this.parentCtx.drawImage(this.canvas, left, this.top);
        this.parentCtx.globalAlpha = 1;
    }
}
