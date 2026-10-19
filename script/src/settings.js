import Storage from "./storage.js";
import {SETTINGS, STEREOSEPARATION, EVENT, COMMAND} from "./enum.js";
import Audio from "./audio.js";
import Layout from "./ui/app/layout.js";
import EventBus from "./eventBus.js";

var Settings = (function(){
	var me = {};
	var isApplyingUI = false;
	const layoutKeys = ["showSideBar", "showAppPanel", "showPiano", "patternViewMode"];
	// Source configuration flags must not be overridden by saved user preferences.
	const featureKeys = ["enableHorizontalView", "enableWideLayout", "enableAdvancedSampleEditor", "enableXIInstruments", "enableAIFFImport", "enableRememberLayout", "enableMinMaxScopes", "gateDebugLogging"];

	me.readSettings = function(){
		var settings = Storage.get("bassoonTrackerSettings");
		try {
			settings = JSON.parse(settings);
		} catch (e) {
			settings = undefined;
		}
		me.set(settings);
		setTimeout(function(){
			me.applyUIState();
		}, 50);
	};

	me.saveSettings = function(){
		if (isApplyingUI) return;
		var UI = window.UI;
		var settings = {
			vubars: SETTINGS.vubars,
			stereoSeparation: SETTINGS.stereoSeparation,
			dropboxMode: SETTINGS.dropboxMode,
			skipFrame: (UI && UI.getSkipFrame) ? UI.getSkipFrame() : 1,
			midi: SETTINGS.midi,
			highDPI: SETTINGS.highDPI,
			showKey: SETTINGS.showKey,
			showMidi: SETTINGS.showMidi,
			useTooltip: SETTINGS.useTooltip,
			playFrom: SETTINGS.playFrom,
			showSideBar: SETTINGS.showSideBar,
			showAppPanel: SETTINGS.showAppPanel,
			showPiano: SETTINGS.showPiano,
			patternViewMode: SETTINGS.patternViewMode
		};
		if (!SETTINGS.enableRememberLayout) {
			layoutKeys.forEach(key => delete settings[key]);
		}
		Storage.set("bassoonTrackerSettings",JSON.stringify(settings));
	};

	me.reset = function(){
		// reset default Settings;
		setDefaults();
		me.saveSettings();
	};
	
	me.set = function(settings){
		setDefaults();
		
		if (!settings) return;
		for (var key in settings){
			if (featureKeys.includes(key)) continue;
			if (!SETTINGS.enableRememberLayout && layoutKeys.includes(key)) continue;
			if (SETTINGS.hasOwnProperty(key) && settings.hasOwnProperty(key)){
				SETTINGS[key] = settings[key];
				if (key === "skipFrame"){
					var value = parseInt(SETTINGS[key],10);
					if (!isNaN(value) && window.UI && window.UI.skipFrame) window.UI.skipFrame(value);
				}
			}
		}

		if (!SETTINGS.enableHorizontalView) SETTINGS.patternViewMode = "vertical";

		if (typeof SETTINGS.showSideBar !== "undefined") {
			Layout.hasSideBar = !!SETTINGS.showSideBar;
		}

		if (SETTINGS.stereoSeparation){
			Audio.setStereoSeparation(SETTINGS.stereoSeparation);
		}
		if (SETTINGS.highDPI && window.UI && window.UI.scaleToDevicePixelRatio){
			window.UI.scaleToDevicePixelRatio(SETTINGS.highDPI);
		}
	};

	me.applyUIState = function(){
		if (!SETTINGS.enableRememberLayout) return;
		isApplyingUI = true;

		if (!SETTINGS.enableHorizontalView) SETTINGS.patternViewMode = "vertical";

		if (typeof SETTINGS.showSideBar !== "undefined") {
			Layout.hasSideBar = !!SETTINGS.showSideBar;
			EventBus.trigger(EVENT.appLayoutChanged);
		}

		const UI = window.UI;

		if (UI && UI.mainPanel && UI.mainPanel._appPanel) {
			const appPanelVisible = UI.mainPanel._appPanel.isVisible();
			if (SETTINGS.showAppPanel === false && appPanelVisible) {
				UI.mainPanel._appPanel.hide();
				UI.mainPanel.onResize();
			} else if (SETTINGS.showAppPanel === true && !appPanelVisible) {
				UI.mainPanel._appPanel.show();
				UI.mainPanel.onResize();
			}
		}

		if (UI && UI.mainPanel && UI.mainPanel._pianoPanel) {
			const pianoVisible = UI.mainPanel._pianoPanel.isVisible();
			if (SETTINGS.showPiano === true && !pianoVisible) {
				EventBus.trigger(EVENT.toggleView, "piano");
			} else if (SETTINGS.showPiano === false && pianoVisible) {
				EventBus.trigger(EVENT.toggleView, "piano");
			}
		}

		if (SETTINGS.enableHorizontalView && SETTINGS.patternViewMode === "horizontal") {
			EventBus.trigger(EVENT.showView, "multitrack");
		} else if (SETTINGS.patternViewMode === "vertical") {
			EventBus.trigger(EVENT.showView, "main");
		}

		isApplyingUI = false;
	};

	function setDefaults(){
		SETTINGS.vubars = "colour";
		SETTINGS.stereoSeparation = STEREOSEPARATION.BALANCED;
		SETTINGS.dropboxMode = "rename";
		SETTINGS.skipFrame = 1;
		SETTINGS.canvasId = "canvas";
		SETTINGS.midi = "disabled";
		if (window.UI && window.UI.skipFrame) window.UI.skipFrame(SETTINGS.skipFrame);
		SETTINGS.highDPI = false;
		SETTINGS.showKey = false;
		SETTINGS.showMidi = false;
		SETTINGS.playFrom = "start";
		SETTINGS.showSideBar = true;
		SETTINGS.showAppPanel = true;
		SETTINGS.showPiano = false;
		SETTINGS.patternViewMode = "vertical";
	}

	EventBus.on(EVENT.appLayoutChanged, () => {
		if (isApplyingUI || !SETTINGS.enableRememberLayout) return;
		if (typeof Layout.hasSideBar !== "undefined") {
			SETTINGS.showSideBar = Layout.hasSideBar;
			me.saveSettings();
		}
	});

	EventBus.on(COMMAND.toggleAppPanel, () => {
		if (isApplyingUI || !SETTINGS.enableRememberLayout) return;
		setTimeout(() => {
			const UI = window.UI;
			if (UI && UI.mainPanel && UI.mainPanel._appPanel) {
				SETTINGS.showAppPanel = UI.mainPanel._appPanel.isVisible();
				me.saveSettings();
			}
		}, 10);
	});

	EventBus.on(EVENT.toggleView, view => {
		if (isApplyingUI || !SETTINGS.enableRememberLayout) return;
		const UI = window.UI;
		if (view === "piano" && UI && UI.mainPanel && UI.mainPanel._pianoPanel) {
			SETTINGS.showPiano = UI.mainPanel._pianoPanel.isVisible();
			me.saveSettings();
		}
	});

	EventBus.on(EVENT.showView, view => {
		if (isApplyingUI || !SETTINGS.enableRememberLayout) return;
		if (view === "multitrack" && !SETTINGS.enableHorizontalView) return;
		if (view === "multitrack") {
			SETTINGS.patternViewMode = "horizontal";
			me.saveSettings();
		} else if (view === "main") {
			SETTINGS.patternViewMode = "vertical";
			me.saveSettings();
		}
	});

	return me;
})();

export default Settings;