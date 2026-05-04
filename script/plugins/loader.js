import Y from "../src/ui/yascal/yascal.js";
import sprite from "../src/ui/yascal/sprite.js";
import Host from "../src/host.js";
import pluginRegistry from "./registry.js";

var Plugin = function(){
	var me = {};
	var plugins = {};

	me.register = function(plugin){
		console.log("register",plugin);
		plugins[plugin.name] = plugin;
	};

	me.load = function(plugin,next){
		var manifest = resolveManifest(plugin);
		if (!manifest){
			console.warn("Can't load plugin: unknown plugin",plugin);
			if (next) next();
			return Promise.resolve();
		}

		var loadedPlugin = plugins[manifest.name];
		if (loadedPlugin && loadedPlugin.loaded){
			console.log("Plugin already loaded");
			if (next) next(loadedPlugin.module,loadedPlugin);
			return Promise.resolve(loadedPlugin.module);
		}
		if (loadedPlugin && loadedPlugin.loading){
			console.warn("Plugin already being loaded");
			return loadedPlugin.loading.then(function(module){
				if (next) next(module,loadedPlugin);
				return module;
			});
		}

		loadedPlugin = {
			name: manifest.name,
			manifest: manifest,
			loaded: false
		};
		plugins[manifest.name] = loadedPlugin;

		console.log("loading Plugin " + manifest.name);
		loadedPlugin.loading = Promise.all([
			loadAssets(manifest),
			loadModule(manifest)
		]).then(function(result){
			var module = result[1];
			loadedPlugin.module = module.default || module;
			loadedPlugin.loaded = true;
			loadedPlugin.loading = null;
			console.log("loaded",loadedPlugin);
			if (loadedPlugin.onLoad) loadedPlugin.onLoad(loadedPlugin.module,loadedPlugin);
			if (next) next(loadedPlugin.module,loadedPlugin);
			return loadedPlugin.module;
		}).catch(function(error){
			loadedPlugin.loading = null;
			console.error("Error loading plugin " + manifest.name,error);
			if (next) next();
		});

		return loadedPlugin.loading;
	};

	function resolveManifest(plugin){
		if (typeof plugin === "string") return pluginRegistry[plugin];
		if (plugin && plugin.entry) return plugin;
		if (plugin && plugin.name) return pluginRegistry[plugin.name] || plugin;
	}

	function loadAssets(manifest){
		var assets = manifest.assets || [];
		return Promise.all(assets.map(function(src){
			var ext = src.split(".").pop().toLowerCase();
			switch (ext){
				case "png":
					return loadGraphics(manifest,src);
				default:
					console.warn("Warning, unknown loader for " + src);
					return Promise.resolve();
			}
		}));
	}

	function loadModule(manifest){
		if (manifest.load) return manifest.load();
		if (!manifest.entry) return Promise.resolve({});
		var url = getPluginUrl(manifest.entry);
		return import(/* @vite-ignore */ url);
	}

	function loadGraphics(manifest,src){
		return new Promise(function(resolve){
			Y.loadImage(getPluginUrl(src),function(img){
				var name = src.split("/").pop().split(".")[0];
				Y.sprites[manifest.name + "." + name] = sprite({
					img:img,
					width:img.width,
					height: img.height
				});
				resolve();
			});
		});
	}

	function getPluginUrl(path){
		var remoteUrl = Host.getRemoteUrl();
		return remoteUrl ? remoteUrl + path : new URL(path,document.baseURI).href;
	}

	return me;
}();

export default Plugin;
