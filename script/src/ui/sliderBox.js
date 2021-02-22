UI.sliderBox = function(initialProperties){
	var me = UI.element();
	me.type = "sliderBox";

	var label = "";
	var value = 0;
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
		if (!newProperties) return properties;

		properties = newProperties || {};
		setPropertiesValues(properties);

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

	};

	function setPropertiesValues(properties){
		if (typeof properties.name != "undefined") me.name = properties.name;
		if (typeof properties.left != "undefined") me.left = properties.left;
		if (typeof properties.top != "undefined") me.top = properties.top;
		if (typeof properties.width != "undefined") me.width = properties.width;
		if (typeof properties.height != "undefined") me.height = properties.height;
		if (typeof properties.label != "undefined") label = properties.label;
		if (typeof properties.value != "undefined") value = properties.value;
		if (typeof properties.font != "undefined") font = properties.font;
		if (typeof properties.min != "undefined") min = properties.min;
		if (typeof properties.max != "undefined") max = properties.max;
		if (typeof properties.step != "undefined") step = properties.step;
		if (typeof properties.onChange != "undefined") onChange = properties.onChange;
		if (typeof properties.vertical != "undefined") {
			vertical = !!properties.vertical;
            if (slider) slider.setProperties({vertical: vertical})
        }
	}

	me.setValue = function(newValue,internal){
		value=newValue;
		slider.setValue(value,internal);
		numberDisplay.setValue(value,internal);
		me.refresh();
		if (!internal && onChange) onChange(value);
	};

	me.getValue = function(){
		return value;
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

