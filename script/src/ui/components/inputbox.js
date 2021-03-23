UI.inputbox = function(initialProperties){
	var me = UI.element();
	var properties = ["left","top","width","height","name","type","onChange","onSubmit","backgroundImage","trackUndo","undoLabel","undoInstrument"];
	var value = "";
	var prevValue = "";
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
		if (newValue!==value) {
			prevValue=value;
		}
		value = newValue;
		me.refresh();
		
		if (!internal && me.onChange) {
			if (me.trackUndo){
				var editAction = StateManager.createValueUndo(me);
				editAction.name= me.undoLabel || "Change " + me.name;
				if (me.undoInstrument) {
					editAction.instrument = Tracker.getCurrentInstrumentIndex();
					editAction.id += editAction.instrument;
				}
				StateManager.registerEdit(editAction);
			}
			me.onChange(value);
		}
	};
	
	me.getValue = function(){
		return value;
	};

	me.getPrevValue = function(){
		return prevValue;
	}

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
		if (isActive) return;
		cursorPos = value ? value.length-1 : -1;
		isActive = true;
		Input.setFocusElement(me);
		pingCursor();
	};

	me.deActivate = function(andSubmit){
		if (isActive){
			isCursorVisible = false;
			isActive = false;
			me.refresh();
			Input.clearFocusElement();
			if (andSubmit && me.onSubmit){
				me.onSubmit(value);
			}
		}
	};

	me.onKeyDown = function(keyCode,event){
		var handled = false;
		switch(keyCode){
			case 8:// backspace
				if (value) {
					if (cursorPos>=0){
						me.setValue(value.substr(0,cursorPos) + value.substr(cursorPos+1));
						cursorPos--;
					}
				}
				handled = true;
				break;
			case 9:// tab
			case 13:// enter
			case 27:// esc
				me.deActivate(keyCode===13);
				handled = true;
				break;
			case 37:// left
				if (cursorPos>=0) cursorPos--;
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
				if (value) {
					if (cursorPos<value.length-1){
						me.setValue(value.substr(0,cursorPos+1) + value.substr(cursorPos+2));
					}
				}
				handled = true;
				break;
			case 89: ///y - redo
			case 90: //z - undo
				if (Input.isMetaKeyDown()){
					me.deActivate();
					return;
				}
				break;
		}

		if (!handled && keyCode>31){
			var key = event.key;
			if (key.length === 1 && key.match(/[a-z0-9\._:\-\ #]/i)){
				me.setValue(value.substr(0,cursorPos+1) + key + value.substr(cursorPos+1));
				cursorPos++;
			}
			handled = true;
		}

		return handled;
	};

	var pingCursor = function(){
		if (!isActive) return;
		isCursorVisible = !isCursorVisible;
		me.refresh();
		setTimeout(pingCursor,300);
	};

	return me;
};