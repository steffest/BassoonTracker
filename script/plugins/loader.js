var PluginLoader = function(){
	var me = {};

	var plugins = {};

	me.register = function(plugin){
		console.log("register");
		console.log(plugin);
		plugins[plugin.name] = plugin;
	};

	me.get = function(name){
		var plugin = plugins[name];
		if (plugin && !plugin.loaded){
			me.load(plugin,function(){

			});
		}
		return plugin;
	};

	me.load = function(plugin,next){
		console.log(plugin);
		var todo;
		var done;

		var loadCallback = function (e) {
			if (e.type == 'load'){
				done++;
			}else{
				console.log("error");
				done++;
			}
			console.error(this.src);
			if (done>=todo){
				plugin.loaded = true;
				console.log("loaded",plugin);
				if (plugin.onLoad) plugin.onLoad();
			}
		};

		var load = function (src) {
			var s = document.createElement('script');
			s.type = 'application/javascript';
			s.src = src;
			s.addEventListener('error', loadCallback, false);
			s.addEventListener('load', loadCallback, false);
			document.getElementsByTagName('head')[0].appendChild(s);
			return s.src;
		};

		if (plugin.src){
			todo=plugin.src.length;
			done=0;
			plugin.src.forEach(function(s){load(s)});
		}
	};



	return me;
}();