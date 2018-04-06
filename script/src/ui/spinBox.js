UI.spinBox = function(initialProperties){

	var me = UI.element();
	me.type = "spinBox";


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

	if (initialProperties) setPropertiesValues(initialProperties);

	if (max>9999) padLength = 5;

	function padValue(){
		var result = "" + value;
		while (result.length < padLength){
			result = padChar + result;
		}
		return result;
	}

	var buttonDown = UI.Assets.generate("button20_20");
	buttonDown.onClick = function(){
		value -= step;
		if (value<min) value=min;
		me.setValue(value);
	};
	buttonDown.setProperties({
		name:"buttonDown",
		label:"↓"
	});
	me.addChild(buttonDown);

	var buttonUp = UI.Assets.generate("button20_20");
	buttonUp.onClick = function(){
		value += step;
		if (value>max) value=max;
		me.setValue(value);
	};
	buttonUp.setProperties({
		name:"buttonUp",
		label:"↑"
	});
	me.addChild(buttonUp);

	me.setProperties = function(newProperties){
		if (!newProperties) return properties;

		properties = newProperties || {};
		setPropertiesValues(properties);

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);

		buttonDown.setProperties({
			left: me.width  - buttonDown.width,
			top:5
		});
		buttonUp.setProperties({
			left:me.width - buttonUp.width - buttonDown.width,
			top:5
		});
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
				font.write(me.ctx,label.toUpperCase(),6,11,0);
			}else{
				me.ctx.fillStyle = "white";
				me.ctx.fillText(label,10,10);
			}

			buttonUp.render();
			buttonDown.render();

			// arrow glyphs

			//var buttonCenterX = Math.floor((buttonUp.width - 8)/2);
			//var buttonCenterY = Math.floor((buttonUp.height - 8)/2);
			//window.fontMed.write(me.ctx,"↑",buttonUp.left + buttonCenterX,buttonUp.top + buttonCenterY,0);
			//window.fontMed.write(me.ctx,"↓",buttonDown.left + buttonCenterX,buttonDown.top + buttonCenterY,0);



			var valueX = buttonUp.left - 32 - 10;
			var valueY = 2;
			var valueW = 40;
			var valueH = 24;

			if (padLength == 5){
				valueW = 48;
				valueX -= 8;
			}

			me.ctx.drawImage(Y.getImage("panel_inset_dark"),valueX,valueY,valueW,valueH);

			valueX +=4;
			valueY = 7;
			window.fontLed.write(me.ctx,padValue(),valueX,valueY,0);

			//var b = buttonUp.render(true);
			//me.ctx.drawImage(b,10,10,50,30);
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

	return me;


};

