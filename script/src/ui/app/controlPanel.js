import PanelContainer from "./panelContainer.js";
import SongControl from "./components/songControl.js";
import Checkboxbutton from "../components/checkboxbutton.js";
import Assets from "../assets.js";
import Button from "../components/button.js";
import Label from "../components/label.js";
import SpinBox from "../spinBox.js";
import Layout from "./layout.js";
import EventBus from "../../eventBus.js";
import {COMMAND, EVENT, TRACKERMODE} from "../../enum.js";
import Tracker from "../../tracker.js";
import Y from "../yascal/yascal.js";
import Font from "../font.js";

export default class ControlPanel extends PanelContainer {
    _songControl;
    _buttonFileOperations;
    _buttonOptions;
    _buttonSampleEdit;
    _modButton;
    _xmButton;
    _trackView = [4, 8, 12, 16];
    _trackButtons = [];
    _viewColumnsButton;
    _viewRowsButton;
    _labelTrackerMode;
    _labelTrackView;
    _trackCountSpinbox;

    constructor() {
        super(40);

        this._songControl = new SongControl();
        this.addChild(this._songControl);

        this._buttonFileOperations = new Checkboxbutton({
            label: "File",
            onDown: function() {
                const view = this.isActive ? "diskop_load" : "topmain";
                EventBus.trigger(EVENT.showView, view);
            }
        });
        this._buttonFileOperations.tooltip = "Load/Save Files";

        this._buttonOptions = new Checkboxbutton({
            label: "Options",
            onDown: function() {
                const view = this.isActive ? "options" : "topmain";
                EventBus.trigger(EVENT.showView, view);
            }
        });
        this._buttonOptions.tooltip = "show App Settings";

        this._buttonSampleEdit = new Checkboxbutton({
            label: "Sample Edit",
            onDown: function() {
                if (this.isActive) {
                    EventBus.trigger(EVENT.command, COMMAND.showSampleEditor);
                } else {
                    EventBus.trigger(EVENT.showView, "bottommain");
                }
            }
        });
        this._buttonSampleEdit.tooltip = "Show Sample Editor";

        this.addChild(this._buttonFileOperations);
        this.addChild(this._buttonOptions);
        this.addChild(this._buttonSampleEdit);

        const buttonProperties = {
            background:       Assets.buttonKeyScale9,
            hoverBackground:  Assets.buttonKeyHoverScale9,
            activeBackground: Assets.buttonKeyActiveScale9,
            textAlign:        "center",
            font:             Font.dark,
            paddingTopActive: 1
        };

        this._modButton = new Button();
        this._modButton.background       = buttonProperties.background;
        this._modButton.hoverBackground  = buttonProperties.hoverBackground;
        this._modButton.activeBackground = buttonProperties.activeBackground;
        this._modButton.textAlign        = buttonProperties.textAlign;
        this._modButton.font             = buttonProperties.font;
        this._modButton.paddingTopActive = buttonProperties.paddingTopActive;
        this._modButton.label            = "mod";
        this._modButton.tooltip          = "Protracker Mode";
        this._modButton.onDown = () => { Tracker.setTrackerMode(TRACKERMODE.PROTRACKER); };
        this.addChild(this._modButton);

        this._xmButton = new Button();
        this._xmButton.background       = buttonProperties.background;
        this._xmButton.hoverBackground  = buttonProperties.hoverBackground;
        this._xmButton.activeBackground = buttonProperties.activeBackground;
        this._xmButton.textAlign        = buttonProperties.textAlign;
        this._xmButton.font             = buttonProperties.font;
        this._xmButton.paddingTopActive = buttonProperties.paddingTopActive;
        this._xmButton.label            = "XM";
        this._xmButton.tooltip          = "Fasttracker 2 Mode";
        this._xmButton.onDown = () => { Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER); };
        this.addChild(this._xmButton);

        this._trackView.forEach(() => {
            const button = new Button();
            button.background       = buttonProperties.background;
            button.hoverBackground  = buttonProperties.hoverBackground;
            button.activeBackground = buttonProperties.activeBackground;
            button.textAlign        = buttonProperties.textAlign;
            button.font             = buttonProperties.font;
            button.paddingTopActive = buttonProperties.paddingTopActive;
            this._trackButtons.push(button);
            this.addChild(button);
        });
        this._trackButtons.forEach((button, index) => {
            button.label   = "" + this._trackView[index];
            button.tooltip = "Show " + this._trackView[index] + " tracks";
            button.index   = index;
            button.onDown = () => {
                if (button.isDisabled) return;
                const activeIndex = button.index;
                this._trackButtons.forEach((b, i) => { b.isActive = (i === activeIndex); });
                Layout.setVisibleTracks(this._trackView[activeIndex]);
            };
        });

        this._viewColumnsButton = new Button();
        this._viewColumnsButton.background       = buttonProperties.background;
        this._viewColumnsButton.hoverBackground  = buttonProperties.hoverBackground;
        this._viewColumnsButton.activeBackground = buttonProperties.activeBackground;
        this._viewColumnsButton.textAlign        = buttonProperties.textAlign;
        this._viewColumnsButton.font             = buttonProperties.font;
        this._viewColumnsButton.paddingTopActive = buttonProperties.paddingTopActive;
        this._viewColumnsButton.tooltip          = "Column view";
        this._viewColumnsButton.isActive         = true;
        this._viewColumnsButton.onDown = () => {
            this._viewColumnsButton.isActive = true;
            this._viewRowsButton.isActive    = false;
            EventBus.trigger(EVENT.showView, "main");
        };
        this._viewColumnsButton.renderInternal = function() {
            const ctx    = this.ctx;
            ctx.globalAlpha = 1;
            ctx.fillStyle   = "rgba(60, 40, 20, 0.85)";
            const lineW = 2, gap = 4;
            const totalW  = 4 * lineW + 3 * gap;
            const startX  = Math.floor((this.width - totalW) / 2);
            const startY  = Math.floor(this.height * 0.2);
            const lineH   = Math.floor(this.height * 0.6);
            for (let i = 0; i < 4; i++) ctx.fillRect(startX + i * (lineW + gap), startY, lineW, lineH);
        };
        this.addChild(this._viewColumnsButton);

        this._viewRowsButton = new Button();
        this._viewRowsButton.background       = buttonProperties.background;
        this._viewRowsButton.hoverBackground  = buttonProperties.hoverBackground;
        this._viewRowsButton.activeBackground = buttonProperties.activeBackground;
        this._viewRowsButton.textAlign        = buttonProperties.textAlign;
        this._viewRowsButton.font             = buttonProperties.font;
        this._viewRowsButton.paddingTopActive = buttonProperties.paddingTopActive;
        this._viewRowsButton.tooltip          = "Row view";
        this._viewRowsButton.onDown = () => {
            this._viewRowsButton.isActive    = true;
            this._viewColumnsButton.isActive = false;
            EventBus.trigger(EVENT.showView, "multitrack");
        };
        this._viewRowsButton.renderInternal = function() {
            const ctx    = this.ctx;
            ctx.globalAlpha = 1;
            ctx.fillStyle   = "rgba(60, 40, 20, 0.85)";
            const lineH = 2, gap = 4;
            const totalH  = 4 * lineH + 3 * gap;
            const startY  = Math.floor((this.height - totalH) / 2);
            const startX  = Math.floor(this.width * 0.2);
            const lineW   = Math.floor(this.width * 0.6);
            for (let i = 0; i < 4; i++) ctx.fillRect(startX, startY + i * (lineH + gap), lineW, lineH);
        };
        this.addChild(this._viewRowsButton);

        this._labelTrackerMode = new Label(0, 0, 100, 20);
        this._labelTrackerMode.label     = "Mode";
        this._labelTrackerMode.font      = Font.small;
        this._labelTrackerMode.textAlign = "right";
        this._labelTrackerMode.setLabels([
            {width: 20, label: ""},
            {width: 78, label: "M"},
            {width: 84, label: "Md"},
            {width: 100, label: "Mode"}
        ]);
        this._labelTrackerMode.ignoreEvents = true;
        this.addChild(this._labelTrackerMode);

        this._labelTrackView = new Label(0, 0, 100, 20);
        this._labelTrackView.label     = "Display";
        this._labelTrackView.font      = Font.small;
        this._labelTrackView.textAlign = "right";
        this._labelTrackView.setLabels([
            {width: 10, label: ""},
            {width: 78, label: "t"},
            {width: 84, label: "tr"},
            {width: 100, label: "trck"},
            {width: 120, label: "Display"}
        ]);
        this._labelTrackView.ignoreEvents = true;
        this.addChild(this._labelTrackView);

        this._trackCountSpinbox = new SpinBox();
        this._trackCountSpinbox.name        = "Pattern";
        this._trackCountSpinbox.setValue(Tracker.getTrackCount(), true);
        this._trackCountSpinbox.max         = 32;
        this._trackCountSpinbox.min         = 2;
        this._trackCountSpinbox.size        = "big";
        this._trackCountSpinbox.padLength   = 2;
        this._trackCountSpinbox.trackUndo   = true;
        this._trackCountSpinbox.undoLabel   = "Change Track count";
        this._trackCountSpinbox.onChange    = value => { Tracker.setTrackCount(value); };
        this.addChild(this._trackCountSpinbox);

        this.on(EVENT.showView, view => {
                switch (view) {
                    case "diskop_load": case "diskop_save":
                    case "diskop_samples_load": case "diskop_modules_load":
                    case "diskop_samples_save": case "diskop_modules_save":
                        this._buttonFileOperations.isActive = true;
                        this._buttonOptions.isActive        = false;
                        break;
                    case "options":
                        this._buttonFileOperations.isActive = false;
                        this._buttonOptions.isActive        = true;
                        break;
                    case "topmain":
                        this._buttonFileOperations.isActive = false;
                        this._buttonOptions.isActive        = false;
                        break;
                    case "main":
                        this._buttonFileOperations.isActive = false;
                        this._buttonOptions.isActive        = false;
                        this._buttonSampleEdit.isActive     = false;
                        this._viewColumnsButton.isActive    = true;
                        this._viewRowsButton.isActive       = false;
                        break;
                    case "multitrack":
                        this._buttonFileOperations.isActive = false;
                        this._buttonOptions.isActive        = false;
                        this._buttonSampleEdit.isActive     = false;
                        this._viewColumnsButton.isActive    = false;
                        this._viewRowsButton.isActive       = true;
                        break;
                    case "bottommain":
                        this._buttonSampleEdit.isActive = false;
                        break;
                    case "sample":
                        this._buttonSampleEdit.isActive = true;
                        break;
                }
            });
        this.on(EVENT.trackerModeChanged, mode => {
                this._modButton.isActive = (mode === TRACKERMODE.PROTRACKER);
                this._xmButton.isActive  = (mode === TRACKERMODE.FASTTRACKER);
                Layout.setLayout();
            });
        this.on(EVENT.trackCountChange, count => {
                this._trackCountSpinbox.setValue(count, true);
            });
        this.on(EVENT.songLoaded, song => {
                let targetChannels = song.channels;
                if (targetChannels > 12 && targetChannels < 16) targetChannels = 16;
                if (targetChannels > 8  && targetChannels < 12) targetChannels = 12;
                if (targetChannels > 4  && targetChannels < 8)  targetChannels = 8;
                targetChannels = Math.min(targetChannels, Layout.maxVisibleTracks);
                Layout.setVisibleTracks(targetChannels);
                this.onPanelResize();
            });

        this.onPanelResize();
    }

    onPanelResize() {
        this.innerHeight = this.height - (Layout.defaultMargin * 2);
        let row1Top = Layout.defaultMargin;
        let row2Top = Layout.defaultMargin;

        if (Layout.controlPanelButtonLayout === "2row") {
            const halfHeight = Math.floor((this.innerHeight - Layout.defaultMargin) / 2);
            row2Top          = this.height - halfHeight - Layout.defaultMargin;
            this.innerHeight = halfHeight;
        }

        this._songControl.setDimensions({
            left:  Layout.col1X,
            top:   row1Top,
            width: Layout.songControlWidth,
            height: this.innerHeight,
        });
        this._songControl.songPatternSelector = "small";

        const buttonWidth       = Math.floor(Layout.controlPanelButtonsWidth / 3);
        const buttonMargin      = 0;
        const buttonSampleLeft  = Layout.controlPanelButtonsLeft + buttonWidth * 2;
        const buttonSampleLabel = Layout.controlPanelButtonLayout === "1row" ? "Sample Edit" : "Sample";
        const buttonHeight      = this.innerHeight;

        this._buttonFileOperations.setDimensions({
            left:   Layout.controlPanelButtonsLeft + buttonMargin * 1.5,
            top:    row2Top,
            width:  buttonWidth,
            height: buttonHeight
        });
        this._buttonOptions.setDimensions({
            left:   this._buttonFileOperations.left + buttonWidth + buttonMargin,
            top:    row2Top,
            width:  buttonWidth,
            height: buttonHeight
        });
        this._buttonSampleEdit.setDimensions({
            left:   buttonSampleLeft,
            top:    row2Top,
            width:  buttonWidth,
            height: buttonHeight
        });
        this._buttonSampleEdit.label = buttonSampleLabel;

        const marginLeft = Math.max(0, Layout.modeButtonsWidth - 167);
        this._modButton.setDimensions({
            left:   Layout.modeButtonsLeft + marginLeft,
            top:    row1Top,
            width:  51,
            height: 16
        });
        this._xmButton.setDimensions({
            left:   this._modButton.left + this._modButton.width - 1,
            top:    this._modButton.top,
            width:  this._modButton.width,
            height: this._modButton.height
        });

        let bLeft = this._modButton.left;
        this._trackButtons.forEach((button, index) => {
            button.setDimensions({
                left:   bLeft,
                top:    this._modButton.top + this._modButton.height,
                width:  26,
                height: this._modButton.height
            });
            bLeft += button.width - 1;
            button.isActive  = this._trackView[index] === Layout.visibleTracks;
            button.isDisabled = this._trackView[index] > Layout.maxVisibleTracks;
        });

        const btnSize = this._modButton.height * 2;
        this._viewColumnsButton.setDimensions({
            left:   bLeft + 4,
            top:    row1Top,
            width:  btnSize,
            height: btnSize
        });
        bLeft += 4 + btnSize - 1;

        this._viewRowsButton.setDimensions({
            left:   bLeft,
            top:    row1Top,
            width:  btnSize,
            height: btnSize
        });

        this._labelTrackerMode.setDimensions({
            left:   Layout.modeButtonsLeft  + Layout.TrackCountSpinboxWidth,
            top:    row1Top + 1,
            width:  Math.max(0, Layout.modeButtonsWidth - 160 - Layout.TrackCountSpinboxWidth),
            height: 20
        });
        this._labelTrackView.setDimensions({
            left:   this._labelTrackerMode.left,
            top:    this._labelTrackerMode.top + this._modButton.height,
            width:  this._labelTrackerMode.width,
            height: this._labelTrackerMode.height
        });

        this._trackCountSpinbox.setDimensions({
            left:   Math.min(Layout.modeButtonsLeft),
            top:    row1Top,
            width:  Layout.TrackCountSpinboxWidth,
            height: this.innerHeight
        });
    }

    renderInternal() {
        if (Layout.controlPanelButtonLayout === "2row") return;

        this.ctx.drawImage(Y.getImage("line_ver"), Layout.controlPanelButtonsLeft - 2, 0, 2, this.height - 1);
        this.ctx.drawImage(Y.getImage("line_ver"), Layout.modeButtonsLeft - 2, 0, 2, this.height - 1);

        if (Layout.controlPanelButtonLayout === "condensed") return;

        this._buttonFileOperations.render();
        this._buttonOptions.render();
        this._buttonSampleEdit.render();
    }
}
