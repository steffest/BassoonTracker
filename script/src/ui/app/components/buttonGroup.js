import Panel from "../../components/panel.js";
import Scale9Panel from "../../components/scale9.js";
import Assets from "../../assets.js";
import Label from "../../components/label.js";
import NumberDisplay from "../../components/numberdisplay.js";
import EventBus from "../../../eventBus.js";
import {EVENT} from "../../../enum.js";

let ButtonGroup = function(title,buttonsInfo){

	var me = Panel();
	me.hide();

	var titleBar = Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = Label({
		label: title,
		font: fontSmall,
		width: 60,
		top: 1
	});
	me.addChild(titleLabel);

	var buttons = [];

	buttonsInfo.forEach(function(buttonInfo){
		if (buttonInfo.type === "number"){
			var button = NumberDisplay({
				autoPadding: true
			});
			button.setValue(buttonInfo.value);
		}else{
			button = Assets.generate("buttonLight");
			button.setLabel(buttonInfo.label);
			button.onClick = buttonInfo.onClick;
		}
		button.widthParam = buttonInfo.width || 100;
		me.addChild(button);
		buttons.push(button);


		if (buttonInfo.onSamplePropertyChange){
			EventBus.on(EVENT.samplePropertyChange,function(newProps){
				buttonInfo.onSamplePropertyChange(button,newProps);
			});
		}
	});

	me.onResize = function(){
		titleBar.setSize(me.width,18);

		var buttonTop = 20;
		var buttonHeight = (me.height-buttonTop-2) / 4;
		var buttonWidth = me.width;
		var left = 0;

		buttons.forEach(function(button,index){
			button.setProperties({
				width: Math.floor(buttonWidth * button.widthParam/100),
				height: buttonHeight,
				left: Math.floor(left * buttonWidth/100),
				top: buttonTop
			});

			left += button.widthParam;
			if (left>95){
				left=0;
				buttonTop+=buttonHeight;
			}


		});
	};

	return me;

};

export default ButtonGroup;

