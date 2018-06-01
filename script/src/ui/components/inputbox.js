UI.inputbox = function(initialProperties){
	var me = UI.element();
	var properties = ["left","top","width","height","name","type","onChange","backgroundImage"];
	var value = "";
	var isActive;
	var isCursorVisible;
	var cursorPos;
	var backgroundImage = "panel_dark";

	me.setProperties = function(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined") me[key] = p[key];
		});

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);
		if (background) background.setSize(me.width,me.height);

		if (p["value"]) value = p["value"];
		if (p["backgroundImage"]) backgroundImage = p["backgroundImage"];
	};

	if (initialProperties) me.setProperties(initialProperties);

	var background = UI.scale9Panel(0,0,me.width,me.height,{
		img: Y.getImage(backgroundImage),
		left:3,
		top:3,
		right:2,
		bottom: 2
	});
	background.ignoreEvents = true;
	me.addChild(background);



	me.render = function(internal){
		internal = !!internal;
		if (!me.isVisible()) return;

		if (this.needsRendering){
			background.render();

			var textX = 0;
			if (value && fontMed){
				textX = 10;
				var textY = 6;
				fontMed.write(me.ctx,value,textX,textY,0);
			}

			if (isCursorVisible){
				me.ctx.fillStyle = "rgba(255,255,255,0.7)";
				var charWidth = 9;
				var cursorX = textX + cursorPos*charWidth + 8;
				me.ctx.fillRect(cursorX,4,2,me.height-8);
			}

		}
		this.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	me.setValue = function(newValue,internal){
		value = newValue;
		me.refresh();
		if (!internal && me.onChange) me.onChange(value);
	};
	me.getValue = function(){
		return value;
	};

	me.getItemAtPosition = function(x,y){
		y = y-startY;
		var index = Math.floor(y/lineHeight) + visibleIndex;
		if (index>=0 && index<items.length){
			return(items[index]);
		}else{
			return undefined;
		}
	};

	me.onClick = function(){
		if (!isActive){
			me.activate();
		}
	};

	me.activate = function(){
		cursorPos = -1;
		console.error("activate " + me.name);
		if (!isActive && value){
			cursorPos = value.length-1;
		}
		isActive = true;
		Input.setFocusElement(me);
		pingCursor();
	};

	me.deActivate = function(){
		if (isActive){
			isCursorVisible = false;
			isActive = false;
			me.refresh();
			Input.clearFocusElement()
		}

	};

	me.onKeyDown = function(keyCode,event){
		var handled = false;

		switch(keyCode){
			case 8:// backspace
				if (value) {
					value = value.substr(0,cursorPos) + value.substr(cursorPos+1);
					cursorPos--;
					if (me.onChange) me.onChange(value);
				}
				handled = true;
				break;
			case 13:// enter
				me.deActivate();
				handled = true;
				break;
			case 37:// left
				if (cursorPos>0) cursorPos--;
				me.refresh();
				handled = true;
				break;
			case 39:// right
				if (value) {
					cursorPos++;
					cursorPos = Math.min(cursorPos,value.length-1);
					me.refresh();
				}
				handled = true;
				break;
			case 46: // delete
				handled = true;
				break;
		}

		if (!handled && keyCode>31){
			var key = event.key;
			if (key.length == 1 && key.match(/[a-z0-9\._:\-\ #]/i)){
				value = value.substr(0,cursorPos+1) + key + value.substr(cursorPos+1);
				if (me.onChange) me.onChange(value);
				cursorPos++;
				me.refresh();
			}
			handled = true;
		}

		return handled;
	};

	var pingCursor = function(){
		if (!isActive) return;
		isCursorVisible = !isCursorVisible;
		me.refresh();
		setTimeout(pingCursor,200);
	};

	return me;
};