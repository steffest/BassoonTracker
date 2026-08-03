import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Label from "./components/label.js";
import RadioGroup from "./components/radiogroup.js";
import Assets from "./assets.js";
import {EVENT, FILETYPE} from "../enum.js";
import UI from "./ui.js";
import EventBus from "../eventBus.js";
import Font from "./font.js";


let DiskOperationType = function(){

	var me = new Panel();

	var background = new Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = new Label(0, 0, 20, 20);
	labelLoad.label = "Type";
	labelLoad.font = Font.small;
	me.addChild(labelLoad);

	var selectionType = new RadioGroup();
	selectionType.align = "right";
	selectionType.size = "med";
	selectionType.divider = "line";
	selectionType.highLightSelection = true;
	selectionType.setItems([
		{label:"module",active:true, fileType: FILETYPE.module},
		{label:"sample",active:false, fileType: FILETYPE.sample},
		{label:"playlist",active:false, fileType: FILETYPE.playlist}
		//{label:"pattern",active:false, fileType: FILETYPE.pattern}
	]);
	selectionType.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationTargetChange,this.getSelectedItem());
	};
	me.addChild(selectionType);

	me.onResize = function(){

		var innerWidth = Math.max(1, me.width - 2);
		var innerHeight = Math.max(1, me.height - 20);

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

	me.getType = function(){
		var index = selectionType.getSelectedIndex();
		var result = "modules";
		if (index == 1) result = "samples";
		if (index == 2) result = "playlists";
		return result;
	};

	me.setType = function(index){
		selectionType.setSelectedIndex(index);
	};

	return me;

};

export default DiskOperationType;

