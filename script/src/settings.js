var Settings = (function(){
	var me = {};

	me.readSettings = function(){
		var settings = Storage.get("bassoonTrackerSettings");


		if (!settings) return;

		try {
			settings = JSON.parse(settings);
		} catch (e) {
			return false;
		}

		for (var key in SETTINGS){
			if (SETTINGS.hasOwnProperty(key) && settings.hasOwnProperty(key)){
				SETTINGS[key] = settings[key];
			}
		}

		if (SETTINGS.playBackEngine && SETTINGS.playBackEngine<3){
			Tracker.playBackEngine = SETTINGS.playBackEngine;
		}
	};

	me.saveSettings = function(){
		Storage.set("bassoonTrackerSettings",JSON.stringify(SETTINGS));
	};

	return me;
})();