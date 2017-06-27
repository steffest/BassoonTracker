var FileDetector = function(){
	var me = {};

	var fileType = {
		unknown: {name: "UNKNOWN"},
		unsupported: {name: "UNSUPPORTED"},
		mod_ProTracker: {name: "PROTRACKER", isMod: true, loader: function(){return Protracker()}},
		mod_SoundTracker: {name: "SOUNDTRACKER", loader: ''},
		sample: {name: "SAMPLE",isSample:true}
	};

	me.detect = function(file){
		var length = file.length;
		var id = "";

		if (length>1100){
			id = file.readString(4,1080); // M.K.
		}
		console.log("Format ID: " + id);

		if (id == "M.K.") return fileType.mod_ProTracker;
		if (id == "FLT4") return fileType.mod_ProTracker;
		if (id == "8CHN") {
			alert("Sorry, 8 channel mod files are not supported yet ...");
			return fileType.unsupported;
		}

		// might be and 15 instrument mod?
		// TODO add check and loader.
		// example: https://modarchive.org/index.php?request=view_by_moduleid&query=35902
		// more info: ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt


		// falback to sample
		return fileType.sample;

	};

	return me;
}();