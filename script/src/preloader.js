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
			var request = new XMLHttpRequest();
			request.open("GET", url, true);

			request.onload = function() {
				// Asynchronously decode the audio file data in request.response
				loader.context.decodeAudioData(
					request.response,
					function(buffer) {
						if (!buffer) {
							alert('error decoding file data: ' + url);
							return;
						}
						loader.bufferList[index] = buffer;
						if (++loader.loadCount == loader.max)
							if (next) next();
					},
					function(error) {
						console.error('decodeAudioData error', error);
					}
				);
			};

			request.onerror = function() {
				alert('BufferLoader: XHR error');
			};

			request.send();
		}



		//request.responseType = "arraybuffer";
	};


	return me;
};