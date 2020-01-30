UI.DiskOperationTargets = function(){

	var me = UI.panel();
	var currentTarget = "bassoon";

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var label = UI.label({
		label: "From",
		font: fontSmall
	});
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

	var targetsSave = [
		{label: "local:" , target: "local", active:true},
        {label: "Dropbox:" , target: "dropbox"}
	];

	
	if (!Host.useDropbox){
	    removeTarget(targetsModule,"dropbox");
	    removeTarget(targetsSample,"dropbox");
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

	var selectionTarget = UI.radioGroup();
	selectionTarget.setProperties({
		align: "right",
		size:"med",
		divider: "line",
		highLightSelection:true
	});
	selectionTarget.setItems(targetsModule);
	selectionTarget.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationTargetChange,this.getSelectedItem());
	};
	me.addChild(selectionTarget);


	me.setLayout = function(){

		var innerWidth = me.width-3;

		if (!UI.mainPanel) return;
		me.clearCanvas();

		background.setProperties({
			left: 0,
			top: 0,
			height: me.height,
			width: me.width
		});

		label1.setProperties({
			left: 2,
			top: 1,
			height: 16,
			width: innerWidth
		});

		label.setProperties({
			left: -1,
			top: 3,
			height: 16,
			width: innerWidth
		});

		var buttonTop = 18;

		selectionTarget.setProperties({
			width: innerWidth,
			height: me.height - buttonTop - 2,
			left: 2,
			top: buttonTop
		});

	};

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

				selectionTarget.setItems(currentLoadTargets);
			}

            selectionTarget.setSelectedIndex(0);
        }
    });


	EventBus.on(EVENT.diskOperationActionChange,function(target){
		if (target.label === "save"){
			label.setLabel("To");
			currentAction = "save";
			selectionTarget.setItems(targetsSave);
		}else{
			label.setLabel("From");
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