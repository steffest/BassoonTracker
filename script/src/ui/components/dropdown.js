import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import Y from "../yascal/yascal.js";
import UI from "../ui.js";
import Font from "../font.js";

export default class Dropdown extends UIElement {
    _items = [];
    _selectedIndex = 0;
    _hoverIndex = 0;
    _scrollOffset = 0;
    _isOpen = false;
    _isHover = false;
    _popup = null;
    _background;

    _listLeft = 0;
    _listTop = 0;
    _listWidth = 0;
    _listHeight = 0;

    _itemHeight = 22;
    _maxVisibleItems = 8;
    _arrowWidth = 18;
    _labelCharWidth = 7;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "dropdown";

        this.label         = "";
        this.labelPosition = "left";
        this.labelWidth    = 0;
        this.labelFont     = null;
        this.itemFont      = null;

        this._background = new Scale9Panel(0, 0, this.width, this.height, {
            img: Y.getImage("panel_dark"), left: 3, top: 3, right: 2, bottom: 2
        });
        this._background.ignoreEvents = true;
        this.addChild(this._background);
    }

    get items()  { return this._items; }
    set items(v) { this.setItems(v); }

    get selectedIndex()  { return this._selectedIndex; }
    set selectedIndex(v) { this.setSelectedIndex(v); }

    setItems(newItems) {
        this._items = newItems || [];
        this._selectedIndex = Math.min(this._selectedIndex, Math.max(0, this._items.length - 1));
        if (this._popup) this._popup.clearCache();
        this.refresh();
    }

    getItems()         { return this._items; }
    getSelectedIndex() { return this._selectedIndex; }
    getSelectedItem()  { return this._items[this._selectedIndex]; }

    setSelectedIndex(index, silent) {
        if (!this._items.length) return;
        this._selectedIndex = Math.max(0, Math.min(index, this._items.length - 1));
        this.refresh();
        if (!silent && this.onChange) this.onChange(this._selectedIndex, this._items[this._selectedIndex]);
    }

    open() {
        if (this._isOpen || !this._items.length) return;
        this._isOpen = true;
        this._hoverIndex   = this._selectedIndex;
        this._scrollOffset = Math.max(0, this._selectedIndex - Math.floor(this._maxVisibleItems / 2));

        const abs          = this._getAbsolutePosition();
        const visibleCount = Math.min(this._items.length, this._maxVisibleItems);
        const lw           = this._computedLabelWidth();
        const btnLeft      = this.labelPosition === "left" ? lw : 0;

        this._listWidth  = this.itemWidth || (this.width - lw);
        this._listHeight = visibleCount * this._itemHeight + 4;
        this._listLeft   = abs.x + btnLeft;
        this._listTop    = abs.y + this.height;

        if (UI.mainPanel && this._listTop + this._listHeight > UI.mainPanel.height) {
            this._listTop = abs.y - this._listHeight;
        }

        if (!this._popup) this._popup = this._createPopup();
        this._popup.syncWidth();
        this._popup.setSize(
            UI.mainPanel ? UI.mainPanel.width  : 800,
            UI.mainPanel ? UI.mainPanel.height : 600
        );
        this._popup.setPosition(0, 0);
        this._popup.refresh();
        UI.setModalElement(this._popup);
        this.refresh();
    }

    close(apply) {
        if (!this._isOpen) return;
        this._isOpen = false;
        if (apply) this.setSelectedIndex(this._hoverIndex);
        UI.removeModalElement();
        this.refresh();
    }

    onHover()      { if (!this._isHover) { this._isHover = true;  this.refresh(); } }
    onHoverExit()  { if (this._isHover)  { this._isHover = false; this.refresh(); } }
    onClick()      { if (this._isOpen) { this.close(false); } else { this.open(); } }

    _computedLabelWidth() {
        if (!this.label || this.labelPosition === "none") return 0;
        return this.labelWidth || (this.label.length * this._labelCharWidth + 8);
    }

    _computedButtonWidth() {
        return this.itemWidth || (this.width - this._computedLabelWidth());
    }

    _getAbsolutePosition() {
        let x = this.left, y = this.top, parent = this.parent;
        while (parent) {
            x += parent.left + (parent.scrollOffsetX || 0);
            y += parent.top  + (parent.scrollOffsetY || 0);
            parent = parent.parent;
        }
        return { x, y };
    }

    _ensureVisible() {
        if (this._hoverIndex < this._scrollOffset) {
            this._scrollOffset = this._hoverIndex;
        } else if (this._hoverIndex >= this._scrollOffset + this._maxVisibleItems) {
            this._scrollOffset = this._hoverIndex - this._maxVisibleItems + 1;
        }
    }

    _getItemLabel(item) {
        if (!item) return "";
        if (typeof item.label === "function") return item.label();
        return item.label || "";
    }

    _createPopup() {
        const self      = this;
        const p         = new UIElement(0, 0, 800, 600);
        p.type          = "dropdown-popup";
        let itemCache   = [];
        let cachedListWidth = 0;
        const lineHor   = Y.getImage("line_hor");

        const panelBg = new Scale9Panel(0, 0, 100, 100, {
            img: Y.getImage("panel_dark"), left: 3, top: 3, right: 2, bottom: 2
        });
        panelBg.ignoreEvents = true;
        p.addChild(panelBg);

        function renderItem(item, index) {
            if (itemCache[index]) return itemCache[index];
            const canvas  = document.createElement("canvas");
            canvas.width  = Math.max(1, self._listWidth - 4);
            canvas.height = self._itemHeight;
            const ctx     = canvas.getContext("2d");
            let textX     = 10;
            if (item.icon) { ctx.drawImage(item.icon, textX, 3); textX += item.icon.width + 4; }
            const itemFont = self.itemFont || Font.med;
            if (itemFont) itemFont.write(ctx, self._getItemLabel(item), textX, 5, 0);
            if (lineHor) ctx.drawImage(lineHor, 0, self._itemHeight - 2, canvas.width, 2);
            itemCache[index] = canvas;
            return canvas;
        }

        p.clearCache  = () => { itemCache = []; cachedListWidth = 0; };
        p.syncWidth   = () => { if (cachedListWidth !== self._listWidth) { itemCache = []; cachedListWidth = self._listWidth; } };

        p.render = function(internal) {
            internal = !!internal;
            if (p.needsRendering) {
                p.clearCanvas();
                panelBg.setSize(self._listWidth, self._listHeight);
                panelBg.setPosition(self._listLeft, self._listTop);
                panelBg.render();

                const visibleCount = Math.min(self._items.length - self._scrollOffset, self._maxVisibleItems);
                for (let i = 0; i < visibleCount; i++) {
                    const idx   = i + self._scrollOffset;
                    const itemY = self._listTop + 2 + i * self._itemHeight;
                    if (idx === self._hoverIndex) {
                        p.ctx.fillStyle = "rgba(110,130,220,0.15)";
                        p.ctx.fillRect(self._listLeft + 2, itemY, self._listWidth - 4, self._itemHeight);
                    } else if (idx === self._selectedIndex) {
                        p.ctx.fillStyle = "rgba(110,130,220,0.25)";
                        p.ctx.fillRect(self._listLeft + 2, itemY, self._listWidth - 4, self._itemHeight);
                    }
                    p.ctx.drawImage(renderItem(self._items[idx], idx), self._listLeft + 2, itemY);
                }

                const labelFont = self.labelFont || Font.small;
                if (self._scrollOffset > 0 && labelFont)
                    labelFont.write(p.ctx, "▲", self._listLeft + self._listWidth - 16, self._listTop + 4, 0);
                if (self._scrollOffset + self._maxVisibleItems < self._items.length && labelFont)
                    labelFont.write(p.ctx, "▼", self._listLeft + self._listWidth - 16, self._listTop + self._listHeight - 14, 0);
            }
            p.needsRendering = false;
            if (internal) return p.canvas;
            p.parentCtx.drawImage(p.canvas, p.left, p.top, p.width, p.height);
        };

        p.onClick = function() {
            const inside = p.eventX >= self._listLeft && p.eventX <= self._listLeft + self._listWidth &&
                           p.eventY >= self._listTop  && p.eventY <= self._listTop  + self._listHeight;
            if (inside) {
                const idx = Math.floor((p.eventY - self._listTop - 2) / self._itemHeight) + self._scrollOffset;
                if (idx >= 0 && idx < self._items.length) { self._hoverIndex = idx; self.close(true); }
            } else {
                self.close(false);
            }
        };

        p.onHover = function() {
            const inside = p.eventX >= self._listLeft && p.eventX <= self._listLeft + self._listWidth &&
                           p.eventY >= self._listTop  && p.eventY <= self._listTop  + self._listHeight;
            if (inside) {
                const idx = Math.floor((p.eventY - self._listTop - 2) / self._itemHeight) + self._scrollOffset;
                if (idx >= 0 && idx < self._items.length && idx !== self._hoverIndex) {
                    self._hoverIndex = idx;
                    p.refresh();
                }
            }
        };

        p.onMouseWheel = function(touchData) {
            if (touchData.mouseWheels[0] > 0) {
                if (self._scrollOffset > 0) { self._scrollOffset--; p.refresh(); }
            } else {
                if (self._scrollOffset + self._maxVisibleItems < self._items.length) { self._scrollOffset++; p.refresh(); }
            }
        };

        p.onKeyDown = function(keyCode) {
            switch (keyCode) {
                case 27: self.close(false); return true;
                case 13: self.close(true);  return true;
                case 38:
                    if (self._hoverIndex > 0) { self._hoverIndex--; self._ensureVisible(); p.refresh(); }
                    return true;
                case 40:
                    if (self._hoverIndex < self._items.length - 1) { self._hoverIndex++; self._ensureVisible(); p.refresh(); }
                    return true;
                case 36: self._hoverIndex = 0; self._scrollOffset = 0; p.refresh(); return true;
                case 35: self._hoverIndex = self._items.length - 1; self._ensureVisible(); p.refresh(); return true;
            }
            return false;
        };

        return p;
    }

    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();

            const lw      = this._computedLabelWidth();
            const btnLeft = this.labelPosition === "left" ? lw : 0;
            const btnRight = btnLeft + this._computedButtonWidth();
            const cy      = Math.floor(this.height / 2);

            this._background.setSize(Math.max(this._computedButtonWidth(), 1), this.height);
            this._background.setPosition(btnLeft, 0);
            this._background.render();

            const labelFont = this.labelFont || Font.small;
            if (this.label && this.labelPosition !== "none" && labelFont) {
                const lx = this.labelPosition === "right" ? (this.width - lw + 4) : 4;
                labelFont.write(this.ctx, this.label, lx, cy - 4, 0);
            }

            const item      = this._items[this._selectedIndex];
            const itemLabel = item ? this._getItemLabel(item) : "";
            const itemFont  = this.itemFont || Font.med;
            if (itemLabel && itemFont) itemFont.write(this.ctx, itemLabel, btnLeft + 8, cy - 5, 0);

            this.ctx.fillStyle = this._isOpen
                ? "rgba(255,255,255,0.9)"
                : (this._isHover ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)");
            const cx = btnRight - Math.floor(this._arrowWidth / 2);
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 5, cy - 2);
            this.ctx.lineTo(cx + 5, cy - 2);
            this.ctx.lineTo(cx,     cy + 4);
            this.ctx.closePath();
            this.ctx.fill();
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
