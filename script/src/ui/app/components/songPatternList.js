import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import Assets from "../../assets.js";
import Listbox from "../../components/listbox.js";
import {EVENT} from "../../../enum.js";
import Tracker from "../../../tracker.js";
import Editor from "../../../editor.js";
import Ticker from "../../ticker.js";

export default class SongPatternList extends Panel {
    _songPanel;
    _songlistbox;
    _spPlus;
    _spMin;
    _spInsert;
    _spDelete;

    constructor(height) {
        super(0, 0, 20, height || 20);

        this._songPanel = new Scale9Panel(0, 0, 0, 0, Assets.panelInsetScale9);
        this.addChild(this._songPanel);

        this._songlistbox = new Listbox(0, 0, 20, 20);
        this._songlistbox.setItems([{label: "01:00", data: 1}]);
        this._songlistbox.onClick = () => {
            const item = this._songlistbox.getItemAtPosition(this._songlistbox.eventX, this._songlistbox.eventY);
            if (item) {
                const index = item.index;
                if (item !== this._songlistbox.getSelectedIndex()) {
                    this._songlistbox.setSelectedIndex(index);
                }
            }
        };
        this.addChild(this._songlistbox);

        this._spPlus = Assets.generate("button20_20");
        this._spPlus.label = "↑";
        this._spPlus.onDown = () => {
            const index = this._songlistbox.getSelectedIndex();
            let pattern = Tracker.getSong().patternTable[index];
            pattern++;
            Tracker.updatePatternTable(index, pattern);
            Ticker.onEachTick4(() => {
                const i = this._songlistbox.getSelectedIndex();
                let p = Tracker.getSong().patternTable[i];
                p++;
                Tracker.updatePatternTable(i, p);
            }, 5);
        };
        this._spPlus.onTouchUp = () => { Ticker.onEachTick4(); };
        this.addChild(this._spPlus);

        this._spMin = Assets.generate("button20_20");
        this._spMin.label = "↓";
        this._spMin.onDown = () => {
            const index = this._songlistbox.getSelectedIndex();
            let pattern = Tracker.getSong().patternTable[index];
            if (pattern > 0) pattern--;
            Tracker.updatePatternTable(index, pattern);
            Ticker.onEachTick4(() => {
                const i = this._songlistbox.getSelectedIndex();
                let p = Tracker.getSong().patternTable[i];
                if (p > 0) p--;
                Tracker.updatePatternTable(i, p);
            }, 5);
        };
        this._spMin.onTouchUp = () => { Ticker.onEachTick4(); };
        this.addChild(this._spMin);

        this._spInsert = Assets.generate("button20_20");
        this._spInsert.label = "Ins";
        this._spInsert.onDown = () => {
            const index = this._songlistbox.getSelectedIndex();
            Editor.addToPatternTable(index);
        };
        this._spInsert.setSize(40, 20);
        this.addChild(this._spInsert);

        this._spDelete = Assets.generate("button20_20");
        this._spDelete.label = "Del";
        this._spDelete.onDown = () => {
            const index = this._songlistbox.getSelectedIndex();
            Editor.removeFromPatternTable(index);
        };
        this._spDelete.setSize(40, 20);
        this.addChild(this._spDelete);

        this.on(EVENT.patternTableChange, () => {
                this.setPatternTable(Tracker.getSong().patternTable);
            });
        this.on(EVENT.songLoaded, song => {
                this.setPatternTable(song.patternTable);
            });
        this.on(EVENT.songPositionChange, value => {
                this._songlistbox.setSelectedIndex(value, true);
            });
    }

    onResize() {
        this._songPanel.setSize(this.width, this.height);

        this._songlistbox.setDimensions({
            left: 0,
            top: 0,
            width: this.width - 42,
            height: this.height
        });
        this._songlistbox.centerSelection = true;
        this._songlistbox.onChange = () => {
            Tracker.setCurrentSongPosition(this._songlistbox.getSelectedIndex(), true);
        };

        this._spMin.setPosition(this.width - 22, Math.floor(this.height / 2) - 10);
        this._spPlus.setPosition(this.width - 42, this._spMin.top);
        this._spInsert.setPosition(this._spPlus.left, this._spPlus.top - 22);
        this._spDelete.setPosition(this._spPlus.left, this._spPlus.top + 22);
    }

    setPatternTable(patternTable) {
        const items = [];
        for (let i = 0, len = Tracker.getSong().length; i < len; i++) {
            const value = patternTable[i];
            items.push({label: this._padd2(i + 1) + ":" + this._padd2(value), data: value, index: i});
        }
        this._songlistbox.setItems(items);
    }

    _padd2(s) {
        s = "" + s;
        if (s.length < 2) s = "0" + s;
        return s;
    }

}
