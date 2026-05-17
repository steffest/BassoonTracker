import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";

export default class Button extends UIElement {
    _label = "";
    _image;
    _backgroundImage;
    _background;
    _activeBackground;
    _hoverBackground;
    _activeImage;
    _hoverImage;
    _font;
    _textAlign = "left";
    _paddingTop = 0;
    _paddingTopActive = 0;
    _paddingLeft = 0;
    _hasHover = true;
    _isActive = false;
    _isHover = false;
    _isDisabled = false;

    constructor(x, y, w, h, text) {
        super(x, y, w, h);
        this.type = "button";
        this._label = text || "";
    }

    get label()           { return this._label; }
    set label(v)          { this._label = v; this.refresh(); }

    get font()            { return this._font; }
    set font(v)           { this._font = v; this.refresh(); }

    get textAlign()       { return this._textAlign; }
    set textAlign(v)      { this._textAlign = v; this.refresh(); }

    get paddingTop()      { return this._paddingTop; }
    set paddingTop(v)     { this._paddingTop = parseInt(v); this.refresh(); }

    get paddingTopActive()  { return this._paddingTopActive; }
    set paddingTopActive(v) { this._paddingTopActive = parseInt(v); this.refresh(); }

    get paddingLeft()     { return this._paddingLeft; }
    set paddingLeft(v)    { this._paddingLeft = parseInt(v); this.refresh(); }

    get image()           { return this._image; }
    set image(v)          { this._image = v; this.refresh(); }

    get backgroundImage() { return this._backgroundImage; }
    set backgroundImage(v){ this._backgroundImage = v; this.refresh(); }

    get activeImage()     { return this._activeImage; }
    set activeImage(v)    { this._activeImage = v; this.refresh(); }

    get hoverImage()      { return this._hoverImage; }
    set hoverImage(v)     { this._hoverImage = v; this._hasHover = true; this.refresh(); }

    get background()  { return this._background; }
    set background(v) {
        if (v && v.img) {
            this._backgroundImage = undefined;
            this._background = new Scale9Panel(0, 0, 0, 0, v);
            this._background.setParent(this);
            this._background.setSize(this.width, this.height);
        } else {
            this._background = v;
        }
        this.refresh();
    }

    get activeBackground()  { return this._activeBackground; }
    set activeBackground(v) {
        if (v && v.img) {
            this._activeBackground = new Scale9Panel(0, 0, 0, 0, v);
            this._activeBackground.setParent(this);
            this._activeBackground.setSize(this.width, this.height);
        } else {
            this._activeBackground = v;
        }
        this.refresh();
    }

    get hoverBackground()  { return this._hoverBackground; }
    set hoverBackground(v) {
        if (v && v.img) {
            this._hoverBackground = new Scale9Panel(0, 0, 0, 0, v);
            this._hoverBackground.setParent(this);
            this._hoverBackground.setSize(this.width, this.height);
        } else {
            this._hoverBackground = v;
        }
        this._hasHover = true;
        this.refresh();
    }

    get isActive()   { return this._isActive; }
    set isActive(v)  { this._isActive = !!v; this.refresh(); }

    get isDisabled()  { return this._isDisabled; }
    set isDisabled(v) {
        this._isDisabled = !!v;
        if (v) this._isActive = false;
        this.refresh();
    }

    setSize(w, h) {
        super.setSize(w, h);
        if (this._background)       this._background.setSize(w, h);
        if (this._activeBackground) this._activeBackground.setSize(w, h);
        if (this._hoverBackground)  this._hoverBackground.setSize(w, h);
    }

    setLabels(labels) {
        this.onResize = () => {
            const prev = this._label;
            labels.forEach(item => { if (this.width >= item.width) this._label = item.label; });
            if (prev !== this._label) this.refresh();
        };
    }

    toggleActive() { this.isActive = !this._isActive; }

    onHover() {
        if (this._hasHover) {
            this._isHover = true;
            this.refresh();
        }
    }

    onHoverExit() {
        if (this._hasHover && this._isHover) {
            this._isHover = false;
            this.refresh();
        }
    }

    render(internal) {
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            internal = !!internal;
            let drawFonts = true;

            if (this._backgroundImage) {
                this.ctx.drawImage(this._backgroundImage, 0, 0, this.width, this.height);
            } else if (this._background || this._image) {
                if (!this._background) this.ctx.clearRect(0, 0, this.width, this.height);

                if (this._isActive && this._activeBackground) {
                    this._activeBackground.render();
                    if (this._activeImage) {
                        const imgY = Math.floor((this.height - this._activeImage.height) / 2);
                        const imgX = Math.floor((this.width - this._activeImage.width) / 2);
                        this.ctx.drawImage(this._activeImage, imgX, imgY);
                    }
                } else {
                    let stateImage = this._image;
                    if (this._isHover && this._hoverImage) stateImage = this._hoverImage;
                    if (this._isActive && this._activeImage) stateImage = this._activeImage;
                    if (this._isHover && this._hoverBackground) {
                        this._hoverBackground.render();
                    } else {
                        if (this._background) this._background.render();
                    }
                    if (stateImage) {
                        const imgY = Math.floor((this.height - stateImage.height) / 2);
                        const imgX = Math.floor((this.width - stateImage.width) / 2) + this._paddingLeft;
                        this.ctx.drawImage(stateImage, imgX, imgY);
                    }
                }
            } else {
                this.ctx.fillStyle = "grey";
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = "black";
                this.ctx.rect(0, 0, this.width, this.height);
                this.ctx.stroke();
            }

            if (this._label && drawFonts) {
                const fontSize = this._font ? this._font.charHeight : 10;
                const fontWidth = this._font ? this._font.charWidth : 8;
                let textY = Math.floor((this.height - fontSize) / 2) + (this._isActive ? this._paddingTopActive : this._paddingTop);
                let textX = this._paddingLeft;
                if (this._font) {
                    if (this._textAlign === "center") {
                        let textLength = this._label.length * fontWidth;
                        if (!this._font.fixedWidth) textLength = this._font.getTextWidth(this._label, 0);
                        textX = Math.floor((this.width - textLength) / 2);
                    }
                    if (this._textAlign === "right") {
                        let textLength = this._label.length * fontWidth;
                        if (!this._font.fixedWidth) textLength = this._font.getTextWidth(this._label, 0);
                        textX = this.width - textLength - 5;
                    }
                    this._font.write(this.ctx, this._label, textX, textY, 0);
                } else {
                    this.ctx.fillStyle = "white";
                    this.ctx.fillText(this._label, textX, textY);
                }
            }

            if (this._isDisabled) {
                this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
                this.ctx.fillRect(0, 0, this.width, this.height);
            }

            if (this.renderInternal) this.renderInternal();
        }

        this.needsRendering = false;
        if (internal) return this.canvas;

        let opacity = this.opacity;
        if (this._isHover && this.hoverOpacity) opacity = this.hoverOpacity;
        const applyOpacity = opacity !== undefined && opacity !== null && opacity !== 1;
        if (applyOpacity) this.parentCtx.save();
        if (applyOpacity) this.parentCtx.globalAlpha = opacity;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
        if (applyOpacity) this.parentCtx.restore();
    }
}
