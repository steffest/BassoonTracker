import Panel from "./components/panel.js";
import App_menu from "./app/menu.js";
import Menu from "./components/menu.js";
import App_mainPanel from "./app/appMainPanel.js";
import App_controlPanel from "./app/controlPanel.js";
import App_patternPanel from "./app/patternPanel.js";
import Pattern_sidebar from "./app/components/patternSidebar.js";
import App_pianoView from "./app/pianoView.js";
import Layout from "../ui/app/layout.js";
import {COMMAND, EVENT} from "../enum.js";
import UI from "./ui.js";
import Assets from "./assets.js";
import Input from "./input.js";
import App from "../app.js";
import Button from "./components/button.js";
import Y from "./yascal/yascal.js";

export default class MainPanel extends Panel {
    _contextMenus = {};
    _isContextMenuVisible = false;
    _menu;
    _appPanel;
    _controlPanel;
    _patternPanel;
    _patternSidebar;
    _pianoPanel;
    _toggleButton;

    constructor() {
        const canvas = UI.getCanvas();
        super(0, 0, canvas.width, canvas.height, true);
        this.backgroundColor = "#071028";
        this.name = "mainPanel";

        this._menu = App_menu(this);
        this.addChild(this._menu);

        this._appPanel = new App_mainPanel();
        this.addChild(this._appPanel);

        this._controlPanel = new App_controlPanel();
        this.addChild(this._controlPanel);

        this._patternPanel = App_patternPanel();
        this.addChild(this._patternPanel);

        this._patternSidebar = new Pattern_sidebar();
        this.addChild(this._patternSidebar);
        UI.patternsidebar = this._patternSidebar;

        this._pianoPanel = App_pianoView();
        this._pianoPanel.hide();
        this.addChild(this._pianoPanel);

        this._toggleButton = new Button(1, 1, 22, 19);
        this._toggleButton.image      = Y.getImage("toggleup");
        this._toggleButton.hoverImage = Y.getImage("toggleup_active");
        this._toggleButton.tooltip    = "Toggle App Panel";
        this._toggleButton.onClick    = () => { App.doCommand(COMMAND.toggleAppPanel); };
        this.addChild(this._toggleButton);

        if (UI.visualiser)  this.addChild(UI.visualiser);
        if (UI.multitrack)  this.addChild(UI.multitrack);

        this.on(EVENT.toggleView, view => {
                if (view === "piano") {
                    this._pianoPanel.toggle();
                    let remaining = this.height - this._patternPanel.top;
                    if (this._pianoPanel.isVisible()) {
                        this._pianoPanel.setSize(Layout.mainWidth, Layout.pianoHeight);
                        this._pianoPanel.setPosition(Layout.mainLeft, this.height - this._pianoPanel.height);
                        remaining -= this._pianoPanel.height;
                    }
                    this._patternPanel.setSize(Layout.mainWidth, remaining);
                    if (Layout.showSideBar) {
                        this._patternSidebar.setSize(Layout.col1W, remaining - Layout.infoPanelHeight - Layout.analyserHeight - Layout.defaultMargin);
                    }
                }
            });
        this.on(EVENT.showView, view => {
                if (view === "main" || view === "diskop_load" || view === "options") {
                    if (!this._appPanel.isVisible()) {
                        this._appPanel.show();
                        this.onResize();
                    }
                }
                if (view === "diskop_load" || view === "options") {
                    this._toggleButton.hide();
                }
                if (view === "topmain" || view === "main") {
                    this._toggleButton.show();
                }

                if (Layout.showSideBar) {
                    switch (view) {
                        case "sample":      this._patternSidebar.hide(); break;
                        case "bottommain":
                        case "main":        this._patternSidebar.show(); break;
                    }
                } else {
                    this._setMobileSideBar();
                }
            });
        this.on(EVENT.showContextMenu, properties => {
                const contextMenu = this.createContextMenu(properties);
                let x = properties.x;
                if ((x + contextMenu.width) > Layout.mainWidth) x = Layout.mainWidth - contextMenu.width;
                if (properties.align === "top") {
                    contextMenu.setPosition(x, properties.y - contextMenu.height - 2);
                } else {
                    contextMenu.setPosition(x, properties.y);
                }
                contextMenu.show();
                this._isContextMenuVisible = true;
                if (properties.focus) Input.setFocusElement(contextMenu);
                this.refresh();
            });
        this.on(EVENT.hideContextMenu, () => {
                for (const key in this._contextMenus) this._contextMenus[key].hide();
                this._isContextMenuVisible = false;
                this.refresh();
            });
        this.on(EVENT.appLayoutChanged, () => { this.onResize(); });
        this.on(COMMAND.toggleAppPanel, () => {
                this._appPanel.toggle();
                this.onResize();
            });

        this.sortZIndex();
        this.onResize();
    }

    createContextMenu(properties) {
        let contextMenu = this._contextMenus[properties.name];
        if (!contextMenu) {
            const w = properties.width || 128;
            let h   = 42;
            if (properties.layout === "list") h = properties.items.length * 23;
            if (properties.title) h += 20;
            contextMenu = new Menu(100, 100, w, h, this);
            contextMenu.name   = properties.name;
            contextMenu.zIndex = 100;
            contextMenu.background     = Assets.panelMainScale9;
            contextMenu.layout         = properties.layout || "buttons";
            contextMenu.type           = "context";
            contextMenu.controlParent  = properties.parent;
            contextMenu.title          = properties.title;
            contextMenu.setItems(properties.items);
            contextMenu.hide();
            this.addChild(contextMenu);
            this._contextMenus[properties.name] = contextMenu;
        }
        return contextMenu;
    }

    hasFloatingElements() {
        const isMenuFloating = !this._appPanel.isVisible() && Input.getFocusElement() && Input.getFocusElement().name === "MainMenu";
        return this._isContextMenuVisible || isMenuFloating;
    }

    onResize() {
        Layout.setLayout(this.width, this.height);

        this._menu.setSize(Layout.mainWidth, this._menu.height);
        let panelTop = this._menu.height;

        this._toggleButton.setPosition(1, panelTop + 1);

        if (this._appPanel.isVisible()) {
            this._appPanel.setSize(Layout.mainWidth, this._appPanel.height);
            this._appPanel.setPosition(Layout.mainLeft, panelTop);
            panelTop += this._appPanel.height;
        }

        this._controlPanel.setSize(Layout.mainWidth, Layout.controlPanelHeight);
        this._controlPanel.setPosition(Layout.mainLeft, panelTop);
        panelTop += this._controlPanel.height;

        let remaining = this.height - panelTop;
        if (this._pianoPanel.isVisible()) {
            this._pianoPanel.setSize(Layout.mainWidth, Layout.pianoHeight);
            this._pianoPanel.setPosition(Layout.mainLeft, this.height - this._pianoPanel.height);
            remaining -= this._pianoPanel.height;
        }

        this._patternPanel.setPosition(Layout.mainLeft, panelTop);
        this._patternPanel.setSize(Layout.mainWidth, remaining);

        if (Layout.showSideBar) {
            this._patternSidebar.show();
            this._patternSidebar.setDimensions({
                left:   Layout.col1X,
                top:    panelTop + Layout.infoPanelHeight + Layout.analyserHeight,
                width:  Layout.col1W,
                height: remaining - Layout.infoPanelHeight - Layout.analyserHeight - Layout.defaultMargin
            });
        } else {
            this._patternSidebar.setDimensions({
                left:   Layout.col32X,
                top:    this._appPanel.top,
                width:  Layout.col32W,
                height: this._appPanel.height
            });
            this._setMobileSideBar();
        }
    }


    _setMobileSideBar() {
        if (this._appPanel.getCurrentView() === "" && this._appPanel.getCurrentSubView() === "playlist") {
            this._patternSidebar.show();
        } else {
            this._patternSidebar.hide();
        }
    }
}
