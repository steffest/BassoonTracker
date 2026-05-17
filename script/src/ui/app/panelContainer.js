import Panel from '../components/panel.js';
import Scale9Panel from '../components/scale9.js';
import Assets from "../assets.js";
import UI from "../ui.js";

export default class PanelContainer extends Panel {
    _background;

    constructor(height) {
        const canvas = UI.getCanvas();
        super(0, 0, canvas.width, height);
        this._background = new Scale9Panel(0, 0, this.width, this.height, Assets.panelMainScale9);
        this._background.ignoreEvents = true;
        this.addChild(this._background);
    }

    onResize() {
        this._background.setSize(this.width, this.height);
        if (this.onPanelResize) this.onPanelResize();
    }
}
