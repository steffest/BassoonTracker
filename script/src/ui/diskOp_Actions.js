UI.DiskOperationActions = function(){

	var me = UI.panel();

	var background = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkInsetScale9);
	background.ignoreEvents = true;
	me.addChild(background);

	var label1 = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	label1.ignoreEvents = true;
	me.addChild(label1);

	var labelLoad = UI.label({
		label: "Load",
		font: fontSmall
	});
	me.addChild(labelLoad);

	var selectionType = UI.radioGroup();
	selectionType.setProperties({
		align: "right",
		size:"med",
		divider: "line",
		highLightSelection:true
	});
	selectionType.setItems([
		{label:"module",active:true, fileType: FILETYPE.module},
		{label:"sample",active:false, fileType: FILETYPE.sample},
		//{label:"pattern",active:false, fileType: FILETYPE.pattern}
	]);
	selectionType.onChange = function(selectedIndex){
		EventBus.trigger(EVENT.diskOperationTargetChange,this.getSelectedItem());
	};
	me.addChild(selectionType);

	var exitButton = UI.button();
	exitButton.setProperties({
		label: "Exit",
		textAlign:"center",
		background: UI.Assets.buttonLightScale9,
		font:window.fontMed
	});
	exitButton.onClick = function(){App.doCommand(COMMAND.showTop)};
	me.addChild(exitButton);


	me.setLayout = function(){

		var innerWidth = me.width-2;
		var innerHeight = 70;

		if (me.height<100){
			exitButton.hide();
			innerHeight = me.height - 20;
		}else{
			exitButton.show();
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

		exitButton.setProperties({
			left:2,
			width: innerWidth,
			height: 30,
			top: me.height - 29
		});



	};

	me.getAction = function(){
		var index = selectionType.getSelectedIndex();
		var result = "modules";
		if (index == 1) result = "samples";
		if (index == 2) result = "patterns";
		return result;
	};

	return me;

};

