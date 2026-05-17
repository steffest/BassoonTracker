import Layout from "./app/layout.js";
import EventBus from "../eventBus.js";
import {EVENT, SELECTION, SETTINGS} from "../enum.js";
import Input from "./input.js";
import Settings from "../settings.js";
import App from "../app.js";
import Host from "../host.js";
import Assets from "./assets.js";
import Y from "./yascal/yascal.js";
import Font from "./font.js";
import MainPanel from "./mainPanel.js";
import Tracker from "../tracker.js";
import Audio from "../audio.js";
import Logger from "../log.js";
import ToolTip from "./components/tooltip.js";
import FetchService from "../fetchService.js";

var UI = (function(){

	var me={};
	me.font = Font;

	var canvas;
	var ctx;
	
	var screenWidth;
	var screenHeight;
	var useDevicePixelRatio = false;

	var children = [];

	var mainPanel;

	var maxHeight =  Layout.maxHeight;
	var minHeight = Layout.minheight;
	var modalElement;
	var toolTipElement;
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
	var initDone = false;

	var UICache = {};

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
		var useVersion = Host.useUrlParams;

		canvas = document.getElementById("canvas");
		ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		ctx.alpha = false;
		
		var w = window.innerWidth;
		var h = window.innerHeight;

		if (h>maxHeight) h=maxHeight;

		screenWidth = w;
		screenHeight = h;
		canvas.width =screenWidth;
		canvas.height=screenHeight;
		canvas.style.imageRendering = "pixelated";

		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);
		
		ctx.fillStyle = "#78828F"
		ctx.font = "20px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("Loading ...", canvas.width/2, canvas.height/2);

		Assets.preLoad(function(){
			//if (debug) UI.measure("UI sprites");
			console.log("UI assets loaded");
			initAssets();
			Input.init();

			//if (debug) UI.measure("Input Init");
			render();
			//if (debug) UI.measure("First render");

			// check version
			if (useVersion && typeof versionNumber !== "undefined"){
				FetchService.json("package.json?ts=" + new Date().getTime(),function(result){
					if (result && result.version && result.version > versionNumber){
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

			if (w>maxHeight) w=maxHeight;
			canvas.width = w;
			//canvas.height = window.innerHeight;
		}

		ctx = canvas.getContext("2d");
		ctx.fillStyle = "black";
		ctx.fillRect(0,0,canvas.width,canvas.height);

		Settings.baseUrl = config.baseUrl;
		App.isPlugin = true;
		window.buildNumber = Math.random();
		Assets.preLoad(function(){

			console.log("UI assets loaded");
			initAssets();
			render();


			Settings.readSettings();
			App.init();
			if (config.callback) config.callback();

		});

	};


	me.setSize = function(newWidth,newHeight){
		if (newWidth>window.innerWidth) newWidth = window.innerWidth;
		if (newHeight>Layout.maxHeight) newHeight = Layout.maxHeight;
		if (newHeight>window.innerHeight) newHeight = window.innerHeight;
		if (newHeight<Layout.minHeight) newHeight = Layout.minHeight;


		if (true || (newWidth !== canvas.width) || (newHeight !== canvas.height)){
			ctx.clearRect(0,0,canvas.width,canvas.height);
			screenWidth = newWidth;
			screenHeight = newHeight;

			me.scaleToDevicePixelRatio(useDevicePixelRatio);
            mainPanel.setSize(newWidth,newHeight);
			//me.mainPanel.setLayout(0,0,newWidth,newHeight);

			if (modalElement){
				modalElement.width = newWidth;
				modalElement.height = newHeight;
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

		mainPanel.refresh();

	}

	var initAssets = function(){
		Font.init(Y.getImage("font"));

		//if (debug) UI.measure("Generate font");
		
		Assets.init();
		mainPanel = new MainPanel();
		UI.mainPanel = mainPanel; // TODO FIXME
		children.push(mainPanel);
		initDone = true;
		//if (debug) UI.measure("Generate Main Panel");
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
				mainPanel.refresh();
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




				if (toolTipElement){
					// render on top of everything;
					//var tooltip = toolTipElement.render(true);
					//if (tooltip ) ctx.drawImage(tooltip,toolTipElement.left,toolTipElement.top);

					toolTipElement.render();
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

	me.getCanvas = function(){
		return canvas;
	}

	me.setCursor = function(cursor){
		if (canvas && canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
	};

	me.getContext = function(){
		return ctx;
	}

	me.removeModalElement = function(){
		if (modalElement){
			Input.clearFocusElement();
		}
		modalElement = undefined;
		mainPanel.refresh();
		needsRendering = true;
	};

	me.showTooltip = function(text,x,y){
		if (!toolTipElement){
			toolTipElement = new ToolTip();
			mainPanel.addChild(toolTipElement);
		}
		toolTipElement.show();
		toolTipElement.update({
			text: text,
			left: Math.floor(x),
			top: Math.floor(y) - 24
		});
		toolTipElement.needsRendering = true;
		needsRendering = true;
	}

	me.hideTooltip = function(){
		if (toolTipElement && toolTipElement.isVisible()) toolTipElement.hide();
	}

	me.hasFloatingElements = function(){
		return initDone &&  ((toolTipElement && toolTipElement.isVisibleAndNotTransparent()) || mainPanel.hasFloatingElements());
	}


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
		dialog.width = mainPanel.width;
		dialog.height = mainPanel.height;
		dialog.top = 0;
		dialog.left = 0;
		dialog.ok = !!onOk;
		dialog.cancel = !!onCancel;
		dialog.input = !!useInput;

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
			//if (debug) console.warn( "Total time: " + endMeasure);
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

export default UI;



