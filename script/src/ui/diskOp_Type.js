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

		var innerWidth = me.width-2;
		var innerHeight = me.height - 20;

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.left = 0;
		background.top = 0;
		background.height = me.height;
		background.width = me.width;

		label1.left = 1;
		label1.top = 1;
		label1.height = 16;
		label1.width = innerWidth;

		labelLoad.left = -1;
		labelLoad.top = 3;
		labelLoad.height = 16;
		labelLoad.width = innerWidth;

		selectionType.left = 4;
		selectionType.width = innerWidth-4;
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

