var PreLoader = function(){
	var me = {};

	me.load = function(urls,type,next){
		me.type = type || PRELOADTYPE.image;
		me.loadCount = 0;
		me.max = urls.length;
		me.next = next;

		for (var i = 0, len = urls.length; i < len; i++)
			loadAsset(urls[i]);
	};

	var loadAsset = function(url){
		if (me.type == PRELOADTYPE.image){
			var img = new Image();
			img.onload = function(){
				cachedAssets.images[url] = this;
				if (++me.loadCount == me.max)
					if (me.next) me.next();
			};
			img.onerror = function(){
				alert('BufferLoader: XHR error');
			};
			img.src = url;
		}

		if (me.type == PRELOADTYPE.audio){


			var req = new XMLHttpRequest();
			req.responseType = "arraybuffer";
			req.open("GET", url, true);

			req.onload = function() {
				// Asynchronously decode the audio file data in request.response
				Audio.context.decodeAudioData(
					req.response,
					function(buffer) {
						if (!buffer) {
							alert('error decoding file data: ' + url);
							return;
						}
						cachedAssets.audio[url] = buffer;
						if (++me.loadCount == me.max)
							if (me.next) me.next();
					},
					function(error) {
						console.error('decodeAudioData error', error);
					}
				);
			};

			req.onerror = function() {
				alert('BufferLoader: XHR error');
			};

			req.send();
		}



		//request.responseType = "arraybuffer";
	};


	return me;
};