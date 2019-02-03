var canvas;
var ctx;

var UI = (function(){

	var me={};

	var children = [];
	var fontSmall;
	var fontMed;
	var fontBig;
	var fontFT;
	var fontCondensed;
	var fontDark;

	var maxWidth = 1200;
	var minHeight = 800;
	var modalElement;
	var needsRendering =  true;
	var skipRenderSteps = 0;
	var renderStep = 0;
	var beginTime = 0;
	var beginRenderTime = 0;
	var lastRenderTime = 0;
	var frames = 0;
	var fps;
	var minFps = 100;
	var fpsList = [];
	var renderfpsList = [];
	var selection;
	var prevSelection;
	var prevEventExpired = 0;
	var maxRenderFps = 60;
	var fpsCalculated = false;

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
				initialFile = Host.getBaseUrl() + 'demomods/Tinytune.mod';
			}
			Tracker.load(initialFile,true);


			// check version
			if (typeof versionNumber !== "undefined"){
				FetchService.json("package.json?ts=" + new Date().getTime(),function(result){
					if (result && result.version && result.version !== versionNumber){
						console.error("app needs updating");

						var lastMessage = localStorage.getItem("updatemessageshown") || 0;
						lastMessage = parseInt(lastMessage,10);
						if (isNaN(lastMessage)) lastMessage=0;

						window.reload = function(){
							localStorage.setItem("updatemessageshown",new Date().getTime());
							window.location.reload(true);
						};

						if (new Date().getTime() - lastMessage > 1000*60*30){
							var message = document.createElement("div");
							message.className = "message";
							message.innerHTML = 'A new version of BassoonTracker is available. Please <a href="#" onclick="reload()">refresh your browser</a>';
							document.body.appendChild(message);
						}
					}
				});
			}


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
		//if (newHeight<minHeight) newHeight = minHeight;

		if ((newWidth != canvas.width) || (newHeight != canvas.height)){
			ctx.clearRect(0,0,canvas.width,canvas.height);
			canvas.width = newWidth;
			canvas.height = newHeight;
            me.mainPanel.setSize(newWidth,newHeight);
			//me.mainPanel.setLayout(0,0,newWidth,newHeight);

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
			spaceWidth: 6,
			margin: 0,
			charsPerLine:42,
			chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.+-_#>",
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
			spaceWidth: 8,
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
			spaceWidth: 11,
			margin: 1,
			charsPerLine:20,
			onlyUpperCase:true
		});
		window.fontBig = fontBig;

		fontFT =  BitmapFont();
		fontFT.generate({
			image: fontImage,
			startX: 1,
			startY: 145,
			charHeight: 12,
			spaceWidth: 4,
			margin: 1,
			charsPerLine:[26,26,40],
			lineSpacing:0,
			chars: 	   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890#©_-&\"'()!.,?+=*$/\\;:[]{}",
			charWidth: "888888883888998888888899987777757735739777757578987777777777778868864553348767888435555",
			onlyUpperCase:false,
			debug: true
		});
		window.fontFT = fontFT;


		fontCondensed =  BitmapFont();
		fontCondensed.generate({
			image: fontImage,
			startX: 1,
			startY: 184,
			charHeight: 10,
			spaceWidth: 5,
			margin: 0,
			charsPerLine:[26,26,10],
			lineSpacing:0,
			chars: 	   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
			charWidth: "6666556625656666666666666655555455245365555454566555",
			onlyUpperCase:false
		});
		window.fontCondensed = fontCondensed;

		var fontSuperCondensed =  BitmapFont();
		fontSuperCondensed.generate({
			image: fontImage,
			startX: 2,
			startY: 208,
			charHeight: 8,
			charWidth: 4,
			spaceWidth: 4,
			margin: 0,
			charsPerLine:[45],
			lineSpacing:0,
			chars: 	   "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_.-#+><↑↓",
			onlyUpperCase:true
		});
		fontSuperCondensed.generateColor("green","rgba(80, 140, 0,0.9)");
		fontSuperCondensed.generateColor("orange","rgba(161, 82, 0,0.9)");
		window.fontSuperCondensed = fontSuperCondensed;

		var fontLed =  BitmapFont();
		fontLed.generate({
			image: fontImage,
			startX: 107,
			startY: 68,
			charWidth: 8,
			charHeight: 13,
			spaceWidth: 8,
			margin: 0,
			charsPerLine:20,
			chars:" 0123456789-"
		});
		window.fontLed = fontLed;

        var fontLedBig =  BitmapFont();
        fontLedBig.generate({
            image: fontImage,
            startX: 9,
            startY: 82,
            charWidth: 14,
            charHeight: 22,
            spaceWidth: 8,
            margin: 0,
            charsPerLine:11,
            chars:" 0123456789"
        });
        window.fontLedBig = fontLedBig;

		var fontDark =  BitmapFont();
		fontDark.generate({
			image: fontImage,
			startX: 1,
			startY: 216,
			charHeight: 9,
			spaceWidth: 5,
			margin: 0,
			charsPerLine:[40],
			lineSpacing:0,
			chars: 	   "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890():-",
			charWidth: "7777667736768777877778887746666666664434",
			onlyUpperCase:true
		});
		window.fontDark = fontDark;


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

        var startRenderTime = Audio.context ? Audio.context.currentTime : 0;
		
		if (doRender){
			beginRenderTime = (performance || Date).now();
			var renderFps = 1000/(beginRenderTime-lastRenderTime);
			renderfpsList.push(renderFps);
			if (renderfpsList.length>20) renderfpsList.shift();
			if (renderFps>maxRenderFps){
				doRender = false;
			}
		}
		
		if(doRender){
			renderStep = 0;
			lastRenderTime = beginRenderTime;
			EventBus.trigger(EVENT.screenRefresh);
			if (needsRendering){
				children.forEach(function(element){
					if (element.needsRendering) {
						element.render();
					}
				});

                EventBus.trigger(EVENT.screenRender);

				if (modalElement){
					modalElement.render();
					needsRendering = false;
				}

			}
		}

        if (startRenderTime){
            beginTime = beginTime || startRenderTime;
            frames++;
            if (startRenderTime>beginTime+1){
                fps = frames / (startRenderTime-beginTime);
                minFps = Math.min(minFps,fps);
                beginTime = startRenderTime;
                frames=0;

                fpsList.push(fps);
                if (fpsList.length>20) fpsList.shift();
                
                if (!fpsCalculated && fpsList.length>5){
					Logger.info("fps");
					fpsCalculated = true;
				}
                
                EventBus.trigger(EVENT.second);
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

	me.setSelection = function(_selection){
		console.log("setting selection");
		selection = _selection;
		prevSelection = selection;
	};

	me.getSelection = function(){
		return selection;
	};

	me.clearSelection = function(){
		if (selection){
			var doClear = selection(SELECTION.RESET);
			if (doClear) selection = undefined;
		}

	};

	me.copySelection = function(andClear){
		if (selection){
			selection(SELECTION.COPY);
			if (andClear) selection(SELECTION.RESET);
		}
		selection = undefined;
	};

	me.cutSelection = function(andClear){
		if (selection){
			selection(SELECTION.CUT);
			if (andClear) selection(SELECTION.RESET);
		}
		selection = undefined;
	};

	me.pasteSelection = function(andClear){
		if (!selection && prevSelection){
			selection = prevSelection;
			selection(SELECTION.POSITION);
		}
		if (selection){
			selection(SELECTION.PASTE);
			if (andClear) selection(SELECTION.RESET);
		}
		selection = undefined;
	};

	me.showContextMenu = function(properties){
		EventBus.trigger(EVENT.showContextMenu,properties);
	};

	me.hideContextMenu = function(){
		EventBus.trigger(EVENT.hideContextMenu);
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

	me.getInternalPoint = function(x,y,element){
		var offset = {left: 0, top: 0};
		while (element.parent){
			offset.left += element.left;
			offset.top += element.top;
			element = element.parent;
		}
		return {x: x - offset.left, y: y - offset.top}
	};

	me.setLoading = function(){
		me.setStatus("Loading",true);
		EventBus.trigger(EVENT.songLoading);
	};

	me.setStatus = function(status,showSpinner){
		EventBus.trigger(EVENT.statusChange,{status:status, showSpinner: !!showSpinner});
	};

	me.setInfo = function(info,source,url){
		EventBus.trigger(EVENT.statusChange,{info:info,source: source, url:url});
	};

	me.stats = function(){
		return {
			fps : fps,
			minFps : minFps,
			averageFps: average(fpsList),
			averageRenderFps: average(renderfpsList),
			fpsList: fpsList,
			skipRenderSteps: skipRenderSteps
		}
	};

	me.children = children;

	me.getAverageFps = function(){
		return fpsList.length>2 ? average(fpsList) : 60;
	};

	me.resetAverageFps = function(){
		var last = fpsList.pop();
		fpsList = last ? [last] : [];
	};

	me.skipFrame = function(value){
		console.log("Setting SkipFrame to " + value);
		skipRenderSteps = value;
		SETTINGS.skipFrame = value;
		EventBus.trigger(EVENT.skipFrameChanged,skipRenderSteps);
	};

	me.getSkipFrame = function(){
		return skipRenderSteps;
	};

	EventBus.on(EVENT.clockEventExpired,function(){
		var now = new Date().getTime();
		if (now-prevEventExpired>2000){
			Logger.warn("throttling back");
			if (skipRenderSteps<4){
				me.skipFrame(skipRenderSteps+1);
			}else{
                Logger.warn("Browser can't keep up");
			}
			prevEventExpired = now;
		}

	});

	function average(arr){
		if (!arr.length) return 0;
		var total = 0;
		for (var i = 0, max = arr.length; i<max; i++) total+=arr[i];
		return total/max;
	}

	return me;

}());



