var UI = (function(){

	var me={};

	var children = [];
	var fontSmall;
	var fontMed;
	var fontBig;

	var maxWidth = 960;

	var keyboardTable = KEYBOARDTABLE.azerty;

	var resizeTimer = 0;

	var touchData = {};

	me.init = function(){
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
				"skin/radio_inactive.png"
		],PRELOADTYPE.image,function(){
			console.log("image assets loaded");

			UI.Assets.init();

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
				chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789↑↓-#",
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


			// keep the analyser out of the mainframe as this needs updating every frame;
			var analyser = UI.visualiser(UI.mainPanel.col2X,UI.mainPanel.equaliserPanelY,UI.mainPanel.col4W,UI.mainPanel.equaliserPanelHeight,true);
			window.a = analyser;
			analyser.connect(Audio.masterVolume);
			analyser.name = "mainAnalyser";
			analyser.onclick = function(){
				analyser.nextMode();
			};
			children.push(analyser);
			analyser.setParent(window);

			render();

			// load demo mod at startup
			Tracker.load('demomods/spacedeb.mod');
		});

		var currentEventTarget;

		canvas.addEventListener("mousedown",function(e){
			var rect = canvas.getBoundingClientRect();
			var x = e.clientX - rect.left;
			var y = e.clientY  - rect.top;

			for (var i = 0, len = children.length; i<len; i++){
				var elm = children[i];
				if (elm.isVisible() && elm.containsPoint(x,y)){
					currentEventTarget = elm;
					break;
				}
			}

			if (currentEventTarget && currentEventTarget.children && currentEventTarget.children.length){
				currentEventTarget = currentEventTarget.getElementAtPoint(x,y);
			}
			touchData.isDown = true;
			touchData.startX = x;
			touchData.startY = y;
			console.error("final target:",currentEventTarget);
			if (currentEventTarget && currentEventTarget.onStartDrag){
				currentEventTarget.onStartDrag(touchData);
			}
		});

		canvas.addEventListener("mousemove",function(e){
			if (touchData.isDown && currentEventTarget){
				if (currentEventTarget.onDrag){

					var rect = canvas.getBoundingClientRect();
					var x = e.clientX - rect.left;
					var y = e.clientY  - rect.top;

					touchData.dragX = x;
					touchData.dragY = y;

					currentEventTarget.onDrag(touchData);
				}
			}
		});

		canvas.addEventListener("mouseup",function(e){
			touchData.isDown = false;
			if (currentEventTarget){
				if (currentEventTarget.onclick){
					currentEventTarget.onclick(e);
				}
				if (currentEventTarget.onTouchUp){
					currentEventTarget.onTouchUp(e);
				}
			}
			currentEventTarget = false;
		});

		canvas.addEventListener("keydown",function(e){

			var keyCode = e.keyCode;
			var key = e.key;

			if (key && (keyCode>40) && (keyCode<200)){
				var note = keyboardTable[key];
				var doPlay = true;
				if (Tracker.isRecording()){
					if (Tracker.getCurrentTrackPosition() > 0){
						// cursorPosition is not on note
						doPlay = false;
						var re = /[0-9A-Fa-f]/g;
						if (re.test(key)){
							Tracker.putNoteParam(Tracker.getCurrentTrackPosition(),parseInt(key,16));
							Tracker.moveCurrentPatternPos(1);
						}
					}else{
						if (note){
							Tracker.putNote(Tracker.getCurrentSampleIndex(),note.period);
							if (Tracker.isPlaying()){
								doPlay = false;
							}else{
								Tracker.moveCurrentPatternPos(1);
							}
						}
					}
				}

				if (doPlay && note){
					Audio.playSample(Tracker.getCurrentSampleIndex(),note.period);
					return;
				}

			}

			switch(keyCode){
				case 8:// backspace
					if (Tracker.isRecording()){
						Tracker.putNote(0,0);
						Tracker.moveCurrentPatternPos(1);
					}else{
						Tracker.playPatternStep(Tracker.getCurrentTrackPosition());
						Tracker.moveCurrentPatternPos(-1);
						// on Mac this should probably be delete ...
					}

					break;
				case 13:// enter
					Tracker.playPatternStep(Tracker.getCurrentTrackPosition());
					Tracker.moveCurrentPatternPos(1);
					break;
				case 16:// shift
					//Tracker.playPattern();
					break;
				case 32:// space
					Tracker.toggleRecord();
					break;
				case 35:// end
					Tracker.setCurrentPatternPos(63);
					break;
				case 36:// home
					Tracker.setCurrentPatternPos(0);
					break;
				case 37:// left
					Tracker.moveCursorPosition(-1);
					break;
				case 38:// up
					Tracker.moveCurrentPatternPos(-1);
					break;
				case 39:// right
					Tracker.moveCursorPosition(1);
					break;
				case 40: // down
					Tracker.moveCurrentPatternPos(1);
					break;
				case 46: // delete
					if (Tracker.isRecording()){
						Tracker.putNote(0,0);
						Tracker.moveCurrentPatternPos(1);
					}
					break;
			}
		});


		canvas.addEventListener("dragenter", dragenter, false);
		canvas.addEventListener("dragover", dragover, false);
		canvas.addEventListener("drop", drop, false);

		window.addEventListener("resize",function(){
			// throttle resize events - resizing is expensive as all the canvas cache needs to be regenerated
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function(){
				me.setSize(window.innerWidth,window.innerHeight)
			},100);

		});

		function dragenter(e) {
			e.stopPropagation();
			e.preventDefault();
		}

		function dragover(e) {
			e.stopPropagation();
			e.preventDefault();
		}

		function drop(e) {
			e.stopPropagation();
			e.preventDefault();

			var dt = e.dataTransfer;
			var files = dt.files;

			Tracker.handleUpload(files);
		}


	};

	me.setSize = function(newWidth,newHeight){
		if (newWidth>maxWidth) newWidth = maxWidth;
		if ((newWidth != canvas.width) || (newHeight != canvas.height)){
			ctx.clearRect(0,0,canvas.width,canvas.height);
			canvas.width = newWidth;
			canvas.height = newHeight;
			me.mainPanel.setLayout(0,0,newWidth,newHeight);
		}
	};


	var render = function(){
		EventBus.trigger(EVENT.screenRefresh);
		children.forEach(function(element){
			if (element.needsRendering) element.render();
		});

		window.requestAnimationFrame(render);
	};

	me.toggleSampleEditor = function(){
		if (UI.mainPanel.getCurrentView() == "sample"){
			UI.mainPanel.setView("main");
		}else{
			UI.mainPanel.setView("sample");
		}
	};

	me.showMain = function(){
		UI.mainPanel.setView("main");
	};

	me.children = children;


	return me;

}());



