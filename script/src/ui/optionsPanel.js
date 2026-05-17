import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Label from "./components/label.js";
import Assets from "./assets.js";
import {COMMAND, EVENT, SETTINGS, STEREOSEPARATION} from "../enum.js";
import EventBus from "../eventBus.js";
import Settings from "../settings.js";
import Audio from "../audio.js";
import Tracker from "../tracker.js";
import Checkboxbutton from "./components/checkboxbutton.js";
import UI from "./ui.js";
import Layout from "./app/layout.js";
import App from "../app.js";
import Midi from "../audio/midi.js";
import Font from "./font.js";

export default class OptionsPanel extends Panel {
    _background;
    _mainLabel;
    _closeButton;
    _options = [];

    constructor() {
        super(0, 0, 20, 20);
        this.hide();

        this._background = new Scale9Panel(0, 0, 20, 20, Assets.panelMainScale9);
        this._background.ignoreEvents = true;
        this.addChild(this._background);

        this._mainLabel = new Label(5, 9, 200, 18);
        this._mainLabel.label = "Options:";
        this._mainLabel.font  = Font.med;
        this.addChild(this._mainLabel);

        this._closeButton = Assets.generate("button20_20");
        this._closeButton.label   = "x";
        this._closeButton.tooltip = "Close";
        this._closeButton.onClick = () => { App.doCommand(COMMAND.showTopMain); };
        this.addChild(this._closeButton);

        const optionDefs = [
            {
                label: "VU bars",
                values: ["NONE", "COLOURS: AMIGA", "TRANSPARENT"],
                valueLabels: {
                    "COLOURS: AMIGA": [{width: 56, label: "AMIGA"}, {width: 110, label: "COLOURS: AMIGA"}]
                },
                setValue: index => {
                    SETTINGS.vubars = index === 0 ? "none" : index === 2 ? "trans" : "colour";
                    Settings.saveSettings();
                },
                getValue: () => {
                    if (SETTINGS.vubars === "none") return 0;
                    if (SETTINGS.vubars === "trans") return 2;
                    return 1;
                },
                checkBoxes: [{
                    label: "Show Help Bubbles",
                    labels: [{width: 60, label: "Help"}, {width: 100, label: "Show Help"}, {width: 150, label: "Show Help Bubbles"}],
                    getValue: () => SETTINGS.useTooltip,
                    handler: active => {
                        SETTINGS.useTooltip = active;
                        Settings.saveSettings();
                        EventBus.trigger(EVENT.menuLayoutChanged);
                    }
                }]
            },
            {
                label: "Stereo",
                values: ["Hard: Amiga", "Balanced", "None: mono"],
                setValue: index => {
                    if (index === 0)      Audio.setStereoSeparation(STEREOSEPARATION.FULL);
                    else if (index === 2) Audio.setStereoSeparation(STEREOSEPARATION.NONE);
                    else                  Audio.setStereoSeparation(STEREOSEPARATION.BALANCED);
                    Settings.saveSettings();
                },
                getValue: () => {
                    if (SETTINGS.stereoSeparation === STEREOSEPARATION.NONE) return 2;
                    if (SETTINGS.stereoSeparation === STEREOSEPARATION.FULL) return 0;
                    return 1;
                },
                checkBoxes: [{
                    label: "Show Key Input",
                    labels: [{width: 60, label: "Show"}, {width: 100, label: "Show Key"}, {width: 150, label: "Show Key Input"}],
                    getValue: () => SETTINGS.showKey,
                    handler: active => {
                        SETTINGS.showKey = active;
                        Settings.saveSettings();
                        EventBus.trigger(EVENT.menuLayoutChanged);
                    }
                }]
            },
            {
                label: "Screen refresh",
                labels: [{width: 56, label: "Screen"}, {width: 100, label: "Screen refresh"}],
                values: ["Smooth", "Normal", "Economical", "Low CPU"],
                setValue: index => {
                    UI.skipFrame(index);
                    Settings.saveSettings();
                },
                getValue: () => UI.getSkipFrame(),
                checkBoxes: [{
                    label: "Optimize High DPI",
                    labels: [{width: 60, label: "H-DPI"}, {width: 100, label: "High DPI"}, {width: 155, label: "Optimize High DPI"}],
                    getValue: () => SETTINGS.highDPI,
                    handler: active => {
                        SETTINGS.highDPI = active;
                        Settings.saveSettings();
                        UI.scaleToDevicePixelRatio(active);
                    }
                }]
            },
            {
                label: "Frequency table",
                labels: [{width: 56, label: "Frequency"}, {width: 110, label: "Frequency table"}],
                values: ["Linear", "Amiga periods"],
                valueLabels: {
                    "Amiga periods": [{width: 56, label: "AMIGA"}, {width: 110, label: "Amiga periods"}]
                },
                setValue: index => { Tracker.useLinearFrequency = (index === 0); },
                getValue: () => Tracker.useLinearFrequency ? 0 : 1
            },
            {
                label: "Dropbox: existing file",
                labels: [{width: 20, label: "Dropbox"}, {width: 80, label: "Dropbox save"}, {width: 160, label: "Dropbox existing file"}],
                values: ["Rename", "Overwrite"],
                setValue: index => {
                    SETTINGS.dropboxMode = index === 0 ? "rename" : "overwrite";
                    Settings.saveSettings();
                },
                getValue: () => SETTINGS.dropboxMode === "overwrite" ? 1 : 0
            },
            {
                label: "Midi-in",
                labels: [{width: 20, label: "Midi"}, {width: 80, label: "Midi-in"}],
                values: ["Disabled", "Enabled Note", "Enabled Note-Volume"],
                valueLabels: {
                    "Enabled Note":        [{width: 80, label: "Note"},        {width: 150, label: "Enabled Note"}],
                    "Enabled Note-Volume": [{width: 80, label: "Note-Volume"}, {width: 150, label: "Enabled Note-Volume"}]
                },
                setValue: index => {
                    if (index === 0)      { SETTINGS.midi = "disabled";     Midi.disable(); }
                    else if (index === 1) { SETTINGS.midi = "enabled-note"; Midi.enable();  }
                    else                  { SETTINGS.midi = "enabled";      Midi.enable();  }
                    Settings.saveSettings();
                },
                getValue: () => {
                    if (SETTINGS.midi === "enabled-note") return 1;
                    if (SETTINGS.midi === "enabled")      return 2;
                    return 0;
                },
                checkBoxes: [{
                    label: "Show Midi Input",
                    labels: [{width: 60, label: "Show"}, {width: 100, label: "Show Midi"}, {width: 150, label: "Show Midi Input"}],
                    getValue: () => SETTINGS.showMidi,
                    handler: active => {
                        SETTINGS.showMidi = active;
                        Settings.saveSettings();
                        EventBus.trigger(EVENT.menuLayoutChanged);
                    }
                }]
            },
            {
                label: "Play from",
                values: ["Pattern start", "Current pos"],
                setValue: index => {
                    SETTINGS.playFrom = index === 0 ? "start" : "cursor";
                    Settings.saveSettings();
                },
                getValue: () => SETTINGS.playFrom === "cursor" ? 1 : 0
            }
        ];

        optionDefs.forEach(optDef => {
            const labelBox = new Scale9Panel(0, 0, 20, 20, Assets.panelDarkGreyScale9);
            labelBox.ignoreEvents = true;
            this.addChild(labelBox);

            const label = new Label(0, 0, 20, 20);
            label.label     = optDef.label;
            label.font      = Font.small;
            label.textAlign = "center";
            if (optDef.labels) label.setLabels(optDef.labels);
            this.addChild(label);

            const option = {
                def:      optDef,
                labelBox,
                label,
                buttons:  []
            };

            optDef.values.forEach((value, i) => {
                const button = Assets.generate("buttonKey");
                if (optDef.valueLabels && optDef.valueLabels[value]) {
                    button.label = value;
                    button.setLabels(optDef.valueLabels[value]);
                } else {
                    button.label = value;
                }
                button.index  = i;
                button.option = option;
                button.onClick = function() {
                    if (this.isDisabled) return;
                    this.option.def.setValue(this.index);
                    this.option.buttons.forEach((b, bi) => { b.isActive = (bi === this.index); });
                };
                this.addChild(button);
                option.buttons.push(button);
            });

            if (optDef.checkBoxes) {
                const b  = optDef.checkBoxes[0];
                const cb = new Checkboxbutton({
                    background:       Assets.panelDarkInsetScale9,
                    hoverBackground:  Assets.panelInsetScale9,
                    activeBackground: Assets.panelDarkInsetScale9,
                    label:    b.label,
                    labels:   b.labels,
                    checkbox: true
                });
                cb.getValue = b.getValue;
                cb.onClick  = () => { b.handler(cb.isActive); };
                this.addChild(cb);
                option.checkBox = cb;
            }

            this._options.push(option);
        });

        this.on(EVENT.songPropertyChange, () => { if (this.isVisible()) this.onResize(); });
        this.on(EVENT.trackerModeChanged, () => {
                const freqOption = this._options[4];
                if (freqOption && freqOption.buttons.length) {
                    freqOption.buttons.forEach(b => { b.isDisabled = !Tracker.inFTMode(); });
                }
                const stereoOption = this._options[1];
                if (stereoOption && stereoOption.buttons.length) {
                    stereoOption.buttons.forEach(b => { b.isDisabled = Tracker.inFTMode(); });
                }
                if (this.isVisible()) this.onResize();
            });
    }

    onShow() { this.onResize(); }

    onResize() {
        if (!this.isVisible()) return;
        this.clearCanvas();

        this._background.setDimensions({left: 0, top: 0, width: this.width, height: this.height});

        const startTop    = 5;
        const buttonHeight = 20;

        this._closeButton.setDimensions({top: startTop, left: this.width - 30, width: 20, height: 20});

        let optionTops      = [27, 103];
        let optionHeight    = 20;
        let bHeight         = 20;
        let col             = 0;
        let row             = 0;
        let useMultipleRows = false;
        const maxVisible    = this._options.length;
        let maxCols         = this._options.length;

        if (this.width < 600) {
            useMultipleRows = true;
            optionTops      = [27, 103];
            optionHeight    = 18;
            bHeight         = 18;
            maxCols         = 4;
        }

        const bWidth = Math.floor((this.width - Layout.defaultMargin * (maxCols + 1)) / maxCols);

        this._options.forEach((option, index) => {
            const thisLeft = Layout.defaultMargin + (col * (bWidth + Layout.defaultMargin));
            const thisTop  = optionTops[row];

            option.labelBox.setDimensions({top: thisTop, width: bWidth, height: optionHeight, left: thisLeft});
            option.label.setDimensions({top: thisTop + 3, width: bWidth, height: optionHeight, left: thisLeft + 2});

            const selectedIndex = option.def.getValue();
            option.buttons.forEach((button, b) => {
                button.setDimensions({
                    top:    thisTop + (b * bHeight) + optionHeight,
                    height: bHeight,
                    width:  bWidth,
                    left:   thisLeft
                });
                button.isActive = (b === selectedIndex);
            });

            if (option.checkBox) {
                option.checkBox.setDimensions({
                    top:    this.height - bHeight - 7,
                    height: bHeight + 4,
                    width:  bWidth,
                    left:   thisLeft
                });
                option.checkBox.isActive = option.checkBox.getValue();
            }

            col++;
            if (useMultipleRows && col >= 4) { col = 0; row++; }
        });
    }

}
