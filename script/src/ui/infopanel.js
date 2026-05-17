import UIElement from "./components/element.js";
import Assets from "./assets.js";
import Layout from "./app/layout.js";
import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import Animsprite from "./components/animsprite.js";
import Y from "./yascal/yascal.js";
import Button from "./components/button.js";
import Tracker from "../tracker.js";
import Favorites from "../models/favorites.js";
import UI from "./ui.js";
import ShareService from "../service/shareService.js";
import Input from "./input.js";
import Font from "./font.js";

export default class InfoPanel extends UIElement {
    _text = "";
    _source = "";
    _status = "";
    _moreInfoUrl = null;
    _canFavorite = false;
    _canShare = false;

    _infoButton;
    _fav;
    _share;
    _spinner;

    constructor() {
        super(0, 0, 20, 20);
        this.type = "infoPanel";

        this._infoButton = Assets.generate("buttonDark");
        this._infoButton.label = "More info ";
        this._infoButton.onClick = () => {
            if (this._moreInfoUrl) window.open(this._moreInfoUrl);
        };
        this.addChild(this._infoButton);

        this._fav = new Button(400, 6, 20, 20);
        this._fav.image       = Y.getImage("heart");
        this._fav.activeImage = Y.getImage("heart_active");
        this._fav.opacity     = 0.4;
        this._fav.hoverOpacity = 1;
        this._fav.onClick = () => { EventBus.trigger(EVENT.toggleFavorite); };
        this.addChild(this._fav);

        this._share = new Button(400, 6, 20, 20);
        this._share.name       = "share";
        this._share.image      = Y.getImage("share");
        this._share.activeImage = Y.getImage("heart_active");
        this._share.opacity    = 0.4;
        this._share.hoverOpacity = 1;
        this._share.tooltip    = "Share this Song";
        this._share.onDown     = () => this._toggleShareMenu();
        this.addChild(this._share);

        this._spinner = new Animsprite(5, 7, 20, 18, "boing", 11);
        this.addChild(this._spinner);
        this._spinner.hide();

        this.on(EVENT.statusChange, context => {
                if (context) {
                    if (typeof context.status !== "undefined") this._status = context.status;
                    if (typeof context.info !== "undefined") {
                        this._text = context.info;
                        this._source = context.source;
                        this._moreInfoUrl = context.url;
                        this.setLayout();
                    }
                    if (typeof context.showSpinner !== "undefined") {
                        this._spinner.toggle(!!context.showSpinner);
                    }
                }
                this.refresh();
            });
        this.on(EVENT.songLoaded, () => this._setFavorite());
        this.on(EVENT.favoritesUpdated, () => this._setFavorite());
    }

    _toggleShareMenu() {
        const focusElement = Input.getFocusElement();
        if (focusElement && focusElement.name === "ShareMenu") {
            this._hideShareMenu();
            return;
        }
        const items = [
            {label: "Facebook",  onClick: () => this._handleShare("facebook")},
            {label: "X",         onClick: () => this._handleShare("x")},
            {label: "Copy URL",  onClick: () => this._handleShare("copy")}
        ];
        if (ShareService.canShareNative()) {
            items.push({label: "More...", onClick: () => this._handleShare("native")});
        }
        UI.showContextMenu({
            name: "ShareMenu",
            title: "Share on",
            focus: true,
            layout: "list",
            parent: this._share,
            items,
            width: 120,
            x: this.left + this.parent.left + this._share.left - 120,
            y: this.top + this.parent.top + this._share.top
        });
    }

    _hideShareMenu() {
        UI.hideContextMenu();
        Input.clearFocusElement();
    }

    _handleShare(target) {
        this._hideShareMenu();
        ShareService.share(target, "mod");
    }

    _setFavorite() {
        const url = Tracker.getCurrentUrl();
        this._canFavorite = !!url;
        this._canShare    = this._canFavorite;
        if (this._canFavorite) {
            const isFavorite = Favorites.isFavorite(url);
            this._fav.isActive = isFavorite;
            this._fav.tooltip  = isFavorite ? "Remove from favorites" : "Add to favorites";
        }
        this.setLayout();
    }

    setLayout() {
        let width = Layout.col1W;
        let label = "More Info";
        if (width < 100) label = "info";
        if (width < 45)  label = "i";

        this._infoButton.setDimensions({
            width:  Layout.col1W,
            height: 24,
            top:    2,
            left:   Layout.col5X - 2 - this.left
        });
        this._infoButton.label = label;
        this._infoButton.font  = Font.ft;

        this._fav.setPosition(
            this._moreInfoUrl ? Layout.col5X - this.left - 22 : Layout.col5W - this.left - 22,
            this._fav.top
        );
        this._share.setPosition(this._fav.left - 22, this._share.top);
    }


    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;

        if (this.needsRendering) {
            this.clearCanvas();

            if (this._moreInfoUrl) this._infoButton.render();
            if (this._canFavorite)  this._fav.render();
            if (this._canShare)     this._share.render();

            let fText = this._text;
            if (this._status) fText = this._status + ": " + fText;

            let textX = 6;
            if (!Layout.showSideBar) textX += 14;

            if (this._spinner.isVisible()) {
                this._spinner.setPosition(textX - 1, 7);
                this._spinner.render();
                textX += 20;
            } else {
                if (fText.startsWith("Error")) {
                    this.ctx.drawImage(Y.getImage("alert"), 4, 8);
                    textX += 20;
                }
            }

            Font.ft.write(this.ctx, fText, textX, 11, 0);
        }

        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
