var BassoonProvider = function(){
	var me = {};

    var baseUrl = "https://www.stef.be/bassoontracker/api/storage/";
    var processing = false;

	me.putFile = function(){
		var url = baseUrl + "put/";

		Tracker.buildBinary(Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){
			//var b = new Blob([file.buffer], {type: "application/octet-stream"});

			var fileName = Tracker.getFileName();

			FetchService.sendBinary(url,file.buffer,function(result){
				console.error(result);
			})
		});
	};

	me.renderFile = function(fileName,toMp3){
		if (processing){
			console.error("already processing ...");
			return;
		}

		processing = true;
		var url =  baseUrl + "render/" + (Tracker.inFTMode() ? "xm" : "mod");
		var fileName = fileName || Tracker.getFileName();
		UI.setStatus("saving file ...",true);
		Tracker.buildBinary(Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){

			//var b = new Blob([file.buffer], {type: "application/octet-stream"});

			FetchService.sendBinary(url,file.buffer,function(result){
				if (result === "error"){
					console.error("error saving file");
					UI.setStatus("error saving file");
					processing = false;
				}else{
					var tempFile = result;
					console.log(tempFile + ": converting file ...");
					UI.setStatus("rendering file ...",true);
					url =  baseUrl + "convert/" + tempFile;
					FetchService.sendBinary(url,file.buffer,function(result){
						if (result === "error"){
							console.error("error converting file");
							UI.setStatus("Error rendering file ...");
							processing = false;
						}else{
							tempFile = result;
							if (toMp3){
								console.log(tempFile + ": converting to mp3");
								UI.setStatus("Converting file to mp3...",true);
								url =  baseUrl + "wavtomp3/" + tempFile;
								FetchService.sendBinary(url,file.buffer,function(result){
									console.error(result);
									if (result === "error"){
										console.error("error converting file to mp3");
										UI.setStatus("Error converting file to mp3...");
										processing = false;
									}else{
										downloadFile(result,fileName,"mp3");
									}
								});
							}else{
								downloadFile(tempFile,fileName,"wav");
							}
						}
					});
				}
			})
		});
	};

	function downloadFile(url,filename,extention){
		if (extention){
			var hasExtention = false;
			var p = filename.lastIndexOf(".");
			if (p>=0) hasExtention = filename.substr(p+1).toLowerCase() === extention.toLowerCase();
			if (!hasExtention) filename += "." + extention;
		}
        console.log("Downloading " + url + " as " + filename);
		UI.setStatus("Downloading ...");
		processing = false;
		setTimeout(function(){
			UI.setStatus("");
		},3000);
        document.location.href = baseUrl + url + "?dl=1&name=" + filename;
	}

	return me;
}();