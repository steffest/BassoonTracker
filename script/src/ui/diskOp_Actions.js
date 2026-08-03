import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Assets from "./assets.js";
import Label from "./components/label.js";
import RadioGroup from "./components/radiogroup.js";
import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import UI from "./ui.js";
import Font from "./font.js";


let DiskOperationActions = function(){

	var me = new Panel();

	var background = new Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = new Label(0, 0, 20, 20);
	labelLoad.label = "Action";
	labelLoad.font = Font.small;
	me.addChild(labelLoad);

	var selectionType = new RadioGroup();
	selectionType.align = "right";
	selectionType.size = "med";
	selectionType.divider = "line";
	selectionType.type = "buttons";
	selectionType.highLightSelection = true;
	selectionType.setItems([
		{label:"load",active:true},
		{label:"save",active:false}
	]);
	selectionType.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationActionChange,this.getSelectedItem());
	};
	me.addChild(selectionType);

	me.onResize = function(){

		var innerWidth = Math.max(1, me.width - 2);
		var innerHeight = 70;

		if (me.height < 100){
			innerHeight = Math.max(1, me.height - 20);
		}

		me.clearCanvas();

		background.setPosition(0, 0);
		background.setSize(me.width, me.height);

		label1.setPosition(1, 1);
		label1.setSize(innerWidth, 16);

		labelLoad.left = -1;
		labelLoad.top = 3;
		labelLoad.height = 16;
		labelLoad.width = innerWidth;

		selectionType.left = 4;
		selectionType.width = Math.max(1, innerWidth - 4);
		selectionType.height = innerHeight;
		selectionType.top = 18;
	};

	me.setLayout = me.onResize;

	me.getAction = function(){
		var index = selectionType.getSelectedIndex();
		var result = "load";
		if (index == 1) result = "save";
		return result;
	};

	me.setSelectedIndex = function(index){
        selectionType.setSelectedIndex(index);
	};

	return me;

};

export default DiskOperationActions;

