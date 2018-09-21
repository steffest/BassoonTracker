UI.spinBox = function(initialProperties){

	var me = UI.element();
	me.type = "spinBox";


	var size="medium";
	var label = "";
	var labels;
	var value = 0;
	var min =  0;
	var max = 100;
	var step = 1;
	var font;
	var properties;
	var padLength = 4;
	var padChar = " ";
	var disabled = false;
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
	buttonDown.onDown = function(){
		if (disabled) return;
		value -= step;
		if (value<min) value=min;
		me.setValue(value);
		UI.ticker.onEachTick4(function(){
			value -= step;
			if (value<min) value=min;
			me.setValue(value);
		},10);
	};
	buttonDown.onTouchUp = function(){
		UI.ticker.onEachTick4();
	};

	buttonDown.setProperties({
		name:"buttonDown",
		label:"↓"
	});
	me.addChild(buttonDown);

	var buttonUp = UI.Assets.generate("button20_20");
	buttonUp.onDown = function(){
		if (disabled) return;
		value += step;
		if (value>max) value=max;
		me.setValue(value);
		UI.ticker.onEachTick4(function(){
			value += step;
			if (value>max) value=max;
			me.setValue(value);
		},10);
	};
	buttonUp.onTouchUp = function(){
		UI.ticker.onEachTick4();
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

		if (size === "big"){
            padLength = 2;
			buttonUp.setProperties({
				left: me.width  - buttonDown.width,
				height: Math.floor(me.height/2),
				top:0
			});
			buttonDown.setProperties({
				left:buttonUp.left,
                height: buttonUp.height,
				top: me.height - buttonUp.height
			});
		}else{
			buttonDown.setProperties({
				left: me.width  - buttonDown.width,
				top:3
			});
			buttonUp.setProperties({
				left:me.width - buttonUp.width - buttonDown.width,
				top:3
			});
		}
	};

	function setPropertiesValues(properties){
		if (typeof properties.size != "undefined") size = properties.size;
		if (typeof properties.name != "undefined") me.name = properties.name;
		if (typeof properties.left != "undefined") me.left = properties.left;
		if (typeof properties.top != "undefined") me.top = properties.top;
		if (typeof properties.width != "undefined") me.width = properties.width;
		if (typeof properties.height != "undefined") me.height = properties.height;
		if (typeof properties.label != "undefined") label = properties.label;
		if (typeof properties.labels != "undefined") labels = properties.labels;
		if (typeof properties.value != "undefined") value = properties.value;
		if (typeof properties.font != "undefined") font = properties.font;
		if (typeof properties.min != "undefined") min = properties.min;
		if (typeof properties.max != "undefined") max = properties.max;
		if (typeof properties.step != "undefined") step = properties.step;
		if (typeof properties.onChange != "undefined") onChange = properties.onChange;
		if (typeof properties.padLength != "undefined") padLength = properties.padLength;
		if (typeof properties.disabled != "undefined") disabled = !!properties.disabled;
	}

	me.setValue = function(newValue,internal){
		value=newValue;
		me.refresh();
		if (!internal && onChange) onChange(value);
	};

	me.getValue = function(){
		return value;
	};

	me.setMax = function(newMax,internal){
		max = newMax;
		if (!internal && value>max) me.setValue(max);
	};

	me.setMin = function(newMin){
		min = newMin;
		if (value<min) me.setValue(min);
	};

	me.setDisabled = function(value){
		disabled = value;
		me.refresh();
	};

	me.render = function(internal){
		internal = !!internal;
		if (!me.isVisible()) return;

		if (me.needsRendering){
			me.clearCanvas();
			if (label){
				if (font){
					font.write(me.ctx,label,6,11,0);
				}else{
					me.ctx.fillStyle = "white";
					me.ctx.fillText(label,10,10);
				}
			}

			buttonUp.render();
			buttonDown.render();

			// arrow glyphs

			//var buttonCenterX = Math.floor((buttonUp.width - 8)/2);
			//var buttonCenterY = Math.floor((buttonUp.height - 8)/2);
			//window.fontMed.write(me.ctx,"↑",buttonUp.left + buttonCenterX,buttonUp.top + buttonCenterY,0);
			//window.fontMed.write(me.ctx,"↓",buttonDown.left + buttonCenterX,buttonDown.top + buttonCenterY,0);


			if (size === "big"){
				me.ctx.drawImage(Y.getImage("panel_inset_dark"),buttonUp.left - 36,1,34,me.height-2);

				//window.fontLedBig.write(me.ctx,padValue(),buttonUp.left - 36,2,0);
				window.fontLedBig.write(me.ctx,padValue(),buttonUp.left - 31,4,0);

			}else{
				var valueX = buttonUp.left - 32 - 10;
				var valueY = 2;
				var valueW = 40;
				var valueH = 24;


				if (padLength === 2){
					valueW = 24;
					valueX += 16;
				}

				if (padLength === 3){
					valueW = 32;
					valueX += 8;
				}

				if (padLength === 5){
					valueW = 48;
					valueX -= 8;
				}

				me.ctx.drawImage(Y.getImage("panel_inset_dark"),valueX,valueY,valueW,valueH);

				valueX +=4;
				valueY = 7;
				window.fontLed.write(me.ctx,padValue(),valueX,valueY,0);
			}






			if (disabled){
				me.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
				me.ctx.fillRect(1,0,me.width-1,me.height);
			}

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
        if (disabled) return;
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
		var currentLabel = label;
		if (labels){
			labels.forEach(function(item){
				if (me.width>=item.width) label=item.label;
			})
		}
		if (currentLabel !== label) me.refresh();
	};

	return me;


};

