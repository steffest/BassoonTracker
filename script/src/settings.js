var Settings = (function(){
	var me = {};

	me.readSettings = function(){

		setDefaults();

		var settings = Storage.get("bassoonTrackerSettings");

		if (!settings) return;

		try {
			settings = JSON.parse(settings);
		} catch (e) {
			return false;
		}

		for (var key in settings){
			if (SETTINGS.hasOwnProperty(key) && settings.hasOwnProperty(key)){
				SETTINGS[key] = settings[key];
				if (key  === "skipFrame"){
					var value = parseInt(SETTINGS[key],10);
					if (!isNaN(value)) UI.skipFrame(value);
				}
			}
		}

		if (SETTINGS.stereoSeparation){
			Audio.setStereoSeparation(SETTINGS.stereoSeparation);
		}

	};

	me.saveSettings = function(){
		var settings = {
			vubars: SETTINGS.vubars,
			keyboardTable: SETTINGS.keyboardTable,
			stereoSeparation: SETTINGS.stereoSeparation,
			dropboxMode: SETTINGS.dropboxMode,
			skipFrame: UI.getSkipFrame()
		};
		Storage.set("bassoonTrackerSettings",JSON.stringify(settings));
	};

	me.reset = function(){
		// reset default Settings;
		setDefaults();
		me.saveSettings();
	};

	function setDefaults(){
		SETTINGS.keyboardTable = "qwerty";
		SETTINGS.vubars = "colour";
		SETTINGS.stereoSeparation =  STEREOSEPARATION.BALANCED;
		SETTINGS.dropboxMode = "rename";
        SETTINGS.skipFrame = 1;
		UI.skipFrame(SETTINGS.skipFrame);
	}

	return me;
})();