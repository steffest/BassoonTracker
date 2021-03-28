var canvas;
var ctx;

var UI = (function(){

	var me={};
	
	var screenWidth;
	var screenHeight;
	var useDevicePixelRatio = false;

	var children = [];
	var fontSmall;
	var fontMed;
	var fontBig;
	var fontFT;
	var fontCondensed;
	var fontDark;

	var maxWidth = 1200;
	var maxHeight = 2000;
	var minHeight = 200;
	var modalElement;
	var needsRendering =  true;
	var skipRenderSteps = 0;
	var renderStep = 0;
	var beginTime = 0;
	var beginRenderTime = 0;
	var lastRenderTime = 0;
	var beginMeasure = 0;
	var currentMeasure = 0;
	var endMeasure = 0;
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
	
	
	// some light polyfills - mainly to ensure the App can still show the "browser not supported" message
	var nowFunction;
	if (window.performance && performance.now){
		nowFunction = function(){ return performance.now()};
	}else{
		nowFunction = Date.now;
	}

	if (!window.requestAnimationFrame){
		var lastTime = 0;
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); },
				timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	}
	

	me.init = function(next){
		canvas = document.getElementById("canvas");
		ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled=false;
		
		var w = window.innerWidth;
		var h = window.innerHeight;

		if (w>maxWidth) w=maxWidth;
		if (h>maxHeight) h=maxHeight;

		screenWidth = w;
		screenHeight = h;
		canvas.width =screenWidth;
		canvas.height=screenHeight;

		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);
		
		ctx.fillStyle = "#78828F"
		ctx.font = "20px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("Loading ...", canvas.width/2, canvas.height/2);

		if (debug) UI.measure("Create Main Canvas");
		
		
		UI.Assets.preLoad(function(){

			if (debug) UI.measure("UI sprites");
			console.log("UI assets loaded");
			initAssets();
			Input.init();
			if (debug) UI.measure("Input Init");
			render();
			if (debug) UI.measure("First render");

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
		console.log("init plugin");
		if (config.canvas){
			canvas = config.canvas;
		}else{
			canvas = document.getElementById("canvas");
			var w = window.innerWidth;

			if (w>maxWidth) w=maxWidth;
			if (w>maxHeight) w=maxHeight;
			canvas.width = w;
			//canvas.height = window.innerHeight;
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
		if (newHeight>maxHeight) newHeight = maxHeight;
		if (newHeight<minHeight) newHeight = minHeight;

		if ((newWidth !== canvas.width) || (newHeight !== canvas.height)){
			ctx.clearRect(0,0,canvas.width,canvas.height);
			screenWidth = newWidth;
			screenHeight = newHeight;

			me.scaleToDevicePixelRatio(useDevicePixelRatio);
            me.mainPanel.setSize(newWidth,newHeight);
			//me.mainPanel.setLayout(0,0,newWidth,newHeight);

			if (modalElement){
				modalElement.setProperties({width: newWidth, height: newHeight});
			}
			needsRendering = true;
		}
	};
	
	me.scaleToDevicePixelRatio = function(active){
		useDevicePixelRatio = !!active;
		if (active && devicePixelRatio>1){
			canvas.width = screenWidth * devicePixelRatio;
			canvas.height = screenHeight * devicePixelRatio;

			ctx.scale(devicePixelRatio, devicePixelRatio);
			ctx.imageSmoothingEnabled = false;
		}else{
			canvas.width = screenWidth;
			canvas.height = screenHeight;
		}
		canvas.style.width = screenWidth + 'px';
		canvas.style.height = screenHeight + 'px';

		UI.mainPanel.refresh();
		
	}

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
			lineSpacing: 3,
			chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890.,-_",
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
			debug: false
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

		if (debug) UI.measure("Generate font");
		
		UI.Assets.init();
		UI.mainPanel = UI.MainPanel();
		children.push(UI.mainPanel);
		if (debug) UI.measure("Generate Main Panel");
	};

	var render = function(time){
		
		var doRender = true;

		if (Tracker.isPlaying()){
			var state = Tracker.getStateAtTime(Audio.context.currentTime+0.01);
			if (state){
				if (state.patternPos !== UICache.patternPos){
					Tracker.setCurrentPatternPos(state.patternPos);
					UICache.patternPos = state.patternPos;
				}
				if (state.songPos !== UICache.songPos){
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
			beginRenderTime = nowFunction();
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

			if (modalElement && modalElement.needsRendering){
				UI.mainPanel.refresh();
				needsRendering = true;
			}
			
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
					Logger.info("init " + Math.round(endMeasure));
					fpsCalculated = true;
				}
                
                EventBus.trigger(EVENT.second);
            }


        }
        
		window.requestAnimationFrame(render);
	};
	
	me.setModalElement = function(elm){
		modalElement = elm;
		Input.setFocusElement(elm);
	};

	me.getModalElement = function(){
		return modalElement;
	};

	me.removeModalElement = function(){
		if (modalElement){
			Input.clearFocusElement();
		}
		modalElement = undefined;
		UI.mainPanel.refresh();
		needsRendering = true;
	};


	me.setSelection = function(_selection){
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

	me.deleteSelection = function(){
		if (selection){
			selection(SELECTION.DELETE);
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

	me.showDialog = function(text,onOk,onCancel,useInput){
		var dialog = UI.modalDialog();
		dialog.setProperties({
			width: UI.mainPanel.width,
			height: UI.mainPanel.height,
			top: 0,
			left: 0,
			ok: !!onOk,
			cancel: !!onCancel,
			input: !!useInput
		});

		dialog.onClick = function(touchData){
			if (useInput){
				var elm = dialog.getElementAtPoint(touchData.x,touchData.y);
				if (elm.name === "dialoginput"){
					elm.activate();
					return;
				}
			}
			if (onCancel){
				var elm = dialog.getElementAtPoint(touchData.x,touchData.y);
				if (elm && elm.name){
					if (elm.name === "okbutton"){
						if (typeof onOk === "function") onOk(dialog.inputValue);
					}else{
						if (typeof onCancel === "function") onCancel();
					}
					dialog.close();
				}
			}else{
				dialog.close();
				if (onOk) onOk(dialog.inputValue);
			}
		};

		dialog.onKeyDown = function(keyCode){
			switch (keyCode){
				case 13:
					var value = dialog.inputValue;
					dialog.close();
					if (onOk) onOk(value);
					return true;
				case 27:
					dialog.close();
					if (onCancel) onCancel();
					return true;
			}
		}

		dialog.setText(text);
		UI.setModalElement(dialog);
	}


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
	
	me.startMeasure = function(){
		if (Audio.context){
			beginMeasure = Audio.context.currentTime;
			currentMeasure = beginMeasure;
		}
	}
	me.measure = function(message){
		if (Audio.context){
			var time = (Audio.context.currentTime - currentMeasure) * 1000;
			currentMeasure = Audio.context.currentTime;
			console.warn(message + ": " + time);
		}
	}
	me.endMeasure = function(){
		if (Audio.context){
			endMeasure = (Audio.context.currentTime - beginMeasure) * 1000;
			if (debug) console.warn( "Total time: " + endMeasure);
		}
	}

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
		var now = nowFunction();
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



