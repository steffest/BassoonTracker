var BassoonProvider = function(){
	var me = {};

    var baseUrl = "https://www.stef.be/bassoontracker/api/storage/";

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

	me.renderFile = function(toMp3){
		var url =  baseUrl + "render/" + (Tracker.inFTMode() ? "xm" : "mod");
		var fileName = Tracker.getFileName();
		console.log("saving file ...");
		Tracker.buildBinary(Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,function(file){

			//var b = new Blob([file.buffer], {type: "application/octet-stream"});

			FetchService.sendBinary(url,file.buffer,function(result){
				if (result === "error"){
					console.error("error saving file")
				}else{
					var tempFile = result;
					console.log(tempFile + ": converting file ...");
					url =  baseUrl + "convert/" + tempFile;
					FetchService.sendBinary(url,file.buffer,function(result){
						if (result === "error"){
							console.error("error converting file")
						}else{
							tempFile = result;
							if (toMp3){
								console.log(tempFile + ": converting to mp3");
								url =  baseUrl + "wavtomp3/" + tempFile;
								FetchService.sendBinary(url,file.buffer,function(result){
									console.error(result);
									if (result === "error"){
										console.error("error converting file to mp3")
									}else{
										downloadFile(result);
									}
								});
							}else{
								downloadFile(tempFile);
							}
						}
					});
				}
			})
		});
	};

	function downloadFile(filename){
        console.error("Downloading " + filename);
        document.location.href = baseUrl + filename + "?download=yes";
	}

	return me;
}();