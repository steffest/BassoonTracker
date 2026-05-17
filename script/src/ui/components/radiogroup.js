import UIElement from "./element.js";
import Y from "../yascal/yascal.js";
import Font from "../font.js";

export default class RadioGroup extends UIElement {
    _items = [];
    _selectedIndex = undefined;
    _previousSelectedIndex = undefined;
    _align = "right";
    _size = "small";
    _divider = null;
    _highLightSelection = false;
    _startY = 0;
    _buttonY = -3;
    _itemHeight = 13;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "radiogroup";
    }

    get items()               { return this._items; }
    set items(v)              { this.setItems(v); }

    get selectedIndex()       { return this._selectedIndex; }
    set selectedIndex(v)      { this.setSelectedIndex(v); }

    get align()               { return this._align; }
    set align(v)              { this._align = v; this.refresh(); }

    get size()                { return this._size; }
    set size(v)               { this._size = v; this.refresh(); }

    get divider()             { return this._divider; }
    set divider(v)            { this._divider = v; this.refresh(); }

    get highLightSelection()  { return this._highLightSelection; }
    set highLightSelection(v) { this._highLightSelection = !!v; this.refresh(); }

    onClick() {
        this.setSelectedIndex(Math.floor((this.eventY - this._startY + this._buttonY) / this._itemHeight));
    }

    setSelectedIndex(index, internal) {
        if (!this._items.length) return;
        index = Math.max(0, Math.min(index, this._items.length - 1));
        for (let i = 0, len = this._items.length; i < len; i++) {
            this._items[i].active = i === index;
        }
        this._selectedIndex = index;
        this.refresh();
        if (!internal && this.onChange && this._previousSelectedIndex !== this._selectedIndex) {
            this.onChange(this._selectedIndex);
        }
        this._previousSelectedIndex = this._selectedIndex;
    }

    getSelectedIndex() { return this._selectedIndex; }
    getSelectedItem()  { return this._items[this._selectedIndex]; }

    setItems(newItems) {
        this._selectedIndex = undefined;
        this._items = newItems || [];
        for (let i = 0, len = this._items.length; i < len; i++) {
            if (this._items[i].active) this._selectedIndex = i;
        }
        this.refresh();
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            this.clearCanvas();

            let buttonActive   = Y.getImage("radio_active");
            let buttonInactive = Y.getImage("radio_inactive");
            if (!this._items.length) { this.needsRendering = false; return; }
            this._itemHeight = Math.floor(this.height / this._items.length);

            let font    = Font.small;
            let textX   = 5;
            let buttonX = this.width - 15;
            this._buttonY = -3;

            if (this._size === "med") {
                buttonActive   = Y.getImage("radio_big_active");
                buttonInactive = Y.getImage("radio_big_inactive");
                this._buttonY  = -2;
                buttonX        = this.width - 20;
                font           = Font.med;
            }

            const paddingTop = font ? Math.floor((this._itemHeight - font.charHeight) / 2) : 0;

            if (this._align === "left") {
                textX   = 30;
                buttonX = 5;
            }

            const line = Y.getImage("line_hor");

            for (let i = 0, len = this._items.length; i < len; i++) {
                const item    = this._items[i];
                const itemTop = this._startY + (i * this._itemHeight);
                const textTop = itemTop + paddingTop;

                if (this._divider === "line" && i > 0 && line) {
                    this.ctx.drawImage(line, 0, itemTop, this.width, 2);
                }

                if (font) {
                    let label = item.label;
                    if (this._align === "right") {
                        textX = buttonX - font.getTextWidth(item.label, 0) - 4;
                        if (textX < 0 && item.labels) {
                            const rest = buttonX - 4;
                            item.labels.forEach(lb => { if (lb.width <= rest) label = lb.label; });
                            textX = buttonX - font.getTextWidth(label, 0) - 4;
                        }
                    }
                    font.write(this.ctx, label, textX, textTop, 0);
                }

                if (item.active) {
                    if (this._highLightSelection) {
                        this.ctx.fillStyle = "rgba(100,100,255,0.1)";
                        this.ctx.fillRect(0, itemTop, this.width - 2, this._itemHeight);
                    }
                    this.ctx.drawImage(buttonActive, buttonX, textTop + this._buttonY);
                } else {
                    this.ctx.drawImage(buttonInactive, buttonX, textTop + this._buttonY);
                }
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
