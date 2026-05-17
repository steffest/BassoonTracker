import UIElement from "./element.js";
import Assets from "../assets.js";
import Submenu from "../components/submenu.js";
import Host from "../../host.js";
import Input from "../input.js";
import Scale9Panel from "./scale9.js";
import EventBus from "../../eventBus.js";
import {EVENT} from "../../enum.js";
import Button from "./button.js";
import Font from "../font.js";

export default class Menu extends UIElement {
    _items = null;
    _buttons = [];
    _background = null;
    _activeIndex = undefined;
    _hoverIndex = undefined;
    _preHoverIndex = undefined;
    _itemMargin = 24;
    _submenuParent = null;

    keepSelection = true;
    layout = null;
    title = null;
    controlParent = null;

    constructor(x, y, w, h, submenuParent) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type             = "menu";
        this._submenuParent   = submenuParent || null;
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

    onClick(data) {
        if (this.type === "mainmenu" && !Host.showInternalMenu) return;
        const selectedIndex = this._getItemIndexAtPosition(data.x);
        this._items.forEach((item, index) => {
            if (index !== selectedIndex && item.subMenu) item.subMenu.hide();
        });
        if (selectedIndex < 0) return;
        const selectedItem  = this._items[selectedIndex];
        this._activeIndex   = undefined;
        Input.setFocusElement(this);

        if (selectedItem.subMenu) {
            const xOffset = data.globalX - data.x;
            selectedItem.subMenu.setPosition(this._getSubmenuLeft(selectedItem, xOffset), this._getSubmenuTop());
            selectedItem.subMenu.toggle();
            selectedItem.subMenu.parent.refresh();
            if (!selectedItem.subMenu.isVisible()) Input.clearFocusElement();
            if (selectedItem.subMenu.isVisible()) this._activeIndex = selectedIndex;
        }
        if (selectedItem.command) EventBus.trigger(EVENT.command, selectedItem.command);
    }

    onHover(data) {
        if (!Host.showInternalMenu) return;
        const selectedIndex = this._getItemIndexAtPosition(this.eventX);
        if (selectedIndex !== this._preHoverIndex) {
            this._hoverIndex    = selectedIndex;
            this._preHoverIndex = this._hoverIndex;
            this.refresh();
        }
        if (selectedIndex < 0) return;
        if (this._activeIndex >= 0 && this._activeIndex !== selectedIndex) {
            this.activateSubmenu(selectedIndex);
        }
    }

    onHoverExit() {
        if (this._hoverIndex !== undefined) {
            this._hoverIndex    = undefined;
            this._preHoverIndex = undefined;
            this.refresh();
        }
    }

    onKeyDown(keyCode) {
        let handled;
        switch (keyCode) {
            case 13: {
                const subItem = this.getActiveSubItem();
                if (subItem) {
                    if (subItem.item.subMenu && subItem.item.subMenu.isVisible() && subItem.item.subMenu.getSelectedIndex() >= 0) {
                        const item = subItem.item.subMenu.getItems()[subItem.item.subMenu.getSelectedIndex()];
                        if (item) subItem.item.subMenu.executeItem(item);
                    } else {
                        subItem.menu.executeItem(subItem.item);
                    }
                }
                handled = true; break;
            }
            case 27:
                this.deActivate();
                handled = true; break;
            case 37: {
                if (this._activeIndex >= 0) {
                    const subItem = this.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()) {
                        subItem.menu.deActivateSubmenu();
                    } else {
                        this.activateSubmenu(Math.max(this._activeIndex - 1, 0));
                    }
                }
                handled = true; break;
            }
            case 39: {
                if (this._activeIndex >= 0) {
                    const subItem = this.getActiveSubItem();
                    if (subItem && subItem.item.subMenu && !subItem.item.subMenu.isVisible()) {
                        subItem.menu.activateSubmenu(subItem.item);
                    } else {
                        this.activateSubmenu(Math.min(this._activeIndex + 1, this._items.length - 1));
                    }
                }
                handled = true; break;
            }
            case 38: {
                if (this._activeIndex >= 0) {
                    const subItem   = this.getActiveSubItem();
                    const activeItem = this._items[this._activeIndex];
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()) {
                        subItem.item.subMenu.setSelectedIndex(subItem.item.subMenu.getSelectedIndex() - 1);
                    } else if (activeItem && activeItem.subMenu) {
                        activeItem.subMenu.setSelectedIndex(activeItem.subMenu.getSelectedIndex() - 1);
                    }
                }
                handled = true; break;
            }
            case 40: {
                if (this._activeIndex >= 0) {
                    const subItem   = this.getActiveSubItem();
                    const activeItem = this._items[this._activeIndex];
                    if (subItem && subItem.item.subMenu && subItem.item.subMenu.isVisible()) {
                        subItem.item.subMenu.setSelectedIndex(subItem.item.subMenu.getSelectedIndex() + 1);
                    } else if (activeItem && activeItem.subMenu) {
                        activeItem.subMenu.setSelectedIndex(activeItem.subMenu.getSelectedIndex() + 1);
                    }
                }
                handled = true; break;
            }
        }
        return handled;
    }

    deActivate(clickedItem) {
        if (this.type === "context" && this.isVisible()) {
            if (clickedItem) {
                if (this.controlParent && this.controlParent.name === clickedItem.name) return;
                if (clickedItem.type === "context" || clickedItem.parent.type === "context") return;
            }
            this.hide();
            this.parent.refresh();
            Input.clearFocusElement();
            return;
        }
        if (this._activeIndex >= 0) {
            const activeItem = this._items[this._activeIndex];
            if (activeItem && activeItem.subMenu) {
                if (!(clickedItem && clickedItem.type === "submenu" && clickedItem.mainMenu && clickedItem.mainMenu.name === this.name)) {
                    activeItem.subMenu.hide();
                    this._activeIndex = undefined;
                    this.refresh();
                    Input.clearFocusElement();
                }
            }
        }
    }

    activateSubmenu(index) {
        if (index === this._activeIndex) return;
        this._activeIndex = index;
        this._items.forEach((item, i) => {
            if (i !== this._activeIndex && item.subMenu) item.subMenu.hide();
        });
        const selectedItem = this._items[index];
        if (selectedItem && selectedItem.subMenu) {
            selectedItem.subMenu.setPosition(this._getSubmenuLeft(selectedItem, this.left), this._getSubmenuTop());
            selectedItem.subMenu.toggle();
            selectedItem.subMenu.parent.refresh();
        }
    }

    getActiveSubItem() {
        if (this._activeIndex >= 0) {
            const activeItem = this._items[this._activeIndex];
            if (activeItem && activeItem.subMenu) {
                const selectedIndex = activeItem.subMenu.getSelectedIndex();
                if (selectedIndex >= 0) {
                    return { menu: activeItem.subMenu, item: activeItem.subMenu.getItems()[selectedIndex] };
                }
            }
        }
    }

    setItems(newItems) {
        this._items         = newItems;
        this._submenuParent = this._submenuParent || this.parent;
        this._buttons       = [];

        let buttonX = 3, buttonY = 3;

        if (this.title) {
            const title       = new Button(3, 3, this.width - 6, 18);
            title.background  = Assets.panelDarkGreyScale9;
            title.textAlign   = "left";
            title.font        = Font.med;
            title.paddingLeft = 10;
            title.label       = this.title;
            this._buttons.push(title);
            this.addChild(title);
            buttonY += 20;
        }

        this._items.forEach((item, index) => {
            if (this.layout === "buttons") {
                const button            = new Button(buttonX, buttonY, 60, 18);
                buttonX += 60;
                if (index === 1) { buttonX = 3; buttonY += 18; }
                button.background       = Assets.buttonKeyScale9;
                button.activeBackground = Assets.buttonKeyActiveScale9;
                button.isActive         = false;
                button.textAlign        = "center";
                button.font             = Font.dark;
                button.paddingTopActive = 1;
                button.label            = item.label;
                if (item.onClick) button.onClick = () => item.onClick();
                this._buttons.push(button);
                this.addChild(button);
            }

            if (this.layout === "list") {
                const button         = new Button(buttonX, buttonY, this.width - 6, 24);
                buttonY += 21;
                button.background     = Assets.buttonLightScale9;
                button.hoverBackground = Assets.buttonLightHoverScale9;
                button.textAlign      = "left";
                button.paddingLeft    = 10;
                button.font           = Font.med;
                button.label          = item.label;
                if (item.onClick) button.onClick = () => item.onClick();
                this._buttons.push(button);
                this.addChild(button);
            }

            if (item.subItems) {
                const subMenu    = new Submenu();
                subMenu.background = Assets.buttonLightScale9;
                subMenu.hide();
                subMenu.setItems(item.subItems);
                subMenu.zIndex   = 200;
                this._submenuParent.addChild(subMenu);
                subMenu.mainMenu = this;
                item.subMenu     = subMenu;
            }
        });

        this.zIndex = 9;
        this.refresh();
    }

    getItems() { return this._items; }

    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this._background) this._background.render();

            if (this._buttons.length) {
                this._buttons.forEach(button => button.render());
            } else if (this._items) {
                let textX        = 10;
                const textY      = 10;
                const fontWidth  = 9;
                this._items.forEach((item, index) => {
                    const w    = item.label.length * fontWidth;
                    item.startX = textX;
                    item.width  = w;
                    if (index === this._hoverIndex) {
                        this.ctx.fillStyle = "rgba(179,195,243,0.1)";
                        this.ctx.fillRect(textX - (this._itemMargin / 2), textY - 10, w + 20, 30);
                    }
                    if (Font.med) Font.med.write(this.ctx, item.label, textX, textY);
                    textX += w + this._itemMargin;
                });
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _getItemIndexAtPosition(x) {
        if (this._items && this._items.length) {
            for (let i = 0, max = this._items.length; i < max; i++) {
                const item = this._items[i];
                if (x >= item.startX - (this._itemMargin / 2) && x <= item.startX + item.width + (this._itemMargin / 2)) return i;
            }
        }
        return -1;
    }

    _getSubmenuLeft(item, xOffset) {
        if (this._submenuParent === this.parent) xOffset = this.left;
        return (item.startX || 0) + xOffset;
    }

    _getSubmenuTop() {
        return this._submenuParent === this.parent ? this.top + this.height : this.height;
    }
}
