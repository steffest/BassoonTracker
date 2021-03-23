var Plugin = function(){
	var me = {};
	
	var pluginSources={
		"Nibbles":[
			"script/plugins/games/nibbles/nibbles.js",
			"script/plugins/games/nibbles/logo.png",
			"script/plugins/games/nibbles/levels.png",
			"script/plugins/games/nibbles/player1.png"]
	}

	var plugins = {};

	me.register = function(plugin){
		console.log("register");
		console.log(plugin);
		plugins[plugin.name] = plugin;
	};
	
	me.load = function(plugin,next){
		var pluginName = plugin.name || plugin;
		
		if (typeof window[pluginName] === "object"){
			// already packaged
			console.log("Plugin " + pluginName + " already loaded");
			if (next) next();
		}else{
			if (typeof plugin === "string"){
				plugin = {
					name: plugin,
					src: pluginSources[plugin]
				};
			}
			var p = plugins[plugin.name];
			if (p){
				if (p.loading) {
					console.warn("Plugin already being loaded");
				}else{
					console.log("Plugin already loaded");
					if (next) next();
				}
			}else{
				var todo;
				var done;

				var loadCallback = function (e) {
					if (e && e.type === 'load'){
						done++;
					}else{
						console.error("Error loading resource",e);
						done++;
					}
					//console.error(this.src);
					if (done>=todo){
						plugin.loaded = true;
						console.log("loaded",plugin);
						if (plugin.onLoad) plugin.onLoad();
						if (next) next();
					}
				};

				var loadScript = function (src) {
					var s = document.createElement('script');
					s.type = 'application/javascript';
					s.src = src;
					s.addEventListener('error', loadCallback, false);
					s.addEventListener('load', loadCallback, false);
					document.getElementsByTagName('head')[0].appendChild(s);
					return s.src;
				};

				var loadGraphics = function (src) {
					Y.loadImage(src,function(img){
						var name = src.split("/").pop().split(".")[0];
						Y.sprites[plugin.name + "." + name] = Y.sprite({
							img:img,
							width:img.width,
							height: img.height
						});
						loadCallback({type:'load'});
					})
				};

				if (plugin.src){
					console.log("loading Plugin " + plugin.name + " with " + plugin.src.length + " source files");
					plugin.loading = true;
					todo=plugin.src.length;
					done=0;
					plugin.src.forEach(function(s){
						var ext = s.split(".").pop().toLowerCase();
						switch (ext){
							case "js":
								loadScript(s);
								break;
							case "png":
								loadGraphics(s);
								break;
							default:
								console.warn("Warning, unknown loader for " + s);
								loadCallback(s);
						}
					});
				}else{
					console.warn("Can't load plugin " + plugin.name + ": no source files");
					if (next) next();
				}
			}
		}
	};



	return me;
}();