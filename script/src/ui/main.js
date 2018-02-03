var canvas;
var ctx;

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

		UI.Assets.preLoad(function(){

			console.log("UI assets loaded");
			initAssets();

			render();

			// load demo mod at startup
			//Tracker.load('demomods/spacedeb.mod');

			var initialFile = getUrlParameter("file");
			if (initialFile){
				initialFile = decodeURIComponent(initialFile);
			}else{
				initialFile = 'demomods/Tinytune.mod';
			}
			Tracker.load(initialFile,true);

			if (next) next();

		});

	};

	me.initPlugin = function(config){
		if (config.canvas){
			canvas = config.canvas;
		}else{
			canvas = document.getElementById("canvas");
			var w = window.innerWidth;
			if (w>maxWidth) w=maxWidth;
			canvas.width = w;
			canvas.height = window.innerHeight;
		}

		ctx = canvas.getContext("2d");
		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);

		Settings.baseUrl = config.baseUrl;
		App.isPlugin = true;
		buildNumber = Math.random();
		UI.Assets.preLoad(function(){

			console.log("UI assets loaded");
			initAssets();
			render();


			Settings.readSettings();
			App.init();
			if (config.callback) config.callback();

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

	var initAssets = function(){
		var fontImage =  Y.getImage("font");

		fontSmall =  BitmapFont();
		fontSmall.generate({
			image: fontImage,
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
			image: fontImage,
			startX: 1,
			startY: 110,
			charWidth: 8,
			charHeight: 8,
			margin: 1,
			charsPerLine:26,
			lineSpacing:1,
			chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789↑↓-#:.!©_?;()=/+<>&[]{}\\*%$'\"`°,",
			onlyUpperCase:true
		});
		fontMed.generateColor("green","rgba(80, 140, 0,0.9)");
		fontMed.generateColor("orange","rgba(161, 82, 0,0.9)");
		window.fontMed = fontMed;

		fontBig =  BitmapFont();
		fontBig.generate({
			image: fontImage,
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
			image: fontImage,
			startX: 107,
			startY: 68,
			charWidth: 8,
			charHeight: 13,
			margin: 0,
			charsPerLine:20,
			chars:" 0123456789"
		});
		window.fontLed = fontLed;


		UI.Assets.init();
		UI.mainPanel = UI.MainPanel();
		children.push(UI.mainPanel);

		Input.init();
	};

	var render = function(time){
		var doRender = true;

		if (Tracker.isPlaying()){
			var state = Tracker.getStateAtTime(Audio.context.currentTime+0.01);
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
				UI.mainPanel.vumeter.render();

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

	me.setModalElement = function(elm){
		modalElement = elm;
	};

	me.getModalElement = function(){
		return modalElement;
	};

	me.removeModalElement = function(){
		if (modalElement){

		}
		modalElement = undefined;
		UI.mainPanel.refresh();
		needsRendering = true;
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

	me.setLoading = function(){
		me.setStatus("Loading");
		EventBus.trigger(EVENT.songLoading);
	};

	me.setStatus = function(status){
		EventBus.trigger(EVENT.statusChange,{status:status});
	};

	me.setInfo = function(info,source,url){
		EventBus.trigger(EVENT.statusChange,{info:info,source: source, url:url});
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



