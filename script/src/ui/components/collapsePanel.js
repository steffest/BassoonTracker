import Panel from "./panel.js";
import Scale9Panel from "./scale9.js";
import Assets from "../assets.js";
import Font from "../font.js";

export default class CollapsePanel extends Panel {
    _label = "";
    _background;

    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.type = "collapsepanel";

        this._background = new Scale9Panel(0, 0, w || 20, h || 20, Assets.buttonDarkBlueScale9);
        this._background.ignoreEvents = true;
        this.addChild(this._background);

        this.renderInternal = () => {
            const font = Font.ft;
            if (this._label && font) {
                font.write(this.ctx, this._label, 8, Math.floor(this.height / 2) - 4, 0);
            }
        };
    }

    get label()  { return this._label; }
    set label(v) { this._label = v; this.refresh(); }

    setSize(w, h) {
        super.setSize(w, h);
        if (this._background) this._background.setSize(w, h);
    }
}
