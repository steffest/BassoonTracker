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

	var sliderHeight = 20;

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
		onChange: function(v){
				value = v;
				if (onChange) onChange(v);
		}
	});
	me.addChild(slider);


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
	}

	me.setValue = function(newValue,internal){
		value=newValue;
		slider.setValue(value,internal);
		me.refresh();
		if (!internal && onChange) onChange(value);
	};

	me.getValue = function(){
		return value;
	};

	me.setMax = function(newMax){
		max = newMax;
		if (value>max) me.setValue(max);
	};

	me.setMin = function(newMin){
		min = newMin;
		if (value<min) me.setValue(min);
	};

	me.render = function(internal){
		internal = !!internal;
		if (me.needsRendering){
			me.clearCanvas();
			if (font){
				font.write(me.ctx,label,6,8,0);
			}else{
				me.ctx.fillStyle = "white";
				me.ctx.fillText(label,10,10);
			}


			var valueX = me.width - 40;
			var valueY = 2;
			var valueW = 40;
			var valueH = 19;

			if (padLength == 5){
				valueW = 48;
				valueX -= 8;
			}

			me.ctx.drawImage(Y.getImage("panel_inset_dark"),valueX,valueY,valueW,valueH);

			valueX +=4;
			valueY += 2;
			window.fontLed.write(me.ctx,padValue(),valueX,valueY,0);


			slider.render();

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

	me.onResize = function(){
		slider.setSize(me.width, sliderHeight);
		slider.setPosition(0, me.height - sliderHeight);
	};

	return me;


};

