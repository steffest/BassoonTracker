UI.spinBox = function(initialProperties){

	var me = UI.numberDisplay(initialProperties);
	me.type = "spinBox";
	
	var size="medium";
	var label = "";
	var labels;
	var font;
	var step = 1;

	if (initialProperties) setPropertiesValues(initialProperties);
	
	
	var buttonDown = UI.Assets.generate("button20_20");
	buttonDown.onDown = function(){
		if (me.isDisabled) return;
		me.updateValue(me.getValue()-step);
		UI.ticker.onEachTick4(function(){
			me.updateValue(me.getValue()-step);
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
		if (me.isDisabled) return;
		me.updateValue(me.getValue()+step);
		UI.ticker.onEachTick4(function(){
			me.updateValue(me.getValue()+step);
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

	var setPropertiesIntern = me.setProperties;

	me.setProperties = function(newProperties){
		setPropertiesValues(newProperties);
		if (setPropertiesIntern) setPropertiesIntern(newProperties);
	}
	
	/*me.setProperties = function(newProperties){
		if (!newProperties) return properties;

		properties = newProperties || {};
		setPropertiesValues(properties);

		me.setSize(me.width,me.height);
		me.setPosition(me.left,me.top);


	};*/

	function setPropertiesValues(properties){
		if (typeof properties.size != "undefined") size = properties.size;
		if (typeof properties.label != "undefined") label = properties.label;
		if (typeof properties.labels != "undefined") labels = properties.labels;
		if (typeof properties.font != "undefined") font = properties.font;
		if (typeof properties.step != "undefined") step = properties.step;
		//if (typeof properties.disabled != "undefined") disabled = !!properties.disabled;
	}
	
	
	
	me.renderInternal = function(){
		

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
		
		
		//if (me.needsRendering){
			//me.clearCanvas();
			
			
			
			//if (size === "big"){
				//me.ctx.drawImage(Y.getImage(backGroundImage),buttonUp.left - 36,-1,34+2,me.height+1);

				//window.fontLedBig.write(me.ctx,padValue(),buttonUp.left - 36,2,0);
				//window.fontLedBig.write(me.ctx,padValue(),buttonUp.left - 31,4,0);

			//}else{
				
				/*
				var padding = 2;
				 
				
				var valueX = buttonUp.left - 32 - 10 - 4;
				var valueY = 2;
				var valueW = 40;
				var valueH = 24 + padding*2;


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
				
				valueW += padding*2;
				valueX -= padding;
				valueY -= padding;
				
				

				me.ctx.drawImage(Y.getImage(backGroundImage),valueX,valueY,valueW,valueH);

				valueX +=4;
				valueY = 7;
				window.fontLed.write(me.ctx,padValue(),valueX,valueY,0);

				if (isCursorVisible){
					me.ctx.fillStyle = "rgba(255,201,65,0.7)";
					var charWidth = 8;
					var cursorX = valueX + cursorPos*charWidth;
					me.ctx.fillRect(cursorX,4,2,me.height-8);
				}
				*/
			//}

			//body.style.backgroundColor  ="rgba(255,201,65,0.7)";

			

			//var b = buttonUp.render(true);
			//me.ctx.drawImage(b,10,10,50,30);
		//}
		

	};
	
	me.onResize = function(){
		//me.setPadLength(Math.floor(me.width/9) - 1);
		
		if (labels){
			labels.forEach(function(item){
				if (me.width>=item.width) label=item.label;
			})
		}

		if (size === "big"){
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

			me.paddingLeft = 2;
			me.paddingRight = buttonUp.width;
			me.paddingBottom = -1;
			me.paddingTop = -1;

		}else{
			buttonDown.setProperties({
				left: me.width  - buttonDown.width,
				top:3
			});
			buttonUp.setProperties({
				left:me.width - buttonUp.width - buttonDown.width,
				top:3
			});

			me.paddingLeft = buttonUp.left - (me.padLength*8) - 10 - 4;
			me.paddingRight = buttonUp.width + buttonDown.width + 1;
			me.paddingBottom = me.height - buttonUp.height - 8;
		}


		

	};
	
	
	return me;


};

