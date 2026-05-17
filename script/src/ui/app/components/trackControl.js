import UIElement from "../../components/element.js";
import Assets from "../../assets.js";
import EventBus from "../../../eventBus.js";
import {EVENT} from "../../../enum.js";
import Y from "../../yascal/yascal.js";

export default class TrackControl extends UIElement {
    _font  = null;
    _label = "";
    _buttons = {};

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type  = "trackControl";
        this.track = 0;

        this._buttons.solo = Assets.generate("buttonDark");
        this._buttons.solo.activeImage      = Y.getImage("solo");
        this._buttons.solo.activeBackground = Assets.buttonDarkGreenActiveScale9;
        this._buttons.solo.name             = "buttonSolo";
        this._buttons.solo.label            = "S";
        this._buttons.solo.tooltip          = "Solo Track";
        this._buttons.solo.onClick = () => {
            const wasSolo = this._buttons.solo.isActive;
            this._buttons.solo.toggleActive();
            if (this._buttons.mute.isActive) this._buttons.mute.toggleActive();
            this._triggerChangeEvent(wasSolo);
        };
        this.addChild(this._buttons.solo);

        this._buttons.mute = Assets.generate("buttonDark");
        this._buttons.mute.activeImage      = Y.getImage("mute");
        this._buttons.mute.activeBackground = Assets.buttonDarkRedActiveScale9;
        this._buttons.mute.name             = "buttonMute";
        this._buttons.mute.label            = "M";
        this._buttons.mute.tooltip          = "Mute Track";
        this._buttons.mute.onClick = () => {
            this._buttons.mute.toggleActive();
            if (this._buttons.solo.isActive) this._buttons.solo.toggleActive();
            this._triggerChangeEvent();
        };
        this.addChild(this._buttons.mute);

        this._buttons.fx = Assets.generate("buttonDark");
        this._buttons.fx.name    = "buttonFX";
        this._buttons.fx.label   = "FX";
        this._buttons.fx.tooltip = "Show FX Panel";
        this._buttons.fx.onClick = () => {
            this._buttons.fx.toggleActive();
            EventBus.trigger(EVENT.fxPanelToggle, this.track);
        };
        this.addChild(this._buttons.fx);

        this.on(EVENT.trackScopeClick, track => {
                if (track === this.track) this._buttons.mute.onClick();
            });
    }

    setSolo(isSolo, silent) {
        let changed = false;
        if (isSolo && this._buttons.mute.isActive) { this._buttons.mute.isActive = false; changed = true; }
        if (this._buttons.solo.isActive !== isSolo) { this._buttons.solo.isActive = isSolo; changed = true; }
        if (changed && !silent) this._triggerChangeEvent();
    }

    setMute(isMute, silent) {
        let changed = false;
        if (isMute && this._buttons.solo.isActive) { this._buttons.solo.isActive = false; changed = true; }
        if (this._buttons.mute.isActive !== isMute) { this._buttons.mute.isActive = isMute; changed = true; }
        if (changed && !silent) this._triggerChangeEvent();
    }

    onResize() {
        const buttonWidth = Math.floor(this.width / 3) + 1;
        this._buttons.solo.setPosition(0, 0);
        this._buttons.solo.setSize(buttonWidth, this.height);
        this._buttons.mute.setPosition(buttonWidth - 1, 0);
        this._buttons.mute.setSize(buttonWidth, this.height);
        this._buttons.fx.setPosition(buttonWidth * 2 - 2, 0);
        this._buttons.fx.setSize(buttonWidth, this.height);
    }

    _triggerChangeEvent(wasSolo) {
        EventBus.trigger(EVENT.trackStateChange, {
            track:  this.track,
            solo:   this._buttons.solo.isActive,
            mute:   this._buttons.mute.isActive,
            wasSolo
        });
    }


    render(internal) {
        if (!this.isVisible()) return;
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this._font) {
                this._font.write(this.ctx, this._label.toUpperCase(), 6, 11, 0);
            } else {
                this.ctx.fillStyle = "white";
                this.ctx.fillText(this._label, 10, 10);
            }
            this._buttons.solo.render();
            this._buttons.mute.render();
            this._buttons.fx.render();
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
