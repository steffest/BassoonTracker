import UI from "../ui.js";
import PanelContainer from "./panelContainer.js";
import SongPatternList from "../app/components/songPatternList.js";
import Button from "../components/button.js";
import Assets from "../assets.js";
import Y from "../yascal/yascal.js";
import InputBox from "../components/inputbox.js";
import Listbox from "../components/listbox.js";
import Scale9Panel from "../components/scale9.js";
import SpinBox from "../spinBox.js";
import DiskOperations from "../diskOperations.js";
import OptionsPanel from "../optionsPanel.js";
import Layout from "./layout.js";
import EventBus from "../../eventBus.js";
import {COMMAND, EVENT, TRACKERMODE} from "../../enum.js";
import Tracker from "../../tracker.js";
import Input from "../input.js";
import Editor from "../../editor.js";
import RadioGroup from "../components/radiogroup.js";
import Panel from "../components/panel.js";
import UIImage from "../components/image.js";
import Font from "../font.js";

export default class AppMainPanel extends PanelContainer {
    _currentView    = "";
    _currentSubView = "";
    _radioGroup     = null;
    _customPanel    = null;

    _logo;
    _corner;
    _tracker;
    _modNameInputBox;
    _listbox;
    _songlistbox;
    _patternPanel;
    _patternPanel2;
    _spinBoxPattern;
    _spinBoxInstrument;
    _spinBoxSongLength;
    _spinBoxSongRepeat;
    _spinBoxPatternLength;
    _spinBoxBpm;
    _diskOperations;
    _optionsPanel;

    constructor() {
        super(160);

        const spinbBoxFont = Font.ft;

        this._logo = new Button();
        this._logo.background       = Assets.panelInsetScale9;
        this._logo.activeBackground = Assets.buttonDarkScale9;
        this._logo.image            = Y.getImage("logo_grey_70");
        this._logo.activeImage      = Y.getImage("logo_colour_70");
        this._logo.onDown = () => { this._logo.toggleActive(); };
        this.addChild(this._logo);

        this._corner = new UIImage(1, 1, 22, 19, "togglecorner");
        this.addChild(this._corner);

        this._tracker = new Button();
        this._tracker.background       = Assets.panelInsetScale9;
        this._tracker.activeBackground = Assets.panelInsetScale9;
        this._tracker.image            = Y.getImage("tracker");
        this._tracker.activeImage      = this._buildSteffestVersion();
        this._tracker.onDown = () => { this._tracker.toggleActive(); };
        this.addChild(this._tracker);

        this._modNameInputBox = new InputBox(0, 0, 20, 20);
        this._modNameInputBox.name      = "modName";
        this._modNameInputBox.trackUndo = true;
        this._modNameInputBox.onChange  = value => {
            Tracker.getSong().title = value;
            UI.setInfo(value);
        };
        this.addChild(this._modNameInputBox);

        this._listbox = new Listbox(0, 0, 20, 20);
        this._listbox.setItems([{label: "loading ...", data: 1}]);
        let lastInstrumentClickTime = 0;
        let lastInstrumentClickData = null;
        this._listbox.onClick = () => {
            Input.setFocusElement(this._listbox);
            const item = this._listbox.getItemAtPosition(this._listbox.eventX, this._listbox.eventY);
            if (item) {
                Tracker.setCurrentInstrumentIndex(item.data);
                const now = Date.now();
                if (item.data === lastInstrumentClickData && now - lastInstrumentClickTime < 400) {
                    EventBus.trigger(COMMAND.showSampleEditor);
                    lastInstrumentClickData = null;
                } else {
                    lastInstrumentClickTime = now;
                    lastInstrumentClickData = item.data;
                }
            }
        };
        this.addChild(this._listbox);

        this._songlistbox = new SongPatternList();
        this.addChild(this._songlistbox);

        this._patternPanel  = new Scale9Panel(0, 0, 0, 0, Assets.panelInsetScale9);
        this._patternPanel2 = new Scale9Panel(0, 0, 0, 0, Assets.panelInsetScale9);
        this.addChild(this._patternPanel);
        this.addChild(this._patternPanel2);

        this._spinBoxPattern = new SpinBox();
        this._spinBoxPattern.name     = "Pattern";
        this._spinBoxPattern.label    = "Pattern";
        this._spinBoxPattern.setLabels([{width: 10, label: "Pat."}, {width: 140, label: "Pattern"}]);
        this._spinBoxPattern.setValue(0, true);
        this._spinBoxPattern.max      = 100;
        this._spinBoxPattern.min      = 0;
        this._spinBoxPattern.font     = spinbBoxFont;
        this._spinBoxPattern.onChange = value => { Tracker.setCurrentPattern(value); };
        this.addChild(this._spinBoxPattern);

        this._spinBoxInstrument = new SpinBox();
        this._spinBoxInstrument.name     = "Instrument";
        this._spinBoxInstrument.label    = "Instrument";
        this._spinBoxInstrument.setLabels([{width: 10, label: "Ins."}, {width: 123, label: "Instr"}, {width: 160, label: "Instrument"}]);
        this._spinBoxInstrument.setValue(1, true);
        this._spinBoxInstrument.max      = 31;
        this._spinBoxInstrument.min      = 1;
        this._spinBoxInstrument.font     = spinbBoxFont;
        this._spinBoxInstrument.onChange = value => { Tracker.setCurrentInstrumentIndex(value); };
        this.addChild(this._spinBoxInstrument);

        this._spinBoxSongLength = new SpinBox();
        this._spinBoxSongLength.name      = "SongLength";
        this._spinBoxSongLength.label     = "Song length";
        this._spinBoxSongLength.setLabels([{width: 10, label: "Len."}, {width: 138, label: "Length"}, {width: 156, label: "Song len"}, {width: 178, label: "Song length"}]);
        this._spinBoxSongLength.setValue(1, true);
        this._spinBoxSongLength.max       = 200;
        this._spinBoxSongLength.min       = 1;
        this._spinBoxSongLength.font      = spinbBoxFont;
        this._spinBoxSongLength.trackUndo = true;
        this._spinBoxSongLength.undoLabel = "Change Song length";
        this._spinBoxSongLength.onChange  = value => {
            const currentLength = Tracker.getSong().length;
            if (currentLength > value)     Editor.removeFromPatternTable();
            else if (currentLength < value) Editor.addToPatternTable();
        };
        this.addChild(this._spinBoxSongLength);

        this._spinBoxSongRepeat = new SpinBox();
        this._spinBoxSongRepeat.name     = "SongRepeat";
        this._spinBoxSongRepeat.label    = "Song repeat";
        this._spinBoxSongRepeat.setLabels([{width: 10, label: "Rep."}, {width: 138, label: "Repeat"}, {width: 156, label: "Song rep"}, {width: 178, label: "Song repeat"}]);
        this._spinBoxSongRepeat.setValue(1, true);
        this._spinBoxSongRepeat.max      = 200;
        this._spinBoxSongRepeat.min      = 1;
        this._spinBoxSongRepeat.font     = spinbBoxFont;
        this._spinBoxSongRepeat.onChange = value => { Tracker.getSong().restartPosition = value; };
        this.addChild(this._spinBoxSongRepeat);

        this._spinBoxPatternLength = new SpinBox();
        this._spinBoxPatternLength.name      = "PatternLength";
        this._spinBoxPatternLength.label     = "Pattern length";
        this._spinBoxPatternLength.setLabels([{width: 10, label: "Plen"}, {width: 138, label: "Pat len"}, {width: 166, label: "Pattern len"}, {width: 188, label: "Pattern length"}]);
        this._spinBoxPatternLength.setValue(64, true);
        this._spinBoxPatternLength.max       = 128;
        this._spinBoxPatternLength.min       = 1;
        this._spinBoxPatternLength.font      = spinbBoxFont;
        this._spinBoxPatternLength.trackUndo = true;
        this._spinBoxPatternLength.undoLabel = "Change Pattern length";
        this._spinBoxPatternLength.onChange  = value => { Tracker.setPatternLength(value); };
        this.addChild(this._spinBoxPatternLength);

        this._spinBoxBpm = new SpinBox();
        this._spinBoxBpm.name      = "BPMLength";
        this._spinBoxBpm.label     = "BPM";
        this._spinBoxBpm.setValue(1, true);
        this._spinBoxBpm.max       = 400;
        this._spinBoxBpm.min       = 1;
        this._spinBoxBpm.font      = spinbBoxFont;
        this._spinBoxBpm.trackUndo = true;
        this._spinBoxBpm.undoLabel = "Change Song Tempo";
        this._spinBoxBpm.tooltip   = "Change Song Tempo";
        this._spinBoxBpm.onChange  = value => { Tracker.setBPM(value); };
        this.addChild(this._spinBoxBpm);

        this._diskOperations = DiskOperations();
        this._diskOperations.name   = "diskoperations";
        this._diskOperations.zIndex = 100;
        this.addChild(this._diskOperations);
        UI.diskOperations = this._diskOperations;

        this._optionsPanel = new OptionsPanel();
        this._optionsPanel.name   = "options";
        this._optionsPanel.zIndex = 100;
        this.addChild(this._optionsPanel);

        this.on(EVENT.songLoading, () => {
                this._modNameInputBox.setValue("Loading ...", true);
            });
        this.on(EVENT.songPropertyChange, song => {
                song = song || Tracker.getSong();
                if (!song) return;
                this._modNameInputBox.setValue(song.title, true);
                this._spinBoxSongLength.setValue(song.length, true);
                this._spinBoxInstrument.setMax(Tracker.getMaxInstruments(), true);
                this._spinBoxSongRepeat.setMax(song.length, true);
                if (song.restartPosition && song.restartPosition > song.length) {
                    song.restartPosition = song.length;
                }
                this._spinBoxSongRepeat.setValue(song.restartPosition || 1, true);
            });
        this.on(EVENT.songBPMChange, value => {
                this._spinBoxBpm.setValue(value, true);
            });
        this.on(EVENT.instrumentChange, value => {
                this._listbox.setSelectedIndex(value - 1);
                this._spinBoxInstrument.setValue(value, true);
            });
        this.on(EVENT.instrumentNameChange, instrumentIndex => {
                const instrument = Tracker.getInstrument(instrumentIndex);
                if (instrument) {
                    const instruments = this._listbox.getItems();
                    for (let i = 0, len = instruments.length; i < len; i++) {
                        if (instruments[i].data == instrumentIndex) {
                            instruments[i].label = instrumentIndex + " " + instrument.name;
                            EventBus.trigger(EVENT.instrumentListChange, instruments);
                            break;
                        }
                    }
                }
            });
        this.on(EVENT.instrumentListChange, items => { this._listbox.setItems(items); });
        this.on(EVENT.patternChange, value => {
                this._spinBoxPattern.setValue(value, true);
                this._spinBoxPatternLength.setValue(Tracker.getPatternLength(), true);
            });
        this.on(EVENT.trackerModeChanged, mode => {
                this._spinBoxPatternLength.isDisabled = (mode === TRACKERMODE.PROTRACKER);
                this._spinBoxInstrument.setMax(Tracker.getMaxInstruments());
            });
        this.on(EVENT.pluginRenderHook, hook => {
                if (hook.target && hook.target === "main") {
                    if (!this._customPanel) {
                        this._customPanel = new Panel(0, 0, this.width, this.height);
                        this.addChild(this._customPanel);
                    } else {
                        this._customPanel.children = [];
                    }
                    this._customPanel.renderOverride  = hook.render;
                    this._customPanel.renderInternal  = hook.renderInternal;
                    if (hook.setRenderTarget) hook.setRenderTarget(this._customPanel);

                    this._diskOperations.hide();
                    this._optionsPanel.hide();
                    this._hideMain();
                    this._currentView = "custom";
                    if (!Layout.showSideBar) UI.patternsidebar.hide();
                    this._customPanel.show();
                    this.refresh();
                }
            });
        this.on(EVENT.showView, view => {
                switch (view) {
                    case "diskop_load": case "diskop_save":
                    case "diskop_samples_load": case "diskop_modules_load":
                    case "diskop_samples_save": case "diskop_modules_save":
                        if (this._customPanel) this._customPanel.hide();
                        this._diskOperations.setView(view);
                        this._diskOperations.show();
                        this._optionsPanel.hide();
                        this._currentView = view;
                        this.refresh();
                        break;
                    case "options":
                        if (this._customPanel) this._customPanel.hide();
                        this._diskOperations.hide();
                        this._optionsPanel.show(true);
                        this._currentView = view;
                        this.refresh();
                        break;
                    case "topmain":
                    case "main":
                        if (this._customPanel) this._customPanel.hide();
                        this._diskOperations.hide();
                        this._optionsPanel.hide();
                        this._currentView = "";
                        this._showMain();
                        this.refresh();
                        break;
                }
            });

        this.onPanelResize();
    }

    getCurrentView()    { return this._currentView; }
    getCurrentSubView() {
        if (this._customPanel && this._customPanel.isVisible()) return "custom";
        return this._currentSubView;
    }

    onPanelResize() {
        const inputBoxHeight   = 20;
        const margin           = Layout.defaultMargin;
        const listBoxTop       = inputBoxHeight + margin * 2;
        const logoHeight       = 50;
        let panelTop           = logoHeight + margin + margin;
        let panelHeight        = this.height - logoHeight - margin * 4;
        const spinButtonHeight = 28;
        let spinButtonWidth    = Layout.col1W - 2;

        if (Layout.prefered === "col3") {
            if (!this._radioGroup) this._initSmallScreenUI();

            panelHeight    = this.height - margin * 2;
            panelTop       = margin;
            spinButtonWidth = Layout.col32W - 2;

            if (this._currentView) {
                this._radioGroup.hide();
            } else {
                this._radioGroup.show();
            }

            this._radioGroup.setDimensions({
                left:    Layout.col31X,
                width:   Layout.col31W,
                top:     margin,
                height:  panelHeight
            });

            this._modNameInputBox.setDimensions({left: Layout.col32X, width: Layout.col32W, top: margin, height: inputBoxHeight});
            this._listbox.setDimensions({left: Layout.col32X, width: Layout.col32W, top: listBoxTop, height: this.height - listBoxTop - margin * 2});

            const mainDimensions = {left: Layout.col32X, width: Layout.col32W, top: panelTop, height: panelHeight};
            this._songlistbox.setDimensions(mainDimensions);
            this._patternPanel.setDimensions(mainDimensions);
            this._patternPanel2.setDimensions(mainDimensions);
            this._logo.setDimensions({left: Layout.col32X, width: Layout.col32W, top: panelTop, height: Math.floor(panelHeight / 2)});
            this._tracker.setDimensions({left: Layout.col32X, width: Layout.col32W, top: Math.floor(panelHeight / 2) + 1, height: Math.floor(panelHeight / 2)});

            const spinButtonLeft = Layout.col32X;

            this._spinBoxBpm.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxSongLength.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3 + spinButtonHeight, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxSongRepeat.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3 + spinButtonHeight * 2, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxSongRepeat.hide();
            this._spinBoxPattern.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3 + spinButtonHeight * 2, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxPatternLength.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3 + spinButtonHeight * 3, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxInstrument.setDimensions({left: spinButtonLeft, top: this._patternPanel.top + 3 + spinButtonHeight * 4, width: spinButtonWidth, height: spinButtonHeight});

            if (!this._currentView) {
                this._logo.toggle(this._currentSubView === "about");
                this._tracker.toggle(this._currentSubView === "about");
                this._modNameInputBox.toggle(this._currentSubView === "instruments");
                this._listbox.toggle(this._currentSubView === "instruments");
                this._songlistbox.toggle(this._currentSubView === "songdata");
                this._patternPanel.toggle(this._currentSubView === "patterndata");
                this._spinBoxBpm.toggle(this._currentSubView === "patterndata");
                this._spinBoxSongLength.toggle(this._currentSubView === "patterndata");
                this._spinBoxPattern.toggle(this._currentSubView === "patterndata");
                this._spinBoxPatternLength.toggle(this._currentSubView === "patterndata");
                this._spinBoxInstrument.toggle(this._currentSubView === "patterndata");
                UI.patternsidebar.toggle(this._currentSubView === "playlist" && !(this._customPanel && this._customPanel.isVisible()));
            }
            this._patternPanel2.hide();

        } else {
            if (this._radioGroup) this._radioGroup.hide();
            if (!this._currentView) this._showMain();

            this._logo.setDimensions({left: Layout.col1X, top: margin, width: Layout.col2W, height: logoHeight});
            this._tracker.setDimensions({left: Layout.col3X, top: margin, width: Layout.col1W, height: logoHeight});
            this._modNameInputBox.setDimensions({left: Layout.col4X, width: Layout.col2W, top: margin, height: inputBoxHeight});
            this._listbox.setDimensions({left: Layout.col4X, width: Layout.col2W, top: listBoxTop, height: this.height - listBoxTop - margin * 2});
            this._songlistbox.setDimensions({left: Layout.col1X, width: Layout.col1W, top: panelTop, height: panelHeight});
            this._patternPanel.setDimensions({left: Layout.col2X, width: Layout.col1W, top: panelTop, height: panelHeight});
            this._patternPanel2.setDimensions({left: Layout.col3X, width: Layout.col1W, top: panelTop, height: panelHeight});

            this._spinBoxBpm.setDimensions({left: Layout.col2X, top: this._patternPanel.top + 3, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxSongLength.setDimensions({left: Layout.col2X, top: this._patternPanel.top + 3 + spinButtonHeight, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxSongRepeat.setDimensions({left: Layout.col2X, top: this._patternPanel.top + 3 + spinButtonHeight * 2, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxPattern.setDimensions({left: Layout.col3X, top: this._patternPanel.top + 3, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxPatternLength.setDimensions({left: Layout.col3X, top: this._patternPanel.top + 3 + spinButtonHeight, width: spinButtonWidth, height: spinButtonHeight});
            this._spinBoxInstrument.setDimensions({left: Layout.col3X, top: this._patternPanel.top + 3 + spinButtonHeight * 2, width: spinButtonWidth, height: spinButtonHeight});
        }

        this._diskOperations.setSize(this.width, this.height);
        this._optionsPanel.setSize(this.width, this.height);
        if (this._customPanel) this._customPanel.setSize(this.width, this.height);
    }


    _buildSteffestVersion() {
        const img     = Y.getImage("steffest");
        let version   = typeof window.versionNumber === "string" && window.versionNumber.indexOf(".") > 0 ? window.versionNumber : "dev";
        if (version.indexOf(".") > 0) {
            const p = version.split(".");
            version = p[0] + "." + p[1];
        }
        version = "Version " + version;
        const imgCtx = img.getContext("2d");
        Font.small.write(imgCtx, version, 44, 4);
        Font.small.write(imgCtx, "By", 44, 13);
        return img;
    }

    _initSmallScreenUI() {
        this._currentSubView = "patterndata";
        this._radioGroup     = new RadioGroup(0, 0, 20, 20);
        this._radioGroup.align              = "right";
        this._radioGroup.size               = "med";
        this._radioGroup.divider            = "line";
        this._radioGroup.highLightSelection = true;
        this._radioGroup.zIndex             = 1;
        this._radioGroup.setItems([
            {label: "About",        active: false},
            {label: "Song data",    labels: [{width: 30, label: "song"}],    active: false},
            {label: "Pattern data", labels: [{width: 40, label: "pattern"}], active: true},
            {label: "Instruments",  labels: [{width: 30, label: "Instr"}],   active: false},
            {label: "Playlists",    labels: [{width: 30, label: "List"}],    active: false}
        ]);
        this._radioGroup.onChange = selectedIndex => {
            this._currentSubView = "about";
            if (selectedIndex === 1) this._currentSubView = "songdata";
            if (selectedIndex === 2) this._currentSubView = "patterndata";
            if (selectedIndex === 3) this._currentSubView = "instruments";
            if (selectedIndex === 4) this._currentSubView = "playlist";
            this.onPanelResize();
        };
        this.addChild(this._radioGroup);
        this.sortZIndex();
    }

    _hideMain() {
        this._logo.hide();
        this._tracker.hide();
        this._modNameInputBox.hide();
        this._spinBoxBpm.hide();
        this._spinBoxInstrument.hide();
        this._spinBoxSongRepeat.hide();
        this._listbox.hide();
        this._songlistbox.hide();
        this._spinBoxSongLength.hide();
        this._spinBoxPattern.hide();
        this._spinBoxPatternLength.hide();
        this._patternPanel.hide();
        this._patternPanel2.hide();
        if (this._radioGroup) this._radioGroup.hide();
    }

    _showMain() {
        this._logo.show();
        this._tracker.show();
        this._modNameInputBox.show();
        this._spinBoxBpm.show();
        this._spinBoxInstrument.show();
        this._spinBoxSongRepeat.show();
        this._listbox.show();
        this._songlistbox.show();
        this._spinBoxSongLength.show();
        this._spinBoxPattern.show();
        this._spinBoxPatternLength.show();
        this._patternPanel.show();
        this._patternPanel2.show();

        if (Layout.prefered === "col3") {
            if (this._radioGroup) this._radioGroup.show();
            this.onPanelResize();
        } else {
            if (this._radioGroup) this._radioGroup.hide();
        }
    }
}
