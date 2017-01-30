UI.Assets = (function(){
	// generates and caches frequently used UI assets

	var me = {};

	var assets = {};

	me.buttonLightScale9 = {
		left: 2,
		top:2,
		right: 4,
		bottom: 2
	};
	me.buttonDarkScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkBlueScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkRedScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkGreenScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkGreenActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkRedActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkBlueActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkYellowActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.panelMainScale9 = {
		left:2,
		top:2,
		right:3,
		bottom: 3
	};
	me.panelDarkScale9 = {
		left:3,
		top:3,
		right:1,
		bottom: 1
	};
	me.panelInsetScale9 = {
		left:2,
		top:2,
		right:2,
		bottom: 2
	};
	me.menuMainScale9 = {
		img: cachedAssets.images["skin/menu.png"],
		left:1,
		top:1,
		right:20,
		bottom: 1
	};

	var assetsInfo = {
		button20_20:{
			generate:function(andCache){
				var result;
				var scale = me.panelDarkScale9;
				//result = UI.scale9Panel(0,0,20,20,scale);
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: scale,
					textAlign: "center",
					font: window.fontMed,
					paddingTop: 2
				});
				if (andCache){
					assets["buttonUp20_20"] = result;
				}else{
					return result;
				}
			}
		},
		button30_30:{
			generate:function(andCache){
				var result;
				var scale = me.buttonLightScale9;
				result = UI.scale9Panel(0,0,30,30,scale);
				if (andCache){
					assets["buttonUp30_30"] = result;
				}else{
					return result;
				}
			}
		},
		buttonLight:{
			generate:function(andCache){
				var result;
				var scale = me.buttonLightScale9;
				result = UI.button();
				result.setProperties({
					background: scale,
					textAlign: "center",
					font: window.fontMed
				});
				if (andCache){
					assets["buttonLight"] = result;
				}else{
					return result;
				}
			}
		},
		buttonDark:{
			generate:function(andCache){
				var result;
				var scale = me.buttonDarkScale9;
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: scale,
					activeBackground:UI.Assets.buttonDarkActiveScale9,
					isActive:false,
					textAlign: "center",
					font: window.fontMed
				});
				if (andCache){
					assets["buttonDark"] = result;
				}else{
					return result;
				}
			}
		},
		buttonDarkBlue:{
			generate:function(andCache){
				var result;
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: me.buttonDarkBlueScale9,
					activeBackground:UI.Assets.buttonDarkBlueActiveScale9,
					isActive:false,
					textAlign: "center",
					font: window.fontMed
				});
				if (andCache){
					assets["buttonDarkBlue"] = result;
				}else{
					return result;
				}
			}
		},
		buttonDarkRed:{
			generate:function(andCache){
				var result;
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: me.buttonDarkRedScale9,
					activeBackground:UI.Assets.buttonDarkRedActiveScale9,
					isActive:false,
					textAlign: "center",
					font: window.fontMed
				});
				if (andCache){
					assets["buttonDarkRed"] = result;
				}else{
					return result;
				}
			}
		},
		buttonDarkGreen:{
			generate:function(andCache){
				var result;
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: me.buttonDarkGreenScale9,
					activeBackground:UI.Assets.buttonDarkGreenActiveScale9,
					isActive:false,
					textAlign: "center",
					font: window.fontMed
				});
				if (andCache){
					assets["buttonDarkGreen"] = result;
				}else{
					return result;
				}
			}
		}
	};

	me.init = function(){
		// should be executed when all image assets have been loaded:
		me.buttonLightScale9.img = cachedAssets.images["skin/button_light.png"];
		me.buttonDarkScale9.img = cachedAssets.images["skin/button_inlay.png"];
		me.buttonDarkBlueScale9.img = cachedAssets.images["skin/button_inlay_blue.png"];
		me.buttonDarkRedScale9.img = cachedAssets.images["skin/button_inlay_red.png"];
		me.buttonDarkGreenScale9.img = cachedAssets.images["skin/button_inlay_green.png"];
		me.buttonDarkActiveScale9.img = cachedAssets.images["skin/button_inlay_active.png"];
		me.buttonDarkGreenActiveScale9.img = cachedAssets.images["skin/button_inlay_green_active.png"];
		me.buttonDarkRedActiveScale9.img = cachedAssets.images["skin/button_inlay_red_active.png"];
		me.buttonDarkBlueActiveScale9.img = cachedAssets.images["skin/button_inlay_blue_active.png"];
		me.buttonDarkYellowActiveScale9.img = cachedAssets.images["skin/button_inlay_yellow_active.png"];
		me.panelMainScale9.img = cachedAssets.images["skin/background.png"];
		me.panelDarkScale9.img = cachedAssets.images["skin/bar.png"];
		me.panelInsetScale9.img = cachedAssets.images["skin/panel_inset.png"];
		me.menuMainScale9.img = cachedAssets.images["skin/menu.png"];

		console.log("Assets init done");

	};

	me.preload = function(next){

	};

	me.get = function(name){
		var result = assets[name];
		if (result){
			return result;
		}else{
			var asset = assetsInfo[name];
			if (asset){
				if (asset.isLoading){
					console.log("Asset " + name + " is not ready yet, still loading");
					return undefined;
				}else{
					asset.isLoading = true;
					asset.generate(true);
				}

			}else{
				console.error("Error: asset " + name + " is not defined");
				return undefined;
			}
		}
	};

	me.put = function(name,asset){
		assets[name] = asset;
	};

	me.generate = function(name){
		if (assetsInfo[name]){
			return assetsInfo[name].generate();
		}else{
			console.error("Error: asset " + name + " is not defined");
			return undefined;
		}
	};


	return me;
}());