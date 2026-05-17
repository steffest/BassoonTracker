import Panel from "./components/panel.js";
import Scale9Panel from "./components/scale9.js";
import Label from "./components/label.js";
import RadioGroup from "./components/radiogroup.js";
import Assets from "./assets.js";
import {EVENT, FILETYPE} from "../enum.js";
import Host from "../host.js";
import EventBus from "../eventBus.js";
import UI from "./ui.js";
import Font from "./font.js";


let DiskOperationTargets = function(){

	var me = new Panel();
	var currentTarget = "bassoon";

	var background = new Scale9Panel(0,0,20,20,Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = new Scale9Panel(0,0,20,20,Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var label = new Label(0, 0, 20, 20);
	label.label = "From";
	label.font = Font.small;
	me.addChild(label);

	var targetsModule = [
		{label: "Bassoon:" , target: "bassoon", active:true},
		{label: "Modarchive:",target: "modarchive"},
		{label: "Modules.pl:",target: "modulespl"},
		{label: "Dropbox:" , target: "dropbox"},
		{label: "local:" , target: "local"}
	];

	var targetsSample = [
		{label: "Bassoon:" , target: "bassoon", active:true},
		{label: "Dropbox:" , target: "dropbox"},
		{label: "local:" , target: "local"}
	];

	var targetsPlaylist = [
		{label: "Bassoon:" , target: "bassoon", active:true},
		{label: "HippoPlayer.se:" , target: "hippo"},
		{label: "Dropbox:" , target: "dropbox"},
		{label: "local:" , target: "local"}
	];

	var targetsSave = [
		{label: "local:" , target: "local", active:true},
        {label: "Dropbox:" , target: "dropbox"}
	];

	
	if (!Host.useDropbox){
	    removeTarget(targetsModule,"dropbox");
	    removeTarget(targetsSample,"dropbox");
	    removeTarget(targetsPlaylist,"dropbox");
	    removeTarget(targetsSave,"dropbox");
	}
	
	function removeTarget(list,target){
	    var index = list.findIndex(function(item){return item.target === target;})
        if (index>=0){
            list.splice(index, 1)
        }
	}

	var currentLoadTargets = targetsModule;
	var currentAction = "load";

	var selectionTarget = new RadioGroup();
	selectionTarget.align = "right";
	selectionTarget.size = "med";
	selectionTarget.divider = "line";
	selectionTarget.highLightSelection = true;
	selectionTarget.setItems(targetsModule);
	selectionTarget.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationTargetChange,this.getSelectedItem());
	};
	me.addChild(selectionTarget);


	me.onResize = function(){
		var innerWidth = me.width-3;

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.left = 0;
		background.top = 0;
		background.height = me.height;
		background.width = me.width;

		label1.left = 2;
		label1.top = 1;
		label1.height = 16;
		label1.width = innerWidth;

		label.left = -1;
		label.top = 3;
		label.height = 16;
		label.width = innerWidth;

		var buttonTop = 18;

		selectionTarget.width = innerWidth;
		selectionTarget.height = me.height - buttonTop - 2;
		selectionTarget.left = 2;
		selectionTarget.top = buttonTop;

	};

	me.setLayout = me.onResize;

	me.getTarget = function(){
		return currentTarget;
	};

    EventBus.on(EVENT.diskOperationTargetChange,function(target){
        if (target && target.fileType){

        	if (currentAction === "save"){
				selectionTarget.setItems(targetsSave);
			}else{
				if (target.fileType === FILETYPE.module) {
					currentLoadTargets = targetsModule;
				}
				if (target.fileType === FILETYPE.sample){
					currentLoadTargets = targetsSample;
				}
				if (target.fileType === FILETYPE.playlist){
					currentLoadTargets = targetsPlaylist;
				}

				selectionTarget.setItems(currentLoadTargets);
			}

            selectionTarget.setSelectedIndex(0);
        }
    });


	EventBus.on(EVENT.diskOperationActionChange,function(target){
		if (target.label === "save"){
			label.label = "To";
			currentAction = "save";
			selectionTarget.setItems(targetsSave);
		}else{
			label.label = "From";
			currentAction = "load";
			selectionTarget.setItems(currentLoadTargets);
		}

        EventBus.trigger(EVENT.diskOperationTargetChange,selectionTarget.getSelectedItem());

	});

	EventBus.on(EVENT.dropboxConnectCancel,function(){
		selectionTarget.setSelectedIndex(0);
	});

	return me;

};

export default DiskOperationTargets;