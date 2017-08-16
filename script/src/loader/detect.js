var FileDetector = function(){
	var me = {};

	var fileType = {
		unknown: {name: "UNKNOWN"},
		unsupported: {name: "UNSUPPORTED"},
		mod_ProTracker: {name: "PROTRACKER", isMod: true, loader: function(){return ProTracker()}},
		mod_SoundTracker: {name: "SOUNDTRACKER", isMod: true, loader: function(){return SoundTracker()}},
		mod_FastTracker: {name: "FASTTRACKER", isMod: true, loader: function(){return FastTracker()}},
		sample: {name: "SAMPLE",isSample:true}
	};

	me.detect = function(file,name){
		var length = file.length;
		var id = "";

		id = file.readString(17,0);
		if (id == "Extended Module: "){
			//return fileType.mod_FastTracker;
			alert("Sorry, FastTracker XM files are not supported yet ... working on it.");
			return fileType.unsupported;
		}

		if (length>1100){
			id = file.readString(4,1080); // M.K.
		}
		console.log("Format ID: " + id);

		if (id == "M.K.") return fileType.mod_ProTracker;
		if (id == "FLT4") return fileType.mod_ProTracker;
		if (id == "8CHN") return fileType.mod_ProTracker;

		var ext = "";
		if (name && name.length>4) ext = name.substr(name.length-4);
		ext = ext.toLowerCase();

		if (ext == ".wav") return fileType.sample;
		if (ext == ".mp3") return fileType.sample;
		if (ext == ".iff") return fileType.sample;



		// might be an 15 instrument mod?
		// filename should at least contain a "." this avoids checking all ST-XX samples

		// example: https://modarchive.org/index.php?request=view_by_moduleid&query=35902
		// more info: ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt


		if (name && name.indexOf(".")>=0 && length>1624){
			// check for ascii
			function isAcii(byte){
				return (byte == 0) || (byte>31 && byte<128);
			}

			function isST(){
				file.goto(0);
				for (var i = 0; i<20;i++) if (!isAcii(file.readByte())) return false;

				// check samples
				var totalSampleLength = 0;
				for (var s = 0; s<15;s++) {
					for (i = 0; i<22;i++) if (!isAcii(file.readByte())) return false;
					totalSampleLength += file.readWord();
					file.jump(6);
				}

				if (totalSampleLength*2 + 1624 > length) return false;

				return true;
			}

			var isSoundTracker = isST();
			if (isSoundTracker){
				return fileType.mod_SoundTracker;
			}
		}


		// fallback to sample
		return fileType.sample;

	};

	return me;
}();