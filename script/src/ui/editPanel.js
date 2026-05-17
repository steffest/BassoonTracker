import UIElement from "./components/element.js";
import Assets from "./assets.js";
import Editor from "../editor.js";
import UI from "./ui.js";
import Font from "./font.js";

export default class EditPanel extends UIElement {
    _buttonsPattern = [];

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "EditPanel";

        for (let i = 0; i < 6; i++) {
            const button = Assets.generate("buttonDark");
            button.index = i;
            button.onClick = function() { this._panel._handleButton(this); };
            button.onClick = () => this._handleButton(button);
            button.font = Font.small;
            button.textAlign = "center";
            button.paddingTop = 1;
            const labels = ["clear", "copy", "paste"];
            button.label = labels[Math.floor(i / 2)];
            const toolTips = [
                "Clear the current track",
                "Copy the current track",
                "Paste the current track",
                "Clear the current pattern",
                "Copy the current pattern",
                "Paste the current pattern"
            ];
            button.tooltip = toolTips[i];
            this.addChild(button);
            this._buttonsPattern.push(button);
        }
    }

    _handleButton(button) {
        switch (button.index) {
            case 0: Editor.clearTrack();   UI.setStatus("Track cleared");   break;
            case 1: Editor.clearPattern(); UI.setStatus("Pattern cleared"); break;
            case 2: Editor.copyTrack();    UI.setStatus("Track copied");    break;
            case 3: Editor.copyPattern();  UI.setStatus("Pattern copied");  break;
            case 4: UI.setStatus(Editor.pasteTrack()   ? "Track pasted"   : "Nothing to paste!"); break;
            case 5: UI.setStatus(Editor.pastePattern() ? "Pattern pasted" : "Nothing to paste!"); break;
        }
    }

    onResize() {
        const buttonWidth  = Math.floor(this.width / 2) - 2;
        const buttonHeight = 21;
        for (let i = 0; i < 6; i++) {
            const side = i % 2;
            const row  = Math.floor(i / 2);
            this._buttonsPattern[i].setPosition(side * buttonWidth + 2, 25 + row * buttonHeight);
            this._buttonsPattern[i].setSize(buttonWidth, buttonHeight);
        }
    }

    render(internal) {
        internal = !!internal;
        if (this.needsRendering) {
            if (!this.isVisible()) return;
            this.clearCanvas();

            Font.med.write(this.ctx, "↓Track",   6, 11, 0);
            Font.med.write(this.ctx, "↓Pattern", this._buttonsPattern[1].left + 6, 11, 0);

            for (let i = 0; i < 6; i++) this._buttonsPattern[i].render();
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
