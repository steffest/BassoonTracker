import Ticker from "./ticker.js";
import NumberDisplay from "./components/numberdisplay.js";
import Assets from "./assets.js";

let spinBox = function(initialProperties){

	var me = NumberDisplay(initialProperties);
	me.type = "spinBox";
	
	var size="medium";
	var label = "";
	var labels;
	var font;
	var step = 1;

	if (initialProperties) setPropertiesValues(initialProperties);

	var buttonDown = Assets.generate("button20_20");
	buttonDown.onDown = function(){
		if (me.isDisabled) return;
		me.updateValue(me.getValue()-step);
		Ticker.onEachTick4(function(){
			me.updateValue(me.getValue()-step);
		},10);
	};
	buttonDown.onTouchUp = function(){
		Ticker.onEachTick4();
	};

	buttonDown.setProperties({
		name:"buttonDown",
		label:"↓"
	});
	buttonDown.tooltip = me.tooltip;
	me.addChild(buttonDown);

	var buttonUp = Assets.generate("button20_20");
	buttonUp.onDown = function(){
		if (me.isDisabled) return;
		me.updateValue(me.getValue()+step);
		Ticker.onEachTick4(function(){
			me.updateValue(me.getValue()+step);
		},10);
	};
	buttonUp.onTouchUp = function(){
		Ticker.onEachTick4();
	};
	buttonUp.setProperties({
		name:"buttonUp",
		label:"↑"
	});
	buttonUp.tooltip = me.tooltip;
	me.addChild(buttonUp);

	var setPropertiesIntern = me.setProperties;

	me.setProperties = function(newProperties){
		setPropertiesValues(newProperties);
		if (setPropertiesIntern) setPropertiesIntern(newProperties);
	}

	function setPropertiesValues(properties){
		if (typeof properties.size != "undefined") size = properties.size;
		if (typeof properties.label != "undefined") label = properties.label;
		if (typeof properties.labels != "undefined") labels = properties.labels;
		if (typeof properties.font != "undefined") font = properties.font;
		if (typeof properties.step != "undefined") step = properties.step;
		if (typeof properties.tooltip != "undefined") me.tooltip = properties.tooltip;
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

export default spinBox;

