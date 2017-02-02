var Yascal = (function(){
	var me = {};

	me.sprites = {};
	me.getImage = function(name){
		return me.sprites[name] ? me.sprites[name].canvas : undefined;
	};

	me.loadImage = function(url,next){
		var img = new Image();
		img.onload = function(){
			if (next) next(img);
		};
		img.onerror = function(){
			console.error('XHR error while loading ' + url);
		};
		img.src = url;
	};

	return me;
})();

var Y = Yascal;