UI.Assets = (function(){
	// generates and caches frequently used UI assets

	var me = {};

	var assets = {};

	me.preLoad = function(next){
		var spriteMap;
		var spriteSheet;
		var baseUrl = Host.getBaseUrl();
		var useVersion = Host.useUrlParams;
		
		function assetUrl(url){
			url = baseUrl + url;
			if (useVersion) url += ("?v=" + App.buildNumber);
			return url;
		}

		var createSprites = function(){
			if (spriteMap && spriteSheet){
				spriteMap.forEach(function(spriteData){
					spriteData.img = spriteSheet;
					Y.sprites[spriteData.name] = Y.sprite(spriteData);
				});
				if (next) next();
			}
		};
		
		FetchService.json(assetUrl("skin/spritemap_v4.json"),function(data){
			spriteMap = data;
			createSprites();
		});

		Y.loadImage(assetUrl("skin/spritesheet_v4.png"),function(img){
			spriteSheet = img;
			createSprites();
		})

	};

	me.buttonLightScale9 = {
		left: 2,
		top:2,
		right: 4,
		bottom: 4
	};
	me.buttonLightHoverScale9 = {
		left: 2,
		top:2,
		right: 4,
		bottom: 4
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
	me.buttonDarkRedHoverScale9 = {
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
	me.buttonDarkActiveBlueScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonDarkGreenHoverScale9 = {
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
		right:3,
		bottom: 2
	};
	me.panelDarkHoverScale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	me.panelDarkGreyScale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	me.panelDarkGreyBlueScale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	me.panelTransScale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	me.panelInsetScale9 = {
		left:2,
		top:2,
		right:2,
		bottom: 2
	};
	me.panelDarkInsetScale9 = {
		left:2,
		top:2,
		right:2,
		bottom: 2
	};
	me.buttonKeyScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonKeyHoverScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	me.buttonKeyActiveScale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
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
					hoverBackground: me.panelDarkHoverScale9,
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
					hoverBackground: me.buttonLightHoverScale9,
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
					hoverBackground:UI.Assets.buttonDarkBlueActiveScale9,
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
					hoverBackground:UI.Assets.buttonDarkRedHoverScale9,
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
					hoverBackground:UI.Assets.buttonDarkGreenHoverScale9,
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
		},
		buttonKey:{
			generate:function(andCache){
				var result;
				result = UI.button(0,0,20,20);
				result.setProperties({
					background: me.buttonKeyScale9,
					hoverBackground:UI.Assets.buttonKeyHoverScale9,
					activeBackground:UI.Assets.buttonKeyActiveScale9,
					isActive:false,
					textAlign: "center",
					font: window.fontDark
				});
				if (andCache){
					assets["buttonKey"] = result;
				}else{
					return result;
				}
			}
		}
	};

	me.init = function(){
		// should be executed when all image assets have been loaded:
		me.buttonLightScale9.img = Y.getImage("button_light");
		me.buttonLightHoverScale9.img = Y.getImage("button_light_hover");
		me.buttonDarkScale9.img = Y.getImage("button_inlay");
		me.buttonDarkBlueScale9.img = Y.getImage("button_inlay_blue");
		me.buttonDarkRedScale9.img = Y.getImage("button_inlay_red");
		me.buttonDarkRedHoverScale9.img = Y.getImage("button_inlay_red_hover");
		me.buttonDarkGreenScale9.img = Y.getImage("button_inlay_green");
		me.buttonDarkGreenHoverScale9.img = Y.getImage("button_hover_green");
		me.buttonDarkActiveScale9.img = Y.getImage("button_inlay_active");
		me.buttonDarkGreenActiveScale9.img = Y.getImage("button_inlay_green_active");
		me.buttonDarkRedActiveScale9.img = Y.getImage("button_inlay_red_active");
		me.buttonDarkBlueActiveScale9.img = Y.getImage("button_inlay_blue_active");
		me.buttonDarkYellowActiveScale9.img = Y.getImage("button_inlay_yellow_active");
		me.panelMainScale9.img = Y.getImage("background");
		me.panelDarkScale9.img = Y.getImage("bar");
		me.panelDarkHoverScale9.img = Y.getImage("bar_hover");
		me.panelDarkGreyScale9.img = Y.getImage("panel_dark_greyish");
		me.panelDarkGreyBlueScale9.img = Y.getImage("panel_dark_blueish");
		me.panelTransScale9.img = Y.getImage("panel_trans");
		me.panelInsetScale9.img = Y.getImage("panel_inset");
		me.panelDarkInsetScale9.img = Y.getImage("panel_dark");
		me.buttonKeyScale9.img = Y.getImage("keybutton");
		me.buttonKeyHoverScale9.img = Y.getImage("keybutton_hover");
		me.buttonKeyActiveScale9.img = Y.getImage("keybutton_highlight3");

		console.log("Assets init done");

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