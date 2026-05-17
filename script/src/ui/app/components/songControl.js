import UIElement from "../../components/element.js";
import RadioGroup from "../../components/radiogroup.js";
import Assets from "../../assets.js";
import {EVENT, PLAYTYPE} from "../../../enum.js";
import Tracker from "../../../tracker.js";
import Y from "../../yascal/yascal.js";

export default class SongControl extends UIElement {
    _radioGroup;
    _buttons = {};
    songPatternSelector = null;

    constructor(x, y, w, h) {
        super(x || 0, y || 0, w || 20, h || 20);
        this.type = "songControl";

        this._radioGroup = new RadioGroup(0, 0, 20, 20);
        this._radioGroup.setItems([
            { label: "song", active: true },
            {
                label: "pattern",
                labels: [{width: 10, label: "p"}, {width: 20, label: "pat"}],
                active: false
            }
        ]);
        this._radioGroup.onChange = selectedIndex => {
            if (selectedIndex === 0) {
                Tracker.setPlayType(PLAYTYPE.song);
            } else {
                Tracker.setPlayType(PLAYTYPE.pattern);
            }
        };
        this._radioGroup.tooltip = "Toggle between playing the song or the pattern";
        this.addChild(this._radioGroup);

        this._buttons.play = Assets.generate("buttonDarkGreen");
        this._buttons.play.image            = Y.getImage("play_green");
        this._buttons.play.hoverImage       = Y.getImage("play_green_hover");
        this._buttons.play.activeImage      = Y.getImage("play_active_red");
        this._buttons.play.activeBackground = Assets.buttonDarkRedActiveScale9;
        this._buttons.play.name             = "buttonPlay";
        this._buttons.play.tooltip          = "Toggle Play [ENTER]";
        this._buttons.play.onClick = () => {
            this._buttons.play.toggleActive();
            if (Tracker.isPlaying()) {
                Tracker.stop();
            } else {
                if (Tracker.getPlayType() === PLAYTYPE.song) {
                    Tracker.playSong();
                } else {
                    Tracker.playPattern();
                }
            }
        };
        this.addChild(this._buttons.play);

        this._buttons.record = Assets.generate("buttonDarkRed");
        this._buttons.record.image      = Y.getImage("record");
        this._buttons.record.hoverImage = Y.getImage("record_hover");
        this._buttons.record.activeImage = Y.getImage("record_active");
        this._buttons.record.name        = "buttonRecord";
        this._buttons.record.tooltip     = "Toggle Edit Mode [SPACE]";
        this._buttons.record.onClick     = () => { Tracker.toggleRecord(); };
        this.addChild(this._buttons.record);

        this._buttons.song = Assets.generate("buttonDark");
        this._buttons.song.label   = "Song";
        this._buttons.song.onClick = () => { Tracker.playSong(); };
        this.addChild(this._buttons.song);

        this._buttons.pattern = Assets.generate("buttonDark");
        this._buttons.pattern.label   = "Pattern";
        this._buttons.pattern.onClick = () => { Tracker.playPattern(); };
        this.addChild(this._buttons.pattern);

        this.on(EVENT.recordingChange, isRecording => { this._buttons.record.isActive = isRecording; });
        this.on(EVENT.playingChange, isPlaying => { this._buttons.play.isActive = isPlaying; });
        this.on(EVENT.playTypeChange, playType => {
                this._radioGroup.setSelectedIndex(playType === PLAYTYPE.song ? 0 : 1, true);
            });
    }

    onResize() {
        let buttonWidth = Math.floor(this.width / 3);

        this._radioGroup.setDimensions({left: 0, top: 0, width: buttonWidth, height: this.height});
        this._radioGroup.align = "right";
        this._buttons.play.setDimensions({left: buttonWidth, top: 0, width: buttonWidth, height: this.height});
        this._buttons.record.setDimensions({left: buttonWidth * 2, top: 0, width: buttonWidth, height: this.height});

        if (this.songPatternSelector === "big") {
            this._radioGroup.left = -500;
            buttonWidth = Math.floor(this.width / 4) + 1;

            this._buttons.play.setDimensions({left: 0, top: 0, width: buttonWidth, height: this.height});
            this._buttons.record.setDimensions({left: buttonWidth, top: 0, width: buttonWidth, height: this.height});
            this._buttons.song.setDimensions({left: buttonWidth * 2, top: 0, width: buttonWidth, height: this.height});
            this._buttons.pattern.setDimensions({left: buttonWidth * 3, top: 0, width: buttonWidth, height: this.height});
        }
    }


    render(internal) {
        internal = !!internal;
        if (this.needsRendering) {
            this.clearCanvas();
            if (this.songPatternSelector === "small") this._radioGroup.render();
            this._buttons.play.render();
            this._buttons.record.render();
            if (this.songPatternSelector === "big") {
                this._buttons.song.render();
                this._buttons.pattern.render();
            }
        }
        this.needsRendering = false;
        if (internal) return this.canvas;
        this.parentCtx.drawImage(this.canvas, this.left, this.top, this.width, this.height);
    }
}
