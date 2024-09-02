import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Assets from "./assets.js";
import Label from "./components/label.js";
import RadioGroup from "./components/radiogroup.js";
import EventBus from "../eventBus.js";
import {EVENT} from "../enum.js";
import UI from "./ui.js";


let DiskOperationActions = function(){

	var me = Panel();

	var background = Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = Label({
		label: "Action",
		font: fontSmall
	});
	me.addChild(labelLoad);

	var selectionType = RadioGroup();
	selectionType.setProperties({
		align: "right",
		size:"med",
		divider: "line",
		type:"buttons",
		highLightSelection:true
	});
	selectionType.setItems([
		{label:"load",active:true},
		{label:"save",active:false}
	]);
	selectionType.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationActionChange,this.getSelectedItem());
	};
	me.addChild(selectionType);

	me.setLayout = function(){

		var innerWidth = me.width-2;
		var innerHeight = 70;

		if (me.height<100){
			innerHeight = me.height - 20;
		}


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

