UI.buttonGroup = function(title,buttonsInfo){

	var me = UI.panel();
	me.hide();

	var titleBar = UI.scale9Panel(0,0,20,20,UI.Assets.panelDarkGreyScale9);
	titleBar.ignoreEvents = true;
	me.addChild(titleBar);

	var titleLabel = UI.label({
		label: title,
		font: fontSmall,
		width: 60,
		top: 1
	});
	me.addChild(titleLabel);

	var buttons = [];

	buttonsInfo.forEach(function(buttonInfo){
		if (buttonInfo.type === "number"){
			var button = UI.numberDisplay({
				autoPadding: true
			});
			button.setValue(buttonInfo.value);
		}else{
			button = UI.Assets.generate("buttonLight");
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

