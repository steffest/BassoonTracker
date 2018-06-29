UI.editPanel = function(x,y,w,h,visible){
	var me = UI.element(x,y,w,h,visible);
	me.type = "EditPanel";


	var panel = UI.scale9Panel(0,0,0,0,UI.Assets.panelInsetScale9);
	me.addChild(panel);

	var labels = ["clear","copy","paste"];

	var handleButton = function(button){
		switch(button.index){
			case 0:
				Editor.clearTrack();
				UI.setStatus("Track cleared");
				break;
			case 1:
				Editor.clearPattern();
				UI.setStatus("Pattern cleared");
				break;
			case 2:
				Editor.copyTrack();
				UI.setStatus("Track copied");
				break;
			case 3:
				Editor.copyPattern();
				UI.setStatus("Pattern copied");
				break;
			case 4:
				UI.setStatus(Editor.pasteTrack() ? "Track pasted" : "Nothing to paste!");
				break;
			case 5:
				UI.setStatus(Editor.pastePattern() ? "Pattern pasted" : "Nothing to paste!");
				break;
		}
	};

	var buttonsPattern = [];
	for (var i = 0; i<6;i++){
		var button;
		button = UI.Assets.generate("buttonDark");
		button.index = i;
		button.onClick = function(){
			handleButton(this);
		};
		button.setProperties({
			label:"  " + labels[Math.floor(i/2)],
			font: fontSmall,
			textAlign: "center",
			paddingTop: 3
		});
		me.addChild(button);
		buttonsPattern.push(button);
	}




	var properties = ["left","top","width","height","name","type"];
	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined"){
				switch(key){
					default:
						me[key] = p[key];
				}
			}
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		panel.setSize(me.width,me.height);

		var buttonWidth = Math.floor(me.width/2) - 2;
		var buttonHeight = 21;

		for (var i = 0; i<6;i++){
			var side = i % 2;
			var row = Math.floor(i / 2);
			buttonsPattern[i].setProperties({
				left: side * buttonWidth + 2,
				width: buttonWidth,
				top:25 + (row*buttonHeight),
				height: buttonHeight
			});
		}
	};

	function triggerChangeEvent(){
		//EventBus.trigger(EVENT.trackStateChange,{track: me.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
	}

	me.render = function(internal){
		internal = !!internal;
		if (me.needsRendering){

			if (!me.isVisible()) return;
			me.clearCanvas();

			panel.render();

			window.fontMed.write(me.ctx,"↓Track",6,11,0);
			window.fontMed.write(me.ctx,"↓Pattern",buttonsPattern[1].left + 6,11,0);

			for (var i = 0; i<6;i++){
				buttonsPattern[i].render();
			}

		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	return me;


};

