var UI = (function(){

	var me={};

	var children = [];
	var fontSmall;
	var fontMed;
	var fontBig;

	var maxWidth = 960;
	var modalElement;
	var needsRendering =  true;
	var maxRenderTime = 0;
	var skipRenderSteps = 0;
	var renderStep = 0;
	var renderTime = 0;

	var UICache = {};

	var tracks = getUrlParameter("tracks");
	if (tracks == 8) maxWidth = 1200;
	if (tracks == 16) maxWidth = 1600;
	if (tracks >= 32) maxWidth = 3200;

	me.init = function(next){
		canvas = document.getElementById("canvas");
		ctx = canvas.getContext("2d");

		var w = window.innerWidth;
		if (w>maxWidth) w=maxWidth;
		canvas.width = w;
		canvas.height = window.innerHeight;

		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);

		var preLoader = PreLoader();
		preLoader.load([
				"skin/panel_dark.png",
				"skin/button_light.png",
				"skin/button_dark.png",
				"skin/button_dark_active.png",
				"skin/button_inlay.png",
				"skin/button_inlay_blue.png",
				"skin/button_inlay_red.png",
				"skin/button_inlay_green.png",
				"skin/button_inlay_active.png",
				"skin/button_inlay_green_active.png",
				"skin/button_inlay_blue_active.png",
				"skin/button_inlay_red_active.png",
				"skin/button_inlay_yellow_active.png",
				"skin/font.png",
				"skin/bar.png",
				"skin/line_hor.png",
				"skin/background.png",
				"skin/menu.png",
				"skin/panel_inset.png",
				"skin/lednumber.png",
				"skin/panel_inset_dark.png",
				"skin/oscilloscope.png",
				"skin/solo.png",
				"skin/mute.png",
				"skin/record.png",
				"skin/record_active.png",
				"skin/play.png",
				"skin/play_green.png",
				"skin/play_active.png",
				"skin/play_active_red.png",
				"skin/logo_grey_70.png",
				"skin/logo_colour_70.png",
				"skin/radio_active.png",
				"skin/radio_inactive.png",
				"skin/icons_small/disk.png",
				"skin/icons_small/module.png",
				"skin/icons_small/sample.png"
		],PRELOADTYPE.image,function(){
			console.log("image assets loaded");

			UI.Assets.init();
			Input.init();

			fontSmall =  BitmapFont();
			fontSmall.generate({
				image: cachedAssets.images["skin/font.png"],
				startX: 1,
				startY: 1,
				charWidth: 6,
				charHeight: 6,
				margin: 0,
				charsPerLine:30,
				chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,-_#",
				onlyUpperCase:true
			});
			window.fontSmall = fontSmall;

			fontMed =  BitmapFont();
			fontMed.generate({
				image: cachedAssets.images["skin/font.png"],
				startX: 1,
				startY: 110,
				charWidth: 8,
				charHeight: 8,
				margin: 1,
				charsPerLine:26,
				lineSpacing:1,
				chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789↑↓-#:",
				onlyUpperCase:true
			});
			fontMed.generateColor("green","rgba(80, 140, 0,0.9)");
			//fontMed.generateColor("orange","rgba(241, 162, 71,0.9)");
			fontMed.generateColor("orange","rgba(161, 82, 0,0.9)");
			window.fontMed = fontMed;

			fontBig =  BitmapFont();
			fontBig.generate({
				image: cachedAssets.images["skin/font.png"],
				startX: 1,
				startY: 10,
				charWidth: 11,
				charHeight: 11,
				margin: 1,
				charsPerLine:20,
				onlyUpperCase:true
			});
			window.fontBig = fontBig;

			var fontLed =  BitmapFont();
			fontLed.generate({
				image: cachedAssets.images["skin/font.png"],
				startX: 107,
				startY: 68,
				charWidth: 8,
				charHeight: 13,
				margin: 0,
				charsPerLine:20,
				chars:" 0123456789"
			});
			window.fontLed = fontLed;

			UI.mainPanel = UI.MainPanel();
			children.push(UI.mainPanel);

			render();

			// load demo mod at startup
			//Tracker.load('demomods/spacedeb.mod');
			Tracker.load('demomods/Tinytune.mod');

			if (next) next();

		});

	};

	me.setSize = function(newWidth,newHeight){
		if (newWidth>maxWidth) newWidth = maxWidth;
		if ((newWidth != canvas.width) || (newHeight != canvas.height)){
			ctx.clearRect(0,0,canvas.width,canvas.height);
			canvas.width = newWidth;
			canvas.height = newHeight;
			me.mainPanel.setLayout(0,0,newWidth,newHeight);

			if (modalElement){
				modalElement.setProperties({width: newWidth, height: newHeight});
			}
			needsRendering = true;
		}
	};

	var render = function(){
		var doRender = true;

		// if Tracker is playing in audio lookahead mode (PlaybackEngine.simple)
		// set the currect Tracker position to whatever the audio is playing
		// Audio First!

		if (Tracker.isPlaying() && Tracker.playBackEngine == PLAYBACKENGINE.SIMPLE){
			var state = Tracker.getStateAtTime(Audio.context.currentTime);
			if (state){
				if (state.patternPos != UICache.patternPos){
					Tracker.setCurrentPatternPos(state.patternPos);
					UICache.patternPos = state.patternPos;
				}
				if (state.songPos != UICache.songPos){
					Tracker.setCurrentSongPosition(state.songPos);
					UICache.songPos = state.songPos;
				}
			}
		}

		if (skipRenderSteps){
			renderStep++;
			doRender = (renderStep>skipRenderSteps);
		}
		if(doRender){
			renderStep = 0;
			var startRenderTime = 0;
			if (Audio.context) startRenderTime = Audio.context.currentTime;
			EventBus.trigger(EVENT.screenRefresh);
			if (needsRendering){
				children.forEach(function(element){
					if (element.needsRendering) {
						element.render();
					}
				});

				UI.mainPanel.visualiser.render();

				if (modalElement){
					modalElement.render();
					needsRendering = false;
				}
			}
			if (startRenderTime){
				renderTime = Audio.context.currentTime - startRenderTime;
				maxRenderTime = Math.max(renderTime,maxRenderTime);
				if (maxRenderTime>0.06) skipRenderSteps=1;
				if (maxRenderTime>0.08) skipRenderSteps=2;
				if (maxRenderTime>0.1) skipRenderSteps=4;
			}
		}
		window.requestAnimationFrame(render);
	};

	me.toggleSampleEditor = function(){
		if (UI.mainPanel.getCurrentView() == "sample"){
			UI.mainPanel.setView("main");
		}else{
			UI.mainPanel.setView("sample");
		}
	};

	me.toggleDiskOperations = function(){
		if (UI.mainPanel.getCurrentView() == "diskop"){
			UI.mainPanel.setView("main");
		}else{
			UI.mainPanel.setView("diskop");
		}
	};

	me.toggleOptions = function(){
		if (UI.mainPanel.getCurrentView() == "options"){
			UI.mainPanel.setView("main");
		}else{
			UI.mainPanel.setView("options");
		}
	};

	me.showMain = function(){
		UI.mainPanel.setView("main");
	};

	me.setModalElement = function(elm){
		modalElement = elm;
	};

	me.removeModalElement = function(){
		if (modalElement){

		}
		modalElement = undefined;
		window.requestAnimationFrame(render);
	};

	me.getChildren = function(){
		return children;
	};

	me.getEventElement = function(x,y){
		var target = undefined;
		for (var i = 0, len = children.length; i<len; i++){
			var elm = children[i];
			if (elm.isVisible() && elm.containsPoint(x,y)){
				target = elm;
				break;
			}
		}

		if (target && target.children && target.children.length){
			target = target.getElementAtPoint(x,y);
		}
		return target;
	};

	me.stats = function(){
		return {
			maxRenderTime : maxRenderTime,
			currentRenderTime: renderTime,
			skipRenderSteps: skipRenderSteps
		}
	};

	me.children = children;

	return me;

}());



