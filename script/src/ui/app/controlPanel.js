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
		activeBackground:UI.Assets.buttonKeyActiveScale9,
		isActive:false,
		textAlign: "center",
		font: window.fontDark,
		paddingTopActive: 1
	};

	var modButton = UI.button();
	var xmButton = UI.button();

	modButton.setProperties(buttonProperties);
	modButton.setLabel("Mod");
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
		label : "Mode:",
		font: fontFT,
		width: 100,
		height: 20,
		textAlign: "right"
	});
	me.addChild(labelTrackerMode);

	var labelTrackView = UI.label();
	labelTrackView.setProperties({
		label : "Display:",
		font: fontFT,
		width: 100,
		height: 20,
		textAlign: "right"
	});
	me.addChild(labelTrackView);

	me.onPanelResize = function(){

        me.innerHeight = me.height - (Layout.defaultMargin*2);

        songControl.setProperties({
            left: Layout.col1X,
            top: Layout.defaultMargin,
            width: Layout.col1W,
            height: me.innerHeight,
            songPatternSelector: "small"
        });

        var buttonWidth = Layout.col1W - 60;
		buttonWidth = Math.max(buttonWidth,115);
        var buttonMargin = Math.floor((Layout.col1W - buttonWidth)/2);

        buttonFileOperations.setProperties({
			left: Layout.col2X + (buttonMargin * 1.5),
			top: Layout.defaultMargin,
			width: buttonWidth,
			height: me.innerHeight
        });

		buttonOptions.setProperties({
			left: buttonFileOperations.left + buttonWidth + buttonMargin,
			top: Layout.defaultMargin,
			width: buttonWidth,
			height: me.innerHeight
		});

		buttonSampleEdit.setProperties({
			left: Layout.col4X + buttonMargin,
			top: Layout.defaultMargin,
			width: buttonWidth,
			height: me.innerHeight
		});



		var marginLeft = Layout.col1W - 101;
		modButton.setProperties({
			left: Layout.col5X + marginLeft,
			top: Layout.defaultMargin,
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

			if (trackView[index] === Layout.visibleTracks) {
				button.setActive(true);
			}
		});





		labelTrackerMode.setProperties({
			left: Layout.col5X,
			top: Layout.defaultMargin-2,
			width: Layout.col1W - 95,
			height: 20
		});

		labelTrackView.setProperties({
			left: labelTrackerMode.left,
			top: labelTrackerMode.top + modButton.height,
			width: labelTrackerMode.width,
			height: labelTrackerMode.height
		});
    };
    me.onPanelResize();

    me.renderInternal = function(){
		me.ctx.drawImage(Y.getImage("line_ver"),Layout.col2X-2,0,2,me.height-1);
		me.ctx.drawImage(Y.getImage("line_ver"),Layout.col4X-2,0,2,me.height-1);
		me.ctx.drawImage(Y.getImage("line_ver"),Layout.col5X-2,0,2,me.height-1);

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
	});


    return me;
};