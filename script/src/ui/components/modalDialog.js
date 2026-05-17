import UIElement from "./element.js";
import Scale9Panel from "./scale9.js";
import InputBox from "./inputbox.js";
import Assets from "../assets.js";
import UI from "../ui.js";
import Font from "../font.js";

export default class ModalDialog extends UIElement {
    _text = "";
    _ok = false;
    _cancel = false;
    _input = false;
    _inputValue = "";
    _background;
    _okButton;
    _cancelButton;
    _inputBox = null;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "modaldialog";

        this._background = new Scale9Panel(0, 0, Math.floor((w || 20) / 2), 200, Assets.panelMainScale9);
        this._background.ignoreEvents = true;
        this.addChild(this._background);

        this._okButton = Assets.generate("buttonLight");
        this._okButton.name   = "okbutton";
        this._okButton.label  = "OK";
        this._okButton.width  = 100;
        this._okButton.height = 28;
        this.addChild(this._okButton);

        this._cancelButton = Assets.generate("buttonLight");
        this._cancelButton.name   = "cancelbutton";
        this._cancelButton.label  = "Cancel";
        this._cancelButton.width  = 100;
        this._cancelButton.height = 28;
        this.addChild(this._cancelButton);
    }

    get text()        { return this._text; }
    set text(v)       { this._text = v; this.refresh(); }

    get ok()          { return this._ok; }
    set ok(v)         { this._ok = !!v; this._layout(); this.refresh(); }

    get cancel()      { return this._cancel; }
    set cancel(v)     { this._cancel = !!v; this._layout(); this.refresh(); }

    get input()       { return this._input; }
    set input(v)      { this._input = !!v; this._layout(); this.refresh(); }

    get inputValue()  { return this._inputValue; }

    setSize(w, h) {
        super.setSize(w, h);
        if (this._background) this._layout();
    }

    setText(newText) { this.text = newText; }
    getText()        { return this._text; }

    onKeyDown(keyCode) {
        if (keyCode === 13) { this.close(); return true; }
    }

    close() {
        this.hide();
        if (this.onClose) this.onClose();
        UI.removeModalElement();
    }

    render(internal) {
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            this.ctx.fillStyle = "rgba(0,0,0,0.6)";
            this.ctx.fillRect(0, 0, this.width, this.height);

            this._background.render();

            if (this._text) {
                const lines    = this._text.split("/");
                let textY      = this._background.top + 20;
                const maxWidth = this._background.width - 20;
                lines.forEach(line => {
                    let font = Font.ft;
                    if (line.startsWith("*")) { line = line.substr(1); font = Font.big; }
                    if (font) {
                        const textX = this._background.left + 10 + Math.floor((maxWidth - font.getTextWidth(line, 0)) / 2);
                        font.write(this.ctx, line, textX, textY, 0);
                    }
                    textY += 12;
                });
            }

            if (this._ok)     this._okButton.render();
            if (this._cancel) this._cancelButton.render();
            if (this._inputBox) this._inputBox.render();
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }

    _layout() {
        const panelHeight = Math.min(200, Math.max(20, this.height - 20));
        const panelWidth  = Math.max(Math.floor(this.width / 2), 380);

        this._background.setSize(panelWidth, panelHeight);
        this._background.setPosition(
            Math.floor((this.width - panelWidth) / 2),
            Math.floor((this.height - panelHeight) / 2)
        );

        if (this._cancel) {
            this._okButton.setPosition(this._background.left + Math.floor(this._background.width / 2) - 110, this._background.top + this._background.height - 40);
            this._cancelButton.setPosition(this._background.left + Math.floor(this._background.width / 2) + 10, this._background.top + this._background.height - 40);
        } else {
            this._okButton.setPosition(this._background.left + Math.floor(this._background.width / 2) - 50, this._background.top + this._background.height - 40);
        }

        if (this._input) {
            if (!this._inputBox) {
                this._inputBox = new InputBox(0, 0, 200, 28);
                this._inputBox.name     = "dialoginput";
                this._inputBox.onChange = () => { this._inputValue = this._inputBox.value; };
                this._inputBox.onSubmit = (value) => { this._inputValue = value; this.onKeyDown(13); };
                this.addChild(this._inputBox);
                setTimeout(() => this._inputBox.activate(), 0);
            }
            this._inputBox.setPosition(this._background.left + 50, this._background.top + this._background.height - 80);
            this._inputBox.setSize(this._background.width - 100, 28);
        }
    }
}
