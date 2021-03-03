UI.sliderBox = function(initialProperties){
	var me = UI.element();
	me.type = "sliderBox";

	var label = "";
	var value = 0;
	var prevValue = 0;
	var min =  0;
	var max = 100;
	var step = 1;
	var font;
	var properties;
	var padLength = 4;
	var padChar = " ";
	var onChange;
	var vertical;

	var labelX=0;
	var labelY=0;
	var digitX=0;
	var digitY=0;
	var digitW=10;
	var digitH=10;

	var sliderHeight = 20;
	var sliderwidth = 20;
    var disabled = false;

	var lineVer = Y.getImage("line_ver");

	var properties = ["left","top","width","height","name","label","value","onChange","min","max","step","vertical","font","trackUndo","undoLabel","undoInstrument"];
	if (initialProperties) setPropertiesValues(initialProperties);

	if (max>9999) padLength = 5;

	function padValue(){
		var result = "" + value;
		while (result.length < padLength){
			result = padChar + result;
		}
		return result;
	}

	var slider = UI.rangeSlider({
		min: min,
		max: max,
		height: sliderHeight,
		width: sliderwidth,
		vertical: !!vertical,
		onChange: function(v){
				if (v!==value){
					me.setValue(v);
				}
		}
	});
	me.addChild(slider);

	var numberDisplay = UI.numberDisplay({
		min: min,
		max: max,
		padLength: 4,
		size: "small",
		onChange:function(v){
			if (v!==value){
				me.setValue(v);
			}
		}
	});
	numberDisplay.paddingBottom = -1;
	me.addChild(numberDisplay);


	me.setProperties = function(newProperties){
		setPropertiesValues(newProperties);

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	function setPropertiesValues(p){

		properties.forEach(function(key){
			if (typeof p[key] != "undefined"){
				switch(key){
					case "label": label=p[key];break;
					case "value" : 
						value=p[key];
						prevValue = value;
						break;
					case "min" : min=p[key];break;
					case "max" : max=p[key];break;
					case "step" : step=p[key];break;
					case "onChange" : onChange=p[key];break;
					case "font" : font=p[key];break;
					case "vertical" : 
						vertical=!!p[key];
						if (slider) slider.setProperties({vertical: vertical})
						break;
					default:
						me[key] = p[key];
				}
			}
		});
	}

	me.setValue = function(newValue,internal){
		if (newValue!==value) {
			prevValue=value;
		}
		value=newValue;
		slider.setValue(value,internal);
		numberDisplay.setValue(value,internal);
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

	me.getValue = function(){
		return value;
	};

	me.getPrevValue = function(){
		return prevValue;
	};

	me.setMax = function(newMax,skipCheck){
		max = newMax;
		if (!skipCheck && value>max) me.setValue(max);
		slider.setMax(max,skipCheck);
		numberDisplay.setMax(max,skipCheck);
	};

	me.setMin = function(newMin,skipCheck){
		min = newMin;
		if (!skipCheck && value<min) me.setValue(min);
        slider.setMin(min,skipCheck);
		numberDisplay.setMin(min,skipCheck);
	};

    me.setDisabled = function(value){
        disabled = value;
        me.refresh();
        me.ignoreEvents = disabled;
    };

	me.render = function(internal){
		internal = !!internal;
		if (me.needsRendering){
			me.clearCanvas();

			//me.ctx.drawImage(Y.getImage("panel_inset_dark"),digitX,digitY,digitW,digitH);
			//window.fontLed.write(me.ctx,padValue(),digitX+4,digitY+2,0);
			slider.render();
			numberDisplay.render();

			if (font){
				font.write(me.ctx,label,labelX,labelY,0);
			}else{
				me.ctx.fillStyle = "white";
				me.ctx.fillText(label,labelX,labelY);
			}

			if (vertical){
				me.ctx.drawImage(lineVer,me.width-2,0,2,me.height);
			}

            if (disabled){
                me.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
                me.ctx.fillRect(1,0,me.width-1,me.height);
            }


		}
		me.needsRendering = false;

		if (internal){
			return me.canvas;
		}else{
			me.parentCtx.drawImage(me.canvas,me.left,me.top,me.width,me.height);
		}

	};

	me.onMouseWheel = function(touchData){
		if (touchData.mouseWheels[0] > 0){
			value++;
			if (value>max) value=max;
			me.setValue(value);
		}else{
			value--;
			if (value<min) value=min;
			me.setValue(value);
		}
	};
	slider.onMouseWheel = me.onMouseWheel;

	me.onResize = function(){

		digitW = 40;
		digitH = 20;
		if (padLength == 5){
			digitW = 48;
			digitX -= 8;
		}

		if (vertical){
            slider.setSize(sliderwidth, me.height-36);
            slider.setPosition(Math.floor((me.width-sliderwidth)/2),0);
			digitX = Math.floor((me.width - 40)/2);
			digitY = me.height-32;
			labelX = Math.floor((me.width - font.getTextWidth(label,0))/2);
			labelY = me.height-10;
		}else{
            slider.setSize(me.width, sliderHeight);
            slider.setPosition(0, me.height - sliderHeight);
			digitX = me.width - 40;
			digitY = 2;
		}

		numberDisplay.setSize(digitW,digitH);
		numberDisplay.setPosition(digitX,digitY);
	};

	return me;


};

