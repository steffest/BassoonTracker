var Settings = (function(){
	var me = {};

	me.readSettings = function(){
		var settings = Storage.get("bassoonTrackerSettings");
		try {
			settings = JSON.parse(settings);
		} catch (e) {
			settings = undefined;
		}
		me.set(settings);
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
	
	me.set = function(settings){
		console.error(settings);
		setDefaults();
		
		if (!settings) return;
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
	}

	function setDefaults(){
		SETTINGS.keyboardTable = "qwerty";
		SETTINGS.vubars = "colour";
		SETTINGS.stereoSeparation =  STEREOSEPARATION.BALANCED;
		SETTINGS.dropboxMode = "rename";
        SETTINGS.skipFrame = 1;
		SETTINGS.canvasId = "canvas";
		UI.skipFrame(SETTINGS.skipFrame);
	}

	return me;
})();