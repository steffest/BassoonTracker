import UIElement from "../components/element.js";
import Y from '../yascal/yascal.js';
import Scale9Panel from "./scale9.js";
import Assets from "../assets.js";
import Font from "../font.js";

export default class ListBox extends UIElement {
    _items = [];
    _selectedIndex = 0;
    _previousSelectedIndex = 0;
    _visibleIndex = 0;
    _visibleItems = 0;
    _lineHeight = 18;
    _startY = 1;
    _scrollBarItemOffset = 0;
    _hoverIndex = undefined;
    _startDragIndex = 0;
    _itemCache = [];
    _font = null;
    _itemRenderFunction = null;
    _background;
    _buttonUp;
    _buttonDown;
    _scrollBar;

    centerSelection = false;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "listbox";

        this._background = new Scale9Panel(0, 0, w, h, {
            img: Y.getImage("panel_dark"), left: 3, top: 3, right: 2, bottom: 2
        });
        this._background.ignoreEvents = true;
        this.addChild(this._background);

        this._buttonUp = Assets.generate("button20_20");
        this._buttonUp.label = "↑";
        this._buttonUp.onClick = () => this.navigateUp();
        this.addChild(this._buttonUp);

        this._buttonDown = Assets.generate("button20_20");
        this._buttonDown.label = "↓";
        this._buttonDown.onClick = () => this.navigateDown();
        this.addChild(this._buttonDown);

        this._scrollBar = new Scale9Panel(w - 28, 18, 16, h - 3, {
            img: Y.getImage("bar"), left: 2, top: 2, right: 3, bottom: 3
        });
        this._scrollBar.onDragStart = () => {
            this._scrollBar.startDragIndex = this._visibleIndex;
        };
        this._scrollBar.onDrag = (touchData) => {
            if (this._items.length > this._visibleItems && this._scrollBarItemOffset) {
                const delta = touchData.deltaY;
                this._visibleIndex = Math.floor(this._scrollBar.startDragIndex + delta / this._scrollBarItemOffset);
                this._visibleIndex = Math.min(this._visibleIndex, this._getMaxIndex());
                this._visibleIndex = Math.max(this._visibleIndex, 0);
                if (this.centerSelection) {
                    this.setSelectedIndex(this._visibleIndex);
                } else {
                    this._updateLayout();
                    this.refresh();
                }
            }
        };
        this.addChild(this._scrollBar);
        this._updateLayout();
    }

    get selectedIndex()        { return this._selectedIndex; }
    set selectedIndex(v)       { this._selectedIndex = v; this.refresh(); }

    get lineHeight()           { return this._lineHeight; }
    set lineHeight(v)          { this._lineHeight = v; this.refresh(); }

    get font()                 { return this._font; }
    set font(v)                { this._font = v; this._itemCache = []; this.refresh(); }

    get itemRenderFunction()   { return this._itemRenderFunction; }
    set itemRenderFunction(v)  { this._itemRenderFunction = v; this._itemCache = []; this.refresh(); }

    get items()                { return this._items; }
    set items(v)               { this.setItems(v); }

    setSize(w, h) {
        super.setSize(w, h);
        if (this._background) {
            this._background.setSize(w, h);
            this._updateLayout();
        }
    }

    setSelectedIndex(index, internal) {
        if (!this._items.length) return;
        index = Math.min(index, this._items.length - 1);
        this._selectedIndex = Math.max(0, index);
        if (this.centerSelection) this._visibleIndex = this._selectedIndex;
        this._updateLayout();
        this.refresh();
        if (!internal && this.onChange && this._previousSelectedIndex !== this._selectedIndex) {
            this.onChange();
        }
        this._previousSelectedIndex = this._selectedIndex;
    }

    getSelectedIndex() { return this._selectedIndex; }

    navigateUp() {
        if (this._visibleIndex > 0) {
            this._visibleIndex--;
            this._updateLayout();
        }
        if (this.centerSelection) {
            this.setSelectedIndex(this._visibleIndex);
        } else {
            this.refresh();
        }
    }

    navigateDown() {
        if (this._visibleIndex < this._getMaxIndex()) {
            this._visibleIndex++;
            this._updateLayout();
        }
        if (this.centerSelection) {
            this.setSelectedIndex(this._visibleIndex);
        } else {
            this.refresh();
        }
    }

    setItems(newItems) {
        this._itemCache = [];
        this._items = newItems || [];
        this._visibleIndex = Math.min(this._visibleIndex, this._getMaxIndex());
        this._updateLayout();
        this.refresh();
    }

    clearCache() { this._itemCache = []; }
    getItems()   { return this._items; }

    getItemAtPosition(x, y) {
        const index = Math.floor((y - this._startY) / this._lineHeight) + this._visibleIndex;
        return (index >= 0 && index < this._items.length) ? this._items[index] : undefined;
    }

    insertItemAfterIndex(newItem, index, indent) {}

    onMouseWheel(touchData) {
        if (touchData.mouseWheels[0] > 0) {
            this.navigateUp();
        } else {
            this.navigateDown();
        }
    }

    onDragStart(touchData) {
        this._startDragIndex = this._visibleIndex;
    }

    onDrag(touchData) {
        if (this._items.length > this._visibleItems) {
            const delta = Math.round(touchData.deltaY / this._lineHeight);
            this._visibleIndex = this._startDragIndex - delta;
            this._visibleIndex = Math.max(this._visibleIndex, 0);
            this._visibleIndex = Math.min(this._visibleIndex, this._getMaxIndex());
            if (this.centerSelection) {
                this.setSelectedIndex(this._visibleIndex);
            } else {
                this._updateLayout();
                this.refresh();
            }
        }
    }

    onHover() {
        const index = Math.floor((this.eventY - this._startY) / this._lineHeight);
        if (index !== this._hoverIndex) {
            this._hoverIndex = index;
            this.refresh();
        }
    }

    onHoverExit() {
        if (this._hoverIndex !== undefined) {
            this._hoverIndex = undefined;
            this.refresh();
        }
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            if (this._background.isVisible()) {
                this._background.render();
            } else {
                this.clearCanvas();
            }

            for (let i = 0, len = this._items.length; i < len; i++) {
                const itemY = this._startY + ((i - this._visibleIndex) * this._lineHeight);
                if (itemY >= 0 && itemY < this.height) {
                    const item       = this._items[i];
                    const isHover    = this._hoverIndex + this._visibleIndex === i;
                    const isSelected = this._selectedIndex === i;
                    const clip       = itemY >= this.height - this._lineHeight;
                    const itemCanvas = this._renderItem(item, i, isHover, isSelected);

                    if (isHover) {
                        this.ctx.fillStyle = "rgba(110,130,220,0.15)";
                        this.ctx.fillRect(0, itemY, this.width - 2, this._lineHeight);
                    }
                    if (isSelected) {
                        this.ctx.fillStyle = "rgba(110,130,220,0.25)";
                        this.ctx.fillRect(0, itemY, this.width - 2, this._lineHeight);
                    }
                    if (clip) {
                        this.ctx.drawImage(itemCanvas, 0, itemY, this.width - 2, this.height - itemY);
                    } else {
                        this.ctx.drawImage(itemCanvas, 0, itemY);
                    }
                }
            }

            this._scrollBar.render();
            if (this._scrollBar.isVisible()) {
                this._buttonUp.render();
                this._buttonDown.render();
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _renderItem(item, index, isHover, isSelected) {
        const key = this._itemRenderFunction ? `${index}_${isHover}_${isSelected}` : index;
        if (this._itemCache[key]) return this._itemCache[key];

        const itemCanvas   = document.createElement("canvas");
        itemCanvas.width   = this.width - 2;
        itemCanvas.height  = this._lineHeight;
        const ctx          = itemCanvas.getContext("2d");

        if (this._itemRenderFunction) {
            this._itemRenderFunction(ctx, item, isHover, isSelected);
        } else {
            const font      = this._font || Font.med;
            const fontSmall = Font.small;
            let textX       = 10;
            const indent    = 10;

            if (item.level) textX += item.level * indent;
            if (item.icon)  { ctx.drawImage(item.icon, textX, 3); textX += item.icon.width + 4; }

            let text = item.label;
            if (font) {
                if (item.info) {
                    const infoLength = (item.info.length * 6) + 20;
                    if (fontSmall) fontSmall.write(ctx, item.info, this.width - infoLength, 6, 0);
                    text = text.substr(0, Math.floor((this.width - infoLength - textX - 26) / font.charWidth));
                }
                font.write(ctx, text, textX, 5, 0);
            }

            const lineHor = Y.getImage("line_hor");
            if (lineHor) ctx.drawImage(lineHor, 0, this._lineHeight - 2, this.width - 2, 2);
        }

        this._itemCache[key] = itemCanvas;
        return itemCanvas;
    }

    _updateLayout() {
        if (!this._scrollBar) return;
        const max = this._items.length;
        this._visibleItems = Math.floor(this.height / this._lineHeight);
        if (this.centerSelection) this._visibleItems = 1;

        const startTop    = 18;
        const startHeight = this.height - 4 - 32;
        let top    = startTop;
        let height = startHeight;
        this._scrollBarItemOffset = 0;

        if (max > this._visibleItems) {
            height = Math.floor((this._visibleItems / max) * startHeight);
            if (height < 12) height = 12;
            this._scrollBarItemOffset = (startHeight - height) / (max - this._visibleItems);
            this._scrollBar.show();
        } else {
            this._scrollBar.hide();
        }

        if (this._visibleIndex && this._scrollBarItemOffset) {
            top = Math.floor(startTop + this._scrollBarItemOffset * this._visibleIndex);
        }

        this._scrollBar.setPosition(this.width - 18, top);
        this._scrollBar.setSize(16, height);

        this._buttonUp.setPosition(this.width - 18, 2);
        this._buttonUp.setSize(16, 16);

        this._buttonDown.setPosition(this.width - 18, this.height - 19);
        this._buttonDown.setSize(16, 16);

        if (this.centerSelection) {
            this._startY = Math.ceil((this.height - this._lineHeight) / 2);
        }
    }

    _getMaxIndex() {
        let max = this._items.length - 1;
        if (!this.centerSelection) max = this._items.length - this._visibleItems;
        return Math.max(max, 0);
    }
}
