UI.app_controlPanel = function(){
    var me = UI.app_panelContainer(40);

    var songControl = UI.app_songControl();
    me.addChild(songControl);

    var buttonFileOperations = UI.checkboxbutton({
        label: "File",
        onDown: function(){
            var view = this.isActive ? "diskop_load" : "topmain";
			EventBus.trigger(EVENT.showView,view);
        }
    });
    var buttonOptions = UI.checkboxbutton({
		label: "Options",
		onDown: function(){
			var view = this.isActive ? "options" : "topmain";
			EventBus.trigger(EVENT.showView,view);
		}
	});
	var buttonSampleEdit = UI.checkboxbutton({
		label: "Sample Edit",
		onDown: function(){
			var view = this.isActive ? "sample" : "bottommain";
			EventBus.trigger(EVENT.showView,view);
		}
	});

	me.addChild(buttonFileOperations);
	me.addChild(buttonOptions);
	me.addChild(buttonSampleEdit);

	var buttonProperties = {
		background: UI.Assets.buttonKeyScale9,
		hoverBackground:UI.Assets.buttonKeyHoverScale9,
		activeBackground:UI.Assets.buttonKeyActiveScale9,
		isActive:false,
		textAlign: "center",
		font: window.fontDark,
		paddingTopActive: 1
	};

	var modButton = UI.button();
	var xmButton = UI.button();

	modButton.setProperties(buttonProperties);
	modButton.setLabel("mod");
	modButton.onDown = function(){
		Tracker.setTrackerMode(TRACKERMODE.PROTRACKER);
	};
	me.addChild(modButton);

	xmButton.setProperties(buttonProperties);
	xmButton.setLabel("XM");
	xmButton.onDown = function(){
		Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER);
	};
	me.addChild(xmButton);

	var trackView = [4,8,12,16];
	var trackButtons = [];
	trackView.forEach(function(count){trackButtons.push(UI.button());});
	trackButtons.forEach(function(button,index){
		button.setProperties(buttonProperties);
		button.setLabel("" + trackView[index]);
		button.index = index;
		button.onDown = function(){
			if (this.isDisabled) return;
			var activeIndex = this.index;
			trackButtons.forEach(function(b,index){
				b.setActive(index === activeIndex);
			});
			Layout.setVisibleTracks(trackView[activeIndex]);

		};
		me.addChild(button);
	});

	var labelTrackerMode = UI.label();
	labelTrackerMode.setProperties({
		label : "Mode",
		labels:[
			{width: 20, label:""},
			{width: 78, label:"M"},
			{width: 84, label:"Md"},
			{width: 100, label:"Mode"}
		],
		font: fontSmall,
		width: 100,
		height: 20,
		textAlign: "right"
	});
	labelTrackerMode.ignoreEvents = true;
	me.addChild(labelTrackerMode);

	var labelTrackView = UI.label();
	labelTrackView.setProperties({
		label : "Display",
		labels : [
			{width: 10, label: ""},
			{width: 78, label: "t"},
			{width: 84, label: "tr"},
			{width: 100, label: "trck"},
			{width: 120, label: "Display"}
		],
		font: fontSmall,
		width: 100,
		height: 20,
		textAlign: "right"
	});
	labelTrackView.ignoreEvents = true;
	me.addChild(labelTrackView);


	var trackCountSpinbox = UI.spinBox();
	trackCountSpinbox.setProperties({
		name: "Pattern",
		value: Tracker.getTrackCount(),
		max: 32,
		min:2,
		size: "big",
		padLength: 2,
		trackUndo: true,
		undoLabel: "Change Track count",
		onChange : function(value){Tracker.setTrackCount(value)}
	});
	me.addChild(trackCountSpinbox);

	me.onPanelResize = function(){

        me.innerHeight = me.height - (Layout.defaultMargin*2);
        var row1Top = Layout.defaultMargin;
        var row2Top = Layout.defaultMargin;

		if (Layout.controlPanelButtonLayout === "2row"){
			var halfHeight = Math.floor((me.innerHeight - Layout.defaultMargin)/2);
			row2Top = me.height - halfHeight - Layout.defaultMargin;
			me.innerHeight = halfHeight;
		}



        songControl.setProperties({
            left: Layout.col1X,
            top: row1Top,
            width: Layout.songControlWidth,
            height: me.innerHeight,
            songPatternSelector: "small"
        });

        var buttonWidth = Layout.col1W - 60;
		buttonWidth = Math.max(buttonWidth,120);
        var buttonMargin = Math.floor((Layout.col1W - buttonWidth)/2);

		var buttonSampleLeft = Layout.col4X + buttonMargin;
		var buttonSampleLabel = "Sample Edit";

		if (Layout.controlPanelButtonLayout !== "1row"){
			buttonWidth = Math.floor(Layout.controlPanelButtonsWidth / 3);
			buttonMargin = 0;
			buttonSampleLeft = Layout.controlPanelButtonsLeft + (buttonWidth*2);
			buttonSampleLabel = "Sample";
		}



		var buttonHeight = me.innerHeight;

        buttonFileOperations.setProperties({
			left: Layout.controlPanelButtonsLeft + (buttonMargin * 1.5),
			top: row2Top,
			width: buttonWidth,
			height: buttonHeight
        });

		buttonOptions.setProperties({
			left: buttonFileOperations.left + buttonWidth + buttonMargin,
			top: row2Top,
			width: buttonWidth,
			height: buttonHeight
		});

		buttonSampleEdit.setProperties({
			left: buttonSampleLeft,
			top: row2Top,
			width: buttonWidth,
			height: buttonHeight,
			label: buttonSampleLabel
		});

		var marginLeft = Layout.modeButtonsWidth - 101;
		modButton.setProperties({
			left: Layout.modeButtonsLeft + marginLeft,
			top: row1Top,
			width: 51,
			height: 16
		});

		xmButton.setProperties({
			left: modButton.left+modButton.width-1,
			top: modButton.top,
			width: modButton.width,
			height: modButton.height
		});

		var bLeft = modButton.left;
		trackButtons.forEach(function(button,index){
			button.setProperties({
				left: bLeft,
				top: modButton.top+modButton.height,
				width: 26,
				height: modButton.height
			});
			bLeft += button.width - 1;

			button.setActive(trackView[index] === Layout.visibleTracks);
			button.setDisabled(trackView[index] > Layout.maxVisibleTracks);

		});


		labelTrackerMode.setProperties({
			left: Layout.modeButtonsLeft,
			top: row1Top+1,
			width: Layout.modeButtonsWidth - 94	,
			height: 20
		});

		labelTrackView.setProperties({
			left: labelTrackerMode.left,
			top: labelTrackerMode.top + modButton.height,
			width: labelTrackerMode.width,
			height: labelTrackerMode.height
		});


		trackCountSpinbox.setProperties({
			left: Layout.modeButtonsLeft,
			top: row1Top,
			width: Layout.TrackCountSpinboxWidth,
			height: me.innerHeight
		});
    };
    me.onPanelResize();

    me.renderInternal = function(){

		if (Layout.controlPanelButtonLayout === "2row") return;

		me.ctx.drawImage(Y.getImage("line_ver"),Layout.controlPanelButtonsLeft-2,0,2,me.height-1);
		me.ctx.drawImage(Y.getImage("line_ver"),Layout.modeButtonsLeft-2,0,2,me.height-1);

		if (Layout.controlPanelButtonLayout === "condensed") return;

		me.ctx.drawImage(Y.getImage("line_ver"),Layout.col4X-2,0,2,me.height-1);

        me.ctx.translate(0.5, 0.5);
		me.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		me.ctx.lineWidth = 1;
		me.ctx.beginPath();
		me.ctx.moveTo(Layout.col2X + 10, 10);
		me.ctx.lineTo(Layout.col2X + 10, 20);
		me.ctx.lineTo(Layout.col4X-14, 20);
		me.ctx.lineTo(Layout.col4X-14, 10);

		me.ctx.moveTo(Layout.col4X + 10, 30);
		me.ctx.lineTo(Layout.col4X + 10, 20);
		me.ctx.lineTo(Layout.col5X - 14,20);
		me.ctx.lineTo(Layout.col5X - 14,30);
		me.ctx.stroke();
        me.ctx.setTransform(1, 0, 0, 1, 0, 0);

		buttonFileOperations.render();
		buttonOptions.render();
		buttonSampleEdit.render();

	};

    EventBus.on(EVENT.showView,function(view){
        switch (view){
            case "diskop_load":
            case "diskop_save":
            case "diskop_samples_load":
            case "diskop_modules_load":
			case "diskop_samples_save":
			case "diskop_modules_save":
				buttonFileOperations.setActive(true);
				buttonOptions.setActive(false);
                break;
			case "options":
				buttonFileOperations.setActive(false);
				buttonOptions.setActive(true);
				break;
			case "topmain":
				buttonFileOperations.setActive(false);
				buttonOptions.setActive(false);
			    break;
			case "main":
			    buttonFileOperations.setActive(false);
				buttonOptions.setActive(false);
				buttonSampleEdit.setActive(false);
				break;
			case "bottommain":
				buttonSampleEdit.setActive(false);
				break;
			case "sample":
				buttonSampleEdit.setActive(true);
				break;
        }
    });

	EventBus.on(EVENT.trackerModeChanged,function(mode){
		modButton.setActive(mode === TRACKERMODE.PROTRACKER);
		xmButton.setActive(mode === TRACKERMODE.FASTTRACKER);
		Layout.setLayout();
	});

    EventBus.on(EVENT.trackCountChange,function(count){
       trackCountSpinbox.setValue(count,true);
    });

    EventBus.on(EVENT.songLoaded,function(song){
    	var targetChannels = song.channels;
        if (targetChannels>12 && targetChannels<16) targetChannels=16;
    	if (targetChannels>8 && targetChannels<12) targetChannels=12;
    	if (targetChannels>4 && targetChannels<8) targetChannels=8;
    	targetChannels = Math.min(targetChannels,Layout.maxVisibleTracks);
		Layout.setVisibleTracks(targetChannels);
        me.onPanelResize();
	});



    return me;
};