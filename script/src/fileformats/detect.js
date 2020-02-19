var FileDetector = function(){
	var me = {};

	var fileType = {
		unknown: {name: "UNKNOWN"},
		unsupported: {name: "UNSUPPORTED"},
		mod_ProTracker: {name: "PROTRACKER", isMod: true, loader: function(){return ProTracker()}},
		mod_SoundTracker: {name: "SOUNDTRACKER", isMod: true, loader: function(){return SoundTracker()}},
		mod_FastTracker: {name: "FASTTRACKER", isMod: true, loader: function(){return FastTracker()}},
		sample: {name: "SAMPLE",isSample:true},
		zip: {name: "ZIP"}
	};

	me.detect = function(file,name){
		var length = file.length;
		var id = "";

		id = file.readString(17,0);
		if (id == "Extended Module: "){
			return fileType.mod_FastTracker;
		}


		if (length>1100){
			id = file.readString(4,1080); // M.K.
		}
		console.log("Format ID: " + id);

		if (id == "M.K.") return fileType.mod_ProTracker;
		if (id == "M!K!") return fileType.mod_ProTracker; // more then 64 patterns
		if (id == "M&K!") return fileType.mod_ProTracker; // what's different? example https://modarchive.org/index.php?request=view_by_moduleid&query=76607
		if (id == "FLT4") return fileType.mod_ProTracker;
		if (id == "2CHN") return fileType.mod_ProTracker;
		if (id == "6CHN") return fileType.mod_ProTracker;
		if (id == "8CHN") return fileType.mod_ProTracker;
		if (id == "10CH") return fileType.mod_ProTracker;
		if (id == "12CH") return fileType.mod_ProTracker;
		if (id == "14CH") return fileType.mod_ProTracker;
		if (id == "16CH") return fileType.mod_ProTracker;
		if (id == "18CH") return fileType.mod_ProTracker;
		if (id == "20CH") return fileType.mod_ProTracker;
		if (id == "22CH") return fileType.mod_ProTracker;
		if (id == "24CH") return fileType.mod_ProTracker;
		if (id == "26CH") return fileType.mod_ProTracker;
		if (id == "28CH") return fileType.mod_ProTracker;
		if (id == "30CH") return fileType.mod_ProTracker;
		if (id == "32CH") return fileType.mod_ProTracker;

		var ext = "";
		if (name && name.length>4) ext = name.substr(name.length-4);
		ext = ext.toLowerCase();

		if (ext == ".wav") return fileType.sample;
		if (ext == ".mp3") return fileType.sample;
		if (ext == ".iff") return fileType.sample;
		if (ext == ".zip") return fileType.zip;

		var zipId = file.readString(2,0);
		if (zipId == "PK") return fileType.zip;



		// might be an 15 instrument mod?
		// filename should at least contain a "." this avoids checking all ST-XX samples

		// example: https://modarchive.org/index.php?request=view_by_moduleid&query=35902 or 36954
		// more info: ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt


		if (name && name.indexOf(".")>=0 && length>1624){
			// check for ascii
			function isAcii(byte){
				return byte<128;
			}

			function isST(){
				console.log("Checking for old 15 instrument soundtracker format");
				file.goto(0);
				for (var i = 0; i<20;i++) if (!isAcii(file.readByte())) return false;

				console.log("First 20 chars are ascii, checking Samples");

				// check samples
				var totalSampleLength = 0;
				var probability =0;
				for (var s = 0; s<15;s++) {
					for (i = 0; i<22;i++) if (!isAcii(file.readByte())) return false;
					file.jump(-22);
					var name = file.readString(22);
					if (name.toLowerCase().substr(0,3) == "st-") probability += 10;
					if (probability>20) return true;
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