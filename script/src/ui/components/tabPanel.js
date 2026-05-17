import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import Y from "../yascal/yascal.js";
import Button from "./button.js";
import Layout from "../app/layout.js";
import Font from "../font.js";

export default class TabPanel extends UIElement {
    _background;
    _footer;
    _tabButtons = [];
    _tabX = 0;
    _activeTabIndex = 0;
    _footerHeight = 10;
    _showFooter = true;

    constructor(x, y, w, h, config) {
        super(x, y, w, h);
        this.type = "tabpanel";

        this._background = new Scale9Panel(0, 0, w, h, {
            img: Y.getImage("tab_panel"), left: 8, top: 9, right: 8, bottom: 9
        });

        this._footer = new Scale9Panel(0, 0, 0, 0, {
            img: Y.getImage("tab_panel_bottom"), left: 10, top: 2, right: 10, bottom: 6
        });
        this.addChild(this._footer);

        if (config && config.tabs) config.tabs.forEach(tab => this._addTab(tab));
    }

    onResize() {
        this._background.setSize(this.width, this.height - Layout.trackControlHeight);
        this._showFooter = this.height > 160;
        this._tabButtons.forEach(btn => {
            if (btn.panel) {
                let h = this._background.height;
                if (btn.footer && this._showFooter) h -= (this._footerHeight + 2);
                btn.panel.setSize(this._background.width - 2, h);
                btn.panel.setPosition(2, Layout.trackControlHeight + 4);
            }
        });
        this._footer.setSize(this.width, this._footerHeight);
        this._footer.setPosition(0, this.height - (this._footerHeight + 2));
        if (this._footer.children) {
            this._footer.children.forEach(elm => {
                elm.setPosition(2, 2);
                elm.setSize(this._footer.width - 4, this._footer.height - 4);
            });
        }
        const activeButton = this._tabButtons[this._activeTabIndex];
        this._footer.toggle(!!(activeButton && activeButton.footer && this._showFooter));
    }

    setTab(index) {
        const button = this._tabButtons[index];
        if (button) button.onDown();
    }

    render(internal) {
        internal = !!internal;
        if (!this.isVisible()) return;
        if (this.needsRendering) {
            console.error("Rendering tab panel");
            this.clearCanvas();
            const back = this._background.render(true);
            const y    = Layout.trackControlHeight - 2;
            this.ctx.drawImage(back, 0, y);
            if (this._tabButtons[0] && this._tabButtons[0].opacity < 1) {
                this.ctx.drawImage(Y.getImage("tab_panel_corner"), 0, y);
            }

            let activeButton;
            this._tabButtons.forEach(elm => {
                if (elm.opacity === 1) {
                    activeButton = elm;
                } else {
                    elm.render();
                }
            });
            if (activeButton) {
                activeButton.render();
                if (activeButton.left > 20) {
                    this.ctx.drawImage(Y.getImage("tab_border"), activeButton.left - 22, activeButton.top + activeButton.height);
                }
            }
            this._footer.render();
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top);
    }

    _addTab(config) {
        const tabButton       = new Button(this._tabX, 12, config.width, 18);
        tabButton.label       = config.label;
        tabButton.textAlign   = "left";
        tabButton.background  = { img: Y.getImage("tab"), left: 4, top: 4, right: 30, bottom: 4 };
        tabButton.font        = Font.dark;
        tabButton.paddingLeft = 10;
        tabButton.paddingTop  = 1;
        tabButton.opacity     = config.isSelected ? 1 : 0.5;

        tabButton.onHover     = () => {
            if (tabButton.opacity < 1) tabButton.opacity = 0.7;
        };
        tabButton.onHoverExit = () => {
            if (tabButton.opacity < 1) tabButton.opacity = 0.5;
        };
        tabButton.onDown      = () => {
            this._tabButtons.forEach(elm => {
                elm.opacity = 0.5;
                elm.refresh();
                if (elm.panel) elm.panel.hide();
            });
            tabButton.opacity        = 1;
            tabButton.refresh();
            this._activeTabIndex     = tabButton.index;
            if (config.panel) config.panel.show();
            this._footer.toggle(!!(config.footer && this._showFooter));
        };

        tabButton.panel  = config.panel;
        tabButton.footer = config.footer;
        tabButton.index  = this._tabButtons.length;
        if (!config.isSelected && config.panel) config.panel.hide();
        this.addChild(tabButton);
        this._tabButtons.push(tabButton);
        this._tabX += config.width - 12;

        if (config.footer) {
            this._footerHeight = config.footer.height;
            this._footer.addChild(config.footer);
        }
    }
}
