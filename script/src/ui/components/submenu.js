import UIElement from "../components/element.js";
import Scale9Panel from "./scale9.js";
import Y from "../yascal/yascal.js";
import Assets from "../assets.js";
import UI from "../ui.js";
import EventBus from "../../eventBus.js";
import {EVENT} from "../../enum.js";
import Font from "../font.js";

export default class Submenu extends UIElement {
    _items = null;
    _background = null;
    _itemHeight = 26;
    _paddingTop = 9;
    _paddingLeft = 9;
    _charWidth = 9;
    _hoverIndex = undefined;
    _preHoverIndex = undefined;
    _activeSubmenu = undefined;

    mainMenu = null;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "submenu";
    }

    get background()  { return this._background; }
    set background(v) {
        if (v) {
            const bg = new Scale9Panel(0, 0, this.width, this.height, v);
            bg.ignoreEvents = true;
            this.addChild(bg);
            this._background = bg;
        }
        this.refresh();
    }

    get items()  { return this._items; }
    set items(v) { this.setItems(v); }

    onHover() {
        const index = Math.floor(this.eventY / this._itemHeight);
        if (index !== this._preHoverIndex) this.setSelectedIndex(index);
    }

    onHoverExit() {
        if (this._hoverIndex !== undefined) {
            this._hoverIndex    = undefined;
            this._preHoverIndex = undefined;
            this.refresh();
        }
    }

    onShow() {
        this._hoverIndex    = 0;
        this._preHoverIndex = 0;
    }

    onHide() {
        if (this._activeSubmenu) {
            this._activeSubmenu.subMenu.hide();
            this._activeSubmenu = undefined;
        }
    }

    setSelectedIndex(index) {
        this._hoverIndex    = Math.max(0, Math.min(index, this._items.length - 1));
        this._preHoverIndex = this._hoverIndex;
        const item = this._items[this._hoverIndex];
        if (item.subItems) {
            this.activateSubmenu(item);
        } else if (this._activeSubmenu) {
            this._activeSubmenu.subMenu.hide();
            this._activeSubmenu = undefined;
        }
        this.refresh();
    }

    getSelectedIndex() {
        return (typeof this._hoverIndex !== "undefined") ? this._hoverIndex : -1;
    }

    onClick() {
        if (!(this._items && this._items.length)) return;
        const selectedItem = this._items[Math.floor(this.eventY / this._itemHeight)];
        this.executeItem(selectedItem);
    }

    executeItem(item) {
        if (this._isDisabled(item)) return;
        if (item) {
            if (item.command) {
                this.hide();
                this.parent.refresh();
                if (this.mainMenu) this.mainMenu.deActivate();
                EventBus.trigger(EVENT.command, item.command);
            } else if (item.onClick) {
                this.hide();
                this.parent.refresh();
                if (this.mainMenu) this.mainMenu.deActivate();
                item.onClick();
            } else if (item.subItems) {
                this.toggleSubmenu(item);
            }
        }
    }

    activateSubmenu(item) {
        if (!item.subMenu) {
            const subMenu    = new Submenu();
            subMenu.background = Assets.buttonLightScale9;
            subMenu.hide();
            subMenu.setItems(item.subItems);
            subMenu.zIndex   = 300;
            this.parent.addChild(subMenu);
            subMenu.mainMenu = this.mainMenu;
            item.subMenu     = subMenu;
        }
        let left = this.left + this.width - 20;
        if (left + item.subMenu.width > UI.mainPanel.width) left = UI.mainPanel.width - item.subMenu.width;
        item.subMenu.setPosition(left, this.top + item.index * this._itemHeight);
        item.subMenu.show();
        this._activeSubmenu = item;
        this.refresh();
    }

    deActivateSubmenu() {
        if (this._activeSubmenu) {
            this._activeSubmenu.subMenu.hide();
            this._activeSubmenu = undefined;
            this.refresh();
        }
    }

    toggleSubmenu(item) {
        if (item.subMenu && item.subMenu.isVisible()) {
            this.deActivateSubmenu();
        } else {
            this.activateSubmenu(item);
        }
    }

    setItems(newItems) {
        this._items = newItems;
        let width = 50;
        this._items.forEach((item, index) => {
            const labelWidth = item.label ? this._getLabel(item).length * this._charWidth : 0;
            width = Math.max(width, labelWidth + this._paddingLeft * 2 + 6);
            item.index = index;
        });
        const height = this._items.length * this._itemHeight + 4;
        this.setSize(width, height);
        if (this._background) this._background.setSize(this.width, this.height);
        this._hoverIndex    = undefined;
        this._preHoverIndex = undefined;
        this._activeSubmenu = undefined;
        this.refresh();
    }

    getItems() { return this._items; }

    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this._background) this._background.render();

            const line      = Y.getImage("line_hor");
            let textY       = 0;
            const textX     = 0;
            const textWidth = this.width - 3;
            const max       = this._items.length - 1;

            for (let i = 0; i <= max; i++) {
                const item     = this._items[i];
                const disabled = this._isDisabled(item);

                if (i === this._hoverIndex && !disabled) {
                    this.ctx.fillStyle = "rgba(255,255,255,0.2)";
                    this.ctx.fillRect(textX, textY, textWidth, this._itemHeight);
                }
                if (item.label && Font.ft) {
                    Font.ft.write(this.ctx, this._getLabel(item), textX + this._paddingLeft, textY + this._paddingTop);
                }
                if (item.subItems && Font.med) {
                    Font.med.write(this.ctx, ">", this.width - 16, textY + this._paddingTop + 2);
                }
                if (disabled) {
                    this.ctx.fillStyle = "rgba(88,105,129,0.6)";
                    this.ctx.fillRect(textX, textY, textWidth, this._itemHeight);
                }
                textY += this._itemHeight;
                if (i < max && line) this.ctx.drawImage(line, textX, textY, textWidth, 2);
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _isDisabled(item) {
        return typeof item.disabled === "function" ? item.disabled() : !!item.disabled;
    }

    _getLabel(item) {
        return typeof item.label === "function" ? item.label() : item.label;
    }
}
