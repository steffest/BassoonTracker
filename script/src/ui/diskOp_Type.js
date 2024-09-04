import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Label from "./components/label.js";
import RadioGroup from "./components/radiogroup.js";
import Assets from "./assets.js";
import {EVENT, FILETYPE} from "../enum.js";
import UI from "./ui.js";
import EventBus from "../eventBus.js";


let DiskOperationType = function(){

	var me = Panel();

	var background = Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = Label({
		label: "Type",
		font: fontSmall
	});
	me.addChild(labelLoad);

	var selectionType = RadioGroup();
	selectionType.setProperties({
		align: "right",
		size:"med",
		divider: "line",
		highLightSelection:true
	});
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

	me.setLayout = function(){

		var innerWidth = me.width-2;
		var innerHeight = me.height - 20;

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: 0,
			top: 0,
			height: me.height,
			width: me.width
		});

		label1.setProperties({
			left: 1,
			top: 1,
			height: 16,
			width: innerWidth
		});

		labelLoad.setProperties({
			left: -1,
			top: 3,
			height: 16,
			width: innerWidth
		});

		selectionType.setProperties({
			left:4,
			width: innerWidth-4,
			height: innerHeight,
			top: 18
		});



	};

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

