import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import Assets from "../../assets.js";
import Label from "../../components/label.js";
import NumberDisplay from "../../components/numberdisplay.js";
import {EVENT} from "../../../enum.js";
import Font from "../../font.js";

export default class ButtonGroup extends Panel {
    _titleBar;
    _titleLabel;
    _buttons = [];

    constructor(title, buttonsInfo) {
        super(0, 0, 20, 20);
        this.hide();

        this._titleBar = new Scale9Panel(0, 0, 20, 20, Assets.panelDarkGreyScale9);
        this._titleBar.ignoreEvents = true;
        this.addChild(this._titleBar);

        this._titleLabel = new Label(0, 0, 60, 18);
        this._titleLabel.label = title;
        this._titleLabel.font  = Font.small;
        this._titleLabel.top   = 1;
        this.addChild(this._titleLabel);

        buttonsInfo.forEach(buttonInfo => {
            let button;
            if (buttonInfo.type === "number") {
                button = new NumberDisplay(0, 0, 40, 20);
                button.autoPadding = true;
                button.setValue(buttonInfo.value);
            } else {
                button = Assets.generate("buttonLight");
                button.label   = buttonInfo.label;
                button.onClick = buttonInfo.onClick;
            }
            button.widthParam = buttonInfo.width || 100;
            this.addChild(button);
            this._buttons.push(button);

            if (buttonInfo.onSamplePropertyChange) {
                this.on(EVENT.samplePropertyChange, newProps => {
                        buttonInfo.onSamplePropertyChange(button, newProps);
                    });
            }
        });
    }

    onResize() {
        this._titleBar.setSize(this.width, 18);

        let buttonTop  = 20;
        const buttonWidth = this.width;
        let left = 0;

        let numRows = 0, tmpLeft = 0;
        this._buttons.forEach(b => {
            tmpLeft += b.widthParam;
            if (tmpLeft > 95) { numRows++; tmpLeft = 0; }
        });
        if (tmpLeft > 0) numRows++;
        const buttonHeight = (this.height - buttonTop - 2) / Math.max(numRows, 1);

        this._buttons.forEach(button => {
            button.setPosition(Math.floor(left * buttonWidth / 100), buttonTop);
            button.setSize(Math.floor(buttonWidth * button.widthParam / 100), buttonHeight);
            left += button.widthParam;
            if (left > 95) {
                left = 0;
                buttonTop += buttonHeight;
            }
        });
    }

}
