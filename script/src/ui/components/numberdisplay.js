UI.numberDisplay = function(initialProperties){
    var me = UI.element();
    me.type = "numberDisplay";
    me.isActive = false;
    me.isDisabled = false;
    me.padLength = 4;

    var value = 0;
    var prevValue = 0;
    var min =  0;
    var max = 100;
    var step = 1;
	var padChar = " ";
	var padding = 0;
	var hasFocus;
    var cursorPos=0 ;
    var isCursorVisible;
    var onChange;
    var fontSize="medium";
    var font;
    var autoPadding = false;

    var fontOffsets={
        "small":{x:4,y:3,c:0},
        "medium":{x:6,y:7,c:0},
        "big":{x:7,y:4,c:-2},
    }
    var fontOffset = fontOffsets.medium;

    var properties = ["left","top","width","height","name","value","onChange","min","max","step","padLength","size","autoPadding","trackUndo","undoLabel","undoInstrument"];
    if (initialProperties) setPropertiesValues(initialProperties);

    me.setProperties = function(p){
        setPropertiesValues(p);
        me.setSize(me.width,me.height);
        me.setPosition(me.left,me.top);

        if (max>9999 && me.padLength<5) me.padLength = 5;
    };

    function setPropertiesValues(p){
        properties.forEach(function(key){
            if (typeof p[key] != "undefined"){
                switch(key){
                    case "value": value=p[key];break;
                    case "onChange" : onChange=p[key];break;
                    case "min" : min=p[key];break;
                    case "max" : max=p[key];break;
                    case "step" : step=p[key];break;
                    case "size" : fontSize=p[key];break;
                    case "autoPadding" : autoPadding=!!p[key];break;
                    default:
                        me[key] = p[key];
                }
            }
        });
        font = fontSize==="big"?window.fontLedBig:window.fontLed;
        fontOffset = fontOffsets[fontSize];
    }

    me.setValue = function(val,internal){
        if (val!==value) {
            prevValue=value;
        }
        value = val;
        me.refresh();
        if (!internal && onChange) {
            if (me.trackUndo){
                var editAction = StateManager.createValueUndo(me);
                editAction.name= me.undoLabel || "Change " + me.name;
                if (me.undoInstrument) {
                    editAction.instrument = Tracker.getCurrentInstrumentIndex();
                    editAction.id += editAction.instrument;
                }
                StateManager.registerEdit(editAction);
            }
            onChange(value);
        }
    };

    me.updateValue = function(newValue){
        if (newValue>max) newValue=max;
        if (newValue<min) newValue=min;
        me.setValue(newValue);
    }
    
    me.getValue = function(){
        return value;
    }

    me.getPrevValue = function(){
        return prevValue;
    }


	me.setDisabled = function(state){
		if (typeof state == "undefined") state=true;
		me.isDisabled = state;
		if (state) me.isActive = false;
		me.refresh();
	};
	
	me.setFocus = function(state){
	    hasFocus = !!state;
        if (hasFocus){
            Input.setFocusElement(me);
            cursorPos = padValue().length
            pingCursor();
        }else{
            Input.clearFocusElement();
        }
	    me.refresh();
    }
    
    me.togglFocus = function(){
	    me.setFocus(!hasFocus);
    }

    me.setMax = function(newMax,internal){
        max = newMax;
        if (!internal && value>max) me.setValue(max);
    };

    me.setMin = function(newMin){
        min = newMin;
        if (value<min) me.setValue(min);
    };

    me.onClick = function(){
        if (me.isDisabled) return;
        if (!onChange) return;
        me.togglFocus();
    }

    me.onMouseWheel = function(touchData){
        if (me.isDisabled) return;
        if (!onChange) return;
        if (touchData.mouseWheels[0] > 0){
            me.updateValue(value+step);
        }else{
            me.updateValue(value-step);
        }
    };

    me.onKeyDown = function(code,event){
        var keyCode = event.keyCode;
        var key = event.key;

        switch (keyCode){
            case 8:// backspace
                extract(-1);
                break;
            case 9:
            case 13:
            case 27:
                Input.clearFocusElement();
                break;
            case 37:
                setCursorPos(cursorPos-1);
                break;
            case 38:
                me.updateValue(value+1);
                break;
            case 39:
                setCursorPos(cursorPos+1);
                break;
            case 40:
                me.updateValue(value-1);
                break;
            case 46: // Del
                extract(0);
                break;
        }


        switch (key){
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
            case "-":
                inject(key);
                break;
        }




        //console.error(keyCode,key);
        return true;
    }

    me.onResize = function(){
        if (autoPadding) me.padLength = Math.floor(me.width/8) - 1;
    }

    me.activate = function(){
        hasFocus = true;
        cursorPos = padValue().length;
        isCursorVisible = true;
        pingCursor();
    }

    me.deActivate = function(){
        if (hasFocus){
            hasFocus = false;
            isCursorVisible = false;
            me.refresh();
            Input.clearFocusElement()
        }
    }
    
    me.render = function(internal){
        if (!me.isVisible()) return;

        var backGroundImage = hasFocus?"panel_inset_dark_active":"panel_inset_dark_inactive"
        
        if (me.needsRendering){
            internal = !!internal;
            me.ctx.clearRect(0,0,me.width,me.height);

			var x = me.paddingLeft || padding;
			var y = me.paddingTop || padding;
			
			var w = me.width - x - (me.paddingRight || padding) ;
			var h = me.height - y- (me.paddingBottom || padding) ;
			me.ctx.drawImage(Y.getImage(backGroundImage),x,y,w,h);

			if (font){
			    x+=fontOffset.x;
			    y=fontOffset.y;
                font.write(me.ctx,padValue(),x,y,0);

                if (isCursorVisible){
                    me.ctx.fillStyle = "rgba(255,201,65,0.7)";
                    var cursorX = x + cursorPos*font.charWidth + fontOffset.c;
                    me.ctx.fillRect(cursorX,y,2,font.charHeight);
                }
            }

            if (me.renderInternal) me.renderInternal();
            
            
            if (me.isDisabled){
				me.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
				me.ctx.fillRect(0,0,me.width,me.height);
            }
            
        }

        me.needsRendering = false;

        if (internal){
            return me.canvas;
        }else{
            me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
        }
    };

	function padValue(){
		var result = "" + value;
		while (result.length < me.padLength){
			result = padChar + result;
		}
		return result;
	}

    var pingCursor = function(){
        if (hasFocus){
            isCursorVisible = !isCursorVisible;
            setTimeout(pingCursor,300);
        }else{
            isCursorVisible = false;
        }
        me.refresh();
    };

    function setCursorPos(newValue){
        cursorPos = newValue;
        var max = padValue().length;
        var min = max - ("" + value).length;
        if (cursorPos>max) cursorPos=max;
        if (cursorPos<min) cursorPos=min;
        me.refresh();
    }

    function extract(offset){
        var a = padValue().split("");
        a.splice(cursorPos+offset,1);
        var v = parseInt(a.join("").trim());
        if (isNaN(v)) v=0;
        me.updateValue(v);
    }

    function inject(n){
        var a = padValue().split("");
        a.splice(cursorPos,0,n);
        var v = parseInt(a.join("").trim());
        if (isNaN(v)) v=0;
        me.updateValue(v);
    }

    return me;
};